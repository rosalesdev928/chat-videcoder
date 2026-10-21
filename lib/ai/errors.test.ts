import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AIConfigError } from "./config";
import {
  AIRefusalError,
  AITimeoutError,
  AIUnavailableError,
  classifyAIError,
} from "./errors";

describe("classifyAIError", () => {
  it.each([
    [new AIConfigError("missing key"), 503, "ai_not_configured"],
    [new AIRefusalError(), 422, "ai_refusal"],
    [new AITimeoutError(), 504, "ai_timeout"],
    [new Anthropic.APIConnectionTimeoutError(), 504, "ai_timeout"],
    [new AIUnavailableError(), 503, "ai_unavailable"],
    [new Anthropic.APIConnectionError({ message: "offline" }), 503, "ai_unavailable"],
    [new Error("boom"), 500, "internal_error"],
    ["not even an error", 500, "internal_error"],
  ])("maps %o to HTTP %i", (error, status, code) => {
    const info = classifyAIError(error);

    expect(info.status).toBe(status);
    expect(info.code).toBe(code);
  });

  it("never leaks the original error message", () => {
    const info = classifyAIError(new AIConfigError("ANTHROPIC_API_KEY is required"));

    expect(info.message).not.toContain("ANTHROPIC_API_KEY");
  });
});
