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
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

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

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <AuthNavGuard />
              <Stack screenOptions={{ headerShown: false }}>
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
  );
}
