import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Modal,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";

const ALL_NAVODAYANS = { id: "all-navodayans", icon: "chatbubbles-outline" as const, name: "All Navodayans", lastMessage: "United by JNV spirit!", time: "12:51 PM", color: "#FFF7ED", iconColor: "#F59E0B" };

const HOUSE_META: Record<string, { color: string; bg: string; emoji: string; grad: [string, string] }> = {
  Aravali:  { color: "#1D6ADE", bg: "#EFF6FF", emoji: "💙", grad: ["#1D6ADE", "#3B82F6"] },
  Nilgiri:  { color: "#16A34A", bg: "#F0FDF4", emoji: "💚", grad: ["#16A34A", "#22C55E"] },
  Shivalik: { color: "#DC2626", bg: "#FEF2F2", emoji: "❤️", grad: ["#DC2626", "#EF4444"] },
  Udaygiri: { color: "#D97706", bg: "#FFFBEB", emoji: "💛", grad: ["#D97706", "#F59E0B"] },
};

const RANK_MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];
const RANK_LABELS = ["1st", "2nd", "3rd", "4th"];

type HouseScore = { name: string; points: number; delta: number };

const INITIAL_SCORES: HouseScore[] = [
  { name: "Shivalik", points: 2840, delta: 0 },
  { name: "Aravali",  points: 2710, delta: 0 },
  { name: "Nilgiri",  points: 2590, delta: 0 },
  { name: "Udaygiri", points: 2420, delta: 0 },
];

const EXPLORE_GROUPS = [
  { id: "alumni-network", name: "JNV Alumni Network", members: "4.2K", icon: "people-outline" as const, color: "#3D5AF1" },
  { id: "upsc-aspirants", name: "UPSC Aspirants", members: "1.8K", icon: "trophy-outline" as const, color: "#F59E0B" },
  { id: "tech-careers", name: "Tech Careers", members: "2.1K", icon: "laptop-outline" as const, color: "#10B981" },
  { id: "jee-neet", name: "JEE & NEET Prep", members: "3.4K", icon: "school-outline" as const, color: "#8B5CF6" },
  { id: "arts-culture", name: "Arts & Culture", members: "980", icon: "color-palette-outline" as const, color: "#EF4444" },
];

type Challenge = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  bg: string;
  status: "live" | "upcoming" | "qualifying";
  players: number;
  points: number;
};

const CHALLENGES: Challenge[] = [
  { id: "gk-blitz",     title: "GK Blitz Quiz",      desc: "2-min rapid-fire general knowledge",  icon: "🧠", color: "#3D5AF1", bg: "#EEF2FF", status: "live",       players: 63,  points: 50  },
  { id: "chess-cup",    title: "House Chess Cup",     desc: "Round-robin chess tournament",        icon: "♟️", color: "#374151", bg: "#F3F4F6", status: "qualifying", players: 24,  points: 120 },
  { id: "word-master",  title: "Word Master",         desc: "Speed spelling showdown",             icon: "🔤", color: "#8B5CF6", bg: "#F5F3FF", status: "upcoming",   players: 0,   points: 60  },
  { id: "math-ninja",   title: "Number Ninja",        desc: "Mental maths speed round",            icon: "🔢", color: "#10B981", bg: "#ECFDF5", status: "live",       players: 41,  points: 70  },
  { id: "art-battle",   title: "Art Battle",          desc: "Draw your JNV memory in 60 sec",      icon: "🎨", color: "#EF4444", bg: "#FEF2F2", status: "upcoming",   players: 0,   points: 80  },
];

type QuizQ = { q: string; opts: string[]; ans: number };
const QUIZ_QUESTIONS: QuizQ[] = [
  { q: "In which year were Jawahar Navodaya Vidyalayas established?", opts: ["1977", "1986", "1992", "2000"], ans: 1 },
  { q: "Which is the largest JNV state by number of schools?", opts: ["UP", "Rajasthan", "MP", "Bihar"], ans: 0 },
  { q: "What is the full form of JNV?", opts: ["Junior Navodaya Vidyalaya", "Jawahar Navodaya Vidyalaya", "Jan Navodaya Vidyalaya", "Jeevan Navodaya Vidyalaya"], ans: 1 },
  { q: "Who is known as the father of the Navodaya concept?", opts: ["Dr. APJ Kalam", "Rajiv Gandhi", "Dr. Ambedkar", "Mahatma Gandhi"], ans: 1 },
  { q: "JNV schools are residential from which class?", opts: ["Class 1", "Class 5", "Class 6", "Class 8"], ans: 2 },
];

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [joinedExplore, setJoinedExplore] = useState<Set<string>>(new Set());
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [leaveConfirm, setLeaveConfirm] = useState<{ id: string; name: string } | null>(null);
  const [joinToast, setJoinToast] = useState("");
  const [groupCreatedToast, setGroupCreatedToast] = useState("");
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  // House Arena state
  const [scores, setScores] = useState<HouseScore[]>(INITIAL_SCORES);
  const [livePlayers, setLivePlayers] = useState({ "gk-blitz": 63, "math-ninja": 41 });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Active quiz modal
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing live dot
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Simulate live score updates every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setScores((prev) => {
        const updated = prev.map((h) => {
          const delta = Math.random() < 0.6 ? Math.floor(Math.random() * 18) + 3 : 0;
          return { ...h, points: h.points + delta, delta };
        });
        return [...updated].sort((a, b) => b.points - a.points);
      });
      setLivePlayers((p) => ({
        "gk-blitz":  p["gk-blitz"]  + (Math.random() < 0.5 ? 1 : -1),
        "math-ninja": p["math-ninja"] + (Math.random() < 0.5 ? 1 : -1),
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Quiz timer
  useEffect(() => {
    if (!activeChallenge || quizDone) return;
    setTimeLeft(15);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleNextQuestion(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quizIdx, activeChallenge]);

  const handleNextQuestion = (picked: number | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const correct = QUIZ_QUESTIONS[quizIdx].ans;
    if (picked !== null && picked === correct) setQuizScore((s) => s + 10);
    setSelectedOpt(picked);
    setTimeout(() => {
      if (quizIdx + 1 >= QUIZ_QUESTIONS.length) {
        setQuizDone(true);
      } else {
        setQuizIdx((i) => i + 1);
        setSelectedOpt(null);
      }
    }, 900);
  };

  const openChallenge = (c: Challenge) => {
    setActiveChallenge(c);
    setQuizIdx(0);
    setSelectedOpt(null);
    setQuizScore(0);
    setQuizDone(false);
  };

  const closeChallenge = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveChallenge(null);
  };

  // Groups
  const house = profile?.house ?? "";
  const houseMeta = HOUSE_META[house];

  const houseGroup = house
    ? { id: `${house.toLowerCase()}-myhouse`, icon: "home-outline" as const, name: `${house} House ${houseMeta?.emoji ?? "🏠"}`, lastMessage: `Welcome to ${house} House!`, time: "12:51 PM", color: houseMeta?.bg ?? "#EEF2FF", iconColor: houseMeta?.color ?? "#3D5AF1" }
    : null;

  const batchOrClassGroup = (() => {
    if (!profile) return null;
    if (profile.role === "alumni" && profile.passoutYear)
      return { id: `batch-${profile.passoutYear}`, icon: "people-outline" as const, name: `Batch ${profile.passoutYear}`, lastMessage: `Connect with Batch ${profile.passoutYear} batchmates!`, time: "12:51 PM", color: "#EEF2FF", iconColor: "#3D5AF1" };
    if (profile.role === "student" && profile.class)
      return { id: `class-${profile.class}`, icon: "school-outline" as const, name: `Class ${profile.class}`, lastMessage: `Study and connect with Class ${profile.class} mates!`, time: "12:51 PM", color: "#EEF2FF", iconColor: "#3D5AF1" };
    return null;
  })();

  const jnvGroup = profile?.jnvName
    ? { id: `jnv-${profile.jnvName.toLowerCase().replace(/\s+/g, "-")}`, icon: "chatbubble-outline" as const, name: profile.jnvName, lastMessage: `Connect with your ${profile.jnvName} community!`, time: "12:51 PM", color: "#F0FDF4", iconColor: "#10B981" }
    : null;

  const YOUR_GROUPS = [batchOrClassGroup, houseGroup, jnvGroup, ALL_NAVODAYANS].filter(Boolean) as typeof ALL_NAVODAYANS[];

  const filtered = searchQuery.trim()
    ? YOUR_GROUPS.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : YOUR_GROUPS;

  const showToast = (msg: string) => {
    setJoinToast(msg);
    setTimeout(() => setJoinToast(""), 2500);
  };

  const toggleExplore = (id: string, name: string) => {
    if (joinedExplore.has(id)) {
      setLeaveConfirm({ id, name });
    } else {
      setJoinedExplore((prev) => { const n = new Set(prev); n.add(id); return n; });
      showToast(`Joined "${name}"!`);
    }
  };

  const confirmLeave = () => {
    if (!leaveConfirm) return;
    setJoinedExplore((p) => { const n = new Set(p); n.delete(leaveConfirm.id); return n; });
    setLeaveConfirm(null);
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const name = newGroupName.trim();
    setNewGroupName(""); setShowNewGroup(false);
    setGroupCreatedToast(`"${name}" created! Invite members to join.`);
    setTimeout(() => setGroupCreatedToast(""), 3000);
  };

  const maxPoints = scores[0]?.points ?? 1;

  const statusColor = (s: Challenge["status"]) =>
    s === "live" ? "#10B981" : s === "upcoming" ? "#F59E0B" : "#8B5CF6";
  const statusLabel = (s: Challenge["status"], c: Challenge) =>
    s === "live" ? `🔴 LIVE · ${s === "live" && c.id === "gk-blitz" ? livePlayers["gk-blitz"] : livePlayers["math-ninja"]} playing` :
    s === "upcoming" ? "⏳ Upcoming" : "🏁 Qualifying";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        {showSearch ? (
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search groups..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>Chat Groups</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(true)}>
                <Ionicons name="search-outline" size={20} color="#3D5AF1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowNewGroup(true)}>
                <Ionicons name="add" size={22} color="#3D5AF1" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Your Groups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <View style={styles.groupList}>
            {(searchQuery ? filtered : YOUR_GROUPS).map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupRow}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: "/(screens)/group-chat" as any, params: { id: group.id, name: encodeURIComponent(group.name) } })}
              >
                <View style={[styles.groupIcon, { backgroundColor: group.color }]}>
                  <Ionicons name={group.icon} size={22} color={group.iconColor} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupMessage} numberOfLines={1}>{group.lastMessage}</Text>
                </View>
                <View style={styles.groupRight}>
                  <Text style={styles.groupTime}>{group.time}</Text>
                  <View style={styles.unreadDot} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!searchQuery && (
          <>
            {/* ─── HOUSE ARENA ─── */}
            <View style={[styles.section, { paddingHorizontal: 0 }]}>
              <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.arenaHeader}>
                <View style={styles.arenaTopRow}>
                  <View>
                    <Text style={styles.arenaTitle}>🏆 House Arena</Text>
                    <Text style={styles.arenaSub}>Compete. Earn points. Rule the board.</Text>
                  </View>
                  <View style={styles.liveChip}>
                    <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>

                {/* Leaderboard */}
                <View style={styles.leaderboard}>
                  {scores.map((h, i) => {
                    const meta = HOUSE_META[h.name];
                    const barWidth = (h.points / maxPoints) * 100;
                    const isUserHouse = h.name === house;
                    return (
                      <View key={h.name} style={[styles.lbRow, isUserHouse && styles.lbRowHighlight]}>
                        <Text style={styles.lbMedal}>{RANK_MEDALS[i]}</Text>
                        <View style={[styles.lbDot, { backgroundColor: meta.color }]} />
                        <View style={styles.lbInfo}>
                          <View style={styles.lbNameRow}>
                            <Text style={styles.lbName}>{h.name} {meta.emoji}{isUserHouse ? " (You)" : ""}</Text>
                            <View style={styles.lbRight}>
                              {h.delta > 0 && (
                                <Text style={styles.lbDelta}>+{h.delta}</Text>
                              )}
                              <Text style={styles.lbPoints}>{h.points.toLocaleString()} pts</Text>
                            </View>
                          </View>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${barWidth}%` as any, backgroundColor: meta.color }]} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </LinearGradient>
            </View>

            {/* Active Challenges */}
            <View style={[styles.section, { paddingTop: 16 }]}>
              <View style={styles.challengeHeaderRow}>
                <Text style={styles.sectionTitle}>Active Challenges</Text>
                <View style={styles.liveChipSmall}>
                  <Animated.View style={[styles.liveDotSmall, { transform: [{ scale: pulseAnim }] }]} />
                  <Text style={styles.liveTextSmall}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.sectionSub}>Play to earn points for your house</Text>

              {CHALLENGES.map((c) => (
                <View key={c.id} style={[styles.challengeCard, { borderLeftColor: c.color }]}>
                  <View style={[styles.challengeIconWrap, { backgroundColor: c.bg }]}>
                    <Text style={styles.challengeEmoji}>{c.icon}</Text>
                  </View>
                  <View style={styles.challengeInfo}>
                    <Text style={styles.challengeTitle}>{c.title}</Text>
                    <Text style={styles.challengeDesc}>{c.desc}</Text>
                    <View style={styles.challengeMeta}>
                      <Text style={[styles.challengeStatus, { color: statusColor(c.status) }]}>
                        {c.id === "gk-blitz" || c.id === "math-ninja" ? statusLabel(c.status, c) : c.status === "live" ? `🔴 LIVE · ${c.players} playing` : c.status === "upcoming" ? "⏳ Upcoming" : "🏁 Qualifying"}
                      </Text>
                      <Text style={styles.challengePts}>+{c.points} pts</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.playBtn, { backgroundColor: c.status === "upcoming" ? "#E5E7EB" : c.color }]}
                    onPress={() => c.status !== "upcoming" && openChallenge(c)}
                    disabled={c.status === "upcoming"}
                  >
                    <Text style={[styles.playBtnText, { color: c.status === "upcoming" ? "#9CA3AF" : "#fff" }]}>
                      {c.status === "upcoming" ? "Soon" : "Play"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Explore Groups */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Explore Groups</Text>
              {EXPLORE_GROUPS.map((g) => {
                const joined = joinedExplore.has(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.exploreRow}
                    activeOpacity={0.7}
                    onPress={() => joined ? router.push({ pathname: "/(screens)/group-chat" as any, params: { id: g.id, name: encodeURIComponent(g.name) } }) : undefined}
                  >
                    <View style={[styles.exploreIcon, { backgroundColor: g.color + "18" }]}>
                      <Ionicons name={g.icon} size={20} color={g.color} />
                    </View>
                    <View style={styles.exploreInfo}>
                      <Text style={styles.exploreName}>{g.name}</Text>
                      <Text style={styles.exploreMembers}>{g.members} members</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.joinSmBtn, { borderColor: joined ? "#E5E7EB" : g.color, backgroundColor: joined ? g.color : "transparent" }]}
                      onPress={() => toggleExplore(g.id, g.name)}
                    >
                      <Text style={[styles.joinSmText, { color: joined ? "#fff" : g.color }]}>
                        {joined ? "Joined ✓" : "Join"}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* ─── QUIZ MODAL ─── */}
      <Modal visible={!!activeChallenge} animationType="slide">
        <LinearGradient colors={["#1E1B4B", "#312E81"]} style={{ flex: 1 }}>
          <View style={[styles.quizHeader, { paddingTop: topPad + 8 }]}>
            <TouchableOpacity onPress={closeChallenge}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.quizHeaderTitle}>{activeChallenge?.title}</Text>
            <View style={styles.quizScoreBadge}>
              <Text style={styles.quizScoreText}>{quizScore} pts</Text>
            </View>
          </View>

          {!quizDone ? (
            <ScrollView contentContainerStyle={styles.quizBody}>
              <View style={styles.quizProgressRow}>
                {QUIZ_QUESTIONS.map((_, i) => (
                  <View key={i} style={[styles.quizProgressDot, { backgroundColor: i < quizIdx ? "#6EE7B7" : i === quizIdx ? "#fff" : "rgba(255,255,255,0.25)" }]} />
                ))}
              </View>

              <View style={styles.timerRow}>
                <View style={[styles.timerCircle, { borderColor: timeLeft <= 5 ? "#EF4444" : "#6EE7B7" }]}>
                  <Text style={[styles.timerText, { color: timeLeft <= 5 ? "#EF4444" : "#6EE7B7" }]}>{timeLeft}</Text>
                </View>
              </View>

              <Text style={styles.quizQ}>{QUIZ_QUESTIONS[quizIdx].q}</Text>

              <View style={styles.optList}>
                {QUIZ_QUESTIONS[quizIdx].opts.map((opt, oi) => {
                  const isCorrect = oi === QUIZ_QUESTIONS[quizIdx].ans;
                  const isSelected = selectedOpt === oi;
                  let bg = "rgba(255,255,255,0.1)";
                  let border = "rgba(255,255,255,0.2)";
                  if (selectedOpt !== null) {
                    if (isCorrect) { bg = "rgba(110,231,183,0.25)"; border = "#6EE7B7"; }
                    else if (isSelected) { bg = "rgba(239,68,68,0.25)"; border = "#EF4444"; }
                  }
                  return (
                    <TouchableOpacity
                      key={oi}
                      style={[styles.optBtn, { backgroundColor: bg, borderColor: border }]}
                      onPress={() => selectedOpt === null && handleNextQuestion(oi)}
                      disabled={selectedOpt !== null}
                    >
                      <View style={styles.optLabel}>
                        <Text style={styles.optLetter}>{["A","B","C","D"][oi]}</Text>
                      </View>
                      <Text style={styles.optText}>{opt}</Text>
                      {selectedOpt !== null && isCorrect && <Ionicons name="checkmark-circle" size={18} color="#6EE7B7" />}
                      {isSelected && !isCorrect && <Ionicons name="close-circle" size={18} color="#EF4444" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.quizCounter}>Question {quizIdx + 1} of {QUIZ_QUESTIONS.length}</Text>
            </ScrollView>
          ) : (
            <View style={styles.quizDoneWrap}>
              <Text style={styles.quizDoneEmoji}>{quizScore >= 40 ? "🏆" : quizScore >= 20 ? "🎉" : "💪"}</Text>
              <Text style={styles.quizDoneTitle}>
                {quizScore >= 40 ? "Outstanding!" : quizScore >= 20 ? "Well done!" : "Keep practising!"}
              </Text>
              <Text style={styles.quizDoneSub}>You scored</Text>
              <Text style={styles.quizDoneScore}>{quizScore} / 50 pts</Text>
              {house ? (
                <Text style={styles.quizDoneHouse}>
                  +{quizScore} points added to {house} House {HOUSE_META[house]?.emoji}
                </Text>
              ) : null}
              <TouchableOpacity style={styles.quizDoneBtn} onPress={closeChallenge}>
                <Text style={styles.quizDoneBtnText}>Back to Arena</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </Modal>

      {/* New Group Modal */}
      <Modal visible={showNewGroup} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Group</Text>
            <TouchableOpacity onPress={() => setShowNewGroup(false)}>
              <Ionicons name="close" size={24} color="#111" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Group Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter group name..."
              placeholderTextColor="#9CA3AF"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <TouchableOpacity
              style={[styles.createBtn, !newGroupName.trim() && { opacity: 0.5 }]}
              onPress={handleCreateGroup}
              disabled={!newGroupName.trim()}
            >
              <Text style={styles.createBtnText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave confirmation modal */}
      <Modal visible={!!leaveConfirm} transparent animationType="fade">
        <View style={styles.leaveOverlay}>
          <View style={styles.leaveCard}>
            <Text style={styles.leaveTitle}>Leave Group</Text>
            <Text style={styles.leaveSub}>{leaveConfirm ? `Leave "${leaveConfirm.name}"?` : ""}</Text>
            <View style={styles.leaveRow}>
              <TouchableOpacity style={styles.leaveCancelBtn} onPress={() => setLeaveConfirm(null)}>
                <Text style={styles.leaveCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.leaveConfirmBtn} onPress={confirmLeave}>
                <Text style={styles.leaveConfirmText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {(joinToast || groupCreatedToast) ? (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.toastText}>{joinToast || groupCreatedToast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", backgroundColor: "#fff" },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  headerRight: { position: "absolute", right: 16, bottom: 12, flexDirection: "row", gap: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 14 },
  groupList: {},
  groupRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F5F5F5", gap: 14 },
  groupIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  groupMessage: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  groupRight: { alignItems: "flex-end", gap: 4 },
  groupTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3D5AF1" },

  // Arena
  arenaHeader: { marginHorizontal: 20, borderRadius: 20, padding: 18, marginTop: 6 },
  arenaTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  arenaTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  arenaSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 2 },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  leaderboard: { gap: 12 },
  lbRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 10 },
  lbRowHighlight: { backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  lbMedal: { fontSize: 20, width: 28, textAlign: "center" },
  lbDot: { width: 10, height: 10, borderRadius: 5 },
  lbInfo: { flex: 1 },
  lbNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  lbName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  lbRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  lbDelta: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6EE7B7", backgroundColor: "rgba(110,231,183,0.15)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  lbPoints: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  barBg: { height: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 3, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },

  // Challenges
  challengeHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  liveChipSmall: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF2F2", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  liveTextSmall: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#EF4444", letterSpacing: 0.5 },
  challengeCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, backgroundColor: "#F9FAFB", padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  challengeIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  challengeEmoji: { fontSize: 22 },
  challengeInfo: { flex: 1 },
  challengeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 2 },
  challengeDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 4 },
  challengeMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  challengeStatus: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  challengePts: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1", backgroundColor: "#EEF2FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  playBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  playBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Explore
  exploreRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F5", gap: 14 },
  exploreIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  exploreInfo: { flex: 1 },
  exploreName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  exploreMembers: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  joinSmBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  joinSmText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Quiz Modal
  quizHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  quizHeaderTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", flex: 1, textAlign: "center" },
  quizScoreBadge: { backgroundColor: "rgba(110,231,183,0.2)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  quizScoreText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#6EE7B7" },
  quizBody: { paddingHorizontal: 20, paddingBottom: 40 },
  quizProgressRow: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 20 },
  quizProgressDot: { width: 8, height: 8, borderRadius: 4 },
  timerRow: { alignItems: "center", marginBottom: 20 },
  timerCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  timerText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  quizQ: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center", lineHeight: 26, marginBottom: 24 },
  optList: { gap: 12 },
  optBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  optLabel: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  optLetter: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  optText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#fff" },
  quizCounter: { textAlign: "center", marginTop: 24, fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)" },
  quizDoneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  quizDoneEmoji: { fontSize: 72, marginBottom: 16 },
  quizDoneTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 8 },
  quizDoneSub: { fontSize: 16, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginBottom: 4 },
  quizDoneScore: { fontSize: 48, fontFamily: "Inter_700Bold", color: "#6EE7B7", marginBottom: 8 },
  quizDoneHouse: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)", marginBottom: 32, textAlign: "center" },
  quizDoneBtn: { backgroundColor: "#fff", borderRadius: 28, paddingHorizontal: 40, paddingVertical: 15 },
  quizDoneBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#312E81" },

  // Modals
  modalWrap: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 8 },
  modalInput: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  createBtn: { backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  createBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  leaveOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  leaveCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%" },
  leaveTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111", marginBottom: 6 },
  leaveSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 20 },
  leaveRow: { flexDirection: "row", gap: 12 },
  leaveCancelBtn: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  leaveCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#374151" },
  leaveConfirmBtn: { flex: 1, backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  leaveConfirmText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  toast: { position: "absolute", bottom: 24, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  toastText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
