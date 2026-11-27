import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, type VenuePlace } from "@/lib/api";
import VenueMapCanvas from "./VenueMapCanvas";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

export default function VenuePickerModal({
  visible,
  initialQuery,
  onSelect,
  onClose,
}: {
  visible: boolean;
  initialQuery: string;
  onSelect: (venue: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<VenuePlace[]>([]);
  const [selectedCoordinate, setSelectedCoordinate] = useState<[number, number] | null>(null);
  const [searching, setSearching] = useState(false);
  const [resolvingMapTap, setResolvingMapTap] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery);
    setPlaces([]);
    setSelectedCoordinate(null);
    setError("");
  }, [visible, initialQuery]);

  useEffect(() => {
    const searchTerm = query.trim();
    if (!visible || searchTerm.length < 3) {
      setPlaces([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSearching(true);
      setError("");
      api.calendar.searchPlaces(searchTerm, controller.signal)
        .then((result) => setPlaces(result.places))
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setPlaces([]);
          setError(reason instanceof Error ? reason.message : "Could not search for places.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, visible]);

  const chooseFeature = (place: VenuePlace) => {
    setSelectedCoordinate(place.coordinates);
    onSelect(place.label);
    onClose();
  };

  const chooseMapPoint = async (coordinates: [number, number]) => {
    setSelectedCoordinate(coordinates);
    setResolvingMapTap(true);
    setError("");
    try {
      const { place } = await api.calendar.reversePlace(coordinates);
      onSelect(place.label);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not identify that map location.");
    } finally {
      setResolvingMapTap(false);
    }
  };

  const openGoogleMaps = async () => {
    const queryValue = selectedCoordinate
      ? `${selectedCoordinate[1]},${selectedCoordinate[0]}`
      : query.trim();
    if (!queryValue) {
      setError("Search for a place or tap the map before opening Google Maps.");
      return;
    }
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryValue)}`);
    } catch {
      setError("Could not open Google Maps.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Choose event venue</Text>
            <Text style={styles.subtitle}>Tap the map or search for a place to fill the venue automatically.</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close venue picker">
            <Ionicons name="close" size={22} color="#475467" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#667085" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search a venue, city, or address"
              placeholderTextColor="#98A2B3"
              accessibilityLabel="Search for a venue"
            />
            {searching ? <ActivityIndicator size="small" color="#7C3AED" /> : null}
          </View>
          {places.length ? (
            <View style={styles.results}>
              {places.map((place, index) => (
                <TouchableOpacity
                  key={`${place.coordinates.join(",")}-${index}`}
                  style={styles.placeResult}
                  onPress={() => chooseFeature(place)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${place.label}`}
                >
                  <View style={styles.resultIcon}><Ionicons name="location-outline" size={17} color="#7C3AED" /></View>
                  <Text style={styles.placeLabel}>{place.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {!!error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.mapHeading}>
            <Text style={styles.sectionTitle}>Or tap the map</Text>
            {resolvingMapTap ? <ActivityIndicator size="small" color="#7C3AED" /> : null}
          </View>
          <VenueMapCanvas selectedCoordinate={selectedCoordinate} onCoordinateSelect={(point) => void chooseMapPoint(point)} />
          <Text style={styles.mapHint}>Place search uses OpenStreetMap data via Photon. Picking here fills the venue automatically; Google Maps opens separately and cannot return a picked place to this form.</Text>
          <TouchableOpacity style={styles.googleMapsButton} onPress={() => void openGoogleMaps()} accessibilityRole="button">
            <Ionicons name="navigate-outline" size={17} color="#fff" />
            <Text style={styles.googleMapsButtonText}>Open Google Maps</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FC" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 15, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#E9ECF1" },
  headerCopy: { flex: 1 },
  title: { color: "#202637", fontSize: 17, fontFamily: "Inter_700Bold" },
  subtitle: { color: "#7D8797", fontSize: 11, lineHeight: 16, marginTop: 3, fontFamily: "Inter_400Regular" },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F2F6", alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 30 },
  searchBox: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E6ED", borderRadius: 12 },
  searchInput: { flex: 1, minWidth: 0, color: "#252C3B", fontSize: 13, fontFamily: "Inter_400Regular" },
  results: { marginTop: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E9ECF1", borderRadius: 12, overflow: "hidden" },
  placeResult: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  resultIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#F3EEFF", alignItems: "center", justifyContent: "center" },
  placeLabel: { flex: 1, color: "#344054", fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
  error: { color: "#B42318", fontSize: 12, lineHeight: 17, marginTop: 8, fontFamily: "Inter_500Medium" },
  mapHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
  sectionTitle: { color: "#344054", fontSize: 13, fontFamily: "Inter_700Bold" },
  mapHint: { color: "#7D8797", fontSize: 11, lineHeight: 16, marginTop: 8, fontFamily: "Inter_400Regular" },
  googleMapsButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 12, borderRadius: 12, backgroundColor: "#6D28D9" },
  googleMapsButtonText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
