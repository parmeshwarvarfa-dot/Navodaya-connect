import React, { useEffect, useRef } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  Animated,
  PanResponder,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Path,
  Rect,
  Circle,
  Line,
} from "react-native-svg";

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
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const isDragging = useRef(false);

  // Gentle idle bob animation
  useEffect(() => {
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: -3,
          duration: 1600,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    bobLoop.start();

    // Natural blinking animation
    const blinkInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.15,
          duration: 120,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])?.start();
    }, 4000);

    return () => {
      bobLoop.stop();
      clearInterval(blinkInterval);
    };
  }, [bobAnim, blinkAnim]);

  const handlePress = () => {
    if (isDragging.current) return;
    if (onPress) {
      onPress();
    } else {
      router.push("/(screens)/param-ai" as any);
    }
  };

  // Dragging support so user can move PARAM AI anywhere
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6) {
          isDragging.current = true;
        }
        pan.x.setValue(gestureState.dx);
        pan.y.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          isDragging.current = false;
          handlePress();
        } else {
          setTimeout(() => {
            isDragging.current = false;
          }, 100);
        }
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
      <Animated.View
        style={[
          styles.innerWrap,
          {
            transform: [{ translateY: bobAnim }],
          },
        ]}
      >
        {/* Vibrant Solid Glowing Circle Mascot */}
        <LinearGradient
          colors={["#8B5CF6", "#7C3AED", "#5B21B6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mascotCircle}
        >
          {/* Subtle Outer Highlight Ring */}
          <View style={styles.mascotInnerBorder} />

          {/* Cute Robot Mascot SVG */}
          <View style={styles.svgContainer}>
            <Svg viewBox="0 0 60 60" width="100%" height="100%">
              {/* Antenna */}
              <Line
                x1="30"
                y1="16"
                x2="30"
                y2="9"
                stroke="#EDE9FE"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <Circle cx="30" cy="8" r="3" fill="#FFFFFF" />

              {/* Robot Head Outer Shell (Light Lilac/White) */}
              <Rect
                x="14"
                y="15"
                width="32"
                height="26"
                rx="9"
                fill="#F5F3FF"
              />

              {/* Robot Screen Visor (Deep Midnight Purple) */}
              <Rect
                x="18"
                y="19"
                width="24"
                height="17"
                rx="5.5"
                fill="#1E1B4B"
              />

              {/* Friendly Glowing Eyes (Lavender) */}
              <Circle cx="24.5" cy="27" r="2.8" fill="#C4B5FD" />
              <Circle cx="35.5" cy="27" r="2.8" fill="#C4B5FD" />

              {/* Warm Smiling Mouth */}
              <Path
                d="M 25 31 Q 30 34.5 35 31"
                fill="none"
                stroke="#C4B5FD"
                strokeWidth="1.6"
                strokeLinecap="round"
              />

              {/* Cute Collar / Neck Pill */}
              <Rect
                x="23"
                y="43"
                width="14"
                height="4.5"
                rx="2.2"
                fill="#EDE9FE"
              />
            </Svg>
          </View>
        </LinearGradient>

        {/* High-Contrast Bottom Pill Badge: PARAM AI 🤖 */}
        <View style={styles.badgePill}>
          <Text style={styles.badgeText}>PARAM AI 🤖</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
    width: 68,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    ...Platform.select({
      web: {
        filter: "drop-shadow(0 8px 18px rgba(124, 58, 237, 0.65))",
        cursor: "pointer",
        userSelect: "none",
      } as any,
      default: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.65,
        shadowRadius: 10,
        elevation: 12,
      },
    }),
  },
  innerWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  mascotCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 2,
    borderColor: "#DDD6FE",
    ...Platform.select({
      web: {
        boxShadow: "0 6px 20px rgba(124, 58, 237, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.5)",
      } as any,
    }),
  },
  mascotInnerBorder: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    pointerEvents: "none",
  },
  svgContainer: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badgePill: {
    marginTop: 4,
    backgroundColor: "#160C32",
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    ...Platform.select({
      web: {
        boxShadow: "0 3px 8px rgba(0, 0, 0, 0.5)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
      },
    }),
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
