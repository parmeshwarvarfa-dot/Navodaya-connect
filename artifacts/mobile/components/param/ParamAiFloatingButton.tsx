import React, { useEffect, useRef } from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
  Text,
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

const RAW_ANIMATED_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 120 160" width="100%" height="100%">
  <title>PARAM AI floating button (animated)</title>
  <style>
    /* Idle bob runs all the time */
    .bob{animation:param_bob 3s ease-in-out infinite}
    @keyframes param_bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}

    /* 10-second gesture loop: tilt, wink, hop with squash, sparkles, heart */
    .bot{transform-box:view-box;transform-origin:60px 70px;animation:param_gest 10s infinite}
    @keyframes param_gest{
      0%,58%,100%{transform:translate(0,0) rotate(0) scale(1,1)}
      62%{transform:translate(0,0) rotate(-12deg)}
      66%{transform:translate(0,0) rotate(10deg)}
      70%{transform:translate(0,-12px) rotate(0) scale(1,1)}
      74%{transform:translate(0,0) rotate(0) scale(1.1,.9)}
      78%{transform:translate(0,-4px) rotate(0) scale(1,1)}
      82%{transform:translate(0,0) rotate(0) scale(1,1)}
    }

    /* Eyes: normal blink for both, plus a wink for the right eye */
    .blink{transform-box:fill-box;transform-origin:center;animation:param_blink 4.4s infinite}
    @keyframes param_blink{0%,90%,100%{transform:scaleY(1)}93%{transform:scaleY(.08)}}
    .winkw{transform-box:fill-box;transform-origin:center;animation:param_wink 10s infinite}
    @keyframes param_wink{0%,60%,70%,100%{transform:scaleY(1)}63%,67%{transform:scaleY(.08)}}

    .ant{transform-box:fill-box;transform-origin:center;animation:param_pulse 1.8s ease-in-out infinite}
    @keyframes param_pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.55}}

    /* Halo: quiet most of the time, bursts during the hop */
    .halo{transform-box:fill-box;transform-origin:center;animation:param_halo 10s infinite;opacity:0}
    @keyframes param_halo{0%,68%{transform:scale(.92);opacity:0}70%{transform:scale(1);opacity:.9}84%{transform:scale(1.35);opacity:0}100%{opacity:0}}

    /* Sparkles around the button after the hop */
    .sp{transform-box:fill-box;transform-origin:center;animation:param_spk 10s infinite;opacity:0}
    .sp2{animation-delay:.25s}.sp3{animation-delay:.5s}
    @keyframes param_spk{0%,72%{transform:scale(0);opacity:0}76%{transform:scale(1.15);opacity:1}82%{transform:scale(.7);opacity:.8}88%,100%{transform:scale(0);opacity:0}}

    /* Heart rises out of the button */
    .hrt{transform-box:fill-box;transform-origin:center;animation:param_heart 10s infinite;opacity:0}
    @keyframes param_heart{0%,80%{transform:translate(0,14px) scale(0);opacity:0}84%{transform:translate(0,0) scale(1);opacity:1}96%{transform:translate(0,-46px) scale(1.1);opacity:0}100%{opacity:0}}

    @media (prefers-reduced-motion:reduce){*{animation:none!important}}
  </style>
  <defs>
    <linearGradient id="paramBtnGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9b4dff"/><stop offset="1" stop-color="#6a00e0"/>
    </linearGradient>
  </defs>

  <!-- Halo burst -->
  <circle class="halo" cx="60" cy="60" r="56" fill="none" stroke="#b98cff" stroke-width="3"/>

  <!-- Sparkles -->
  <path class="sp" d="M14 40 L16 46 L22 48 L16 50 L14 56 L12 50 L6 48 L12 46Z" fill="#ffffff"/>
  <path class="sp sp2" d="M104 34 L106 40 L112 42 L106 44 L104 50 L102 44 L96 42 L102 40Z" fill="#ffffff"/>
  <path class="sp sp3" d="M100 96 L101.5 100 L105.5 101.5 L101.5 103 L100 107 L98.5 103 L94.5 101.5 L98.5 100Z" fill="#ffffff"/>

  <!-- Robot -->
  <g class="bob"><g class="bot">
    <circle cx="60" cy="60" r="50" fill="url(#paramBtnGrad)"/>
    <circle cx="60" cy="60" r="50" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="2"/>
    <line x1="60" y1="38" x2="60" y2="30" stroke="#e6d6ff" stroke-width="3" stroke-linecap="round"/>
    <circle class="ant" cx="60" cy="28" r="4" fill="#ffffff"/>
    <rect x="37" y="38" width="46" height="36" rx="13" fill="#f1e8ff"/>
    <rect x="43" y="46" width="34" height="22" rx="8" fill="#2a1656"/>
    <circle class="blink" cx="52" cy="57" r="4" fill="#c9a8ff"/>
    <g class="winkw"><circle class="blink" cx="68" cy="57" r="4" fill="#c9a8ff"/></g>
    <path d="M54 63 Q60 67 66 63" fill="none" stroke="#c9a8ff" stroke-width="2" stroke-linecap="round"/>
    <rect x="50" y="78" width="20" height="8" rx="4" fill="#e6d6ff"/>
  </g></g>

  <!-- Heart -->
  <path class="hrt" transform="translate(60 60) scale(2.4)" d="M0 4 C-6 -1 -4 -6 0 -3 C4 -6 6 -1 0 4Z" fill="#ff8ccf"/>

  <!-- Label -->
  <rect x="20" y="124" width="80" height="20" rx="10" fill="#1d1140"/>
  <text x="60" y="138" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#ffffff" letter-spacing=".5">PARAM AI</text>
</svg>
`;

interface ParamAiFloatingButtonProps {
  bottom?: number;
  onPress?: () => void;
}

export default function ParamAiFloatingButton({
  bottom = 86,
  onPress,
}: ParamAiFloatingButtonProps) {
  const isWeb = Platform.OS === "web";
  const bobAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isWeb) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bobAnim, {
            toValue: -4,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(bobAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isWeb, bobAnim]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push("/(screens)/param-ai" as any);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { bottom }]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Ask PARAM AI"
    >
      {isWeb ? (
        // Web: render the SVG directly with full CSS keyframe animations (bob, wink, hop, squash, sparkles, heart)
        <View
          style={styles.svgWrapper}
          // @ts-ignore
          dangerouslySetInnerHTML={{ __html: RAW_ANIMATED_SVG }}
        />
      ) : (
        // Native: animated fallback using react-native-svg
        <Animated.View
          style={[
            styles.svgWrapper,
            { transform: [{ translateY: bobAnim }] },
          ]}
        >
          <Svg viewBox="0 -10 120 160" width="100%" height="100%">
            <Defs>
              <LinearGradient id="paramBtnGradNative" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#9b4dff" />
                <Stop offset="1" stopColor="#6a00e0" />
              </LinearGradient>
            </Defs>
            <Circle cx="60" cy="60" r="50" fill="url(#paramBtnGradNative)" />
            <Circle cx="60" cy="60" r="50" fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth="2" />
            <Line x1="60" y1="38" x2="60" y2="30" stroke="#e6d6ff" strokeWidth="3" strokeLinecap="round" />
            <Circle cx="60" cy="28" r="4" fill="#ffffff" />
            <Rect x="37" y="38" width="46" height="36" rx="13" fill="#f1e8ff" />
            <Rect x="43" y="46" width="34" height="22" rx="8" fill="#2a1656" />
            <Circle cx="52" cy="57" r="4" fill="#c9a8ff" />
            <Circle cx="68" cy="57" r="4" fill="#c9a8ff" />
            <Path d="M54 63 Q60 67 66 63" fill="none" stroke="#c9a8ff" strokeWidth="2" strokeLinecap="round" />
            <Rect x="50" y="78" width="20" height="8" rx="4" fill="#e6d6ff" />
            <Rect x="20" y="124" width="80" height="20" rx="10" fill="#1d1140" />
            <SvgText
              x="60"
              y="138"
              textAnchor="middle"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="11"
              fontWeight="700"
              fill="#ffffff"
              letterSpacing={0.5}
            >
              PARAM AI
            </SvgText>
          </Svg>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 12,
    zIndex: 9999,
    width: 72,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  svgWrapper: {
    width: 72,
    height: 96,
  },
});
