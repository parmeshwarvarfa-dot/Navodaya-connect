import React, { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getJnvSchools, STATES } from "@/data/jnvData";
import MapCanvas from "@/components/map/MapCanvas";
import type { MapViewRequest } from "@/components/map/map-types";
import { hasValidCoordinates, JNV_MAP_PILOT_SCHOOLS, type JnvMapSchool } from "@/lib/jnv-map-data";
import FadeIn from "@/components/motion/FadeIn";
import MotionPressable from "@/components/motion/MotionPressable";

type ViewMode = "map" | "list";
type JnvDirectorySchool = {
  id: string;
  name: string;
  district: string;
  state: string;
  mappedSchool?: JnvMapSchool;
};

function googleMapsSearchUrl(school: Pick<JnvDirectorySchool, "name" | "district" | "state">) {
  const query = `${school.name}, ${school.district}, ${school.state}, India`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function JnvMapPrototypeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ViewMode>("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [request, setRequest] = useState<MapViewRequest>();
  const [stateFilter, setStateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const mappedSchools = useMemo(() => JNV_MAP_PILOT_SCHOOLS.filter(hasValidCoordinates), []);
  const schools = useMemo(() => STATES.flatMap((state) => getJnvSchools(state).map((name) => {
    const mappedSchool = mappedSchools.find((school) => school.name.toLocaleLowerCase() === name.toLocaleLowerCase() && school.state === state);
    return {
      id: `${state}:${name}`,
      name,
      district: name.replace(/^JNV\s+/i, ""),
      state,
      mappedSchool,
    };
  })), [mappedSchools]);
  const states = useMemo(() => [...new Set(schools.map((school) => school.state))].sort(), [schools]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return schools.filter((school) => {
      const matchesQuery = !normalized || [school.name, school.state, school.district].some((value) => value.toLocaleLowerCase().includes(normalized));
      return matchesQuery && (!stateFilter || school.state === stateFilter);
    });
  }, [query, schools, stateFilter]);
  const mappedMatches = useMemo(() => {
    const matchingNames = new Set(matches.map((school) => `${school.state}:${school.name}`));
    return mappedSchools.filter((school) => matchingNames.has(`${school.state}:${school.name}`));
  }, [mappedSchools, matches]);
  const selected = mappedSchools.find((school) => school.id === selectedId) ?? null;
  const wide = Platform.OS === "web" && width >= 980;
  const mapHeight = Math.max(300, Math.min(height * 0.55, 550));

  const openGoogleMaps = (school: Pick<JnvDirectorySchool, "name" | "district" | "state">) => {
    void Linking.openURL(googleMapsSearchUrl(school)).catch(() => {});
  };
  const focusMappedSchool = (school: JnvMapSchool) => {
    setSelectedId(school.id);
    setRequest({ id: Date.now(), center: [school.longitude, school.latitude], zoom: 9.5 });
    setMode("map");
  };
  const selectSchool = (school: JnvDirectorySchool) => {
    if (school.mappedSchool) {
      focusMappedSchool(school.mappedSchool);
      return;
    }
    openGoogleMaps(school);
  };
  const showIndia = () => {
    setSelectedId(null);
    setRequest({ id: Date.now(), center: [82.8, 22.9], zoom: 4.1 });
  };

  const schoolList = <ScrollView style={wide ? s.resultsScrollWide : undefined} contentContainerStyle={s.resultsContent} keyboardShouldPersistTaps="handled">
    <View style={s.resultsHeadingRow}>
      <View><Text style={s.resultsTitle}>All JNVs</Text><Text style={s.resultsSub}>{matches.length} of {schools.length} directory schools</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Filter by state" onPress={() => setFiltersOpen((open) => !open)} style={[s.filterButton, filtersOpen && s.filterButtonActive]}>
        <Ionicons name="filter-outline" size={16} color="#3D5AF1" /><Text style={s.filterText}>State</Text>
      </TouchableOpacity>
    </View>
    {filtersOpen && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
      <FilterChip label="All states" active={!stateFilter} onPress={() => setStateFilter("")} />
      {states.map((state) => <FilterChip key={state} label={state} active={stateFilter === state} onPress={() => setStateFilter(stateFilter === state ? "" : state)} />)}
    </ScrollView>}
    {matches.length === 0 ? <View style={s.empty}><Ionicons name="search-outline" size={25} color="#98A2B3"/><Text style={s.emptyTitle}>No matching schools</Text><Text style={s.emptyBody}>Try a school, district, or state name.</Text></View> : matches.map((school) => <SchoolResult key={school.id} school={school} selected={selectedId === school.mappedSchool?.id} onPress={() => selectSchool(school)} onOpenGoogleMaps={() => openGoogleMaps(school)} />)}
    <View style={s.limitedNotice}><Ionicons name="information-circle-outline" size={17} color="#667085"/><Text style={s.limitedText}>Names come from the app's current JNV directory. The interactive map currently has {mappedSchools.length} mapped points; use Maps to search any listed school in Google Maps.</Text></View>
  </ScrollView>;

  const map = <View style={[s.mapFrame, wide ? s.mapFrameWide : { height: mapHeight }]}>
    <MapCanvas schools={mappedMatches} selectedId={selectedId} request={request} onSelect={focusMappedSchool} onMapReady={() => { setMapReady(true); setMapError(""); }} onMapError={setMapError} />
    {!mapReady && !mapError && <View pointerEvents="none" style={s.mapLoading}><ActivityIndicator color="#3D5AF1"/><Text style={s.mapLoadingText}>Loading real map tiles…</Text></View>}
    {!!mapError && <View style={s.mapError}><Ionicons name="warning-outline" size={20} color="#B54708"/><Text style={s.mapErrorText}>Map tiles are unavailable. You can still search and browse the school list below.</Text></View>}
    <View style={s.mapActions}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show India overview" onPress={showIndia} style={s.mapAction}><Ionicons name="scan-outline" size={18} color="#344054"/></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show school list" onPress={() => setMode("list")} style={s.mapAction}><Ionicons name="list-outline" size={18} color="#344054"/></TouchableOpacity>
    </View>
    <View style={s.attribution}><Text style={s.attributionText}>© OpenStreetMap contributors · MapLibre demo tiles</Text></View>
    {selected && mode === "map" && <FadeIn style={s.previewCard}>
      <View style={s.schoolMark}><Ionicons name="school" size={18} color="#3D5AF1"/></View>
      <View style={{ flex: 1 }}><Text style={s.previewName}>{selected.name}</Text><Text style={s.previewLocation}>{selected.district}, {selected.state}</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${selected.name} in Google Maps`} onPress={() => openGoogleMaps(selected)} style={s.sourceButton}><Ionicons name="navigate-outline" size={17} color="#168A54"/></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open source map record" onPress={() => Linking.openURL(selected.sourceUrl)} style={s.sourceButton}><Ionicons name="open-outline" size={17} color="#3D5AF1"/></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close school details" onPress={() => setSelectedId(null)} style={s.closeButton}><Ionicons name="close" size={18} color="#667085"/></TouchableOpacity>
      <Text style={s.sourceLabel}>Mapped school feature · <Text onPress={() => Linking.openURL(selected.sourceUrl)} style={s.sourceLink}>View source</Text></Text>
    </FadeIn>}
  </View>;

  return <View style={[s.page, { paddingBottom: Platform.OS === "web" ? 0 : insets.bottom }]}>
    <View style={[s.header, { paddingTop: (Platform.OS === "web" ? 8 : insets.top + 8) }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={20} color="#172033"/></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={s.title}>JNV Connect Map</Text><Text style={s.subtitle}>Search JNVs and open locations in Google Maps</Text></View>
      <View style={s.modeToggle}><TouchableOpacity onPress={() => setMode("map")} style={[s.modeButton, mode === "map" && s.modeActive]}><Text style={[s.modeText, mode === "map" && s.modeTextActive]}>Map</Text></TouchableOpacity><TouchableOpacity onPress={() => setMode("list")} style={[s.modeButton, mode === "list" && s.modeActive]}><Text style={[s.modeText, mode === "list" && s.modeTextActive]}>List</Text></TouchableOpacity></View>
    </View>
    <View style={s.searchWrap}><Ionicons name="search" size={18} color="#7B879B"/><TextInput value={query} onChangeText={(text) => { setQuery(text); setSelectedId(null); }} placeholder="Search school, district, or state" placeholderTextColor="#98A2B3" style={s.search} accessibilityLabel="Search school, district, or state" returnKeyType="search"/><TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setQuery(""); setStateFilter(""); }}><Ionicons name="close-circle" size={18} color={query || stateFilter ? "#98A2B3" : "transparent"}/></TouchableOpacity></View>
    <View style={s.tabs}><View style={s.selectedTab}><Ionicons name="school" size={16} color="#3D5AF1"/><Text style={s.selectedTabText}>Schools</Text></View><View style={s.disabledTab}><Ionicons name="people-outline" size={16} color="#98A2B3"/><Text style={s.disabledTabText}>Community · Coming later</Text></View></View>
    {wide ? <View style={s.desktopBody}>{map}<View style={s.resultsPanel}>{schoolList}</View></View> : mode === "map" ? <View style={s.mobileBody}>{map}<View style={s.mobileResults}>{schoolList}</View></View> : <View style={s.mobileBody}>{schoolList}</View>}
    <View style={s.footer}><Text style={s.footerText}>{mapError ? "Map fallback: school list remains available" : mapReady ? "Interactive map ready · pan and pinch to zoom" : "Connecting to map provider…"}</Text></View>
  </View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}><Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text></TouchableOpacity>;
}

function SchoolResult({ school, selected, onPress, onOpenGoogleMaps }: { school: JnvDirectorySchool; selected: boolean; onPress: () => void; onOpenGoogleMaps: () => void }) {
  return <View style={[s.schoolCard, selected && s.schoolCardSelected]}>
    <MotionPressable accessibilityRole="button" accessibilityLabel={school.mappedSchool ? `Show ${school.name} on interactive map` : `Find ${school.name} in Google Maps`} onPress={onPress} style={s.schoolMain}>
      <View style={s.schoolMark}><Ionicons name="school" size={18} color="#3D5AF1"/></View>
      <View style={s.schoolInfo}>
        <Text style={s.schoolName} numberOfLines={2} ellipsizeMode="tail">{school.name}</Text>
        <Text style={s.schoolLocation} numberOfLines={1} ellipsizeMode="tail">{school.district}, {school.state}</Text>
      </View>
    </MotionPressable>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${school.name} in Google Maps`} onPress={onOpenGoogleMaps} style={s.googleMapsButton}>
      <Ionicons name="navigate-outline" size={17} color="#168A54" />
      <Text style={s.googleMapsButtonText}>Maps</Text>
    </TouchableOpacity>
  </View>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "white", paddingHorizontal: 16, paddingBottom: 9, borderBottomWidth: 1, borderColor: "#EAECF0" },
  back: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#F2F4F7", alignItems: "center", justifyContent: "center" },
  title: { color: "#172033", fontSize: 17, fontFamily: "Inter_700Bold" }, subtitle: { color: "#7B879B", fontSize: 11, marginTop: 2 },
  modeToggle: { flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: "#F2F4F7" }, modeButton: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 }, modeActive: { backgroundColor: "white", shadowColor: "#101828", shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 }, modeText: { color: "#667085", fontSize: 12, fontFamily: "Inter_600SemiBold" }, modeTextActive: { color: "#344054" },
  searchWrap: { marginHorizontal: 14, marginTop: 11, height: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "white" }, search: { flex: 1, color: "#172033", fontSize: 13, outlineStyle: "none" as never },
  tabs: { flexDirection: "row", gap: 9, paddingHorizontal: 14, paddingVertical: 9 }, selectedTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#E8EDFF" }, selectedTabText: { color: "#3D5AF1", fontSize: 12, fontFamily: "Inter_600SemiBold" }, disabledTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#EEF0F4" }, disabledTabText: { color: "#8993A4", fontSize: 12 },
  desktopBody: { flex: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingBottom: 10 }, mapFrame: { flex: 1, minHeight: 260, position: "relative", overflow: "hidden", borderRadius: 17, backgroundColor: "#E8ECF3", borderWidth: 1, borderColor: "#E0E4EC" }, mapFrameWide: { minWidth: 0 }, resultsPanel: { width: 390, minWidth: 320, maxWidth: "42%", borderRadius: 16, overflow: "hidden", backgroundColor: "white", borderWidth: 1, borderColor: "#EAECF0" }, resultsScrollWide: { flex: 1, minWidth: 0 }, mobileBody: { flex: 1, paddingHorizontal: 12, paddingBottom: 4 }, mobileResults: { flex: 1, minHeight: 120, marginTop: 8, borderRadius: 15, overflow: "hidden", backgroundColor: "white", borderWidth: 1, borderColor: "#EAECF0" },
  mapActions: { position: "absolute", right: 11, top: 54, gap: 7 }, mapAction: { width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#E4E7EC", shadowColor: "#101828", shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 }, mapLoading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F2F4F7AA" }, mapLoadingText: { color: "#475467", fontSize: 12 }, mapError: { position: "absolute", top: 9, left: 9, right: 60, flexDirection: "row", gap: 7, alignItems: "center", padding: 10, borderRadius: 12, backgroundColor: "#FFFAEB", borderWidth: 1, borderColor: "#FEDF89" }, mapErrorText: { flex: 1, color: "#7A2E0E", fontSize: 11, lineHeight: 15 }, attribution: { position: "absolute", left: 7, bottom: 7, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: "#FFFFFFE8" }, attributionText: { color: "#475467", fontSize: 9 },
  previewCard: { position: "absolute", left: 10, right: 58, bottom: 36, minHeight: 65, padding: 10, paddingRight: 36, borderRadius: 14, backgroundColor: "white", flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#E4E7EC", shadowColor: "#101828", shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 }, previewName: { color: "#172033", fontSize: 12, fontFamily: "Inter_700Bold" }, previewLocation: { color: "#667085", fontSize: 11, marginTop: 3 }, sourceButton: { padding: 6 }, closeButton: { position: "absolute", right: 7, top: 7, padding: 3 }, sourceLabel: { position: "absolute", left: 58, bottom: 7, color: "#7B879B", fontSize: 9 }, sourceLink: { color: "#3D5AF1" }, schoolMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  resultsContent: { padding: 12, paddingBottom: 16 }, resultsHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 }, resultsTitle: { color: "#172033", fontSize: 14, fontFamily: "Inter_700Bold" }, resultsSub: { color: "#7B879B", fontSize: 10, marginTop: 2 }, filterButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "#E4E7EC" }, filterButtonActive: { backgroundColor: "#EEF2FF" }, filterText: { color: "#3D5AF1", fontSize: 11 }, filterRow: { gap: 6, paddingBottom: 9 }, chip: { paddingVertical: 6, paddingHorizontal: 9, borderRadius: 15, backgroundColor: "#F2F4F7" }, chipActive: { backgroundColor: "#E8EDFF" }, chipText: { fontSize: 10, color: "#667085" }, chipTextActive: { color: "#3D5AF1", fontFamily: "Inter_600SemiBold" }, schoolCard: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, padding: 9, borderRadius: 13, marginBottom: 7, backgroundColor: "white", borderWidth: 1, borderColor: "#EAECF0" }, schoolCardSelected: { borderColor: "#9AA9FF", backgroundColor: "#F7F8FF" }, schoolMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }, schoolInfo: { flex: 1, minWidth: 0 }, googleMapsButton: { flexShrink: 0, minWidth: 57, height: 36, borderRadius: 10, paddingHorizontal: 7, flexDirection: "row", gap: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#E9F7EF" }, googleMapsButtonText: { color: "#168A54", fontSize: 10, fontFamily: "Inter_600SemiBold" }, schoolName: { flexShrink: 1, color: "#344054", fontSize: 12, lineHeight: 16, fontFamily: "Inter_600SemiBold" }, schoolLocation: { color: "#7B879B", fontSize: 10, marginTop: 3 }, limitedNotice: { flexDirection: "row", gap: 6, padding: 9, backgroundColor: "#F8F9FC", borderRadius: 10, marginTop: 3 }, limitedText: { flex: 1, color: "#667085", fontSize: 10, lineHeight: 14 }, empty: { alignItems: "center", gap: 6, paddingVertical: 30 }, emptyTitle: { color: "#344054", fontSize: 13, fontFamily: "Inter_600SemiBold" }, emptyBody: { color: "#7B879B", fontSize: 11 }, footer: { paddingVertical: 6, alignItems: "center" }, footerText: { color: "#7B879B", fontSize: 9 },
});
