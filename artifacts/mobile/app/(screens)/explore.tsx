import React from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import ExploreLandingView from "@/components/onboarding/ExploreLandingView";

export default function ExploreScreen() {
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleReplayIntro = () => {
    router.replace("/onboarding");
  };

  const handleJoinPress = (
    preferredRole?: "Student" | "Alumni" | "Teacher" | "JNV Official"
  ) => {
    const roleKey =
      preferredRole === "Student"
        ? "student"
        : preferredRole === "Alumni"
        ? "alumni"
        : preferredRole === "Teacher"
        ? "teacher"
        : preferredRole === "JNV Official"
        ? "official"
        : undefined;

    router.replace({
      pathname: "/(auth)/sign-in",
      params: roleKey ? { role: roleKey } : {},
    } as any);
  };

  return (
    <View style={styles.container}>
      <ExploreLandingView
        visible={true}
        onClose={handleClose}
        onReplayIntro={handleReplayIntro}
        onJoinPress={handleJoinPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F3FC",
  },
});
