import Anthropic from "@anthropic-ai/sdk";
import type { AIConfig } from "./config";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateTextOptions {
  system: string;
  messages: ChatTurn[];
  model: string;
  maxTokens: number;
}

export class AIRefusalError extends Error {
  constructor(message = "The model declined to answer this request") {
    super(message);
    this.name = "AIRefusalError";
  }
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
  { system, messages, model, maxTokens }: GenerateTextOptions
): Promise<string> {
  const client = getAnthropicClient(config.anthropicApiKey!);
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    ...(config.effort && { output_config: { effort: config.effort } }),
  };

  const response = FALLBACK_MODELS.has(model)
    ? await client.beta.messages.create({
        ...params,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      })
    : await client.messages.create(params);

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
  { system, messages, model, maxTokens }: GenerateTextOptions
): Promise<string> {
  const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: "POST",
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

  if (!response.ok) {
    throw new Error(
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
