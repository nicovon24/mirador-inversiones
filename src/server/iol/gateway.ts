import { IolError } from "./errors";
import type { McpClient, ToolCall, ToolResult } from "./mcp-client";
import type { IolSessionService } from "./session-service";

/**
 * Lista explícita de herramientas MCP de solo lectura. Todo lo demás se descarta antes de tocar la red:
 * órdenes, suscripciones, validaciones (validate_*), declaraciones juradas (get_ddjj, accept_ddjj),
 * herramientas promocionales como buy_ggal_at_50_cents y cualquier herramienta nueva que IOL agregue.
 */
export const ALLOWED_READ_TOOLS: ReadonlySet<string> = new Set([
  "get_portfolio",
  "get_balance",
  "get_asset_quote",
  "get_asset_info",
  "get_price_history",
  "get_fixed_income_analytics",
  "get_fci_funds",
]);

export function createIolGateway(mcp: McpClient, session: Pick<IolSessionService, "getValidAccessToken" | "forceRefresh">) {
  return {
    /** Ejecuta herramientas permitidas en una sesión MCP. Ante un 401 renueva el token una vez y reintenta. */
    async callReadTools(userId: string, calls: ToolCall[]): Promise<ToolResult[]> {
      const allowed = calls.filter((c) => ALLOWED_READ_TOOLS.has(c.tool));
      if (allowed.length === 0) return [];
      const token = await session.getValidAccessToken(userId);
      try {
        return await mcp.callTools(token, allowed);
      } catch (e) {
        if (!(e instanceof IolError) || e.status !== 401) throw e;
        return mcp.callTools(await session.forceRefresh(userId), allowed);
      }
    },

    async toolSchema(userId: string, tool: string) {
      if (!ALLOWED_READ_TOOLS.has(tool)) return null;
      return mcp.toolSchema(await session.getValidAccessToken(userId), tool);
    },
  };
}

export type IolGateway = ReturnType<typeof createIolGateway>;
