import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedText as Text } from "@/components/ThemedNative";

const SETTINGS_KEY = "memories_preferences_v1";

type Preferences = {
  autoplayVideos: boolean;
  dataSaver: boolean;
};

const DEFAULTS: Preferences = { autoplayVideos: true, dataSaver: false };

export default function MemoriesSettingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SETTINGS_KEY).then((value) => {
      if (!active || !value) return;
      try {
        const parsed: unknown = JSON.parse(value);
        if (parsed && typeof parsed === "object") {
          setPreferences({
            autoplayVideos: (parsed as Partial<Preferences>).autoplayVideos ?? DEFAULTS.autoplayVideos,
            dataSaver: (parsed as Partial<Preferences>).dataSaver ?? DEFAULTS.dataSaver,
          });
        }
      } catch {
        Alert.alert("Settings unavailable", "Saved Memories settings could not be read. Default preferences are active.");
      }
    }).catch(() => {
      if (active) Alert.alert("Settings unavailable", "Could not load Memories settings. Default preferences are active.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const updatePreference = async (key: keyof Preferences, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      await queryClient.invalidateQueries({ queryKey: ["memories-preferences"] });
    } catch {
      setPreferences(preferences);
      Alert.alert("Could not save setting", "Please check your device storage and try again.");
    }
  };

  return (
    <View style={[styles.page, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color="#34205F" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Memories settings</Text>
          <Text style={styles.subtitle}>Personalize your community feed</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color="#7C3AED" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Playback and data</Text>
          <PreferenceRow
            icon="play-circle-outline"
            title="Autoplay Reels"
            description="Play the active Reel when it opens."
            value={preferences.autoplayVideos}
            onChange={(value) => void updatePreference("autoplayVideos", value)}
          />
          <PreferenceRow
            icon="cellular-outline"
            title="Data saver"
            description="Avoid loading video previews in the Reels grid."
            value={preferences.dataSaver}
            onChange={(value) => void updatePreference("dataSaver", value)}
          />
          <Text style={styles.sectionTitle}>Privacy and notifications</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/(screens)/privacy-settings" as any)}>
            <View style={styles.iconBox}><Ionicons name="eye-outline" size={19} color="#6D28D9" /></View>
            <View style={styles.rowText}><Text style={styles.rowTitle}>Content visibility</Text><Text style={styles.rowDescription}>Manage profile visibility, followers, and blocked accounts.</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#9A90AA" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push("/(screens)/notification-settings" as any)}>
            <View style={styles.iconBox}><Ionicons name="notifications-outline" size={19} color="#6D28D9" /></View>
            <View style={styles.rowText}><Text style={styles.rowTitle}>Notification preferences</Text><Text style={styles.rowDescription}>Choose which social updates can notify you.</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#9A90AA" />
          </TouchableOpacity>
          <Text style={styles.note}>These playback preferences are stored on this device. Privacy and notification controls use your existing account settings.</Text>
        </ScrollView>
      )}
    </View>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.iconBox}><Ionicons name={icon} size={19} color="#6D28D9" /></View>
      <View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDescription}>{description}</Text></View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: "#A78BFA", false: "#D8D2E0" }} thumbColor={value ? "#6D28D9" : "#fff"} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAF8FF" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1ECF9", alignItems: "center", justifyContent: "center" },
  title: { color: "#211B45", fontSize: 19, fontWeight: "800" },
  subtitle: { color: "#756B84", fontSize: 11, marginTop: 3 },
  content: { paddingHorizontal: 17, paddingBottom: 45 },
  sectionTitle: { color: "#715B90", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  preferenceRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 12, marginBottom: 8 },
  linkRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 12, marginBottom: 8 },
  iconBox: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#F1ECF9", alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowTitle: { color: "#34244A", fontSize: 13, fontWeight: "800" },
  rowDescription: { color: "#81768E", fontSize: 10, lineHeight: 15, marginTop: 4 },
  note: { color: "#82768F", fontSize: 11, lineHeight: 17, marginTop: 16, paddingHorizontal: 3 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
