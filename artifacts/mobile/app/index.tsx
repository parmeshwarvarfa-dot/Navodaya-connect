import { useEffect } from "react";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function IndexScreen() {
  const { user, profile, loading, isVerified } = useAuth();

  useEffect(() => {
    if (loading) return;
    (async () => {
      if (user) {
        if (isVerified) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(screens)/verification-center" as any);
        }
      } else {
        const done = await AsyncStorage.getItem("onboarding_done");
        if (done) {
          router.replace("/(auth)/sign-in");
        } else {
          router.replace("/onboarding");
        }
      }
    })();
  }, [user, loading, isVerified]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1A3C6E" }}>
      <ActivityIndicator color="#fff" size="large" />
    </View>
  );
}
