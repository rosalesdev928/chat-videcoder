import Anthropic from "@anthropic-ai/sdk";
import { AIConfigError } from "./config";

export class AIRefusalError extends Error {
  constructor(message = "The model declined to answer this request") {
    super(message);
    this.name = "AIRefusalError";
  }
}

export class AITimeoutError extends Error {
  constructor(message = "The AI provider took too long to respond") {
    super(message);
    this.name = "AITimeoutError";
  }
}

export class AIUnavailableError extends Error {
  constructor(message = "The AI provider is not reachable") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export interface AIErrorInfo {
  status: number;
  code: string;
  message: string;
}

/**
 * Maps any error thrown while generating text to an HTTP status and a message
 * that is safe to show to the user (no stack traces or provider internals).
 */
export function classifyAIError(error: unknown): AIErrorInfo {
  if (error instanceof AIConfigError) {
    return { status: 503, code: "ai_not_configured", message: "The AI service is not configured" };
  }
  if (error instanceof AIRefusalError) {
    return { status: 422, code: "ai_refusal", message: "The AI declined to answer this request" };
  }
  if (error instanceof AITimeoutError || error instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 504, code: "ai_timeout", message: "The AI took too long to respond. Try again." };
  }
  if (error instanceof AIUnavailableError || error instanceof Anthropic.APIConnectionError) {
    return { status: 503, code: "ai_unavailable", message: "The AI service is not reachable right now" };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, code: "ai_rate_limited", message: "The AI provider is busy. Try again in a moment." };
  }
  if (error instanceof Anthropic.APIError) {
    // Auth, bad request, overloaded, etc.: a server-side problem for the user
    return { status: 502, code: "ai_provider_error", message: "The AI provider returned an error" };
  }
  return { status: 500, code: "internal_error", message: "Failed to generate AI response" };
}
