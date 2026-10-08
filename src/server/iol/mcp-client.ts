import { IolError } from "./errors";

/** Cliente MCP por HTTP (Streamable HTTP, JSON-RPC 2.0) contra el servidor oficial de IOL. */

const PROTOCOL_VERSION = "2025-06-18";
const TIMEOUT_MS = 15_000;
const TOOLS_TTL_MS = 10 * 60_000;

export interface ToolCall {
  tool: string;
  arguments?: Record<string, unknown>;
}

export interface ToolResult {
  call: ToolCall;
  status: "success" | "unavailable" | "missing_argument" | "tool_error";
  /** `result` del JSON-RPC; solo vive en memoria durante el pedido. */
  result?: unknown;
}

type Json = Record<string, unknown>;

export function createMcpClient(baseUrl: string, fetchImpl: typeof fetch = fetch, clock: () => number = Date.now) {
  let ids = 0;
  let toolsCache: { schemas: Map<string, Json>; at: number } | null = null;

  async function post(token: string, sessionId: string | null, body: Json): Promise<{ body: Json; sessionId: string | null }> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    };
    if (body.method !== "initialize") headers["mcp-protocol-version"] = PROTOCOL_VERSION;
    if (sessionId) headers["mcp-session-id"] = sessionId;
    let res: Response;
    try {
      res = await fetchImpl(new URL("/", baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new IolError(503, "IOL no respondió a tiempo. Intentá nuevamente", "temporary");
    }
    if (!res.ok) throw new IolError(res.status >= 500 ? 503 : res.status, "No se pudo consultar IOL");
    const text = await res.text();
    return { body: parseBody(text), sessionId: res.headers.get("mcp-session-id") ?? sessionId };
  }

  function parseBody(text: string): Json {
    if (!text.trim()) return {};
    try {
      if (text.trimStart().startsWith("{")) return JSON.parse(text) as Json;
      // Respuesta como Server-Sent Events: el JSON-RPC viene en la primera línea "data:".
      for (const line of text.split(/\r?\n/)) {
        if (line.startsWith("data:") && line.slice(5).trim()) return JSON.parse(line.slice(5).trim()) as Json;
      }
      return {};
    } catch {
      throw new IolError(502, "IOL devolvió una respuesta MCP no reconocida", "invalid_response");
    }
  }

  const request = (method: string, params: Json): Json => ({ jsonrpc: "2.0", id: ++ids, method, params });

  async function initialize(token: string): Promise<string | null> {
    const res = await post(
      token,
      null,
      request("initialize", { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "Mirador", version: "1.0" } }),
    );
    if (typeof res.body.result !== "object" || res.body.result === null) {
      throw new IolError(502, "IOL no inició una sesión MCP válida", "invalid_response");
    }
    await post(token, res.sessionId, { jsonrpc: "2.0", method: "notifications/initialized" });
    return res.sessionId;
  }

  async function schemas(token: string, sessionId: string | null): Promise<Map<string, Json>> {
    if (toolsCache && clock() - toolsCache.at < TOOLS_TTL_MS) return toolsCache.schemas;
    const res = await post(token, sessionId, request("tools/list", {}));
    const tools = ((res.body.result as Json | undefined)?.tools ?? []) as Json[];
    const map = new Map<string, Json>();
    for (const t of tools) if (typeof t.name === "string" && t.name) map.set(t.name, (t.inputSchema as Json) ?? {});
    toolsCache = { schemas: map, at: clock() };
    return map;
  }

  async function close(token: string, sessionId: string | null) {
    if (!sessionId) return;
    try {
      await fetchImpl(new URL("/", baseUrl), {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}`, "mcp-session-id": sessionId, "mcp-protocol-version": PROTOCOL_VERSION },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Si IOL no soporta cerrar la sesión explícitamente, vence sola.
    }
  }

  async function withSession<T>(token: string, fn: (sessionId: string | null) => Promise<T>): Promise<T> {
    const sessionId = await initialize(token);
    try {
      return await fn(sessionId);
    } finally {
      await close(token, sessionId);
    }
  }

  return {
    /** Ejecuta varias herramientas en una sola sesión MCP. Un 401 se propaga para renovar el token y reintentar. */
    callTools(token: string, calls: ToolCall[]): Promise<ToolResult[]> {
      if (calls.length === 0) return Promise.resolve([]);
      return withSession(token, async (sessionId) => {
        const known = await schemas(token, sessionId);
        const results: ToolResult[] = [];
        for (const call of calls) {
          const schema = known.get(call.tool);
          if (!schema) {
            results.push({ call, status: "unavailable" });
            continue;
          }
          const args = call.arguments ?? {};
          const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
          if (required.some((r) => args[r] === undefined || args[r] === null)) {
            results.push({ call, status: "missing_argument" });
            continue;
          }
          const res = await post(token, sessionId, request("tools/call", { name: call.tool, arguments: args }));
          const result = res.body.result as Json | undefined;
          results.push(!result || result.isError === true ? { call, status: "tool_error" } : { call, status: "success", result });
        }
        return results;
      });
    },

    /** Esquema de entrada de una herramienta (p. ej. para saber qué países acepta get_portfolio). */
    async toolSchema(token: string, tool: string): Promise<Json | null> {
      if (toolsCache && clock() - toolsCache.at < TOOLS_TTL_MS) return toolsCache.schemas.get(tool) ?? null;
      return withSession(token, async (sessionId) => (await schemas(token, sessionId)).get(tool) ?? null);
    },
  };
}

/** Payload de un resultado: `structuredContent` si existe; si no, el primer `content` de texto parseado como JSON. */
export function payloadOf(result: unknown): unknown {
  const r = (result ?? {}) as Json;
  if (r.structuredContent && typeof r.structuredContent === "object") return r.structuredContent;
  for (const item of (Array.isArray(r.content) ? r.content : []) as Json[]) {
    if (item.type === "text" && typeof item.text === "string" && item.text.trim()) {
      try {
        return JSON.parse(item.text);
      } catch {
        return {};
      }
    }
  }
  return {};
}

export type McpClient = ReturnType<typeof createMcpClient>;
