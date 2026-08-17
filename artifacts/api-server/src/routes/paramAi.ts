import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

const SYSTEM_PROMPT =
  "You are Param AI, a friendly, knowledgeable assistant inside Navodaya Connect, an app for JNV (Jawahar Navodaya Vidyalaya) alumni, students, teachers and officials. You can help with any question the user asks — academics, exam prep (JEE/NEET/UPSC), career guidance, general knowledge, coding help, casual conversation, etc. Give clear, well-formatted, genuinely helpful answers. You are not limited to a fixed topic list.";

type HistoryMessage = {
  role: "user" | "assistant";
  text: string;
};

function getFallbackReply() {
  return "I’m having trouble reaching my AI service right now. Please try again in a moment.";
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
    .map((item) => ({ role: item.role, text: item.text.trim() }))
    .filter((item) => item.text.length > 0)
    .slice(-10);

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    logger.error("Param AI is unavailable because ANTHROPIC_API_KEY is not configured");
    return res.status(503).json({ reply: getFallbackReply() });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        ...history.map((item) => ({ role: item.role, content: item.text })),
        { role: "user" as const, content: message },
      ],
    });

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!reply) {
      return res.status(502).json({ reply: getFallbackReply() });
    }

    return res.json({ reply });
  } catch (error) {
    logger.error({ err: error }, "Param AI request failed");
    return res.status(502).json({ reply: getFallbackReply() });
  }
});

export default router;