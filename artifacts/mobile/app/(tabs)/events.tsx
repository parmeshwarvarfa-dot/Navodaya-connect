import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { Event } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useVerificationGate } from "@/components/VerificationGateModal";
import EventCard from "@/components/EventCard";
import EventRegistrationsModal from "@/components/EventRegistrationsModal";
import CalendarModal from "@/components/CalendarModal";
import VenuePickerModal from "@/components/map/VenuePickerModal";
import FadeIn from "@/components/motion/FadeIn";
import ImageAdjustmentModal from "@/components/media/ImageAdjustmentModal";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

async function registerForEvent(
  eventId: string,
  data: Record<string, unknown>
): Promise<void> {
  await api.events.register(eventId, data);
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

function parseEventDateValue(dateValue: string, timeValue: string): Date | null {
  const input = dateValue.trim();
  let year = 0;
  let month = 0;
  let day = 0;
  const isoDate = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dayFirstDate = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const namedDate = input.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

  if (isoDate) {
    year = Number(isoDate[1]); month = Number(isoDate[2]); day = Number(isoDate[3]);
  } else if (dayFirstDate) {
    day = Number(dayFirstDate[1]); month = Number(dayFirstDate[2]); year = Number(dayFirstDate[3]);
  } else if (namedDate) {
    day = Number(namedDate[1]);
    const monthToken = namedDate[2].toLowerCase();
    month = monthNames.findIndex((name) => name === monthToken || (monthToken.length >= 3 && name.startsWith(monthToken))) + 1;
    year = Number(namedDate[3]);
    if (!month) return null;
  } else {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  const time = timeValue.trim();
  if (time) {
    const timeParts = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!timeParts) return null;
    hours = Number(timeParts[1]);
    minutes = Number(timeParts[2] ?? 0);
    const meridiem = timeParts[3]?.toLowerCase();
    if (minutes > 59) return null;
    if (meridiem) {
      if (hours < 1 || hours > 12) return null;
      if (meridiem === "pm" && hours !== 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;
    } else if (hours > 23) {
      return null;
    }
  }

  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const result = new Date(year, month - 1, day, hours, minutes);
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) return null;
  return result;
}

function eventDateInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function calendarDateInputValue(date: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function eventTimeInputValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const DIETARY_OPTIONS = ["No Preference", "Vegetarian", "Non-Vegetarian", "Vegan", "Jain"];
const HOUSE_OPTIONS = ["Aravali", "Nilgiri", "Shivalik", "Udaygiri"];
const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];

const GRADIENT_SETS = [
  ["#8B5CF6", "#6D28D9"] as const,
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
  const [regError, setRegError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !contact.trim()) return;
    setSubmitting(true);
    setRegError("");
    try {
      await registerForEvent(event.id, {
        fullName: name.trim(), jnvName, jnvState, contactNo: contact.trim(),
        passoutBatch, house, class: cls, designation, subject,
        contribution, feedback, dietaryPreference: dietary,
        attendingInPerson: attending,
      });
      onSuccess();
    } catch (error) {
      setRegError(error instanceof Error ? error.message : "Could not complete registration. Please try again.");
    }
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
              <Ionicons name="calendar" size={16} color="#7C3AED" />
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
              <Switch value={attending} onValueChange={setAttending} trackColor={{ false: "#E5E7EB", true: "#7C3AED" }} thumbColor="#fff" />
            </View>

            <Field
              label="Feedback / Suggestions (Optional)"
              value={feedback} onChange={setFeedback}
              placeholder="Share your suggestions, expectations, or any specific topics you'd like to be covered at this event..."
              multiline
            />

            {regError ? (
              <Text style={{ color: "#B42318", fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 10 }}>
                {regError}
              </Text>
            ) : null}

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
function CreateEventModal({ visible, onClose, onCreated, eventToEdit }: { visible: boolean; onClose: () => void; onCreated: () => void; eventToEdit: Event | null }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [eventMedia, setEventMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [mediaToAdjust, setMediaToAdjust] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showImageAdjustment, setShowImageAdjustment] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTitle(eventToEdit?.title ?? "");
    setDescription(eventToEdit?.description ?? "");
    setVenue(eventToEdit?.location ?? "");
    setDate(eventToEdit ? eventDateInputValue(eventToEdit.date) : "");
    setTime(eventToEdit ? eventTimeInputValue(eventToEdit.date) : "");
    setMaxCapacity(eventToEdit?.maxCapacity ? String(eventToEdit.maxCapacity) : "");
    setEventMedia(null);
    setCreateError("");
    setSuccess(false);
  }, [visible, eventToEdit?.id]);

  const chooseEventMedia = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setCreateError("Allow photo library access to attach event media.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      if ((asset.fileSize ?? 0) > 100 * 1024 * 1024) {
        setCreateError("Choose a photo or video under 100 MB.");
        return;
      }
      setCreateError("");
      if (asset.type === "image") {
        setMediaToAdjust(asset);
        setShowImageAdjustment(true);
      } else {
        setEventMedia(asset);
      }
    } catch {
      setCreateError("Could not open your photo library. Please try again.");
    }
  };

  const openDatePicker = () => {
    const parsedDate = date ? parseEventDateValue(date, "") : null;
    const initialDate = parsedDate ?? new Date();
    setDatePickerMonth(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
    setShowDatePicker(true);
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !venue.trim() || !date.trim()) return;
    const eventDate = parseEventDateValue(date, time);
    if (!eventDate) {
      setCreateError("Enter the date as DD-MM-YYYY (for example, 25-12-2026) and time as HH:mm in 24-hour format (for example, 10:00).");
      return;
    }
    setSubmitting(true);
    setCreateError("");
    let uploadedKey: string | undefined;
    try {
      if (eventMedia) {
        const fileName = eventMedia.fileName?.replace(/[^a-zA-Z0-9._ -]/g, "_") || "event-media";
        const uploaded = await api.memories.uploadMedia(eventMedia.uri, fileName, eventMedia.mimeType);
        uploadedKey = uploaded.key;
      }
      const parsedCap = maxCapacity.trim() ? Number(maxCapacity.trim()) : null;
      const payload = {
        title: title.trim(),
        description: description.trim(),
        date: eventDate.toISOString(),
        location: venue.trim(),
        ...(parsedCap && Number.isInteger(parsedCap) && parsedCap > 0 ? { maxCapacity: parsedCap } : { maxCapacity: null }),
        ...(uploadedKey ? { mediaKey: uploadedKey } : {}),
      };
      if (eventToEdit) await api.events.update(eventToEdit.id, payload);
      else await api.events.create(payload);
      setSuccess(true);
      setTitle(""); setDescription(""); setVenue(""); setDate(""); setTime(""); setMaxCapacity(""); setEventMedia(null);
    } catch (error) {
      if (uploadedKey) {
        try { await api.memories.cleanupUploads([uploadedKey]); } catch {}
      }
      setCreateError(error instanceof Error ? error.message : "Could not publish the event. Please try again.");
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={cStyles.successOverlay}>
          <View style={cStyles.successBox}>
            <LinearGradient colors={["#8B5CF6", "#6D28D9"]} style={cStyles.successIcon}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </LinearGradient>
            <Text style={cStyles.successTitle}>{eventToEdit ? "Event Updated!" : "Event Created!"}</Text>
            <Text style={cStyles.successDesc}>{eventToEdit ? "Your event details have been updated." : "Your event has been published. Other Navodayans can now view and register for it."}</Text>
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
    <>
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={cStyles.container}>
        <View style={cStyles.header}>
          <Text style={cStyles.headerTitle}>{eventToEdit ? "Edit Event" : "Organise an Event"}</Text>
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
              { label: "Venue / Location", value: venue, onChange: setVenue, placeholder: "e.g. School Auditorium / Online (Zoom)", icon: "location-outline", required: true, onIconPress: () => setShowVenuePicker(true) },
              { label: "Date", value: date, onChange: setDate, placeholder: "DD-MM-YYYY (e.g. 25-12-2026)", icon: "calendar-outline", required: true, onIconPress: openDatePicker },
              { label: "Time", value: time, onChange: setTime, placeholder: "HH:mm (24-hour)", icon: "time-outline", required: false },
              { label: "Max Capacity (Optional)", value: maxCapacity, onChange: setMaxCapacity, placeholder: "Leave blank for unlimited", icon: "people-outline", required: false },
            ].map((f) => (
              <View key={f.label} style={cStyles.fieldWrap}>
                <Text style={cStyles.fieldLabel}>{f.label}{f.required && <Text style={{ color: "#EF4444" }}> *</Text>}</Text>
                <View style={cStyles.fieldRow}>
                  {f.onIconPress ? (
                    <TouchableOpacity style={cStyles.fieldIcon} onPress={f.onIconPress} accessibilityRole="button" accessibilityLabel={f.label === "Date" ? "Choose event date" : "Search venue in Google Maps"}>
                      <Ionicons name={f.icon as any} size={18} color="#7C3AED" />
                    </TouchableOpacity>
                  ) : (
                    <View style={cStyles.fieldIcon}><Ionicons name={f.icon as any} size={18} color="#7C3AED" /></View>
                  )}
                  <TextInput
                    style={cStyles.fieldInput} value={f.value} onChangeText={f.onChange}
                    placeholder={f.placeholder} placeholderTextColor="#9CA3AF"
                  />
                </View>
                {f.label === "Venue / Location" ? (
                    <Text style={cStyles.fieldHint}>Tap the map icon to search or select a place; it will fill the venue automatically. You can also type it manually.</Text>
                ) : null}
              </View>
            ))}

            <View style={cStyles.fieldWrap}>
              <Text style={cStyles.fieldLabel}>Description <Text style={{ color: "#EF4444" }}>*</Text></Text>
              <View style={[cStyles.fieldRow, { alignItems: "flex-start" }]}>
                <View style={[cStyles.fieldIcon, { marginTop: 2 }]}>
                  <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                </View>
                <TextInput
                  style={[cStyles.fieldInput, { minHeight: 100, textAlignVertical: "top" }]}
                  value={description} onChangeText={setDescription} multiline
                  placeholder="Describe the event — what will happen, who should attend, what to bring or prepare..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={cStyles.fieldWrap}>
              <Text style={cStyles.fieldLabel}>Event photo or video <Text style={cStyles.optionalLabel}>(Optional)</Text></Text>
              {eventMedia ? (
                <View style={cStyles.mediaPreview}>
                  {eventMedia.type === "video" ? (
                    <View style={cStyles.videoPreview}>
                      <Ionicons name="play-circle" size={42} color="#fff" />
                      <Text style={cStyles.videoPreviewText}>Video selected</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: eventMedia.uri }} style={cStyles.mediaImage} resizeMode="cover" />
                  )}
                  <TouchableOpacity style={cStyles.removeMedia} onPress={() => setEventMedia(null)} accessibilityLabel="Remove event media">
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : eventToEdit?.mediaUrl ? (
                <View style={cStyles.mediaPreview}>
                  {eventToEdit.mediaType === "video" ? (
                    <View style={cStyles.videoPreview}><Ionicons name="play-circle" size={42} color="#fff" /><Text style={cStyles.videoPreviewText}>Current event video</Text></View>
                  ) : <Image source={{ uri: eventToEdit.mediaUrl }} style={cStyles.mediaImage} resizeMode="cover" />}
                </View>
              ) : null}
              {!eventMedia && <TouchableOpacity style={cStyles.mediaPicker} onPress={chooseEventMedia} activeOpacity={0.8}>
                <View style={cStyles.mediaPickerIcon}><Ionicons name="images-outline" size={21} color="#7C3AED" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={cStyles.mediaPickerTitle}>{eventToEdit?.mediaUrl ? "Replace current media" : "Add a photo or video"}</Text>
                  <Text style={cStyles.mediaPickerSub}>{eventToEdit?.mediaUrl ? "Leave this blank to keep the current media" : "Give attendees a preview of the event"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>}
            </View>

            {createError ? <Text style={cStyles.createError}>{createError}</Text> : null}

            <View style={cStyles.tipBox}>
              <Ionicons name="information-circle-outline" size={16} color="#7C3AED" />
              <Text style={cStyles.tipText}>Tip: Include specific timings, dress code, what to bring, and any eligibility criteria so attendees come prepared.</Text>
            </View>

            <TouchableOpacity
              style={[cStyles.submitBtn, !canSubmit && cStyles.submitBtnDisabled]}
              onPress={handleCreate} disabled={!canSubmit || submitting} activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name={eventToEdit ? "save-outline" : "add-circle-outline"} size={20} color="#fff" />
                  <Text style={cStyles.submitBtnText}>{eventToEdit ? "Save Changes" : "Publish Event"}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
    <ImageAdjustmentModal
      visible={showImageAdjustment}
      asset={mediaToAdjust}
      title="Adjust event photo"
      onCancel={() => { setShowImageAdjustment(false); setMediaToAdjust(null); }}
      onDone={(asset) => { setEventMedia(asset); setShowImageAdjustment(false); setMediaToAdjust(null); }}
    />
    <VenuePickerModal
      visible={showVenuePicker}
      initialQuery={venue || profile?.jnvName || ""}
      onClose={() => setShowVenuePicker(false)}
      onSelect={(selectedVenue) => { setVenue(selectedVenue); setCreateError(""); }}
    />
    <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
      <View style={cStyles.datePickerBackdrop}>
        <View style={cStyles.datePickerCard}>
          <View style={cStyles.datePickerHeader}>
            <Text style={cStyles.datePickerTitle}>Choose event date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)} accessibilityRole="button" accessibilityLabel="Close date picker">
              <Ionicons name="close" size={21} color="#64748B" />
            </TouchableOpacity>
          </View>
          <View style={cStyles.datePickerNavigation}>
            <TouchableOpacity onPress={() => setDatePickerMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={cStyles.datePickerNavButton} accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={19} color="#6D28D9" />
            </TouchableOpacity>
            <Text style={cStyles.datePickerMonth}>{datePickerMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</Text>
            <TouchableOpacity onPress={() => setDatePickerMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={cStyles.datePickerNavButton} accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={19} color="#6D28D9" />
            </TouchableOpacity>
          </View>
          <View style={cStyles.datePickerWeek}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`${day}-${index}`} style={cStyles.datePickerWeekday}>{day}</Text>)}
          </View>
          <View style={cStyles.datePickerGrid}>
            {Array.from({ length: 42 }, (_, index) => {
              const first = new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth(), 1);
              const dateValue = new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth(), 1 - first.getDay() + index);
              const selectedDate = parseEventDateValue(date, "");
              const isSelected = selectedDate
                ? dateValue.getFullYear() === selectedDate.getFullYear() && dateValue.getMonth() === selectedDate.getMonth() && dateValue.getDate() === selectedDate.getDate()
                : false;
              const inMonth = dateValue.getMonth() === datePickerMonth.getMonth();
              return (
                <TouchableOpacity
                  key={`${dateValue.getFullYear()}-${dateValue.getMonth()}-${dateValue.getDate()}`}
                  style={[cStyles.datePickerDay, isSelected && cStyles.datePickerSelectedDay]}
                  onPress={() => {
                    setDate(calendarDateInputValue(dateValue));
                    setShowDatePicker(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={dateValue.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                >
                  <Text style={[cStyles.datePickerDayText, !inMonth && cStyles.datePickerOutsideMonth, isSelected && cStyles.datePickerSelectedText]}>{dateValue.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={cStyles.datePickerToday}
            onPress={() => {
              setDate(calendarDateInputValue(new Date()));
              setDatePickerMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
              setShowDatePicker(false);
            }}
          >
            <Text style={cStyles.datePickerTodayText}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isVerified } = useAuth();
  const { tryAccess, modal: gateModal } = useVerificationGate(isVerified);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [regEvent, setRegEvent] = useState<Event | null>(null);
  const [manageEvent, setManageEvent] = useState<Event | null>(null);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [successEvent, setSuccessEvent] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEventSearch, setShowEventSearch] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const fetchEvents = async () => {
    try {
      const list = await api.events.list();
      setEvents(list);
      setRegistered(new Set(list.filter((e) => e.isRegistered).map((e) => e.id)));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, []);

  const displayEvents = events.filter((event) => {
    const query = eventSearch.trim().toLocaleLowerCase();
    if (!query) return true;
    const date = new Date(event.date);
    const dateText = Number.isNaN(date.getTime()) ? event.date : date.toLocaleDateString("en-IN");
    return [event.title, event.description, event.location, event.organizer, event.jnvName, dateText]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });

  const openOrganizerProfile = useCallback(async (organizerId?: string, organizerName?: string) => {
    if (organizerId) {
      router.push({ pathname: "/(screens)/user-profile" as any, params: { userId: organizerId } });
      return true;
    }
    const name = organizerName?.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (!name) return false;
    try {
      const matches = await api.users.search(name);
      const exactMatches = matches.filter((user) => user.fullName.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
      if (exactMatches.length === 1) {
        router.push({ pathname: "/(screens)/user-profile" as any, params: { userId: exactMatches[0].id } });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);
  const role = profile?.role || "student";

  const handleRegistrationSuccess = (eventId: string) => {
    setRegistered((prev) => new Set([...prev, eventId]));
    setRegEvent(null);
    setSuccessEvent(eventId);
    void fetchEvents();
  };

  const handleCancelRegistration = async (eventId: string) => {
    try {
      await api.events.cancelRegistration(eventId);
      setRegistered((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      if (successEvent === eventId) setSuccessEvent(null);
      void fetchEvents();
    } catch {}
  };

  const confirmDeleteEvent = async () => {
    if (!deleteTarget || deletingEvent) return;
    setDeletingEvent(true);
    setDeleteError("");
    try {
      await api.events.delete(deleteTarget.id);
      setEvents((current) => current.filter((event) => event.id !== deleteTarget.id));
      setRegistered((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this event. Please try again.");
    } finally {
      setDeletingEvent(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View>
          <Text style={styles.headerTitle}>Events</Text>
          <Text style={styles.headerSub}>JNV functions, webinars & reunions</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowEventSearch((current) => !current)} accessibilityRole="button" accessibilityLabel="Search events">
            <Ionicons name="search-outline" size={19} color="#6D28D9" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowCalendar(true)} accessibilityRole="button" accessibilityLabel="Open smart calendar">
            <Ionicons name="calendar-outline" size={19} color="#6D28D9" />
          </TouchableOpacity>
          {profile && profile.role !== "student" ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingEvent(null); setShowCreate(true); }}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Organise</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
      >
        {showEventSearch ? (
          <View style={styles.eventSearchBox}>
            <Ionicons name="search-outline" size={17} color="#8B8498" />
            <TextInput
              style={styles.eventSearchInput}
              value={eventSearch}
              onChangeText={setEventSearch}
              placeholder="Search events, dates, places..."
              placeholderTextColor="#9B95A8"
              returnKeyType="search"
              accessibilityLabel="Search events"
            />
            {eventSearch ? <TouchableOpacity onPress={() => setEventSearch("")} accessibilityLabel="Clear event search"><Ionicons name="close-circle" size={18} color="#94A3B8" /></TouchableOpacity> : null}
          </View>
        ) : null}
        {loadError ? <TouchableOpacity onPress={fetchEvents} style={{ padding: 18, backgroundColor: "#FFF4E5", borderRadius: 12, marginBottom: 14 }}><Text style={{ color: "#8A4B08", fontFamily: "Inter_600SemiBold" }}>Could not load events. Tap to retry.</Text></TouchableOpacity> : null}
        {!loadError && displayEvents.length === 0 ? <View style={{ alignItems: "center", paddingVertical: 48 }}><Ionicons name="calendar-outline" size={42} color="#9CA3AF" /><Text style={{ color: "#6B7280", marginTop: 12, fontFamily: "Inter_600SemiBold" }}>{eventSearch.trim() ? "No events match your search" : "No events yet"}</Text></View> : null}
        {displayEvents.map((event, idx) => (
          <FadeIn key={event.id} delay={Math.min(idx, 4) * 35}>
            <EventCard
              event={event}
              index={idx}
              registered={registered.has(event.id)}
              registrationSuccess={successEvent === event.id}
              onRegister={() => tryAccess("Events", () => setRegEvent(event))}
              onCancelRegistration={() => void handleCancelRegistration(event.id)}
              onManageRegistrations={event.canManage ? () => setManageEvent(event) : undefined}
              onOrganizerPress={openOrganizerProfile}
              onEdit={profile?.role !== "student" && event.canManage ? () => { setEditingEvent(event); setShowCreate(true); } : undefined}
              onDelete={event.organizerId && event.organizerId === profile?.uid ? () => { setDeleteError(""); setDeleteTarget(event); } : undefined}
            />
          </FadeIn>
        ))}
      </ScrollView>

      {gateModal}

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        registered={registered}
        userId={profile?.uid}
        onRegister={(event) => {
          setShowCalendar(false);
          tryAccess("Events", () => setRegEvent(event));
        }}
      />

      <EventRegistrationsModal
        event={manageEvent}
        visible={!!manageEvent}
        onClose={() => { setManageEvent(null); void fetchEvents(); }}
      />

      <CreateEventModal
        visible={showCreate}
        onClose={() => { setShowCreate(false); setEditingEvent(null); }}
        onCreated={fetchEvents}
        eventToEdit={editingEvent}
      />

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => !deletingEvent && setDeleteTarget(null)}>
        <View style={deleteStyles.backdrop}>
          <View style={deleteStyles.dialog}>
            <View style={deleteStyles.icon}><Ionicons name="trash-outline" size={24} color="#B42318" /></View>
            <Text style={deleteStyles.title}>Delete this event?</Text>
            <Text style={deleteStyles.eventTitle} numberOfLines={2}>{deleteTarget?.title}</Text>
            <Text style={deleteStyles.description}>This will permanently delete the event and all attendee registrations for it.</Text>
            {deleteError ? <Text style={deleteStyles.error}>{deleteError}</Text> : null}
            <View style={deleteStyles.actions}>
              <TouchableOpacity style={deleteStyles.cancelButton} onPress={() => setDeleteTarget(null)} disabled={deletingEvent}>
                <Text style={deleteStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={deleteStyles.confirmButton} onPress={() => void confirmDeleteEvent()} disabled={deletingEvent}>
                {deletingEvent ? <ActivityIndicator size="small" color="#fff" /> : <Text style={deleteStyles.confirmText}>Delete event</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "rgba(233, 213, 255, 0.6)",
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerIconButton: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#F4F0FF", alignItems: "center", justifyContent: "center" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#7C3AED", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9,
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  eventSearchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderColor: "#E7E1F2", borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, height: 44, marginBottom: 14 },
  eventSearchInput: { flex: 1, color: "#25213A", fontFamily: "Inter_400Regular", fontSize: 13, paddingVertical: 0 },
  eventCard: {
    backgroundColor: "#fff", borderRadius: 22, marginBottom: 16, overflow: "hidden",
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3,
    borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)",
  },
  eventStrip: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  dateBox: { width: 54, height: 62, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dateDay: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 26 },
  dateMonth: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stripTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 23, marginBottom: 4 },
  stripOrg: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_400Regular" },
  onlinePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start",
  },
  onlinePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
  eventBody: { padding: 18 },
  eventDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#1E1B4B", lineHeight: 21, marginBottom: 14 },
  metaGrid: { gap: 10, marginBottom: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  metaLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  metaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E1B4B" },
  registerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 14,
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  registeredBtn: { backgroundColor: "#10B981" },
  registerBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ECFDF5", borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16,
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
  chipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
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
    backgroundColor: "#7C3AED", borderRadius: 14, paddingVertical: 16, marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: "#A5B4FC" },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  privacyNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", marginTop: 12, lineHeight: 17 },
});

const deleteStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.48)", justifyContent: "center", alignItems: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 22, padding: 24, alignItems: "center" },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { color: "#111827", fontSize: 19, fontFamily: "Inter_700Bold", textAlign: "center" },
  eventTitle: { color: "#374151", fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center", marginTop: 8 },
  description: { color: "#6B7280", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, textAlign: "center", marginTop: 10 },
  error: { color: "#B42318", fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 12 },
  actions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 22 },
  cancelButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  cancelText: { color: "#374151", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  confirmButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: "#DC2626", justifyContent: "center", alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
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
    backgroundColor: "#F5F3FF", borderRadius: 14, padding: 14, marginBottom: 20,
  },
  orgAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  orgAvatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  orgName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  orgRole: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 6 },
  optionalLabel: { color: "#9CA3AF", fontFamily: "Inter_400Regular" },
  mediaPicker: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderStyle: "dashed", borderColor: "#C7D2FE", backgroundColor: "#F8FAFF", borderRadius: 14, padding: 14 },
  mediaPickerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  mediaPickerTitle: { color: "#1F2937", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mediaPickerSub: { color: "#6B7280", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  mediaPreview: { height: 180, borderRadius: 14, overflow: "hidden", backgroundColor: "#111827" },
  mediaImage: { width: "100%", height: "100%" },
  videoPreview: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1F2937" },
  videoPreviewText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 5 },
  removeMedia: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(17,24,39,0.75)", alignItems: "center", justifyContent: "center" },
  createError: { color: "#B91C1C", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12 },
  fieldRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB" },
  fieldIcon: { width: 44, alignItems: "center", justifyContent: "center" },
  fieldInput: { flex: 1, paddingVertical: 12, paddingRight: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  fieldHint: { color: "#7A8494", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 6, marginHorizontal: 2 },
  datePickerBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.48)", alignItems: "center", justifyContent: "center", padding: 20 },
  datePickerCard: { width: "100%", maxWidth: 380, borderRadius: 22, backgroundColor: "#fff", padding: 18, shadowColor: "#1E1B4B", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 10 },
  datePickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  datePickerTitle: { color: "#1E1B4B", fontSize: 17, fontFamily: "Inter_700Bold" },
  datePickerNavigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
  datePickerNavButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F4F0FF", alignItems: "center", justifyContent: "center" },
  datePickerMonth: { color: "#29243D", fontSize: 15, fontFamily: "Inter_700Bold" },
  datePickerWeek: { flexDirection: "row" },
  datePickerWeekday: { width: `${100 / 7}%`, textAlign: "center", color: "#8B8498", fontSize: 11, fontFamily: "Inter_600SemiBold", paddingVertical: 8 },
  datePickerGrid: { flexDirection: "row", flexWrap: "wrap" },
  datePickerDay: { width: `${100 / 7}%`, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  datePickerSelectedDay: { backgroundColor: "#7C3AED" },
  datePickerDayText: { color: "#39334D", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  datePickerOutsideMonth: { color: "#C1BDCA", fontFamily: "Inter_400Regular" },
  datePickerSelectedText: { color: "#fff" },
  datePickerToday: { alignSelf: "center", marginTop: 12, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 12, backgroundColor: "#F4F0FF" },
  datePickerTodayText: { color: "#6D28D9", fontSize: 13, fontFamily: "Inter_700Bold" },
  tipBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#F5F3FF", borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#3730A3", lineHeight: 18 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#7C3AED", borderRadius: 14, paddingVertical: 16,
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
  successBtn: { backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  successBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
