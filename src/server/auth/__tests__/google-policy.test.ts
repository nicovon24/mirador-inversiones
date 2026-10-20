import { describe, expect, it } from "vitest";
import { isAllowedGoogleEmail, validateGoogleIdentity } from "../google-policy";

describe("Google account access policy", () => {
  it("accepts only the two explicitly authorized addresses", () => {
    expect(isAllowedGoogleEmail("fervon96@gmail.com")).toBe(true);
    expect(isAllowedGoogleEmail("nicovon24@gmail.com")).toBe(true);
    expect(isAllowedGoogleEmail("fervonm@gmail.com")).toBe(false);
    expect(isAllowedGoogleEmail("other@gmail.com")).toBe(false);
  });

  it("requires a verified email and stable Google subject", () => {
    expect(validateGoogleIdentity({ sub: "google-sub", email: "FERVON96@GMAIL.COM", email_verified: true }))
      .toEqual({ sub: "google-sub", email: "fervon96@gmail.com" });
    expect(validateGoogleIdentity({ sub: "google-sub", email: "fervon96@gmail.com", email_verified: false }))
      .toBeNull();
    expect(validateGoogleIdentity({ sub: "", email: "fervon96@gmail.com", email_verified: true }))
      .toBeNull();
    expect(validateGoogleIdentity({ sub: "google-sub", email: "other@gmail.com", email_verified: true }))
      .toBeNull();
  });
});
