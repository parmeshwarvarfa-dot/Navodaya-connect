import { Router } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

const SYSTEM_PROMPT =
  "You are Param AI, a friendly, knowledgeable assistant inside Navodaya Connect, an app for JNV (Jawahar Navodaya Vidyalaya) alumni, students, teachers and officials. You can help with any question the user asks - academics, exam prep (JEE/NEET/UPSC), career guidance, general knowledge, coding help, casual conversation, etc. Give clear, well-formatted, genuinely helpful answers. You are not limited to a fixed topic list.";

type HistoryMessage = {
  role: "user" | "assistant";
  text: string;
};

function getFallbackReply() {
  return "I'm having trouble reaching my AI service right now. Please try again in a moment.";
}

function resolveGeminiApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.replace(/^["']|["']$/g, "").trim();
  }

  // Attempt to reload workspace root .env in case it was updated at runtime
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(__dirname, "../../../../.env"),
  ];

  for (const envPath of candidatePaths) {
    if (existsSync(envPath)) {
      if (typeof process.loadEnvFile === "function") {
        try {
          process.loadEnvFile(envPath);
          if (process.env.GEMINI_API_KEY) {
            return process.env.GEMINI_API_KEY.replace(/^["']|["']$/g, "").trim();
          }
        } catch {
          // ignore
        }
      }
      try {
        const { readFileSync } = require("node:fs");
        const raw = readFileSync(envPath, "utf8");
        const match = raw.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)/);
        if (match && match[1]) {
          process.env.GEMINI_API_KEY = match[1].trim();
          return match[1].trim();
        }
      } catch {
        // ignore
      }
    }
  }

  return process.env.GEMINI_API_KEY;
}

router.post("/param-ai/chat", requireAuth, async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
  const history: HistoryMessage[] = rawHistory
    .filter(
      (item: unknown): item is HistoryMessage =>
        !!item &&
        typeof item === "object" &&
        ((item as HistoryMessage).role === "user" || (item as HistoryMessage).role === "assistant") &&
        typeof (item as HistoryMessage).text === "string",
    )
    .map((item: { role: string; text: string }) => ({ role: item.role, text: item.text.trim() }))
    .filter((item: { role: string; text: string }) => item.text.length > 0)
    .slice(-10);

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const apiKey = resolveGeminiApiKey();

  if (!apiKey) {
    logger.error("Param AI is unavailable because GEMINI_API_KEY is not configured");
    return res.status(503).json({ reply: getFallbackReply() });
  }

  try {
    const gemini = new GoogleGenerativeAI(apiKey);
    const candidateModels = [
      process.env.GEMINI_MODEL,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ].filter(Boolean) as string[];

    const chatHistory: Content[] = history
      .map((item: { role: string; text: string }) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.text }],
      }))
      .slice(-10);

    while (chatHistory[0]?.role === "model") {
      chatHistory.shift();
    }

    let reply = "";
    let lastError: unknown = null;

    for (const modelName of candidateModels) {
      try {
        const model = gemini.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
        });

        const chat = model.startChat({
          history: chatHistory,
          generationConfig: {
            maxOutputTokens: 8192,
          },
        });
        const result = await chat.sendMessage(message);
        reply = result.response.text().trim();
        if (reply) break;
      } catch (err) {
        lastError = err;
        logger.warn({ modelName, err }, "Gemini model attempt failed, trying fallback");
      }
    }

    if (!reply) {
      logger.error({ err: lastError }, "All Gemini model candidates failed");
      return res.status(502).json({ reply: getFallbackReply() });
    }

    return res.json({ reply });
  } catch (error) {
    logger.error({ err: error }, "Param AI request failed");
    return res.status(502).json({ reply: getFallbackReply() });
  }
});

export default router;
