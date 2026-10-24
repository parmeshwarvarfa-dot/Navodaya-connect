import React, { useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getJnvSchools, STATES } from "@/data/jnvData";

type PickerKind = "state" | "school";

export default function JnvDirectoryFields({
  state,
  school,
  variant = "light",
  onStateChange,
  onSchoolChange,
}: {
  state: string;
  school: string;
  variant?: "light" | "blue";
  onStateChange: (value: string) => void;
  onSchoolChange: (value: string) => void;
}) {
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [search, setSearch] = useState("");
  const schools = useMemo(() => getJnvSchools(state), [state]);
  const options = useMemo(
    () => picker === "state" ? STATES : schools,
    [picker, schools],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? options.filter((option) => option.toLocaleLowerCase().includes(query)) : options;
  }, [options, search]);
  const blue = variant === "blue";

  const open = (kind: PickerKind) => {
    setSearch("");
    setPicker(kind);
  };

  const choose = (value: string) => {
    if (picker === "state") {
      onStateChange(value);
      onSchoolChange("");
    } else {
      onSchoolChange(value);
    }
    setPicker(null);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={[styles.field, blue && styles.fieldBlue]} onPress={() => open("state")} activeOpacity={0.8}>
        <Ionicons name="map-outline" size={18} color={blue ? "rgba(255,255,255,0.78)" : "#6B7280"} />
        <Text style={[styles.fieldText, blue && styles.fieldTextBlue, !state && styles.placeholder, !state && blue && styles.placeholderBlue]} numberOfLines={1}>{state || "Select JNV State"}</Text>
        <Ionicons name="chevron-down" size={16} color={blue ? "rgba(255,255,255,0.65)" : "#9CA3AF"} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.field, blue && styles.fieldBlue, !state && styles.disabled]}
        onPress={() => state && open("school")}
        disabled={!state}
        activeOpacity={0.8}
      >
        <Ionicons name="school-outline" size={18} color={blue ? "rgba(255,255,255,0.78)" : "#6B7280"} />
        <Text style={[styles.fieldText, blue && styles.fieldTextBlue, !school && styles.placeholder, !school && blue && styles.placeholderBlue]} numberOfLines={1}>{school || (state ? "Search JNV name" : "Choose state first")}</Text>
        <Ionicons name="search-outline" size={16} color={blue ? "rgba(255,255,255,0.65)" : "#9CA3AF"} />
      </TouchableOpacity>
      <Text style={[styles.note, blue && styles.noteBlue]}>Directory coverage is still being reconciled; verify a missing school with NVS instead of choosing a different JNV.</Text>

      <Modal visible={picker !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setPicker(null)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{picker === "state" ? "Choose your JNV state" : `Choose a JNV in ${state}`}</Text>
              <Text style={styles.modalSub}>{picker === "state" ? "Select a state or union territory first." : `${options.length} unique names in this state`}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setPicker(null)}>
              <Ionicons name="close" size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={picker === "state" ? "Search states…" : "Search school names…"}
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoFocus
              autoCorrect={false}
            />
            {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={17} color="#9CA3AF" /></TouchableOpacity> : null}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={(
              <Text style={styles.noResults}>
                {picker === "school" && !schools.length
                  ? "No JNVs are listed for this state or union territory."
                  : "No matching entry found. Try another search."}
              </Text>
            )}
            renderItem={({ item }) => {
              const selected = picker === "state" ? item === state : item === school;
              return (
                <TouchableOpacity style={styles.option} onPress={() => choose(item)}>
                  <Text style={[styles.optionText, selected && styles.optionSelected]}>{item}</Text>
                  {selected ? <Ionicons name="checkmark-circle" size={19} color="#3D5AF1" /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  field: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  // Keep both JNV selectors visually consistent with the signup form's class/house pills.
  fieldBlue: { height: 54, minHeight: 54, borderRadius: 28, paddingHorizontal: 18, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 0, borderColor: "transparent" },
  fieldText: { flex: 1, color: "#111827", fontSize: 14, fontFamily: "Inter_500Medium" },
  fieldTextBlue: { color: "#fff", fontSize: 15, fontFamily: "Inter_400Regular" },
  placeholder: { color: "#9CA3AF" },
  placeholderBlue: { color: "rgba(255,255,255,0.65)" },
  disabled: { opacity: 0.6 },
  note: { color: "#8490A0", fontSize: 10, lineHeight: 15, fontFamily: "Inter_400Regular", paddingHorizontal: 2 },
  noteBlue: { color: "rgba(255,255,255,0.72)" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 18, borderBottomWidth: 1, borderBottomColor: "#EEF0F4" },
  modalTitle: { color: "#111827", fontSize: 17, fontFamily: "Inter_700Bold" },
  modalSub: { color: "#7B8492", fontSize: 12, marginTop: 4 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 9, margin: 14, paddingHorizontal: 12, height: 44, borderRadius: 12, backgroundColor: "#F3F4F6" },
  searchInput: { flex: 1, height: "100%", color: "#111827", fontSize: 14 },
  option: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB" },
  optionText: { color: "#374151", fontSize: 14 },
  optionSelected: { color: "#3D5AF1", fontFamily: "Inter_600SemiBold" },
  noResults: { padding: 22, textAlign: "center", color: "#7B8492", fontSize: 13 },
});
