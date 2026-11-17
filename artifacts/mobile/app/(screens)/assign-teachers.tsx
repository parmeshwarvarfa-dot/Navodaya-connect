import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  api,
  type AcademicAssignmentType,
  type AcademicManagementOverview,
  type AcademicTeacherAssignment,
} from "@/lib/api";

type MainTab = "directory" | "allocate" | "workload" | "history" | "policies";
type DirectorySubView = "class" | "teacher" | "class_teacher" | "subject_teacher";
type FilterModal = "year" | "teacher" | "class" | null;

const sectionKey = (className: string, section: string) => `${className}\u0000${section}`;
const sectionLabel = (section: string) =>
  section === "Unspecified" ? "General Section" : `Section ${section}`;

const currentYear = () => {
  const today = new Date();
  const start = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

export default function AssignTeachersScreen() {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);

  const [overview, setOverview] = useState<AcademicManagementOverview | null>(null);
  const [academicYear, setAcademicYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState<MainTab>("directory");
  const [dirView, setDirView] = useState<DirectorySubView>("class");

  const [filterModal, setFilterModal] = useState<FilterModal>(null);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Allocation Form State
  const [formType, setFormType] = useState<AcademicAssignmentType>("class_teacher");
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [periods, setPeriods] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [editing, setEditing] = useState<AcademicTeacherAssignment | null>(null);

  const load = useCallback(
    async (year = academicYear) => {
      setLoading(true);
      setError("");
      try {
        const data = await api.academicTeacherAssignments.overview(year);
        setOverview(data);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load academic management data.");
      } finally {
        setLoading(false);
      }
    },
    [academicYear]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeAssignments = useMemo(
    () => (overview?.assignments ?? []).filter((row) => row.active),
    [overview]
  );

  const selectedTeacher = useMemo(
    () => overview?.teachers.find((t) => t.id === teacherId),
    [overview, teacherId]
  );

  // Filtered assignments for Directory
  const visibleAssignments = useMemo(() => {
    return activeAssignments.filter((row) => {
      if (dirView === "class_teacher" && row.assignmentType !== "class_teacher") return false;
      if (dirView === "subject_teacher" && row.assignmentType !== "subject_teacher") return false;
      if (teacherFilter && row.teacherId !== teacherFilter) return false;
      if (classFilter && sectionKey(row.className, row.section) !== classFilter) return false;
      if (!search.trim()) return true;
      const haystack = `${row.teacherName} ${row.className} ${row.section} ${row.subject || ""}`.toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [activeAssignments, dirView, teacherFilter, classFilter, search]);

  // Grouped by Class
  const groupsByClass = useMemo(() => {
    return (overview?.classSections ?? [])
      .map((item) => {
        const key = sectionKey(item.className, item.section);
        const rows = activeAssignments.filter(
          (row) =>
            sectionKey(row.className, row.section) === key &&
            (!teacherFilter || row.teacherId === teacherFilter) &&
            (!search.trim() ||
              `${row.teacherName} ${row.className} ${row.section} ${row.subject || ""}`
                .toLowerCase()
                .includes(search.trim().toLowerCase()))
        );
        return { key, rows, className: item.className, section: item.section, students: item.students };
      })
      .filter((group) => (!classFilter || group.key === classFilter) && (group.rows.length || !search.trim()));
  }, [activeAssignments, overview, teacherFilter, classFilter, search]);

  // Grouped by Teacher
  const groupsByTeacher = useMemo(() => {
    const rows = activeAssignments;
    return (overview?.teachers ?? [])
      .filter((teacher) => !teacherFilter || teacher.id === teacherFilter)
      .map((teacher) => ({
        id: teacher.id,
        name: teacher.fullName,
        subject: teacher.subject,
        rows: rows.filter(
          (row) =>
            row.teacherId === teacher.id &&
            (!classFilter || sectionKey(row.className, row.section) === classFilter) &&
            (!search.trim() ||
              `${row.teacherName} ${row.className} ${row.section} ${row.subject || ""}`
                .toLowerCase()
                .includes(search.trim().toLowerCase()))
        ),
      }))
      .filter((group) => group.rows.length || !search.trim());
  }, [activeAssignments, overview, teacherFilter, classFilter, search]);

  // Audit History
  const visibleHistory = useMemo(() => {
    return (overview?.history ?? []).filter((item) => {
      const details = `${item.actorName} ${item.action} ${JSON.stringify(item.previousData ?? {})} ${JSON.stringify(
        item.newData ?? {}
      )}`;
      const snapshots = [item.previousData, item.newData].filter(Boolean) as Record<string, unknown>[];
      if (teacherFilter && !snapshots.some((s) => s.teacherId === teacherFilter)) return false;
      if (classFilter) {
        const [className, section] = classFilter.split("\u0000");
        if (!snapshots.some((s) => s.className === className && s.section === section)) return false;
      }
      return details.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [overview, search, teacherFilter, classFilter]);

  const clearForm = () => {
    setEditing(null);
    setTeacherId("");
    setSubject("");
    setPeriods("");
    setSelectedSections([]);
    setError("");
  };

  const toggleSection = (key: string) => {
    setSelectedSections((curr) =>
      curr.includes(key) ? curr.filter((item) => item !== key) : [...curr, key]
    );
  };

  const startEdit = (row: AcademicTeacherAssignment) => {
    setEditing(row);
    setFormType(row.assignmentType);
    setTeacherId(row.teacherId);
    setSubject(row.subject || "");
    setPeriods(row.periodsPerWeek?.toString() ?? "");
    setSelectedSections([sectionKey(row.className, row.section)]);
    setError("");
    setSuccess("");
    setActiveTab("allocate");
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const save = async () => {
    if (!teacherId || !selectedSections.length || (formType === "subject_teacher" && !subject.trim()) || saving) {
      return;
    }
    const sections = selectedSections.map((key) => {
      const [className, section] = key.split("\u0000");
      return {
        className: className!,
        section: section!,
        periodsPerWeek: formType === "subject_teacher" && periods.trim() ? Number(periods) : null,
      };
    });

    if (
      formType === "subject_teacher" &&
      periods.trim() &&
      (!Number.isInteger(Number(periods)) || Number(periods) < 1 || Number(periods) > 60)
    ) {
      setError("Weekly periods must be a whole number between 1 and 60.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editing) {
        await api.academicTeacherAssignments.update(editing.id, {
          assignmentType: formType,
          academicYear,
          teacherId,
          subject: formType === "subject_teacher" ? subject.trim() : undefined,
          selection: sections[0]!,
        });
        setSuccess("Faculty assignment updated successfully and logged in audit history.");
      } else {
        const result = await api.academicTeacherAssignments.bulk({
          assignmentType: formType,
          academicYear,
          teacherId,
          subject: formType === "subject_teacher" ? subject.trim() : undefined,
          selections: sections,
        });
        setSuccess(
          `${result.assignments.length} ${
            result.assignments.length === 1 ? "assignment" : "assignments"
          } allocated successfully.`
        );
      }
      clearForm();
      await load(academicYear);
      setActiveTab("directory");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the assignment.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: AcademicTeacherAssignment) => {
    const execute = async () => {
      setError("");
      setSuccess("");
      try {
        await api.academicTeacherAssignments.remove(row.id);
        setSuccess(`Assignment for ${row.teacherName} was removed. History has been preserved.`);
        await load(academicYear);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not remove this assignment.");
      }
    };

    const confirmMsg = `Remove ${row.teacherName} from ${row.className} ${sectionLabel(row.section)}${
      row.subject ? ` · ${row.subject}` : ""
    }?`;
    if (Platform.OS === "web") {
      if (window.confirm(confirmMsg)) await execute();
    } else {
      Alert.alert("Confirm Removal", confirmMsg, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void execute() },
      ]);
    }
  };

  const updateMultipleTeacherPolicy = async (value: boolean) => {
    try {
      await api.academicTeacherAssignments.updateSettings({ allowMultipleSubjectTeachers: value });
      setOverview((curr) =>
        curr
          ? {
              ...curr,
              settings: { ...curr.settings, allowMultipleSubjectTeachers: value },
            }
          : curr
      );
      setSuccess("School assignment policy updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update school assignment settings.");
    }
  };

  return (
    <View style={s.page}>
      {/* Executive Header */}
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 14 : insets.top + 10 }]}>
        <View style={s.headerContainer}>
          <View style={s.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={s.headerBackBtn} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={s.headerTitleWrap}>
              <View style={s.badgeRow}>
                <View style={s.badgePill}>
                  <Ionicons name="shield-checkmark" size={11} color="#A5B4FC" />
                  <Text style={s.badgePillText}>OFFICIAL ACADEMIC PORTAL</Text>
                </View>
              </View>
              <Text style={s.headerTitle}>Academic Management & Allocation</Text>
              <Text style={s.headerSub}>
                {overview
                  ? `${overview.teachers.length} Verified Faculty · ${overview.classSections.length} Class Sections · JNV Network`
                  : "Class In-Charge & Subject Specialist Management"}
              </Text>
            </View>

            <TouchableOpacity onPress={() => setFilterModal("year")} style={s.yearSelector}>
              <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
              <Text style={s.yearSelectorText}>{academicYear}</Text>
              <Ionicons name="chevron-down" size={13} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {/* Quick Action Button & Stats Ribbon */}
          <View style={s.headerActionRow}>
            <View style={s.headerStatPill}>
              <Ionicons name="checkmark-done-circle" size={15} color="#10B981" />
              <Text style={s.headerStatText}>
                {activeAssignments.length} Active {activeAssignments.length === 1 ? "Assignment" : "Assignments"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                clearForm();
                setActiveTab(activeTab === "allocate" ? "directory" : "allocate");
              }}
              style={[s.primaryActionBtn, activeTab === "allocate" && s.primaryActionBtnSecondary]}
            >
              <Ionicons
                name={activeTab === "allocate" ? "list-outline" : "person-add-outline"}
                size={16}
                color={activeTab === "allocate" ? "#1E293B" : "#FFFFFF"}
              />
              <Text style={[s.primaryActionBtnText, activeTab === "allocate" && s.primaryActionBtnTextSecondary]}>
                {activeTab === "allocate" ? "View Directory" : "+ Allocate Teacher"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Main Tab Bar */}
      <View style={s.tabBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarScroll}>
          {[
            { id: "directory", label: "Directory & Assignments", icon: "albums-outline" },
            { id: "allocate", label: editing ? "Edit Assignment" : "Quick Allocate", icon: "add-circle-outline" },
            { id: "workload", label: "Faculty Workload", icon: "speedometer-outline" },
            { id: "history", label: "Audit Timeline", icon: "time-outline" },
            { id: "policies", label: "School Policy", icon: "settings-outline" },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as MainTab)}
                style={[s.mainTabItem, active && s.mainTabItemActive]}
              >
                <Ionicons name={tab.icon as any} size={15} color={active ? "#7C3AED" : "#64748B"} />
                <Text style={[s.mainTabItemText, active && s.mainTabItemTextActive]}>{tab.label}</Text>
                {tab.id === "history" && visibleHistory.length > 0 ? (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeText}>{visibleHistory.length}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Scrollable Workspace */}
      <ScrollView
        ref={scroll}
        contentContainerStyle={[s.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.workspaceContainer}>
          {/* Notifications */}
          {error ? (
            <View style={s.bannerError}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={s.bannerErrorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError("")} style={s.bannerClose}>
                <Ionicons name="close" size={16} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ) : null}

          {success ? (
            <View style={s.bannerSuccess}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={s.bannerSuccessText}>{success}</Text>
              <TouchableOpacity onPress={() => setSuccess("")} style={s.bannerClose}>
                <Ionicons name="close" size={16} color="#059669" />
              </TouchableOpacity>
            </View>
          ) : null}

          {loading && !overview ? (
            <View style={s.loadingState}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={s.loadingText}>Synchronizing JNV Academic Data…</Text>
            </View>
          ) : null}

          {overview && (
            <>
              {/* ======================================================== */}
              {/* TAB 1: DIRECTORY & ACTIVE ASSIGNMENTS                    */}
              {/* ======================================================== */}
              {activeTab === "directory" && (
                <View style={s.tabContent}>
                  {/* Executive Metric Cards (Balanced 4-card grid) */}
                  <View style={s.metricsGrid}>
                    <MetricCard
                      title="Class Teachers"
                      value={overview.summary.classTeacherAssignments}
                      subtext={`${overview.summary.classSections} sections covered`}
                      icon="school"
                      color="#7C3AED"
                      tag={
                        overview.summary.classTeacherAssignments >= overview.summary.classSections
                          ? "100% Covered"
                          : "Needs Allocation"
                      }
                      tagType={
                        overview.summary.classTeacherAssignments >= overview.summary.classSections
                          ? "success"
                          : "warning"
                      }
                    />
                    <MetricCard
                      title="Subject Allocations"
                      value={overview.summary.subjectTeacherAssignments}
                      subtext="Across all subjects"
                      icon="book"
                      color="#7C3AED"
                      tag="Active"
                      tagType="neutral"
                    />
                    <MetricCard
                      title="Teachers Assigned"
                      value={`${overview.summary.teachersAssigned}/${overview.teachers.length}`}
                      subtext="Verified faculty utilized"
                      icon="people"
                      color="#059669"
                      tag={`${Math.round(
                        (overview.summary.teachersAssigned / (overview.teachers.length || 1)) * 100
                      )}% Active`}
                      tagType="success"
                    />
                    <MetricCard
                      title="Weekly Periods"
                      value={overview.summary.configuredPeriodsPerWeek}
                      subtext="Allocated teaching hours"
                      icon="time"
                      color="#D97706"
                      tag="Scheduled"
                      tagType="neutral"
                    />
                  </View>

                  {/* Search and Filters Toolbar */}
                  <View style={s.filterToolbar}>
                    <View style={s.searchBar}>
                      <Ionicons name="search" size={17} color="#94A3B8" />
                      <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search by teacher name, class, section, or subject…"
                        placeholderTextColor="#94A3B8"
                        style={s.searchInput}
                      />
                      {search ? (
                        <TouchableOpacity onPress={() => setSearch("")}>
                          <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View style={s.filterRow}>
                      <TouchableOpacity
                        onPress={() => setFilterModal("teacher")}
                        style={[s.filterButton, !!teacherFilter && s.filterButtonActive]}
                      >
                        <Ionicons
                          name="person-outline"
                          size={14}
                          color={teacherFilter ? "#7C3AED" : "#64748B"}
                        />
                        <Text style={[s.filterButtonText, !!teacherFilter && s.filterButtonTextActive]}>
                          {teacherFilter
                            ? overview.teachers.find((t) => t.id === teacherFilter)?.fullName || "Teacher"
                            : "All Teachers"}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color={teacherFilter ? "#7C3AED" : "#94A3B8"} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setFilterModal("class")}
                        style={[s.filterButton, !!classFilter && s.filterButtonActive]}
                      >
                        <Ionicons name="grid-outline" size={14} color={classFilter ? "#7C3AED" : "#64748B"} />
                        <Text style={[s.filterButtonText, !!classFilter && s.filterButtonTextActive]}>
                          {classFilter ? classFilter.replace("\u0000", " · ") : "All Classes"}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color={classFilter ? "#7C3AED" : "#94A3B8"} />
                      </TouchableOpacity>

                      {teacherFilter || classFilter ? (
                        <TouchableOpacity
                          onPress={() => {
                            setTeacherFilter("");
                            setClassFilter("");
                          }}
                          style={s.clearFilterBtn}
                        >
                          <Ionicons name="refresh-outline" size={13} color="#DC2626" />
                          <Text style={s.clearFilterText}>Reset Filters</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Sub-view switcher */}
                    <View style={s.subViewRow}>
                      <Text style={s.subViewLabel}>View Organization:</Text>
                      <View style={s.subViewPills}>
                        {[
                          { id: "class", label: "By Class Section", icon: "grid-outline" },
                          { id: "teacher", label: "By Faculty", icon: "person-outline" },
                          { id: "class_teacher", label: "Class Teachers", icon: "school-outline" },
                          { id: "subject_teacher", label: "Subject Specialists", icon: "book-outline" },
                        ].map((view) => {
                          const active = dirView === view.id;
                          return (
                            <TouchableOpacity
                              key={view.id}
                              onPress={() => setDirView(view.id as DirectorySubView)}
                              style={[s.subViewPill, active && s.subViewPillActive]}
                            >
                              <Ionicons
                                name={view.icon as any}
                                size={13}
                                color={active ? "#FFFFFF" : "#64748B"}
                              />
                              <Text style={[s.subViewPillText, active && s.subViewPillTextActive]}>
                                {view.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {/* Listings by Selected Sub-view */}
                  {dirView === "class" && (
                    <View style={s.groupList}>
                      {groupsByClass.length ? (
                        groupsByClass.map((group) => {
                          const classTeacher = group.rows.find((r) => r.assignmentType === "class_teacher");
                          const subjectTeachers = group.rows.filter(
                            (r) => r.assignmentType === "subject_teacher"
                          );

                          return (
                            <View key={group.key} style={s.classCard}>
                              <View style={s.classCardHeader}>
                                <View style={s.classCardTitleWrap}>
                                  <View style={s.classBadgeIcon}>
                                    <Ionicons name="school" size={18} color="#7C3AED" />
                                  </View>
                                  <View>
                                    <Text style={s.classCardTitle}>
                                      {group.className} · {sectionLabel(group.section)}
                                    </Text>
                                    <Text style={s.classCardSub}>
                                      {group.students} Registered Students · {group.rows.length} Total Assignments
                                    </Text>
                                  </View>
                                </View>

                                <TouchableOpacity
                                  onPress={() => {
                                    clearForm();
                                    setSelectedSections([group.key]);
                                    setActiveTab("allocate");
                                  }}
                                  style={s.cardActionPill}
                                >
                                  <Ionicons name="add" size={14} color="#7C3AED" />
                                  <Text style={s.cardActionPillText}>Assign Teacher</Text>
                                </TouchableOpacity>
                              </View>

                              {/* Class Teacher Section */}
                              <View style={s.classSectionDivider}>
                                <Text style={s.sectionHeaderTag}>PRIMARY CLASS TEACHER (IN-CHARGE)</Text>
                                {classTeacher ? (
                                  <AssignmentRowCard
                                    row={classTeacher}
                                    onEdit={() => startEdit(classTeacher)}
                                    onDelete={() => remove(classTeacher)}
                                  />
                                ) : (
                                  <View style={s.unassignedBox}>
                                    <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
                                    <Text style={s.unassignedText}>
                                      No Class Teacher designated yet for this section.
                                    </Text>
                                    <TouchableOpacity
                                      onPress={() => {
                                        clearForm();
                                        setFormType("class_teacher");
                                        setSelectedSections([group.key]);
                                        setActiveTab("allocate");
                                      }}
                                      style={s.quickAssignLink}
                                    >
                                      <Text style={s.quickAssignLinkText}>Designate In-Charge</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>

                              {/* Subject Teachers Section */}
                              <View style={s.classSectionDivider}>
                                <Text style={s.sectionHeaderTag}>
                                  SUBJECT SPECIALISTS ({subjectTeachers.length})
                                </Text>
                                {subjectTeachers.length ? (
                                  subjectTeachers.map((row) => (
                                    <AssignmentRowCard
                                      key={row.id}
                                      row={row}
                                      onEdit={() => startEdit(row)}
                                      onDelete={() => remove(row)}
                                    />
                                  ))
                                ) : (
                                  <Text style={s.mutedEmpty}>No subject specialists mapped yet.</Text>
                                )}
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <EmptyStateCard
                          title="No Class Sections Match Filter"
                          description="Adjust your search query or reset filters to display classes."
                        />
                      )}
                    </View>
                  )}

                  {dirView === "teacher" && (
                    <View style={s.groupList}>
                      {groupsByTeacher.length ? (
                        groupsByTeacher.map((teacherGroup) => {
                          const workload = overview.summary.workloads.find(
                            (w) => w.teacherId === teacherGroup.id
                          );
                          return (
                            <View key={teacherGroup.id} style={s.teacherGroupCard}>
                              <View style={s.teacherGroupHeader}>
                                <View style={s.avatarCircle}>
                                  <Text style={s.avatarInitial}>
                                    {teacherGroup.name.slice(0, 1).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Text style={s.teacherGroupTitle}>{teacherGroup.name}</Text>
                                    {teacherGroup.subject ? (
                                      <View style={s.subjectBadge}>
                                        <Text style={s.subjectBadgeText}>{teacherGroup.subject}</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <Text style={s.teacherGroupSub}>
                                    {workload?.classes ?? 0} Classes Assigned ·{" "}
                                    {workload?.periodsPerWeek ?? 0} Periods/Week
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() => {
                                    clearForm();
                                    setTeacherId(teacherGroup.id);
                                    if (teacherGroup.subject) setSubject(teacherGroup.subject);
                                    setActiveTab("allocate");
                                  }}
                                  style={s.cardActionPill}
                                >
                                  <Ionicons name="add" size={14} color="#7C3AED" />
                                  <Text style={s.cardActionPillText}>Allocate</Text>
                                </TouchableOpacity>
                              </View>

                              <View style={{ gap: 8, marginTop: 10 }}>
                                {teacherGroup.rows.map((row) => (
                                  <AssignmentRowCard
                                    key={row.id}
                                    row={row}
                                    onEdit={() => startEdit(row)}
                                    onDelete={() => remove(row)}
                                  />
                                ))}
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <EmptyStateCard
                          title="No Teachers Found"
                          description="No verified teachers match the specified criteria."
                        />
                      )}
                    </View>
                  )}

                  {(dirView === "class_teacher" || dirView === "subject_teacher") && (
                    <View style={s.groupList}>
                      {visibleAssignments.length ? (
                        visibleAssignments.map((row) => (
                          <AssignmentRowCard
                            key={row.id}
                            row={row}
                            onEdit={() => startEdit(row)}
                            onDelete={() => remove(row)}
                          />
                        ))
                      ) : (
                        <EmptyStateCard
                          title={`No ${dirView === "class_teacher" ? "Class Teachers" : "Subject Teachers"} Found`}
                          description="Try switching tabs or adjusting search criteria."
                        />
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* ======================================================== */}
              {/* TAB 2: ALLOCATE TEACHERS (GUIDED WIZARD)                 */}
              {/* ======================================================== */}
              {activeTab === "allocate" && (
                <View style={s.allocateContainer}>
                  <View style={s.cardBox}>
                    {/* Header with edit notice */}
                    <View style={s.formHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.formTitle}>
                          {editing ? "Modify Faculty Assignment" : "Allocate Teacher to Class"}
                        </Text>
                        <Text style={s.formSubtitle}>
                          {editing
                            ? "Updates are permanently logged with audit tracking."
                            : "Assign class in-charges or subject teachers to registered class sections."}
                        </Text>
                      </View>
                      {editing ? (
                        <TouchableOpacity onPress={clearForm} style={s.cancelEditButton}>
                          <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                          <Text style={s.cancelEditText}>Cancel Edit</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Step 1: Role Type */}
                    <View style={s.formStep}>
                      <View style={s.stepHeader}>
                        <View style={s.stepNumber}>
                          <Text style={s.stepNumberText}>1</Text>
                        </View>
                        <Text style={s.stepTitle}>Select Assignment Role</Text>
                      </View>

                      <View style={s.roleGrid}>
                        <TouchableOpacity
                          onPress={() => setFormType("class_teacher")}
                          style={[s.roleCard, formType === "class_teacher" && s.roleCardSelected]}
                        >
                          <View
                            style={[
                              s.roleIconWrap,
                              formType === "class_teacher" && s.roleIconWrapSelected,
                            ]}
                          >
                            <Ionicons
                              name="school"
                              size={20}
                              color={formType === "class_teacher" ? "#7C3AED" : "#64748B"}
                            />
                          </View>
                          <Text
                            style={[
                              s.roleCardTitle,
                              formType === "class_teacher" && s.roleCardTitleSelected,
                            ]}
                          >
                            Class Teacher (In-Charge)
                          </Text>
                          <Text style={s.roleCardDesc}>
                            Responsible for student attendance, conduct records, and overall class coordination.
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setFormType("subject_teacher")}
                          style={[s.roleCard, formType === "subject_teacher" && s.roleCardSelected]}
                        >
                          <View
                            style={[
                              s.roleIconWrap,
                              formType === "subject_teacher" && s.roleIconWrapSelected,
                            ]}
                          >
                            <Ionicons
                              name="book"
                              size={20}
                              color={formType === "subject_teacher" ? "#7C3AED" : "#64748B"}
                            />
                          </View>
                          <Text
                            style={[
                              s.roleCardTitle,
                              formType === "subject_teacher" && s.roleCardTitleSelected,
                            ]}
                          >
                            Subject Teacher
                          </Text>
                          <Text style={s.roleCardDesc}>
                            Instructs specific curriculum subjects, tests, and homework for the selected sections.
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Step 2: Choose Faculty */}
                    <View style={s.formStep}>
                      <View style={s.stepHeader}>
                        <View style={s.stepNumber}>
                          <Text style={s.stepNumberText}>2</Text>
                        </View>
                        <Text style={s.stepTitle}>Choose Approved Faculty Member</Text>
                      </View>

                      {overview.teachers.length ? (
                        <View style={s.teacherGrid}>
                          {overview.teachers.map((teacher) => {
                            const isSelected = teacherId === teacher.id;
                            const workload = overview.summary.workloads.find(
                              (w) => w.teacherId === teacher.id
                            );

                            return (
                              <TouchableOpacity
                                key={teacher.id}
                                onPress={() => {
                                  setTeacherId(teacher.id);
                                  if (!subject && teacher.subject) setSubject(teacher.subject);
                                }}
                                style={[s.teacherSelectCard, isSelected && s.teacherSelectCardActive]}
                              >
                                <View style={[s.teacherSelectAvatar, isSelected && s.teacherSelectAvatarActive]}>
                                  <Text style={[s.teacherSelectInit, isSelected && s.teacherSelectInitActive]}>
                                    {teacher.fullName.slice(0, 1).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.teacherSelectName, isSelected && s.teacherSelectNameActive]}>
                                    {teacher.fullName}
                                  </Text>
                                  <Text style={s.teacherSelectSubject}>
                                    {teacher.subject || "Subject unlisted"}
                                  </Text>
                                </View>
                                <View style={s.workloadPill}>
                                  <Text style={s.workloadPillText}>
                                    {workload?.classes ?? 0} classes
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={s.alertWarning}>
                          <Ionicons name="information-circle" size={18} color="#D97706" />
                          <Text style={s.alertWarningText}>
                            No approved teachers found in the JNV directory. Teachers must register and be verified
                            first.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Step 3: Choose Class Sections */}
                    <View style={s.formStep}>
                      <View style={s.stepHeader}>
                        <View style={s.stepNumber}>
                          <Text style={s.stepNumberText}>3</Text>
                        </View>
                        <Text style={s.stepTitle}>
                          Target Class Sections ({selectedSections.length} selected)
                        </Text>
                      </View>

                      {overview.classSections.length ? (
                        <View style={s.sectionSelectionGrid}>
                          {overview.classSections.map((item) => {
                            const key = sectionKey(item.className, item.section);
                            const isSelected = selectedSections.includes(key);

                            return (
                              <TouchableOpacity
                                key={key}
                                onPress={() => toggleSection(key)}
                                disabled={!!editing && !isSelected}
                                style={[
                                  s.sectionSelectCard,
                                  isSelected && s.sectionSelectCardSelected,
                                  !!editing && !isSelected && s.disabledCard,
                                ]}
                              >
                                <Ionicons
                                  name={isSelected ? "checkbox" : "square-outline"}
                                  size={19}
                                  color={isSelected ? "#7C3AED" : "#94A3B8"}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      s.sectionSelectTitle,
                                      isSelected && s.sectionSelectTitleSelected,
                                    ]}
                                  >
                                    {item.className}
                                  </Text>
                                  <Text style={s.sectionSelectSub}>{sectionLabel(item.section)}</Text>
                                </View>
                                <View style={s.studentCountBadge}>
                                  <Ionicons name="people-outline" size={12} color="#64748B" />
                                  <Text style={s.studentCountText}>{item.students}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={s.alertInfo}>
                          <Ionicons name="school-outline" size={18} color="#7C3AED" />
                          <Text style={s.alertInfoText}>
                            Class sections are automatically inferred from enrolled student profiles in this JNV.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Step 4: Subject & Weekly Load (For Subject Teachers) */}
                    {formType === "subject_teacher" && (
                      <View style={s.formStep}>
                        <View style={s.stepHeader}>
                          <View style={s.stepNumber}>
                            <Text style={s.stepNumberText}>4</Text>
                          </View>
                          <Text style={s.stepTitle}>Subject & Teaching Load Configuration</Text>
                        </View>

                        <View style={s.inputRow}>
                          <View style={{ flex: 2 }}>
                            <Text style={s.inputLabel}>Subject Name *</Text>
                            <TextInput
                              value={subject}
                              onChangeText={setSubject}
                              placeholder="e.g. Mathematics, Physics, English"
                              placeholderTextColor="#94A3B8"
                              style={s.formInput}
                              maxLength={100}
                            />
                            {selectedTeacher?.subject && subject !== selectedTeacher.subject ? (
                              <TouchableOpacity
                                onPress={() => setSubject(selectedTeacher.subject || "")}
                                style={s.suggestionChip}
                              >
                                <Text style={s.suggestionChipText}>
                                  Use teacher's primary subject: "{selectedTeacher.subject}"
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={s.inputLabel}>Weekly Periods</Text>
                            <TextInput
                              value={periods}
                              onChangeText={setPeriods}
                              placeholder="e.g. 6"
                              placeholderTextColor="#94A3B8"
                              style={s.formInput}
                              keyboardType="number-pad"
                            />
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Action & Review Bar */}
                    <View style={s.actionFooter}>
                      <View style={s.reviewSummary}>
                        <Ionicons name="information-circle-outline" size={17} color="#64748B" />
                        <Text style={s.reviewSummaryText}>
                          {teacherId && selectedSections.length
                            ? `Assigning ${
                                overview.teachers.find((t) => t.id === teacherId)?.fullName
                              } to ${selectedSections.length} ${
                                selectedSections.length === 1 ? "section" : "sections"
                              } as ${formType === "class_teacher" ? "Class Teacher" : "Subject Teacher"}.`
                            : "Complete steps 1-3 above to enable allocation."}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => void save()}
                        disabled={
                          !teacherId ||
                          !selectedSections.length ||
                          (formType === "subject_teacher" && !subject.trim()) ||
                          saving
                        }
                        style={[
                          s.submitButton,
                          (!teacherId ||
                            !selectedSections.length ||
                            (formType === "subject_teacher" && !subject.trim()) ||
                            saving) &&
                            s.submitButtonDisabled,
                        ]}
                      >
                        {saving ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                            <Text style={s.submitButtonText}>
                              {editing
                                ? "Update Assignment"
                                : `Confirm Allocation (${selectedSections.length} Sections)`}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* ======================================================== */}
              {/* TAB 3: FACULTY WORKLOAD & CAPACITY                       */}
              {/* ======================================================== */}
              {activeTab === "workload" && (
                <View style={s.tabContent}>
                  <View style={s.workloadOverviewBanner}>
                    <Ionicons name="information-circle" size={20} color="#7C3AED" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.workloadBannerTitle}>Faculty Workload & Allocation Balancing</Text>
                      <Text style={s.workloadBannerSub}>
                        Monitors weekly teaching hours, class section coverage, and subject distribution across all
                        verified school educators.
                      </Text>
                    </View>
                  </View>

                  <View style={s.workloadGrid}>
                    {overview.summary.workloads.map((item) => {
                      const teacher = overview.teachers.find((t) => t.id === item.teacherId);
                      const assignments = activeAssignments.filter((a) => a.teacherId === item.teacherId);

                      return (
                        <View key={item.teacherId} style={s.workloadCard}>
                          <View style={s.workloadCardHeader}>
                            <View style={s.avatarCircle}>
                              <Text style={s.avatarInitial}>
                                {item.teacherName.slice(0, 1).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.workloadTeacherName}>{item.teacherName}</Text>
                              <Text style={s.workloadTeacherSub}>{teacher?.subject || "Subject not specified"}</Text>
                            </View>
                            <View style={s.loadStatusBadge}>
                              <Text style={s.loadStatusBadgeText}>{item.periodsPerWeek} Periods/Wk</Text>
                            </View>
                          </View>

                          <View style={s.workloadStatsRow}>
                            <View style={s.statCol}>
                              <Text style={s.statColVal}>{item.classes}</Text>
                              <Text style={s.statColLabel}>Classes Handled</Text>
                            </View>
                            <View style={s.statCol}>
                              <Text style={s.statColVal}>{item.subjects}</Text>
                              <Text style={s.statColLabel}>Subjects</Text>
                            </View>
                            <View style={s.statCol}>
                              <Text style={s.statColVal}>{assignments.length}</Text>
                              <Text style={s.statColLabel}>Active Roles</Text>
                            </View>
                          </View>

                          <View style={s.assignedTagsWrap}>
                            <Text style={s.assignedTagsLabel}>Current Allocations:</Text>
                            <View style={s.tagRow}>
                              {assignments.length ? (
                                assignments.map((a) => (
                                  <View key={a.id} style={s.allocationPill}>
                                    <Ionicons
                                      name={a.assignmentType === "class_teacher" ? "school" : "book"}
                                      size={11}
                                      color="#7C3AED"
                                    />
                                    <Text style={s.allocationPillText}>
                                      {a.className} · {a.section}
                                      {a.subject ? ` (${a.subject})` : ""}
                                    </Text>
                                  </View>
                                ))
                              ) : (
                                <Text style={s.mutedEmpty}>No classes assigned yet.</Text>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ======================================================== */}
              {/* TAB 4: AUDIT TIMELINE                                    */}
              {/* ======================================================== */}
              {activeTab === "history" && (
                <View style={s.tabContent}>
                  <View style={s.timelineHeader}>
                    <Text style={s.timelineTitle}>Permanent Audit Trail</Text>
                    <Text style={s.timelineSubtitle}>
                      Every teacher assignment, modification, and revocation is recorded with an immutable timestamp
                      and responsible official ID.
                    </Text>
                  </View>

                  {visibleHistory.length ? (
                    <View style={s.timelineList}>
                      {visibleHistory.map((item) => (
                        <View key={item.id} style={s.timelineItem}>
                          <View
                            style={[
                              s.timelineIconWrap,
                              item.action === "created" && s.iconCreate,
                              item.action === "updated" && s.iconUpdate,
                              item.action === "removed" && s.iconRemove,
                            ]}
                          >
                            <Ionicons
                              name={
                                item.action === "created"
                                  ? "add-circle"
                                  : item.action === "updated"
                                  ? "create"
                                  : "trash"
                              }
                              size={16}
                              color={
                                item.action === "created"
                                  ? "#059669"
                                  : item.action === "updated"
                                  ? "#7C3AED"
                                  : "#DC2626"
                              }
                            />
                          </View>

                          <View style={s.timelineDetails}>
                            <View style={s.timelineTop}>
                              <Text style={s.timelineAction}>
                                {item.action === "created"
                                  ? "Faculty Assigned"
                                  : item.action === "updated"
                                  ? "Assignment Modified"
                                  : "Assignment Revoked"}
                              </Text>
                              <Text style={s.timelineTime}>
                                {new Date(item.createdAt).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </View>

                            <Text style={s.timelineActor}>
                              By <Text style={{ fontWeight: "600" }}>{item.actorName}</Text> · Academic Year{" "}
                              {item.academicYear}
                            </Text>

                            <View style={s.timelineDataBox}>
                              <Text style={s.timelineDataText}>
                                {formatAuditSummary(item.newData ?? item.previousData)}
                              </Text>
                              {item.action === "updated" && item.previousData ? (
                                <Text style={s.timelinePreviousText}>
                                  Previous: {formatAuditSummary(item.previousData)}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <EmptyStateCard
                      title="No Audit History Yet"
                      description="Modifications to academic allocations will appear here."
                    />
                  )}
                </View>
              )}

              {/* ======================================================== */}
              {/* TAB 5: SCHOOL POLICY                                     */}
              {/* ======================================================== */}
              {activeTab === "policies" && (
                <View style={s.tabContent}>
                  <View style={s.cardBox}>
                    <Text style={s.formTitle}>Academic System Governance</Text>
                    <Text style={s.formSubtitle}>
                      Manage institutional policies and constraints for teacher-student allocations.
                    </Text>

                    <View style={s.policyItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.policyItemTitle}>Allow Multiple Subject Teachers</Text>
                        <Text style={s.policyItemDesc}>
                          When enabled, more than one teacher can be assigned to the same subject within a single
                          class section (e.g. for science practicals or team teaching).
                        </Text>
                      </View>
                      <Switch
                        value={overview.settings.allowMultipleSubjectTeachers}
                        onValueChange={(val) => void updateMultipleTeacherPolicy(val)}
                        trackColor={{ true: "#7C3AED", false: "#CBD5E1" }}
                      />
                    </View>

                    <View style={s.infoNoticeBox}>
                      <Ionicons name="calendar-outline" size={20} color="#7C3AED" />
                      <View style={{ flex: 1 }}>
                        <Text style={s.infoNoticeTitle}>Timetable Integration Notice</Text>
                        <Text style={s.infoNoticeDesc}>
                          Period and timetable data is currently operated in allocation-mode. Workload shows assigned
                          classes, subjects, and weekly load totals. Timetable clash detection will automatically
                          activate once master schedule tables are linked.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Filter Selection Modal */}
      <Modal
        visible={filterModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModal(null)}
      >
        <View style={s.modalScrim}>
          <View style={s.modalCard}>
            <View style={s.modalHeading}>
              <Text style={s.modalTitle}>
                {filterModal === "year"
                  ? "Select Academic Year"
                  : filterModal === "teacher"
                  ? "Filter by Faculty Member"
                  : "Filter by Class Section"}
              </Text>
              <TouchableOpacity onPress={() => setFilterModal(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {filterModal === "year" &&
                (overview?.academicYears ?? [academicYear]).map((year) => (
                  <TouchableOpacity
                    key={year}
                    onPress={() => {
                      setAcademicYear(year);
                      setFilterModal(null);
                    }}
                    style={s.modalOption}
                  >
                    <Text style={[s.modalOptionText, year === academicYear && s.modalOptionTextActive]}>
                      Academic Session {year}
                    </Text>
                    {year === academicYear ? (
                      <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />
                    ) : null}
                  </TouchableOpacity>
                ))}

              {filterModal === "teacher" && (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setTeacherFilter("");
                      setFilterModal(null);
                    }}
                    style={s.modalOption}
                  >
                    <Text style={[s.modalOptionText, !teacherFilter && s.modalOptionTextActive]}>
                      All Faculty Members
                    </Text>
                    {!teacherFilter ? <Ionicons name="checkmark-circle" size={18} color="#7C3AED" /> : null}
                  </TouchableOpacity>
                  {overview?.teachers.map((teacher) => (
                    <TouchableOpacity
                      key={teacher.id}
                      onPress={() => {
                        setTeacherFilter(teacher.id);
                        setFilterModal(null);
                      }}
                      style={s.modalOption}
                    >
                      <Text
                        style={[s.modalOptionText, teacherFilter === teacher.id && s.modalOptionTextActive]}
                      >
                        {teacher.fullName} ({teacher.subject || "All Subjects"})
                      </Text>
                      {teacherFilter === teacher.id ? (
                        <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {filterModal === "class" && (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setClassFilter("");
                      setFilterModal(null);
                    }}
                    style={s.modalOption}
                  >
                    <Text style={[s.modalOptionText, !classFilter && s.modalOptionTextActive]}>
                      All Class Sections
                    </Text>
                    {!classFilter ? <Ionicons name="checkmark-circle" size={18} color="#7C3AED" /> : null}
                  </TouchableOpacity>
                  {overview?.classSections.map((item) => {
                    const key = sectionKey(item.className, item.section);
                    const selected = classFilter === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => {
                          setClassFilter(key);
                          setFilterModal(null);
                        }}
                        style={s.modalOption}
                      >
                        <Text style={[s.modalOptionText, selected && s.modalOptionTextActive]}>
                          {item.className} · {sectionLabel(item.section)}
                        </Text>
                        {selected ? <Ionicons name="checkmark-circle" size={18} color="#7C3AED" /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helper Sub-Components
// ---------------------------------------------------------------------------

function MetricCard({
  title,
  value,
  subtext,
  icon,
  color,
  tag,
  tagType,
}: {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  tag: string;
  tagType: "success" | "warning" | "neutral";
}) {
  return (
    <View style={s.metricCard}>
      <View style={s.metricTopRow}>
        <View style={[s.metricIconWrap, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View
          style={[
            s.metricTag,
            tagType === "success" && s.metricTagSuccess,
            tagType === "warning" && s.metricTagWarning,
            tagType === "neutral" && s.metricTagNeutral,
          ]}
        >
          <Text
            style={[
              s.metricTagText,
              tagType === "success" && s.metricTagTextSuccess,
              tagType === "warning" && s.metricTagTextWarning,
              tagType === "neutral" && s.metricTagTextNeutral,
            ]}
          >
            {tag}
          </Text>
        </View>
      </View>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricTitle}>{title}</Text>
      <Text style={s.metricSubtext}>{subtext}</Text>
    </View>
  );
}

function AssignmentRowCard({
  row,
  onEdit,
  onDelete,
}: {
  row: AcademicTeacherAssignment;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isClassTeacher = row.assignmentType === "class_teacher";

  return (
    <View style={s.assignmentCard}>
      <View style={[s.assignmentIconWrap, isClassTeacher ? s.iconClassTeacher : s.iconSubjectTeacher]}>
        <Ionicons
          name={isClassTeacher ? "school" : "book"}
          size={16}
          color={isClassTeacher ? "#7C3AED" : "#7C3AED"}
        />
      </View>

      <View style={s.assignmentInfo}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={s.assignmentTeacherName}>{row.teacherName}</Text>
          <View style={[s.roleBadge, isClassTeacher ? s.roleBadgeClass : s.roleBadgeSubject]}>
            <Text style={[s.roleBadgeText, isClassTeacher ? s.roleBadgeTextClass : s.roleBadgeTextSubject]}>
              {isClassTeacher ? "Class In-Charge" : "Subject Specialist"}
            </Text>
          </View>
        </View>

        <Text style={s.assignmentDetails}>
          {row.className} · {sectionLabel(row.section)}
          {row.subject ? ` · Subject: ${row.subject}` : ""}
          {row.periodsPerWeek ? ` · ${row.periodsPerWeek} Periods/wk` : ""}
        </Text>
      </View>

      <View style={s.assignmentActions}>
        <TouchableOpacity
          onPress={onEdit}
          style={s.actionIconButton}
          accessibilityLabel="Edit Assignment"
        >
          <Ionicons name="pencil" size={15} color="#7C3AED" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={s.actionIconButton}
          accessibilityLabel="Remove Assignment"
        >
          <Ionicons name="trash-outline" size={15} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyStateCard({ title, description }: { title: string; description: string }) {
  return (
    <View style={s.emptyStateCard}>
      <View style={s.emptyIconWrap}>
        <Ionicons name="file-tray-outline" size={28} color="#94A3B8" />
      </View>
      <Text style={s.emptyStateTitle}>{title}</Text>
      <Text style={s.emptyStateDesc}>{description}</Text>
    </View>
  );
}

function formatAuditSummary(value: Record<string, unknown> | null) {
  if (!value) return "Details unavailable.";
  const type = value.assignmentType === "class_teacher" ? "Class Teacher" : "Subject Teacher";
  const name = String(value.teacherName ?? "Faculty Member");
  const cls = `${String(value.className ?? "")} ${String(value.section ?? "")}`.trim();
  const sub = value.subject ? ` (${String(value.subject)})` : "";
  const periods = value.periodsPerWeek ? ` [${value.periodsPerWeek} Periods/wk]` : "";
  return `${type}: ${name} ➔ ${cls}${sub}${periods}`;
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: "#7C3AED",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2D3748",
  },
  headerContainer: {
    paddingHorizontal: 16,
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
    gap: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  headerTitleWrap: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(165,180,252,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    color: "#C7D2FE",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    color: "#94A3B8",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  yearSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  yearSelectorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  headerStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  headerStatText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryActionBtnSecondary: {
    backgroundColor: "#F1F5F9",
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  primaryActionBtnTextSecondary: {
    color: "#1E293B",
  },

  /* Tab Navigation */
  tabBarContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tabBarScroll: {
    paddingHorizontal: 16,
    maxWidth: 1000,
    alignSelf: "center",
    width: "100%",
    gap: 6,
  },
  mainTabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  mainTabItemActive: {
    borderBottomColor: "#7C3AED",
  },
  mainTabItemText: {
    color: "#64748B",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  mainTabItemTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },
  tabBadge: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeText: {
    color: "#7C3AED",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },

  /* Content */
  content: {
    paddingTop: 16,
  },
  workspaceContainer: {
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 16,
    gap: 16,
  },
  tabContent: {
    gap: 16,
  },

  /* Banners */
  bannerError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    borderRadius: 10,
  },
  bannerErrorText: {
    flex: 1,
    color: "#B91C1C",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  bannerSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 12,
    borderRadius: 10,
  },
  bannerSuccessText: {
    flex: 1,
    color: "#047857",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  bannerClose: {
    padding: 4,
  },

  /* Loading State */
  loadingState: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },

  /* Metrics Grid (Balanced 4-card grid) */
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 160,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  metricTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricTagSuccess: { backgroundColor: "#DCFCE7" },
  metricTagWarning: { backgroundColor: "#FEF3C7" },
  metricTagNeutral: { backgroundColor: "#F1F5F9" },
  metricTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  metricTagTextSuccess: { color: "#166534" },
  metricTagTextWarning: { color: "#92400E" },
  metricTagTextNeutral: { color: "#475569" },
  metricValue: {
    color: "#0F172A",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 10,
  },
  metricTitle: {
    color: "#334155",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  metricSubtext: {
    color: "#94A3B8",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },

  /* Filter Toolbar */
  filterToolbar: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    outlineStyle: "none" as any,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  filterButtonActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#C7D2FE",
  },
  filterButtonText: {
    color: "#475569",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  filterButtonTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_600SemiBold",
  },
  clearFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearFilterText: {
    color: "#DC2626",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  subViewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexWrap: "wrap",
    gap: 8,
  },
  subViewLabel: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  subViewPills: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  subViewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  subViewPillActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  subViewPillText: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  subViewPillTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },

  /* Group & Class Cards */
  groupList: {
    gap: 14,
  },
  classCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12,
  },
  classCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  classCardTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  classBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  classCardTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  classCardSub: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  cardActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cardActionPillText: {
    color: "#7C3AED",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  classSectionDivider: {
    gap: 8,
  },
  sectionHeaderTag: {
    color: "#94A3B8",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  unassignedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 10,
    borderRadius: 8,
  },
  unassignedText: {
    flex: 1,
    color: "#B45309",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  quickAssignLink: {
    backgroundColor: "#D97706",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickAssignLinkText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  mutedEmpty: {
    color: "#94A3B8",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    paddingVertical: 4,
  },

  /* Faculty Group Card */
  teacherGroupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  teacherGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#7C3AED",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  teacherGroupTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  teacherGroupSub: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  subjectBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  subjectBadgeText: {
    color: "#475569",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },

  /* Row Card */
  assignmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    borderRadius: 8,
  },
  assignmentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  iconClassTeacher: {
    backgroundColor: "#F5F3FF",
  },
  iconSubjectTeacher: {
    backgroundColor: "#F3E8FF",
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTeacherName: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeClass: { backgroundColor: "#DBEAFE" },
  roleBadgeSubject: { backgroundColor: "#EDE9FE" },
  roleBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  roleBadgeTextClass: { color: "#5B21B6" },
  roleBadgeTextSubject: { color: "#6B21A8" },
  assignmentDetails: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  assignmentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionIconButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  /* TAB 2: ALLOCATE FORM */
  allocateContainer: {
    width: "100%",
  },
  cardBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 18,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  formTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  formSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  cancelEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
  },
  cancelEditText: {
    color: "#DC2626",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  formStep: {
    gap: 10,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  stepTitle: {
    color: "#1E293B",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  roleGrid: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  roleCard: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 200,
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  roleCardSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  roleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  roleIconWrapSelected: {
    backgroundColor: "#DBEAFE",
  },
  roleCardTitle: {
    color: "#334155",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  roleCardTitleSelected: {
    color: "#5B21B6",
  },
  roleCardDesc: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
  },
  teacherGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  teacherSelectCard: {
    flexGrow: 1,
    flexBasis: "48%",
    minWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
  },
  teacherSelectCardActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  teacherSelectAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  teacherSelectAvatarActive: {
    backgroundColor: "#7C3AED",
  },
  teacherSelectInit: {
    color: "#475569",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  teacherSelectInitActive: {
    color: "#FFFFFF",
  },
  teacherSelectName: {
    color: "#1E293B",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  teacherSelectNameActive: {
    color: "#5B21B6",
  },
  teacherSelectSubject: {
    color: "#94A3B8",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  workloadPill: {
    backgroundColor: "rgba(0,0,0,0.04)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  workloadPillText: {
    color: "#64748B",
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
  sectionSelectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionSelectCard: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
  },
  sectionSelectCardSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  disabledCard: {
    opacity: 0.45,
  },
  sectionSelectTitle: {
    color: "#1E293B",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  sectionSelectTitleSelected: {
    color: "#5B21B6",
  },
  sectionSelectSub: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  studentCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  studentCountText: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputLabel: {
    color: "#334155",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 5,
  },
  formInput: {
    height: 42,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    outlineStyle: "none" as any,
  },
  suggestionChip: {
    marginTop: 4,
  },
  suggestionChipText: {
    color: "#7C3AED",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  actionFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 12,
  },
  reviewSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
  },
  reviewSummaryText: {
    flex: 1,
    color: "#475569",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  submitButton: {
    height: 44,
    backgroundColor: "#7C3AED",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  /* TAB 3: WORKLOAD */
  workloadOverviewBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 14,
    borderRadius: 10,
  },
  workloadBannerTitle: {
    color: "#5B21B6",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  workloadBannerSub: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  workloadGrid: {
    gap: 12,
  },
  workloadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12,
  },
  workloadCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  workloadTeacherName: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  workloadTeacherSub: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  loadStatusBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  loadStatusBadgeText: {
    color: "#334155",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  workloadStatsRow: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingVertical: 10,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statColVal: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  statColLabel: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  assignedTagsWrap: {
    gap: 6,
  },
  assignedTagsLabel: {
    color: "#475569",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  allocationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  allocationPillText: {
    color: "#334155",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },

  /* TAB 4: AUDIT TIMELINE */
  timelineHeader: {
    marginBottom: 4,
  },
  timelineTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  timelineSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  timelineList: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  timelineIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCreate: { backgroundColor: "#DCFCE7" },
  iconUpdate: { backgroundColor: "#DBEAFE" },
  iconRemove: { backgroundColor: "#FEE2E2" },
  timelineDetails: {
    flex: 1,
    gap: 4,
  },
  timelineTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineAction: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  timelineTime: {
    color: "#94A3B8",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  timelineActor: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  timelineDataBox: {
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
    gap: 2,
  },
  timelineDataText: {
    color: "#334155",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  timelinePreviousText: {
    color: "#94A3B8",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },

  /* TAB 5: POLICIES */
  policyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    borderRadius: 8,
  },
  policyItemTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  policyItemDesc: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  infoNoticeBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 14,
    borderRadius: 8,
    alignItems: "flex-start",
  },
  infoNoticeTitle: {
    color: "#5B21B6",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  infoNoticeDesc: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },

  /* Empty State Card */
  emptyStateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyStateTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  emptyStateDesc: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 300,
  },

  /* Alerts */
  alertWarning: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  alertWarningText: {
    flex: 1,
    color: "#92400E",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  alertInfo: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  alertInfoText: {
    flex: 1,
    color: "#0369A1",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },

  /* Modal */
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    width: "100%",
    maxWidth: 460,
    padding: 18,
    gap: 12,
  },
  modalHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  modalOptionText: {
    color: "#475569",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  modalOptionTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },
});
