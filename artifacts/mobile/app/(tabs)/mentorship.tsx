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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { AlumniUser, MentorRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";

const CATEGORIES = ["JEE", "NEET", "NDA", "UPSC", "Coding", "Career Guidance"];

export default function MentorshipScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [tab, setTab] = useState<"mentors" | "requests">("mentors");
  const [mentors, setMentors] = useState<AlumniUser[]>([]);
  const [requests, setRequests] = useState<MentorRequest[]>([]);
  const [showRequest, setShowRequest] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("JEE");
  const [message, setMessage] = useState("");
  const [selectedMentor, setSelectedMentor] = useState<AlumniUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchMentors = async () => {
    try {
      const data = await api.users.alumni();
      setMentors(data);
    } catch {}
  };

  const fetchRequests = async () => {
    try {
      const data = await api.mentorRequests.list();
      setRequests(data);
    } catch {}
  };

  useEffect(() => {
    fetchMentors();
    if (profile?.role === "student") fetchRequests();
  }, []);

  const handleRequest = async () => {
    if (!message.trim()) {
      showToast("Please write a message");
      return;
    }
    if (!selectedMentor) return;
    setSubmitting(true);
    try {
      await api.mentorRequests.create({
        mentorId: selectedMentor.id,
        mentorName: selectedMentor.fullName,
        category: selectedCategory,
        message: message.trim(),
      });
      setShowRequest(false);
      setMessage("");
      showToast("Mentorship request sent!");
      fetchRequests();
    } catch {
      showToast("Failed to send request");
    }
    setSubmitting(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <Text style={styles.headerTitle}>Mentorship</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === "mentors" && styles.activeTab]} onPress={() => setTab("mentors")}>
            <Text style={[styles.tabText, tab === "mentors" && styles.activeTabText]}>Mentors</Text>
          </TouchableOpacity>
          {profile?.role === "student" && (
            <TouchableOpacity style={[styles.tab, tab === "requests" && styles.activeTab]} onPress={() => setTab("requests")}>
              <Text style={[styles.tabText, tab === "requests" && styles.activeTabText]}>My Requests</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {tab === "mentors" && (
        <FlatList
          data={mentors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No verified mentors yet</Text>
              <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>Alumni need to get verified first</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PremiumCard style={styles.mentorCard}>
              <View style={styles.mentorRow}>
                <View style={[styles.avatarBg, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {item.fullName?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.mentorInfo}>
                  <Text style={[styles.mentorName, { color: colors.foreground }]}>{item.fullName}</Text>
                  <Text style={[styles.mentorRole, { color: colors.mutedForeground }]}>
                    {item.profession || "Alumni"} {item.company ? `at ${item.company}` : ""}
                  </Text>
                  <Text style={[styles.mentorJNV, { color: colors.mutedForeground }]}>{item.jnvName}</Text>
                </View>
                <View style={[styles.verifiedBadge, { backgroundColor: "#D1FAE5" }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              {item.skills && item.skills.length > 0 && (
                <View style={styles.skillsRow}>
                  {item.skills.slice(0, 3).map((s) => (
                    <View key={s} style={[styles.skillChip, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.skillText, { color: colors.mutedForeground }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
              {profile?.role === "student" && (
                <PremiumButton
                  title="Request Mentorship"
                  onPress={() => { setSelectedMentor(item); setShowRequest(true); }}
                  variant="secondary"
                  style={{ marginTop: 12 }}
                />
              )}
            </PremiumCard>
          )}
        />
      )}

      {tab === "requests" && (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No requests yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PremiumCard style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.categoryText, { color: colors.primary }]}>{item.category}</Text>
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: item.status === "accepted" ? "#D1FAE5" : item.status === "completed" ? "#DBEAFE" : "#F1F5F9",
                }]}>
                  <Text style={[styles.statusText, {
                    color: item.status === "accepted" ? "#059669" : item.status === "completed" ? "#2563EB" : "#64748B",
                  }]}>
                    {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : "Pending"}
                  </Text>
                </View>
              </View>
              <Text style={[styles.requestMsg, { color: colors.foreground }]}>{item.message}</Text>
            </PremiumCard>
          )}
        />
      )}

      <Modal visible={showRequest} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Request Mentorship</Text>
            <TouchableOpacity onPress={() => setShowRequest(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {selectedMentor && (
              <PremiumCard style={{ marginBottom: 16 }}>
                <Text style={[styles.mentorName, { color: colors.foreground }]}>{selectedMentor.fullName}</Text>
                <Text style={[styles.mentorRole, { color: colors.mutedForeground }]}>{selectedMentor.profession}</Text>
              </PremiumCard>
            )}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelectedCategory(c)}
                  style={[styles.chip, { backgroundColor: selectedCategory === c ? colors.primary : colors.muted, borderRadius: 20 }]}
                >
                  <Text style={[styles.chipText, { color: selectedCategory === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PremiumInput
              label="Message to Mentor"
              value={message}
              onChangeText={setMessage}
              placeholder="Describe what help you need..."
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: "top" }}
              icon="create-outline"
            />
            <PremiumButton title="Send Request" onPress={handleRequest} loading={submitting} style={{ marginTop: 8 }} />
          </ScrollView>
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
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 16 },
  tabRow: { flexDirection: "row", gap: 4, marginBottom: 0 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginBottom: 0 },
  activeTab: { backgroundColor: "rgba(255,255,255,0.2)" },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  activeTabText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  listContent: { padding: 16 },
  mentorCard: { marginBottom: 12 },
  mentorRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  avatarBg: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  mentorInfo: { flex: 1 },
  mentorName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  mentorRole: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  mentorJNV: { fontSize: 12, fontFamily: "Inter_400Regular" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 3 },
  verifiedText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#059669" },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  skillText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  requestCard: { marginBottom: 10 },
  requestHeader: { flexDirection: "row", gap: 8, marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  requestMsg: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySubText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
  chipScroll: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
