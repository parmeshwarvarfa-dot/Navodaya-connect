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
  customPhotos?: any[];
}

const DUR = 10700;
const SCENE_TIMES = [0, 1500, 3200, 6000, 7400, 8900];

export default function PrototypeLaunchSequence({
  onContinueAuth,
  customPhotos,
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
  const breatheScale = useRef(new Animated.Value(1.0)).current;
  const sheetTranslateY = useRef(new Animated.Value(450)).current;

  // Background crossfade opacities
  const bgOpacity1 = useRef(new Animated.Value(1)).current;
  const bgOpacity2 = useRef(new Animated.Value(0)).current;
  const bgOpacity3 = useRef(new Animated.Value(0)).current;
  const bgOpacity4 = useRef(new Animated.Value(0)).current;

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

  // Crossfade background photos
  const crossfadeTo = useCallback((photoIndex: number) => {
    const opacities = [bgOpacity1, bgOpacity2, bgOpacity3, bgOpacity4];
    opacities.forEach((op, idx) => {
      Animated.timing(op, {
        toValue: idx === photoIndex ? 1 : 0,
        duration: 900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  }, [bgOpacity1, bgOpacity2, bgOpacity3, bgOpacity4]);

  // Jump to specific scene
  const jumpToScene = useCallback((sceneNum: number) => {
    const targetTime = SCENE_TIMES[sceneNum - 1] || 0;
    setCurrentTime(targetTime);
    setCurrentScene(sceneNum);
    animTime.setValue(targetTime);

    // Update background photo corresponding to scene
    const photoIdx =
      sceneNum === 1
        ? 0
        : sceneNum === 2
        ? 1
        : sceneNum === 3
        ? 2
        : sceneNum === 4
        ? 3
        : sceneNum === 5
        ? 0
        : 1;
    crossfadeTo(photoIdx);

    if (sceneNum >= 6) {
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 3,
        speed: 10,
      }).start();
    } else {
      Animated.timing(sheetTranslateY, {
        toValue: 450,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [animTime, crossfadeTo, sheetTranslateY]);

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
          crossfadeTo(1);
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 3,
            speed: 10,
          }).start();
          return DUR;
        }

        const s = getSceneForTime(next);
        if (s !== currentScene) {
          setCurrentScene(s);
          const pIdx =
            s === 1
              ? 0
              : s === 2
              ? 1
              : s === 3
              ? 2
              : s === 4
              ? 3
              : s === 5
              ? 0
              : 1;
          crossfadeTo(pIdx);

          if (s >= 6) {
            Animated.spring(sheetTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 3,
              speed: 10,
            }).start();
          }
        }
        return next;
      });
    }, 40);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentScene, getSceneForTime, crossfadeTo, sheetTranslateY]);

  // Initial logo entrance & breathing animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 900,
        delay: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        delay: 300,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const breatheAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheScale, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheScale, {
          toValue: 1.0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    breatheAnim.start();

    return () => {
      breatheAnim.stop();
    };
  }, [logoOpacity, logoScale, breatheScale]);

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

  const isDocked = currentScene >= 6;

  return (
    <View style={styles.container}>
      {/* ── Background: Clean Campus SVG Art (Exact Prototype V8 matching index.html) ── */}
      <View style={styles.bgContainer}>
        {customPhotos && customPhotos.length > 0 ? (
          /* Render custom user photos if provided */
          customPhotos.map((photo, i) => (
            <Animated.Image
              key={`custom-photo-${i}`}
              source={photo}
              style={[
                styles.bgImage,
                { opacity: i === 0 ? bgOpacity1 : i === 1 ? bgOpacity2 : i === 2 ? bgOpacity3 : bgOpacity4 },
              ]}
              resizeMode="cover"
            />
          ))
        ) : (
          /* Clean Campus SVG Art — single, crisp backdrop with no overlapping text */
          <View style={StyleSheet.absoluteFillObject}>
            <CampusSvgArt progress={currentScene / 6} width="100%" height="100%" />
          </View>
        )}

        {/* Deep Violet Gradient Overlay (Exact Prototype Vignette) */}
        <LinearGradient
          colors={[
            "rgba(24, 6, 70, 0.78)",
            "rgba(52, 14, 128, 0.32)",
            "rgba(30, 8, 86, 0.60)",
            "rgba(14, 4, 44, 0.95)",
          ]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </View>

      {/* Top Spacer (Clean layout without fake clock or battery icons) */}
      <View style={{ height: Platform.OS === "web" ? 18 : 28 }} />

      {/* ── Top Centered Watermark (Scenes 1 to 5) ── */}
      {!isDocked && (
        <View style={styles.topCenteredWatermark}>
          <Text style={styles.watermarkTitle}>NAVODAYA</Text>
          <Text style={styles.watermarkSub}>CONNECT</Text>
        </View>
      )}

      {/* ── Official JNV Emblem with Breathing Glow ── */}
      <Animated.View
        style={[
          styles.logoContainer,
          isDocked ? styles.logoDocked : styles.logoCentered,
          {
            opacity: logoOpacity,
            transform: [{ scale: isDocked ? 0.6 : Animated.multiply(logoScale, breatheScale) }],
          },
        ]}
      >
        <View style={styles.logoRingGlow}>
          <Image
            source={require("@/assets/images/jnv-logo.jpg")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* ── Docked Watermark (Scene 6) ── */}
      {isDocked && (
        <View style={styles.watermarkContainerDocked}>
          <Text style={styles.watermarkTitleDocked}>NAVODAYA</Text>
          <Text style={styles.watermarkSubDocked}>CONNECT</Text>
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
        <View style={styles.sceneWrap} />
      )}

      {/* ── Scene 2: Identity (1.5s – 3.2s) ── */}
      {currentScene === 2 && (
        <View style={styles.sceneWrap}>
          <Text style={styles.sloganLine1}>Once a Navodayan,</Text>
          <Text style={styles.sloganLine2}>Always a Navodayan.</Text>
        </View>
      )}

      {/* ── Scene 3: Hindi Identity (3.2s – 4.8s) ── */}
      {/* EXACT MATCH TO VIDEO: "हमी नवोदय हों !!" + "शिक्षार्थ आइए, सेवार्थ जाइए।" */}
      {currentScene === 3 && (
        <View style={styles.sceneWrap}>
          <Text style={styles.hindiCenterpiece}>हमी नवोदय हों !!</Text>
          <LinearGradient
            colors={["#7A2CF0", "#D8C2FF"]}
            style={styles.hindiGradientLine}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.hindiMotto}>शिक्षार्थ आइए, सेवार्थ जाइए।</Text>
          <Text style={styles.mottoEnglish}>Come to learn, go to serve. 🙏</Text>
        </View>
      )}

      {/* ── Scene 4: Community (4.8s – 6.2s) ── */}
      {/* EXACT MATCH TO VIDEO: Three stacked pills + English motto + ONE FAMILY */}
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
            <Text style={styles.mottoEnglishInline}>
              Come to learn, go to serve. 🙏
            </Text>
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
      {/* EXACT MATCH TO VIDEO AT 00:09-00:13 */}
      <Animated.View
        style={[
          styles.welcomeSheet,
          {
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
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

        {/* Prototype Reference Note */}
        <Text style={styles.sheetNote}>
          [ YOUR EXISTING AUTH / ONBOARDING SCREEN REPLACES THIS ]
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
  bgContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  topCenteredWatermark: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 25,
  },
  watermarkTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#FFFFFF",
  },
  watermarkSub: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 4.5,
    color: "#D8C2FF",
    marginTop: 1,
  },
  logoContainer: {
    position: "absolute",
    zIndex: 26,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  logoCentered: {
    top: 96,
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
  logoRingGlow: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(150, 90, 255, 0.8)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 8,
  },
  logoImage: {
    width: "82%",
    height: "82%",
    borderRadius: 40,
  },
  watermarkContainerDocked: {
    position: "absolute",
    top: 54,
    left: 78,
    zIndex: 26,
  },
  watermarkTitleDocked: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.8,
    color: "#FFFFFF",
  },
  watermarkSubDocked: {
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
    top: "40%",
    left: 20,
    right: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
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
    fontSize: 50,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 58,
    textShadowColor: "rgba(130, 60, 255, 0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 32,
  },
  hindiGradientLine: {
    width: 100,
    height: 3,
    borderRadius: 3,
    marginVertical: 14,
  },
  hindiMotto: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  mottoEnglish: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D8C2FF",
    textAlign: "center",
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
  mottoEnglishInline: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D8C2FF",
    marginTop: 6,
  },
  communitySubEnglish: {
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 2.2,
    color: "rgba(216, 194, 255, 0.8)",
    marginTop: 2,
  },
  brandTitle: {
    fontSize: 40,
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
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 20,
    zIndex: 35,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetHeading: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0A0A2A",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  sheetSub: {
    fontSize: 13,
    color: "#6B6790",
    marginTop: 4,
    marginBottom: 16,
  },
  rolesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },
  rolePill: {
    paddingVertical: 7,
    paddingHorizontal: 13,
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
    height: 52,
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
    height: 54,
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
  sheetNote: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    textAlign: "center",
    color: "#A79FC9",
    marginTop: 2,
  },
});
