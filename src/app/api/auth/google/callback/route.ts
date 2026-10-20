import { NextRequest, NextResponse } from "next/server";
import { getGoogleConfig, decodeGoogleFlow, exchangeGoogleCode, GOOGLE_FLOW_COOKIE } from "@/server/auth/google-oidc";
import { validateGoogleIdentity } from "@/server/auth/google-policy";
import { findOrCreateGoogleUser } from "@/server/auth/google-user";
import { createSession, SESSION_COOKIE } from "@/server/auth/session";

export const runtime = "nodejs";

function loginRedirect(origin: string, error: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(GOOGLE_FLOW_COOKIE, "", {
    path: "/api/auth/google/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const config = getGoogleConfig();
  if (!config) return new Response("Google login unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });

  if (request.nextUrl.pathname !== "/api/auth/google/callback") {
    return loginRedirect(config.origin, "invalid_flow");
  }
  // Use the configured public origin. In Docker and behind TLS-terminating proxies,
  // request.url may contain the internal host/port instead of the browser's origin.
  const callbackUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, config.origin);

  const flow = decodeGoogleFlow(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value, config.clientSecret);
  if (!flow) {
    console.warn("Google login: flow cookie missing or invalid");
    return loginRedirect(config.origin, "invalid_flow");
  }
  if (!callbackUrl.searchParams.has("code") || !callbackUrl.searchParams.has("state")) {
    console.warn("Google login: callback parameters missing");
    return loginRedirect(config.origin, "invalid_flow");
  }

  let claims: Awaited<ReturnType<typeof exchangeGoogleCode>>;
  try {
    claims = await exchangeGoogleCode(callbackUrl, flow);
  } catch (error) {
    // Never log the callback URL, authorization code, cookie, or token.
    console.error("Google login: code exchange failed", error instanceof Error ? error.name : "unknown error");
    return loginRedirect(config.origin, "invalid_flow");
  }
  const identity = claims && validateGoogleIdentity(claims);
  if (!identity) return loginRedirect(config.origin, "not_allowed");

  try {
    const user = await findOrCreateGoogleUser(identity);
    if (!user) return loginRedirect(config.origin, "account_conflict");

    // Rotate the browser's previous Mirador session after Google has authenticated the new account.
    const { token, expiresAt } = await createSession(user.id, request.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.redirect(new URL(flow.returnTo, config.origin));
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(GOOGLE_FLOW_COOKIE, "", {
      path: "/api/auth/google/callback",
      maxAge: 0,
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.secure,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return response;
  } catch (error) {
    console.error("Google login: account or session persistence failed", error instanceof Error ? error.name : "unknown error");
    return loginRedirect(config.origin, "server_error");
  }
}
