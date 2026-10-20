import { NextRequest, NextResponse } from "next/server";
import { encodeGoogleFlow, getGoogleConfig, GOOGLE_FLOW_COOKIE, newGoogleFlow, safeReturnTo } from "@/server/auth/google-oidc";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = getGoogleConfig();
  if (!config) return new Response("Google login unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("next"));
  if (request.nextUrl.origin !== config.origin) {
    const canonical = new URL("/api/auth/google/start", config.origin);
    canonical.searchParams.set("next", returnTo);
    return NextResponse.redirect(canonical);
  }

  try {
    const { flow, authorizationUrl } = await newGoogleFlow(returnTo);
    const response = NextResponse.redirect(authorizationUrl);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(GOOGLE_FLOW_COOKIE, encodeGoogleFlow(flow, config.clientSecret), {
      httpOnly: true,
      secure: config.secure,
      sameSite: "lax",
      path: "/api/auth/google/callback",
      maxAge: 600,
    });
    return response;
  } catch {
    return new Response("Google login unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
