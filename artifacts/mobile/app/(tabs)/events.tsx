import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, getToken } from "@/lib/api";
import type { Event } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useVerificationGate } from "@/components/VerificationGateModal";

// ─── API helpers (registrations not in lib/api yet, call directly) ────────────
async function registerForEvent(
  eventId: string,
  data: Record<string, string>
): Promise<void> {
  const token = await getToken();
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}/api` : "http://localhost:80/api";
  const res = await fetch(`${base}/events/${eventId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Registration failed");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDateParts(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return { day: d.getDate(), month: d.toLocaleString("en-US", { month: "short" }).toUpperCase() };
  } catch {}
  return { day: "--", month: "---" };
}

function formatDateTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()))
      return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  } catch {}
  return dateStr;
}

const FALLBACK_EVENTS: Event[] = [
  {
    id: "fe1", title: "Career Guidance Webinar — Engineering & Tech", organizer: "Priya Sharma (Alumni)",
    description: "Join JNV alumni working at top tech companies to explore engineering careers, internship tips, and JEE guidance. Interactive Q&A included.",
    date: new Date(Date.now() + 7 * 86400000).toISOString(), location: "Online (Zoom)", jnvName: "National", createdAt: new Date().toISOString(),
  },
  {
    id: "fe2", title: "Inter-JNV Alumni Sports Meet 2025", organizer: "NVS Sports Committee",
    description: "Annual sports meet for JNV alumni and students. Events include Cricket, Kabaddi, Athletics & Volleyball. Register to confirm your participation.",
    date: new Date(Date.now() + 14 * 86400000).toISOString(), location: "JNV Delhi Campus, Sector 3", jnvName: "JNV Delhi", createdAt: new Date().toISOString(),
  },
  {
    id: "fe3", title: "UPSC Preparation Masterclass", organizer: "Amit Verma, IAS",
    description: "Expert guidance from IAS officers who are proud JNV alumni. Covers exam strategy, optional subjects, and interview preparation for Civil Services 2025.",
    date: new Date(Date.now() + 21 * 86400000).toISOString(), location: "Online (Google Meet)", jnvName: "National", createdAt: new Date().toISOString(),
  },
  {
    id: "fe4", title: "Annual Prize Distribution & Cultural Evening", organizer: "Principal",
    description: "Celebrate academic excellence, sports achievements, and cultural performances. Parents and guardians are cordially invited.",
    date: new Date(Date.now() + 30 * 86400000).toISOString(), location: "School Auditorium, JNV Campus", jnvName: "JNV India", createdAt: new Date().toISOString(),
  },
];

const DIETARY_OPTIONS = ["No Preference", "Vegetarian", "Non-Vegetarian", "Vegan", "Jain"];
const HOUSE_OPTIONS = ["Aravali", "Nilgiri", "Shivalik", "Udaygiri"];
const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];

const GRADIENT_SETS = [
  ["#4B6EF5", "#3151E8"] as const,
  ["#10B981", "#059669"] as const,
  ["#8B5CF6", "#7C3AED"] as const,
  ["#F59E0B", "#D97706"] as const,
];

// ─── Field component ──────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, keyboardType, multiline, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean; required?: boolean;
}) {
  return (
    <View style={regStyles.fieldWrap}>
      <Text style={regStyles.fieldLabel}>{label}{required && <Text style={{ color: "#EF4444" }}> *</Text>}</Text>
      <TextInput
        style={[regStyles.fieldInput, multiline && { minHeight: 80, textAlignVertical: "top" }]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor="#9CA3AF" keyboardType={keyboardType} multiline={multiline}
      />
    </View>
  );
}

function ChipSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={regStyles.fieldWrap}>
      <Text style={regStyles.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <TouchableOpacity key={o} onPress={() => onChange(o)}
            style={[regStyles.chip, value === o && regStyles.chipActive]}>
            <Text style={[regStyles.chipText, value === o && regStyles.chipTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Registration Modal ───────────────────────────────────────────────────────
function RegistrationModal({ event, role, profile, visible, onClose, onSuccess }: {
  event: Event; role: string; profile: any; visible: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [name, setName] = useState(profile?.fullName || "");
  const [jnvName, setJnvName] = useState(profile?.jnvName || "");
  const [jnvState, setJnvState] = useState(profile?.jnvState || "");
  const [contact, setContact] = useState("");
  const [passoutBatch, setPassoutBatch] = useState(profile?.passoutYear || "");
  const [house, setHouse] = useState(profile?.house || "");
  const [cls, setCls] = useState(profile?.class || "");
  const [designation, setDesignation] = useState(profile?.designation || "");
  const [subject, setSubject] = useState(profile?.subject || "");
  const [contribution, setContribution] = useState("");
  const [dietary, setDietary] = useState("No Preference");
  const [feedback, setFeedback] = useState("");
  const [attending, setAttending] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !contact.trim()) return;
    setSubmitting(true);
    try {
      await registerForEvent(event.id, {
        fullName: name.trim(), jnvName, jnvState, contactNo: contact.trim(),
        passoutBatch, house, class: cls, designation, subject,
        contribution, feedback, dietaryPreference: dietary,
      });
      onSuccess();
    } catch {}
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={regStyles.container}>
        <View style={regStyles.header}>
          <View style={{ flex: 1 }}>
            <Text style={regStyles.headerTitle}>Event Registration</Text>
            <Text style={regStyles.headerSub} numberOfLines={1}>{event.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={regStyles.closeBtn}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={regStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Event summary */}
            <View style={regStyles.eventSummary}>
              <Ionicons name="calendar" size={16} color="#3D5AF1" />
              <Text style={regStyles.eventSummaryText}>{formatDateTime(event.date)}</Text>
            </View>
            {event.location && (
              <View style={[regStyles.eventSummary, { marginTop: 4 }]}>
                <Ionicons name="location" size={16} color="#EF4444" />
                <Text style={regStyles.eventSummaryText}>{event.location}</Text>
              </View>
            )}

            <View style={regStyles.divider} />
            <Text style={regStyles.sectionLabel}>
              {role === "alumni" ? "Alumni" : role === "teacher" ? "Teacher" : role === "official" ? "Official" : "Student"} Details
            </Text>

            <Field label="Full Name" value={name} onChange={setName} placeholder="Your full name" required />
            <Field label="JNV Name" value={jnvName} onChange={setJnvName} placeholder="e.g. JNV Jaipur" />
            <Field label="JNV State" value={jnvState} onChange={setJnvState} placeholder="e.g. Rajasthan" />
            <Field label="Mobile Number" value={contact} onChange={setContact} placeholder="10-digit mobile number" keyboardType="phone-pad" required />

            {role === "alumni" && (
              <>
                <Field label="Passout Batch / Year" value={passoutBatch} onChange={setPassoutBatch} placeholder="e.g. 2018" keyboardType="numeric" />
                <Field label="Current Profession / Occupation" value={contribution} onChange={setContribution} placeholder="e.g. Software Engineer at Google" />
                <ChipSelect label="Dietary Preference" options={DIETARY_OPTIONS} value={dietary} onChange={setDietary} />
              </>
            )}

            {role === "student" && (
              <>
                <ChipSelect label="Class" options={CLASS_OPTIONS} value={cls} onChange={setCls} />
                <ChipSelect label="House" options={HOUSE_OPTIONS} value={house} onChange={setHouse} />
              </>
            )}

            {(role === "teacher" || role === "official") && (
              <>
                <Field label="Designation" value={designation} onChange={setDesignation} placeholder="e.g. PGT Mathematics" />
                {role === "teacher" && <Field label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Mathematics" />}
              </>
            )}

            <View style={regStyles.divider} />
            <Text style={regStyles.sectionLabel}>Attendance & Feedback</Text>

            <View style={regStyles.attendRow}>
              <View style={{ flex: 1 }}>
                <Text style={regStyles.fieldLabel}>Will you attend in person?</Text>
                <Text style={regStyles.attendSub}>{attending ? "Yes, physically present" : "No, attending online / cannot attend"}</Text>
              </View>
              <Switch value={attending} onValueChange={setAttending} trackColor={{ false: "#E5E7EB", true: "#3D5AF1" }} thumbColor="#fff" />
            </View>

            <Field
              label="Feedback / Suggestions (Optional)"
              value={feedback} onChange={setFeedback}
              placeholder="Share your suggestions, expectations, or any specific topics you'd like to be covered at this event..."
              multiline
            />

            <TouchableOpacity
              style={[regStyles.submitBtn, (!name.trim() || !contact.trim() || submitting) && regStyles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!name.trim() || !contact.trim() || submitting}
              activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={regStyles.submitText}>Confirm Registration</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={regStyles.privacyNote}>
              Your registration details are only shared with the event organiser and will not be publicly displayed.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Create Event Modal ───────────────────────────────────────────────────────
function CreateEventModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !venue.trim() || !date.trim()) return;
    setSubmitting(true);
    try {
      const fullDate = time.trim() ? `${date.trim()} at ${time.trim()}` : date.trim();
      await api.events.create({ title: title.trim(), description: description.trim(), date: fullDate, location: venue.trim() });
      setSuccess(true);
      setTitle(""); setDescription(""); setVenue(""); setDate(""); setTime("");
    } catch {}
    setSubmitting(false);
  };

  if (success) {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={cStyles.successOverlay}>
          <View style={cStyles.successBox}>
            <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={cStyles.successIcon}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </LinearGradient>
            <Text style={cStyles.successTitle}>Event Created!</Text>
            <Text style={cStyles.successDesc}>Your event has been published. Other Navodayans can now view and register for it.</Text>
            <TouchableOpacity style={cStyles.successBtn} onPress={() => { setSuccess(false); onCreated(); onClose(); }}>
              <Text style={cStyles.successBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const canSubmit = title.trim() && description.trim() && venue.trim() && date.trim();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={cStyles.container}>
        <View style={cStyles.header}>
          <Text style={cStyles.headerTitle}>Organise an Event</Text>
          <TouchableOpacity onPress={onClose} style={cStyles.closeBtn}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={cStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={cStyles.orgBanner}>
              <View style={cStyles.orgAvatar}>
                <Text style={cStyles.orgAvatarText}>{(profile?.fullName || "U")[0]}</Text>
              </View>
              <View>
                <Text style={cStyles.orgName}>{profile?.fullName || "You"}</Text>
                <Text style={cStyles.orgRole}>{profile?.jnvName || "JNV India"} · {profile?.role === "teacher" ? "Teacher" : profile?.role === "official" ? "JNV Official" : profile?.role === "alumni" ? "Alumni" : "Student"}</Text>
              </View>
            </View>

            <Text style={cStyles.sectionLabel}>Event Details</Text>

            {[
              { label: "Event Title", value: title, onChange: setTitle, placeholder: "e.g. Annual Alumni Reunion 2025", icon: "megaphone-outline", required: true },
              { label: "Venue / Location", value: venue, onChange: setVenue, placeholder: "e.g. School Auditorium / Online (Zoom)", icon: "location-outline", required: true },
              { label: "Date", value: date, onChange: setDate, placeholder: "e.g. 15 August 2025", icon: "calendar-outline", required: true },
              { label: "Time", value: time, onChange: setTime, placeholder: "e.g. 10:00 AM", icon: "time-outline", required: false },
            ].map((f) => (
              <View key={f.label} style={cStyles.fieldWrap}>
                <Text style={cStyles.fieldLabel}>{f.label}{f.required && <Text style={{ color: "#EF4444" }}> *</Text>}</Text>
                <View style={cStyles.fieldRow}>
                  <View style={cStyles.fieldIcon}>
                    <Ionicons name={f.icon as any} size={18} color="#3D5AF1" />
                  </View>
                  <TextInput
                    style={cStyles.fieldInput} value={f.value} onChangeText={f.onChange}
                    placeholder={f.placeholder} placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
            ))}

            <View style={cStyles.fieldWrap}>
              <Text style={cStyles.fieldLabel}>Description <Text style={{ color: "#EF4444" }}>*</Text></Text>
              <View style={[cStyles.fieldRow, { alignItems: "flex-start" }]}>
                <View style={[cStyles.fieldIcon, { marginTop: 2 }]}>
                  <Ionicons name="document-text-outline" size={18} color="#3D5AF1" />
                </View>
                <TextInput
                  style={[cStyles.fieldInput, { minHeight: 100, textAlignVertical: "top" }]}
                  value={description} onChangeText={setDescription} multiline
                  placeholder="Describe the event — what will happen, who should attend, what to bring or prepare..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={cStyles.tipBox}>
              <Ionicons name="information-circle-outline" size={16} color="#3D5AF1" />
              <Text style={cStyles.tipText}>Tip: Include specific timings, dress code, what to bring, and any eligibility criteria so attendees come prepared.</Text>
            </View>

            <TouchableOpacity
              style={[cStyles.submitBtn, !canSubmit && cStyles.submitBtnDisabled]}
              onPress={handleCreate} disabled={!canSubmit || submitting} activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={cStyles.submitBtnText}>Publish Event</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isVerified } = useAuth();
  const { tryAccess, modal: gateModal } = useVerificationGate(isVerified);
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [regEvent, setRegEvent] = useState<Event | null>(null);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [successEvent, setSuccessEvent] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const fetchEvents = async () => {
    try { setEvents(await api.events.list()); } catch {}
  };

  useEffect(() => { fetchEvents(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, []);

  const displayEvents = events.length > 0 ? events : FALLBACK_EVENTS;
  const role = profile?.role || "student";

  const handleRegistrationSuccess = (eventId: string) => {
    setRegistered((prev) => new Set([...prev, eventId]));
    setRegEvent(null);
    setSuccessEvent(eventId);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View>
          <Text style={styles.headerTitle}>Events</Text>
          <Text style={styles.headerSub}>JNV functions, webinars & reunions</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Organise</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3D5AF1" />}
      >
        {displayEvents.map((event, idx) => {
          const { day, month } = getDateParts(event.date);
          const isOnline = event.location?.toLowerCase().includes("online") || event.location?.toLowerCase().includes("zoom") || event.location?.toLowerCase().includes("meet");
          const isReg = registered.has(event.id);
          const isSuccess = successEvent === event.id;
          const grad = GRADIENT_SETS[idx % GRADIENT_SETS.length];

          return (
            <View key={event.id} style={styles.eventCard}>
              {/* Coloured header strip */}
              <LinearGradient colors={grad} style={styles.eventStrip}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>{day}</Text>
                  <Text style={styles.dateMonth}>{month}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stripTitle} numberOfLines={2}>{event.title}</Text>
                  {event.organizer && <Text style={styles.stripOrg}>Organised by {event.organizer}</Text>}
                </View>
                {isOnline && (
                  <View style={styles.onlinePill}>
                    <Ionicons name="videocam-outline" size={11} color="#3D5AF1" />
                    <Text style={styles.onlinePillText}>Online</Text>
                  </View>
                )}
              </LinearGradient>

              {/* Body */}
              <View style={styles.eventBody}>
                <Text style={styles.eventDesc} numberOfLines={3}>{event.description}</Text>

                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <View style={[styles.metaIcon, { backgroundColor: "#EEF2FF" }]}>
                      <Ionicons name="time-outline" size={14} color="#3D5AF1" />
                    </View>
                    <View>
                      <Text style={styles.metaLabel}>Date & Time</Text>
                      <Text style={styles.metaValue}>{event.date}</Text>
                    </View>
                  </View>
                  {event.location && (
                    <View style={styles.metaItem}>
                      <View style={[styles.metaIcon, { backgroundColor: "#FEF2F2" }]}>
                        <Ionicons name="location-outline" size={14} color="#EF4444" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Venue</Text>
                        <Text style={styles.metaValue} numberOfLines={1}>{event.location}</Text>
                      </View>
                    </View>
                  )}
                  {event.jnvName && (
                    <View style={styles.metaItem}>
                      <View style={[styles.metaIcon, { backgroundColor: "#ECFDF5" }]}>
                        <Ionicons name="school-outline" size={14} color="#10B981" />
                      </View>
                      <View>
                        <Text style={styles.metaLabel}>Hosted By</Text>
                        <Text style={styles.metaValue}>{event.jnvName}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {isSuccess ? (
                  <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.successBannerText}>You're registered! See you there.</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.registerBtn, isReg && styles.registeredBtn]}
                    onPress={() => isReg ? null : tryAccess("Events", () => setRegEvent(event))}
                    activeOpacity={isReg ? 1 : 0.85}
                  >
                    <Ionicons name={isReg ? "checkmark-circle" : "person-add-outline"} size={17} color="#fff" />
                    <Text style={styles.registerBtnText}>{isReg ? "Registered" : "Register for this Event"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {gateModal}

      <CreateEventModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchEvents}
      />

      {regEvent && (
        <RegistrationModal
          event={regEvent}
          role={role}
          profile={profile}
          visible={!!regEvent}
          onClose={() => setRegEvent(null)}
          onSuccess={() => handleRegistrationSuccess(regEvent.id)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#3D5AF1", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  eventCard: {
    backgroundColor: "#fff", borderRadius: 18, marginBottom: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  eventStrip: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  dateBox: { width: 52, height: 60, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dateDay: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 26 },
  dateMonth: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stripTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", lineHeight: 22, marginBottom: 4 },
  stripOrg: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" },
  onlinePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start",
  },
  onlinePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  eventBody: { padding: 16 },
  eventDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 21, marginBottom: 14 },
  metaGrid: { gap: 10, marginBottom: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metaLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  metaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  registerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 14,
  },
  registeredBtn: { backgroundColor: "#10B981" },
  registerBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ECFDF5", borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16,
    borderWidth: 1, borderColor: "#D1FAE5",
  },
  successBannerText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#059669" },
});

const regStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  body: { padding: 20, paddingBottom: 40 },
  eventSummary: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventSummaryText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", flex: 1 },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 16 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 6 },
  fieldInput: {
    backgroundColor: "#F9FAFB", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827",
    borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  chipTextActive: { color: "#fff" },
  attendRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 14,
  },
  attendSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 16, marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: "#A5B4FC" },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  privacyNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", marginTop: 12, lineHeight: 17 },
});

const cStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  body: { padding: 20, paddingBottom: 40 },
  orgBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#EEF2FF", borderRadius: 14, padding: 14, marginBottom: 20,
  },
  orgAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  orgAvatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  orgName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  orgRole: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 6 },
  fieldRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB" },
  fieldIcon: { width: 44, alignItems: "center", justifyContent: "center" },
  fieldInput: { flex: 1, paddingVertical: 12, paddingRight: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  tipBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EEF2FF", borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#3730A3", lineHeight: 18 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 16,
  },
  submitBtnDisabled: { backgroundColor: "#A5B4FC" },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  successOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  successBox: {
    backgroundColor: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  successIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  successDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 21, marginBottom: 24 },
  successBtn: { backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  successBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
