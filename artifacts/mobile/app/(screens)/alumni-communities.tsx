import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const INITIAL_COMMUNITIES = [
  { id: "1", name: "JNV Coders",       icon: "code-slash-outline"     as const, color: "#3D5AF1", bg: "#EEF2FF", members: 312, description: "Programming, open source, hackathons, career in tech.",    joined: true,  posts: 8,  category: "Tech"        },
  { id: "2", name: "Startup Network",  icon: "rocket-outline"         as const, color: "#F59E0B", bg: "#FFFBEB", members: 145, description: "Founders, side projects, funding, startup ecosystem.",       joined: false, posts: 14, category: "Startup"     },
  { id: "3", name: "UPSC Prep Group",  icon: "library-outline"        as const, color: "#8B5CF6", bg: "#F5F3FF", members: 267, description: "UPSC preparation, current affairs, strategy, motivation.",   joined: true,  posts: 22, category: "Gov/UPSC"    },
  { id: "4", name: "Healthcare Alums", icon: "medkit-outline"         as const, color: "#10B981", bg: "#ECFDF5", members: 198, description: "Doctors, nurses, medical research alumni network.",           joined: false, posts: 5,  category: "Medicine"    },
  { id: "5", name: "Defence Heroes",   icon: "shield-outline"         as const, color: "#6366F1", bg: "#EEF2FF", members: 134, description: "Army, Navy, Air Force alumni — inspiring stories & tips.",  joined: false, posts: 11, category: "Defence"     },
  { id: "6", name: "Research & PhDs",  icon: "flask-outline"          as const, color: "#0891B2", bg: "#E0F2FE", members: 87,  description: "PhD scholars, researchers, academic career guidance.",      joined: false, posts: 3,  category: "Research"    },
  { id: "7", name: "Sports Champions", icon: "football-outline"       as const, color: "#EC4899", bg: "#FDF2F8", members: 76,  description: "JNV sports alumni — athletics, national competitions.",     joined: false, posts: 7,  category: "Sports"      },
  { id: "8", name: "JNV Arts & Culture",icon: "color-palette-outline" as const, color: "#D97706", bg: "#FFFBEB", members: 59,  description: "Music, art, literature, cultural events from JNV life.",    joined: false, posts: 4,  category: "Arts"        },
];

const RECENT_DISCUSSIONS = [
  { community: "JNV Coders",      author: "Rahul V.",    text: "Anyone using React Native for mobile dev? Tips for beginners?",     time: "1h ago",    replies: 12 },
  { community: "UPSC Prep Group", author: "Kavita S.",   text: "The best newspaper for UPSC prep in 2026 — my complete guide.",     time: "3h ago",    replies: 24 },
  { community: "JNV Coders",      author: "Manish K.",   text: "Sharing my system design interview notes from Microsoft prep.",      time: "Yesterday", replies: 8  },
];

export default function AlumniCommunitiesScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const [communities, setCommunities] = useState(INITIAL_COMMUNITIES);
  const [activeTab,   setActiveTab]   = useState<"all" | "joined" | "discuss">("all");
  const [showCreate,  setShowCreate]  = useState(false);
  const [toast,       setToast]       = useState("");
  const [name,        setName]        = useState("");
  const [desc,        setDesc]        = useState("");
  const [category,    setCategory]    = useState("Tech");
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [msgText,     setMsgText]     = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const toggleJoin = (id: string) => {
    const comm = communities.find((c) => c.id === id);
    setCommunities((p) => p.map((c) => c.id === id ? { ...c, joined: !c.joined, members: c.joined ? c.members - 1 : c.members + 1 } : c));
    showToast(comm?.joined ? `Left ${comm.name}` : `Joined ${comm?.name}! Welcome 🎉`);
  };

  const createCommunity = () => {
    if (!name.trim() || !desc.trim()) return;
    setCommunities((p) => [...p, { id: Date.now().toString(), name, icon: "star-outline" as const, color: "#6B7280", bg: "#F3F4F6", members: 1, description: desc, joined: true, posts: 0, category }]);
    setName(""); setDesc(""); setShowCreate(false);
    showToast("Community created! Invite fellow alumni to join.");
  };

  const listed = activeTab === "joined" ? communities.filter((c) => c.joined) : communities;
  const CATS   = ["Tech", "Startup", "Gov/UPSC", "Medicine", "Defence", "Research", "Sports", "Arts"];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Communities & Clubs</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {([["all", "All Communities"], ["joined", "Joined"], ["discuss", "Discussions"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tabBtn, activeTab === key && styles.tabBtnActive]} onPress={() => setActiveTab(key)}>
            <Text style={[styles.tabBtnText, activeTab === key && styles.tabBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>

        {activeTab !== "discuss" && (
          <>
            <Text style={styles.sectionLabel}>{listed.length} communities</Text>
            {listed.map((c) => {
              const isEx = expandedId === c.id;
              return (
                <View key={c.id} style={[styles.commCard, c.joined && styles.commCardJoined]}>
                  <TouchableOpacity onPress={() => setExpandedId(isEx ? null : c.id)} activeOpacity={0.85}>
                    <View style={styles.commTop}>
                      <View style={[styles.commIcon, { backgroundColor: c.bg }]}>
                        <Ionicons name={c.icon} size={24} color={c.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.commNameRow}>
                          <Text style={styles.commName}>{c.name}</Text>
                          {c.joined && <View style={styles.joinedBadge}><Text style={styles.joinedBadgeText}>Joined</Text></View>}
                        </View>
                        <Text style={styles.commDesc} numberOfLines={1}>{c.description}</Text>
                        <View style={styles.commMeta}>
                          <Ionicons name="people-outline" size={11} color="#9CA3AF" />
                          <Text style={styles.commMembers}>{c.members} members</Text>
                          <Text style={styles.commDivider}>·</Text>
                          <Ionicons name="chatbubble-outline" size={11} color="#9CA3AF" />
                          <Text style={styles.commPosts}>{c.posts} posts</Text>
                        </View>
                      </View>
                      <View style={[styles.catBadge, { backgroundColor: c.color + "18" }]}>
                        <Text style={[styles.catBadgeText, { color: c.color }]}>{c.category}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {isEx && (
                    <View style={styles.expandedBody}>
                      <Text style={styles.expandedDesc}>{c.description}</Text>
                      {c.joined && (
                        <View style={styles.postInput}>
                          <TextInput style={styles.postInputField} placeholder={`Post in ${c.name}…`} placeholderTextColor="#9CA3AF" value={msgText} onChangeText={setMsgText} />
                          <TouchableOpacity style={styles.postInputBtn} onPress={() => { if (msgText.trim()) { showToast("Post shared!"); setMsgText(""); } }}>
                            <Ionicons name="send" size={16} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}
                      <TouchableOpacity style={[styles.joinBtn, c.joined && styles.leaveBtn]} onPress={() => toggleJoin(c.id)}>
                        <Ionicons name={c.joined ? "exit-outline" : "enter-outline"} size={16} color={c.joined ? "#EF4444" : "#fff"} />
                        <Text style={[styles.joinBtnText, c.joined && styles.leaveBtnText]}>{c.joined ? "Leave Community" : "Join Community"}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!isEx && (
                    <TouchableOpacity style={[styles.joinBtnInline, c.joined && styles.leaveBtnInline]} onPress={() => toggleJoin(c.id)}>
                      <Text style={[styles.joinBtnInlineText, c.joined && { color: "#EF4444" }]}>{c.joined ? "Leave" : "Join"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {activeTab === "discuss" && (
          <>
            <Text style={styles.sectionLabel}>Recent Discussions</Text>
            {RECENT_DISCUSSIONS.map((d, i) => (
              <View key={i} style={styles.discussCard}>
                <View style={styles.discussTop}>
                  <View style={styles.discussAvatar}><Text style={styles.discussAvatarText}>{d.author[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.discussAuthor}>{d.author} <Text style={styles.discussCommunity}>in {d.community}</Text></Text>
                    <Text style={styles.discussTime}>{d.time}</Text>
                  </View>
                </View>
                <Text style={styles.discussText}>{d.text}</Text>
                <View style={styles.discussFooter}>
                  <Ionicons name="chatbubble-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.replyCount}>{d.replies} replies</Text>
                  <TouchableOpacity style={styles.replyBtn}><Text style={styles.replyBtnText}>Reply</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Community</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Community Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. JNV Entrepreneurs" placeholderTextColor="#9CA3AF" value={name} onChangeText={setName} />
              <Text style={styles.fieldLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {CATS.map((c) => (
                  <TouchableOpacity key={c} style={[styles.pill, category === c && styles.pillActive]} onPress={() => setCategory(c)}>
                    <Text style={[styles.pillText, category === c && styles.pillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput style={[styles.input, { minHeight: 80 }]} placeholder="What is this community about?" placeholderTextColor="#9CA3AF" value={desc} onChangeText={setDesc} multiline textAlignVertical="top" />
              <TouchableOpacity style={styles.confirmBtn} onPress={createCommunity}>
                <Ionicons name="globe-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Create Community</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EC4899", alignItems: "center", justifyContent: "center" },
  tabBar: { flexDirection: "row", backgroundColor: "#F3F4F6", margin: 12, borderRadius: 12, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#fff" },
  tabBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
  tabBtnTextActive: { color: "#111827", fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6B7280", marginBottom: 10 },
  commCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  commCardJoined: { borderColor: "#C7D2FE", borderWidth: 1.5 },
  commTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  commIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  commNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" },
  commName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  joinedBadge: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  joinedBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  commDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 5 },
  commMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  commMembers: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  commDivider: { color: "#D1D5DB" },
  commPosts: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  catBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  catBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  expandedBody: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12, gap: 10 },
  expandedDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 19 },
  postInput: { flexDirection: "row", gap: 8 },
  postInputField: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular", color: "#111827" },
  postInputBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  joinBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 10 },
  leaveBtn: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  joinBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  leaveBtnText: { color: "#EF4444" },
  joinBtnInline: { alignSelf: "flex-end", marginTop: 8, backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  leaveBtnInline: { backgroundColor: "#FEF2F2" },
  joinBtnInlineText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  discussCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  discussTop: { flexDirection: "row", gap: 10, marginBottom: 8 },
  discussAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  discussAvatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  discussAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  discussCommunity: { fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  discussTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  discussText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 20, marginBottom: 10 },
  discussFooter: { flexDirection: "row", alignItems: "center", gap: 6 },
  replyCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", flex: 1 },
  replyBtn: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  replyBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  pillActive: { backgroundColor: "#EC4899", borderColor: "#EC4899" },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  pillTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EC4899", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
