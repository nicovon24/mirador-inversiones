import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  /** Clave propia para cifrar los tokens de IOL (AES-256-GCM) y firmar el flujo OAuth. Mínimo 32 caracteres. */
  IOL_SESSION_SECRET: z.string().optional(),
  IOL_MCP_BASE_URL: z.string().url().default("https://mcp.invertironline.com"),
  /** URL fija de callback registrada en IOL. Nunca se arma con el Host del pedido. */
  IOL_MCP_CALLBACK_URI: z.string().url().default("http://localhost:3000/api/iol/callback"),
});

export const env = schema.parse(process.env);

export const hasFinnhub = Boolean(env.FINNHUB_API_KEY);
export const hasDatabase = Boolean(env.DATABASE_URL);
/** En entornos publicados el callback debe ser explícito, HTTPS y del origen de la app. */
const iolCallback = process.env.IOL_MCP_CALLBACK_URI;
const appOrigin = process.env.MIRADOR_APP_URL;
const deployedCallbackValid = (() => {
  if (!iolCallback || !appOrigin) return false;
  try {
    const callback = new URL(iolCallback);
    const app = new URL(appOrigin);
    return callback.protocol === "https:" && callback.origin === app.origin && callback.pathname === "/api/iol/callback";
  } catch {
    return false;
  }
})();
export const hasIolOAuth = (env.IOL_SESSION_SECRET?.length ?? 0) >= 32 &&
  (process.env.NODE_ENV === "production" ? deployedCallbackValid : true);
