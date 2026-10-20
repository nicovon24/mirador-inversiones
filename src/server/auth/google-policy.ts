const ALLOWED_EMAILS = new Set(["fervon96@gmail.com", "nicovon24@gmail.com"]);

export function isAllowedGoogleEmail(email: unknown): email is string {
  return typeof email === "string" && ALLOWED_EMAILS.has(email.toLowerCase());
}

export function validateGoogleIdentity(claims: {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
}): { sub: string; email: string } | null {
  if (
    typeof claims.sub !== "string" ||
    !claims.sub ||
    claims.email_verified !== true ||
    !isAllowedGoogleEmail(claims.email)
  ) return null;
  return { sub: claims.sub, email: claims.email.toLowerCase() };
}
