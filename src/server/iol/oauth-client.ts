import { IolError } from "./errors";

/** Cliente HTTP de los endpoints OAuth de IOL (registro dinámico, intercambio de code y refresh). */
export interface IolOAuthHttp {
  register(callbackUri: string): Promise<string>;
  exchangeCode(input: { code: string; clientId: string; callbackUri: string; verifier: string }): Promise<TokenResponse>;
  refresh(input: { refreshToken: string; clientId: string }): Promise<TokenResponse>;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

const TIMEOUT_MS = 10_000;

export function createOAuthHttp(baseUrl: string, fetchImpl: typeof fetch = fetch): IolOAuthHttp {
  async function send(path: string, init: RequestInit, rejection: string): Promise<unknown> {
    let res: Response;
    try {
      res = await fetchImpl(new URL(path, baseUrl), { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      // Timeout o red caída: siempre temporal.
      throw new IolError(503, "IOL no respondió a tiempo. Intentá nuevamente", "temporary");
    }
    if (!res.ok) {
      // Se conserva el status de IOL; el cuerpo no se loguea porque puede repetir datos del pedido.
      throw new IolError(res.status >= 500 ? 503 : res.status, rejection, res.status >= 500 ? "temporary" : "rejected");
    }
    try {
      return await res.json();
    } catch {
      throw new IolError(502, "IOL devolvió una respuesta no reconocida", "invalid_response");
    }
  }

  function parseToken(body: unknown): TokenResponse {
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof b.access_token !== "string" || !b.access_token) {
      throw new IolError(502, "IOL no devolvió una sesión OAuth válida", "invalid_response");
    }
    const expires = Number(b.expires_in);
    return {
      accessToken: b.access_token,
      refreshToken: typeof b.refresh_token === "string" && b.refresh_token ? b.refresh_token : null,
      expiresIn: Number.isFinite(expires) && expires > 0 ? expires : 900,
    };
  }

  const form = (fields: Record<string, string>) => ({
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(fields).toString(),
  });

  return {
    async register(callbackUri) {
      const body = (await send(
        "/register",
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            client_name: "Mirador",
            redirect_uris: [callbackUri],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
          }),
        },
        "No se pudo iniciar la vinculación con IOL",
      )) as Record<string, unknown>;
      if (typeof body?.client_id !== "string" || !body.client_id) {
        throw new IolError(502, "IOL no devolvió un identificador OAuth válido", "invalid_response");
      }
      return body.client_id;
    },

    async exchangeCode({ code, clientId, callbackUri, verifier }) {
      return parseToken(
        await send(
          "/token",
          form({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: callbackUri, code_verifier: verifier }),
          "No se pudo completar la vinculación con IOL",
        ),
      );
    },

    async refresh({ refreshToken, clientId }) {
      return parseToken(
        await send(
          "/token",
          form({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId }),
          "No se pudo renovar la sesión de IOL",
        ),
      );
    },
  };
}
