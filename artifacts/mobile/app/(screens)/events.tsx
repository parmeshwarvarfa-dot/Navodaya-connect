import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { Event } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PremiumInput } from "@/components/PremiumInput";
import EventCard from "@/components/EventCard";

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const canCreate = profile?.role === "teacher" || profile?.role === "official";

  const fetchEvents = async () => {
    try {
      const data = await api.events.list();
      setEvents(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    setFormError("");
    if (!title.trim() || !date.trim()) {
      setFormError("Please fill title and date");
      return;
    }
    setSubmitting(true);
    try {
      await api.events.create({
        title: title.trim(),
        description: description.trim(),
        date: date.trim(),
        location: location.trim() || undefined,
      });
      setShowCreate(false);
      setTitle(""); setDescription(""); setDate(""); setLocation("");
      fetchEvents();
    } catch {
      setFormError("Failed to create event. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1A3C6E", "#2D5A9E"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Events</Text>
            <Text style={styles.headerSub}>JNV functions, webinars &amp; reunions</Text>
          </View>
          {canCreate && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Organise</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#3D5AF1" size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3D5AF1" />}
        >
          {events.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={40} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>No Events Yet</Text>
              <Text style={styles.emptyText}>
                {canCreate
                  ? "Tap + Organise to create the first event for your JNV."
                  : "Check back later for upcoming events and programmes."}
              </Text>
            </View>
          ) : (
            events.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event}
                index={idx}
                showRegisterButton={false}
              />
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Event</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <PremiumInput label="Event Title" value={title} onChangeText={setTitle} placeholder="Event name" icon="calendar-outline" />
            <PremiumInput label="Date & Time" value={date} onChangeText={setDate} placeholder="e.g. 2026-01-15T10:00:00Z" icon="time-outline" />
            <PremiumInput label="Location" value={location} onChangeText={setLocation} placeholder="e.g. School Auditorium" icon="location-outline" />
            <PremiumInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Event details..."
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
              icon="create-outline"
            />
            {formError ? (
              <Text style={styles.formError}>{formError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleCreate}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Publish Event</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 22 },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  modalContent: { padding: 20 },
  formError: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 16, marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
