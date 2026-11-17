import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "./MotionProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export default function MotionPressable({ style, pressedScale = 0.97, onPressIn, onPressOut, disabled, ...props }: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: reducedMotion === false ? value : 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const { transform: _existingTransform, ...flattened } = StyleSheet.flatten(style) ?? {};

  return <AnimatedPressable
    {...props}
    disabled={disabled}
    onPressIn={(event) => { animateTo(pressedScale); onPressIn?.(event); }}
    onPressOut={(event) => { animateTo(1); onPressOut?.(event); }}
    style={[flattened, { transform: [{ scale }] }]}
  />;
}
