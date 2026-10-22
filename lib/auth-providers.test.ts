import { describe, expect, it } from "vitest";
import { isGoogleAuthConfigured } from "./auth-providers";

describe("isGoogleAuthConfigured", () => {
  it("is true only when both Google credentials are set", () => {
    expect(isGoogleAuthConfigured({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" })).toBe(
      true
    );
    expect(isGoogleAuthConfigured({ AUTH_GOOGLE_ID: "id" })).toBe(false);
    expect(isGoogleAuthConfigured({ AUTH_GOOGLE_SECRET: "secret" })).toBe(false);
    expect(isGoogleAuthConfigured({})).toBe(false);
  });

  it("treats empty or blank values as missing", () => {
    expect(isGoogleAuthConfigured({ AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "secret" })).toBe(
      false
    );
    expect(isGoogleAuthConfigured({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "  " })).toBe(
      false
    );
  });
});
