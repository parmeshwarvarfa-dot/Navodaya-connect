import React, { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "./MotionProvider";

type Props = React.PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  delay?: number;
  distance?: number;
}>;

export default function FadeIn({ children, style, delay = 0, distance = 8 }: Props) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      hasAnimated.current = true;
      return;
    }
    if (hasAnimated.current) return;
    opacity.setValue(0);
    translateY.setValue(distance);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    animation.start();
    hasAnimated.current = true;
    return () => animation.stop();
  }, [delay, opacity, reducedMotion, translateY]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
