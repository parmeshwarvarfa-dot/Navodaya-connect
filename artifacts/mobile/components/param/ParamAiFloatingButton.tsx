import React, { useEffect, useRef } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { ThemedText as Text } from "@/components/ThemedNative";

interface ParamAiFloatingButtonProps {
  bottom?: number;
  right?: number;
  onPress?: () => void;
}

export default function ParamAiFloatingButton({
  bottom = 86,
  right = 16,
  onPress,
}: ParamAiFloatingButtonProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const bobAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isDragging = useRef(false);

  // Gentle, continuous floating bob animation
  useEffect(() => {
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: -4,
          duration: 1800,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    bobLoop.start();

    // Subtle breathing pulse on the outer glow ring
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 2000,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 2000,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      bobLoop.stop();
      pulseLoop.stop();
    };
  }, [bobAnim, pulseAnim]);

  const handlePress = () => {
    if (isDragging.current) return;
    if (onPress) {
      onPress();
    } else {
      router.push("/(screens)/param-ai" as any);
    }
  };

  // PanResponder to allow users to reposition PARAM AI anywhere on screen
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.setOffset({
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        setTimeout(() => {
          isDragging.current = false;
        }, 150);
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        isDragging.current = false;
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          bottom,
          right,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Open PARAM AI Assistant"
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.innerWrap,
            {
              transform: [{ translateY: bobAnim }],
            },
          ]}
        >
          {/* Outer Breathing Glow Ring (Vibrant Purple Atmosphere) */}
          <Animated.View
            style={[
              styles.glowAura,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />

          {/* Core Mascot Sphere (Rich Gradient) */}
          <LinearGradient
            colors={["#9333EA", "#7C3AED", "#4C1D95"]}
            start={{ x: 0.1, y: 0.1 }}
            end={{ x: 0.9, y: 0.9 }}
            style={styles.mascotSphere}
          >
            {/* Specular Light Reflection Border */}
            <View style={styles.specularBorder} />

            {/* Futuristic Cute Robot Companion SVG */}
            <View style={styles.svgContainer}>
              <Svg viewBox="0 0 54 54" width="100%" height="100%">
                {/* Glowing Antenna */}
                <Line
                  x1="27"
                  y1="14"
                  x2="27"
                  y2="7"
                  stroke="#EDE9FE"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <Circle cx="27" cy="6" r="3.2" fill="#FBBF24" />
                <Circle cx="27" cy="6" r="1.5" fill="#FEF08A" />

                {/* Robot Helmet Outer Shell */}
                <Rect
                  x="12"
                  y="13"
                  width="30"
                  height="25"
                  rx="8.5"
                  fill="#FFFFFF"
                />

                {/* Cyber Visor Screen */}
                <Rect
                  x="15.5"
                  y="16.5"
                  width="23"
                  height="16"
                  rx="5"
                  fill="#0F172A"
                />

                {/* Expressive Glowing Eyes (Cyan/Sky Blue for High Contrast) */}
                <Circle cx="21.5" cy="24" r="2.8" fill="#38BDF8" />
                <Circle cx="21.5" cy="23.2" r="1" fill="#FFFFFF" />

                <Circle cx="32.5" cy="24" r="2.8" fill="#38BDF8" />
                <Circle cx="32.5" cy="23.2" r="1" fill="#FFFFFF" />

                {/* Friendly Smile */}
                <Path
                  d="M 22.5 28 Q 27 31 31.5 28"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />

                {/* Cute Neck Collar Bar */}
                <Rect
                  x="20"
                  y="39.5"
                  width="14"
                  height="4"
                  rx="2"
                  fill="#E0E7FF"
                />
              </Svg>
            </View>
          </LinearGradient>

          {/* High-Contrast Pill Badge: PARAM AI ✦ */}
          <View style={styles.badgePill}>
            <View style={styles.liveDot} />
            <Text style={styles.badgeText}>PARAM AI</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
    width: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    ...Platform.select({
      web: {
        filter: "drop-shadow(0 8px 20px rgba(124, 58, 237, 0.55))",
        cursor: "pointer",
        userSelect: "none",
      } as any,
      default: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 12,
      },
    }),
  },
  touchable: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  innerWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
  },
  glowAura: {
    position: "absolute",
    top: -3,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(168, 85, 247, 0.35)",
    pointerEvents: "none",
  },
  mascotSphere: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 2,
    borderColor: "#DDD6FE",
    ...Platform.select({
      web: {
        boxShadow:
          "0 6px 18px rgba(124, 58, 237, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.4)",
      } as any,
    }),
  },
  specularBorder: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    pointerEvents: "none",
  },
  svgContainer: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badgePill: {
    marginTop: 3,
    backgroundColor: "#1E1B4B",
    borderWidth: 1.2,
    borderColor: "#A855F7",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.45)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
      },
    }),
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10B981",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
