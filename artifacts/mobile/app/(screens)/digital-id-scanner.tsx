import React, { useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { isDigitalId, parseDigitalIdProfileLink } from "@/lib/digital-id";

export default function DigitalIdScannerScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scanHandled = useRef(false);

  const openCamera = async () => {
    setError("");
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError(result.canAskAgain ? "Camera permission is needed to scan a Digital ID. You can enter the ID manually below." : "Camera access is disabled. Enable it in device settings or enter the ID manually below.");
        return;
      }
    }
    scanHandled.current = false;
    setCameraVisible(true);
  };

  const resolve = async (raw: string) => {
    if (loading) return;
    setLoading(true);
    setError("");
    setCameraVisible(false);
    const value = raw.trim();
    try {
      let userId: string | null = null;
      const linkedUserId = parseDigitalIdProfileLink(value);
      if (linkedUserId) {
        await api.users.get(linkedUserId);
        userId = linkedUserId;
      } else if (isDigitalId(value)) {
        const matches = await api.users.search(value.replace(/\s/g, "").toUpperCase());
        userId = matches[0]?.id ?? null;
      } else {
        throw new Error("This QR code or ID is not a supported Navodaya Digital ID.");
      }
      if (!userId) throw new Error("No discoverable profile matches this Digital ID.");
      router.push({ pathname: "/(screens)/user-profile" as any, params: { userId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resolve this Digital ID. Try entering the ID manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (result: { data: string }) => {
    if (scanHandled.current) return;
    scanHandled.current = true;
    void resolve(result.data);
  };

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={21} color="#15264B" /></TouchableOpacity>
        <Text style={styles.title}>Scan Digital ID</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <View style={styles.introIcon}><Ionicons name="qr-code-outline" size={27} color="#355BE5" /></View>
          <Text style={styles.heading}>Find a Navodaya profile</Text>
          <Text style={styles.subheading}>Scan a Navodaya Connect QR code or enter the Digital ID. Profile privacy and blocking rules still apply.</Text>
        </View>

        {cameraVisible ? (
          <View style={styles.cameraFrame}>
            <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handleScan} />
            <View pointerEvents="none" style={styles.scanTarget} />
            <TouchableOpacity style={styles.closeCamera} onPress={() => setCameraVisible(false)} accessibilityLabel="Close camera"><Ionicons name="close" size={23} color="#fff" /></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.scanButton} onPress={() => void openCamera()} disabled={loading}>
            <Ionicons name="camera-outline" size={21} color="#fff" /><Text style={styles.scanButtonText}>Open QR scanner</Text>
          </TouchableOpacity>
        )}

        <View style={styles.separator}><View style={styles.line} /><Text style={styles.or}>OR ENTER MANUALLY</Text><View style={styles.line} /></View>
        <TextInput
          value={manualValue}
          onChangeText={setManualValue}
          placeholder="NC-STU-XXXXXXXXXX or profile link"
          placeholderTextColor="#94A0B3"
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={() => void resolve(manualValue)}
          accessibilityLabel="Digital ID or profile link"
        />
        <TouchableOpacity style={[styles.lookupButton, (!manualValue.trim() || loading) && styles.disabled]} onPress={() => void resolve(manualValue)} disabled={!manualValue.trim() || loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="search-outline" size={18} color="#fff" /><Text style={styles.lookupText}>Find profile</Text></>}
        </TouchableOpacity>
        {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}
        {!permission?.granted && permission?.canAskAgain === false ? <TouchableOpacity style={styles.settingsButton} onPress={() => void Linking.openSettings()}><Text style={styles.settingsText}>Open camera settings</Text></TouchableOpacity> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E9D5FF" },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F2F4F8", alignItems: "center", justifyContent: "center" },
  title: { color: "#15264B", fontFamily: "Inter_700Bold", fontSize: 18 },
  content: { width: "100%", maxWidth: 620, alignSelf: "center", padding: 18, gap: 15 },
  intro: { alignItems: "center", padding: 8, gap: 8 },
  introIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#E9EEFF", alignItems: "center", justifyContent: "center" },
  heading: { color: "#15264B", fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center" },
  subheading: { color: "#66758E", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 460 },
  scanButton: { minHeight: 50, borderRadius: 14, backgroundColor: "#355BE5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  scanButtonText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  cameraFrame: { height: 310, borderRadius: 18, overflow: "hidden", backgroundColor: "#101828", position: "relative" },
  camera: { flex: 1 },
  scanTarget: { position: "absolute", alignSelf: "center", width: 220, height: 220, top: 45, borderRadius: 20, borderWidth: 3, borderColor: "#fff" },
  closeCamera: { position: "absolute", right: 12, top: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  separator: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  line: { flex: 1, height: 1, backgroundColor: "#DFE4ED" },
  or: { color: "#8190A7", fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.7 },
  input: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: "#D8DFEB", borderRadius: 13, backgroundColor: "#fff", color: "#15264B", fontFamily: "Inter_400Regular", fontSize: 14 },
  lookupButton: { minHeight: 48, borderRadius: 13, backgroundColor: "#15264B", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  lookupText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  disabled: { opacity: 0.55 },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "#FEF3F2" },
  errorText: { flex: 1, color: "#B42318", fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 17 },
  settingsButton: { padding: 10, alignItems: "center" },
  settingsText: { color: "#355BE5", fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
