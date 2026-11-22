import { Router } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { getUser, requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

const VERIFIED_OFFICIAL_LINKS = [
  {
    keywords: ["jee", "iit", "engineering entrance", "advance"],
    title: "NTA JEE Main Official Portal",
    url: "https://jeemain.nta.nic.in",
    category: "Competitive Exam",
    badge: "Official NTA",
  },
  {
    keywords: ["neet", "medical entrance", "mbbs", "bds", "aiims"],
    title: "NTA NEET (UG) Official Portal",
    url: "https://neet.nta.nic.in",
    category: "Medical Entrance",
    badge: "Official NTA",
  },
  {
    keywords: ["nta", "national testing agency"],
    title: "National Testing Agency (NTA)",
    url: "https://nta.ac.in",
    category: "Testing Agency",
    badge: "Official Portal",
  },
  {
    keywords: ["upsc", "civil services", "ias", "ips", "nda", "cds"],
    title: "Union Public Service Commission (UPSC)",
    url: "https://upsc.gov.in",
    category: "Government Services",
    badge: "Official UPSC",
  },
  {
    keywords: ["cbse", "board exam", "class 10", "class 12", "sample paper", "syllabus"],
    title: "Central Board of Secondary Education (CBSE)",
    url: "https://cbse.gov.in",
    category: "Academic Board",
    badge: "Official CBSE",
  },
  {
    keywords: ["navodaya", "nvs", "samiti", "jnvst", "admission", "regional office"],
    title: "Navodaya Vidyalaya Samiti (NVS)",
    url: "https://navodaya.gov.in",
    category: "Navodaya Authority",
    badge: "Official NVS",
  },
  {
    keywords: ["scholarship", "nsp", "financial aid", "stipend"],
    title: "National Scholarship Portal (Govt of India)",
    url: "https://scholarships.gov.in",
    category: "Scholarships",
    badge: "Govt of India",
  },
  {
    keywords: ["cuet", "university entrance", "delhi university", "bhu"],
    title: "CUET (UG) Official Admissions Portal",
    url: "https://cuetug.ntaonline.in",
    category: "College Admissions",
    badge: "Official NTA",
  },
];

function buildSystemPrompt(userRole?: string, jnvName?: string, userFullName?: string): string {
  const roleContext = userRole
    ? `The user is authenticated as a "${userRole}"${jnvName ? ` from "${jnvName}"` : ""}${userFullName ? `, named "${userFullName}"` : ""}.`
    : "The user is a valued member of the Navodaya community.";

  return `You are PARAM AI 3.0, the highly capable, empathetic, and knowledgeable multimodal AI companion specifically crafted for Navodaya Connect and the Jawahar Navodaya Vidyalaya (JNV) community across India.

CORE IDENTITY & SPIRIT:
- Ethos: "Once a Navodayan, Always a Navodayan."
- You are an AI assistant created specifically for the Navodaya community. Always be transparent about this. NEVER claim to be a real human and NEVER invent fictional personal childhood memories or personal hostel life stories. Instead, demonstrate deep, respectful knowledge and understanding of JNV culture and traditions.
- Understand the unique aspects of Navodaya life: the four houses (Aravali, Nilgiri, Shiwalik, Udaygiri), morning assemblies, morning PT, mess/dining hall brotherhood, Class 9 Migration Exchange scheme between Hindi and non-Hindi regions, Inter-House sports and cultural meets, CCA competitions, teachers/wardens who act as local guardians, and the lifelong alumni bond.
- Tone: Warm, encouraging, intellectually rigorous, community-oriented, and accessible. Avoid robotic greetings or repetitive boilerplate intros in every message.

USER CONTEXT:
${roleContext}
- If the user is a STUDENT: Focus on structured learning, conceptual clarity, exam preparation (JEE, NEET, Olympiads, NDA, CUET, CBSE boards), mental wellness in hostel life, and practical study schedules.
- If the user is an ALUMNI: Focus on professional development, career transitions, mentorship of younger Navodayans, alumni chapter initiatives, networking, and industry insights.
- If the user is a TEACHER: Support with pedagogical concepts, curriculum materials, classroom engagement ideas, and academic planning.
- If the user is an OFFICIAL: Provide clear institutional guidance, policy clarity, and community management assistance.

LANGUAGE & SCRIPT:
- You are fluently bilingual in English and Hindi.
- If the user speaks or writes in Hindi, reply in natural, fluent Hindi using proper Devanagari script (not Romanized Hinglish).
- If the user speaks or writes in English, reply in clear, professional English.
- You can naturally address Indian education concepts, exam terminology, and Navodaya terms.

MULTIMODAL & EDUCATIONAL GUIDANCE:
- For complex scientific, mathematical, or academic queries, structure your explanation with clear bullet points, conceptual steps, and equations or diagrams where helpful.
- For competitive exams or government portals, recommend verified official sources (NTA, UPSC, CBSE, NVS).
- Keep responses engaging, accurate, and concise without unnecessary waffle.`;
}

type HistoryMessage = {
  role: "user" | "assistant";
  text: string;
};

function getFallbackReply(lang = "en") {
  return lang === "hi"
    ? "मुझे सेवा से जुड़ने में थोड़ी समस्या हो रही है। कृपया कुछ पलों बाद पुनः प्रयास करें।"
    : "I am having trouble reaching my service right now. Please try again in a moment.";
}

function resolveGeminiApiKey(): string | undefined {
  const candidatePaths = [
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../../../.env"),
  ];

  for (const envPath of candidatePaths) {
    if (existsSync(envPath)) {
      try {
        const { readFileSync } = require("node:fs");
        const raw = readFileSync(envPath, "utf8");
        const match = raw.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)/);
        if (match && match[1]) {
          const key = match[1].trim().replace(/^["']|["']$/g, "");
          process.env.GEMINI_API_KEY = key;
          return key;
        }
      } catch {
        // ignore
      }
    }
  }

  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.replace(/^["']|["']$/g, "").trim();
  }

  return undefined;
}

function extractVerifiedLinks(text: string): typeof VERIFIED_OFFICIAL_LINKS {
  const lower = text.toLowerCase();
  const matched: typeof VERIFIED_OFFICIAL_LINKS = [];
  const seenUrls = new Set<string>();

  for (const item of VERIFIED_OFFICIAL_LINKS) {
    if (seenUrls.has(item.url)) continue;
    const hasKeyword = item.keywords.some((kw) => lower.includes(kw));
    if (hasKeyword) {
      matched.push(item);
      seenUrls.add(item.url);
    }
  }

  return matched.slice(0, 3);
}

// ── 1. MAIN CONVERSATION ENDPOINT ───────────────────────────────────────────
router.post("/param-ai/chat", requireAuth, async (req, res) => {
  const user = getUser(req);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const audioBase64 = typeof req.body?.audioBase64 === "string" ? req.body.audioBase64.trim() : "";
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType.trim() : "audio/webm";
  const language = req.body?.language === "hi" ? "hi" : "en";
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

  if (!message && !audioBase64) {
    return res.status(400).json({ error: "Message or audio input is required" });
  }

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    logger.error("Param AI is unavailable because GEMINI_API_KEY is not configured");
    return res.status(503).json({ reply: getFallbackReply(language) });
  }

  try {
    const gemini = new GoogleGenerativeAI(apiKey);
    const candidateModels = [
      process.env.GEMINI_MODEL,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ].filter(Boolean) as string[];

    const systemInstruction = buildSystemPrompt(user?.role, user?.jnvName, user?.fullName);

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
    let userTranscript = message;
    let lastError: unknown = null;

    for (const modelName of candidateModels) {
      try {
        const model = gemini.getGenerativeModel({
          model: modelName,
          systemInstruction,
        });

        // If audio message was provided
        if (audioBase64) {
          const promptParts: any[] = [
            {
              inlineData: {
                data: audioBase64,
                mimeType: mimeType || "audio/webm",
              },
            },
            {
              text: message
                ? `The user spoke this audio and added note: "${message}". Please respond helpfully in accordance with your Navodaya personality.`
                : "Listen to the user's spoken voice and reply helpfully as PARAM AI. If they spoke in Hindi, answer in Hindi.",
            },
          ];

          const result = await model.generateContent(promptParts);
          reply = result.response.text().trim();
          if (!userTranscript) {
            userTranscript = "🎙️ Voice message";
          }
        } else {
          // Normal text chat
          const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
              maxOutputTokens: 8192,
            },
          });
          const result = await chat.sendMessage(message);
          reply = result.response.text().trim();
        }

        if (reply) break;
      } catch (err) {
        lastError = err;
        logger.warn({ modelName, err }, "Gemini model attempt failed, trying fallback");
      }
    }

    if (!reply) {
      logger.error({ err: lastError }, "All Gemini model candidates failed");
      return res.status(502).json({ reply: getFallbackReply(language) });
    }

    // Extract relevant verified official resources
    const verifiedLinks = extractVerifiedLinks(`${message} ${reply}`);

    // Detect if response includes Hindi Devanagari
    const isHindiResponse = /[\u0900-\u097F]/.test(reply);

    return res.json({
      reply,
      userTranscript: userTranscript || message,
      verifiedLinks,
      detectedLanguage: isHindiResponse ? "hi" : "en",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Param AI request failed");
    return res.status(502).json({ reply: getFallbackReply(language) });
  }
});

export default router;
