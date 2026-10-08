import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/server/auth/session";
import { appOrigin, IOL_CALLBACK_PATH, IOL_FLOW_COOKIE, iol } from "@/server/iol";
import { DEFAULT_RETURN_TO } from "@/server/iol/session-service";

/**
 * IOL vuelve acá por GET después del login y el consentimiento (por eso es un Route Handler y no una
 * Server Action, que solo recibe POST). Se autoriza con el state de un solo uso más la cookie del flujo.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const services = iol();
  const cookieState = req.cookies.get(IOL_FLOW_COOKIE)?.value ?? null;

  let returnTo = DEFAULT_RETURN_TO;
  let result: string = "not_configured";
  if (services) {
    const session = await verifySession().catch(() => null);
    const outcome = await services.session
      .completeAuthorization({
        code: params.get("code"),
        state: params.get("state"),
        error: params.get("error"),
        cookieState,
        sessionUserId: session?.id ?? null,
      })
      .catch(() => ({ result: "error" as const, returnTo: DEFAULT_RETURN_TO }));
    result = outcome.result;
    returnTo = outcome.returnTo;
  }

  // Origen fijo de la configuración: nunca se redirige a un Host recibido en el pedido.
  const target = new URL(returnTo, appOrigin());
  target.searchParams.set("iol", result);
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(IOL_FLOW_COOKIE, "", { path: IOL_CALLBACK_PATH, maxAge: 0 });
  // El code y el state viajan en esta URL: que no queden en el historial de referrers.
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
