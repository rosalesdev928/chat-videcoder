import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAIConfig } from "@/lib/ai/config";
import { classifyAIError } from "@/lib/ai/errors";
import { sanitizeHistory } from "@/lib/ai/messages";
import { generateText } from "@/lib/ai/provider";
import { createRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

// Upper bound for the whole request on serverless platforms (seconds)
export const maxDuration = 120;

const AI_TIMEOUT_MS = 55_000;
const MAX_MESSAGE_LENGTH = 20_000;

// 20 messages per user per minute
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

interface ChatRequest {
  message: string;
  history: unknown;
}

const SYSTEM_PROMPT = `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = limiter.check(session.user.id);
  const headers = rateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers }
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers });
  }

  const { message, history = [] } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required and must be a string" },
      { status: 400, headers }
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` },
      { status: 413, headers }
    );
  }

  try {
    const config = getAIConfig();

    const aiResponse = await generateText(config, {
      system: SYSTEM_PROMPT,
      messages: [...sanitizeHistory(history), { role: "user", content: message }],
      model: config.model,
      maxTokens: 16000,
      timeoutMs: AI_TIMEOUT_MS,
      maxRetries: 1,
    });

    return NextResponse.json(
      {
        response: aiResponse,
        model: config.model,
        timestamp: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error("Chat API Error:", error);
    const { status, code, message: errorMessage } = classifyAIError(error);

    return NextResponse.json(
      { error: errorMessage, code, timestamp: new Date().toISOString() },
      { status, headers }
    );
  }
}
