import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oidc = vi.hoisted(() => ({
  discovery: vi.fn(),
  enableNonRepudiationChecks: vi.fn(),
  randomState: vi.fn(),
  randomNonce: vi.fn(),
  randomPKCECodeVerifier: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("openid-client", () => oidc);

import { exchangeGoogleCode, newGoogleFlow } from "../google-oidc";

describe("Google OIDC protocol parameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("MIRADOR_APP_URL", "https://mirador.example.com");
    const client = { discovered: true };
    oidc.discovery.mockResolvedValue(client);
    oidc.randomState.mockReturnValue("state-12345678901234567890");
    oidc.randomNonce.mockReturnValue("nonce-12345678901234567890");
    oidc.randomPKCECodeVerifier.mockReturnValue("private-pkce-verifier-1234567890");
    oidc.calculatePKCECodeChallenge.mockResolvedValue("public-pkce-challenge");
    oidc.buildAuthorizationUrl.mockReturnValue(new URL("https://accounts.google.com/o/oauth2/v2/auth"));
    oidc.authorizationCodeGrant.mockResolvedValue({ claims: () => ({ sub: "google-sub", email: "nicovon24@gmail.com", email_verified: true }) });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("binds the same state, nonce and private PKCE verifier to authorization and callback", async () => {
    const { flow } = await newGoogleFlow("/portfolio");
    expect(oidc.discovery).toHaveBeenCalledWith(new URL("https://accounts.google.com"), "client-id", "client-secret");
    expect(oidc.enableNonRepudiationChecks).toHaveBeenCalledOnce();
    expect(oidc.calculatePKCECodeChallenge).toHaveBeenCalledWith("private-pkce-verifier-1234567890");
    expect(oidc.buildAuthorizationUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      redirect_uri: "https://mirador.example.com/api/auth/google/callback",
      response_type: "code",
      scope: "openid email",
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: "public-pkce-challenge",
      code_challenge_method: "S256",
    }));

    const callback = new URL("https://mirador.example.com/api/auth/google/callback?code=one-time-code&state=state-12345678901234567890");
    await exchangeGoogleCode(callback, flow);
    expect(oidc.authorizationCodeGrant).toHaveBeenCalledWith(expect.anything(), callback, {
      pkceCodeVerifier: "private-pkce-verifier-1234567890",
      expectedState: flow.state,
      expectedNonce: flow.nonce,
      idTokenExpected: true,
    });
  });
});
