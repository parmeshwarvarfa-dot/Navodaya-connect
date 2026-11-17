import React, { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type SchoolDirectoryEntry, type SchoolDirectoryPage } from "@/lib/api";

const TABS = [
  { key: "all", label: "All" },
  { key: "student", label: "Students" },
  { key: "teacher", label: "Teachers" },
  { key: "alumni", label: "Alumni" },
  { key: "official", label: "Officials" },
] as const;
const UNASSIGNED_CLASS = "__unassigned__";

function displayClassName(value: string | null) {
  if (!value) return "No class assigned";
  return /^class\s/i.test(value) ? value : `Class ${value}`;
}

const ROLE_META: Record<SchoolDirectoryEntry["role"], { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  student: { label: "Student", color: "#3151E8", bg: "#EEF2FF", icon: "school-outline" },
  teacher: { label: "Teacher", color: "#07875D", bg: "#EAFBF4", icon: "book-outline" },
  alumni: { label: "Alumni", color: "#7C3AED", bg: "#F4F0FF", icon: "ribbon-outline" },
  official: { label: "JNV Official", color: "#B45309", bg: "#FFF7E8", icon: "shield-checkmark-outline" },
};

function verificationLabel(value: string | null) {
  if (value === "verified") return "Verified";
  if (value === "suspended") return "Suspended";
  if (value === "rejected") return "Rejected";
  return "Pending verification";
}

export default function SchoolDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SchoolDirectoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const officialAccountRequired = /registered jnv official account is required/i.test(error);
  const countsAvailable = !!data && !error;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => { setPage(1); }, [role, selectedClass, debouncedQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await api.schoolAdmin.directory({ role, query: debouncedQuery, className: selectedClass ?? undefined, page, pageSize: 20 });
      setData((current) => page === 1 || !current
        ? next
        : { ...next, users: [...current.users, ...next.users] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the JNV directory.");
    } finally {
      setLoading(false);
    }
  }, [role, selectedClass, debouncedQuery, page]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openProfile = (userId: string) => router.push({ pathname: "/(screens)/user-profile", params: { userId } });
  const classPickerVisible = role === "student" && selectedClass === null;
  const selectedClassLabel = selectedClass === UNASSIGNED_CLASS ? "No class assigned" : selectedClass ? displayClassName(selectedClass) : "";
  const visibleClasses = (data?.classes ?? []).filter((item) => displayClassName(item.className).toLowerCase().includes(debouncedQuery.toLowerCase()));

  return <View style={s.page}>
    <View style={[s.header, { paddingTop: Platform.OS === "web" ? 10 : insets.top + 10 }]}>
      <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={21} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>School Directory</Text>
        <Text style={s.subtitle}>People associated with your registered JNV</Text>
      </View>
      <TouchableOpacity onPress={() => void load()} style={s.refresh} accessibilityLabel="Refresh directory">
        <Ionicons name="refresh" size={19} color="#fff" />
      </TouchableOpacity>
    </View>

    <View style={s.searchWrap}>
      <Ionicons name="search-outline" size={19} color="#667085" />
      <TextInput value={query} onChangeText={setQuery} placeholder={classPickerVisible ? "Search classes" : "Search name, class, subject or house"} placeholderTextColor="#98A2B3" style={s.search} returnKeyType="search" accessibilityLabel="Search school directory" />
      {!!query && <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={19} color="#98A2B3" /></TouchableOpacity>}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsRail} contentContainerStyle={s.tabs}>
      {TABS.map((tab) => {
        const selected = role === tab.key;
        const count = !countsAvailable ? "—" : tab.key === "all"
          ? Object.values(data?.counts ?? {}).reduce((sum, value) => sum + value, 0)
          : data?.counts[tab.key] ?? 0;
        return <TouchableOpacity key={tab.key} onPress={() => { setRole(tab.key); setSelectedClass(null); setPage(1); }} style={[s.tab, selected && s.tabSelected]} accessibilityRole="tab" accessibilityState={{ selected }}>
          <Text style={[s.tabText, selected && s.tabTextSelected]}>{tab.label}</Text>
          <Text style={[s.tabCount, selected && s.tabCountSelected]}>{count}</Text>
        </TouchableOpacity>;
      })}
    </ScrollView>

    <View style={s.resultHeading}>
      <Text style={s.resultTitle}>{loading ? "Loading directory…" : error ? "Directory access" : classPickerVisible ? `${visibleClasses.length} classes` : `${data?.total ?? 0} ${role === "student" ? (data?.total === 1 ? "student" : "students") : data?.total === 1 ? "person" : "people"}`}</Text>
      {!!data && <Text style={s.school} numberOfLines={1}>{data.school.jnvName} · {data.school.jnvState}</Text>}
    </View>

    <ScrollView contentContainerStyle={[s.list, { paddingBottom: 28 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      {loading ? <View style={s.state}><ActivityIndicator color="#3151E8" size="large" /><Text style={s.stateText}>Loading school records…</Text></View>
        : error ? <View style={[s.state, s.stateError, officialAccountRequired && s.stateAccessDenied]}>
          <Ionicons name={officialAccountRequired ? "shield-outline" : "cloud-offline-outline"} size={32} color={officialAccountRequired ? "#B7791F" : "#B42318"} />
          <Text style={s.stateTitle}>{officialAccountRequired ? "JNV official account required" : "Directory unavailable"}</Text>
          <Text style={s.stateText}>{officialAccountRequired
            ? "The directory is available to accounts registered with the JNV Official role. It only shows people from that account’s JNV."
            : error}</Text>
          <TouchableOpacity style={s.retry} onPress={() => void load()}><Text style={s.retryText}>Try again</Text></TouchableOpacity>
        </View>
        : classPickerVisible ? visibleClasses.length ? <View style={s.classGrid}>
          {visibleClasses.map((item) => {
            const classKey = item.className ?? UNASSIGNED_CLASS;
            return <TouchableOpacity key={classKey} style={s.classCard} onPress={() => { setSelectedClass(classKey); setPage(1); }} accessibilityRole="button" accessibilityLabel={`View ${item.students} students in ${displayClassName(item.className)}`}>
              <View style={s.classCardTop}>
                <View style={s.classIcon}><Ionicons name="school-outline" size={22} color="#3151E8" /></View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </View>
              <Text style={s.className}>{displayClassName(item.className)}</Text>
              <Text style={s.classStudentCount}>{item.students} {item.students === 1 ? "student" : "students"}</Text>
            </TouchableOpacity>;
          })}
        </View> : <View style={s.state}>
          <Ionicons name="school-outline" size={36} color="#98A2B3" />
          <Text style={s.stateTitle}>{data?.classes.length ? "No matching classes" : "No class-wise student records"}</Text>
          <Text style={s.stateText}>{data?.classes.length ? "Try another class name." : "Students will appear here once their profiles include a class."}</Text>
        </View>
        : <>
          {selectedClass && <View style={s.classBreadcrumb}>
            <TouchableOpacity onPress={() => { setSelectedClass(null); setPage(1); }} style={s.classBack} accessibilityLabel="Back to classes">
              <Ionicons name="arrow-back" size={16} color="#3151E8" /><Text style={s.classBackText}>All classes</Text>
            </TouchableOpacity>
            <Text style={s.classBreadcrumbTitle}>{selectedClassLabel}</Text>
          </View>}
          {!data?.users.length ? <View style={s.state}>
            <Ionicons name="people-outline" size={36} color="#98A2B3" />
            <Text style={s.stateTitle}>No matching people</Text>
            <Text style={s.stateText}>{query ? "Try another search or clear the filter." : "There are no directory records in this category yet."}</Text>
          </View> : <>
            {data.users.map((person) => {
              const meta = ROLE_META[person.role];
              const detail = person.role === "student"
                ? [person.class ? displayClassName(person.class) : null, person.house || null].filter(Boolean).join(" · ")
                : person.role === "teacher"
                  ? [person.designation, person.subject].filter(Boolean).join(" · ")
                  : person.role === "official"
                    ? person.designation || "School official"
                    : person.designation || "Alumni";
              return <TouchableOpacity key={person.id} style={s.personCard} onPress={() => openProfile(person.id)} activeOpacity={0.78}>
                {person.photoURL ? <Image source={{ uri: person.photoURL }} style={s.avatar} /> : <View style={[s.avatar, s.avatarFallback]}><Text style={s.initial}>{person.fullName.slice(0, 1).toUpperCase()}</Text></View>}
                <View style={s.personInfo}>
                  <Text style={s.name} numberOfLines={1}>{person.fullName}</Text>
                  <Text style={s.detail} numberOfLines={1}>{detail || person.jnvName}</Text>
                  <View style={s.badges}>
                    <View style={[s.roleBadge, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={12} color={meta.color} /><Text style={[s.roleText, { color: meta.color }]}>{meta.label}</Text></View>
                    <Text style={[s.verify, person.verificationStatus === "verified" ? s.verifyOk : s.verifyPending]}>{verificationLabel(person.verificationStatus)}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </TouchableOpacity>;
            })}
            {data.total > data.users.length && <TouchableOpacity style={s.more} onPress={() => setPage((current) => current + 1)} accessibilityLabel="Load more directory records">
              {loading ? <ActivityIndicator color="#3151E8" /> : <Text style={s.moreText}>Load more · {data.users.length} of {data.total}</Text>}
            </TouchableOpacity>}
          </>}
        </>}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F3F5FA" },
  header: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 15, paddingBottom: 12, backgroundColor: "#3151E8" },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  refresh: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { color: "rgba(255,255,255,0.82)", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 2 },
  searchWrap: { height: 48, marginHorizontal: 15, marginTop: 14, paddingHorizontal: 13, borderRadius: 13, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E4E7EC", flexDirection: "row", alignItems: "center", gap: 9 },
  search: { flex: 1, minWidth: 0, paddingVertical: 0, color: "#172033", fontSize: 13, fontFamily: "Inter_400Regular", outlineStyle: "none" as any },
  tabsRail: { flexGrow: 0, flexShrink: 0 },
  tabs: { paddingHorizontal: 15, paddingVertical: 8, gap: 8, alignItems: "center" },
  tab: { flexShrink: 0, minHeight: 38, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E4E7EC", flexDirection: "row", alignItems: "center", gap: 7 },
  tabSelected: { backgroundColor: "#3151E8", borderColor: "#3151E8" },
  tabText: { color: "#475467", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabTextSelected: { color: "#fff" },
  tabCount: { minWidth: 18, textAlign: "center", color: "#667085", fontSize: 11, fontFamily: "Inter_700Bold" },
  tabCountSelected: { color: "#DCE4FF" },
  resultHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 17, paddingBottom: 8 },
  resultTitle: { color: "#172033", fontSize: 13, fontFamily: "Inter_700Bold" },
  school: { maxWidth: "58%", color: "#667085", fontSize: 11, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 14, paddingTop: 3, gap: 9 },
  personCard: { minHeight: 80, padding: 12, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EAECF0", flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 45, height: 45, borderRadius: 23, backgroundColor: "#EEF2FF" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: "#3151E8", fontSize: 16, fontFamily: "Inter_700Bold" },
  personInfo: { flex: 1, gap: 3 },
  name: { color: "#172033", fontSize: 14, fontFamily: "Inter_700Bold" },
  detail: { color: "#667085", fontSize: 11, fontFamily: "Inter_400Regular" },
  badges: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9 },
  roleText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  verify: { fontSize: 10, fontFamily: "Inter_500Medium" },
  verifyOk: { color: "#07875D" },
  verifyPending: { color: "#B7791F" },
  state: { minHeight: 190, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 16, padding: 22, gap: 9 },
  stateError: { borderWidth: 1, borderColor: "#FEE4E2" },
  stateAccessDenied: { backgroundColor: "#FFFCF5", borderColor: "#FDE68A" },
  stateTitle: { color: "#172033", fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  stateText: { color: "#667085", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", textAlign: "center" },
  retry: { minHeight: 40, minWidth: 90, borderRadius: 11, backgroundColor: "#3151E8", alignItems: "center", justifyContent: "center", marginTop: 4 },
  retryText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  more: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  moreText: { color: "#667085", fontSize: 11, fontFamily: "Inter_500Medium" },
  classGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  classCard: { flexGrow: 1, flexBasis: "44%", minWidth: 145, minHeight: 118, padding: 13, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EAECF0", justifyContent: "space-between" },
  classCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  classIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  className: { color: "#172033", fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 10 },
  classStudentCount: { color: "#667085", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  classBreadcrumb: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, paddingBottom: 4 },
  classBack: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingRight: 8 },
  classBackText: { color: "#3151E8", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  classBreadcrumbTitle: { color: "#172033", fontSize: 13, fontFamily: "Inter_700Bold" },
});
