import React, { useEffect, useMemo } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import type { JnvMapSchool } from "@/lib/jnv-map-data";
import type { MapViewRequest } from "./map-types";

type Props = {
  schools: JnvMapSchool[];
  selectedId: string | null;
  request?: MapViewRequest;
  onSelect: (school: JnvMapSchool) => void;
  onMapReady: () => void;
  onMapError: (message: string) => void;
};

export default function MapCanvas(props: Props) {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const NativeRenderer = useMemo(() => {
    // Expo Go does not contain MapLibre's native module. Keep this require
    // conditional so loading Expo Router's routes cannot evaluate that module.
    if (isExpoGo) return null;
    try {
      return require("./NativeMapCanvas").default as React.ComponentType<Props>;
    } catch {
      // An older installed development client may also lack the map module.
      return null;
    }
  }, [isExpoGo]);

  useEffect(() => {
    if (!NativeRenderer) props.onMapError("The embedded map is unavailable in this preview. School search and Google Maps remain available.");
  }, [NativeRenderer, props.onMapError]);

  if (NativeRenderer) return <NativeRenderer {...props} />;

  const school = props.schools.find((item) => item.id === props.selectedId);
  const openGoogleMaps = () => {
    if (!school) return;
    const query = `${school.name}, ${school.district}, ${school.state}, India`;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`).catch(() => {
      Alert.alert("Could not open Google Maps", "Please try opening this school's Maps link again.");
    });
  };

  return <View style={[styles.container, school && styles.selectedContainer]}>
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.icon}><Ionicons name="map-outline" size={20} color="#3D5AF1" /></View>
        <View style={styles.headingText}>
          <Text style={styles.title} numberOfLines={2}>{school?.name ?? "Explore JNV locations"}</Text>
          {school && <Text style={styles.location} numberOfLines={1}>{school.district}, {school.state}</Text>}
        </View>
      </View>
      {school ? <Pressable accessibilityRole="link" accessibilityLabel={`Open ${school.name} in Google Maps`} onPress={openGoogleMaps} style={({ pressed }) => [styles.mapsButton, pressed && styles.pressed]}>
        <Ionicons name="navigate-outline" size={16} color="white" />
        <Text style={styles.mapsButtonText}>Open in Google Maps</Text>
        <Ionicons name="open-outline" size={14} color="white" />
      </Pressable> : <Text style={styles.body}>Browse the school list below and tap Maps to find any listed JNV in Google Maps.</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingLeft: 18, paddingRight: 62, paddingTop: 56, paddingBottom: 30, backgroundColor: "#EFF3FA" },
  selectedContainer: { paddingBottom: 110 },
  card: { width: "100%", maxWidth: 360, padding: 13, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: "#DFE5F0", gap: 12 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  headingText: { flex: 1, minWidth: 0 },
  title: { color: "#172033", fontSize: 14, lineHeight: 19, fontFamily: "Inter_600SemiBold" },
  location: { color: "#667085", fontSize: 11, lineHeight: 16, marginTop: 2 },
  body: { color: "#667085", fontSize: 12, lineHeight: 18 },
  mapsButton: { minHeight: 36, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#3D5AF1" },
  mapsButtonText: { flexShrink: 1, fontSize: 11, lineHeight: 16, color: "white", fontFamily: "Inter_600SemiBold" },
  pressed: { opacity: 0.82 },
});
