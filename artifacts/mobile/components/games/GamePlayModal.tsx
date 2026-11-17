import React from "react";
import { View } from "react-native";
import type { GameId, GameResult } from "@/lib/api";
import TimedChallenge from "./TimedChallenge";
import ChessPractice from "./ChessPractice";
import ArtBattle from "./ArtBattle";

type Props = { gameId: GameId; onComplete: (result: GameResult) => void; onClose: () => void };

export default function GamePlayModal({ gameId, onComplete, onClose }: Props) {
  if (gameId === "chess-cup") return <ChessPractice onClose={onClose} />;
  if (gameId === "art-battle") return <ArtBattle onComplete={onComplete} />;
  return <TimedChallenge gameId={gameId} onComplete={onComplete} />;
}
