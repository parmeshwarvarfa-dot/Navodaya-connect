import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, type Opportunity, type OpportunityAnalytics, type OpportunityDetails, type OpportunityInput, type OpportunityParticipant, type OpportunityRegistration, type OpportunitySubmission, type SavedOpportunity } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import JobsScreen from "@/app/(tabs)/jobs";

const BLUE = "#7C3AED";
const PURPLE = "#6630B5";
const TYPES = [
  ["academic_competition", "Academic competition"], ["coding_challenge", "Coding challenge"],
  ["creative_competition", "Creative competition"], ["quiz", "Quiz / GK challenge"],
  ["course", "Course"], ["workshop", "Workshop"], ["webinar", "Webinar"],
  ["scholarship", "Scholarship"], ["internship", "Internship"], ["mentorship", "Mentorship"],
  ["community_challenge", "Community challenge"], ["other", "Other"],
] as const;
const ROLE_OPTIONS = [["student", "Students"], ["alumni", "Alumni"], ["teacher", "Teachers"], ["official", "JNV officials"]] as const;
const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];
const STATUS_OPTIONS = [["", "All"], ["registration_open", "Open"], ["upcoming", "Upcoming"], ["ongoing", "Ongoing"], ["registration_closed", "Closed"], ["completed", "Completed"]] as const;
const TYPE_FILTERS = [["", "All types"], ...TYPES] as const;
const EDITABLE_KEYS = [
  "type", "category", "title", "summary", "description", "eligibility", "eligibleRoles", "eligibleClasses",
  "format", "participationMode", "location", "timezone", "registrationOpensAt", "registrationDeadline",
  "startsAt", "endsAt", "submissionDeadline", "maxParticipants", "rules", "judgingCriteria", "submissionMode",
  "submissionInstructions", "deliveryMode", "externalProvider", "externalUrl", "feeAmount", "feeDetails",
  "prizeDetails", "certificateType", "certificateDetails", "status",
] as const;

function freshForm(): OpportunityInput {
  return {
    type: "academic_competition", category: "Academic", title: "", summary: "", description: "",
    eligibility: "", eligibleRoles: ["student", "alumni"], eligibleClasses: [], format: "online",
    participationMode: "individual", location: "", timezone: "Asia/Kolkata", registrationOpensAt: "",
    registrationDeadline: "", startsAt: "", endsAt: "", submissionDeadline: "", maxParticipants: null,
    rules: "", judgingCriteria: "", submissionMode: "none", submissionInstructions: "",
    deliveryMode: "internal", externalProvider: "", externalUrl: "", feeAmount: 0, feeDetails: "",
    prizeDetails: "", certificateType: "none", certificateDetails: "", status: "draft",
  };
}

function labelForType(type: string) {
  return TYPES.find(([value]) => value === type)?.[1] ?? type.replaceAll("_", " ");
}

function dateLabel(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: "default" | "numeric" | "url";
}) {
  return <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9AA3B2"
      multiline={multiline} keyboardType={keyboardType} textAlignVertical={multiline ? "top" : "center"}
      autoCapitalize={keyboardType === "url" ? "none" : "sentences"}
      style={[styles.input, multiline && styles.textArea]}
    />
  </View>;
}

function Chip({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{title}</Text>
  </TouchableOpacity>;
}

export default function AlumniOpportunitiesScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isVerified } = useAuth();
  const canOrganize = profile?.role === "alumni" && isVerified;
  const [tab, setTab] = useState<"discover" | "jobs" | "saved" | "mine" | "organizer">("discover");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [saved, setSaved] = useState<SavedOpportunity[]>([]);
  const [registrations, setRegistrations] = useState<OpportunityRegistration[]>([]);
  const [analytics, setAnalytics] = useState<OpportunityAnalytics | null>(null);
  const [search, setSearch] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [sort, setSort] = useState<"deadline" | "newest">("deadline");
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<OpportunityDetails | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<OpportunityInput>(freshForm());
  const [preview, setPreview] = useState(false);

  const [manageOpen, setManageOpen] = useState(false);
  const [manageTarget, setManageTarget] = useState<Opportunity | null>(null);
  const [participants, setParticipants] = useState<OpportunityParticipant[]>([]);
  const [submissions, setSubmissions] = useState<OpportunitySubmission[]>([]);
  const [manageBusy, setManageBusy] = useState(false);
  const [reviewing, setReviewing] = useState<OpportunitySubmission | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"reviewed" | "selected" | "not_selected">("reviewed");
  const [reviewScore, setReviewScore] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");

  const load = useCallback(async (append = false) => {
    if (tab === "jobs") return;
    setError("");
    if (!append) setLoading(true); else setLoadingMore(true);
    try {
      if (tab === "discover") {
        const nextPage = append ? pageRef.current + 1 : 1;
        const result = await api.opportunities.list({
          q: search.trim() || undefined, type: typeFilter || undefined, category: categoryFilter || undefined, status: statusFilter || undefined,
          format: formatFilter || undefined, sort, page: nextPage, limit: 15,
          eligibleOnly: eligibleOnly || undefined,
        });
        setItems((current) => append ? [...current, ...result.items] : result.items);
        pageRef.current = result.page;
        setPage(result.page);
        setHasMore(result.hasMore);
      } else if (tab === "mine") {
        setRegistrations(await api.opportunities.registrations());
      } else if (tab === "saved") {
        setSaved(await api.opportunities.saved());
      } else if (canOrganize) {
        const [mine, stats] = await Promise.all([api.opportunities.mine(), api.opportunities.analytics()]);
        setItems(mine);
        setAnalytics(stats);
      } else {
        setTab("discover");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load opportunities.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [tab, search, typeFilter, categoryFilter, statusFilter, formatFilter, sort, eligibleOnly, canOrganize]);

  useEffect(() => {
    if (tab === "jobs") return;
    const timer = setTimeout(() => { void load(); }, tab === "discover" && search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => { api.opportunities.categories().then(setCategoryOptions).catch(() => setCategoryOptions([])); }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);
  const resetPage = () => { pageRef.current = 1; setPage(1); };
  const toggleSaved = async () => {
    if (!detail) return;
    const exists = saved.some((item) => item.id === detail.id);
    try {
      if (exists) { await api.opportunities.unsave(detail.id); setSaved((items) => items.filter((item) => item.id !== detail.id)); }
      else { await api.opportunities.save(detail.id); setSaved((items) => [{ ...detail, savedAt: new Date().toISOString() }, ...items]); }
      Alert.alert(exists ? "Removed from saved" : "Opportunity saved", exists ? "This opportunity was removed from your list." : "You can track its deadline in Saved opportunities.");
    } catch (err) { Alert.alert("Could not update saved list", err instanceof Error ? err.message : "Please try again."); }
  };

  const openDetail = async (item: Opportunity) => {
    setDetailBusy(true);
    setDetailOpen(true);
    setDetail(null);
    setSubmissionText("");
    setSubmissionUrl("");
    try {
      const value = await api.opportunities.get(item.id);
      setDetail(value);
      setSubmissionText(value.mySubmission?.content ?? "");
      setSubmissionUrl(value.mySubmission?.submissionUrl ?? "");
    } catch (err) {
      setDetailOpen(false);
      Alert.alert("Opportunity unavailable", err instanceof Error ? err.message : "Could not load this opportunity.");
    } finally {
      setDetailBusy(false);
    }
  };

  const register = async () => {
    if (!detail) return;
    setDetailBusy(true);
    try {
      await api.opportunities.register(detail.id);
      const updated = await api.opportunities.get(detail.id);
      setDetail(updated);
      await load();
      Alert.alert("You're registered", "Your registration has been saved.");
    } catch (err) {
      Alert.alert("Registration unavailable", err instanceof Error ? err.message : "Could not register.");
    } finally { setDetailBusy(false); }
  };

  const cancelRegistration = () => {
    if (!detail) return;
    Alert.alert("Cancel registration?", "Your place may be taken by another participant.", [
      { text: "Keep registration", style: "cancel" },
      { text: "Cancel registration", style: "destructive", onPress: async () => {
        setDetailBusy(true);
        try {
          await api.opportunities.cancelRegistration(detail.id);
          const updated = await api.opportunities.get(detail.id);
          setDetail(updated); await load();
        } catch (err) { Alert.alert("Could not cancel", err instanceof Error ? err.message : "Please try again."); }
        finally { setDetailBusy(false); }
      } },
    ]);
  };

  const submitEntry = async () => {
    if (!detail) return;
    setDetailBusy(true);
    try {
      await api.opportunities.submit(detail.id, { content: submissionText, submissionUrl });
      setDetail(await api.opportunities.get(detail.id));
      Alert.alert("Entry submitted", "Your submission was saved for the organizer to review.");
    } catch (err) { Alert.alert("Submission not saved", err instanceof Error ? err.message : "Please try again."); }
    finally { setDetailBusy(false); }
  };

  const reportOpportunity = () => {
    if (!detail) return;
    const choices = ["Misleading or fraudulent", "Unsafe or inappropriate", "Spam", "Other"];
    Alert.alert("Report opportunity", "Choose a reason. Reports are sent to the existing JNV moderation queue.", [
      ...choices.map((reason) => ({ text: reason, onPress: async () => {
        try { await api.opportunities.report(detail.id, reason); Alert.alert("Report sent", "Thank you for helping keep the community safe."); }
        catch (err) { Alert.alert("Report not sent", err instanceof Error ? err.message : "Please try again."); }
      } })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openEditor = async (item?: Opportunity) => {
    setEditorError(""); setPreview(false);
    if (!item) {
      setEditId(null); setForm(freshForm()); setEditorOpen(true); return;
    }
    try {
      const current = await api.opportunities.get(item.id);
      setEditId(item.id);
      const editable = Object.fromEntries(EDITABLE_KEYS.map((key) => [key, current[key]])) as OpportunityInput;
      setForm({
        ...editable, location: current.location ?? "", externalProvider: current.externalProvider ?? "",
        externalUrl: current.externalUrl ?? "", status: current.status as OpportunityInput["status"],
        registrationOpensAt: current.registrationOpensAt ?? "", registrationDeadline: current.registrationDeadline ?? "",
        startsAt: current.startsAt ?? "", endsAt: current.endsAt ?? "", submissionDeadline: current.submissionDeadline ?? "",
      });
      setEditorOpen(true);
    } catch (err) { Alert.alert("Unable to edit", err instanceof Error ? err.message : "Could not load this opportunity."); }
  };

  const setField = (key: keyof OpportunityInput, value: unknown) => setForm((current) => ({ ...current, [key]: value }) as OpportunityInput);
  const toggleStringOption = (key: "eligibleRoles" | "eligibleClasses", value: string) => {
    const current = (form[key] ?? []) as string[];
    setField(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const saveOpportunity = async (publish: boolean) => {
    setEditorError("");
    const payload: OpportunityInput = {
      ...form,
      status: publish ? "published" : (editId ? form.status : "draft"),
      feeAmount: Number(form.feeAmount || 0),
      maxParticipants: form.maxParticipants === null || form.maxParticipants === undefined ? null : Number(form.maxParticipants),
    };
    setEditorBusy(true);
    try {
      const saved = editId ? await api.opportunities.update(editId, payload) : await api.opportunities.create(payload);
      setEditorOpen(false);
      setDetailOpen(false);
      setTab("organizer");
      api.opportunities.categories().then(setCategoryOptions).catch(() => {});
      await load();
      Alert.alert(publish ? "Opportunity published" : "Draft saved", publish ? "Eligible Navodaya Connect users can now find it." : "You can publish it when the listing is ready.");
      if (saved.id) setManageTarget(saved);
    } catch (err) { setEditorError(err instanceof Error ? err.message : "Could not save this opportunity."); }
    finally { setEditorBusy(false); }
  };

  const cancelOpportunity = (item: Opportunity) => Alert.alert("Cancel this opportunity?", "Registrations and history will be preserved, and registered participants will be notified.", [
    { text: "Keep it", style: "cancel" },
    { text: "Cancel opportunity", style: "destructive", onPress: async () => {
      try { await api.opportunities.update(item.id, { status: "cancelled" }); await load(); }
      catch (err) { Alert.alert("Could not cancel", err instanceof Error ? err.message : "Please try again."); }
    } },
  ]);

  const openManager = async (item: Opportunity) => {
    setManageTarget(item); setManageBusy(true); setParticipants([]); setSubmissions([]); setManageOpen(true);
    try {
      const [people, entries] = await Promise.all([api.opportunities.participants(item.id), api.opportunities.submissions(item.id)]);
      setParticipants(people); setSubmissions(entries);
    } catch (err) { Alert.alert("Unable to load organizer tools", err instanceof Error ? err.message : "Please try again."); }
    finally { setManageBusy(false); }
  };

  const startReview = (submission: OpportunitySubmission) => {
    setReviewing(submission); setReviewStatus((submission.status === "selected" || submission.status === "not_selected") ? submission.status : "reviewed");
    setReviewScore(submission.score === null ? "" : String(submission.score)); setReviewFeedback(submission.organizerFeedback);
  };

  const saveReview = async () => {
    if (!manageTarget || !reviewing) return;
    const score = reviewScore.trim() ? Number(reviewScore) : null;
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 1000)) { Alert.alert("Check score", "Enter a whole number from 0 to 1000."); return; }
    setManageBusy(true);
    try {
      await api.opportunities.reviewSubmission(manageTarget.id, reviewing.id, { status: reviewStatus, score, organizerFeedback: reviewFeedback });
      setReviewing(null);
      const entries = await api.opportunities.submissions(manageTarget.id); setSubmissions(entries);
    } catch (err) { Alert.alert("Review not saved", err instanceof Error ? err.message : "Please try again."); }
    finally { setManageBusy(false); }
  };

  const publishResults = (item: Opportunity) => Alert.alert(item.resultsPublished ? "Hide final results?" : "Publish final results?", item.resultsPublished ? "Participants will no longer see their score and feedback." : "Reviewed scores and feedback become visible to registered participants.", [
    { text: "Cancel", style: "cancel" },
    { text: item.resultsPublished ? "Hide results" : "Publish results", onPress: async () => {
      try { await api.opportunities.publishResults(item.id, !item.resultsPublished); await load(); }
      catch (err) { Alert.alert("Results not updated", err instanceof Error ? err.message : "The opportunity must be complete first."); }
    } },
  ]);

  const openExternal = async (url: string | null | undefined) => {
    if (!url) return;
    try { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(); await Linking.openURL(parsed.toString()); }
    catch { Alert.alert("Link unavailable", "This external link could not be opened."); }
  };

  const filteredRegistrations = useMemo(() => registrations, [registrations]);
  const sortedSaved = useMemo(() => [...saved].sort((a, b) => {
    const da = a.registrationDeadline ? new Date(a.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.registrationDeadline ? new Date(b.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    return da - db;
  }), [saved]);
  const headerTop = Platform.OS === "web" ? 8 : insets.top + 6;

  const renderCard = (item: Opportunity, organizer = false) => {
    const status = item.displayStatus || item.status;
    return <TouchableOpacity key={item.id} activeOpacity={0.88} style={styles.card} onPress={() => void openDetail(item)}>
      <View style={styles.cardHead}>
        <View style={styles.iconBadge}><Ionicons name={item.type.includes("competition") || item.type.includes("challenge") ? "trophy-outline" : "sparkles-outline"} size={21} color={PURPLE} /></View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.organizerLine}>{organizer ? "Your listing" : `By ${item.organizerName || "Navodaya Connect alumnus"}`}</Text>
        </View>
        <View style={[styles.statusPill, status === "registration_open" && styles.statusOpen]}>
          <Text style={[styles.statusText, status === "registration_open" && styles.statusOpenText]}>{status.replaceAll("_", " ")}</Text>
        </View>
      </View>
      <Text style={styles.cardSummary} numberOfLines={3}>{item.summary || item.description}</Text>
      <View style={styles.tagRow}>
        <Text style={styles.tag}>{labelForType(item.type)}</Text><Text style={styles.tag}>{item.category}</Text>
        <Text style={styles.tag}>{item.format}</Text>
      </View>
      <View style={styles.cardFoot}>
        <View style={styles.metaItem}><Ionicons name="calendar-outline" size={15} color="#697586" /><Text style={styles.metaText}>Deadline {dateLabel(item.registrationDeadline)}</Text></View>
        <View style={styles.metaItem}><Ionicons name="people-outline" size={15} color="#697586" /><Text style={styles.metaText}>{item.registrationCount ?? 0}</Text></View>
      </View>
      {organizer && <View style={styles.organizerActions}>
        <TouchableOpacity style={styles.smallAction} onPress={() => void openEditor(item)}><Ionicons name="create-outline" size={16} color={BLUE} /><Text style={styles.smallActionText}>Edit</Text></TouchableOpacity>
        <TouchableOpacity style={styles.smallAction} onPress={() => void openManager(item)}><Ionicons name="people-outline" size={16} color={BLUE} /><Text style={styles.smallActionText}>Participants & entries</Text></TouchableOpacity>
        {item.status === "published" && <TouchableOpacity style={styles.smallAction} onPress={() => cancelOpportunity(item)}><Ionicons name="close-circle-outline" size={16} color="#D64747" /><Text style={[styles.smallActionText, { color: "#D64747" }]}>Cancel</Text></TouchableOpacity>}
      </View>}
    </TouchableOpacity>;
  };

  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: headerTop }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={21} color="#1E1B2E" /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.headerTitle}>Opportunities</Text><Text style={styles.headerSubtitle}>Discover and share ways to grow</Text></View>
      {canOrganize && tab !== "jobs" && <TouchableOpacity style={styles.createButton} onPress={() => void openEditor()}><Ionicons name="add" size={24} color="#fff" /><Text style={styles.createText}>Create</Text></TouchableOpacity>}
    </View>

    <ScrollView horizontal style={styles.tabsScroll} contentContainerStyle={styles.tabs} showsHorizontalScrollIndicator={false}>
      {[["discover", "Discover"], ["jobs", "Jobs"], ["saved", "Saved"], ["mine", "My activity"], ...(canOrganize ? [["organizer", "Organizer"]] : [])].map(([key, title]) => <TouchableOpacity key={key} onPress={() => setTab(key as typeof tab)} style={[styles.tab, tab === key && styles.activeTab]}><Text style={[styles.tabText, tab === key && styles.activeTabText]}>{title}</Text></TouchableOpacity>)}
    </ScrollView>

    {tab === "jobs" ? <JobsScreen embedded /> : <>
    {tab === "discover" && <View style={styles.filterPanel}>
      <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color="#7C8798" /><TextInput style={styles.searchInput} placeholder="Search title, organizer, topic..." placeholderTextColor="#8A94A4" value={search} onChangeText={setSearch} returnKeyType="search" /></View>
      <ScrollView horizontal style={styles.filterScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {TYPE_FILTERS.map(([value, title]) => <Chip key={value} title={title} active={typeFilter === value} onPress={() => { setTypeFilter(value); resetPage(); }} />)}
      </ScrollView>
      {categoryOptions.length > 0 && <ScrollView horizontal style={styles.filterScrollerTight} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowTight}>
        {["", ...categoryOptions].map((value) => <Chip key={value || "all-categories"} title={value || "All categories"} active={categoryFilter === value} onPress={() => { setCategoryFilter(value); resetPage(); }} />)}
      </ScrollView>}
      <ScrollView horizontal style={styles.filterScrollerTight} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowTight}>
        {STATUS_OPTIONS.map(([value, title]) => <Chip key={value} title={title} active={statusFilter === value} onPress={() => { setStatusFilter(value); resetPage(); }} />)}
        {[ ["", "Any format"], ["online", "Online"], ["offline", "Offline"], ["hybrid", "Hybrid"] ].map(([value, title]) => <Chip key={value} title={title} active={formatFilter === value} onPress={() => setFormatFilter(value)} />)}
      </ScrollView>
      <View style={styles.controlRow}>
        <TouchableOpacity onPress={() => setEligibleOnly((value) => !value)} style={styles.eligibleControl}>
          <Ionicons name={eligibleOnly ? "checkbox" : "square-outline"} size={18} color={eligibleOnly ? BLUE : "#7C8798"} /><Text style={styles.controlText}>Eligible for me</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSort((value) => value === "deadline" ? "newest" : "deadline")} style={styles.sortControl}>
          <Ionicons name="swap-vertical" size={17} color={BLUE} /><Text style={styles.sortText}>{sort === "deadline" ? "Deadline first" : "Newest first"}</Text>
        </TouchableOpacity>
      </View>
    </View>}

    <ScrollView
      style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: 34 + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BLUE} />}
      keyboardShouldPersistTaps="handled"
    >
      {tab === "organizer" && analytics && <View style={styles.statsCard}>
        {[["Your listings", analytics.totalOpportunities], ["Published", analytics.activeOpportunities], ["Registrations", analytics.registrations], ["Entries", analytics.submissions]].map(([label, value]) => <View key={String(label)} style={styles.statItem}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}
      </View>}
      {tab === "mine" && <Text style={styles.sectionIntro}>Your registrations, activity updates, submissions, and results.</Text>}
      {tab === "saved" && <Text style={styles.sectionIntro}>Saved opportunities sorted by deadline. Revisit this list to keep track of important dates.</Text>}
      {loading ? <View style={styles.centerState}><ActivityIndicator size="large" color={BLUE} /><Text style={styles.stateText}>Loading opportunities…</Text></View> : error ? <View style={styles.centerState}><Ionicons name="cloud-offline-outline" size={34} color="#8993A3" /><Text style={styles.stateTitle}>Couldn’t load this section</Text><Text style={styles.stateText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View> : tab === "mine" ? filteredRegistrations.length ? filteredRegistrations.map((item) => <View key={item.id}>{renderCard(item)}<View style={styles.registrationInfo}><Text style={styles.registrationStatus}>Registration: {item.registrationStatus}</Text>{item.submission && <Text style={styles.registrationStatus}>Entry: {item.submission.status}{item.resultsPublished && item.submission.score !== null ? ` · Score ${item.submission.score}` : ""}</Text>}{item.resultsPublished && item.submission?.organizerFeedback ? <Text style={styles.feedbackText}>{item.submission.organizerFeedback}</Text> : null}</View></View>) : <View style={styles.emptyCard}><Ionicons name="bookmark-outline" size={32} color="#A1A9B5" /><Text style={styles.stateTitle}>No registrations yet</Text><Text style={styles.stateText}>When you register, the opportunity and its updates will appear here.</Text><TouchableOpacity onPress={() => setTab("discover")}><Text style={styles.linkText}>Browse opportunities</Text></TouchableOpacity></View> : tab === "saved" ? sortedSaved.length ? sortedSaved.map((item) => renderCard(item)) : <View style={styles.emptyCard}><Ionicons name="bookmark-outline" size={34} color="#A1A9B5" /><Text style={styles.stateTitle}>No saved opportunities</Text><Text style={styles.stateText}>Save an opportunity from its details to keep its deadline on this list.</Text><TouchableOpacity onPress={() => setTab("discover")}><Text style={styles.linkText}>Browse opportunities</Text></TouchableOpacity></View> : items.length ? <>
        {tab === "discover" && <Text style={styles.sectionIntro}>{items.length} of opportunities · all listings are organizer-provided</Text>}
        {items.map((item) => renderCard(item, tab === "organizer"))}
        {tab === "discover" && hasMore && <TouchableOpacity style={styles.loadMore} disabled={loadingMore} onPress={() => void load(true)}>{loadingMore ? <ActivityIndicator color={BLUE} /> : <Text style={styles.loadMoreText}>Load more</Text>}</TouchableOpacity>}
      </> : <View style={styles.emptyCard}><Ionicons name={tab === "organizer" ? "briefcase-outline" : "search-outline"} size={34} color="#A1A9B5" /><Text style={styles.stateTitle}>{tab === "organizer" ? "No opportunities yet" : "No matching opportunities"}</Text><Text style={styles.stateText}>{tab === "organizer" ? "Create a draft, review the preview, then publish when the details are ready." : "Try a different search or filter. New opportunities will appear here when organizers publish them."}</Text>{tab === "organizer" && <TouchableOpacity style={styles.primaryButton} onPress={() => void openEditor()}><Ionicons name="add" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Create opportunity</Text></TouchableOpacity>}</View>}
    </ScrollView>
    </>}

    <Modal visible={detailOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailOpen(false)}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Opportunity details</Text><TouchableOpacity onPress={() => setDetailOpen(false)} style={styles.closeButton}><Ionicons name="close" size={22} color="#334155" /></TouchableOpacity></View>
        {detailBusy || !detail ? <View style={styles.centerState}><ActivityIndicator size="large" color={BLUE} /></View> : <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.detailType}>{labelForType(detail.type)} · {detail.category}</Text>
          <Text style={styles.detailTitle}>{detail.title}</Text>
          <Text style={styles.detailOrganizer}>Organized by {detail.organizerName || "Navodaya Connect alumnus"}</Text>
          {!detail.isOrganizer && <TouchableOpacity style={styles.secondaryButton} onPress={() => void toggleSaved()}><Ionicons name={saved.some((item) => item.id === detail.id) ? "bookmark" : "bookmark-outline"} size={18} color={BLUE} /><Text style={styles.secondaryText}>{saved.some((item) => item.id === detail.id) ? "Remove from saved" : "Save opportunity"}</Text></TouchableOpacity>}
          <View style={styles.detailStatus}><Text style={styles.detailStatusText}>{(detail.displayStatus || detail.status).replaceAll("_", " ")}</Text><Text style={styles.detailStatusText}>{detail.format} · Individual participation</Text></View>
          <DetailSection title="About this opportunity"><Text style={styles.detailBody}>{detail.description || detail.summary}</Text></DetailSection>
          <DetailSection title="Eligibility"><Text style={styles.detailBody}>{detail.eligibility || "Eligibility details were not provided."}</Text><Text style={styles.detailBody}>Roles: {detail.eligibleRoles.map((role) => ROLE_OPTIONS.find(([key]) => key === role)?.[1] || role).join(", ")}{detail.eligibleClasses.length ? ` · Classes ${detail.eligibleClasses.join(", ")}` : ""}</Text></DetailSection>
          <DetailSection title="Dates and place"><Text style={styles.detailBody}>Registration opens: {dateLabel(detail.registrationOpensAt)}</Text><Text style={styles.detailBody}>Registration deadline: {dateLabel(detail.registrationDeadline)}</Text><Text style={styles.detailBody}>Activity: {dateLabel(detail.startsAt)} – {dateLabel(detail.endsAt)}</Text><Text style={styles.detailBody}>Timezone: {detail.timezone}{detail.location ? ` · ${detail.location}` : ""}</Text></DetailSection>
          <DetailSection title="Participation and requirements"><Text style={styles.detailBody}>Format: {detail.format}. Registration is individual.</Text>{detail.rules ? <Text style={styles.detailBody}>Rules: {detail.rules}</Text> : null}{detail.judgingCriteria ? <Text style={styles.detailBody}>Judging: {detail.judgingCriteria}</Text> : null}{detail.submissionMode !== "none" ? <Text style={styles.detailBody}>Submission: {detail.submissionMode} · Due {dateLabel(detail.submissionDeadline)}. {detail.submissionInstructions}</Text> : <Text style={styles.detailBody}>No in-app submission is configured.</Text>}</DetailSection>
          <DetailSection title="Fees, prizes and certificates"><Text style={styles.detailBody}>Fee: {detail.feeAmount ? `INR ${detail.feeAmount} - ${detail.feeDetails}` : "No fee listed"}</Text><Text style={styles.detailBody}>Prize: {detail.prizeDetails || "No prize details provided"} {detail.prizeDetails ? "(Organizer-provided information.)" : ""}</Text><Text style={styles.detailBody}>Certificate: {detail.certificateType === "external" ? `Provided externally by the organizer/provider: ${detail.certificateDetails}` : "No certificate is issued through Navodaya Connect."}</Text></DetailSection>
          {detail.deliveryMode === "external" && <View style={styles.disclosure}><Ionicons name="information-circle-outline" size={20} color="#9A5B00" /><Text style={styles.disclosureText}>External activity by {detail.externalProvider}. Enrollment, delivery, and any certificate are handled by that provider; this listing is organizer-provided and not independently verified.</Text></View>}
          {detail.registrationCount !== undefined && <Text style={styles.detailBody}>{detail.registrationCount} registered participant{detail.registrationCount === 1 ? "" : "s"}</Text>}
          {detail.isRegistered && detail.submissionMode !== "none" && <View style={styles.entryBox}><Text style={styles.sectionTitle}>Your entry</Text>{detail.submissionMode === "text" ? <TextInput style={[styles.input, styles.textArea]} multiline textAlignVertical="top" placeholder="Write your entry" value={submissionText} onChangeText={setSubmissionText} /> : <TextInput style={styles.input} autoCapitalize="none" keyboardType="url" placeholder="https://your-entry-link" value={submissionUrl} onChangeText={setSubmissionUrl} />}{detail.mySubmission && <Text style={styles.helperText}>Last submitted {dateLabel(detail.mySubmission.submittedAt)} · {detail.mySubmission.status}</Text>}{detail.canViewResults && detail.mySubmission && detail.mySubmission.score !== null && <Text style={styles.resultText}>Final score: {detail.mySubmission.score}{detail.mySubmission.organizerFeedback ? ` · ${detail.mySubmission.organizerFeedback}` : ""}</Text>}<TouchableOpacity style={styles.primaryButton} onPress={() => void submitEntry()} disabled={detailBusy}><Text style={styles.primaryButtonText}>{detail.mySubmission ? "Update entry" : "Submit entry"}</Text></TouchableOpacity></View>}
          {detail.isOrganizer ? <View style={styles.detailActions}><TouchableOpacity style={styles.secondaryButton} onPress={() => { setDetailOpen(false); void openEditor(detail); }}><Ionicons name="create-outline" size={18} color={BLUE} /><Text style={styles.secondaryText}>Edit listing</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => { setDetailOpen(false); void openManager(detail); }}><Ionicons name="people-outline" size={18} color={BLUE} /><Text style={styles.secondaryText}>Manage participants</Text></TouchableOpacity></View> : <>
            {!detail.isRegistered ? <TouchableOpacity style={[styles.primaryButton, (!detail.isEligible || detail.displayStatus !== "registration_open") && styles.disabledButton]} disabled={!detail.isEligible || detail.displayStatus !== "registration_open" || detailBusy} onPress={() => void register()}><Text style={styles.primaryButtonText}>{!detail.isEligible ? "Not eligible" : detail.deliveryMode === "external" ? "Register interest" : "Register"}</Text></TouchableOpacity> : <TouchableOpacity style={styles.secondaryButton} onPress={cancelRegistration}><Text style={styles.secondaryText}>Cancel registration</Text></TouchableOpacity>}
            {detail.deliveryMode === "external" && detail.externalUrl && <TouchableOpacity style={styles.externalButton} onPress={() => void openExternal(detail.externalUrl)}><Ionicons name="open-outline" size={17} color={PURPLE} /><Text style={styles.secondaryText}>Open provider link</Text></TouchableOpacity>}
            <TouchableOpacity style={styles.reportButton} onPress={reportOpportunity}><Ionicons name="flag-outline" size={16} color="#697586" /><Text style={styles.reportText}>Report this opportunity</Text></TouchableOpacity>
          </>}
        </ScrollView>}
      </View>
    </Modal>

    <Modal visible={editorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditorOpen(false)}>
      <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editId ? "Edit opportunity" : "Create opportunity"}</Text><TouchableOpacity onPress={() => setEditorOpen(false)} style={styles.closeButton}><Ionicons name="close" size={22} color="#334155" /></TouchableOpacity></View>
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          {preview ? <View style={styles.previewCard}><Text style={styles.detailType}>PREVIEW · {labelForType(String(form.type))}</Text><Text style={styles.detailTitle}>{String(form.title || "Opportunity title")}</Text><Text style={styles.detailOrganizer}>{String(form.summary || "Summary shown on the discovery card")}</Text><Text style={styles.detailBody}>{String(form.description || "Full description")}</Text><Text style={styles.detailBody}>Deadline: {dateLabel(String(form.registrationDeadline || ""))}</Text><Text style={styles.detailBody}>This preview is not published yet.</Text><TouchableOpacity onPress={() => setPreview(false)}><Text style={styles.linkText}>Back to edit</Text></TouchableOpacity></View> : <>
            <Text style={styles.fieldLabel}>Opportunity type</Text><View style={styles.optionWrap}>{TYPES.map(([value, title]) => <Chip key={value} title={title} active={form.type === value} onPress={() => setField("type", value)} />)}</View>
            <Field label="Category *" value={String(form.category || "")} onChangeText={(value) => setField("category", value)} placeholder="Academic, technology, arts..." />
            <Field label="Title *" value={String(form.title || "")} onChangeText={(value) => setField("title", value)} placeholder="Clear, specific title" />
            <Field label="Short summary" value={String(form.summary || "")} onChangeText={(value) => setField("summary", value)} placeholder="A short description for discovery cards" multiline />
            <Field label="Full description *" value={String(form.description || "")} onChangeText={(value) => setField("description", value)} placeholder="Objectives and what participants can expect" multiline />
            <Field label="Eligibility *" value={String(form.eligibility || "")} onChangeText={(value) => setField("eligibility", value)} placeholder="Who can participate? Include age restrictions where relevant." multiline />
            <Text style={styles.fieldLabel}>Eligible roles</Text><View style={styles.optionWrap}>{ROLE_OPTIONS.map(([value, title]) => <Chip key={value} title={title} active={(form.eligibleRoles || []).includes(value)} onPress={() => toggleStringOption("eligibleRoles", value)} />)}</View>
            <Text style={styles.fieldLabel}>Eligible student classes (optional)</Text><View style={styles.optionWrap}>{CLASS_OPTIONS.map((value) => <Chip key={value} title={`Class ${value}`} active={(form.eligibleClasses || []).includes(value)} onPress={() => toggleStringOption("eligibleClasses", value)} />)}</View>
            <Text style={styles.fieldLabel}>Participation format</Text><View style={styles.optionWrap}>{["online", "offline", "hybrid"].map((value) => <Chip key={value} title={value} active={form.format === value} onPress={() => setField("format", value)} />)}</View>
            <Field label="Venue (required for offline or hybrid)" value={String(form.location || "")} onChangeText={(value) => setField("location", value)} placeholder="Venue or meeting location" />
            <Text style={styles.helperText}>Dates should include a timezone, for example 2026-12-15T18:00:00+05:30. Leave optional dates blank.</Text>
            <Field label="Registration opens" value={String(form.registrationOpensAt || "")} onChangeText={(value) => setField("registrationOpensAt", value)} placeholder="2026-12-01T09:00:00+05:30" />
            <Field label="Registration deadline *" value={String(form.registrationDeadline || "")} onChangeText={(value) => setField("registrationDeadline", value)} placeholder="2026-12-15T18:00:00+05:30" />
            <Field label="Activity starts" value={String(form.startsAt || "")} onChangeText={(value) => setField("startsAt", value)} placeholder="2026-12-20T10:00:00+05:30" />
            <Field label="Activity ends" value={String(form.endsAt || "")} onChangeText={(value) => setField("endsAt", value)} placeholder="2026-12-20T17:00:00+05:30" />
            <Field label="Maximum participants (optional)" value={String(form.maxParticipants ?? "")} onChangeText={(value) => setField("maxParticipants", value ? Number(value) : null)} placeholder="No limit" keyboardType="numeric" />
            <Field label="Rules" value={String(form.rules || "")} onChangeText={(value) => setField("rules", value)} placeholder="Participation rules" multiline />
            <Field label="Judging criteria" value={String(form.judgingCriteria || "")} onChangeText={(value) => setField("judgingCriteria", value)} placeholder="How entries will be assessed" multiline />
            <Text style={styles.fieldLabel}>Submission format</Text><View style={styles.optionWrap}>{[["none", "No in-app entry"], ["text", "Text"], ["link", "Link"]].map(([value, title]) => <Chip key={value} title={title} active={form.submissionMode === value} onPress={() => setField("submissionMode", value)} />)}</View>
            {form.submissionMode !== "none" && <><Field label="Submission deadline" value={String(form.submissionDeadline || "")} onChangeText={(value) => setField("submissionDeadline", value)} placeholder="2026-12-20T17:00:00+05:30" /><Field label="Submission instructions" value={String(form.submissionInstructions || "")} onChangeText={(value) => setField("submissionInstructions", value)} placeholder="What participants should submit" multiline /></>}
            <Text style={styles.fieldLabel}>Activity delivery</Text><View style={styles.optionWrap}>{[["internal", "Navodaya Connect listing"], ["external", "External provider"]].map(([value, title]) => <Chip key={value} title={title} active={form.deliveryMode === value} onPress={() => setField("deliveryMode", value)} />)}</View>
            {form.deliveryMode === "external" && <><Field label="Provider name *" value={String(form.externalProvider || "")} onChangeText={(value) => setField("externalProvider", value)} placeholder="Provider / organizer" /><Field label="Provider or registration link *" value={String(form.externalUrl || "")} onChangeText={(value) => setField("externalUrl", value)} placeholder="https://..." keyboardType="url" /></>}
            <Field label="Fee in INR (0 if free)" value={String(form.feeAmount ?? 0)} onChangeText={(value) => setField("feeAmount", value ? Number(value) : 0)} placeholder="0" keyboardType="numeric" />
            {Number(form.feeAmount || 0) > 0 && <Field label="Fee details *" value={String(form.feeDetails || "")} onChangeText={(value) => setField("feeDetails", value)} placeholder="Explain payment and refund terms" multiline />}
            <Field label="Prize details (optional)" value={String(form.prizeDetails || "")} onChangeText={(value) => setField("prizeDetails", value)} placeholder="Only list confirmed prizes" multiline />
            <Text style={styles.fieldLabel}>Certificate</Text><View style={styles.optionWrap}><Chip title="No certificate" active={form.certificateType === "none"} onPress={() => { setField("certificateType", "none"); setField("certificateDetails", ""); }} /><Chip title="External provider certificate" active={form.certificateType === "external"} onPress={() => setField("certificateType", "external")} /></View>
            {form.certificateType === "external" && <Field label="Who issues it? *" value={String(form.certificateDetails || "")} onChangeText={(value) => setField("certificateDetails", value)} placeholder="External issuing organization" multiline />}
            <View style={styles.disclosure}><Ionicons name="shield-checkmark-outline" size={19} color="#7555A5" /><Text style={styles.disclosureText}>Listings are provided by the organizer. Navodaya Connect does not validate external providers, issue certificates, host custom quizzes, accept file uploads, or support team registration.</Text></View>
          </>}
          {!!editorError && <Text style={styles.errorText}>{editorError}</Text>}
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setPreview((value) => !value)}><Ionicons name="eye-outline" size={18} color={BLUE} /><Text style={styles.secondaryText}>{preview ? "Continue editing" : "Preview listing"}</Text></TouchableOpacity>
          {!preview && <View style={styles.formActions}><TouchableOpacity style={styles.draftButton} onPress={() => void saveOpportunity(false)} disabled={editorBusy}><Text style={styles.draftText}>{editorBusy ? "Saving…" : editId ? "Save changes" : "Save draft"}</Text></TouchableOpacity>{(!editId || form.status === "draft" || form.status === "published") && <TouchableOpacity style={styles.primaryButton} onPress={() => void saveOpportunity(true)} disabled={editorBusy}><Text style={styles.primaryButtonText}>{editorBusy ? "Saving…" : editId ? "Save & publish" : "Publish"}</Text></TouchableOpacity>}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={manageOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setManageOpen(false)}>
      <View style={styles.modalScreen}><View style={styles.modalHeader}><Text style={styles.modalTitle} numberOfLines={1}>Organizer tools</Text><TouchableOpacity onPress={() => { setManageOpen(false); setReviewing(null); }} style={styles.closeButton}><Ionicons name="close" size={22} color="#334155" /></TouchableOpacity></View>
        {manageBusy && !participants.length && !submissions.length ? <View style={styles.centerState}><ActivityIndicator color={BLUE} /></View> : reviewing ? <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.sectionTitle}>Review entry · {reviewing.participantName}</Text><Text style={styles.detailBody}>{reviewing.participantRole}{reviewing.participantClass ? ` · Class ${reviewing.participantClass}` : ""}</Text>{reviewing.content ? <Text style={styles.submissionContent}>{reviewing.content}</Text> : null}{reviewing.submissionUrl ? <TouchableOpacity onPress={() => void openExternal(reviewing.submissionUrl)}><Text style={styles.linkText}>Open submitted link</Text></TouchableOpacity> : null}
          <Text style={styles.fieldLabel}>Decision</Text><View style={styles.optionWrap}>{[["reviewed", "Reviewed"], ["selected", "Selected"], ["not_selected", "Not selected"]].map(([value, title]) => <Chip key={value} title={title} active={reviewStatus === value} onPress={() => setReviewStatus(value as typeof reviewStatus)} />)}</View>
          <Field label="Score (0–1000, optional)" value={reviewScore} onChangeText={setReviewScore} placeholder="Score" keyboardType="numeric"/><Field label="Feedback (shown when results publish)" value={reviewFeedback} onChangeText={setReviewFeedback} placeholder="Feedback for the participant" multiline/><TouchableOpacity style={styles.primaryButton} onPress={() => void saveReview()} disabled={manageBusy}><Text style={styles.primaryButtonText}>{manageBusy ? "Saving…" : "Save review"}</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => setReviewing(null)}><Text style={styles.secondaryText}>Back to participants</Text></TouchableOpacity>
        </ScrollView> : <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.detailTitle}>{manageTarget?.title}</Text>
          <View style={styles.statsCard}><View style={styles.statItem}><Text style={styles.statValue}>{participants.length}</Text><Text style={styles.statLabel}>Registered</Text></View><View style={styles.statItem}><Text style={styles.statValue}>{submissions.length}</Text><Text style={styles.statLabel}>Entries</Text></View></View>
          {!!manageTarget && <TouchableOpacity style={styles.secondaryButton} onPress={() => publishResults(manageTarget)}><Ionicons name="podium-outline" size={18} color={BLUE} /><Text style={styles.secondaryText}>{manageTarget.resultsPublished ? "Hide published results" : "Publish final results"}</Text></TouchableOpacity>}
          <Text style={styles.sectionTitle}>Participants</Text>{participants.length ? participants.map((person) => <View style={styles.personRow} key={person.id}><View style={styles.personIcon}><Ionicons name="person-outline" size={16} color={BLUE} /></View><View style={{ flex: 1 }}><Text style={styles.personName}>{person.fullName}</Text><Text style={styles.helperText}>{person.role}{person.class ? ` - Class ${person.class}` : ""}</Text></View></View>) : <Text style={styles.helperText}>No active registrations.</Text>}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Submissions</Text>{submissions.length ? submissions.map((entry) => <View style={styles.entryCard} key={entry.id}><View style={styles.entryHeader}><Text style={styles.personName}>{entry.participantName}</Text><Text style={styles.statusPillText}>{entry.status}</Text></View><Text style={styles.helperText}>Submitted {dateLabel(entry.submittedAt)}</Text>{entry.content ? <Text numberOfLines={4} style={styles.submissionContent}>{entry.content}</Text> : null}{entry.submissionUrl ? <TouchableOpacity onPress={() => void openExternal(entry.submissionUrl)}><Text style={styles.linkText}>Open submitted link</Text></TouchableOpacity> : null}<TouchableOpacity style={styles.smallAction} onPress={() => startReview(entry)}><Ionicons name="create-outline" size={16} color={BLUE}/><Text style={styles.smallActionText}>Review entry</Text></TouchableOpacity></View>) : <Text style={styles.helperText}>No submissions yet.</Text>}
          <Text style={styles.helperText}>Participant contact details are not exposed here.</Text>
        </ScrollView>}
      </View>
    </Modal>
  </View>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.detailSection}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#EDF0F5" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F2F4FA", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#171C2B", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSubtitle: { color: "#788397", fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
  createButton: { backgroundColor: PURPLE, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 3 },
  createText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabsScroll: { flexGrow: 0, maxHeight: 47, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#EDF0F5" },
  tabs: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 15, gap: 2 },
  tab: { minWidth: 80, paddingHorizontal: 5, paddingVertical: 13, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: BLUE }, tabText: { color: "#7B8595", fontSize: 13, fontFamily: "Inter_500Medium" }, activeTabText: { color: BLUE, fontFamily: "Inter_700Bold" },
  filterPanel: { backgroundColor: "#fff", paddingTop: 4, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: "#E9ECF2" },
  searchBox: { height: 48, flexDirection: "row", gap: 9, alignItems: "center", backgroundColor: "#F8F9FC", marginHorizontal: 16, marginTop: 8, marginBottom: 7, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: "#E7EAF0" },
  searchInput: { flex: 1, paddingVertical: 0, color: "#1B2230", fontSize: 14, fontFamily: "Inter_400Regular" },
  filterScroller: { height: 44, flexGrow: 0, flexShrink: 0 }, filterScrollerTight: { height: 40, flexGrow: 0, flexShrink: 0 },
  filterRow: { height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 7 }, filterRowTight: { height: 40, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 7 },
  chip: { height: 32, justifyContent: "center", paddingHorizontal: 12, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#E5E8EE" }, chipActive: { backgroundColor: "#ECEBFF", borderColor: "#C9C5FF" }, chipText: { color: "#697586", fontSize: 12, fontFamily: "Inter_500Medium" }, chipTextActive: { color: BLUE, fontFamily: "Inter_600SemiBold" },
  controlRow: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 1 }, eligibleControl: { flexDirection: "row", gap: 6, alignItems: "center" }, controlText: { color: "#657184", fontSize: 12, fontFamily: "Inter_500Medium" }, sortControl: { flexDirection: "row", gap: 5, alignItems: "center" }, sortText: { color: BLUE, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 16, paddingTop: 9 }, sectionIntro: { color: "#778295", fontSize: 13, marginBottom: 10, fontFamily: "Inter_400Regular" },
  card: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#EAEDF2", padding: 15, marginBottom: 12 }, cardHead: { flexDirection: "row", alignItems: "center", gap: 10 }, iconBadge: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#F0EDFF", alignItems: "center", justifyContent: "center" }, cardTitleWrap: { flex: 1 }, cardTitle: { color: "#181D2C", fontSize: 15, lineHeight: 20, fontFamily: "Inter_700Bold" }, organizerLine: { color: "#7B8595", fontSize: 11, marginTop: 3, fontFamily: "Inter_400Regular" },
  statusPill: { backgroundColor: "#F0F2F6", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 }, statusOpen: { backgroundColor: "#E7F8F0" }, statusText: { color: "#697586", fontSize: 9, textTransform: "capitalize", fontFamily: "Inter_600SemiBold" }, statusOpenText: { color: "#0C9A68" },
  cardSummary: { color: "#606C7F", fontSize: 13, lineHeight: 19, marginTop: 12, fontFamily: "Inter_400Regular" }, tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 11 }, tag: { overflow: "hidden", borderRadius: 8, backgroundColor: "#F4F2FB", paddingHorizontal: 8, paddingVertical: 5, color: "#65518F", fontSize: 10, textTransform: "capitalize", fontFamily: "Inter_500Medium" },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderColor: "#F0F2F5" }, metaItem: { flexDirection: "row", alignItems: "center", gap: 5 }, metaText: { color: "#687487", fontSize: 11, fontFamily: "Inter_500Medium" },
  organizerActions: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 }, smallAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5 }, smallActionText: { color: BLUE, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statsCard: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#fff", paddingVertical: 16, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: "#EAEDF2" }, statItem: { alignItems: "center", minWidth: 62 }, statValue: { color: PURPLE, fontSize: 19, fontFamily: "Inter_700Bold" }, statLabel: { color: "#778295", fontSize: 10, marginTop: 3, fontFamily: "Inter_500Medium" },
  registrationInfo: { backgroundColor: "#F0EFFB", marginTop: -6, marginBottom: 12, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 12 }, registrationStatus: { color: "#625587", fontSize: 12, marginTop: 3, fontFamily: "Inter_500Medium" }, feedbackText: { color: "#30394B", fontSize: 12, marginTop: 6, fontFamily: "Inter_400Regular" },
  emptyCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 26, paddingVertical: 30, borderWidth: 1, borderColor: "#EAEDF2", gap: 9 }, centerState: { alignItems: "center", justifyContent: "center", marginTop: 8, paddingHorizontal: 22, paddingVertical: 28, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#EAEDF2", gap: 10 }, stateTitle: { color: "#202637", fontSize: 16, textAlign: "center", fontFamily: "Inter_700Bold" }, stateText: { color: "#7D8797", textAlign: "center", fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" }, retryButton: { marginTop: 5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: "#EEF0FF" }, retryText: { color: BLUE, fontFamily: "Inter_600SemiBold" }, loadMore: { alignItems: "center", paddingVertical: 14 }, loadMoreText: { color: BLUE, fontFamily: "Inter_600SemiBold" }, linkText: { color: BLUE, marginTop: 8, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modalScreen: { flex: 1, backgroundColor: "#F8F9FC" }, modalHeader: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderColor: "#E9ECF1" }, modalTitle: { color: "#202637", fontSize: 17, fontFamily: "Inter_700Bold", flex: 1 }, closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F2F6", alignItems: "center", justifyContent: "center" }, modalContent: { padding: 18, paddingBottom: 32 },
  detailType: { color: PURPLE, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Inter_700Bold" }, detailTitle: { color: "#171B29", fontSize: 22, lineHeight: 28, marginTop: 6, fontFamily: "Inter_700Bold" }, detailOrganizer: { color: "#768194", fontSize: 13, marginTop: 5, lineHeight: 20, fontFamily: "Inter_400Regular" }, detailStatus: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 14, backgroundColor: "#EFEDFF", borderRadius: 12, padding: 12 }, detailStatusText: { color: "#605388", fontSize: 11, textTransform: "capitalize", fontFamily: "Inter_600SemiBold" }, detailSection: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: "#EDF0F4" }, sectionTitle: { color: "#202637", fontSize: 14, marginBottom: 8, fontFamily: "Inter_700Bold" }, detailBody: { color: "#586477", fontSize: 13, lineHeight: 20, marginTop: 3, fontFamily: "Inter_400Regular" },
  disclosure: { flexDirection: "row", gap: 8, backgroundColor: "#FFF7E8", borderRadius: 12, padding: 12, marginTop: 12 }, disclosureText: { flex: 1, color: "#765C31", fontSize: 11, lineHeight: 17, fontFamily: "Inter_400Regular" }, entryBox: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1, borderColor: "#E9ECF1" }, detailActions: { gap: 8, marginTop: 14 }, primaryButton: { backgroundColor: BLUE, minHeight: 48, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 13, paddingHorizontal: 14 }, primaryButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }, disabledButton: { backgroundColor: "#AEB6C4" }, secondaryButton: { backgroundColor: "#EEF0FF", minHeight: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10, paddingHorizontal: 12 }, secondaryText: { color: BLUE, fontSize: 13, fontFamily: "Inter_600SemiBold" }, externalButton: { borderWidth: 1, borderColor: "#D8D0EC", minHeight: 42, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 9 }, reportButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, padding: 13, marginTop: 4 }, reportText: { color: "#697586", fontSize: 12, fontFamily: "Inter_500Medium" },
  fieldWrap: { marginTop: 13 }, fieldLabel: { color: "#434E60", fontSize: 12, marginBottom: 7, fontFamily: "Inter_600SemiBold" }, input: { minHeight: 45, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", color: "#252C3B", borderWidth: 1, borderColor: "#E2E6ED", borderRadius: 11, fontSize: 13, fontFamily: "Inter_400Regular" }, textArea: { minHeight: 92, paddingTop: 12 }, helperText: { color: "#8993A2", fontSize: 11, lineHeight: 17, marginTop: 6, fontFamily: "Inter_400Regular" }, optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8, marginBottom: 5 }, previewCard: { backgroundColor: "#fff", borderRadius: 16, padding: 17, borderWidth: 1, borderColor: "#E6E9F0" }, errorText: { color: "#C43E46", marginTop: 10, fontSize: 12, fontFamily: "Inter_500Medium" }, formActions: { flexDirection: "row", gap: 10, marginTop: 10 }, draftButton: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "#D8DDE6", alignItems: "center", justifyContent: "center", marginTop: 13, backgroundColor: "#fff" }, draftText: { color: "#465267", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#EEF0F4" }, personIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EDF0FF", alignItems: "center", justifyContent: "center" }, personName: { color: "#2A3140", fontSize: 13, fontFamily: "Inter_600SemiBold" }, entryCard: { padding: 12, backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#E9ECF1", marginTop: 9 }, entryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, statusPillText: { color: "#625587", fontSize: 10, textTransform: "capitalize", fontFamily: "Inter_600SemiBold" }, submissionContent: { color: "#444E5E", backgroundColor: "#F6F7FA", padding: 11, borderRadius: 9, marginTop: 9, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" }, resultText: { color: "#17825C", marginTop: 8, fontSize: 13, fontFamily: "Inter_700Bold" },
});
