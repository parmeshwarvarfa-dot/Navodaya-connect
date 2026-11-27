import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  api,
  type TeacherClassAssignment,
  type AcademicStudent,
  type TeacherClassesOverview,
  type ClassDetailOverview,
  type ClassAttendanceRecord,
  type ClassAssessmentRecord,
  type ClassTimetableData,
  type AssignmentWithSubs,
  type StudyMaterial,
  type Announcement,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

type ClassTab =
  | "overview"
  | "students"
  | "attendance"
  | "assignments"
  | "subjects"
  | "materials"
  | "results"
  | "announcements"
  | "timetable";

const TABS: Array<{ key: ClassTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "overview", label: "Overview", icon: "grid-outline" },
  { key: "students", label: "Students", icon: "people-outline" },
  { key: "attendance", label: "Attendance", icon: "calendar-clear-outline" },
  { key: "assignments", label: "Assignments", icon: "checkbox-outline" },
  { key: "subjects", label: "Subjects", icon: "book-outline" },
  { key: "materials", label: "Learning Materials", icon: "document-text-outline" },
  { key: "results", label: "Results & Performance", icon: "stats-chart-outline" },
  { key: "announcements", label: "Announcements", icon: "megaphone-outline" },
  { key: "timetable", label: "Timetable", icon: "time-outline" },
];

interface GroupedClassCard {
  key: string;
  className: string;
  section: string;
  jnvName: string;
  jnvState: string;
  academicYear: string;
  isClassTeacher: boolean;
  assignments: TeacherClassAssignment[];
  subjects: Array<{ id: string; subject: string; periods?: number | null; assignmentType: string }>;
  primaryAssignmentId: string;
}

export default function TeacherClassesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ classId?: string; tab?: string }>();

  // Data states
  const [classes, setClasses] = useState<TeacherClassAssignment[]>([]);
  const [overview, setOverview] = useState<TeacherClassesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "class_teacher" | "subject_teacher">("all");

  // Selected Class View (Class Details Dashboard)
  const [selectedGroup, setSelectedGroup] = useState<GroupedClassCard | null>(null);
  const [activeTab, setActiveTab] = useState<ClassTab>((params.tab as ClassTab) || "overview");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [classList, overviewData] = await Promise.all([
        api.academicClasses.list().catch(() => [] as TeacherClassAssignment[]),
        api.academicClasses.teacherOverview().catch(() => null),
      ]);

      const activeList = classList.filter((c) => c.active);
      setClasses(activeList);
      setOverview(overviewData);

      // If classId passed via URL, select it automatically
      if (params.classId && activeList.length > 0) {
        const found = activeList.find((c) => c.id === params.classId);
        if (found) {
          const grouped: GroupedClassCard = {
            key: `${found.className}__${found.section || "Unspecified"}`,
            className: found.className,
            section: found.section || "Unspecified",
            jnvName: found.jnvName || "JNV",
            jnvState: found.jnvState || "",
            academicYear: found.academicYear || "2026-2027",
            isClassTeacher: found.assignmentType === "class_teacher",
            assignments: [found],
            subjects: [{ id: found.id, subject: found.subject, periods: found.periodsPerWeek, assignmentType: found.assignmentType || "subject_teacher" }],
            primaryAssignmentId: found.id,
          };
          setSelectedGroup(grouped);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Could not load assigned classes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group multiple subjects under the same class & section
  const groupedClasses = useMemo(() => {
    const map = new Map<string, GroupedClassCard>();

    for (const c of classes) {
      const section = c.section || "Unspecified";
      const key = `${c.className}__${section}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          className: c.className,
          section,
          jnvName: c.jnvName || "JNV",
          jnvState: c.jnvState || "",
          academicYear: c.academicYear || "2026-2027",
          isClassTeacher: c.assignmentType === "class_teacher",
          assignments: [c],
          subjects: [{ id: c.id, subject: c.subject, periods: c.periodsPerWeek, assignmentType: c.assignmentType || "subject_teacher" }],
          primaryAssignmentId: c.id,
        });
      } else {
        const existing = map.get(key)!;
        existing.assignments.push(c);
        if (c.assignmentType === "class_teacher") existing.isClassTeacher = true;
        if (!existing.subjects.some((s) => s.subject === c.subject)) {
          existing.subjects.push({
            id: c.id,
            subject: c.subject,
            periods: c.periodsPerWeek,
            assignmentType: c.assignmentType || "subject_teacher",
          });
        }
      }
    }

    return Array.from(map.values());
  }, [classes]);

  // Extract filter options
  const filterOptions = useMemo(() => {
    const years = Array.from(new Set(classes.map((c) => c.academicYear))).filter(Boolean);
    const classNames = Array.from(new Set(classes.map((c) => c.className))).filter(Boolean);
    const subjects = Array.from(new Set(classes.map((c) => c.subject))).filter(Boolean);
    return { years, classNames, subjects };
  }, [classes]);

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return groupedClasses.filter((item) => {
      // Search
      const searchLower = search.toLowerCase().trim();
      const matchSearch =
        !searchLower ||
        item.className.toLowerCase().includes(searchLower) ||
        item.section.toLowerCase().includes(searchLower) ||
        item.subjects.some((s) => s.subject.toLowerCase().includes(searchLower));

      // Filters
      const matchYear = yearFilter === "all" || item.academicYear === yearFilter;
      const matchClass = classFilter === "all" || item.className === classFilter;
      const matchSubject =
        subjectFilter === "all" || item.subjects.some((s) => s.subject === subjectFilter);
      const matchRole =
        roleFilter === "all" ||
        (roleFilter === "class_teacher" && item.isClassTeacher) ||
        (roleFilter === "subject_teacher" && !item.isClassTeacher);

      return matchSearch && matchYear && matchClass && matchSubject && matchRole;
    });
  }, [groupedClasses, search, yearFilter, classFilter, subjectFilter, roleFilter]);

  const isOfficial = profile?.role === "official";

  // -------------------------------------------------------------------------
  // If a class is selected, render the dedicated Class Details Dashboard
  // -------------------------------------------------------------------------
  if (selectedGroup) {
    return (
      <ClassDetailsView
        group={selectedGroup}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onBack={() => setSelectedGroup(null)}
        topPad={topPad}
        insets={insets}
        showToast={showToast}
        toast={toast}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Classes Landing Page
  // -------------------------------------------------------------------------
  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={["#7C3AED", "#6366F1"]} style={[s.header, { paddingTop: topPad + 10 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity
            style={s.headerIconBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={s.headerTextWrap}>
            <Text style={s.headerEyebrow}>TEACHER DASHBOARD · ACADEMICS</Text>
            <Text style={s.headerTitle}>My Classes</Text>
            <Text style={s.headerSubtitle}>Manage your assigned classes, students and academic activities.</Text>
          </View>

          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.headerIconBtn}
              onPress={() => {
                setRefreshing(true);
                loadData();
              }}
              accessibilityRole="button"
              accessibilityLabel="Refresh classes"
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {isOfficial && (
              <TouchableOpacity
                style={s.headerCreateBtn}
                onPress={() => router.push("/(screens)/assign-teachers")}
                accessibilityRole="button"
                accessibilityLabel="Create or allocate classes"
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={s.headerCreateText}>Allocate</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 4 Dynamic Statistics Cards */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={[s.statIconWrap, { backgroundColor: "#F5F3FF" }]}>
              <Ionicons name="school-outline" size={16} color="#7C3AED" />
            </View>
            <Text style={s.statValue}>{loading ? "—" : overview?.totalAssignedClasses ?? groupedClasses.length}</Text>
            <Text style={s.statLabel}>Assigned Classes</Text>
          </View>

          <View style={s.statCard}>
            <View style={[s.statIconWrap, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="people-outline" size={16} color="#059669" />
            </View>
            <Text style={s.statValue}>{loading ? "—" : overview?.totalStudents ?? "—"}</Text>
            <Text style={s.statLabel}>Total Students</Text>
          </View>

          <View style={s.statCard}>
            <View style={[s.statIconWrap, { backgroundColor: "#FFFBEB" }]}>
              <Ionicons name="checkbox-outline" size={16} color="#D97706" />
            </View>
            <Text style={[s.statValue, (overview?.pendingAssignments ?? 0) > 0 && { color: "#D97706" }]}>
              {loading ? "—" : overview?.pendingAssignments ?? 0}
            </Text>
            <Text style={s.statLabel}>Pending Reviews</Text>
          </View>

          <View style={s.statCard}>
            <View style={[s.statIconWrap, { backgroundColor: "#F5F3FF" }]}>
              <Ionicons name="clipboard-outline" size={16} color="#7C3AED" />
            </View>
            <Text style={s.statValue}>{loading ? "—" : overview?.upcomingTests ?? 0}</Text>
            <Text style={s.statLabel}>Upcoming Tests</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Scroll Content */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor="#7C3AED"
          />
        }
      >
        {/* Search & Filter Bar */}
        <View style={s.searchFilterSection}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              placeholder="Search by class, grade or subject..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterPillsRow}>
            {/* Role Filter */}
            {(["all", "class_teacher", "subject_teacher"] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[s.filterPill, roleFilter === r && s.filterPillActive]}
                onPress={() => setRoleFilter(r)}
              >
                <Text style={[s.filterPillText, roleFilter === r && s.filterPillTextActive]}>
                  {r === "all" ? "All Roles" : r === "class_teacher" ? "Class Teacher" : "Subject Teacher"}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Class Name Filter */}
            {filterOptions.classNames.length > 1 && (
              <>
                <View style={s.filterDivider} />
                <TouchableOpacity
                  style={[s.filterPill, classFilter === "all" && s.filterPillActive]}
                  onPress={() => setClassFilter("all")}
                >
                  <Text style={[s.filterPillText, classFilter === "all" && s.filterPillTextActive]}>All Classes</Text>
                </TouchableOpacity>
                {filterOptions.classNames.map((cls) => (
                  <TouchableOpacity
                    key={cls}
                    style={[s.filterPill, classFilter === cls && s.filterPillActive]}
                    onPress={() => setClassFilter(classFilter === cls ? "all" : cls)}
                  >
                    <Text style={[s.filterPillText, classFilter === cls && s.filterPillTextActive]}>{cls}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Subject Filter */}
            {filterOptions.subjects.length > 1 && (
              <>
                <View style={s.filterDivider} />
                {filterOptions.subjects.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    style={[s.filterPill, subjectFilter === sub && s.filterPillActive]}
                    onPress={() => setSubjectFilter(subjectFilter === sub ? "all" : sub)}
                  >
                    <Text style={[s.filterPillText, subjectFilter === sub && s.filterPillTextActive]}>{sub}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </View>

        {/* Error Notice */}
        {!!error && (
          <TouchableOpacity onPress={loadData} style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={s.errorText}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {/* Assigned Classes List */}
        <View style={s.classesSection}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>My Assigned Classes</Text>
              <Text style={s.sectionSubtitle}>
                {filteredClasses.length} {filteredClasses.length === 1 ? "class section" : "class sections"} assigned
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={s.loadingText}>Loading assigned classes & rosters...</Text>
            </View>
          ) : filteredClasses.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="school-outline" size={32} color="#7C3AED" />
              </View>
              <Text style={s.emptyTitle}>
                {search || classFilter !== "all" || subjectFilter !== "all" || roleFilter !== "all"
                  ? "No matching classes found"
                  : "No classes assigned yet"}
              </Text>
              <Text style={s.emptyDesc}>
                {search || classFilter !== "all" || subjectFilter !== "all" || roleFilter !== "all"
                  ? "Try resetting your search query or filter tags above."
                  : "Contact your JNV Principal or Academic In-Charge to assign your classes and subjects."}
              </Text>
              {(search || classFilter !== "all" || subjectFilter !== "all" || roleFilter !== "all") && (
                <TouchableOpacity
                  style={s.resetFilterBtn}
                  onPress={() => {
                    setSearch("");
                    setClassFilter("all");
                    setSubjectFilter("all");
                    setRoleFilter("all");
                  }}
                >
                  <Text style={s.resetFilterBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={s.classList}>
              {filteredClasses.map((item) => (
                <View key={item.key} style={s.classCard}>
                  {/* Card Header */}
                  <View style={s.cardTop}>
                    <View style={s.classIdentity}>
                      <View style={s.classAvatar}>
                        <Ionicons name="school" size={20} color="#7C3AED" />
                      </View>
                      <View>
                        <View style={s.classNameRow}>
                          <Text style={s.className}>{item.className}</Text>
                          {item.section && item.section !== "Unspecified" ? (
                            <View style={s.sectionChip}>
                              <Text style={s.sectionChipText}>Sec {item.section}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={s.schoolName}>{item.jnvName}</Text>
                      </View>
                    </View>

                    {/* Role Badge */}
                    <View
                      style={[
                        s.roleBadge,
                        item.isClassTeacher ? s.roleBadgeClassTeacher : s.roleBadgeSubjectTeacher,
                      ]}
                    >
                      <Ionicons
                        name={item.isClassTeacher ? "star" : "book"}
                        size={12}
                        color={item.isClassTeacher ? "#B45309" : "#6D28D9"}
                      />
                      <Text
                        style={[
                          s.roleBadgeText,
                          item.isClassTeacher ? s.roleBadgeTextClassTeacher : s.roleBadgeTextSubjectTeacher,
                        ]}
                      >
                        {item.isClassTeacher ? "Class Teacher" : "Subject Teacher"}
                      </Text>
                    </View>
                  </View>

                  {/* Subjects & Weekly Periods */}
                  <View style={s.cardSubjectsWrap}>
                    <Text style={s.cardSubjectsLabel}>Allocated Subjects:</Text>
                    <View style={s.subjectsChipsRow}>
                      {item.subjects.map((sObj) => (
                        <View key={sObj.id} style={s.subjectChip}>
                          <Text style={s.subjectChipName}>{sObj.subject}</Text>
                          {sObj.periods ? (
                            <Text style={s.subjectChipPeriods}>{sObj.periods} periods/wk</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Card Footer with CTA */}
                  <View style={s.cardFooter}>
                    <View style={s.cardMetaItem}>
                      <Ionicons name="calendar-outline" size={14} color="#64748B" />
                      <Text style={s.cardMetaText}>{item.academicYear}</Text>
                    </View>

                    <TouchableOpacity
                      style={s.viewDetailsBtn}
                      onPress={() => {
                        setSelectedGroup(item);
                        setActiveTab("overview");
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={s.viewDetailsBtnText}>View Class Details</Text>
                      <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Teaching Tools Action Section */}
        <View style={s.toolsSection}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>Teaching Tools</Text>
              <Text style={s.sectionSubtitle}>Quick access to daily instructional management</Text>
            </View>
          </View>

          <View style={s.toolsGrid}>
            <TouchableOpacity
              style={s.toolCard}
              onPress={() => router.push("/(screens)/teacher-assignments")}
              activeOpacity={0.8}
            >
              <View style={[s.toolIconWrap, { backgroundColor: "#F5F3FF" }]}>
                <Ionicons name="checkbox-outline" size={22} color="#7C3AED" />
              </View>
              <Text style={s.toolCardTitle}>Assignments</Text>
              <Text style={s.toolCardDesc}>Create, evaluate and review student homework</Text>
              <View style={s.toolCardLink}>
                <Text style={[s.toolCardLinkText, { color: "#7C3AED" }]}>Open tool</Text>
                <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.toolCard}
              onPress={() => {
                if (groupedClasses.length > 0) {
                  setSelectedGroup(groupedClasses[0]);
                  setActiveTab("attendance");
                } else {
                  showToast("Please ensure you have an assigned class first.");
                }
              }}
              activeOpacity={0.8}
            >
              <View style={[s.toolIconWrap, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="calendar-clear-outline" size={22} color="#059669" />
              </View>
              <Text style={s.toolCardTitle}>Attendance</Text>
              <Text style={s.toolCardDesc}>Mark daily class rolls and view attendance logs</Text>
              <View style={s.toolCardLink}>
                <Text style={[s.toolCardLinkText, { color: "#059669" }]}>Mark rolls</Text>
                <Ionicons name="chevron-forward" size={14} color="#059669" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.toolCard}
              onPress={() => {
                if (groupedClasses.length > 0) {
                  setSelectedGroup(groupedClasses[0]);
                  setActiveTab("results");
                } else {
                  showToast("Please ensure you have an assigned class first.");
                }
              }}
              activeOpacity={0.8}
            >
              <View style={[s.toolIconWrap, { backgroundColor: "#FFFBEB" }]}>
                <Ionicons name="stats-chart-outline" size={22} color="#D97706" />
              </View>
              <Text style={s.toolCardTitle}>Results</Text>
              <Text style={s.toolCardDesc}>Record marks, unit tests and term performance</Text>
              <View style={s.toolCardLink}>
                <Text style={[s.toolCardLinkText, { color: "#D97706" }]}>Gradebook</Text>
                <Ionicons name="chevron-forward" size={14} color="#D97706" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.toolCard}
              onPress={() => router.push("/(screens)/teacher-upload")}
              activeOpacity={0.8}
            >
              <View style={[s.toolIconWrap, { backgroundColor: "#F5F3FF" }]}>
                <Ionicons name="cloud-upload-outline" size={22} color="#7C3AED" />
              </View>
              <Text style={s.toolCardTitle}>Learning Materials</Text>
              <Text style={s.toolCardDesc}>Upload notes, PDFs, PPTs and study guides</Text>
              <View style={s.toolCardLink}>
                <Text style={[s.toolCardLinkText, { color: "#7C3AED" }]}>Share notes</Text>
                <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity Section */}
        <View style={s.activitySection}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>Recent Activity</Text>
              <Text style={s.sectionSubtitle}>Recent assignments, materials, and class updates</Text>
            </View>
          </View>

          {overview?.recentActivities && overview.recentActivities.length > 0 ? (
            <View style={s.activityList}>
              {overview.recentActivities.map((act) => (
                <View key={act.id} style={s.activityItem}>
                  <View style={[s.activityIconWrap, { backgroundColor: `${act.color}15` }]}>
                    <Ionicons name={act.icon as any} size={18} color={act.color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.activityTitle}>{act.title}</Text>
                    <Text style={s.activityDesc}>{act.description}</Text>
                  </View>
                  <Text style={s.activityTime}>
                    {new Date(act.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={s.emptyActivityCard}>
              <Ionicons name="time-outline" size={24} color="#94A3B8" />
              <Text style={s.emptyActivityText}>No recent academic activity recorded yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Toast */}
      {toast ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ===========================================================================
// Sub-Module: Dedicated Class Details Dashboard (9 Tabs)
// ===========================================================================
interface ClassDetailsViewProps {
  group: GroupedClassCard;
  activeTab: ClassTab;
  setActiveTab: (tab: ClassTab) => void;
  onBack: () => void;
  topPad: number;
  insets: any;
  showToast: (msg: string) => void;
  toast: string;
}

function ClassDetailsView({
  group,
  activeTab,
  setActiveTab,
  onBack,
  topPad,
  insets,
  showToast,
  toast,
}: ClassDetailsViewProps) {
  const [classOverview, setClassOverview] = useState<ClassDetailOverview | null>(null);
  const [students, setStudents] = useState<AcademicStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab specific data
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<ClassAttendanceRecord[]>([]);
  const [attendanceMarks, setAttendanceMarks] = useState<Record<string, "present" | "absent" | "leave">>({});
  const [attendanceRemarks, setAttendanceRemarks] = useState<Record<string, string>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  const [assignments, setAssignments] = useState<AssignmentWithSubs[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [assessments, setAssessments] = useState<ClassAssessmentRecord[]>([]);
  const [timetable, setTimetable] = useState<ClassTimetableData | null>(null);
  const [timetableDay, setTimetableDay] = useState<string>("Monday");

  // Create Assignment Modal
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newAsgTitle, setNewAsgTitle] = useState("");
  const [newAsgSubject, setNewAsgSubject] = useState(group.subjects[0]?.subject || "");
  const [newAsgDueDate, setNewAsgDueDate] = useState("");
  const [newAsgDesc, setNewAsgDesc] = useState("");
  const [submittingAsg, setSubmittingAsg] = useState(false);

  // Create Assessment Modal
  const [showCreateAssessment, setShowCreateAssessment] = useState(false);
  const [newAssTitle, setNewAssTitle] = useState("");
  const [newAssSubject, setNewAssSubject] = useState(group.subjects[0]?.subject || "");
  const [newAssMarks, setNewAssMarks] = useState("50");
  const [newAssDate, setNewAssDate] = useState(new Date().toISOString().split("T")[0]);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [submittingAss, setSubmittingAss] = useState(false);

  // Selected Student Modal
  const [selectedStudent, setSelectedStudent] = useState<AcademicStudent | null>(null);

  const primaryId = group.primaryAssignmentId;

  const loadClassData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, stList, attList, assList, matList, ttList] = await Promise.all([
        api.academicClasses.classOverview(primaryId).catch(() => null),
        api.academicClasses.roster(primaryId).catch(() => [] as AcademicStudent[]),
        api.academicClasses.attendance(primaryId).catch(() => [] as ClassAttendanceRecord[]),
        api.academicClasses.results(primaryId).catch(() => [] as ClassAssessmentRecord[]),
        api.studyMaterials.list().catch(() => [] as StudyMaterial[]),
        api.academicClasses.timetable(primaryId).catch(() => null),
      ]);

      setClassOverview(ov);
      setStudents(stList);
      setAttendanceRecords(attList);
      setAssessments(assList);
      setTimetable(ttList);

      // Pre-fill attendance marks for today if already recorded
      const todayRecord = attList.find((r) => r.date === attendanceDate);
      if (todayRecord) {
        const marksMap: Record<string, "present" | "absent" | "leave"> = {};
        todayRecord.students.forEach((s) => {
          marksMap[s.studentId] = s.status;
        });
        setAttendanceMarks(marksMap);
      } else {
        // Default all to present
        const marksMap: Record<string, "present" | "absent" | "leave"> = {};
        stList.forEach((s) => {
          marksMap[s.id] = "present";
        });
        setAttendanceMarks(marksMap);
      }

      // Filter materials for this class
      setMaterials(
        matList.filter(
          (m) =>
            m.targetClass === group.className ||
            m.targetClass === "Whole School" ||
            group.subjects.some((s) => s.subject === m.subject)
        )
      );

      // Fetch assignments
      const allAsg = await api.assignments.list().catch(() => [] as AssignmentWithSubs[]);
      setAssignments(allAsg.filter((a) => a.targetClass === group.className));
    } catch (err: any) {
      showToast("Unable to load complete class data");
    } finally {
      setLoading(false);
    }
  }, [primaryId, group.className, group.subjects, attendanceDate]);

  useEffect(() => {
    loadClassData();
  }, [loadClassData]);

  // Handle Attendance Save
  const handleSaveAttendance = async () => {
    if (students.length === 0) return showToast("No students registered in this class.");
    setAttendanceSaving(true);
    try {
      const payloadStudents = students.map((s) => ({
        studentId: s.id,
        studentName: s.fullName,
        status: attendanceMarks[s.id] || "present",
        remarks: attendanceRemarks[s.id] || undefined,
      }));

      await api.academicClasses.recordAttendance(primaryId, {
        date: attendanceDate,
        students: payloadStudents,
      });

      showToast("Attendance saved successfully!");
      // Reload attendance records
      const updated = await api.academicClasses.attendance(primaryId);
      setAttendanceRecords(updated);
    } catch (err: any) {
      showToast(err?.message || "Failed to save attendance.");
    } finally {
      setAttendanceSaving(false);
    }
  };

  // Handle Create Assignment
  const handleCreateAssignment = async () => {
    if (!newAsgTitle.trim() || !newAsgDueDate.trim()) {
      return showToast("Please enter title and due date.");
    }
    setSubmittingAsg(true);
    try {
      await api.assignments.create({
        title: newAsgTitle.trim(),
        subject: newAsgSubject,
        targetClass: group.className,
        dueDate: newAsgDueDate.trim(),
        description: newAsgDesc.trim() || undefined,
      });
      showToast("Assignment published!");
      setShowCreateAssignment(false);
      setNewAsgTitle("");
      setNewAsgDesc("");
      const updated = await api.assignments.list();
      setAssignments(updated.filter((a) => a.targetClass === group.className));
    } catch (err: any) {
      showToast(err?.message || "Failed to create assignment.");
    } finally {
      setSubmittingAsg(false);
    }
  };

  // Handle Create Assessment & Save Marks
  const handleSaveAssessment = async () => {
    if (!newAssTitle.trim() || !newAssMarks) {
      return showToast("Please enter assessment title and maximum marks.");
    }
    const totalMarks = Number(newAssMarks);
    if (isNaN(totalMarks) || totalMarks <= 0) return showToast("Enter a valid marks number.");

    setSubmittingAss(true);
    try {
      const scoresPayload = students.map((s) => {
        const raw = scoreInputs[s.id];
        const marksObtained = raw !== undefined && raw.trim() !== "" ? Number(raw) : 0;
        return {
          studentId: s.id,
          studentName: s.fullName,
          marksObtained: Math.min(Math.max(0, marksObtained), totalMarks),
        };
      });

      await api.academicClasses.recordAssessment(primaryId, {
        title: newAssTitle.trim(),
        subject: newAssSubject,
        totalMarks,
        date: newAssDate,
        scores: scoresPayload,
        published: true,
      });

      showToast("Assessment results saved!");
      setShowCreateAssessment(false);
      setNewAssTitle("");
      setScoreInputs({});
      const updated = await api.academicClasses.results(primaryId);
      setAssessments(updated);
    } catch (err: any) {
      showToast(err?.message || "Failed to save assessment.");
    } finally {
      setSubmittingAss(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Header with Class Title & Navigation */}
      <LinearGradient colors={["#7C3AED", "#6366F1"]} style={[s.classHeader, { paddingTop: topPad + 10 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.headerIconBtn} onPress={onBack} accessibilityRole="button">
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={s.headerTitle}>{group.className}</Text>
              {group.section && group.section !== "Unspecified" ? (
                <View style={s.headerSecBadge}>
                  <Text style={s.headerSecText}>Sec {group.section}</Text>
                </View>
              ) : null}
            </View>
            <Text style={s.headerSubtitle}>
              {group.jnvName} · {group.academicYear}
            </Text>
          </View>

          <View
            style={[
              s.roleBadge,
              group.isClassTeacher ? s.roleBadgeClassTeacher : s.roleBadgeSubjectTeacher,
            ]}
          >
            <Text
              style={[
                s.roleBadgeText,
                group.isClassTeacher ? s.roleBadgeTextClassTeacher : s.roleBadgeTextSubjectTeacher,
              ]}
            >
              {group.isClassTeacher ? "Class Teacher" : "Subject Teacher"}
            </Text>
          </View>
        </View>

        {/* 9 Navigation Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsContent}
          style={s.tabsScroll}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabItem, isActive && s.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons name={tab.icon} size={15} color={isActive ? "#FFFFFF" : "rgba(255,255,255,0.7)"} />
                <Text style={[s.tabItemText, isActive && s.tabItemTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* Main Tab Body */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={s.loadingText}>Loading class workspace...</Text>
          </View>
        ) : (
          <>
            {/* ---------------- 1. OVERVIEW TAB ---------------- */}
            {activeTab === "overview" && (
              <View style={s.tabBody}>
                {/* Metrics 4-tile grid */}
                <View style={s.overviewGrid}>
                  <View style={s.overviewTile}>
                    <View style={[s.statIconWrap, { backgroundColor: "#F5F3FF" }]}>
                      <Ionicons name="people" size={16} color="#7C3AED" />
                    </View>
                    <Text style={s.overviewTileVal}>{students.length}</Text>
                    <Text style={s.overviewTileLabel}>Total Students</Text>
                  </View>

                  <View style={s.overviewTile}>
                    <View style={[s.statIconWrap, { backgroundColor: "#ECFDF5" }]}>
                      <Ionicons name="calendar" size={16} color="#059669" />
                    </View>
                    <Text style={s.overviewTileVal}>{classOverview?.todayAttendanceRate ?? 0}%</Text>
                    <Text style={s.overviewTileLabel}>Attendance Rate</Text>
                  </View>

                  <View style={s.overviewTile}>
                    <View style={[s.statIconWrap, { backgroundColor: "#FFFBEB" }]}>
                      <Ionicons name="checkbox" size={16} color="#D97706" />
                    </View>
                    <Text style={s.overviewTileVal}>{assignments.length}</Text>
                    <Text style={s.overviewTileLabel}>Active Assignments</Text>
                  </View>

                  <View style={s.overviewTile}>
                    <View style={[s.statIconWrap, { backgroundColor: "#F5F3FF" }]}>
                      <Ionicons name="stats-chart" size={16} color="#7C3AED" />
                    </View>
                    <Text style={s.overviewTileVal}>
                      {classOverview?.performanceAverage ? `${classOverview.performanceAverage}%` : "—"}
                    </Text>
                    <Text style={s.overviewTileLabel}>Average Performance</Text>
                  </View>
                </View>

                {/* Quick Class Actions */}
                <View style={s.sectionCard}>
                  <Text style={s.cardHeading}>Quick Class Actions</Text>
                  <View style={s.quickActionsRow}>
                    <TouchableOpacity
                      style={s.quickActionBtn}
                      onPress={() => setActiveTab("attendance")}
                    >
                      <Ionicons name="checkmark-done-circle" size={20} color="#059669" />
                      <Text style={s.quickActionBtnText}>Mark Attendance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.quickActionBtn}
                      onPress={() => {
                        setActiveTab("assignments");
                        setShowCreateAssignment(true);
                      }}
                    >
                      <Ionicons name="add-circle" size={20} color="#7C3AED" />
                      <Text style={s.quickActionBtnText}>New Assignment</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.quickActionBtn}
                      onPress={() => router.push("/(screens)/teacher-upload")}
                    >
                      <Ionicons name="cloud-upload" size={20} color="#7C3AED" />
                      <Text style={s.quickActionBtnText}>Upload Notes</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Recent Class Notices */}
                <View style={s.sectionCard}>
                  <View style={s.cardHeaderRow}>
                    <Text style={s.cardHeading}>Recent Announcements</Text>
                    <TouchableOpacity onPress={() => setActiveTab("announcements")}>
                      <Text style={s.seeAllText}>View All</Text>
                    </TouchableOpacity>
                  </View>

                  {classOverview?.announcements && classOverview.announcements.length > 0 ? (
                    classOverview.announcements.map((an) => (
                      <View key={an.id} style={s.announcementRow}>
                        <View style={s.announcementDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.announcementTitle}>{an.title}</Text>
                          <Text style={s.announcementBody} numberOfLines={2}>
                            {an.body}
                          </Text>
                        </View>
                        <Text style={s.announcementDate}>
                          {new Date(an.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={s.emptyNoticeText}>No announcements targeted to this class yet.</Text>
                  )}
                </View>
              </View>
            )}

            {/* ---------------- 2. STUDENTS TAB ---------------- */}
            {activeTab === "students" && (
              <View style={s.tabBody}>
                <View style={s.tabHeaderBox}>
                  <Text style={s.tabHeaderTitle}>Student Roster ({students.length})</Text>
                  <Text style={s.tabHeaderSubtitle}>Authorized student roll for {group.className}</Text>
                </View>

                {students.length === 0 ? (
                  <View style={s.emptyCard}>
                    <Ionicons name="people-outline" size={32} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No students enrolled</Text>
                    <Text style={s.emptyDesc}>No students with matching class and section in database.</Text>
                  </View>
                ) : (
                  <View style={s.studentList}>
                    {students.map((student, idx) => (
                      <TouchableOpacity
                        key={student.id}
                        style={s.studentCard}
                        onPress={() => setSelectedStudent(student)}
                        activeOpacity={0.7}
                      >
                        <View style={s.studentIndexWrap}>
                          <Text style={s.studentIndexText}>#{idx + 1}</Text>
                        </View>

                        {student.photoURL || student.uploadedPhotoURL ? (
                          <Image
                            source={{ uri: student.uploadedPhotoURL || student.photoURL || "" }}
                            style={s.studentAvatar}
                          />
                        ) : (
                          <View style={s.studentAvatarPlaceholder}>
                            <Text style={s.avatarInitial}>{student.fullName[0]?.toUpperCase()}</Text>
                          </View>
                        )}

                        <View style={{ flex: 1 }}>
                          <Text style={s.studentName}>{student.fullName}</Text>
                          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 2 }}>
                            {student.house ? (
                              <View style={s.houseChip}>
                                <Text style={s.houseChipText}>{student.house}</Text>
                              </View>
                            ) : null}
                            <Text style={s.studentRollMeta}>{student.class || group.className}</Text>
                          </View>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ---------------- 3. ATTENDANCE TAB ---------------- */}
            {activeTab === "attendance" && (
              <View style={s.tabBody}>
                {/* Date Bar & Shortcuts */}
                <View style={s.attendanceHeaderBar}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="calendar-outline" size={20} color="#7C3AED" />
                    <Text style={s.attendanceDateText}>Date: {attendanceDate}</Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={s.quickMarkBtn}
                      onPress={() => {
                        const allPresent: Record<string, "present" | "absent" | "leave"> = {};
                        students.forEach((s) => (allPresent[s.id] = "present"));
                        setAttendanceMarks(allPresent);
                      }}
                    >
                      <Text style={s.quickMarkBtnText}>All Present</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Roll marking cards */}
                <View style={s.attendanceList}>
                  {students.map((student) => {
                    const status = attendanceMarks[student.id] || "present";
                    return (
                      <View key={student.id} style={s.attendanceRowCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.attendanceStudentName}>{student.fullName}</Text>
                          <Text style={s.attendanceStudentClass}>{student.class || group.className}</Text>
                        </View>

                        <View style={s.attendanceStatusButtons}>
                          <TouchableOpacity
                            style={[s.statusToggleBtn, status === "present" && s.statusBtnPresent]}
                            onPress={() =>
                              setAttendanceMarks((prev) => ({ ...prev, [student.id]: "present" }))
                            }
                          >
                            <Text
                              style={[
                                s.statusToggleText,
                                status === "present" && s.statusTextActive,
                              ]}
                            >
                              Present
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[s.statusToggleBtn, status === "absent" && s.statusBtnAbsent]}
                            onPress={() =>
                              setAttendanceMarks((prev) => ({ ...prev, [student.id]: "absent" }))
                            }
                          >
                            <Text
                              style={[
                                s.statusToggleText,
                                status === "absent" && s.statusTextActive,
                              ]}
                            >
                              Absent
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[s.statusToggleBtn, status === "leave" && s.statusBtnLeave]}
                            onPress={() =>
                              setAttendanceMarks((prev) => ({ ...prev, [student.id]: "leave" }))
                            }
                          >
                            <Text
                              style={[
                                s.statusToggleText,
                                status === "leave" && s.statusTextActive,
                              ]}
                            >
                              Leave
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Save Attendance CTA */}
                <TouchableOpacity
                  style={s.saveAttendanceBtn}
                  onPress={handleSaveAttendance}
                  disabled={attendanceSaving}
                >
                  {attendanceSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                      <Text style={s.saveAttendanceBtnText}>Save Attendance Roster</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Attendance History */}
                {attendanceRecords.length > 0 && (
                  <View style={[s.sectionCard, { marginTop: 14 }]}>
                    <Text style={s.cardHeading}>Attendance Log History</Text>
                    {attendanceRecords.slice(0, 5).map((rec) => {
                      const present = rec.students.filter((s) => s.status === "present").length;
                      const pct = rec.students.length > 0 ? Math.round((present / rec.students.length) * 100) : 0;
                      return (
                        <View key={rec.id} style={s.historyRow}>
                          <View>
                            <Text style={s.historyDate}>{rec.date}</Text>
                            <Text style={s.historyMeta}>
                              By {rec.markedByName} · {present}/{rec.students.length} present
                            </Text>
                          </View>
                          <View style={s.historyPctBadge}>
                            <Text style={s.historyPctText}>{pct}%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ---------------- 4. ASSIGNMENTS TAB ---------------- */}
            {activeTab === "assignments" && (
              <View style={s.tabBody}>
                <View style={s.tabHeaderBoxRow}>
                  <View>
                    <Text style={s.tabHeaderTitle}>Class Assignments</Text>
                    <Text style={s.tabHeaderSubtitle}>Homework & coursework for {group.className}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.createTabBtn}
                    onPress={() => setShowCreateAssignment(true)}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.createTabBtnText}>New</Text>
                  </TouchableOpacity>
                </View>

                {assignments.length === 0 ? (
                  <View style={s.emptyCard}>
                    <Ionicons name="checkbox-outline" size={32} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No assignments created</Text>
                    <Text style={s.emptyDesc}>Tap "+ New" above to publish homework for this class.</Text>
                  </View>
                ) : (
                  <View style={s.assignmentList}>
                    {assignments.map((asg) => {
                      const submitted = asg.submissions?.length || 0;
                      return (
                        <View key={asg.id} style={s.asgCard}>
                          <View style={s.asgCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.asgTitle}>{asg.title}</Text>
                              <Text style={s.asgSubject}>{asg.subject} · Due: {asg.dueDate}</Text>
                            </View>
                            <View style={s.asgSubsChip}>
                              <Text style={s.asgSubsText}>{submitted} submissions</Text>
                            </View>
                          </View>

                          {asg.description ? (
                            <Text style={s.asgDesc} numberOfLines={2}>
                              {asg.description}
                            </Text>
                          ) : null}

                          <View style={s.asgCardFooter}>
                            <Text style={s.asgAuthor}>Assigned by {asg.authorName || "Faculty"}</Text>
                            <TouchableOpacity
                              style={s.reviewSubsBtn}
                              onPress={() => router.push("/(screens)/teacher-assignments")}
                            >
                              <Text style={s.reviewSubsText}>Evaluate</Text>
                              <Ionicons name="arrow-forward" size={13} color="#7C3AED" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ---------------- 5. SUBJECTS TAB ---------------- */}
            {activeTab === "subjects" && (
              <View style={s.tabBody}>
                <View style={s.tabHeaderBox}>
                  <Text style={s.tabHeaderTitle}>Class Subjects & Quota</Text>
                  <Text style={s.tabHeaderSubtitle}>Subjects assigned in {group.className}</Text>
                </View>

                <View style={s.subjectCardList}>
                  {group.subjects.map((sub) => (
                    <View key={sub.id} style={s.subjectDetailedCard}>
                      <View style={s.subjectDetailedIconWrap}>
                        <Ionicons name="book" size={20} color="#7C3AED" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.subjectDetailedTitle}>{sub.subject}</Text>
                        <Text style={s.subjectDetailedMeta}>
                          {sub.periods ? `${sub.periods} teaching periods / week` : "Standard weekly allocation"}
                        </Text>
                      </View>
                      <View style={s.subjectDetailedBadge}>
                        <Text style={s.subjectDetailedBadgeText}>
                          {sub.assignmentType === "class_teacher" ? "Class Teacher" : "Subject Teacher"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ---------------- 6. LEARNING MATERIALS TAB ---------------- */}
            {activeTab === "materials" && (
              <View style={s.tabBody}>
                <View style={s.tabHeaderBoxRow}>
                  <View>
                    <Text style={s.tabHeaderTitle}>Learning Materials</Text>
                    <Text style={s.tabHeaderSubtitle}>PDFs, lecture notes & resources</Text>
                  </View>
                  <TouchableOpacity
                    style={s.createTabBtn}
                    onPress={() => router.push("/(screens)/teacher-upload")}
                  >
                    <Ionicons name="cloud-upload" size={16} color="#FFFFFF" />
                    <Text style={s.createTabBtnText}>Upload</Text>
                  </TouchableOpacity>
                </View>

                {materials.length === 0 ? (
                  <View style={s.emptyCard}>
                    <Ionicons name="document-text-outline" size={32} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No study notes uploaded</Text>
                    <Text style={s.emptyDesc}>Upload PDFs, chapter summaries, or assignments for students.</Text>
                  </View>
                ) : (
                  <View style={s.materialList}>
                    {materials.map((mat) => (
                      <View key={mat.id} style={s.materialCard}>
                        <View style={s.materialIconWrap}>
                          <Ionicons
                            name={
                              mat.type === "PDF"
                                ? "document-text"
                                : mat.type === "Slides"
                                ? "easel"
                                : "folder"
                            }
                            size={20}
                            color="#7C3AED"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.materialTitle}>{mat.title}</Text>
                          <Text style={s.materialMeta}>
                            {mat.subject} · {mat.type} · By {mat.authorName}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={s.downloadBtn}
                          onPress={() => router.push("/(screens)/study-notes")}
                        >
                          <Ionicons name="open-outline" size={16} color="#7C3AED" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ---------------- 7. RESULTS & PERFORMANCE TAB ---------------- */}
            {activeTab === "results" && (
              <View style={s.tabBody}>
                <View style={s.tabHeaderBoxRow}>
                  <View>
                    <Text style={s.tabHeaderTitle}>Assessments & Marks</Text>
                    <Text style={s.tabHeaderSubtitle}>Unit tests, term marks & gradebook</Text>
                  </View>
                  <TouchableOpacity
                    style={s.createTabBtn}
                    onPress={() => setShowCreateAssessment(true)}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.createTabBtnText}>New Test</Text>
                  </TouchableOpacity>
                </View>

                {assessments.length === 0 ? (
                  <View style={s.emptyCard}>
                    <Ionicons name="stats-chart-outline" size={32} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No examination records</Text>
                    <Text style={s.emptyDesc}>Tap "+ New Test" to record marks for this class.</Text>
                  </View>
                ) : (
                  <View style={s.assessmentList}>
                    {assessments.map((ass) => (
                      <View key={ass.id} style={s.assessmentCard}>
                        <View style={s.assessmentCardHeader}>
                          <View>
                            <Text style={s.assessmentTitle}>{ass.title}</Text>
                            <Text style={s.assessmentMeta}>
                              {ass.subject} · Total Marks: {ass.totalMarks} · Date: {ass.date}
                            </Text>
                          </View>
                          <View style={s.publishedChip}>
                            <Text style={s.publishedChipText}>Published</Text>
                          </View>
                        </View>

                        {/* Top Scorers Preview */}
                        <View style={s.scoresTable}>
                          <Text style={s.scoresTableHeading}>Student Scores Recorded ({ass.scores.length})</Text>
                          {ass.scores.slice(0, 5).map((score) => (
                            <View key={score.studentId} style={s.scoreRow}>
                              <Text style={s.scoreStudentName}>{score.studentName}</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Text style={s.scoreMarksText}>
                                  {score.marksObtained}/{ass.totalMarks}
                                </Text>
                                <View style={s.gradePill}>
                                  <Text style={s.gradePillText}>{score.grade || "A"}</Text>
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ---------------- 8. ANNOUNCEMENTS TAB ---------------- */}
            {activeTab === "announcements" && (
              <View style={s.tabBody}>
                <View style={s.tabHeaderBoxRow}>
                  <View>
                    <Text style={s.tabHeaderTitle}>Class Announcements</Text>
                    <Text style={s.tabHeaderSubtitle}>Notices published to this class</Text>
                  </View>
                  <TouchableOpacity
                    style={s.createTabBtn}
                    onPress={() => router.push("/(screens)/teacher-announcements")}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.createTabBtnText}>New</Text>
                  </TouchableOpacity>
                </View>

                {classOverview?.announcements && classOverview.announcements.length > 0 ? (
                  classOverview.announcements.map((an) => (
                    <View key={an.id} style={s.asgCard}>
                      <View style={s.asgCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.asgTitle}>{an.title}</Text>
                          <Text style={s.asgSubject}>Target: {an.target} · Priority: {an.priority}</Text>
                        </View>
                        {an.pinned && (
                          <View style={s.pinnedChip}>
                            <Ionicons name="pin" size={12} color="#D97706" />
                            <Text style={s.pinnedText}>Pinned</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.asgDesc}>{an.body}</Text>
                      <Text style={s.asgAuthor}>
                        Posted on{" "}
                        {new Date(an.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={s.emptyCard}>
                    <Ionicons name="megaphone-outline" size={32} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No announcements yet</Text>
                    <Text style={s.emptyDesc}>Broadcast exam notices or daily classroom instructions.</Text>
                  </View>
                )}
              </View>
            )}

            {/* ---------------- 9. TIMETABLE TAB ---------------- */}
            {activeTab === "timetable" && (
              <View style={s.tabBody}>
                <View style={s.tabHeaderBox}>
                  <Text style={s.tabHeaderTitle}>Weekly Timetable</Text>
                  <Text style={s.tabHeaderSubtitle}>Standard JNV schedule & classroom periods</Text>
                </View>

                {/* Day Selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayPillsRow}>
                  {(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[s.dayPill, timetableDay === day && s.dayPillActive]}
                      onPress={() => setTimetableDay(day)}
                    >
                      <Text style={[s.dayPillText, timetableDay === day && s.dayPillTextActive]}>{day}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Slots List */}
                <View style={s.timetableSlotsList}>
                  {(timetable?.schedule?.[timetableDay as keyof typeof timetable.schedule] || []).map((slot) => {
                    const isMySubject = group.subjects.some((s) => s.subject === slot.subject);
                    return (
                      <View key={slot.period} style={[s.timetableSlotCard, isMySubject && s.timetableSlotCardMine]}>
                        <View style={s.periodNumberBadge}>
                          <Text style={s.periodNumberText}>P{slot.period}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={s.slotSubject}>{slot.subject}</Text>
                            {isMySubject && (
                              <View style={s.mySubjectTag}>
                                <Text style={s.mySubjectTagText}>My Class</Text>
                              </View>
                            )}
                          </View>
                          <Text style={s.slotTime}>
                            {slot.time} · {slot.room || "Room 101"}
                          </Text>
                        </View>
                        <Text style={s.slotTeacher}>{slot.teacherName}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal: Create Assignment */}
      <Modal visible={showCreateAssignment} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Class Assignment</Text>
              <TouchableOpacity onPress={() => setShowCreateAssignment(false)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View>
                <Text style={s.inputLabel}>Assignment Title *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. Chapter 4 - Thermodynamics Practice"
                  value={newAsgTitle}
                  onChangeText={setNewAsgTitle}
                />
              </View>

              <View>
                <Text style={s.inputLabel}>Subject</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {group.subjects.map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[s.filterPill, newAsgSubject === sub.subject && s.filterPillActive]}
                      onPress={() => setNewAsgSubject(sub.subject)}
                    >
                      <Text style={[s.filterPillText, newAsgSubject === sub.subject && s.filterPillTextActive]}>
                        {sub.subject}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View>
                <Text style={s.inputLabel}>Due Date *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="DD-MM-YYYY HH:mm (e.g. 15-11-2026 17:00)"
                  value={newAsgDueDate}
                  onChangeText={setNewAsgDueDate}
                />
              </View>

              <View>
                <Text style={s.inputLabel}>Instructions / Description (Optional)</Text>
                <TextInput
                  style={[s.textInput, { minHeight: 80 }]}
                  multiline
                  placeholder="Enter questions or guidelines for students..."
                  value={newAsgDesc}
                  onChangeText={setNewAsgDesc}
                />
              </View>

              <TouchableOpacity
                style={s.modalPrimaryBtn}
                onPress={handleCreateAssignment}
                disabled={submittingAsg}
              >
                {submittingAsg ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.modalPrimaryBtnText}>Publish Assignment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Create Assessment & Enter Marks */}
      <Modal visible={showCreateAssessment} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { maxHeight: "90%" }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Assessment & Enter Marks</Text>
              <TouchableOpacity onPress={() => setShowCreateAssessment(false)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View>
                <Text style={s.inputLabel}>Assessment Title *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. Periodic Test 1 / Unit Assessment"
                  value={newAssTitle}
                  onChangeText={setNewAssTitle}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Max Marks *</Text>
                  <TextInput
                    style={s.textInput}
                    keyboardType="numeric"
                    value={newAssMarks}
                    onChangeText={setNewAssMarks}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Date</Text>
                  <TextInput style={s.textInput} value={newAssDate} onChangeText={setNewAssDate} />
                </View>
              </View>

              <Text style={[s.inputLabel, { marginTop: 6 }]}>Student Marks Entry</Text>
              <View style={{ gap: 8 }}>
                {students.map((student) => (
                  <View key={student.id} style={s.scoreInputRow}>
                    <Text style={s.scoreInputName}>{student.fullName}</Text>
                    <TextInput
                      style={s.scoreInputBox}
                      placeholder="0"
                      keyboardType="numeric"
                      value={scoreInputs[student.id] || ""}
                      onChangeText={(val) => setScoreInputs((prev) => ({ ...prev, [student.id]: val }))}
                    />
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={s.modalPrimaryBtn}
                onPress={handleSaveAssessment}
                disabled={submittingAss}
              >
                {submittingAss ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.modalPrimaryBtnText}>Save Assessment Results</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Student Profile Details */}
      <Modal visible={!!selectedStudent} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Student Profile</Text>
              <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {selectedStudent && (
              <View style={{ gap: 14, alignItems: "center", paddingVertical: 10 }}>
                {selectedStudent.photoURL || selectedStudent.uploadedPhotoURL ? (
                  <Image
                    source={{ uri: selectedStudent.uploadedPhotoURL || selectedStudent.photoURL || "" }}
                    style={{ width: 72, height: 72, borderRadius: 36 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: "#F5F3FF",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 26, fontFamily: "Inter_700Bold", color: "#7C3AED" }}>
                      {selectedStudent.fullName[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" }}>
                    {selectedStudent.fullName}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#64748B", fontFamily: "Inter_400Regular" }}>
                    {selectedStudent.class || group.className}
                  </Text>
                </View>

                <View style={s.profileDetailsBox}>
                  <View style={s.profileDetailRow}>
                    <Text style={s.profileDetailLabel}>House:</Text>
                    <Text style={s.profileDetailValue}>{selectedStudent.house || "Unassigned"}</Text>
                  </View>
                  <View style={s.profileDetailRow}>
                    <Text style={s.profileDetailLabel}>JNV:</Text>
                    <Text style={s.profileDetailValue}>{group.jnvName}</Text>
                  </View>
                  <View style={s.profileDetailRow}>
                    <Text style={s.profileDetailLabel}>Enrollment:</Text>
                    <Text style={s.profileDetailValue}>{selectedStudent.enrollYear || group.academicYear}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.modalPrimaryBtn, { width: "100%" }]}
                  onPress={() => setSelectedStudent(null)}
                >
                  <Text style={s.modalPrimaryBtnText}>Close Profile</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Floating Toast */}
      {toast ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ===========================================================================
// Stylesheet
// ===========================================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  classHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerEyebrow: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 9.5,
    letterSpacing: 1.2,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  headerSecBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  headerSecText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.24)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  headerCreateText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 9.5,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
  tabsScroll: {
    marginTop: 10,
  },
  tabsContent: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 6,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  tabItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  tabItemText: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  tabItemTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  searchFilterSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  filterPillText: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
    color: "#475569",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  classesSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  sectionSubtitle: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  emptyIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  emptyDesc: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  resetFilterBtn: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
  },
  resetFilterBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  classList: {
    gap: 12,
  },
  classCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1.5,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  classIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  classAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  classNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  className: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  sectionChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectionChipText: {
    color: "#475569",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  schoolName: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  roleBadgeClassTeacher: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  roleBadgeSubjectTeacher: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontFamily: "Inter_600SemiBold",
  },
  roleBadgeTextClassTeacher: {
    color: "#B45309",
  },
  roleBadgeTextSubjectTeacher: {
    color: "#6D28D9",
  },
  cardSubjectsWrap: {
    gap: 6,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
  },
  cardSubjectsLabel: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  subjectsChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  subjectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  subjectChipName: {
    color: "#0F172A",
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  subjectChipPeriods: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardMetaText: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  viewDetailsBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  toolsSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  toolCard: {
    width: "48.2%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  toolIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  toolCardTitle: {
    color: "#0F172A",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
  toolCardDesc: {
    color: "#64748B",
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: "Inter_400Regular",
  },
  toolCardLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  toolCardLinkText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  activitySection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  activityList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  activityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: {
    color: "#0F172A",
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  activityDesc: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  activityTime: {
    color: "#94A3B8",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  emptyActivityCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyActivityText: {
    color: "#94A3B8",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  // Tab Body Styles
  tabBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  overviewTile: {
    width: "48.2%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    gap: 4,
  },
  overviewTileVal: {
    color: "#0F172A",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  overviewTileLabel: {
    color: "#64748B",
    fontSize: 10.5,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  cardHeading: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seeAllText: {
    color: "#7C3AED",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickActionBtnText: {
    color: "#0F172A",
    fontSize: 10.5,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  announcementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  announcementDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7C3AED",
    marginTop: 6,
  },
  announcementTitle: {
    color: "#0F172A",
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  announcementBody: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  announcementDate: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
  },
  emptyNoticeText: {
    color: "#94A3B8",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  tabHeaderBox: {
    gap: 2,
    marginBottom: 4,
  },
  tabHeaderBoxRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  tabHeaderTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  tabHeaderSubtitle: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
  },
  createTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  createTabBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  studentList: {
    gap: 8,
  },
  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  studentIndexWrap: {
    width: 24,
  },
  studentIndexText: {
    color: "#94A3B8",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F3FF",
  },
  studentAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#7C3AED",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  studentName: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  houseChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  houseChipText: {
    color: "#475569",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  studentRollMeta: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  // Attendance Tab
  attendanceHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  attendanceDateText: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  quickMarkBtn: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  quickMarkBtnText: {
    color: "#059669",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  attendanceList: {
    gap: 8,
  },
  attendanceRowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  attendanceStudentName: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  attendanceStudentClass: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  attendanceStatusButtons: {
    flexDirection: "row",
    gap: 4,
  },
  statusToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusBtnPresent: {
    backgroundColor: "#10B981",
  },
  statusBtnAbsent: {
    backgroundColor: "#EF4444",
  },
  statusBtnLeave: {
    backgroundColor: "#F59E0B",
  },
  statusToggleText: {
    fontSize: 10.5,
    fontFamily: "Inter_500Medium",
    color: "#475569",
  },
  statusTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  saveAttendanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  saveAttendanceBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  historyDate: {
    color: "#0F172A",
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  historyMeta: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  historyPctBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyPctText: {
    color: "#059669",
    fontSize: 11.5,
    fontFamily: "Inter_700Bold",
  },
  // Assignment Tab
  assignmentList: {
    gap: 10,
  },
  asgCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  asgCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  asgTitle: {
    color: "#0F172A",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
  asgSubject: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  asgSubsChip: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  asgSubsText: {
    color: "#7C3AED",
    fontSize: 10.5,
    fontFamily: "Inter_600SemiBold",
  },
  asgDesc: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
  },
  asgCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
    marginTop: 4,
  },
  asgAuthor: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
  },
  reviewSubsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reviewSubsText: {
    color: "#7C3AED",
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  // Subjects Tab
  subjectCardList: {
    gap: 10,
  },
  subjectDetailedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  subjectDetailedIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  subjectDetailedTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  subjectDetailedMeta: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
  },
  subjectDetailedBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  subjectDetailedBadgeText: {
    color: "#475569",
    fontSize: 10.5,
    fontFamily: "Inter_600SemiBold",
  },
  // Learning Materials Tab
  materialList: {
    gap: 8,
  },
  materialCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  materialIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  materialTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  materialMeta: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  downloadBtn: {
    padding: 6,
  },
  // Results & Assessments Tab
  assessmentList: {
    gap: 12,
  },
  assessmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  assessmentCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  assessmentTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  assessmentMeta: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  publishedChip: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  publishedChipText: {
    color: "#059669",
    fontSize: 10.5,
    fontFamily: "Inter_600SemiBold",
  },
  scoresTable: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
    gap: 6,
  },
  scoresTableHeading: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  scoreStudentName: {
    color: "#0F172A",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  scoreMarksText: {
    color: "#334155",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  gradePill: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  gradePillText: {
    color: "#7C3AED",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  pinnedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pinnedText: {
    color: "#B45309",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  // Timetable Tab
  dayPillsRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dayPillActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  dayPillText: {
    color: "#475569",
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
  },
  dayPillTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },
  timetableSlotsList: {
    gap: 8,
  },
  timetableSlotCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  timetableSlotCardMine: {
    borderColor: "#C7D2FE",
    backgroundColor: "#F8FAFF",
  },
  periodNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  periodNumberText: {
    color: "#1E293B",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  slotSubject: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  mySubjectTag: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  mySubjectTagText: {
    color: "#7C3AED",
    fontSize: 9.5,
    fontFamily: "Inter_600SemiBold",
  },
  slotTime: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  slotTeacher: {
    color: "#475569",
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  inputLabel: {
    color: "#334155",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
  },
  modalPrimaryBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  modalPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  scoreInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  scoreInputName: {
    color: "#0F172A",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  scoreInputBox: {
    width: 60,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
    textAlign: "center",
  },
  profileDetailsBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  profileDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  profileDetailLabel: {
    color: "#64748B",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  profileDetailValue: {
    color: "#0F172A",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  toast: {
    position: "absolute",
    bottom: 32,
    left: 20,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  toastText: {
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
