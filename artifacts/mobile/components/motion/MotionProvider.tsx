import React, { createContext, useContext, useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

const MotionContext = createContext<boolean | null>(null);

export function MotionProvider({ children }: React.PropsWithChildren) {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (mounted) setReducedMotion(enabled); })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return <MotionContext.Provider value={reducedMotion}>{children}</MotionContext.Provider>;
}

export function useReducedMotion() {
  return useContext(MotionContext);
}
