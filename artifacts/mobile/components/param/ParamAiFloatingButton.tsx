import React, { useEffect, useRef } from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
  PanResponder,
} from "react-native";
import { router } from "expo-router";
import Svg, {
  Circle,
  Path,
  Line,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
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

    // Natural blinking animation every 4 seconds
    const blinkInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.1,
          duration: 120,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])?.start();
    }, 4200);

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

  // Dragging support so user can move PARAM AI if it overlaps any screen button
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
        <Svg viewBox="0 0 100 130" width="100%" height="100%">
          <Defs>
            <LinearGradient id="paramBodyGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#8B5CF6" />
              <Stop offset="1" stopColor="#6D28D9" />
            </LinearGradient>
            <LinearGradient id="paramBadgeGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1E1B4B" />
              <Stop offset="1" stopColor="#0F172A" />
            </LinearGradient>
          </Defs>

          {/* Outer glow ring */}
          <Circle
            cx="50"
            cy="46"
            r="43"
            fill="none"
            stroke="#C4B5FD"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />

          {/* Main Circle Body */}
          <Circle cx="50" cy="46" r="40" fill="url(#paramBodyGrad)" />
          <Circle
            cx="50"
            cy="46"
            r="40"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />

          {/* Antenna */}
          <Line
            x1="50"
            y1="28"
            x2="50"
            y2="20"
            stroke="#EDE9FE"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <Circle cx="50" cy="18" r="3.5" fill="#FFFFFF" />

          {/* Cute Robot Head Outer Shell */}
          <Rect
            x="30"
            y="27"
            width="40"
            height="32"
            rx="12"
            fill="#F5F3FF"
          />

          {/* Robot Screen Visor */}
          <Rect
            x="35"
            y="33"
            width="30"
            height="20"
            rx="7"
            fill="#1E1B4B"
          />

          {/* Friendly Glowing Eyes */}
          <Circle cx="43" cy="42" r="3.2" fill="#C4B5FD" />
          <Circle cx="57" cy="42" r="3.2" fill="#C4B5FD" />

          {/* Happy Smile */}
          <Path
            d="M44 47 Q50 51 56 47"
            fill="none"
            stroke="#C4B5FD"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Small Collar/Neck Pill */}
          <Rect
            x="42"
            y="61"
            width="16"
            height="6"
            rx="3"
            fill="#EDE9FE"
          />

          {/* Bottom Capsule Badge: PARAM AI */}
          <Rect
            x="14"
            y="98"
            width="72"
            height="20"
            rx="10"
            fill="url(#paramBadgeGrad)"
            stroke="#6366F1"
            strokeWidth="1"
          />
          <SvgText
            x="50"
            y="112"
            textAnchor="middle"
            fontFamily="Inter, system-ui, -apple-system, sans-serif"
            fontSize="9"
            fontWeight="700"
            fill="#FFFFFF"
            letterSpacing="0.6"
          >
            PARAM AI
          </SvgText>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
    width: 60,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    ...Platform.select({
      web: {
        filter: "drop-shadow(0 6px 14px rgba(109, 40, 217, 0.4))",
        cursor: "pointer",
        userSelect: "none",
      } as any,
      default: {
        shadowColor: "#6D28D9",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  innerWrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
