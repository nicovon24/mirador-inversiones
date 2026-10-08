import "server-only";
import { env, hasIolOAuth } from "@/lib/env";
import { createTokenCipher } from "@/lib/security/crypto";
import { createIolGateway, type IolGateway } from "./gateway";
import { createMcpClient } from "./mcp-client";
import { createOAuthHttp } from "./oauth-client";
import { prismaIolStore } from "./prisma-store";
import { createIolSessionService, type IolSessionService } from "./session-service";

/** Cookie que ata el flujo OAuth al navegador que lo inició. Vive 10 minutos y solo viaja al callback. */
export const IOL_FLOW_COOKIE = "iol_oauth_state";
export const IOL_CALLBACK_PATH = "/api/iol/callback";

let instance: { session: IolSessionService; gateway: IolGateway } | null = null;

/** Servicios de IOL listos para usar, o null si falta IOL_SESSION_SECRET. */
export function iol(): { session: IolSessionService; gateway: IolGateway } | null {
  if (!hasIolOAuth) return null;
  if (!instance) {
    const config = { baseUrl: env.IOL_MCP_BASE_URL, callbackUri: env.IOL_MCP_CALLBACK_URI };
    const session = createIolSessionService({
      store: prismaIolStore,
      oauth: createOAuthHttp(config.baseUrl),
      cipher: createTokenCipher(env.IOL_SESSION_SECRET!),
      config,
    });
    instance = { session, gateway: createIolGateway(createMcpClient(config.baseUrl), session) };
  }
  return instance;
}

/** Origen fijo de la app, tomado de la URL de callback configurada (nunca del Host del pedido). */
export function appOrigin(): string {
  return new URL(env.IOL_MCP_CALLBACK_URI).origin;
}

export const flowCookieSecure = () => new URL(env.IOL_MCP_CALLBACK_URI).protocol === "https:";
