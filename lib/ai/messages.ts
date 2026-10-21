import type { ChatTurn } from "./provider";

/**
 * Keeps only well-formed chat turns, limited to the most recent `limit`.
 * The result never starts with an assistant turn, because providers such as
 * Anthropic require the conversation to start with a user message.
 */
export function sanitizeHistory(history: unknown, limit = 10): ChatTurn[] {
  if (!Array.isArray(history)) return [];

  const valid = history.filter(
    (msg): msg is ChatTurn =>
      !!msg &&
      typeof msg === "object" &&
      (msg.role === "user" || msg.role === "assistant") &&
      typeof msg.content === "string" &&
      msg.content.trim().length > 0
  );

  const recent = valid
    .slice(-limit)
    .map(({ role, content }) => ({ role, content }));

  const firstUser = recent.findIndex((msg) => msg.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}
