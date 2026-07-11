import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
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
  showRegisterButton?: boolean;
}

export default function EventCard({
  event,
  index = 0,
  registered = false,
  registrationSuccess = false,
  onRegister,
  showRegisterButton = true,
}: EventCardProps) {
  const { day, month } = getDateParts(event.date);
  const isOnline =
    event.location?.toLowerCase().includes("online") ||
    event.location?.toLowerCase().includes("zoom") ||
    event.location?.toLowerCase().includes("meet");
  const grad = GRADIENT_SETS[index % GRADIENT_SETS.length];

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
            <Text style={styles.stripOrg}>Organised by {event.organizer}</Text>
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
});
