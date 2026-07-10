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
  TextInput,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumInput } from "@/components/PremiumInput";
import { PremiumButton } from "@/components/PremiumButton";
import { api } from "@/lib/api";
import type { Job } from "@/lib/api";

const CATEGORIES = ["All", "Tech", "Govt", "Medical", "Finance", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  Tech: "#3B82F6",
  Govt: "#FF7A00",
  Medical: "#EF4444",
  Finance: "#10B981",
  Other: "#8B5CF6",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchJobs = async () => {
    try {
      const data = await api.jobs.list();
      setJobs(data);
    } catch {
      showToast("Failed to load jobs");
    }
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const filtered = jobs.filter((j) => {
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase()) ||
      j.location.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || j.category === activeCategory;
    return matchSearch && matchCat;
  });

  const handlePost = async () => {
    if (!title.trim() || !company.trim()) {
      showToast("Please fill in title and company");
      return;
    }
    setSubmitting(true);
    try {
      await api.jobs.create({
        title: title.trim(),
        company: company.trim(),
        location: location.trim() || "Remote",
        salary: salary.trim() || undefined,
        type: "Full-time",
        category,
        description: description.trim(),
      });
      setShowCreate(false);
      setTitle(""); setCompany(""); setLocation(""); setSalary(""); setDescription(""); setCategory("Other");
      showToast("Job posted!");
      fetchJobs();
    } catch {
      showToast("Failed to post job");
    }
    setSubmitting(false);
  };

  const handleDelete = async (job: Job) => {
    try {
      await api.jobs.remove(job.id);
      setSelectedJob(null);
      showToast("Job removed");
      fetchJobs();
    } catch {
      showToast("Failed to remove job");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Job Opportunities</Text>
            <Text style={styles.headerSub}>Posted by Navodayans</Text>
          </View>
          <TouchableOpacity
            style={[styles.postBtn, { backgroundColor: colors.saffron }]}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.postBtnText}>Post</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: "#fff" }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search role, company, location…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>
      </LinearGradient>

      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setActiveCategory(c)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeCategory === c ? colors.saffron : colors.muted,
                  borderColor: activeCategory === c ? colors.saffron : colors.border,
                },
              ]}
            >
              <Text style={[styles.filterChipText, { color: activeCategory === c ? "#fff" : colors.mutedForeground }]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.saffron} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>
              {filtered.length} openings
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No jobs found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const catColor = CATEGORY_COLORS[item.category] || "#8B5CF6";
            return (
              <TouchableOpacity
                style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedJob(item)}
                activeOpacity={0.8}
              >
                <View style={styles.jobHeader}>
                  <View style={[styles.companyLogo, { backgroundColor: catColor + "18" }]}>
                    <Text style={[styles.companyLogoText, { color: catColor }]}>
                      {item.company.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.jobInfo}>
                    <Text style={[styles.jobTitle, { color: colors.foreground }]}>{item.title}</Text>
                    <Text style={[styles.companyName, { color: colors.primary }]}>{item.company}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.typeBadgeText, { color: colors.mutedForeground }]}>{item.type}</Text>
                  </View>
                </View>

                <View style={styles.jobMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.location}</Text>
                  </View>
                  {item.salary && (
                    <View style={styles.metaItem}>
                      <Ionicons name="cash-outline" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.salary}</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.jobDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={[styles.postedByRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.alumniDot, { backgroundColor: colors.saffron }]} />
                  <Text style={[styles.postedByText, { color: colors.mutedForeground }]}>
                    Posted by <Text style={[styles.postedByName, { color: colors.primary }]}>{item.postedByName}</Text> · {item.postedByJnv}
                  </Text>
                  <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
                </View>

                <View style={[styles.applyBtn, { backgroundColor: colors.saffron }]}>
                  <Text style={styles.applyText}>View Details</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!selectedJob} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setSelectedJob(null)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selectedJob?.title}</Text>
            <TouchableOpacity onPress={() => setSelectedJob(null)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {selectedJob && (
            <ScrollView style={styles.modalContent}>
              <Text style={[styles.companyName, { color: colors.primary, fontSize: 16, marginBottom: 8 }]}>{selectedJob.company}</Text>
              <View style={styles.jobMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{selectedJob.location}</Text>
                </View>
                {selectedJob.salary && (
                  <View style={styles.metaItem}>
                    <Ionicons name="cash-outline" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{selectedJob.salary}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.jobDesc, { color: colors.foreground, marginTop: 16, fontSize: 14, lineHeight: 22 }]}>
                {selectedJob.description || "No further description provided."}
              </Text>
              <Text style={[styles.postedByText, { color: colors.mutedForeground, marginTop: 16 }]}>
                Posted by {selectedJob.postedByName} · {selectedJob.postedByJnv} · {timeAgo(selectedJob.createdAt)}
              </Text>
              {selectedJob.postedBy === profile?.uid ? (
                <PremiumButton
                  title="Remove Posting"
                  variant="outline"
                  onPress={() => handleDelete(selectedJob)}
                  style={{ marginTop: 20 }}
                />
              ) : (
                <PremiumButton
                  title="Reach Out via Chats"
                  onPress={() => { setSelectedJob(null); showToast(`Look for ${selectedJob.postedByName} in Alumni directory to connect`); }}
                  style={{ marginTop: 20 }}
                />
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Post a Job</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <PremiumInput label="Job Title" value={title} onChangeText={setTitle} placeholder="E.g. Software Engineer" icon="briefcase-outline" />
            <PremiumInput label="Company" value={company} onChangeText={setCompany} placeholder="E.g. Google, ISRO, AIIMS" icon="business-outline" />
            <PremiumInput label="Location" value={location} onChangeText={setLocation} placeholder="E.g. Bangalore / Remote" icon="location-outline" />
            <PremiumInput label="Salary (optional)" value={salary} onChangeText={setSalary} placeholder="E.g. ₹12–18 LPA" icon="cash-outline" />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Category</Text>
            <View style={styles.catPickRow}>
              {CATEGORIES.filter((c) => c !== "All").map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.filterChip,
                    { backgroundColor: category === c ? colors.saffron : colors.muted, borderColor: category === c ? colors.saffron : colors.border },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: category === c ? "#fff" : colors.mutedForeground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <PremiumInput
              label="Job Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the role, requirements…"
              multiline
              numberOfLines={4}
              style={{ minHeight: 80, textAlignVertical: "top" }}
              icon="create-outline"
            />
            <PremiumButton title="Post Job" onPress={handlePost} loading={submitting} style={{ marginTop: 8 }} />
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
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  postBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 5 },
  postBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterRow: { paddingVertical: 10, borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  listContent: { padding: 16 },
  countText: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 12 },
  jobCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  jobHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  companyLogo: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  companyLogoText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  companyName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  jobMeta: { flexDirection: "row", gap: 14, marginBottom: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  jobDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 12 },
  postedByRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10, borderTopWidth: 1, marginBottom: 12 },
  alumniDot: { width: 6, height: 6, borderRadius: 3 },
  postedByText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  postedByName: { fontFamily: "Inter_600SemiBold" },
  timeAgo: { fontSize: 11, fontFamily: "Inter_400Regular" },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 8, gap: 6 },
  applyText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8, marginTop: 4 },
  catPickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  toast: {
    position: "absolute", bottom: 100, left: 20, right: 20,
    backgroundColor: "#1A3C6E", borderRadius: 10, padding: 14, alignItems: "center",
  },
  toastText: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
});
