import { NextRequest, NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import { sanitizeHistory } from "@/lib/ai/messages";
import { generateText } from "@/lib/ai/provider";

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
  try {
    const body: ChatRequest = await req.json();
    const { message, history = [] } = body;

    // Validate input
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    const config = getAIConfig();

    const aiResponse = await generateText(config, {
      system: SYSTEM_PROMPT,
      messages: [...sanitizeHistory(history), { role: "user", content: message }],
      model: config.model,
      maxTokens: 16000,
    });

    return NextResponse.json({
      response: aiResponse,
      model: config.model,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat API Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
