import { NextRequest, NextResponse } from "next/server";
import { deleteCurrentSession, SESSION_COOKIE } from "@/server/auth/session";
import { getGoogleConfig } from "@/server/auth/google-oidc";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const config = getGoogleConfig();
  if (!config || request.nextUrl.origin !== config.origin || request.headers.get("origin") !== config.origin) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  await deleteCurrentSession();
  const response = NextResponse.redirect(new URL("/", config.origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
