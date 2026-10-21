import { type NextRequest, NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import { generateText } from "@/lib/ai/provider";
import { auth } from "@/auth";
import { classifyAIError } from "@/lib/ai/errors";
import { createRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import {
  analyzeCodeContext,
  buildPrompt,
  extractCodeFromResponse,
} from "@/modules/playground/lib/code-context";

// Upper bound for the whole request on serverless platforms (seconds)
export const maxDuration = 30;

// Inline suggestions are only useful if they arrive quickly
const AI_TIMEOUT_MS = 20_000;
const MAX_FILE_LENGTH = 200_000;

// 60 suggestions per user per minute
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

interface CodeSuggestionRequest {
  fileContent: string;
  cursorLine: number;
  cursorColumn: number;
  suggestionType: string;
  fileName?: string;
}

export async function POST(request: NextRequest) {
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

  let body: CodeSuggestionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers });
  }

  const { fileContent, cursorLine, cursorColumn, suggestionType, fileName } =
    body;

  // Validate input
  if (
    typeof fileContent !== "string" ||
    !fileContent ||
    !Number.isInteger(cursorLine) ||
    !Number.isInteger(cursorColumn) ||
    cursorLine < 0 ||
    cursorColumn < 0 ||
    typeof suggestionType !== "string" ||
    !suggestionType
  ) {
    return NextResponse.json(
      { error: "Invalid input parameters" },
      { status: 400, headers }
    );
  }

  if (fileContent.length > MAX_FILE_LENGTH) {
    return NextResponse.json(
      { error: `File is too large for suggestions (max ${MAX_FILE_LENGTH} characters)` },
      { status: 413, headers }
    );
  }

  try {
    const context = analyzeCodeContext(
      fileContent,
      cursorLine,
      cursorColumn,
      fileName
    );

    const prompt = buildPrompt(context, suggestionType);

    const suggestion = await generateSuggestion(prompt);

    return NextResponse.json({
      suggestion,
      context,
      metadata: {
        language: context.language,
        framework: context.framework,
        position: context.cursorPosition,
        generatedAt: new Date().toISOString(),
      },
    }, { headers });
  } catch (error) {
    console.error("Code completion error:", error);
    const { status, code, message } = classifyAIError(error);
    return NextResponse.json({ error: message, code }, { status, headers });
  }
}

const COMPLETION_SYSTEM_PROMPT =
  "You are a code completion engine. Reply only with the code to insert at |CURSOR|, without explanations.";

async function generateSuggestion(prompt: string): Promise<string> {
  const config = getAIConfig();
  const suggestion = await generateText(config, {
    system: COMPLETION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    model: config.completionModel,
    maxTokens: 4096,
    timeoutMs: AI_TIMEOUT_MS,
  });

  return extractCodeFromResponse(suggestion);
}
