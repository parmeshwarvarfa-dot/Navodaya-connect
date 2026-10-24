import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from "@expo-google-fonts/inter";
import { Pacifico_400Regular, useFonts as usePacificoFonts } from "@expo-google-fonts/pacifico";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { getApiOrigin, getToken } from "@/lib/api";

SplashScreen.preventAutoHideAsync();

setBaseUrl(getApiOrigin());
setAuthTokenGetter(getToken);

const queryClient = new QueryClient();

function AuthNavGuard() {
  const { user, loading } = useAuth();
  const initialized = useRef(false);
  const wasLoggedIn = useRef(false);

  useEffect(() => {
    if (loading) return;

    const isLoggedIn = !!user;

    if (!initialized.current) {
      initialized.current = true;
      wasLoggedIn.current = isLoggedIn;
      return;
    }

    if (wasLoggedIn.current && !isLoggedIn) {
      wasLoggedIn.current = false;
      router.replace("/(auth)/sign-in" as any);
    } else if (!wasLoggedIn.current && isLoggedIn) {
      wasLoggedIn.current = true;
    }
  }, [user, loading]);

  return null;
}

export default function RootLayout() {
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [pacificoLoaded, pacificoError] = usePacificoFonts({
    Pacifico_400Regular,
  });

  const loaded = (interLoaded || !!interError) && (pacificoLoaded || !!pacificoError);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  return (
    <View style={[styles.webCanvas, Platform.OS !== "web" && styles.nativeCanvas]}>
      <View style={[styles.mobileFrame, Platform.OS !== "web" && styles.nativeFrame]}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={styles.flex}>
                <AuthProvider>
                  <AuthNavGuard />
                  <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 180 }}>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(screens)" options={{ headerShown: false }} />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                </AuthProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  webCanvas: { flex: 1, alignItems: "center", backgroundColor: "#E9EDF5" },
  nativeCanvas: { backgroundColor: "#fff" },
  mobileFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#E5E7EB",
  },
  nativeFrame: { maxWidth: "100%", borderWidth: 0 },
});
