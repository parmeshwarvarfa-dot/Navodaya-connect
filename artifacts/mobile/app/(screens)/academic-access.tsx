import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AcademicAccessRedirect() {
  const insets = useSafeAreaInsets();
  useEffect(() => { router.replace("/(screens)/assign-teachers"); }, []);
  return <View style={[s.page, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 20 }]}>
    <ActivityIndicator color="#3151E8" />
    <Text style={s.label}>Opening Academic Management…</Text>
  </View>;
}

const s = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#F3F5FA" },
  label: { color: "#667085", fontSize: 13, fontFamily: "Inter_500Medium" },
});