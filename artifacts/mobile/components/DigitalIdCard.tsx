import React, { useRef, useState } from "react";
import { Alert, Image, Modal, Platform, Share, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import type { DigitalCredential } from "@/lib/api";
import { createDigitalIdProfileUrl } from "@/lib/digital-id";
import { ThemedText as Text } from "@/components/ThemedNative";

const ROLE_LABEL: Record<string, string> = { student: "Student", alumni: "Alumni", teacher: "Teacher", official: "JNV Official" };

export default function DigitalIdCard({ credential, compact = false }: { credential: DigitalCredential; compact?: boolean }) {
  const qrRef = useRef<View>(null);
  const [busy, setBusy] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const qrProfileUrl = createDigitalIdProfileUrl(credential.userId);
  const profileUrl = credential.publicProfileUrl || (Platform.OS === "web" ? qrProfileUrl : credential.publicVerificationUrl || qrProfileUrl);
  const shareableUrl = credential.publicProfileUrl || credential.publicVerificationUrl || (Platform.OS === "web" ? qrProfileUrl : "");
  const role = ROLE_LABEL[credential.role] || credential.role;

  const copy = async (value: string, message: string) => {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert(message, "Copied to clipboard.");
    } catch {
      Alert.alert("Could not copy", "Please try again.");
    }
  };

  const shareDetails = async () => {
    try {
      await Share.share({
        title: "Navodaya Connect Digital ID",
        message: `Navodaya Connect Digital ID: ${credential.credentialId}\n${credential.fullName} · ${role}\n${credential.jnvName}, ${credential.jnvState}${shareableUrl ? `\nProfile: ${shareableUrl}` : ""}`,
        url: shareableUrl || undefined,
      });
    } catch {
      Alert.alert("Unable to share", "Copy the profile link and share it manually.");
    }
  };

  const exportQr = async (mode: "share" | "save") => {
    if (!qrRef.current || busy) return;
    setBusy(mode);
    try {
      const uri = await captureRef(qrRef.current, { format: "png", quality: 1, result: "tmpfile" });
      if (mode === "share") {
        if (Platform.OS === "web") {
          if (typeof document === "undefined" || !navigator.clipboard?.writeText) throw new Error("Image export is unavailable here. Copy the profile link instead.");
          if (shareableUrl) await navigator.clipboard.writeText(shareableUrl);
          else throw new Error("Set PUBLIC_APP_URL to enable a web link. Copy the Digital ID to share it manually.");
          Alert.alert("Shareable link copied", "Open this page on a device to share or save the QR image.");
          return;
        }
        if (!await Sharing.isAvailableAsync()) throw new Error("Image sharing is not available on this device.");
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your Navodaya Digital ID QR" });
      } else {
        if (Platform.OS === "web") {
          if (typeof document === "undefined") throw new Error("QR download is unavailable in this browser.");
          const link = document.createElement("a");
          link.href = uri;
          link.download = `${credential.credentialId}.png`;
          link.click();
          return;
        }
        const permission = await MediaLibrary.requestPermissionsAsync(true);
        if (!permission.granted) throw new Error("Allow photo access to save your QR code.");
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert("QR code saved", "Your Digital ID QR code is in your photo library.");
      }
    } catch (error) {
      Alert.alert(mode === "share" ? "Could not share QR image" : "Could not save QR image", error instanceof Error ? error.message : "Try sharing your Digital ID link instead.");
    } finally {
      setBusy("");
    }
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.identity}>
        {credential.photoURL ? <Image source={{ uri: credential.photoURL }} style={styles.photo} /> : <View style={styles.photoFallback}><Ionicons name="person" size={20} color="#355BE5" /></View>}
        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>{credential.fullName}</Text>
          <Text style={styles.role}>{role} · Verified</Text>
        </View>
        <Ionicons name="shield-checkmark" size={22} color="#059669" />
        <TouchableOpacity style={styles.moreButton} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Digital ID actions">
          <Ionicons name="ellipsis-vertical" size={19} color="#475569" />
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        <View style={styles.idColumn}>
          <Text style={styles.eyebrow}>NAVODAYA DIGITAL ID</Text>
          <Text selectable style={styles.id}>{credential.credentialId}</Text>
          <Text style={styles.school}>{credential.jnvName}</Text>
          <Text style={styles.state}>{credential.jnvState}</Text>
        </View>
        <View ref={qrRef} collapsable={false} style={styles.qrWrap} accessible accessibilityLabel="QR code opens this profile">
          <QRCode value={qrProfileUrl} size={compact ? 92 : 132} color="#15264B" backgroundColor="#FFFFFF" ecl="M" />
        </View>
      </View>

      {!compact ? <Text style={styles.note}>This community ID identifies your Navodaya Connect account. It does not grant access to private profile content and is not a government identity card.</Text> : null}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Digital ID actions</Text>
            <Action icon="copy-outline" label="Copy ID" onPress={() => { setMenuOpen(false); void copy(credential.credentialId, "Digital ID copied"); }} />
            <Action icon="link-outline" label="Copy profile link" onPress={() => { setMenuOpen(false); void copy(profileUrl, "Profile link copied"); }} />
            <Action icon="share-social-outline" label="Share" onPress={() => { setMenuOpen(false); void shareDetails(); }} />
            <Action icon="qr-code-outline" label={busy === "share" ? "Preparing…" : "Share QR image"} onPress={() => { setMenuOpen(false); void exportQr("share"); }} disabled={!!busy} />
            <Action icon="download-outline" label={busy === "save" ? "Saving…" : "Save QR"} onPress={() => { setMenuOpen(false); void exportQr("save"); }} disabled={!!busy} />
            <TouchableOpacity style={styles.cancelAction} onPress={() => setMenuOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function Action({ icon, label, onPress, disabled = false }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity style={[styles.action, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
    <Ionicons name={icon} size={17} color="#7C3AED" />
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 560, alignSelf: "center", borderRadius: 24, backgroundColor: "#fff", padding: 18, gap: 16, borderWidth: 1, borderColor: "#E9D5FF", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  cardCompact: { marginTop: 14, padding: 14, gap: 12 },
  identity: { flexDirection: "row", alignItems: "center", gap: 10 },
  photo: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F5F3FF", borderWidth: 2, borderColor: "#DDD6FE" },
  photoFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#DDD6FE" },
  identityText: { flex: 1, minWidth: 0 },
  name: { color: "#1E1B4B", fontFamily: "Inter_700Bold", fontSize: 15 },
  role: { color: "#64748B", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  main: { minHeight: 136, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 14, borderRadius: 18, backgroundColor: "#FAF5FF", borderWidth: 1, borderColor: "#EDE9FE" },
  idColumn: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { color: "#7C3AED", fontFamily: "Inter_600SemiBold", fontSize: 9.5, letterSpacing: 0.8 },
  id: { color: "#5B21B6", fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: 0.3 },
  school: { color: "#1E1B4B", fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 5 },
  state: { color: "#64748B", fontFamily: "Inter_400Regular", fontSize: 11 },
  qrWrap: { width: 148, height: 148, flexShrink: 0, backgroundColor: "#fff", padding: 8, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EDE9FE" },
  note: { color: "#64748B", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  moreButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  menuBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(30, 27, 75, 0.45)" },
  menu: { width: "100%", maxWidth: 380, borderRadius: 24, padding: 18, gap: 10, backgroundColor: "#fff" },
  menuTitle: { color: "#1E1B4B", fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 3 },
  action: { minHeight: 46, width: "100%", borderRadius: 14, backgroundColor: "#F5F3FF", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  actionText: { flex: 1, color: "#6D28D9", fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "left" },
  cancelAction: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#64748B", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  disabled: { opacity: 0.55 },
});
