import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api, type RecognitionAdminPoint, type RecognitionAward, type RecognitionLeader, type RecognitionRule, type RecognitionSummary } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Tab = "month" | "categories" | "annual" | "history" | "awards" | "hall" | "admin";
const CATEGORY_LABELS: Record<string, string> = {
  month_overall: "🌟 Navodayan of the Month", community_helper: "🤝 Community Helper",
  mentor: "🎓 Best Mentor", career: "💼 Career Contributor", social_impact: "❤️ Social Impact Champion", year: "🏆 Navodayan of the Year",
};
const CATEGORY_KEYS = ["month_overall", "community_helper", "mentor", "career", "social_impact"];
const monthNow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date());
const indiaYear = () => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(new Date()));
const previousMonth = () => { const [year, month] = monthNow().split("-").map(Number); return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`; };

export default function AlumniContributionsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ section?: string }>();
  const sectionToTab: Record<string, Tab> = { history: "history", awards: "awards", leaderboard: "month", hall: "hall" };
  const [tab, setTab] = useState<Tab>(() => sectionToTab[String(params.section ?? "")] ?? "month");
  const [category, setCategory] = useState("month_overall");
  const [summary, setSummary] = useState<RecognitionSummary | null>(null);
  const [leaders, setLeaders] = useState<RecognitionLeader[]>([]);
  const [hall, setHall] = useState<RecognitionAward[]>([]);
  const [rules, setRules] = useState<RecognitionRule[]>([]);
  const [candidates, setCandidates] = useState<RecognitionAward[]>([]);
  const [month, setMonth] = useState(monthNow());
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  const [rankingOffset, setRankingOffset] = useState<number | null>(null);
  const [historyOffset, setHistoryOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [finalizeTarget, setFinalizeTarget] = useState<RecognitionAward | null>(null);
  const [pointToReverse, setPointToReverse] = useState<RecognitionAdminPoint | null>(null);
  const [ruleToEdit, setRuleToEdit] = useState<RecognitionRule | null>(null);
  const [adminPoints, setAdminPoints] = useState<RecognitionAdminPoint[]>([]);
  const [awardHistory, setAwardHistory] = useState<RecognitionAward[]>([]);
  const [awardToRevoke, setAwardToRevoke] = useState<RecognitionAward | null>(null);
  const [rulePoints, setRulePoints] = useState("");
  const [ruleLimit, setRuleLimit] = useState("");
  const [verifiedActivityOpen, setVerifiedActivityOpen] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState("");
  const [verifiedActivity, setVerifiedActivity] = useState("help_verified");
  const [verifiedReferenceId, setVerifiedReferenceId] = useState("");
  const [finalizeReason, setFinalizeReason] = useState("");
  const isOfficial = profile?.role === "official" && profile.verificationStatus === "verified";

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    const rankingMonth = tab === "annual" ? String(indiaYear()) : month;
    const jobs: Promise<unknown>[] = [api.recognition.summary(), api.recognition.leaderboard(rankingMonth, tab === "categories" ? category : tab === "annual" ? "year" : "month_overall"), api.recognition.hallOfFame()];
    if (isOfficial && tab === "admin") jobs.push(api.recognition.adminReview());
    const results = await Promise.allSettled(jobs);
    if (results[0].status === "fulfilled") {
      const data = results[0].value as RecognitionSummary;
      setSummary(data); setHistoryOffset(data.nextHistoryOffset);
    }
    if (results[1].status === "fulfilled") {
      const rankings = results[1].value as { rows: RecognitionLeader[]; currentUserRank: number | null; nextOffset: number | null; rules: RecognitionRule[] };
      setLeaders(rankings.rows); setCurrentRank(rankings.currentUserRank); setRankingOffset(rankings.nextOffset); setRules(rankings.rules);
    }
    if (results[2].status === "fulfilled") setHall(results[2].value as RecognitionAward[]);
    if (isOfficial && tab === "admin" && results[3]?.status === "fulfilled") {
      const review = results[3].value as { candidates: RecognitionAward[]; rules: RecognitionRule[]; points: RecognitionAdminPoint[]; history: RecognitionAward[] };
      setCandidates(review.candidates); setRules(review.rules); setAdminPoints(review.points); setAwardHistory(review.history);
    }
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setError(failed.reason instanceof Error ? failed.reason.message : "Recognition data could not be loaded");
    setLoading(false); setRefreshing(false);
  }, [month, category, tab, isOfficial]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const next = sectionToTab[String(params.section ?? "")]; if (next) setTab(next); }, [params.section]);

  const prepareMonth = async () => {
    try { const result = await api.recognition.prepareMonth(previousMonth()); Alert.alert("Monthly review ready", `${result.candidatesCreated} candidate records are ready for review.`); await load(true); }
    catch (e) { Alert.alert("Could not prepare monthly review", e instanceof Error ? e.message : "Try again."); }
  };
  const prepareYear = async () => {
    const year = indiaYear() - 1;
    try { await api.recognition.prepareYear(year); Alert.alert("Annual review ready", `The ${year} competition candidate is ready for official review before the 13 April announcement.`); await load(true); }
    catch (e) { Alert.alert("Could not prepare annual review", e instanceof Error ? e.message : "Try again."); }
  };
  const finalize = (award: RecognitionAward) => { setFinalizeTarget(award); setFinalizeReason(""); };
  const editRule = (rule: RecognitionRule) => { setRuleToEdit(rule); setRulePoints(String(rule.points)); setRuleLimit(String(rule.dailyLimit)); setFinalizeReason(""); };
  const submitFinalization = async () => {
    if (!finalizeTarget || finalizeReason.trim().length < 5) return;
    try { await api.recognition.finalize(finalizeTarget.id, finalizeReason.trim()); setFinalizeTarget(null); await load(true); Alert.alert("Award finalized", "The winner is now in the Hall of Fame and has been notified."); }
    catch (e) { Alert.alert("Could not finalize award", e instanceof Error ? e.message : "Try again."); }
  };
  const submitReversal = async () => {
    if (!pointToReverse || finalizeReason.trim().length < 5) return;
    try { await api.recognition.reversePoints(pointToReverse.id, finalizeReason.trim()); setPointToReverse(null); await load(true); }
    catch (e) { Alert.alert("Could not reverse points", e instanceof Error ? e.message : "Try again."); }
  };
  const submitAwardCorrection = async () => {
    if (!awardToRevoke || finalizeReason.trim().length < 5) return;
    try { await api.recognition.revokeAward(awardToRevoke.id, finalizeReason.trim()); setAwardToRevoke(null); await load(true); }
    catch (e) { Alert.alert("Could not correct award", e instanceof Error ? e.message : "Try again."); }
  };
  const submitVerifiedActivity = async () => {
    if (finalizeReason.trim().length < 10) return;
    try {
      await api.recognition.awardVerified({ userId: verifiedUserId.trim(), activity: verifiedActivity, referenceId: verifiedReferenceId.trim(), reason: finalizeReason.trim() });
      setVerifiedActivityOpen(false); setVerifiedUserId(""); setVerifiedReferenceId(""); setFinalizeReason(""); await load(true);
    } catch (e) { Alert.alert("Could not verify contribution", e instanceof Error ? e.message : "Check the account and evidence record IDs."); }
  };
  const submitRule = async () => {
    if (!ruleToEdit || !Number.isInteger(Number(rulePoints)) || !Number.isInteger(Number(ruleLimit)) || finalizeReason.trim().length < 5) return;
    try { await api.recognition.updateRule(ruleToEdit.activity, { points: Number(rulePoints), dailyLimit: Number(ruleLimit), enabled: ruleToEdit.enabled === "true", reason: finalizeReason.trim() }); setRuleToEdit(null); await load(true); }
    catch (e) { Alert.alert("Could not update rule", e instanceof Error ? e.message : "Try again."); }
  };
  const loadMoreRanking = async () => {
    if (rankingOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const rankingMonth = tab === "annual" ? String(indiaYear()) : month;
      const result = await api.recognition.leaderboard(rankingMonth, tab === "categories" ? category : tab === "annual" ? "year" : "month_overall", rankingOffset);
      setLeaders((current) => [...current, ...result.rows]); setRankingOffset(result.nextOffset);
    } catch (e) { Alert.alert("Could not load more rankings", e instanceof Error ? e.message : "Try again."); }
    finally { setLoadingMore(false); }
  };
  const loadMoreHistory = async () => {
    if (historyOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.recognition.summary(historyOffset);
      setSummary((current) => current ? { ...current, history: [...current.history, ...page.history], nextHistoryOffset: page.nextHistoryOffset } : page);
      setHistoryOffset(page.nextHistoryOffset);
    } catch (e) { Alert.alert("Could not load more history", e instanceof Error ? e.message : "Try again."); }
    finally { setLoadingMore(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "month", label: "Monthly" }, { key: "categories", label: "Categories" }, { key: "annual", label: "Annual" },
    { key: "history", label: "Points History" }, { key: "awards", label: "My Awards" }, { key: "hall", label: "Hall of Fame" }, ...(isOfficial ? [{ key: "admin" as Tab, label: "Review" }] : []),
  ];
  const activeCategoryScore = (item: RecognitionLeader) => category === "community_helper" ? item.communityScore : category === "mentor" ? item.mentorScore : category === "career" ? item.careerScore : category === "social_impact" ? item.impactScore : item.score;
  const ruleFor = (activity: string) => rules.find((rule) => rule.activity === activity);

  return <View style={styles.page}>
    <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 8 }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={21} color="#17243A" /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.title}>Achievements & Recognition</Text><Text style={styles.subtitle}>Real contributions. Transparent recognition.</Text></View>
    </View>
    <View style={styles.hero}>
      <View style={{ flex: 1 }}><Text style={styles.heroLabel}>Your recognition points</Text><Text style={styles.points}>{summary?.totalPoints ?? "—"}</Text><Text style={styles.heroMeta}>{summary ? `${summary.monthPoints} earned this month${currentRank ? ` · rank #${currentRank}` : ""} · ${summary.awardCount ?? summary.awards.length} awards` : "Points load from verified activity"}</Text></View>
      <View style={styles.medal}><Text style={{ fontSize: 30 }}>🏅</Text></View>
    </View>
    <ScrollView horizontal style={styles.tabScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {tabs.map((item) => <TouchableOpacity key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }} style={[styles.tab, tab === item.key && styles.tabOn]} onPress={() => setTab(item.key)}><Text numberOfLines={1} style={[styles.tabText, tab === item.key && styles.tabTextOn]}>{item.label}</Text></TouchableOpacity>)}
    </ScrollView>
    <Modal visible={!!finalizeTarget || !!pointToReverse || !!ruleToEdit || !!awardToRevoke || verifiedActivityOpen} transparent animationType="fade" onRequestClose={() => { setFinalizeTarget(null); setPointToReverse(null); setRuleToEdit(null); setAwardToRevoke(null); setVerifiedActivityOpen(false); }}>
      <View style={styles.modalScrim}><View style={styles.modalCard}><Text style={styles.cardTitle}>{finalizeTarget ? "Finalize award" : pointToReverse ? "Reverse points" : awardToRevoke ? "Correct award record" : verifiedActivityOpen ? "Verify contribution" : "Edit scoring rule"}</Text><Text style={styles.muted}>{finalizeTarget ? "Confirm the ledger review. This publishes the winner and notifies them." : pointToReverse ? `Reverse ${pointToReverse.points} points for ${pointToReverse.userName}.` : awardToRevoke ? `Revoke ${awardToRevoke.category} for ${awardToRevoke.period}. The prior record stays in the audit history and can be prepared again.` : verifiedActivityOpen ? "Verify a real contribution using an existing evidence record. The configured points value is applied by the server." : "Update points, daily limit, or enabled status."}</Text>{ruleToEdit && <><TextInput keyboardType="numeric" value={rulePoints} onChangeText={setRulePoints} placeholder="Points" style={styles.reasonInput} /><TextInput keyboardType="numeric" value={ruleLimit} onChangeText={setRuleLimit} placeholder="Daily limit" style={styles.reasonInput} /><TouchableOpacity onPress={() => setRuleToEdit({ ...ruleToEdit, enabled: ruleToEdit.enabled === "true" ? "false" : "true" })}><Text style={styles.editText}>Rule is {ruleToEdit.enabled === "true" ? "enabled (tap to disable)" : "disabled (tap to enable)"}</Text></TouchableOpacity></>}{verifiedActivityOpen && <TextInput value={verifiedUserId} onChangeText={setVerifiedUserId} placeholder="Recipient account ID" style={styles.reasonInput} />}{verifiedActivityOpen && <><TouchableOpacity style={styles.secondary} onPress={() => { const values = ["help_verified", "job_verified", "mentorship_verified", "event_success_verified", "scholarship_verified", "initiative_verified"]; setVerifiedActivity(values[(values.indexOf(verifiedActivity) + 1) % values.length]); }}><Text style={styles.secondaryText}>Activity: {verifiedActivity.replaceAll("_", " ")} (tap to change)</Text></TouchableOpacity><TextInput value={verifiedReferenceId} onChangeText={setVerifiedReferenceId} placeholder="Evidence record ID" style={styles.reasonInput} /></>}<TextInput value={finalizeReason} onChangeText={setFinalizeReason} placeholder="Required reason (at least 10 characters for verified activities)" multiline style={[styles.reasonInput, { minHeight: 70 }]} /><TouchableOpacity style={styles.primary} onPress={() => void (finalizeTarget ? submitFinalization() : pointToReverse ? submitReversal() : awardToRevoke ? submitAwardCorrection() : verifiedActivityOpen ? submitVerifiedActivity() : submitRule())}><Text style={styles.primaryText}>{finalizeTarget ? "Confirm and publish" : pointToReverse ? "Record reversal" : awardToRevoke ? "Revoke and record correction" : verifiedActivityOpen ? "Record verified points" : "Save rule"}</Text></TouchableOpacity><TouchableOpacity style={styles.cancel} onPress={() => { setFinalizeTarget(null); setPointToReverse(null); setRuleToEdit(null); setAwardToRevoke(null); setVerifiedActivityOpen(false); }}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity></View></View>
    </Modal>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading && !refreshing ? <ActivityIndicator color="#7C3AED" style={{ marginTop: 35 }} /> : <>
        {(tab === "month" || tab === "categories" || tab === "annual") && <>
          {tab === "categories" && <ScrollView horizontal style={styles.categoryScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabs}>{CATEGORY_KEYS.map((key) => <TouchableOpacity key={key} accessibilityRole="tab" accessibilityState={{ selected: category === key }} style={[styles.categoryChip, category === key && styles.categoryChipOn]} onPress={() => setCategory(key)}><Text numberOfLines={1} style={[styles.categoryText, category === key && styles.categoryTextOn]}>{CATEGORY_LABELS[key]}</Text></TouchableOpacity>)}</ScrollView>}
          <View style={styles.infoCard}><Text style={styles.cardTitle}>{tab === "annual" ? "Annual competition" : tab === "categories" ? CATEGORY_LABELS[category] : "This month’s overall ranking"}</Text><Text style={styles.muted}>{tab === "annual" ? "Competition period: 1 January–31 December. Winner announced on 13 April after authorized review." : `Calendar month: ${month}. Monthly results are reviewed after the month ends; they do not wait for Foundation Day.`}</Text>{tab !== "annual" && <TouchableOpacity style={styles.monthPicker} onPress={() => { const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() - 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}><Ionicons name="chevron-back" size={16} color="#7C3AED" /><Text style={styles.monthText}>{month}</Text><TouchableOpacity onPress={() => setMonth(monthNow())}><Text style={styles.monthReset}>Current month</Text></TouchableOpacity></TouchableOpacity>}</View>
          {leaders.length ? leaders.map((item, index) => <View key={item.userId} style={[styles.row, item.userId === profile?.uid && styles.myRow]}><Text style={styles.rank}>{index + 1}</Text><View style={styles.avatar}><Text style={styles.avatarText}>{item.fullName.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{item.fullName}{item.userId === profile?.uid ? " (You)" : ""}</Text><Text style={styles.muted}>{item.role} · {item.jnvName}</Text></View><View style={styles.score}><Text style={styles.scoreText}>{tab === "categories" ? activeCategoryScore(item) : item.score}</Text><Text style={styles.muted}>points</Text></View></View>) : <Text style={styles.empty}>No eligible contributions recorded for this competition period yet.</Text>}
          {rankingOffset !== null && <TouchableOpacity style={styles.moreButton} onPress={() => void loadMoreRanking()}><Text style={styles.moreText}>{loadingMore ? "Loading…" : "Load more rankings"}</Text></TouchableOpacity>}
        </>}
        {tab === "history" && <><Text style={styles.sectionTitle}>Your points history</Text>{summary?.history.length ? summary.history.map((entry) => <View key={entry.id} style={styles.historyRow}><View style={{ flex: 1 }}><Text style={styles.name}>{entry.reason}</Text><Text style={styles.muted}>{entry.activity.replaceAll("_", " ")} · {entry.periodMonth} · {new Date(entry.createdAt).toLocaleDateString()}</Text></View><Text style={[styles.delta, entry.points < 0 && { color: "#DC2626" }]}>{entry.points > 0 ? "+" : ""}{entry.points}</Text></View>) : <Text style={styles.empty}>No points activity yet. Eligible activities and any reversals will appear here.</Text>}{historyOffset !== null && <TouchableOpacity style={styles.moreButton} onPress={() => void loadMoreHistory()}><Text style={styles.moreText}>{loadingMore ? "Loading…" : "Load more history"}</Text></TouchableOpacity>}</>}
        {tab === "awards" && <><Text style={styles.sectionTitle}>My Awards and earned badges</Text>{summary?.awards.length ? summary.awards.map((award) => <View key={award.id} style={styles.awardRow}><Text style={{ fontSize: 22 }}>🏆</Text><View style={{ flex: 1 }}><Text style={styles.name}>{CATEGORY_LABELS[award.category] ?? award.category}</Text><Text style={styles.muted}>{award.period} · {award.score} points</Text><Text style={styles.muted}>{award.summary}</Text></View></View>) : <Text style={styles.empty}>No finalized awards yet. Monthly winners and Navodayan of the Year recognition will appear here.</Text>}</>}
        {tab === "hall" && <><Text style={styles.sectionTitle}>Hall of Fame</Text>{hall.length ? hall.map((award) => <View key={award.id} style={styles.awardCard}><View style={styles.awardIcon}><Text style={{ fontSize: 23 }}>🏆</Text></View><View style={{ flex: 1 }}><Text style={styles.awardCategory}>{CATEGORY_LABELS[award.category] ?? award.category}</Text><Text style={styles.name}>{award.winnerName}</Text><Text style={styles.muted}>{award.period}{award.jnvName ? ` · ${award.jnvName}` : ""} · {award.score} points</Text><Text style={styles.muted}>{award.summary}</Text></View></View>) : <Text style={styles.empty}>No finalized awards yet. Monthly category winners and annual winners will be preserved here.</Text>}</>}
        {tab === "admin" && isOfficial && <><Text style={styles.sectionTitle}>Recognition review</Text><Text style={styles.muted}>Candidate records are not public until you validate the ledger and finalize them. Monthly awards are reviewed every month; the annual award is published on 13 April.</Text><View style={styles.adminActions}><TouchableOpacity style={styles.primary} onPress={() => { setVerifiedActivityOpen(true); setFinalizeReason(""); }}><Text style={styles.primaryText}>Record verified contribution</Text></TouchableOpacity><TouchableOpacity style={styles.secondary} onPress={() => void prepareMonth()}><Text style={styles.primaryText}>Prepare previous month</Text></TouchableOpacity><TouchableOpacity style={styles.secondary} onPress={() => void prepareYear()}><Text style={styles.secondaryText}>Prepare last year</Text></TouchableOpacity></View>{candidates.map((award) => <View key={award.id} style={styles.awardCard}><View style={{ flex: 1 }}><Text style={styles.awardCategory}>{CATEGORY_LABELS[award.category] ?? award.category} · {award.period}</Text><Text style={styles.name}>{award.winnerName ?? "Candidate"}</Text><Text style={styles.muted}>{award.score} points · {award.summary}</Text></View><TouchableOpacity style={styles.finalize} onPress={() => finalize(award)}><Text style={styles.finalizeText}>Finalize</Text></TouchableOpacity></View>)}{!candidates.length && <Text style={styles.empty}>No candidates waiting for review.</Text>}<Text style={styles.sectionTitle}>Point values and daily limits</Text>{rules.map((rule) => <View key={rule.activity} style={styles.historyRow}><View style={{ flex: 1 }}><Text style={styles.name}>{rule.activity.replaceAll("_", " ")}</Text><Text style={styles.muted}>Daily limit: {rule.dailyLimit} · {rule.enabled === "true" ? "enabled" : "disabled"}</Text></View><Text style={styles.delta}>{rule.points} pts</Text><TouchableOpacity style={styles.editButton} onPress={() => editRule(rule)}><Text style={styles.editText}>Edit</Text></TouchableOpacity></View>)}<Text style={styles.sectionTitle}>Recent ledger activity</Text>{adminPoints.map((entry) => <View key={entry.id} style={styles.historyRow}><View style={{ flex: 1 }}><Text style={styles.name}>{entry.userName} · {entry.reason}</Text><Text style={styles.muted}>{entry.periodMonth} · {entry.points} points</Text></View>{entry.points > 0 && <TouchableOpacity style={styles.reverseButton} onPress={() => { setPointToReverse(entry); setFinalizeReason(""); }}><Text style={styles.reverseText}>Reverse</Text></TouchableOpacity>}</View>)}<Text style={styles.sectionTitle}>Published award records</Text>{awardHistory.map((award) => <View key={award.id} style={styles.historyRow}><View style={{ flex: 1 }}><Text style={styles.name}>{CATEGORY_LABELS[award.category] ?? award.category} · {award.period}</Text><Text style={styles.muted}>{award.winnerName} · {award.status} · {award.score} points</Text></View>{award.status === "finalized" && <TouchableOpacity style={styles.reverseButton} onPress={() => { setAwardToRevoke(award); setFinalizeReason(""); }}><Text style={styles.reverseText}>Correct</Text></TouchableOpacity>}</View>)}<Text style={styles.footnote}>Rule edits, reversals, review, and finalization are stored in the audit log.</Text></>}
      </>}
      <View style={styles.rulesCard}><Text style={styles.cardTitle}>How points are earned</Text><Text style={styles.muted}>Verified complete profile +{ruleFor("profile_complete")?.points ?? "—"} once; meaningful Memory +{ruleFor("memory_post")?.points ?? "—"} (up to {ruleFor("memory_post")?.dailyLimit ?? "—"}/day); genuine received like +{ruleFor("memory_like_received")?.points ?? "—"}; meaningful received comment +{ruleFor("memory_comment_received")?.points ?? "—"}. Repetitive engagement is capped. Mentoring, jobs, scholarships, completed events, help, and initiatives require authorized verification.</Text><Text style={styles.muted}>Ties: higher category-specific score, then more eligible activities, then recipient name in alphabetical order. Private profiles are excluded from public rankings.</Text></View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8F7FF" }, header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#E9ECF2" },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }, title: { fontSize: 17, fontWeight: "700", color: "#17243A" }, subtitle: { fontSize: 11, color: "#8290A4", marginTop: 2 },
  hero: { flexDirection: "row", alignItems: "center", margin: 16, padding: 19, borderRadius: 20, backgroundColor: "#172554" }, heroLabel: { color: "#CBD5E1", fontSize: 12 }, points: { color: "#fff", fontSize: 38, fontWeight: "800", marginTop: 2 }, heroMeta: { color: "#CBD5E1", fontSize: 11 }, medal: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff2", alignItems: "center", justifyContent: "center" },
  tabScroller: { height: 58, maxHeight: 58, flexGrow: 0, flexShrink: 0 }, tabs: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 8 }, tab: { height: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: "#E6EAF2" }, tabOn: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" }, tabText: { color: "#667085", fontSize: 12, lineHeight: 16, fontWeight: "600" }, tabTextOn: { color: "#fff" },
  categoryScroller: { height: 44, maxHeight: 44, flexGrow: 0, flexShrink: 0 }, categoryTabs: { alignItems: "center", gap: 8, paddingHorizontal: 1, paddingVertical: 4 }, categoryChip: { flexShrink: 0, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "#E6EAF2" }, categoryChipOn: { backgroundColor: "#F5F3FF", borderColor: "#A5B4FC" }, categoryText: { fontSize: 11, lineHeight: 16, color: "#667085" }, categoryTextOn: { color: "#7C3AED", fontWeight: "700" },
  infoCard: { padding: 15, borderRadius: 16, backgroundColor: "#fff", marginBottom: 12, borderWidth: 1, borderColor: "#E9ECF2" }, cardTitle: { color: "#17243A", fontSize: 14, fontWeight: "700", marginBottom: 5 }, muted: { color: "#7B8799", fontSize: 11, lineHeight: 17 }, monthPicker: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }, monthText: { color: "#344054", fontSize: 12, fontWeight: "700" }, monthReset: { color: "#7C3AED", fontSize: 11, marginLeft: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 7, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ECEFF5" }, myRow: { borderColor: "#818CF8", backgroundColor: "#F5F6FF" }, rank: { width: 23, color: "#98A2B3", fontSize: 13, fontWeight: "700", textAlign: "center" }, avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#7C3AED", fontWeight: "700" }, name: { color: "#17243A", fontSize: 12, fontWeight: "700" }, score: { alignItems: "flex-end" }, scoreText: { color: "#D97706", fontSize: 17, fontWeight: "800" },
  sectionTitle: { color: "#17243A", fontSize: 16, fontWeight: "700", marginTop: 5, marginBottom: 11 }, historyRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", padding: 13, borderRadius: 13, marginBottom: 7, borderWidth: 1, borderColor: "#ECEFF5" }, delta: { color: "#059669", fontWeight: "800", fontSize: 15 }, awardRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", padding: 14, borderRadius: 14, marginBottom: 8 }, awardCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 15, padding: 14, marginTop: 8, borderWidth: 1, borderColor: "#E9ECF2" }, awardIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFF7E6", alignItems: "center", justifyContent: "center" }, awardCategory: { fontSize: 12, color: "#A16207", fontWeight: "700", marginBottom: 3 },
  empty: { color: "#8792A5", textAlign: "center", marginVertical: 24, fontSize: 13 }, error: { padding: 12, borderRadius: 12, backgroundColor: "#FEF2F2", color: "#B91C1C", marginBottom: 12, fontSize: 12 }, rulesCard: { padding: 15, borderRadius: 15, backgroundColor: "#fff", marginTop: 16, gap: 7, borderWidth: 1, borderColor: "#E9ECF2" },
  adminActions: { gap: 8, marginTop: 12, marginBottom: 8 }, primary: { backgroundColor: "#7C3AED", padding: 12, borderRadius: 12, alignItems: "center" }, primaryText: { color: "#fff", fontSize: 12, fontWeight: "700" }, secondary: { backgroundColor: "#fff", padding: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#D0D5DD" }, secondaryText: { color: "#344054", fontSize: 12, fontWeight: "700" }, finalize: { backgroundColor: "#059669", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }, finalizeText: { color: "#fff", fontSize: 11, fontWeight: "700" }, footnote: { fontSize: 10, color: "#98A2B3", marginTop: 10 },
  modalScrim: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", alignItems: "center", justifyContent: "center", padding: 20 }, modalCard: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 18, padding: 20, gap: 12 }, reasonInput: { minHeight: 90, borderColor: "#D0D5DD", borderWidth: 1, borderRadius: 10, padding: 11, textAlignVertical: "top", color: "#17243A" }, cancel: { alignItems: "center", padding: 10 }, editButton: { padding: 8, backgroundColor: "#F5F3FF", borderRadius: 8 }, editText: { color: "#7C3AED", fontSize: 11, fontWeight: "700" }, reverseButton: { padding: 8, backgroundColor: "#FEF2F2", borderRadius: 8 }, reverseText: { color: "#B91C1C", fontSize: 11, fontWeight: "700" }, moreButton: { alignItems: "center", padding: 13, backgroundColor: "#F5F3FF", borderRadius: 12, marginVertical: 8 }, moreText: { color: "#7C3AED", fontSize: 12, fontWeight: "700" },
});
