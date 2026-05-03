import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    icon: "people" as const,
    title: "Connect with Your\nJNV Community",
    subtitle: "Join thousands of students, alumni,\nand officials in one platform",
  },
  {
    id: "2",
    icon: "school" as const,
    title: "Get Mentorship\nFrom Alumni",
    subtitle: "Learn from successful JNV graduates\nand get career guidance",
  },
  {
    id: "3",
    icon: "newspaper" as const,
    title: "Stay Updated\nWith Your\nJNV",
    subtitle: "Access events, rankings, and official\nannouncements",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const handleDone = async () => {
    await AsyncStorage.setItem("onboarding_done", "1");
  };

  const goLogin = async () => {
    await handleDone();
    router.replace("/(auth)/sign-in");
  };

  const goRegister = async () => {
    await handleDone();
    router.replace("/(auth)/sign-up");
  };

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(idx);
  };

  return (
    <LinearGradient
      colors={["#4B6EF5", "#3151E8"]}
      style={[styles.container, { paddingTop: topPad }]}
    >
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={56} color="#fff" />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      <View style={[styles.buttons, { paddingBottom: bottomPad + 16 }]}>
        <TouchableOpacity style={styles.loginBtn} onPress={goLogin} activeOpacity={0.8}>
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.registerBtn} onPress={goRegister} activeOpacity={0.85}>
          <Text style={styles.registerText}>Create Account  →</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 30,
    fontFamily: "Pacifico_400Regular",
    color: "#fff",
    textAlign: "center",
    lineHeight: 40,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    lineHeight: 24,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: "#fff",
  },
  dotInactive: {
    width: 8,
    backgroundColor: "rgba(255,255,255,0.40)",
  },
  buttons: {
    width: "100%",
    paddingHorizontal: 28,
    gap: 14,
  },
  loginBtn: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
  },
  loginText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  registerBtn: {
    backgroundColor: "#fff",
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
  },
  registerText: {
    color: "#3D5AF1",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});
