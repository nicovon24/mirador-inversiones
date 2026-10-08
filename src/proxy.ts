import { NextResponse, type NextRequest } from "next/server";

/**
 * Chequeo optimista: sin cookie de sesión no se entra. No consulta la base (corre en cada pedido);
 * la verificación real la hace `verifySession` en cada página y Server Action.
 */
const SESSION_COOKIE = "mirador_session";

/** Rutas que se autentican por su cuenta o son públicas. */
const PUBLIC_PREFIXES = [
  "/login",
  // Cron y webhook usan su propio secreto en el header.
  "/api/cron/",
  "/api/telegram/",
  // El callback de IOL se autoriza con el state de un solo uso y la cookie del flujo.
  "/api/iol/callback",
];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Todo menos estáticos, imágenes optimizadas y archivos con extensión (favicon, íconos…).
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
