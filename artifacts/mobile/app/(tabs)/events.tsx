import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { Event } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PremiumInput } from "@/components/PremiumInput";

const EVENT_IMAGES = [
  "https://picsum.photos/seed/conference2/800/350",
  "https://picsum.photos/seed/sports2026/800/350",
  "https://picsum.photos/seed/graduation2026/800/350",
  "https://picsum.photos/seed/workshop2026/800/350",
  "https://picsum.photos/seed/seminar2026/800/350",
];

function getDateParts(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
      return { day, month };
    }
  } catch {}
  return { day: "--", month: "---" };
}

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }
  } catch {}
  return "TBD";
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const canCreate = profile?.role === "teacher" || profile?.role === "official";

  const fetchEvents = async () => {
    try {
      const data = await api.events.list();
      setEvents(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleRegister = (id: string) => {
    setRegistered((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim() || !date.trim()) {
      Alert.alert("Error", "Please fill title and date");
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
      Alert.alert("Error", "Failed to create event");
    }
    setSubmitting(false);
  };

  const now = new Date().toISOString();
  const mockEvents: Event[] = events.length > 0 ? events : [
    { id: "m1", title: "Career Guidance Webinar: Engineering Paths", description: "Join our alumni working at top tech companies to learn about various engineering paths and career opportunities.", date: new Date(Date.now() + 7 * 86400000).toISOString(), location: "Online", organizer: "Priya Sharma", createdAt: now },
    { id: "m2", title: "JNV Alumni Sports Meet 2026", description: "Annual sports meet for all JNV alumni. Join us for cricket, kabaddi, and athletics.", date: new Date(Date.now() + 14 * 86400000).toISOString(), location: "JNV Delhi Campus", organizer: "Sports Committee", createdAt: now },
    { id: "m3", title: "UPSC Preparation Workshop", description: "Expert guidance from IAS officers who are JNV alumni. Learn tips and strategies for UPSC preparation.", date: new Date(Date.now() + 21 * 86400000).toISOString(), location: "Online", organizer: "Amit Verma", createdAt: now },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.headerTitle}>Events</Text>
        {canCreate && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={22} color="#3D5AF1" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        {mockEvents.map((event, idx) => {
          const { day, month } = getDateParts(event.date);
          const isOnline = event.location?.toLowerCase().includes("online") || event.location?.toLowerCase().includes("zoom");
          const isReg = registered.has(event.id);
          const attendees = Math.floor(Math.random() * 50 + 2);
          const imgUri = EVENT_IMAGES[idx % EVENT_IMAGES.length];

          return (
            <View key={event.id} style={styles.eventCard}>
              <Image source={{ uri: imgUri }} style={styles.eventImage} resizeMode="cover" />

              <View style={styles.eventBody}>
                <View style={styles.eventTopRow}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateDay}>{day}</Text>
                    <Text style={styles.dateMonth}>{month}</Text>
                  </View>
                  <View style={styles.eventDetails}>
                    {isOnline && (
                      <View style={styles.onlineBadge}>
                        <Text style={styles.onlineBadgeText}>Online</Text>
                      </View>
                    )}
                    <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                    <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={13} color="#6B7280" />
                        <Text style={styles.metaText}>{formatTime(event.date)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={13} color="#6B7280" />
                        <Text style={styles.metaText}>{attendees} attending</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.eventFooter}>
                  {event.organizer && (
                    <Text style={styles.organizer}>By {event.organizer}</Text>
                  )}
                  <TouchableOpacity
                    style={[styles.registerBtn, isReg && styles.registeredBtn]}
                    onPress={() => handleRegister(event.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.registerText}>{isReg ? "Registered ✓" : "Register"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Event</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color="#111" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <PremiumInput label="Event Title" value={title} onChangeText={setTitle} placeholder="E.g. Alumni Reunion 2026" icon="calendar-outline" />
            <PremiumInput label="Date & Time" value={date} onChangeText={setDate} placeholder="E.g. June 15, 2026" icon="time-outline" />
            <PremiumInput label="Location" value={location} onChangeText={setLocation} placeholder="E.g. Online / Delhi" icon="location-outline" />
            <PremiumInput label="Description" value={description} onChangeText={setDescription} placeholder="What is this event about?" multiline numberOfLines={3} icon="create-outline" />
            <TouchableOpacity
              style={[styles.createBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={submitting}
            >
              <Text style={styles.createBtnText}>{submitting ? "Creating..." : "Create Event"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center",
  },
  eventCard: {
    backgroundColor: "#fff",
    marginBottom: 2,
    borderBottomWidth: 8,
    borderBottomColor: "#F5F6FA",
  },
  eventImage: { width: "100%", height: 200 },
  eventBody: { padding: 16 },
  eventTopRow: { flexDirection: "row", gap: 14, marginBottom: 14 },
  dateBox: {
    width: 52, height: 60,
    backgroundColor: "#3D5AF1",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dateDay: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 24 },
  dateMonth: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  eventDetails: { flex: 1 },
  onlineBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  onlineBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  eventTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", lineHeight: 22, marginBottom: 4 },
  eventDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 20, marginBottom: 8 },
  metaRow: { flexDirection: "row", gap: 14 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  eventFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  organizer: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  registerBtn: {
    backgroundColor: "#3D5AF1",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  registeredBtn: { backgroundColor: "#10B981" },
  registerText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111" },
  modalBody: { padding: 20 },
  createBtn: {
    backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginTop: 8,
  },
  createBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});
