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
  Alert,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";

interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: "submitted" | "seen" | "in_progress" | "solved";
  anonymous: boolean;
  submittedBy: string;
  submittedByName: string;
  createdAt: any;
}

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
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fetchProblems = async () => {
    try {
      const q = query(collection(db, "problems"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setProblems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Problem)));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Error", "Please fill in title and description");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "problems"), {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        anonymous,
        status: "submitted",
        submittedBy: profile?.uid,
        submittedByName: anonymous ? "Anonymous" : profile?.fullName,
        jnvName: profile?.jnvName,
        jnvState: profile?.jnvState,
        createdAt: serverTimestamp(),
      });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setCategory("Academic");
      setPriority("medium");
      setAnonymous(false);
      fetchProblems();
    } catch {
      Alert.alert("Error", "Failed to submit problem");
    }
    setSubmitting(false);
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
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => setShowCreate(true)}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <FlatList
        data={problems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No problems reported
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.submitted;
          const priorityCfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/(screens)/problem-detail?id=${item.id}` as any)}
            >
              <PremiumCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.color }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                  <Text style={[styles.priorityText, { color: priorityCfg.color }]}>
                    {priorityCfg.label} priority
                  </Text>
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.cardDesc, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
                <View style={styles.cardFooter}>
                  <View style={[styles.catBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.catText, { color: colors.mutedForeground }]}>
                      {item.category}
                    </Text>
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
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Report Problem
            </Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <PremiumInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Brief title of the problem"
              icon="document-text-outline"
            />
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

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: category === c ? colors.primary : colors.muted,
                      borderRadius: 20,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: category === c ? "#fff" : colors.foreground },
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Priority
            </Text>
            <View style={styles.priorityRow}>
              {(["low", "medium", "high"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.priorityBtn,
                    {
                      backgroundColor:
                        priority === p ? PRIORITY_CONFIG[p].color : colors.muted,
                      borderRadius: 10,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityBtnText,
                      { color: priority === p ? "#fff" : colors.foreground },
                    ]}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.anonymousRow}>
              <View>
                <Text style={[styles.anonymousLabel, { color: colors.foreground }]}>
                  Submit Anonymously
                </Text>
                <Text style={[styles.anonymousSub, { color: colors.mutedForeground }]}>
                  Your name will be hidden
                </Text>
              </View>
              <Switch
                value={anonymous}
                onValueChange={setAnonymous}
                trackColor={{ true: colors.primary, false: colors.muted }}
              />
            </View>

            <PremiumButton
              title="Submit Problem"
              onPress={handleSubmit}
              loading={submitting}
              style={{ marginTop: 16 }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8, marginTop: 4 },
  chipScroll: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  priorityRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  priorityBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  priorityBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  anonymousRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    padding: 12,
  },
  anonymousLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  anonymousSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
