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
import { MotionProvider } from "@/components/motion/MotionProvider";

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

  // Ensure high-fidelity Inter typography on Web (prevents chunky system/serif fallbacks)
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      if (!document.getElementById("navodaya-google-fonts")) {
        const link = document.createElement("link");
        link.id = "navodaya-google-fonts";
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
        document.head.appendChild(link);

        const style = document.createElement("style");
        style.id = "navodaya-typography-engine";
        style.textContent = `
          @font-face {
            font-family: 'Inter_400Regular';
            font-style: normal;
            font-weight: 400;
            src: local('Inter Regular'), local('Inter'),
                 url('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2') format('woff2');
          }
          @font-face {
            font-family: 'Inter_500Medium';
            font-style: normal;
            font-weight: 500;
            src: local('Inter Medium'), local('Inter'),
                 url('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2') format('woff2');
          }
          @font-face {
            font-family: 'Inter_600SemiBold';
            font-style: normal;
            font-weight: 600;
            src: local('Inter SemiBold'), local('Inter'),
                 url('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2') format('woff2');
          }
          @font-face {
            font-family: 'Inter_700Bold';
            font-style: normal;
            font-weight: 600;
            src: local('Inter SemiBold'), local('Inter Bold'), local('Inter'),
                 url('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2') format('woff2');
          }

          * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          body, html, #root, [data-testid="root"] {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          input, textarea, select {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          /* CRITICAL: Protect all @expo/vector-icons and custom icon fonts from being overridden! */
          [style*="font-family: Ionicons"], [style*="fontFamily: Ionicons"], [style*="font-family: 'Ionicons'"], [style*="font-family:ionicons"] {
            font-family: Ionicons !important;
          }
          [style*="font-family: Feather"], [style*="fontFamily: Feather"], [style*="font-family: 'Feather'"] {
            font-family: Feather !important;
          }
          [style*="font-family: MaterialIcons"], [style*="fontFamily: MaterialIcons"] {
            font-family: MaterialIcons !important;
          }
          [style*="font-family: MaterialCommunityIcons"], [style*="fontFamily: MaterialCommunityIcons"] {
            font-family: MaterialCommunityIcons !important;
          }
          [style*="font-family: FontAwesome"], [style*="fontFamily: FontAwesome"] {
            font-family: FontAwesome !important;
          }
          [style*="font-family: FontAwesome5"], [style*="fontFamily: FontAwesome5"] {
            font-family: FontAwesome5 !important;
          }
          [style*="font-family: AntDesign"], [style*="fontFamily: AntDesign"] {
            font-family: AntDesign !important;
          }
          [style*="font-family: Entypo"], [style*="fontFamily: Entypo"] {
            font-family: Entypo !important;
          }
          [style*="font-family: Octicons"], [style*="fontFamily: Octicons"] {
            font-family: Octicons !important;
          }
          [style*="font-family: SimpleLineIcons"], [style*="fontFamily: SimpleLineIcons"] {
            font-family: SimpleLineIcons !important;
          }
          /* Professional font-weight moderation - prevent chunky faux bold */
          h1, h2, h3, h4, [style*="font-weight: 700"], [style*="font-weight: 800"], [style*="font-weight: 900"], [style*="fontWeight: '700'"], [style*="fontWeight: '800'"], [style*="fontWeight: '900'"], [style*="font-weight: bold"], b, strong {
            letter-spacing: -0.015em;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <View style={[styles.webCanvas, Platform.OS !== "web" && styles.nativeCanvas]}>
      <View style={[styles.mobileFrame, Platform.OS !== "web" && styles.nativeFrame]}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={styles.flex}>
                <MotionProvider>
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
                </MotionProvider>
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
  webCanvas: { flex: 1, alignItems: "center", backgroundColor: "#0D0720" },
  nativeCanvas: { backgroundColor: "#fff" },
  mobileFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#F8F7FF",
    overflow: "hidden",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#2E1A5E",
  },
  nativeFrame: { maxWidth: "100%", borderWidth: 0 },
});
