import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";

interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: "submitted" | "seen" | "in_progress" | "solved";
  anonymous: boolean;
  submittedByName: string;
  createdAt: any;
}

interface Comment {
  id: string;
  text: string;
  authorName: string;
  authorRole: string;
  createdAt: any;
}

const STATUSES = ["submitted", "seen", "in_progress", "solved"] as const;
const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  seen: "Seen",
  in_progress: "In Progress",
  solved: "Solved",
};

export default function ProblemDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fetchData = async () => {
    if (!id) return;
    try {
      const docSnap = await getDoc(doc(db, "problems", id));
      if (docSnap.exists()) setProblem({ id: docSnap.id, ...docSnap.data() } as Problem);
      const q = query(collection(db, "problems", id, "comments"), orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)));
    } catch {}
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleComment = async () => {
    if (!commentText.trim() || !id) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "problems", id, "comments"), {
        text: commentText.trim(),
        authorName: profile?.fullName,
        authorRole: profile?.role,
        authorId: profile?.uid,
        createdAt: serverTimestamp(),
      });
      setCommentText("");
      fetchData();
    } catch {}
    setPosting(false);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!id || profile?.role !== "official") return;
    try {
      await updateDoc(doc(db, "problems", id), { status: newStatus });
      fetchData();
    } catch {}
  };

  if (!problem) return null;

  const statusColors: Record<string, string> = {
    submitted: "#64748B",
    seen: "#2563EB",
    in_progress: "#D97706",
    solved: "#059669",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Problem Detail</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <PremiumCard style={styles.problemCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusColors[problem.status] + "20" }]}>
                <Text style={[styles.statusText, { color: statusColors[problem.status] }]}>
                  {STATUS_LABELS[problem.status]}
                </Text>
              </View>
              <Text style={[styles.priority, { color: colors.mutedForeground }]}>
                {problem.priority} priority
              </Text>
            </View>
            <Text style={[styles.problemTitle, { color: colors.foreground }]}>{problem.title}</Text>
            <Text style={[styles.problemDesc, { color: colors.mutedForeground }]}>{problem.description}</Text>
            <Text style={[styles.submittedBy, { color: colors.mutedForeground }]}>
              Submitted by {problem.anonymous ? "Anonymous" : problem.submittedByName}
            </Text>
          </PremiumCard>

          {profile?.role === "official" && (
            <PremiumCard style={styles.statusUpdateCard}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Update Status</Text>
              <View style={styles.statusBtns}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => handleStatusUpdate(s)}
                    style={[
                      styles.statusBtn,
                      {
                        backgroundColor: problem.status === s ? colors.primary : colors.muted,
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBtnText,
                        { color: problem.status === s ? "#fff" : colors.foreground },
                      ]}
                    >
                      {STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </PremiumCard>
          )}

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Comments ({comments.length})
          </Text>

          {comments.map((c) => (
            <PremiumCard key={c.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={[styles.commentAuthor, { color: colors.primary }]}>{c.authorName}</Text>
                <Text style={[styles.commentRole, { color: colors.mutedForeground }]}>{c.authorRole}</Text>
              </View>
              <Text style={[styles.commentText, { color: colors.foreground }]}>{c.text}</Text>
            </PremiumCard>
          ))}

          {(profile?.role === "alumni" || profile?.role === "teacher" || profile?.role === "official") && (
            <PremiumCard style={styles.commentInput}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add Comment</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius - 6 }]}
                placeholder="Write a helpful comment..."
                placeholderTextColor={colors.mutedForeground}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                numberOfLines={3}
              />
              <PremiumButton
                title="Post Comment"
                onPress={handleComment}
                loading={posting}
                style={{ marginTop: 10 }}
              />
            </PremiumCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  content: { padding: 16 },
  problemCard: { marginBottom: 14 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  priority: { fontSize: 13, fontFamily: "Inter_500Medium" },
  problemTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8, lineHeight: 24 },
  problemDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, marginBottom: 10 },
  submittedBy: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusUpdateCard: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 10 },
  statusBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  statusBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  commentCard: { marginBottom: 8 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  commentAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  commentRole: { fontSize: 11, fontFamily: "Inter_400Regular" },
  commentText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  commentInput: { marginTop: 8 },
  input: { padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
});
