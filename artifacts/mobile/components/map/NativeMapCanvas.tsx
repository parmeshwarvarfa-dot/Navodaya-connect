import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import type { JnvMapSchool } from "@/lib/jnv-map-data";
import type { MapViewRequest } from "./map-types";
import { useReducedMotion } from "@/components/motion/MotionProvider";

type Props = {
  schools: JnvMapSchool[];
  selectedId: string | null;
  request?: MapViewRequest;
  onSelect: (school: JnvMapSchool) => void;
  onMapReady: () => void;
  onMapError: (message: string) => void;
};

const styleUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

export default function NativeMapCanvas({ schools, selectedId, request, onSelect, onMapReady, onMapError }: Props) {
  const camera = useRef<CameraRef>(null);

  useEffect(() => {
    if (!request || !camera.current) return;
    if (request.bounds) {
      const [[west, south], [east, north]] = request.bounds;
      camera.current.fitBounds([west, south, east, north], { duration: 700 });
    } else if (request.center) {
      camera.current.flyTo({ center: request.center, zoom: request.zoom ?? 10, duration: 700 });
    }
  }, [request?.id]);

  return <View style={styles.container}>
    <Map
      style={styles.map}
      mapStyle={styleUrl}
      attribution
      logo
      compass
      onDidFinishLoadingMap={onMapReady}
      onDidFailLoadingMap={() => onMapError("Map tiles could not be loaded.")}
    >
      <Camera ref={camera} initialViewState={{ center: [82.8, 22.9], zoom: 4.1 }} />
      {schools.map((school) => <NativeSchoolMarker key={school.id} school={school} selected={selectedId === school.id} onSelect={onSelect} />)}
    </Map>
  </View>;
}

function NativeSchoolMarker({ school, selected, onSelect }: { school: JnvMapSchool; selected: boolean; onSelect: (school: JnvMapSchool) => void }) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(selected ? 1.12 : 1)).current;

  useEffect(() => {
    if (reducedMotion !== false) {
      scale.setValue(selected ? 1.12 : 1);
      return;
    }
    const animation = Animated.spring(scale, { toValue: selected ? 1.12 : 1, tension: 260, friction: 18, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, scale, selected]);

  return <Marker
    id={school.id}
    lngLat={[school.longitude, school.latitude]}
    anchor="bottom"
    onPress={() => onSelect(school)}
  >
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Select ${school.name}`} style={[styles.marker, selected && styles.selectedMarker]}>
        <Text style={styles.markerText}>J</Text>
      </Pressable>
    </Animated.View>
  </Marker>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  marker: { width: 30, height: 30, borderRadius: 16, borderBottomLeftRadius: 5, transform: [{ rotate: "-45deg" }], backgroundColor: "#7C3AED", borderWidth: 2, borderColor: "white", alignItems: "center", justifyContent: "center", elevation: 4 },
  selectedMarker: { width: 36, height: 36, backgroundColor: "#E34E55" },
  markerText: { color: "white", fontSize: 11, fontWeight: "600", transform: [{ rotate: "45deg" }] },
});
