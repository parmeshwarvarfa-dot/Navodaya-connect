import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

// Recover from the common /profil typo by opening the signed-in user's Profile tab.
export default function ProfileTypoRedirect() {
  useEffect(() => {
    router.replace("/(tabs)/profile" as any);
  }, []);

  return <View style={styles.page}><ActivityIndicator color="#355BE5" /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F7FF" },
});
