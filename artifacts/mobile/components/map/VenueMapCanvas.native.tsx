import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { VenueMapCanvasProps } from "./VenueMapCanvas";
import { ThemedText as Text } from "@/components/ThemedNative";

const styleUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

export default function VenueMapCanvas(props: VenueMapCanvasProps) {
  const NativeMap = useMemo(() => {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
    try {
      return require("./VenueMapCanvasNativeImpl").default as React.ComponentType<VenueMapCanvasProps>;
    } catch {
      return null;
    }
  }, []);

  if (NativeMap) return <NativeMap {...props} />;
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>Map selection is not available in this preview. Search for a place below to select it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { height: 300, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "#EEF1F7", borderRadius: 14 },
  fallbackText: { color: "#667085", fontSize: 13, lineHeight: 19, textAlign: "center" },
});
