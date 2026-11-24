import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  RadialGradient,
  Stop,
  G,
  Path,
} from "react-native-svg";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "compact";

interface ParamAiOrbProps {
  size?: number;
  state?: OrbState;
  audioLevel?: number; // 0 to 1 for reactive speaking/listening animation
}

export default function ParamAiOrb({
  size = 120,
  state = "idle",
  audioLevel = 0,
}: ParamAiOrbProps) {
  const isWeb = Platform.OS === "web";

  // Animation values
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAura = useRef(new Animated.Value(0.4)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const neuralPulse = useRef(new Animated.Value(1)).current;

  // 1. Continuous breathing animation
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.06,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: !isWeb,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0.96,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: !isWeb,
        }),
      ])
    );
    breathe.start();

    // 2. Slow subtle orbital rotation
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: state === "thinking" ? 3000 : 12000,
        easing: Easing.linear,
        useNativeDriver: !isWeb,
      })
    );
    rotate.start();

    // 3. Ambient aura pulse
    const aura = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAura, {
          toValue: 0.8,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: !isWeb,
        }),
        Animated.timing(pulseAura, {
          toValue: 0.35,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: !isWeb,
        }),
      ])
    );
    aura.start();

    // 4. Wave expansion loop when speaking/listening
    const wave = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: !isWeb,
      })
    );
    if (state === "speaking" || state === "listening") {
      wave.start();
    } else {
      wave.stop();
      waveAnim.setValue(0);
    }

    return () => {
      breathe.stop();
      rotate.stop();
      aura.stop();
      wave.stop();
    };
  }, [breatheAnim, rotateAnim, pulseAura, waveAnim, state, isWeb]);

  // Audio reactivity
  useEffect(() => {
    if (state === "speaking" || state === "listening") {
      Animated.spring(neuralPulse, {
        toValue: 1 + audioLevel * 0.25,
        friction: 4,
        tension: 80,
        useNativeDriver: !isWeb,
      }).start();
    } else {
      neuralPulse.setValue(1);
    }
  }, [audioLevel, state, neuralPulse, isWeb]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const counterSpin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  const waveScale = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.55],
  });

  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.7, 0.4, 0],
  });

  // State-specific palette
  const getCoreGradients = () => {
    switch (state) {
      case "listening":
        return ["#06B6D4", "#6366F1", "#4F46E5"];
      case "thinking":
        return ["#EC4899", "#8B5CF6", "#6D28D9"];
      case "speaking":
        return ["#A855F7", "#7C3AED", "#4338CA"];
      default:
        return ["#8B5CF6", "#6D28D9", "#3B0764"];
    }
  };

  const coreColors = getCoreGradients();

  return (
    <View style={[styles.container, { width: size * 1.4, height: size * 1.4 }]}>
      {/* 1. Deep ambient backlight glow */}
      <Animated.View
        style={[
          styles.ambientGlow,
          {
            width: size * 1.3,
            height: size * 1.3,
            borderRadius: (size * 1.3) / 2,
            backgroundColor: coreColors[1],
            opacity: pulseAura,
            transform: [{ scale: breatheAnim }],
          },
        ]}
      />

      {/* 2. Audio-reactive pulsing wave (speaking/listening) */}
      {(state === "speaking" || state === "listening") && (
        <Animated.View
          style={[
            styles.waveRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: coreColors[0],
              opacity: waveOpacity,
              transform: [{ scale: waveScale }],
            },
          ]}
        />
      )}

      {/* 3. Outer rotating neural orbital ring */}
      <Animated.View
        style={[
          styles.orbitalRingWrap,
          {
            width: size * 1.16,
            height: size * 1.16,
            transform: [{ rotate: spin }],
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <SvgGradient id="orbitGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={coreColors[0]} stopOpacity="0.8" />
              <Stop offset="0.5" stopColor={coreColors[1]} stopOpacity="0.1" />
              <Stop offset="1" stopColor="#C4B5FD" stopOpacity="0.7" />
            </SvgGradient>
          </Defs>
          <Circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="url(#orbitGrad)"
            strokeWidth="1.6"
            strokeDasharray="8 6 18 8"
          />
          {/* Orbital particle dots */}
          <Circle cx="50" cy="3" r="2.4" fill="#FFFFFF" />
          <Circle cx="97" cy="50" r="1.8" fill={coreColors[0]} />
          <Circle cx="3" cy="50" r="1.5" fill="#E9D5FF" />
        </Svg>
      </Animated.View>

      {/* 4. Inner counter-rotating resonance ring */}
      <Animated.View
        style={[
          styles.orbitalRingWrap,
          {
            width: size * 1.05,
            height: size * 1.05,
            transform: [{ rotate: counterSpin }],
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
        </Svg>
      </Animated.View>

      {/* 5. Central 3D-Inspired Sphere */}
      <Animated.View
        style={[
          styles.coreSphere,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [
              { scale: Animated.multiply(breatheAnim, neuralPulse) },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={coreColors as [string, string, string]}
          start={{ x: 0.15, y: 0.15 }}
          end={{ x: 0.85, y: 0.85 }}
          style={styles.gradientFill}
        >
          {/* Internal light refraction highlights & neural energy lines */}
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="specularGlow" cx="32%" cy="28%" r="45%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
                <Stop offset="0.45" stopColor="#E9D5FF" stopOpacity="0.25" />
                <Stop offset="1" stopColor="#6D28D9" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="innerCoreGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.3" />
                <Stop offset="0.6" stopColor={coreColors[0]} stopOpacity="0.15" />
                <Stop offset="1" stopColor="transparent" stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Specular curved highlight giving sphere depth */}
            <Circle cx="50" cy="50" r="50" fill="url(#specularGlow)" />

            {/* Subtle internal neural curved arcs */}
            <G opacity="0.35">
              <Path
                d="M 22 50 Q 50 25 78 50 Q 50 75 22 50 Z"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.2"
              />
              <Path
                d="M 50 22 Q 25 50 50 78 Q 75 50 50 22 Z"
                fill="none"
                stroke="#DDD6FE"
                strokeWidth="1"
              />
            </G>

            {/* Center core pulse */}
            <Circle cx="50" cy="50" r="16" fill="url(#innerCoreGlow)" />
            <Circle cx="50" cy="50" r="4.5" fill="#FFFFFF" opacity="0.85" />
          </Svg>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ambientGlow: {
    position: "absolute",
    ...Platform.select({
      web: {
        filter: "blur(28px)",
      } as any,
      default: {
        shadowColor: "#8B5CF6",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 28,
      },
    }),
  },
  waveRing: {
    position: "absolute",
    borderWidth: 2,
  },
  orbitalRingWrap: {
    position: "absolute",
  },
  coreSphere: {
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 12px 34px rgba(109, 40, 217, 0.45), inset 0 2px 8px rgba(255, 255, 255, 0.5)",
      } as any,
      default: {
        shadowColor: "#6D28D9",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  gradientFill: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
