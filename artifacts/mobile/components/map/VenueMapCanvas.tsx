import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText as Text } from "@/components/ThemedNative";

export type VenueMapCanvasProps = {
  selectedCoordinate: [number, number] | null;
  onCoordinateSelect: (coordinate: [number, number]) => void;
};

export default function VenueMapCanvas({ selectedCoordinate }: VenueMapCanvasProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>Map tiles are unavailable here. Search for a place below to select it.</Text>
      {selectedCoordinate ? <Text style={styles.coordinateText}>{selectedCoordinate[1].toFixed(5)}, {selectedCoordinate[0].toFixed(5)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { height: 300, alignItems: "center", justifyContent: "center", gap: 8, padding: 20, backgroundColor: "#EEF1F7", borderRadius: 14 },
  fallbackText: { color: "#667085", fontSize: 13, lineHeight: 19, textAlign: "center" },
  coordinateText: { color: "#344054", fontSize: 12, fontWeight: "600" },
});
