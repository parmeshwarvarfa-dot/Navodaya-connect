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
import { api } from "@/lib/api";
import type { Event } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumInput } from "@/components/PremiumInput";
import { PremiumButton } from "@/components/PremiumButton";

const TABS = ["Upcoming", "My RSVPs"];

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  } catch {}
  return dateStr;
}

export default function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [rsvped, setRsvped] = useState<Set<string>>(new Set());
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
      const data = await api.events.list();
      setEvents(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleRSVP = (id: string) => {
    setRsvped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const displayEvents = activeTab === "My RSVPs"
    ? events.filter((e) => rsvped.has(e.id))
    : events;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Events</Text>
            <Text style={styles.headerSub}>Meetups, reunions & more</Text>
          </View>
          {canCreate && (
            <TouchableOpacity
              style={[styles.hostBtn, { backgroundColor: colors.saffron }]}
              onPress={() => setShowCreate(true)}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.hostBtnText}>Host</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.saffron, borderBottomWidth: 2 }]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.saffron : colors.mutedForeground },
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {activeTab === "My RSVPs" ? "No RSVPs yet" : "No events yet"}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {activeTab === "My RSVPs" ? "RSVP to events to see them here" : "Check back soon for upcoming events"}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isGoing = rsvped.has(item.id);
          return (
            <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.eventAccentBar, { backgroundColor: colors.saffron }]} />
              <View style={styles.eventBody}>
                <View style={styles.eventTopRow}>
                  {item.location && (
                    <View style={styles.locationChip}>
                      <Ionicons name={item.location.toLowerCase().includes("online") || item.location.toLowerCase().includes("zoom") ? "laptop-outline" : "location-outline"} size={11} color={colors.mutedForeground} />
                      <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{item.location}</Text>
                    </View>
                  )}
                  <Text style={[styles.goingCount, { color: colors.mutedForeground }]}>
                    {Math.floor(Math.random() * 200 + 20)} Going
                  </Text>
                </View>

                <Text style={[styles.eventTitle, { color: colors.primary }]}>{item.title}</Text>

                <View style={styles.eventMeta}>
                  <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.eventMetaText, { color: colors.mutedForeground }]}>{formatDate(item.date)}</Text>
                </View>

                {item.organizer && (
                  <View style={styles.eventMeta}>
                    <Ionicons name="person-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.eventMetaText, { color: colors.mutedForeground }]}>By {item.organizer}</Text>
                  </View>
                )}

                {item.description ? (
                  <Text style={[styles.eventDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.eventActions}>
                  <TouchableOpacity
                    style={[
                      styles.rsvpBtn,
                      { backgroundColor: isGoing ? colors.success : colors.saffron },
                    ]}
                    onPress={() => handleRSVP(item.id)}
                  >
                    <Ionicons name={isGoing ? "checkmark-circle" : "checkmark-circle-outline"} size={15} color="#fff" />
                    <Text style={styles.rsvpText}>{isGoing ? "Going ✓" : "RSVP"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.shareBtn, { borderColor: colors.border }]}>
                    <Ionicons name="share-social-outline" size={15} color={colors.mutedForeground} />
                    <Text style={[styles.shareBtnText, { color: colors.mutedForeground }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Host an Event</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <PremiumInput label="Event Title" value={title} onChangeText={setTitle} placeholder="E.g. JNV Alumni Reunion 2026" icon="calendar-outline" />
            <PremiumInput label="Date & Time" value={date} onChangeText={setDate} placeholder="E.g. June 15, 2026 at 10:00 AM" icon="time-outline" />
            <PremiumInput label="Location" value={location} onChangeText={setLocation} placeholder="E.g. India Habitat Centre, Delhi" icon="location-outline" />
            <PremiumInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Tell people what this event is about…"
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
  header: { paddingHorizontal: 16, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  hostBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 5 },
  hostBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 16 },
  tab: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 4 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  listContent: { padding: 16 },
  eventCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 14 },
  eventAccentBar: { height: 4 },
  eventBody: { padding: 14 },
  eventTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  locationChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  goingCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
  eventTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8, lineHeight: 22 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  eventMetaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  eventDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 8, marginBottom: 12 },
  eventActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  rsvpBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 8, gap: 5 },
  rsvpText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  shareBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, gap: 5 },
  shareBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
});
