import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  Switch,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { Problem, ProblemWithComments } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";

const STATUS_CONFIG = {
  submitted: { label: "Submitted", color: "#64748B", bg: "#F1F5F9" },
  seen: { label: "Seen", color: "#2563EB", bg: "#DBEAFE" },
  in_progress: { label: "In Progress", color: "#D97706", bg: "#FEF3C7" },
  solved: { label: "Solved", color: "#059669", bg: "#D1FAE5" },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "#64748B" },
  medium: { label: "Medium", color: "#D97706" },
  high: { label: "High", color: "#EF4444" },
};

const CATEGORIES = ["Academic", "Infrastructure", "Hostel", "Food", "Medical", "Sports", "Other"];

export default function ProblemsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Academic");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProblemWithComments | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchProblems = async () => {
    try {
      const data = await api.problems.list();
      setProblems(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchProblems(); }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      showToast("Please fill in title and description");
      return;
    }
    setSubmitting(true);
    try {
      await api.problems.create({ title: title.trim(), description: description.trim(), category, priority, anonymous });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setCategory("Academic");
      setPriority("medium");
      setAnonymous(false);
      showToast("Problem submitted");
      fetchProblems();
    } catch {
      showToast("Failed to submit problem");
    }
    setSubmitting(false);
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const data = await api.problems.get(id);
      setDetail(data);
    } catch {
      showToast("Failed to load problem");
    }
    setDetailLoading(false);
  };

  const closeDetail = () => { setSelectedId(null); setDetail(null); setCommentText(""); };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedId) return;
    setCommentSubmitting(true);
    try {
      await api.problems.addComment(selectedId, commentText.trim());
      setCommentText("");
      const data = await api.problems.get(selectedId);
      setDetail(data);
    } catch {
      showToast("Failed to add comment");
    }
    setCommentSubmitting(false);
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedId) return;
    try {
      await api.problems.updateStatus(selectedId, status);
      const data = await api.problems.get(selectedId);
      setDetail(data);
      fetchProblems();
      showToast("Status updated");
    } catch {
      showToast("Failed to update status");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Problems</Text>
          {(profile?.role === "student" || profile?.role === "teacher") && (
            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <FlatList
        data={problems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No problems reported</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const statusCfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted;
          const priorityCfg = PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
          return (
            <TouchableOpacity activeOpacity={0.85} onPress={() => openDetail(item.id)}>
              <PremiumCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                  </View>
                  <Text style={[styles.priorityText, { color: priorityCfg.color }]}>{priorityCfg.label} priority</Text>
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.description}
                </Text>
                <View style={styles.cardFooter}>
                  <View style={[styles.catBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.catText, { color: colors.mutedForeground }]}>{item.category}</Text>
                  </View>
                  <Text style={[styles.submittedBy, { color: colors.mutedForeground }]}>
                    {item.anonymous ? "Anonymous" : item.submittedByName}
                  </Text>
                </View>
              </PremiumCard>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report Problem</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <PremiumInput label="Title" value={title} onChangeText={setTitle} placeholder="Brief title of the problem" icon="document-text-outline" />
            <PremiumInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the problem in detail"
              multiline
              numberOfLines={4}
              style={{ minHeight: 80, textAlignVertical: "top" }}
              icon="create-outline"
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, { backgroundColor: category === c ? colors.primary : colors.muted, borderRadius: 20 }]}
                >
                  <Text style={[styles.chipText, { color: category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {(["low", "medium", "high"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[styles.priorityBtn, { backgroundColor: priority === p ? PRIORITY_CONFIG[p].color : colors.muted, borderRadius: 10 }]}
                >
                  <Text style={[styles.priorityBtnText, { color: priority === p ? "#fff" : colors.foreground }]}>
                    {PRIORITY_CONFIG[p].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.anonymousRow}>
              <View>
                <Text style={[styles.anonymousLabel, { color: colors.foreground }]}>Submit Anonymously</Text>
                <Text style={[styles.anonymousSub, { color: colors.mutedForeground }]}>Your name will be hidden</Text>
              </View>
              <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: colors.primary, false: colors.muted }} />
            </View>
            <PremiumButton title="Submit Problem" onPress={handleSubmit} loading={submitting} style={{ marginTop: 16 }} />
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!selectedId} animationType="slide" presentationStyle="formSheet" onRequestClose={closeDetail}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Problem Details</Text>
            <TouchableOpacity onPress={closeDetail}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {detailLoading || !detail ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_CONFIG[detail.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted).bg }]}>
                  <Text style={[styles.statusText, { color: (STATUS_CONFIG[detail.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted).color }]}>
                    {(STATUS_CONFIG[detail.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted).label}
                  </Text>
                </View>
                <Text style={[styles.priorityText, { color: (PRIORITY_CONFIG[detail.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium).color }]}>
                  {(PRIORITY_CONFIG[detail.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium).label} priority
                </Text>
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, fontSize: 17, marginTop: 6 }]}>{detail.title}</Text>
              <Text style={[styles.cardDesc, { color: colors.foreground, marginTop: 6 }]}>{detail.description}</Text>
              <Text style={[styles.submittedBy, { color: colors.mutedForeground, marginTop: 8 }]}>
                {detail.anonymous ? "Anonymous" : detail.submittedByName} · {detail.category}
              </Text>

              {(profile?.role === "teacher" || profile?.role === "official") && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>Update Status</Text>
                  <View style={styles.priorityRow}>
                    {Object.keys(STATUS_CONFIG).map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => handleUpdateStatus(s)}
                        style={[styles.priorityBtn, { backgroundColor: detail.status === s ? colors.primary : colors.muted, borderRadius: 10 }]}
                      >
                        <Text style={[styles.priorityBtnText, { color: detail.status === s ? "#fff" : colors.foreground, fontSize: 11 }]}>
                          {STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>
                Comments ({detail.comments?.length || 0})
              </Text>
              {(detail.comments || []).map((c) => (
                <View key={c.id} style={[styles.commentItem, { borderColor: colors.border }]}>
                  <Text style={[styles.commentAuthor, { color: colors.foreground }]}>{c.authorName} <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>· {c.role}</Text></Text>
                  <Text style={[styles.commentText, { color: colors.foreground }]}>{c.text}</Text>
                </View>
              ))}
              <PremiumInput
                label="Add a comment"
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write a helpful comment…"
                multiline
                numberOfLines={3}
                style={{ minHeight: 60, textAlignVertical: "top" }}
                icon="chatbubble-outline"
              />
              <PremiumButton title="Post Comment" onPress={handleAddComment} loading={commentSubmitting} style={{ marginTop: 8, marginBottom: 20 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {!!toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toast: {
    position: "absolute", bottom: 100, left: 20, right: 20,
    backgroundColor: "#1A3C6E", borderRadius: 10, padding: 14, alignItems: "center",
  },
  toastText: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
  commentItem: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  commentAuthor: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  commentText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  createBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  card: { marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  priorityText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 10 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  submittedBy: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8, marginTop: 4 },
  chipScroll: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  priorityRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  priorityBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  priorityBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  anonymousRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: 12 },
  anonymousLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  anonymousSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
