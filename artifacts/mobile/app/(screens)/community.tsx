import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";

const PROFESSION_GROUPS = [
  {
    id: "it",
    name: "Navodaya IT Community",
    description: "For software engineers, developers, and tech professionals",
    icon: "laptop-outline",
    color: "#3B82F6",
    memberCount: 2847,
    professions: ["Engineer", "developer", "tech", "IT"],
  },
  {
    id: "medical",
    name: "Navodaya Medical Community",
    description: "Doctors, nurses, researchers, and healthcare professionals",
    icon: "medkit-outline",
    color: "#EF4444",
    memberCount: 1563,
    professions: ["Doctor", "medical", "healthcare", "nurse"],
  },
  {
    id: "upsc",
    name: "Navodaya UPSC Community",
    description: "IAS, IPS, IFS aspirants and civil servants",
    icon: "briefcase-outline",
    color: "#8B5CF6",
    memberCount: 3241,
    professions: ["IAS/IPS Officer", "UPSC", "civil service"],
  },
  {
    id: "defence",
    name: "Navodaya Defence Community",
    description: "Army, Navy, Air Force officers and aspirants",
    icon: "shield-outline",
    color: "#059669",
    memberCount: 1892,
    professions: ["Defence", "Army", "Navy", "Air Force", "NDA"],
  },
];

export default function CommunityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [joined, setJoined] = useState<string[]>([]);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (profile?.profession) {
      const autoJoin = PROFESSION_GROUPS.filter((g) =>
        g.professions.some((p) => profile.profession?.toLowerCase().includes(p.toLowerCase()))
      ).map((g) => g.id);
      setJoined(autoJoin);
    }
  }, [profile]);

  const handleJoin = (groupId: string) => {
    if (joined.includes(groupId)) {
      setJoined(joined.filter((j) => j !== groupId));
    } else {
      setJoined([...joined, groupId]);
      Alert.alert("Joined!", "You've joined this community group.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community Groups</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={styles.headerSub}>Connect with Navodayans in your field</Text>
      </LinearGradient>

      <FlatList
        data={PROFESSION_GROUPS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isJoined = joined.includes(item.id);
          return (
            <PremiumCard style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIcon, { backgroundColor: item.color + "15" }]}>
                  <Ionicons name={item.icon as any} size={28} color={item.color} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={[styles.groupName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>
                    {item.memberCount.toLocaleString()} members
                  </Text>
                </View>
              </View>
              <Text style={[styles.groupDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
              <PremiumButton
                title={isJoined ? "Joined" : "Join Community"}
                onPress={() => handleJoin(item.id)}
                variant={isJoined ? "secondary" : "primary"}
                style={{ marginTop: 12 }}
              />
            </PremiumCard>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular" },
  listContent: { padding: 16 },
  groupCard: { marginBottom: 14 },
  groupHeader: { flexDirection: "row", gap: 14, marginBottom: 10, alignItems: "center" },
  groupIcon: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 3, lineHeight: 22 },
  memberCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  groupDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
