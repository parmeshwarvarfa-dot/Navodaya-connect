import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { Event } from "@/lib/api";

const GRADIENT_SETS: [string, string][] = [
  ["#4B6EF5", "#3151E8"],
  ["#10B981", "#059669"],
  ["#8B5CF6", "#7C3AED"],
  ["#F59E0B", "#D97706"],
  ["#EF4444", "#DC2626"],
  ["#0891B2", "#0E7490"],
];

export function getDateParts(dateStr: string): { day: number | string; month: string } {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()))
      return {
        day: d.getDate(),
        month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      };
  } catch {}
  return { day: "--", month: "---" };
}

export function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()))
      return d.toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  } catch {}
  return dateStr;
}

interface EventCardProps {
  event: Event;
  index?: number;
  registered?: boolean;
  registrationSuccess?: boolean;
  onRegister?: () => void;
  onOrganizerPress?: (organizerId: string | undefined, organizerName: string) => boolean | void | Promise<boolean | void>;
  showRegisterButton?: boolean;
}

export default function EventCard({
  event,
  index = 0,
  registered = false,
  registrationSuccess = false,
  onRegister,
  onOrganizerPress,
  showRegisterButton = true,
}: EventCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [organizerMessage, setOrganizerMessage] = useState("");
  const { day, month } = getDateParts(event.date);
  const isOnline =
    event.location?.toLowerCase().includes("online") ||
    event.location?.toLowerCase().includes("zoom") ||
    event.location?.toLowerCase().includes("meet");
  const grad = GRADIENT_SETS[index % GRADIENT_SETS.length];

  const handleOrganizerPress = async () => {
    if (!event.organizer || !onOrganizerPress) return;
    const opened = await onOrganizerPress(event.organizerId, event.organizer);
    if (opened === false) setOrganizerMessage("There is no linked organizer account for this event yet.");
  };

  return (
    <View style={styles.card}>
      <LinearGradient colors={grad} style={styles.strip}>
        <View style={styles.dateBox}>
          <Text style={styles.dateDay}>{day}</Text>
          <Text style={styles.dateMonth}>{month}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stripTitle} numberOfLines={2}>
            {event.title}
          </Text>
          {event.organizer ? (
            <TouchableOpacity
              style={styles.organizerLink}
              disabled={!onOrganizerPress}
              onPress={() => void handleOrganizerPress()}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Open ${event.organizer}'s profile to ask about this event`}
            >
              <Text style={styles.stripOrg}>Organised by <Text style={styles.organizerName}>{event.organizer}</Text></Text>
              <View style={styles.askOrganizerPill}>
                <Ionicons name="chatbubble-ellipses-outline" size={13} color="#fff" />
                <Text style={styles.askOrganizerText}>Ask</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
        {isOnline && (
          <View style={styles.onlinePill}>
            <Ionicons name="videocam-outline" size={11} color="#3D5AF1" />
            <Text style={styles.onlinePillText}>Online</Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.body}>
        {event.description ? (
          <Text style={styles.desc} numberOfLines={3}>
            {event.description}
          </Text>
        ) : null}

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <View style={[styles.metaIcon, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="time-outline" size={14} color="#3D5AF1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Date &amp; Time</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {formatDateTime(event.date)}
              </Text>
            </View>
          </View>

          {event.location ? (
            <View style={styles.metaItem}>
              <View style={[styles.metaIcon, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="location-outline" size={14} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>Venue</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>
            </View>
          ) : null}

          {event.jnvName ? (
            <View style={styles.metaItem}>
              <View style={[styles.metaIcon, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="school-outline" size={14} color="#10B981" />
              </View>
              <View>
                <Text style={styles.metaLabel}>Hosted By</Text>
                <Text style={styles.metaValue}>{event.jnvName}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.detailsLink} onPress={() => setDetailsOpen(true)} activeOpacity={0.75}>
          <Ionicons name="information-circle-outline" size={17} color="#3D5AF1" />
          <Text style={styles.detailsLinkText}>Event details</Text>
          <Ionicons name="chevron-forward" size={15} color="#3D5AF1" />
        </TouchableOpacity>

        {showRegisterButton && (
          registrationSuccess ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.successBannerText}>You&apos;re registered! See you there.</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.registerBtn, registered && styles.registeredBtn]}
              onPress={registered ? undefined : onRegister}
              activeOpacity={registered ? 1 : 0.85}
            >
              <Ionicons
                name={registered ? "checkmark-circle" : "person-add-outline"}
                size={17}
                color="#fff"
              />
              <Text style={styles.registerBtnText}>
                {registered ? "Registered" : "Register for this Event"}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <Modal visible={detailsOpen} transparent animationType="slide" onRequestClose={() => setDetailsOpen(false)}>
        <Pressable style={styles.detailsBackdrop} onPress={() => setDetailsOpen(false)}>
          <Pressable style={styles.detailsSheet} onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.detailsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailsEyebrow}>EVENT DETAILS</Text>
                <Text style={styles.detailsTitle}>{event.title}</Text>
              </View>
              <TouchableOpacity style={styles.detailsClose} onPress={() => setDetailsOpen(false)} accessibilityLabel="Close event details">
                <Ionicons name="close" size={21} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailsBody}>
              <View style={styles.eventTypeRow}>
                <View style={[styles.eventTypePill, isOnline && styles.onlineTypePill]}>
                  <Ionicons name={isOnline ? "videocam-outline" : "people-outline"} size={14} color={isOnline ? "#3D5AF1" : "#059669"} />
                  <Text style={[styles.eventTypeText, isOnline && styles.onlineTypeText]}>{isOnline ? "Online event" : "In-person event"}</Text>
                </View>
                <View style={styles.eventTypePill}>
                  <Ionicons name="calendar-clear-outline" size={14} color="#64748B" />
                  <Text style={styles.eventTypeText}>{new Date(event.date).getTime() >= Date.now() ? "Upcoming" : "Past event"}</Text>
                </View>
              </View>
              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionTitle}>About this event</Text>
                <Text style={styles.detailsDescription}>{event.description || "The organizer has not added a description yet."}</Text>
              </View>
              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionTitle}>Date and location</Text>
                <DetailRow icon="calendar-outline" color="#3D5AF1" label="Date & time" value={formatDateTime(event.date)} />
                <DetailRow icon="location-outline" color="#EF4444" label="Venue" value={event.location || "Venue not specified"} />
                <DetailRow icon="school-outline" color="#10B981" label="Hosted by" value={event.jnvName || "JNV community"} />
              </View>
              {event.organizer ? (
                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>Organizer</Text>
                  <TouchableOpacity
                    style={styles.detailsOrganizer}
                    disabled={!onOrganizerPress}
                    onPress={() => void handleOrganizerPress()}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.detailIcon, { backgroundColor: "#EEF2FF" }]}>
                      <Ionicons name="person-outline" size={17} color="#3D5AF1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailsLabel}>Organized by</Text>
                      <Text style={styles.detailsValue}>{event.organizer}</Text>
                    </View>
                    {onOrganizerPress ? (
                      <View style={styles.messageOrganizerPill}>
                        <Ionicons name="chatbubble-ellipses-outline" size={13} color="#3D5AF1" />
                        <Text style={styles.messageOrganizerText}>View profile</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                </View>
              ) : null}
              {event.createdAt ? (
                <Text style={styles.publishedText}>Event posted {formatDateTime(event.createdAt)}</Text>
              ) : null}
            </ScrollView>
            {showRegisterButton && !registered && !registrationSuccess ? (
              <TouchableOpacity
                style={styles.detailsRegister}
                onPress={() => { setDetailsOpen(false); onRegister?.(); }}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={17} color="#fff" />
                <Text style={styles.detailsDoneText}>Register for this event</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.detailsDone} onPress={() => setDetailsOpen(false)}>
              <Text style={styles.detailsDoneText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!organizerMessage} transparent animationType="fade" onRequestClose={() => setOrganizerMessage("")}>
        <Pressable style={styles.noticeBackdrop} onPress={() => setOrganizerMessage("")}>
          <Pressable style={styles.noticeCard} onPress={(pressEvent) => pressEvent.stopPropagation()}>
            <View style={styles.noticeIcon}><Ionicons name="person-outline" size={22} color="#3D5AF1" /></View>
            <Text style={styles.noticeTitle}>Organizer profile unavailable</Text>
            <Text style={styles.noticeText}>{organizerMessage}</Text>
            <TouchableOpacity style={styles.noticeButton} onPress={() => setOrganizerMessage("")}>
              <Text style={styles.noticeButtonText}>OK</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, color, label, value }: { icon: "calendar-outline" | "location-outline" | "school-outline"; color: string; label: string; value: string }) {
  return (
    <View style={styles.detailsRow}>
      <View style={[styles.detailIcon, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailsLabel}>{label}</Text>
        <Text style={styles.detailsValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  dateBox: {
    width: 52,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dateDay: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 26 },
  dateMonth: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stripTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
    marginBottom: 4,
  },
  stripOrg: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" },
  organizerLink: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 3 },
  organizerName: { color: "#fff", textDecorationLine: "underline", fontFamily: "Inter_600SemiBold" },
  askOrganizerPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 4 },
  askOrganizerText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  onlinePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  body: { padding: 16 },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#374151",
    lineHeight: 21,
    marginBottom: 14,
  },
  metaGrid: { gap: 10, marginBottom: 16 },
  detailsLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 5, marginTop: -8, marginBottom: 8 },
  detailsLinkText: { color: "#3D5AF1", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metaLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  metaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3D5AF1",
    borderRadius: 12,
    paddingVertical: 14,
  },
  registeredBtn: { backgroundColor: "#10B981" },
  registerBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  successBannerText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#059669" },
  detailsBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  detailsSheet: { maxHeight: "82%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  detailsHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#EEF0F4" },
  detailsEyebrow: { color: "#3D5AF1", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  detailsTitle: { color: "#111827", fontSize: 18, lineHeight: 24, fontFamily: "Inter_700Bold", marginTop: 3 },
  detailsClose: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  detailsBody: { paddingTop: 16, paddingBottom: 10, gap: 15 },
  eventTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  eventTypePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F1F5F9", borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  onlineTypePill: { backgroundColor: "#EEF2FF" },
  eventTypeText: { color: "#64748B", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  onlineTypeText: { color: "#3D5AF1" },
  detailsSection: { gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#EEF0F4" },
  detailsSectionTitle: { color: "#111827", fontSize: 15, fontFamily: "Inter_700Bold" },
  detailsDescription: { color: "#4B5563", fontSize: 14, lineHeight: 22 },
  detailsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailsOrganizer: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  detailsLabel: { color: "#9CA3AF", fontSize: 11, fontFamily: "Inter_400Regular" },
  detailsValue: { color: "#111827", fontSize: 14, lineHeight: 20, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  messageOrganizerPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#EEF2FF" },
  messageOrganizerText: { color: "#3D5AF1", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  publishedText: { color: "#9CA3AF", fontSize: 11, fontFamily: "Inter_400Regular" },
  detailsRegister: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 13, marginTop: 8 },
  detailsDone: { alignItems: "center", justifyContent: "center", backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 13, marginTop: 8 },
  detailsDoneText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  noticeBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(15,23,42,0.48)" },
  noticeCard: { width: "100%", maxWidth: 360, alignItems: "center", backgroundColor: "#fff", borderRadius: 20, padding: 24 },
  noticeIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  noticeTitle: { color: "#111827", fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  noticeText: { color: "#64748B", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  noticeButton: { alignSelf: "stretch", alignItems: "center", backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 12, marginTop: 18 },
  noticeButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
