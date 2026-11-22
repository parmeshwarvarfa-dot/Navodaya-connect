import React from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PrototypeLaunchSequence from "@/components/onboarding/PrototypeLaunchSequence";

export default function OnboardingScreen() {
  const handleContinueAuth = async (
    role: "student" | "alumni" | "teacher" | "official",
    phoneOrEmail?: string
  ) => {
    await AsyncStorage.setItem("onboarding_done", "1");
    router.replace({
      pathname: "/(auth)/sign-in",
      params: {
        role,
        ...(phoneOrEmail ? { phone: phoneOrEmail } : {}),
      },
    } as any);
  };

  return (
    <View style={styles.container}>
      <PrototypeLaunchSequence onContinueAuth={handleContinueAuth} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#12063A",
  },
});
