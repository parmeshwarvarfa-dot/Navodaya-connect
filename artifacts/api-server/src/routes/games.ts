import { Router } from "express";
import { Chess } from "chess.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, gameSessionsTable, usersTable } from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";

const router = Router();
const MAX_REWARDS: Record<string, number> = {
  "gk-blitz": 50,
  "word-master": 60,
  "math-ninja": 70,
  "art-battle": 80,
  "chess-cup": 0,
};
const DURATIONS: Record<string, number> = {
  "gk-blitz": 120,
  "word-master": 90,
  "math-ninja": 90,
  "art-battle": 60,
};

type ChoiceQuestion = { type: "choice"; prompt: string; category: string; options: string[]; answer: number };
type SpellingQuestion = { type: "spelling"; prompt: string; definition: string; difficulty: string; answer: string };
type NumberQuestion = { type: "number"; prompt: string; difficulty: string; answer: number };
type GameQuestion = ChoiceQuestion | SpellingQuestion | NumberQuestion;
type GameState = {
  questions: GameQuestion[];
  index: number;
  correct: number;
  duration: number;
  startedAt: number;
  lastAnswerAt?: number;
  answerTimes?: number[];
  difficulty?: string;
  prompt?: string;
  artwork?: unknown;
  pgn?: string;
};

export const GK_BANK: Array<Omit<ChoiceQuestion, "type">> = [
  { prompt: "Which planet is the largest in our solar system?", category: "Science", options: ["Earth", "Jupiter", "Saturn", "Neptune"], answer: 1 },
  { prompt: "What is the chemical symbol for gold?", category: "Science", options: ["Ag", "Gd", "Au", "Go"], answer: 2 },
  { prompt: "Which gas do plants absorb during photosynthesis?", category: "Science", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
  { prompt: "How many sides does a hexagon have?", category: "General knowledge", options: ["Five", "Six", "Seven", "Eight"], answer: 1 },
  { prompt: "What is the hardest naturally occurring mineral?", category: "Science", options: ["Quartz", "Diamond", "Topaz", "Ruby"], answer: 1 },
  { prompt: "Which organ pumps blood around the human body?", category: "Science", options: ["Lungs", "Liver", "Heart", "Kidneys"], answer: 2 },
  { prompt: "Which is the smallest prime number?", category: "General knowledge", options: ["0", "1", "2", "3"], answer: 2 },
  { prompt: "What is the SI unit of electric current?", category: "Science", options: ["Volt", "Ampere", "Watt", "Ohm"], answer: 1 },
  { prompt: "Who was the first President of India?", category: "Indian history", options: ["S. Radhakrishnan", "Rajendra Prasad", "Zakir Husain", "V. V. Giri"], answer: 1 },
  { prompt: "In which year did India become a republic?", category: "Indian history", options: ["1947", "1949", "1950", "1952"], answer: 2 },
  { prompt: "Who led the Dandi March in 1930?", category: "Indian history", options: ["Subhas Chandra Bose", "Mahatma Gandhi", "Jawaharlal Nehru", "Sardar Patel"], answer: 1 },
  { prompt: "The Taj Mahal stands beside which river?", category: "Indian history", options: ["Ganga", "Yamuna", "Narmada", "Godavari"], answer: 1 },
  { prompt: "Which is the largest Indian state by area?", category: "Geography", options: ["Madhya Pradesh", "Maharashtra", "Rajasthan", "Uttar Pradesh"], answer: 2 },
  { prompt: "What is the capital of Assam?", category: "Geography", options: ["Guwahati", "Shillong", "Dispur", "Imphal"], answer: 2 },
  { prompt: "Which ocean lies south of India?", category: "Geography", options: ["Atlantic Ocean", "Pacific Ocean", "Arctic Ocean", "Indian Ocean"], answer: 3 },
  { prompt: "Which is the highest mountain in the world above sea level?", category: "Geography", options: ["K2", "Kangchenjunga", "Mount Everest", "Lhotse"], answer: 2 },
  { prompt: "How many players from one team are on a cricket field at a time?", category: "Sports", options: ["9", "10", "11", "12"], answer: 2 },
  { prompt: "How many rings appear on the Olympic symbol?", category: "Sports", options: ["Four", "Five", "Six", "Seven"], answer: 1 },
  { prompt: "The Thomas Cup is associated with which sport?", category: "Sports", options: ["Tennis", "Badminton", "Hockey", "Football"], answer: 1 },
  { prompt: "Which Indian athlete won Olympic gold in javelin at Tokyo 2020?", category: "Sports", options: ["Neeraj Chopra", "Bajrang Punia", "P. V. Sindhu", "Mirabai Chanu"], answer: 0 },
  { prompt: "Which organisation conducts India's space programme?", category: "Science", options: ["DRDO", "ISRO", "BARC", "CSIR"], answer: 1 },
  { prompt: "Which Indian launch vehicle is nicknamed 'Bahubali'?", category: "Science", options: ["PSLV", "SSLV", "LVM3", "GSLV-F01"], answer: 2 },
  { prompt: "Which city hosted the 2023 G20 Leaders' Summit in India?", category: "India & current affairs", options: ["Mumbai", "New Delhi", "Bengaluru", "Hyderabad"], answer: 1 },
  { prompt: "What is the currency of Japan?", category: "General knowledge", options: ["Won", "Yuan", "Yen", "Ringgit"], answer: 2 },
  { prompt: "Which is the official national animal of India?", category: "General knowledge", options: ["Asiatic lion", "Bengal tiger", "Elephant", "Leopard"], answer: 1 },
  { prompt: "How many colours are there in a rainbow?", category: "Science", options: ["Five", "Six", "Seven", "Eight"], answer: 2 },
  { prompt: "Which instrument measures atmospheric pressure?", category: "Science", options: ["Thermometer", "Barometer", "Hygrometer", "Anemometer"], answer: 1 },
  { prompt: "Which river is often called the 'Dakshin Ganga'?", category: "Geography", options: ["Godavari", "Krishna", "Kaveri", "Mahanadi"], answer: 0 },
  { prompt: "Who wrote India's national anthem?", category: "Indian history", options: ["Bankim Chandra Chattopadhyay", "Rabindranath Tagore", "Sarojini Naidu", "Muhammad Iqbal"], answer: 1 },
  { prompt: "Which sport uses the terms 'love' and 'deuce'?", category: "Sports", options: ["Badminton", "Tennis", "Squash", "Table tennis"], answer: 1 },
];

export const WORD_BANK: Record<string, Array<{ word: string; definition: string }>> = {
  easy: [
    { word: "journey", definition: "An act of travelling from one place to another." },
    { word: "library", definition: "A place where books are kept for reading or borrowing." },
    { word: "courage", definition: "The ability to face danger or difficulty without fear." },
    { word: "discover", definition: "To find something for the first time." },
    { word: "calendar", definition: "A chart showing the days, weeks, and months of a year." },
    { word: "knowledge", definition: "Information and understanding gained through learning." },
    { word: "patient", definition: "Able to wait calmly without becoming upset." },
    { word: "village", definition: "A small community in the countryside." },
    { word: "exercise", definition: "Physical activity done to keep the body fit." },
    { word: "remember", definition: "To keep something in your mind or bring it back to mind." },
    { word: "bright", definition: "Giving out or reflecting a lot of light." },
    { word: "friendship", definition: "A close and trusting relationship between friends." },
  ],
  medium: [
    { word: "environment", definition: "The natural world and the conditions around living things." },
    { word: "necessary", definition: "Needed or required for a particular purpose." },
    { word: "opportunity", definition: "A suitable time or chance to do something." },
    { word: "temperature", definition: "A measure of how hot or cold something is." },
    { word: "discipline", definition: "Training that helps people follow rules and control themselves." },
    { word: "independent", definition: "Not relying on another person or thing for support." },
    { word: "communication", definition: "The sharing of information, ideas, or feelings." },
    { word: "achievement", definition: "Something successfully completed through effort." },
    { word: "community", definition: "A group of people living in the same place or sharing an interest." },
    { word: "responsible", definition: "Having a duty to deal with something carefully." },
    { word: "knowledgeable", definition: "Having a good understanding of a subject." },
    { word: "successful", definition: "Having achieved a desired aim or result." },
  ],
  hard: [
    { word: "accommodation", definition: "A place to stay, or an arrangement made to suit a need." },
    { word: "conscience", definition: "A person's inner sense of right and wrong." },
    { word: "entrepreneur", definition: "A person who starts and runs a business, taking on financial risk." },
    { word: "perseverance", definition: "Steady effort to keep doing something despite difficulty." },
    { word: "pronunciation", definition: "The way in which a word is spoken." },
    { word: "questionnaire", definition: "A written set of questions used to collect information." },
    { word: "recommendation", definition: "A suggestion that something is suitable or good." },
    { word: "rhythm", definition: "A regular pattern of sounds, movement, or beats." },
    { word: "maintenance", definition: "The work needed to keep something in good condition." },
    { word: "privilege", definition: "A special right or advantage available to a person or group." },
    { word: "miscellaneous", definition: "Made up of various different kinds of things." },
    { word: "exaggerate", definition: "To describe something as larger or greater than it really is." },
  ],
};

const ART_PROMPTS = [
  "A morning assembly at your JNV",
  "Your favourite classroom memory",
  "A match on the school sports ground",
  "The journey to school through nature",
  "Friends studying together in the hostel",
  "A celebration at your school",
];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function makeMathQuestions(difficulty: string): NumberQuestion[] {
  return Array.from({ length: 12 }, () => {
    const level = difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1;
    const kind = randomInt(0, level === 1 ? 3 : 5);
    if (kind === 0) {
      const a = randomInt(12 * level, 80 * level);
      const b = randomInt(10 * level, 60 * level);
      return { type: "number", prompt: `${a} + ${b} = ?`, difficulty, answer: a + b };
    }
    if (kind === 1) {
      const a = randomInt(25 * level, 100 * level);
      const b = randomInt(5 * level, 24 * level);
      return { type: "number", prompt: `${a} − ${b} = ?`, difficulty, answer: a - b };
    }
    if (kind === 2) {
      const a = randomInt(2 * level, 12 * level);
      const b = randomInt(2, 12);
      return { type: "number", prompt: `${a} × ${b} = ?`, difficulty, answer: a * b };
    }
    if (kind === 3) {
      const divisor = randomInt(2, 12);
      const quotient = randomInt(2 * level, 12 * level);
      return { type: "number", prompt: `${divisor * quotient} ÷ ${divisor} = ?`, difficulty, answer: quotient };
    }
    if (kind === 4) {
      const percent = [10, 20, 25, 50][randomInt(0, 3)];
      const whole = randomInt(2, 20) * 20;
      return { type: "number", prompt: `${percent}% of ${whole} = ?`, difficulty, answer: (percent * whole) / 100 };
    }
    const denom = [2, 3, 4, 5, 8, 10][randomInt(0, 5)];
    const numerator = randomInt(1, denom - 1);
    const whole = denom * randomInt(2, 15);
    return { type: "number", prompt: `${numerator}/${denom} of ${whole} = ?`, difficulty, answer: (numerator * whole) / denom };
  });
}

function publicQuestion(question: GameQuestion, index: number, total: number) {
  if (question.type === "choice") {
    return { type: question.type, prompt: question.prompt, category: question.category, options: question.options, round: index + 1, total };
  }
  if (question.type === "spelling") {
    return { type: question.type, prompt: question.prompt, definition: question.definition, difficulty: question.difficulty, round: index + 1, total };
  }
  return { type: question.type, prompt: question.prompt, difficulty: question.difficulty, round: index + 1, total };
}

export function normalizedAnswer(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase().replace(/\s+/g, " ") : "";
}

export function getReward(gameId: string, correct: number, total: number) {
  const max = MAX_REWARDS[gameId] ?? 0;
  return total > 0 && correct > 0 ? Math.min(max, Math.floor((max * correct) / total)) : 0;
}

function createResult(gameId: string, state: GameState, rewardPoints: number, score = state.correct) {
  const answered = Math.min(state.index, state.questions.length);
  const times = state.answerTimes ?? [];
  return {
    gameId,
    score,
    correct: state.correct,
    answered,
    total: state.questions.length,
    accuracy: answered ? Math.round((state.correct / answered) * 100) : 0,
    averageResponseMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0,
    rewardPoints,
    maxRewardPoints: MAX_REWARDS[gameId] ?? 0,
  };
}

async function completeSession(tx: any, session: any, state: GameState, result: Record<string, unknown>) {
  const rewardPoints = typeof result.rewardPoints === "number" ? result.rewardPoints : 0;
  const [updated] = await tx.update(gameSessionsTable).set({
    status: "completed",
    state: state as unknown as Record<string, unknown>,
    score: typeof result.score === "number" ? result.score : 0,
    correctCount: typeof result.correct === "number" ? result.correct : 0,
    questionCount: typeof result.total === "number" ? result.total : 0,
    rewardPoints,
    result,
    completedAt: new Date(),
  }).where(eq(gameSessionsTable.id, session.id)).returning();
  return updated;
}

function publicResult(session: any) {
  return (session.result ?? {
    gameId: session.gameId,
    score: session.score,
    correct: session.correctCount,
    total: session.questionCount,
    rewardPoints: session.rewardPoints,
    maxRewardPoints: MAX_REWARDS[session.gameId] ?? 0,
  }) as Record<string, unknown>;
}

router.get("/games/summary", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [mine] = await db.select({ points: sql<number>`coalesce(sum(${gameSessionsTable.rewardPoints}), 0)::int` })
      .from(gameSessionsTable)
      .where(and(eq(gameSessionsTable.userId, user.id), eq(gameSessionsTable.status, "completed")));
    const houses = await db.select({
      house: usersTable.house,
      points: sql<number>`coalesce(sum(${gameSessionsTable.rewardPoints}), 0)::int`,
    }).from(usersTable)
      .leftJoin(gameSessionsTable, and(
        eq(gameSessionsTable.userId, usersTable.id),
        eq(gameSessionsTable.status, "completed"),
      ))
      .groupBy(usersTable.house)
      .orderBy(desc(sql`coalesce(sum(${gameSessionsTable.rewardPoints}), 0)`));
    const recent = await db.select({
      id: gameSessionsTable.id,
      gameId: gameSessionsTable.gameId,
      score: gameSessionsTable.score,
      correctCount: gameSessionsTable.correctCount,
      questionCount: gameSessionsTable.questionCount,
      rewardPoints: gameSessionsTable.rewardPoints,
      completedAt: gameSessionsTable.completedAt,
    }).from(gameSessionsTable)
      .where(and(eq(gameSessionsTable.userId, user.id), eq(gameSessionsTable.status, "completed")))
      .orderBy(desc(gameSessionsTable.completedAt))
      .limit(10);
    return res.json({ points: Number(mine?.points ?? 0), houses, recent });
  } catch (error) {
    req.log.error(error, "Failed to load game points");
    return res.status(500).json({ error: "Failed to load game points" });
  }
});

router.post("/games/sessions", requireAuth, async (req, res) => {
  const gameId = typeof req.body?.gameId === "string" ? req.body.gameId : "";
  if (!Object.hasOwn(MAX_REWARDS, gameId)) return res.status(400).json({ error: "Unknown game" });
  const user = getUser(req);
  const difficulty = ["easy", "medium", "hard"].includes(req.body?.difficulty) ? req.body.difficulty : "medium";
  const now = Date.now();
  let questions: GameQuestion[] = [];
  let duration = DURATIONS[gameId] ?? 0;
  let prompt: string | undefined;

  if (gameId === "gk-blitz") questions = shuffle(GK_BANK).slice(0, 20).map((question) => ({ ...question, type: "choice" }));
  else if (gameId === "word-master") {
    questions = shuffle(WORD_BANK[difficulty]).slice(0, 10).map(({ word, definition }) => ({
      type: "spelling", prompt: "Spell the word that matches this definition:", definition, difficulty, answer: word,
    }));
  } else if (gameId === "math-ninja") questions = makeMathQuestions(difficulty);
  else if (gameId === "art-battle") prompt = ART_PROMPTS[randomInt(0, ART_PROMPTS.length - 1)];

  const state: GameState = { questions, index: 0, correct: 0, duration, startedAt: now, difficulty, prompt };
  try {
    const [session] = await db.insert(gameSessionsTable).values({
      userId: user.id,
      gameId,
      state: state as unknown as Record<string, unknown>,
      questionCount: questions.length,
    }).returning({ id: gameSessionsTable.id });
    return res.status(201).json({
      sessionId: session.id,
      gameId,
      difficulty,
      seconds: duration,
      total: questions.length,
      prompt,
      question: questions.length ? publicQuestion(questions[0], 0, questions.length) : null,
    });
  } catch (error) {
    req.log.error(error, "Failed to start game session");
    return res.status(500).json({ error: "Could not start the game. Try again." });
  }
});

router.post("/games/sessions/:id/answer", requireAuth, async (req, res) => {
  const user = getUser(req);
  try {
    const response = await db.transaction(async (tx) => {
      const [session] = await tx.select().from(gameSessionsTable)
        .where(and(eq(gameSessionsTable.id, req.params.id as string), eq(gameSessionsTable.userId, user.id)))
        .for("update");
      if (!session) return { status: 404, body: { error: "Game session not found" } };
      if (session.status === "completed") return { status: 200, body: { completed: true, result: publicResult(session) } };
      const state = session.state as unknown as GameState;
      if (!state.questions.length || state.index >= state.questions.length) return { status: 409, body: { error: "This game has no unanswered question" } };
      if (!Number.isInteger(req.body?.round) || req.body.round !== state.index + 1) return { status: 409, body: { error: "This question was already answered or is out of order" } };
      if (Date.now() - state.startedAt >= state.duration * 1000) {
        const result = createResult(session.gameId, state, getReward(session.gameId, state.correct, state.questions.length));
        await completeSession(tx, session, state, result);
        return { status: 200, body: { completed: true, expired: true, result } };
      }
      const current = state.questions[state.index];
      const value = req.body?.answer;
      const answeredAt = Date.now();
      const responseTime = answeredAt - (state.lastAnswerAt ?? state.startedAt);
      if (responseTime < 250) return { status: 429, body: { error: "Please wait for the current question before answering" } };
      const correct = current.type === "choice"
        ? Number.isInteger(value) && value === current.answer
        : current.type === "number"
          ? ((typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) && Number(value) === current.answer)
          : normalizedAnswer(value) === current.answer;
      const nextState: GameState = {
        ...state,
        index: state.index + 1,
        correct: state.correct + (correct ? 1 : 0),
        lastAnswerAt: answeredAt,
        answerTimes: [...(state.answerTimes ?? []), responseTime],
      };
      if (nextState.index >= nextState.questions.length) {
        const rewardPoints = getReward(session.gameId, nextState.correct, nextState.questions.length);
        const result = createResult(session.gameId, nextState, rewardPoints);
        await completeSession(tx, session, nextState, result);
        return { status: 200, body: { correct, correctAnswer: current.type === "choice" ? current.options[current.answer] : current.answer, completed: true, result } };
      }
      await tx.update(gameSessionsTable).set({
        state: nextState as unknown as Record<string, unknown>,
        score: nextState.correct,
        correctCount: nextState.correct,
      }).where(eq(gameSessionsTable.id, session.id));
      return {
        status: 200,
        body: {
          correct,
          correctAnswer: current.type === "choice" ? current.options[current.answer] : current.answer,
          completed: false,
          question: publicQuestion(nextState.questions[nextState.index], nextState.index, nextState.questions.length),
          score: nextState.correct,
          answered: nextState.index,
          total: nextState.questions.length,
        },
      };
    });
    return res.status(response.status).json(response.body);
  } catch (error) {
    req.log.error(error, "Failed to record game answer");
    return res.status(500).json({ error: "Could not record your answer" });
  }
});

router.post("/games/sessions/:id/finish", requireAuth, async (req, res) => {
  const user = getUser(req);
  try {
    const response = await db.transaction(async (tx) => {
      const [session] = await tx.select().from(gameSessionsTable)
        .where(and(eq(gameSessionsTable.id, req.params.id as string), eq(gameSessionsTable.userId, user.id)))
        .for("update");
      if (!session) return { status: 404, body: { error: "Game session not found" } };
      if (session.status === "completed") return { status: 200, body: { result: publicResult(session) } };
      const state = session.state as unknown as GameState;
      if (session.gameId === "art-battle" || session.gameId === "chess-cup") return { status: 400, body: { error: "Submit the completed game using its game-specific action" } };
      if (state.index < state.questions.length && Date.now() - state.startedAt < state.duration * 1000) {
        return { status: 409, body: { error: "The timed round is still active" } };
      }
      const result = createResult(session.gameId, state, getReward(session.gameId, state.correct, state.questions.length));
      await completeSession(tx, session, state, result);
      return { status: 200, body: { result } };
    });
    return res.status(response.status).json(response.body);
  } catch (error) {
    req.log.error(error, "Failed to finish game session");
    return res.status(500).json({ error: "Could not finish the game" });
  }
});

export function validArtwork(value: unknown): value is Array<{ color: string; size: number; points: Array<{ x: number; y: number }> }> {
  if (!Array.isArray(value) || value.length > 160) return false;
  let points = 0;
  for (const stroke of value) {
    if (!stroke || typeof stroke.color !== "string" || !/^#[0-9a-f]{6}$/i.test(stroke.color)) return false;
    if (typeof stroke.size !== "number" || stroke.size < 1 || stroke.size > 28 || !Array.isArray(stroke.points)) return false;
    points += stroke.points.length;
    if (points > 5000 || stroke.points.length > 500) return false;
    if (stroke.points.some((point: any) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return false;
  }
  return points >= 5 && JSON.stringify(value).length <= 40_000;
}

router.post("/games/sessions/:id/artwork", requireAuth, async (req, res) => {
  const user = getUser(req);
  const strokes = req.body?.strokes;
  if (!validArtwork(strokes)) return res.status(400).json({ error: "Drawing is empty or too large to submit" });
  try {
    const response = await db.transaction(async (tx) => {
      const [session] = await tx.select().from(gameSessionsTable)
        .where(and(eq(gameSessionsTable.id, req.params.id as string), eq(gameSessionsTable.userId, user.id)))
        .for("update");
      if (!session || session.gameId !== "art-battle") return { status: 404, body: { error: "Art Battle session not found" } };
      if (session.status === "completed") return { status: 200, body: { result: publicResult(session) } };
      if (Date.now() - session.startedAt.getTime() < 55_000) return { status: 409, body: { error: "Finish the 60-second drawing round before submitting" } };
      const state = { ...(session.state as unknown as GameState), artwork: strokes };
      const result = { gameId: "art-battle", score: 1, correct: 1, answered: 1, total: 1, accuracy: 100, rewardPoints: MAX_REWARDS["art-battle"], maxRewardPoints: MAX_REWARDS["art-battle"] };
      await completeSession(tx, session, state, result);
      return { status: 200, body: { result } };
    });
    return res.status(response.status).json(response.body);
  } catch (error) {
    req.log.error(error, "Failed to save Art Battle drawing");
    return res.status(500).json({ error: "Could not save your drawing. Please try again." });
  }
});

router.post("/games/sessions/:id/chess", requireAuth, async (req, res) => {
  const user = getUser(req);
  const pgn = typeof req.body?.pgn === "string" ? req.body.pgn : "";
  if (!pgn || pgn.length > 20_000) return res.status(400).json({ error: "A completed chess game is required" });
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    if (!chess.isGameOver()) return res.status(400).json({ error: "Practice games are saved after checkmate or a draw" });
    const outcome = chess.isCheckmate() ? (chess.turn() === "w" ? "Black wins" : "White wins") : "Draw";
    const response = await db.transaction(async (tx) => {
      const [session] = await tx.select().from(gameSessionsTable)
        .where(and(eq(gameSessionsTable.id, req.params.id as string), eq(gameSessionsTable.userId, user.id)))
        .for("update");
      if (!session || session.gameId !== "chess-cup") return { status: 404, body: { error: "Chess practice session not found" } };
      if (session.status === "completed") return { status: 200, body: { result: publicResult(session) } };
      const state: GameState = { ...(session.state as unknown as GameState), pgn };
      const result = { gameId: "chess-cup", outcome, score: 0, correct: 0, answered: 0, total: 0, accuracy: 0, rewardPoints: 0, maxRewardPoints: 0 };
      await completeSession(tx, session, state, result);
      return { status: 200, body: { result } };
    });
    return res.status(response.status).json(response.body);
  } catch (error) {
    req.log.error(error, "Failed to save chess practice game");
    return res.status(400).json({ error: "Chess record is not valid" });
  }
});

export default router;
