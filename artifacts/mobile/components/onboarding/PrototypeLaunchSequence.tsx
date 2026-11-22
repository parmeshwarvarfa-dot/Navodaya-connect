import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import CampusSvgArt from "./CampusSvgArt";
import ExploreLandingView from "./ExploreLandingView";

interface PrototypeLaunchSequenceProps {
  onContinueAuth: (role: "student" | "alumni" | "teacher" | "official", phoneOrEmail?: string) => void;
  onExploreOpen?: () => void;
}

const DUR = 9500;
const SCENE_TIMES = [0, 1500, 3200, 4800, 6200, 7700];

export default function PrototypeLaunchSequence({
  onContinueAuth,
}: PrototypeLaunchSequenceProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentScene, setCurrentScene] = useState(1);
  const [selectedRole, setSelectedRole] = useState<"Student" | "Alumni" | "Teacher" | "JNV Official">("Alumni");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isExploreOpen, setIsExploreOpen] = useState(false);

  // Animated values for transitions
  const animTime = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(380)).current;
  const sceneOpacity = useRef(new Animated.Value(1)).current;

  const timerRef = useRef<any>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Determine active scene based on time
  const getSceneForTime = useCallback((t: number) => {
    let s = 1;
    SCENE_TIMES.forEach((st, idx) => {
      if (t >= st) s = idx + 1;
    });
    return s;
  }, []);

  // Jump to specific scene
  const jumpToScene = useCallback((sceneNum: number) => {
    const targetTime = SCENE_TIMES[sceneNum - 1] || 0;
    setCurrentTime(targetTime);
    setCurrentScene(sceneNum);
    animTime.setValue(targetTime);

    if (sceneNum >= 6) {
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(sheetTranslateY, {
        toValue: 380,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [animTime, sheetTranslateY]);

  // Main playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= DUR) {
          clearInterval(timerRef.current);
          setIsPlaying(false);
          setCurrentScene(6);
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          return DUR;
        }

        const s = getSceneForTime(next);
        if (s !== currentScene) {
          setCurrentScene(s);
          if (s >= 6) {
            Animated.spring(sheetTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        }
        return next;
      });
    }, 40);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentScene, getSceneForTime, sheetTranslateY]);

  // Initial logo entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 900,
        delay: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        delay: 350,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale]);

  const handleSkip = () => {
    jumpToScene(6);
  };

  const handleRestart = () => {
    setIsPlaying(false);
    jumpToScene(1);
    setTimeout(() => {
      setIsPlaying(true);
    }, 60);
  };

  const handleRoleSelect = (role: "Student" | "Alumni" | "Teacher" | "JNV Official") => {
    setSelectedRole(role);
  };

  const handleContinue = () => {
    const roleKey =
      selectedRole === "Student"
        ? "student"
        : selectedRole === "Alumni"
        ? "alumni"
        : selectedRole === "Teacher"
        ? "teacher"
        : "official";
    onContinueAuth(roleKey, phoneNumber);
  };

  const progress = Math.min(Math.max(currentTime, 0) / DUR, 1);
  const isDocked = currentScene >= 6;

  return (
    <View style={styles.container}>
      {/* ── Background SVG Campus Artwork with Parallax ── */}
      <View style={styles.bgWrapper}>
        <CampusSvgArt progress={progress} width="100%" height="100%" />
        {/* Soft violet evening dusk overlay */}
        <LinearGradient
          colors={[
            "rgba(24, 6, 70, 0.78)",
            "rgba(52, 14, 128, 0.32)",
            "rgba(30, 8, 86, 0.6)",
            "rgba(14, 4, 44, 0.95)",
          ]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </View>

      {/* ── Status Bar Space / Top Bar ── */}
      <View style={styles.topStatusRow}>
        <Text style={styles.clockText}>9:41</Text>
        <View style={styles.statusIcons}>
          <Text style={styles.fiveGText}>5G</Text>
          <Ionicons name="battery-full" size={16} color="#FFFFFF" />
        </View>
      </View>

      {/* ── Official JNV Emblem / Logo & Watermark ── */}
      <Animated.View
        style={[
          styles.logoContainer,
          isDocked ? styles.logoDocked : styles.logoCentered,
          {
            opacity: logoOpacity,
            transform: [{ scale: isDocked ? 0.65 : logoScale }],
          },
        ]}
      >
        <Image
          source={require("@/assets/images/jnv-logo.jpg")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {isDocked && (
        <View style={styles.watermarkContainer}>
          <Text style={styles.watermarkTitle}>NAVODAYA</Text>
          <Text style={styles.watermarkSub}>CONNECT</Text>
        </View>
      )}

      {/* ── Skip Intro Button (Visible in Scenes 1-5) ── */}
      {!isDocked && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          activeOpacity={0.8}
        >
          <Text style={styles.skipBtnText}>Skip intro ›</Text>
        </TouchableOpacity>
      )}

      {/* ── Scene 1: Arrival (0.0s – 1.5s) ── */}
      {currentScene === 1 && (
        <View style={styles.sceneWrap}>
          <Text style={styles.scene1Kicker}>Welcome to the community</Text>
        </View>
      )}

      {/* ── Scene 2: Identity (1.5s – 3.2s) ── */}
      {currentScene === 2 && (
        <View style={styles.sceneWrap}>
          <Text style={styles.sloganLine1}>Once a Navodayan,</Text>
          <Text style={styles.sloganLine2}>Always a Navodayan.</Text>
        </View>
      )}

      {/* ── Scene 3: Hindi Identity (3.2s – 4.8s) ── */}
      {/* THE EMOTIONAL CENTERPIECE — EXACT PHRASE PRESERVED */}
      {currentScene === 3 && (
        <View style={styles.sceneWrap}>
          <Text style={styles.hindiCenterpiece}>हमी नवोदय हों !!</Text>
          <LinearGradient
            colors={["#7A2CF0", "#D8C2FF"]}
            style={styles.hindiGradientLine}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
      )}

      {/* ── Scene 4: Community (4.8s – 6.2s) ── */}
      {currentScene === 4 && (
        <View style={styles.sceneWrap}>
          <View style={styles.glassPillsCol}>
            <View style={styles.glassPill}>
              <Text style={styles.glassPillText}>एक परिवार।</Text>
            </View>
            <View style={styles.glassPill}>
              <Text style={styles.glassPillText}>एक पहचान।</Text>
            </View>
            <View style={[styles.glassPill, styles.glassPillViolet]}>
              <Text style={[styles.glassPillText, styles.glassPillTextViolet]}>
                एक नवोदय।
              </Text>
            </View>
            <Text style={styles.communitySubEnglish}>
              ONE FAMILY · ONE IDENTITY · ONE NAVODAYA
            </Text>
          </View>
        </View>
      )}

      {/* ── Scene 5: App Brand (6.2s – 7.7s) ── */}
      {currentScene === 5 && (
        <View style={styles.sceneWrap}>
          <Text style={styles.brandTitle}>NAVODAYA</Text>
          <LinearGradient
            colors={["transparent", "#8C4DFF", "transparent"]}
            style={styles.brandDivider}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.brandConnect}>CONNECT</Text>
        </View>
      )}

      {/* ── Scene 6: Welcome Sheet (7.7s – 9.5s+) ── */}
      <Animated.View
        style={[
          styles.welcomeSheet,
          {
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        <Text style={styles.sheetKicker}>Ready to reconnect?</Text>
        <Text style={styles.sheetHeading}>Welcome home.</Text>
        <Text style={styles.sheetSub}>
          Find your batch. Find your people. Find your Navodaya.
        </Text>

        {/* 4 Community Role Selectors */}
        <View style={styles.rolesRow}>
          {(["Student", "Alumni", "Teacher", "JNV Official"] as const).map(
            (role) => {
              const isSelected = selectedRole === role;
              return (
                <TouchableOpacity
                  key={role}
                  onPress={() => handleRoleSelect(role)}
                  style={[
                    styles.rolePill,
                    isSelected && styles.rolePillActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      isSelected && styles.rolePillTextActive,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        {/* Mobile Number / Quick Continue */}
        <View style={styles.fieldWrap}>
          <Text style={styles.countryCode}>+91</Text>
          <TextInput
            style={styles.mobileInput}
            placeholder="Mobile number"
            placeholderTextColor="#A79FC9"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          style={styles.continueBtn}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={["#7A2CF0", "#6A00E0"]}
            style={styles.continueGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Explore Navodaya Connect Link */}
        <View style={styles.exploreLinkRow}>
          <Text style={styles.exploreLinkPrefix}>New here? </Text>
          <TouchableOpacity
            onPress={() => setIsExploreOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.exploreLinkAction}>
              Explore Navodaya Connect
            </Text>
          </TouchableOpacity>
        </View>

        {/* Approved Slogan Tag */}
        <Text style={styles.footerTag}>
          OUR LEGACY • OUR COMMUNITY • OUR FUTURE
        </Text>
      </Animated.View>

      {/* ── Dedicated Explore / Landing Overlay View ── */}
      <ExploreLandingView
        visible={isExploreOpen}
        onClose={() => setIsExploreOpen(false)}
        onReplayIntro={() => {
          setIsExploreOpen(false);
          handleRestart();
        }}
        onJoinPress={(preferredRole) => {
          setIsExploreOpen(false);
          if (preferredRole) setSelectedRole(preferredRole);
          jumpToScene(6);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#12063A",
    overflow: "hidden",
  },
  bgWrapper: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  topStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 14 : 18,
    paddingHorizontal: 24,
    zIndex: 30,
  },
  clockText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fiveGText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  logoContainer: {
    position: "absolute",
    zIndex: 26,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#14003C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 8,
  },
  logoCentered: {
    top: 92,
    left: "50%",
    marginLeft: -49,
    width: 98,
    height: 98,
  },
  logoDocked: {
    top: 48,
    left: 20,
    width: 50,
    height: 50,
  },
  logoImage: {
    width: "82%",
    height: "82%",
    borderRadius: 40,
  },
  watermarkContainer: {
    position: "absolute",
    top: 54,
    left: 80,
    zIndex: 26,
  },
  watermarkTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.8,
    color: "#FFFFFF",
  },
  watermarkSub: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 3.8,
    color: "#D8C2FF",
    marginTop: 1,
  },
  skipBtn: {
    position: "absolute",
    bottom: 28,
    right: 20,
    zIndex: 40,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 15,
  },
  skipBtnText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sceneWrap: {
    position: "absolute",
    top: "38%",
    left: 20,
    right: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  scene1Kicker: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EFE6FF",
    letterSpacing: 1,
  },
  sloganLine1: {
    fontSize: 26,
    fontWeight: "600",
    color: "#EFE6FF",
    textAlign: "center",
  },
  sloganLine2: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 4,
    textShadowColor: "rgba(20, 0, 60, 0.4)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 16,
  },
  hindiCenterpiece: {
    fontSize: 48,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 56,
    textShadowColor: "rgba(130, 60, 255, 0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },
  hindiGradientLine: {
    width: 100,
    height: 3,
    borderRadius: 3,
    marginTop: 14,
  },
  glassPillsCol: {
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  glassPill: {
    paddingVertical: 8,
    paddingHorizontal: 26,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
  },
  glassPillViolet: {
    backgroundColor: "#6A00E0",
    borderColor: "#7A2CF0",
    shadowColor: "#6A00E0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
  glassPillText: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  glassPillTextViolet: {
    color: "#FFFFFF",
  },
  communitySubEnglish: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2.2,
    color: "#D8C2FF",
    marginTop: 8,
  },
  brandTitle: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#FFFFFF",
  },
  brandDivider: {
    width: 180,
    height: 3,
    borderRadius: 3,
    marginVertical: 12,
  },
  brandConnect: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 8,
    color: "#D8C2FF",
  },
  welcomeSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "64%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    zIndex: 35,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetKicker: {
    fontSize: 17,
    fontWeight: "700",
    color: "#6A00E0",
  },
  sheetHeading: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0A0A2A",
    lineHeight: 38,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  sheetSub: {
    fontSize: 12.5,
    color: "#6B6790",
    marginTop: 4,
    marginBottom: 14,
  },
  rolesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },
  rolePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D9CCFF",
  },
  rolePillActive: {
    backgroundColor: "#6A00E0",
    borderColor: "#6A00E0",
  },
  rolePillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#6A00E0",
  },
  rolePillTextActive: {
    color: "#FFFFFF",
  },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D9CCFF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    gap: 12,
  },
  countryCode: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6A00E0",
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: "#E3D9FF",
  },
  mobileInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0A0A2A",
  },
  continueBtn: {
    width: "100%",
    height: 52,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#6A00E0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 6,
    marginTop: 8,
  },
  continueGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  exploreLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  exploreLinkPrefix: {
    fontSize: 12,
    color: "#6B6790",
  },
  exploreLinkAction: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6A00E0",
    textDecorationLine: "underline",
  },
  footerTag: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textAlign: "center",
    color: "#6A00E0",
    marginTop: 10,
  },
});
