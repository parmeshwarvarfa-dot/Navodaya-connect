import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  organizer: string;
  attendees: string[];
  createdAt: any;
}

export default function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const canCreate = profile?.role === "teacher" || profile?.role === "official";

  const fetchEvents = async () => {
    try {
      const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event)));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleCreate = async () => {
    if (!title.trim() || !date.trim()) {
      Alert.alert("Error", "Please fill title and date");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "events"), {
        title: title.trim(),
        description: description.trim(),
        date: date.trim(),
        location: location.trim(),
        organizer: profile?.fullName,
        organizerId: profile?.uid,
        attendees: [],
        createdAt: serverTimestamp(),
      });
      setShowCreate(false);
      setTitle(""); setDescription(""); setDate(""); setLocation("");
      fetchEvents();
    } catch {
      Alert.alert("Error", "Failed to create event");
    }
    setSubmitting(false);
  };

  const handleJoin = async (eventId: string) => {
    try {
      await updateDoc(doc(db, "events", eventId), {
        attendees: arrayUnion(profile?.uid),
      });
      fetchEvents();
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Events</Text>
          {canCreate && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No events yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const joined = item.attendees?.includes(profile?.uid || "");
          return (
            <PremiumCard style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <View style={[styles.dateBox, { backgroundColor: colors.primary }]}>
                  <Text style={styles.dateText}>{item.date?.split(" ")[0] || "TBD"}</Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventTitle, { color: colors.foreground }]}>{item.title}</Text>
                  {item.location && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{item.location}</Text>
                    </View>
                  )}
                  <Text style={[styles.organizerText, { color: colors.mutedForeground }]}>
                    By {item.organizer}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text style={[styles.eventDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.eventFooter}>
                <Text style={[styles.attendeeCount, { color: colors.mutedForeground }]}>
                  {item.attendees?.length || 0} attending
                </Text>
                <PremiumButton
                  title={joined ? "Joined" : "Join Event"}
                  onPress={() => handleJoin(item.id)}
                  variant={joined ? "secondary" : "primary"}
                  fullWidth={false}
                  disabled={joined}
                  style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                />
              </View>
            </PremiumCard>
          );
        }}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Event</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <PremiumInput label="Event Title" value={title} onChangeText={setTitle} placeholder="Event name" icon="calendar-outline" />
            <PremiumInput label="Date & Time" value={date} onChangeText={setDate} placeholder="e.g. Jan 15, 2026 at 10:00 AM" icon="time-outline" />
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
            <PremiumButton title="Create Event" onPress={handleCreate} loading={submitting} style={{ marginTop: 8 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  eventCard: { marginBottom: 12 },
  eventHeader: { flexDirection: "row", gap: 12, marginBottom: 10 },
  dateBox: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dateText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  locationText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  organizerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  eventDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 10 },
  eventFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  attendeeCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
});
