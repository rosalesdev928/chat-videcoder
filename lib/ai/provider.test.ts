import { afterEach, describe, expect, it, vi } from "vitest";
import type { AIConfig } from "./config";
import {
  AIRefusalError,
  AITimeoutError,
  AIUnavailableError,
  OllamaUnavailableError,
} from "./errors";
import { generateText, type GenerateTextOptions } from "./provider";

const { create, betaCreate } = vi.hoisted(() => ({
  create: vi.fn(),
  betaCreate: vi.fn(),
}));

// Keep the real SDK (error classes, types) but replace the network calls
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic extends actual.default {
    constructor(...args: ConstructorParameters<typeof actual.default>) {
      super(...args);
      Object.defineProperty(this, "messages", { value: { create } });
      Object.defineProperty(this, "beta", { value: { messages: { create: betaCreate } } });
    }
  }
  return { ...actual, default: FakeAnthropic };
});

const ollamaConfig: AIConfig = {
  provider: "ollama",
  model: "codellama:latest",
  completionModel: "codellama:latest",
  ollamaBaseUrl: "http://localhost:11434",
};

const anthropicConfig: AIConfig = {
  provider: "anthropic",
  model: "claude-opus-5-5",
  completionModel: "claude-opus-5-5",
  ollamaBaseUrl: "http://localhost:11434",
  anthropicApiKey: "test-key",
};

const options: GenerateTextOptions = {
  system: "You are a test",
  messages: [{ role: "user", content: "Hello" }],
  model: "codellama:latest",
  maxTokens: 100,
  timeoutMs: 1000,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("generateText with Ollama", () => {
  it("calls /api/chat with the system prompt and returns the message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "  Hi there  " } }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateText(ollamaConfig, options);

    expect(result).toBe("Hi there");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: "codellama:latest",
      stream: false,
      options: { num_predict: 100 },
    });
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a test" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws OllamaUnavailableError when Ollama is not running", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(generateText(ollamaConfig, options)).rejects.toBeInstanceOf(
      OllamaUnavailableError
    );
  });

  it("throws AITimeoutError when the request times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"))
    );

    await expect(generateText(ollamaConfig, options)).rejects.toBeInstanceOf(AITimeoutError);
  });

  it("throws AIUnavailableError on HTTP errors (e.g. model not pulled)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("model not found", { status: 404 }))
    );

    await expect(generateText(ollamaConfig, options)).rejects.toBeInstanceOf(
      AIUnavailableError
    );
  });
});

describe("generateText with Anthropic", () => {
  const textResponse = (text: string, stop_reason = "end_turn") => ({
    stop_reason,
    content: [
      { type: "thinking", thinking: "" },
      { type: "text", text },
    ],
  });

  it("uses the server-side fallback for models that support it", async () => {
    betaCreate.mockResolvedValue(textResponse(" Hello! "));

    const result = await generateText(
      { ...anthropicConfig, effort: "low" },
      { ...options, model: "claude-opus-5-5", maxRetries: 1 }
    );

    expect(result).toBe("Hello!");
    expect(create).not.toHaveBeenCalled();
    const [params, requestOptions] = betaCreate.mock.calls[0];
    expect(params).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 100,
      system: "You are a test",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
    });
    expect(requestOptions).toEqual({ timeout: 1000, maxRetries: 1 });
  });

  it("uses the regular endpoint for other models and omits unset effort", async () => {
    create.mockResolvedValue(textResponse("ok"));

    await generateText(anthropicConfig, { ...options, model: "claude-haiku-5-5" });

    expect(betaCreate).not.toHaveBeenCalled();
    const [params] = create.mock.calls[0];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params).not.toHaveProperty("output_config");
    expect(params).not.toHaveProperty("fallbacks");
  });

  it("throws AIRefusalError when the model refuses", async () => {
    create.mockResolvedValue(textResponse("", "refusal"));

    await expect(
      generateText(anthropicConfig, { ...options, model: "claude-haiku-5-5" })
    ).rejects.toBeInstanceOf(AIRefusalError);
  });
});
