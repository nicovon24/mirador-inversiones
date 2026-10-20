import { NextResponse, type NextRequest } from "next/server";

const PRIVATE_PATHS = ["/research", "/portfolio", "/watchlist", "/alerts", "/settings"];

/** Early navigation redirect only. Server pages, queries and actions validate the session. */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPrivate = PRIVATE_PATHS.some((item) => path === item || path.startsWith(`${item}/`));
  if (!isPrivate || request.cookies.has("mirador_session")) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", path + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"] };
