import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type YearbookEntry, type YearbookReviewItem, type YearbookSubmission } from "@/lib/api";
import type { SocialMemory } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

export default function YearbookScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [entries, setEntries] = useState<YearbookEntry[]>([]);
  const [memories, setMemories] = useState<SocialMemory[]>([]);
  const [mine, setMine] = useState<YearbookSubmission[]>([]);
  const [queue, setQueue] = useState<YearbookReviewItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const tasks: Promise<unknown>[] = [api.yearbook.list(profile?.jnvName, profile?.jnvState)];
      if (profile?.role === "alumni" && profile.verificationStatus === "community_verified" && !!profile.communityVerifiedAt) tasks.push(api.memories.profileList(profile.uid, 50), api.yearbook.mine());
      if (profile?.role === "official") tasks.push(api.yearbook.reviewQueue());
      const result = await Promise.allSettled(tasks);
      if (result[0].status === "rejected") throw result[0].reason;
      setEntries(result[0].value as YearbookEntry[]);
      let i = 1;
      if (profile?.role === "alumni" && profile.verificationStatus === "community_verified" && !!profile.communityVerifiedAt) {
        const memoryResult = result[i++];
        if (memoryResult?.status === "fulfilled") setMemories((memoryResult.value as { items: SocialMemory[] }).items.filter((m) => m.authorId === profile.uid && m.visibility === "public"));
        const submissionResult = result[i++];
        if (submissionResult?.status === "fulfilled") setMine(submissionResult.value as YearbookSubmission[]);
      }
      const queueResult = result[i];
      if (profile?.role === "official" && queueResult?.status === "fulfilled") setQueue(queueResult.value as YearbookReviewItem[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load yearbook."); }
    finally { setBusy(false); }
  }, [profile]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const top = Platform.OS === "web" ? 0 : insets.top;
  const send = async (action: string, fn: () => Promise<unknown>, success: string) => {
    if (pending) return;
    setPending(action); setNotice("");
    try { await fn(); setNotice(success); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : "The request failed."); }
    finally { setPending(""); }
  };
  return <View style={s.page}>
    <View style={[s.header, { paddingTop: top + 8 }]}><TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={21} color="#172033" /></TouchableOpacity><View><Text style={s.title}>Digital Yearbook</Text><Text style={s.subtitle}>{profile?.jnvName || "Navodaya memories"}</Text></View></View>
    {busy ? <ActivityIndicator color="#3D5AF1" style={{ marginTop: 32 }} /> : <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      <View style={s.info}><Ionicons name="images-outline" size={20} color="#4B5ED7" /><Text style={s.infoText}>Only public Memories explicitly submitted by verified alumni and approved by an assigned JNV official appear here.</Text></View>
      {!!error && <Text style={s.error}>{error} <Text onPress={() => void load()} style={s.link}>Retry</Text></Text>}
      {!!notice && <Text style={s.notice}>{notice}</Text>}
      {profile?.role === "alumni" && profile.verificationStatus === "community_verified" && !!profile.communityVerifiedAt && <>
        <Text style={s.section}>Submit an existing public Memory</Text>
        {memories.filter((m) => m.mediaUrls?.length).map((memory) => {
          const submitted = mine.some((item) => item.memoryId === memory.id);
          return <View key={memory.id} style={s.memoryRow}>{memory.mediaUrls?.[0] ? <Image source={{ uri: memory.mediaUrls[0] }} style={s.thumb} /> : null}<View style={{ flex: 1 }}><Text style={s.memoryCaption} numberOfLines={2}>{memory.caption || "Memory without a caption"}</Text><Text style={s.status}>{submitted ? `Submission ${mine.find((x) => x.memoryId === memory.id)?.status}` : "Public Memory"}</Text></View><TouchableOpacity disabled={submitted || !!pending} onPress={() => void send(memory.id, () => api.yearbook.submit(memory.id), "Submitted for school review.")} style={[s.action, submitted && s.actionDisabled]}><Text style={s.actionText}>{pending === memory.id ? "…" : submitted ? "Sent" : "Submit"}</Text></TouchableOpacity></View>;
        })}
        {mine.length > 0 && <><Text style={s.section}>My submissions</Text>{mine.map((item) => <View key={item.id} style={s.submission}><Text style={s.memoryCaption}>{item.caption || "Memory"} · {item.cohortYear}</Text><Text style={s.status}>{item.status}{item.reviewNote ? ` · ${item.reviewNote}` : ""}</Text>{item.status === "pending" && <Text onPress={() => void send(item.id, () => api.yearbook.withdraw(item.id), "Submission withdrawn.")} style={s.link}>{pending === item.id ? "Withdrawing…" : "Withdraw"}</Text>}</View>)}</>}
      </>}
      {profile?.role === "official" && <><Text style={s.section}>Pending school review ({queue.length})</Text>{queue.map((item) => <View key={item.id} style={s.submission}><Text style={s.memoryCaption}>{item.authorName} · {item.cohortYear}</Text><Text style={s.status}>{item.caption || "Memory without a caption"}</Text><View style={s.actions}><TouchableOpacity style={s.action} disabled={!!pending} onPress={() => void send(item.id, () => api.yearbook.review(item.id, "approved"), "Memory approved.")}><Text style={s.actionText}>Approve</Text></TouchableOpacity><TouchableOpacity style={[s.action, s.reject]} disabled={!!pending} onPress={() => void send(item.id, () => api.yearbook.review(item.id, "rejected", "Does not meet yearbook guidelines."), "Memory rejected.")}><Text style={s.actionText}>Reject</Text></TouchableOpacity></View></View>)}</>}
      <Text style={s.section}>Approved memories · {entries.length}</Text>
      {!entries.length ? <View style={s.empty}><Ionicons name="book-outline" size={28} color="#9BA6B8"/><Text style={s.emptyTitle}>No approved yearbook memories yet</Text><Text style={s.status}>Approved contributions will appear here.</Text></View> : entries.map((entry) => <View key={entry.id} style={s.entry}>{entry.mediaUrls[0] ? <Image source={{ uri: entry.mediaUrls[0] }} style={s.photo} resizeMode="cover" /> : null}<Text style={s.memoryCaption}>{entry.caption || "Navodaya memory"}</Text><Text style={s.status}>{entry.author.fullName} · {entry.cohortYear}</Text></View>)}
    </ScrollView>}
  </View>;
}

const s = StyleSheet.create({ page: { flex: 1, backgroundColor: "#F5F6FA" }, header: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 13, borderBottomWidth: 1, borderColor: "#EEF0F4" }, back: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F2F4F8", alignItems: "center", justifyContent: "center" }, title: { color: "#172033", fontSize: 18, fontFamily: "Inter_700Bold" }, subtitle: { color: "#778196", fontSize: 12, marginTop: 2 }, info: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 13, backgroundColor: "#EEF2FF", marginBottom: 16 }, infoText: { flex: 1, color: "#4B5B86", fontSize: 12, lineHeight: 17 }, section: { color: "#172033", fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 16, marginBottom: 10 }, memoryRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, marginBottom: 9, backgroundColor: "#fff", borderRadius: 14 }, thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: "#EEF0F4" }, memoryCaption: { color: "#172033", fontSize: 13, fontFamily: "Inter_600SemiBold" }, status: { color: "#748096", fontSize: 11, marginTop: 4 }, action: { backgroundColor: "#3D5AF1", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }, actionDisabled: { backgroundColor: "#AAB3C2" }, actionText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }, submission: { backgroundColor: "#fff", borderRadius: 14, padding: 13, marginBottom: 9 }, link: { color: "#3D5AF1", fontSize: 12, paddingTop: 8 }, actions: { flexDirection: "row", gap: 8, marginTop: 12 }, reject: { backgroundColor: "#C2413A" }, entry: { backgroundColor: "#fff", borderRadius: 14, padding: 11, marginBottom: 10 }, photo: { width: "100%", height: 210, borderRadius: 10, backgroundColor: "#EEF0F4", marginBottom: 9 }, empty: { alignItems: "center", padding: 22, gap: 7, backgroundColor: "#fff", borderRadius: 14 }, emptyTitle: { color: "#344054", fontSize: 14, fontFamily: "Inter_600SemiBold" }, error: { color: "#B42318", padding: 8 }, notice: { color: "#344054", padding: 8 } });
