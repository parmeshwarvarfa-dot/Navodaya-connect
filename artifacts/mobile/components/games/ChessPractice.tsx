import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Chess, type Square } from "chess.js";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";

const FILES = "abcdefgh";
const GLYPHS: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

export default function ChessPractice({ onClose }: { onClose: () => void }) {
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) gameRef.current = new Chess();
  const game = gameRef.current;
  const [fen, setFen] = useState(game.fen());
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const { width } = useWindowDimensions();
  const boardSize = Math.min(Math.max(280, width - 36), 456);
  const squareSize = boardSize / 8;
  const board = useMemo(() => game.board(), [fen, game]);
  const legalMoves = useMemo(() => selected
    ? game.moves({ square: selected as any, verbose: true }).map((move) => move.to)
    : [], [fen, game, selected]);
  const gameOver = game.isGameOver();
  const status = game.isCheckmate()
    ? `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`
    : game.isStalemate() ? "Draw by stalemate"
      : game.isInsufficientMaterial() ? "Draw by insufficient material"
        : game.isThreefoldRepetition() ? "Draw by repetition"
          : game.isDraw() ? "Draw"
            : `${game.turn() === "w" ? "White" : "Black"} to move${game.isCheck() ? " · Check" : ""}`;

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setMessage("");
    try {
      const session = await api.games.start("chess-cup");
      setSessionId(session.sessionId);
    } catch {
      setMessage("You can still play locally. Sign in to save completed practice games.");
    } finally {
      setStarting(false);
      setStarted(true);
    }
  };

  const publishMove = () => {
    setFen(game.fen());
    setSelected(null);
    if (game.isGameOver()) {
      setMessage(game.isCheckmate()
        ? `${game.turn() === "w" ? "Black" : "White"} wins by checkmate. Tournament points are not available for practice games.`
        : "Draw. Tournament points are not available for practice games.");
      if (sessionId) {
        api.games.saveChess(sessionId, game.pgn())
          .then(() => setSaved(true))
          .catch((error: Error) => setMessage(`${error.message} Practice result stays on this device.`));
      }
    }
  };

  const makeMove = (from: string, to: string, promoteTo = "q") => {
    try {
      const moved = game.move({ from, to, promotion: promoteTo });
      if (moved) publishMove();
    } catch {
      setSelected(null);
    }
    setPromotion(null);
  };

  const pressSquare = (square: string) => {
    if (gameOver || promotion) return;
    if (selected) {
      const move = game.moves({ square: selected as any, verbose: true }).find((candidate) => candidate.to === square);
      if (move) {
        if (move.flags.includes("p")) setPromotion({ from: selected, to: square });
        else makeMove(selected, square);
        return;
      }
    }
    const piece = game.get(square as any);
    if (piece?.color === game.turn()) setSelected(square);
    else setSelected(null);
  };

  const reset = async () => {
    if (sessionId && game.history().length) {
      try { await api.games.saveChess(sessionId, game.pgn()); } catch { /* An unfinished practice game is not recorded. */ }
    }
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelected(null);
    setPromotion(null);
    setSessionId("");
    setSaved(false);
    setMessage("");
    setStarted(false);
  };

  if (!started) return (
    <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.root}>
      <View style={styles.intro}>
        <Text style={styles.emoji}>♟️</Text>
        <Text style={styles.title}>House Chess Cup</Text>
        <Text style={styles.copy}>Local two-player practice with full chess rules: legal moves, check, checkmate, stalemate, castling, en passant, and promotion. No online tournament is currently scheduled, so practice games do not earn the tournament reward.</Text>
        {message ? <Text style={styles.note}>{message}</Text> : null}
        <TouchableOpacity style={styles.primaryButton} onPress={start} disabled={starting} accessibilityRole="button" accessibilityLabel="Start local two-player chess">
          {starting ? <ActivityIndicator color="#312E81" /> : <Text style={styles.primaryText}>Start local two-player game</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.backButton}><Text style={styles.backText}>Back to Arena</Text></TouchableOpacity>
      </View>
    </LinearGradient>
  );

  return (
    <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.play}>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{gameOver ? (saved ? "Practice saved" : "Game over") : status}</Text>
          <TouchableOpacity onPress={reset} accessibilityRole="button" accessibilityLabel="Start a new chess game" style={styles.iconButton}><Ionicons name="refresh" size={18} color="#312E81" /><Text style={styles.iconButtonText}>New game</Text></TouchableOpacity>
        </View>
        <View style={[styles.board, { width: boardSize, height: boardSize }]}>
          {board.map((row, rowIndex) => row.map((piece, columnIndex) => {
            const square = `${FILES[columnIndex]}${8 - rowIndex}` as Square;
            const light = (rowIndex + columnIndex) % 2 === 0;
            const isSelected = selected === square;
            const canMove = legalMoves.includes(square);
            return <TouchableOpacity key={square} onPress={() => pressSquare(square)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : " empty"}${canMove ? ", legal destination" : ""}`} style={[styles.square, { width: squareSize, height: squareSize, backgroundColor: isSelected ? "#A7F3D0" : light ? "#F0D9B5" : "#B58863" }]}>
              {piece ? <Text style={[styles.piece, { color: piece.color === "w" ? "#FFFDF6" : "#1F2937", textShadowColor: piece.color === "w" ? "#303030" : "#FFFFFF", fontSize: squareSize * 0.72 }]}>{GLYPHS[`${piece.color}${piece.type.toUpperCase()}`]}</Text> : null}
              {canMove && !piece ? <View style={styles.moveDot} /> : null}
              {canMove && piece ? <View style={styles.captureRing} /> : null}
              {columnIndex === 0 ? <Text style={[styles.rank, { color: light ? "#B58863" : "#F0D9B5" }]}>{8 - rowIndex}</Text> : null}
              {rowIndex === 7 ? <Text style={[styles.file, { color: light ? "#B58863" : "#F0D9B5" }]}>{FILES[columnIndex]}</Text> : null}
            </TouchableOpacity>;
          }))}
        </View>
        <Text style={styles.hint}>Tap a piece, then a highlighted square. Players alternate on the same device.</Text>
        {promotion ? <View style={styles.promotionRow}><Text style={styles.note}>Promote pawn to:</Text>{["q", "r", "b", "n"].map((piece) => <TouchableOpacity key={piece} onPress={() => makeMove(promotion.from, promotion.to, piece)} style={styles.promotionButton}><Text style={styles.promotionText}>{GLYPHS[`${game.turn()}${piece.toUpperCase()}`]}</Text></TouchableOpacity>)}</View> : null}
        {message ? <Text style={styles.note}>{message}</Text> : null}
        <Text style={styles.tournamentNote}>Practice mode · House tournament is not open · No tournament points awarded</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emoji: { fontSize: 58, marginBottom: 12 },
  title: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 10 },
  copy: { color: "rgba(255,255,255,0.76)", fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 18 },
  primaryButton: { minHeight: 48, paddingHorizontal: 22, paddingVertical: 13, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: "#fff", marginTop: 6 },
  primaryText: { color: "#312E81", fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "center" },
  backButton: { padding: 14, marginTop: 8 },
  backText: { color: "#DDD6FE", fontFamily: "Inter_600SemiBold" },
  play: { alignItems: "center", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30 },
  statusRow: { width: "100%", maxWidth: 456, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 },
  statusText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 },
  iconButton: { flexDirection: "row", gap: 5, alignItems: "center", borderRadius: 18, backgroundColor: "#fff", paddingVertical: 8, paddingHorizontal: 12 },
  iconButtonText: { color: "#312E81", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  board: { flexDirection: "row", flexWrap: "wrap", overflow: "hidden", borderRadius: 4, borderWidth: 2, borderColor: "#F3E7D5" },
  square: { alignItems: "center", justifyContent: "center", position: "relative" },
  piece: { textAlign: "center", textAlignVertical: "center", includeFontPadding: false, lineHeight: undefined },
  moveDot: { position: "absolute", width: "26%", height: "26%", borderRadius: 20, backgroundColor: "rgba(31,41,55,0.32)" },
  captureRing: { ...StyleSheet.absoluteFillObject, borderWidth: 4, borderColor: "rgba(31,41,55,0.32)", borderRadius: 40 },
  rank: { position: "absolute", left: 2, top: 0, fontSize: 9, fontFamily: "Inter_700Bold" },
  file: { position: "absolute", right: 2, bottom: 0, fontSize: 9, fontFamily: "Inter_700Bold" },
  hint: { color: "rgba(255,255,255,0.68)", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", marginTop: 12 },
  promotionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" },
  promotionButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  promotionText: { color: "#1F2937", fontSize: 26 },
  note: { color: "#FDE68A", fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },
  tournamentNote: { color: "rgba(255,255,255,0.58)", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 15 },
});
