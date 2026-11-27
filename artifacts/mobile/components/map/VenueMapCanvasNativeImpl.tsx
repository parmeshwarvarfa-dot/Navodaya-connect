import React from "react";
import { StyleSheet, View } from "react-native";
import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import type { VenueMapCanvasProps } from "./VenueMapCanvas";

const styleUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

export default function VenueMapCanvasNativeImpl({ selectedCoordinate, onCoordinateSelect }: VenueMapCanvasProps) {
  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={styleUrl}
        attribution
        logo
        compass
        onPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          if (typeof longitude === "number" && typeof latitude === "number") onCoordinateSelect([longitude, latitude]);
        }}
      >
        <Camera initialViewState={{ center: selectedCoordinate ?? [82.8, 22.9], zoom: selectedCoordinate ? 13 : 4.1 }} />
        {selectedCoordinate ? (
          <Marker id="selected-venue" lngLat={selectedCoordinate} anchor="bottom">
            <View style={styles.marker} />
          </Marker>
        ) : null}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 300, overflow: "hidden", borderRadius: 14 },
  map: { flex: 1 },
  marker: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#7C3AED", borderWidth: 3, borderColor: "#fff" },
});
