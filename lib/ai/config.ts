export const AI_PROVIDERS = ["ollama", "anthropic"] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

export const AI_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type AIEffort = (typeof AI_EFFORTS)[number];

export interface AIConfig {
  provider: AIProvider;
  /** Model used by the chat assistant */
  model: string;
  /** Model used by inline code completion (defaults to `model`) */
  completionModel: string;
  ollamaBaseUrl: string;
  anthropicApiKey?: string;
  /** Anthropic only: reasoning effort. Unset = the model's default */
  effort?: AIEffort;
}

/** Fallback models when AI_MODEL is not set. Override them with env vars. */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  ollama: "codellama:latest",
  anthropic: "claude-opus-5-5",
};

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
  }
}

type Env = Record<string, string | undefined>;

function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

/**
 * Reads the AI configuration from environment variables.
 * Defaults to Ollama so local development works without API keys.
 */
export function getAIConfig(env: Env = process.env): AIConfig {
  const provider = (read(env, "AI_PROVIDER") ?? "ollama").toLowerCase();

  if (!AI_PROVIDERS.includes(provider as AIProvider)) {
    throw new AIConfigError(
      `AI_PROVIDER must be one of: ${AI_PROVIDERS.join(", ")} (got "${provider}")`
    );
  }

  const typedProvider = provider as AIProvider;
  const model = read(env, "AI_MODEL") ?? DEFAULT_MODELS[typedProvider];
  const anthropicApiKey = read(env, "ANTHROPIC_API_KEY");

  if (typedProvider === "anthropic" && !anthropicApiKey) {
    throw new AIConfigError(
      "ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic"
    );
  }

  const effort = read(env, "AI_EFFORT")?.toLowerCase();
  if (effort && !AI_EFFORTS.includes(effort as AIEffort)) {
    throw new AIConfigError(
      `AI_EFFORT must be one of: ${AI_EFFORTS.join(", ")} (got "${effort}")`
    );
  }

  return {
    provider: typedProvider,
    model,
    completionModel: read(env, "AI_COMPLETION_MODEL") ?? model,
    ollamaBaseUrl: (
      read(env, "OLLAMA_BASE_URL") ?? DEFAULT_OLLAMA_BASE_URL
    ).replace(/\/+$/, ""),
    anthropicApiKey,
    effort: effort as AIEffort | undefined,
  };
}
