import { describe, expect, it } from "vitest";
import { AIConfigError, DEFAULT_MODELS, getAIConfig } from "./config";

describe("getAIConfig", () => {
  it("defaults to Ollama with its default model and URL", () => {
    const config = getAIConfig({});

    expect(config.provider).toBe("ollama");
    expect(config.model).toBe(DEFAULT_MODELS.ollama);
    expect(config.completionModel).toBe(DEFAULT_MODELS.ollama);
    expect(config.ollamaBaseUrl).toBe("http://localhost:11434");
    expect(config.effort).toBeUndefined();
  });

  it("reads the model, completion model and Ollama URL from the environment", () => {
    const config = getAIConfig({
      AI_PROVIDER: "ollama",
      AI_MODEL: "qwen2.5-coder:7b",
      AI_COMPLETION_MODEL: "qwen2.5-coder:1.5b",
      OLLAMA_BASE_URL: "http://ollama:11434/",
    });

    expect(config.model).toBe("qwen2.5-coder:7b");
    expect(config.completionModel).toBe("qwen2.5-coder:1.5b");
    expect(config.ollamaBaseUrl).toBe("http://ollama:11434");
  });

  it("treats empty strings as unset", () => {
    const config = getAIConfig({ AI_PROVIDER: "", AI_MODEL: "  ", AI_EFFORT: "" });

    expect(config.provider).toBe("ollama");
    expect(config.model).toBe(DEFAULT_MODELS.ollama);
    expect(config.effort).toBeUndefined();
  });

  it("uses the Anthropic default model when the provider is anthropic", () => {
    const config = getAIConfig({
      AI_PROVIDER: "Anthropic",
      ANTHROPIC_API_KEY: "test-key",
      AI_EFFORT: "LOW",
    });

    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe(DEFAULT_MODELS.anthropic);
    expect(config.anthropicApiKey).toBe("test-key");
    expect(config.effort).toBe("low");
  });

  it("requires an API key for Anthropic", () => {
    expect(() => getAIConfig({ AI_PROVIDER: "anthropic" })).toThrow(AIConfigError);
  });

  it("rejects unknown providers and effort levels", () => {
    expect(() => getAIConfig({ AI_PROVIDER: "openai" })).toThrow(/AI_PROVIDER/);
    expect(() =>
      getAIConfig({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", AI_EFFORT: "extreme" })
    ).toThrow(/AI_EFFORT/);
  });
});
