import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { Group } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";

export default function GroupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [classStr, setClassStr] = useState("");
  const [creating, setCreating] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fetchGroups = async () => {
    try {
      const data = await api.groups.list();
      setGroups(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleCreateGroup = async () => {
    if (!name.trim() || !subject.trim()) {
      Alert.alert("Error", "Please fill group name and subject");
      return;
    }
    setCreating(true);
    try {
      await api.groups.create({ name: name.trim(), subject: subject.trim(), class: classStr.trim() || undefined });
      setShowCreate(false);
      setName("");
      setSubject("");
      setClassStr("");
      fetchGroups();
    } catch {
      Alert.alert("Error", "Failed to create group");
    }
    setCreating(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Groups</Text>
          {profile?.role === "teacher" && (
            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No groups yet</Text>
              {profile?.role === "teacher" && (
                <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
                  Create a group for your students
                </Text>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/(screens)/group-chat?id=${item.id}&name=${encodeURIComponent(item.name)}` as any)}
          >
            <PremiumCard style={styles.groupCard}>
              <View style={styles.groupRow}>
                <View style={[styles.groupIconBg, { backgroundColor: colors.accent }]}>
                  <Ionicons name="people" size={22} color={colors.primary} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={[styles.groupName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.groupSub, { color: colors.mutedForeground }]}>
                    {item.subject}{item.class ? ` • ${item.class}` : ""}
                  </Text>
                  <Text style={[styles.groupMeta, { color: colors.mutedForeground }]}>
                    {item.jnvName} • {item.memberCount ?? 1} members
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </View>
            </PremiumCard>
          </TouchableOpacity>
        )}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Group</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <PremiumInput label="Group Name" value={name} onChangeText={setName} placeholder="e.g. Science Class 10" icon="people-outline" />
            <PremiumInput label="Subject" value={subject} onChangeText={setSubject} placeholder="e.g. Mathematics" icon="book-outline" />
            <PremiumInput label="Class (optional)" value={classStr} onChangeText={setClassStr} placeholder="e.g. Class 10" icon="school-outline" />
            <PremiumButton title="Create Group" onPress={handleCreateGroup} loading={creating} style={{ marginTop: 8 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  createBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  groupCard: { marginBottom: 10 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  groupIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  groupSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  groupMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySubText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
});
