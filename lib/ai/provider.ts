import Anthropic from "@anthropic-ai/sdk";
import type { AIConfig } from "./config";
import {
  AIRefusalError,
  AITimeoutError,
  AIUnavailableError,
  OllamaUnavailableError,
} from "./errors";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateTextOptions {
  system: string;
  messages: ChatTurn[];
  model: string;
  maxTokens: number;
  /** Per-attempt timeout */
  timeoutMs: number;
  /** Anthropic SDK retries (429, 5xx, connection errors). Each retry gets its own timeout */
  maxRetries?: number;
}

// Models that accept the server-side refusal fallback (`fallbacks: "default"`)
const FALLBACK_MODELS = new Set([
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
]);

let anthropicClient: Anthropic | undefined;

function getAnthropicClient(apiKey: string): Anthropic {
  anthropicClient ??= new Anthropic({ apiKey });
  return anthropicClient;
}

async function generateWithAnthropic(
  config: AIConfig,
  { system, messages, model, maxTokens, timeoutMs, maxRetries = 0 }: GenerateTextOptions
): Promise<string> {
  const client = getAnthropicClient(config.anthropicApiKey!);
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    ...(config.effort && { output_config: { effort: config.effort } }),
  };

  const requestOptions = { timeout: timeoutMs, maxRetries };

  const response = FALLBACK_MODELS.has(model)
    ? await client.beta.messages.create(
        {
          ...params,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        requestOptions
      )
    : await client.messages.create(params, requestOptions);

  if (response.stop_reason === "refusal") {
    throw new AIRefusalError();
  }

  return response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

async function generateWithOllama(
  config: AIConfig,
  { system, messages, model, maxTokens, timeoutMs }: GenerateTextOptions
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: maxTokens,
        },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new AITimeoutError();
    }
    // fetch() rejects with a TypeError when Ollama is not running
    throw new OllamaUnavailableError(
      `Could not reach Ollama at ${config.ollamaBaseUrl}`
    );
  }

  if (!response.ok) {
    // 404 usually means the model has not been pulled (`ollama pull <model>`)
    throw new AIUnavailableError(
      `Ollama responded with ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const content = data?.message?.content;

  if (typeof content !== "string") {
    throw new Error("Ollama returned an unexpected response");
  }

  return content.trim();
}

/** Sends a conversation to the configured provider and returns the text reply. */
export async function generateText(
  config: AIConfig,
  options: GenerateTextOptions
): Promise<string> {
  return config.provider === "anthropic"
    ? generateWithAnthropic(config, options)
    : generateWithOllama(config, options);
}
