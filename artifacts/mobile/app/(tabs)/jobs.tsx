import React, { useState } from "react";
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
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumInput } from "@/components/PremiumInput";
import { PremiumButton } from "@/components/PremiumButton";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  type: "Full-time" | "Part-time" | "Remote" | "Internship" | "Contract";
  category: string;
  postedBy: string;
  postedByJnv: string;
  description: string;
  createdAt: string;
}

const MOCK_JOBS: Job[] = [
  {
    id: "1", title: "Software Engineer", company: "Flipkart", location: "Bangalore",
    salary: "₹18–24 LPA", type: "Full-time", category: "Tech",
    postedBy: "Arjun Sharma", postedByJnv: "JNV Lucknow '14",
    description: "Looking for passionate engineers to join our Core Platform team. B.Tech from any top college preferred.",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "2", title: "Data Analyst", company: "Razorpay", location: "Remote",
    salary: "₹10–16 LPA", type: "Remote", category: "Tech",
    postedBy: "Vikram Singh", postedByJnv: "JNV Patna '16",
    description: "We need a sharp data analyst to help decode our payment data. Experience with SQL and Python required.",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "3", title: "IAS Coaching Faculty", company: "Vajiram & Ravi", location: "Delhi",
    salary: "₹8–12 LPA", type: "Full-time", category: "Govt",
    postedBy: "Neha Gupta", postedByJnv: "JNV Agra '11",
    description: "Subject matter expert needed for GS Paper 2. Prior teaching experience preferred.",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "4", title: "Medical Officer", company: "AIIMS Bhopal", location: "Bhopal",
    salary: "₹12–18 LPA", type: "Full-time", category: "Medical",
    postedBy: "Dr. Priya Nair", postedByJnv: "JNV Kochi '09",
    description: "Recruiting MBBS/MD doctors for the Emergency Department. Government accommodation provided.",
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "5", title: "Product Manager Intern", company: "Swiggy", location: "Bangalore",
    salary: "₹40K/month", type: "Internship", category: "Tech",
    postedBy: "Rohan Mishra", postedByJnv: "JNV Jabalpur '13",
    description: "6-month PM internship. Work on core food delivery experience. MBA students preferred.",
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

const CATEGORIES = ["All", "Tech", "Govt", "Medical", "Finance", "Other"];
const JOB_TYPES = ["All Types", "Full-time", "Remote", "Internship", "Contract"];

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
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = jobs.filter((j) => {
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase()) ||
      j.location.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || j.category === activeCategory;
    return matchSearch && matchCat;
  });

  const handlePost = () => {
    if (!title.trim() || !company.trim()) {
      Alert.alert("Error", "Please fill in title and company");
      return;
    }
    const newJob: Job = {
      id: Date.now().toString(),
      title: title.trim(),
      company: company.trim(),
      location: location.trim() || "Remote",
      salary: salary.trim() || undefined,
      type: "Full-time",
      category: "Other",
      postedBy: profile?.fullName || "Navodayan",
      postedByJnv: profile?.jnvName ? `${profile.jnvName}` : "JNV",
      description: description.trim(),
      createdAt: new Date().toISOString(),
    };
    setJobs([newJob, ...jobs]);
    setShowCreate(false);
    setTitle(""); setCompany(""); setLocation(""); setSalary(""); setDescription("");
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
            <View style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                  Posted by <Text style={[styles.postedByName, { color: colors.primary }]}>{item.postedBy}</Text> · {item.postedByJnv}
                </Text>
                <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
              </View>

              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.saffron }]}>
                <Text style={styles.applyText}>Apply Now</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          );
        }}
      />

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
            <PremiumButton title="Post Job" onPress={handlePost} style={{ marginTop: 8 }} />
          </ScrollView>
        </View>
      </Modal>
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
});
