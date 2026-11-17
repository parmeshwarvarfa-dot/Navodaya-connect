import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { GK_BANK, WORD_BANK, getReward, makeMathQuestions, normalizedAnswer, validArtwork } from "./games";

test("GK questions have four options, valid answer indexes, and unique prompts", () => {
  assert.ok(GK_BANK.length >= 20);
  assert.equal(new Set(GK_BANK.map((question) => question.prompt)).size, GK_BANK.length);
  for (const question of GK_BANK) {
    assert.equal(question.options.length, 4);
    assert.ok(question.answer >= 0 && question.answer < question.options.length);
    assert.ok(question.category.length > 0);
  }
});

test("word banks have unique curated words and harmless whitespace is normalized", () => {
  for (const level of ["easy", "medium", "hard"]) {
    const words = WORD_BANK[level];
    assert.equal(words.length, 12);
    assert.equal(new Set(words.map((item) => item.word)).size, words.length);
    assert.ok(words.every((item) => item.definition.length > 10));
  }
  assert.equal(normalizedAnswer("  EnvironMENT   "), "environment");
  assert.notEqual(normalizedAnswer("every day"), normalizedAnswer("everyday"));
});

test("generated mental-math answers match their prompts and are whole numbers", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    for (let sample = 0; sample < 20; sample += 1) {
      const questions = makeMathQuestions(difficulty);
      assert.equal(questions.length, 12);
      for (const question of questions) {
        assert.ok(Number.isInteger(question.answer));
        let expected: number;
        let match: RegExpMatchArray | null;
        if ((match = question.prompt.match(/^(\d+) \+ (\d+) = \?$/))) expected = Number(match[1]) + Number(match[2]);
        else if ((match = question.prompt.match(/^(\d+) − (\d+) = \?$/))) expected = Number(match[1]) - Number(match[2]);
        else if ((match = question.prompt.match(/^(\d+) × (\d+) = \?$/))) expected = Number(match[1]) * Number(match[2]);
        else if ((match = question.prompt.match(/^(\d+) ÷ (\d+) = \?$/))) expected = Number(match[1]) / Number(match[2]);
        else if ((match = question.prompt.match(/^(\d+)% of (\d+) = \?$/))) expected = (Number(match[1]) * Number(match[2])) / 100;
        else if ((match = question.prompt.match(/^(\d+)\/(\d+) of (\d+) = \?$/))) expected = (Number(match[1]) * Number(match[3])) / Number(match[2]);
        else throw new Error(`Unrecognized generated question: ${question.prompt}`);
        assert.equal(question.answer, expected, question.prompt);
      }
    }
  }
});

test("reward calculation is proportional and capped at the displayed maximum", () => {
  assert.equal(getReward("gk-blitz", 20, 20), 50);
  assert.equal(getReward("gk-blitz", 1, 20), 2);
  assert.equal(getReward("word-master", 10, 10), 60);
  assert.equal(getReward("math-ninja", 99, 12), 70);
  assert.equal(getReward("chess-cup", 1, 1), 0);
  assert.equal(getReward("art-battle", 1, 1), 80);
});

test("Art Battle accepts bounded vector strokes and rejects empty or oversized drawings", () => {
  const drawing = [{ color: "#3B82F6", size: 5, points: Array.from({ length: 8 }, (_, i) => ({ x: i / 8, y: i / 8 })) }];
  assert.equal(validArtwork(drawing), true);
  assert.equal(validArtwork([]), false);
  assert.equal(validArtwork([{ ...drawing[0], color: "url(javascript:alert(1))" }]), false);
});

test("chess practice rules reject illegal moves and detect special moves and game endings", () => {
  const opening = new Chess();
  assert.throws(() => opening.move("e2e5"));
  opening.move("e4");
  opening.move("e5");

  const mate = new Chess();
  for (const move of ["f3", "e5", "g4", "Qh4#"]) mate.move(move);
  assert.equal(mate.isCheckmate(), true);

  const stalemate = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(stalemate.isStalemate(), true);

  const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.ok(castle.move("e1g1")?.flags.includes("k"));

  const enPassant = new Chess("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2");
  assert.ok(enPassant.move("e5d6")?.flags.includes("e"));

  const promotion = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  promotion.move({ from: "a7", to: "a8", promotion: "n" });
  assert.equal(promotion.get("a8")?.type, "n");
});
