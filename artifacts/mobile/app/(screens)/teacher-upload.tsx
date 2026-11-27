import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, getApiOrigin } from "@/lib/api";
import type { StudyMaterial } from "@/lib/api";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

const DEFAULT_SUBJECTS = [
  "Physics",
  "Chemistry",
  "Maths",
  "English",
  "Biology",
  "History",
  "Geography",
  "Computer Science",
  "Economics",
  "Hindi",
  "Social Science",
];

const TYPES = ["PDF", "Notes", "PYQ", "Slides", "Link", "Assignment"];

const TYPE_COLOR: Record<string, string> = {
  PDF: "#EF4444",
  Notes: "#7C3AED",
  PYQ: "#8B5CF6",
  Slides: "#F59E0B",
  Link: "#10B981",
  Assignment: "#EC4899",
};

interface SelectedLocalFile {
  name: string;
  size: string;
  sizeBytes: number;
  type: string;
  base64: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function inferTypeFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "PDF";
    case "ppt":
    case "pptx":
      return "Slides";
    case "doc":
    case "docx":
    case "txt":
      return "Notes";
    default:
      return "Notes";
  }
}

export default function TeacherUploadScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [uploads, setUploads] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSubj, setFilterSubj] = useState("All");
  const [toast, setToast] = useState("");

  // Upload Form Mode: "file" (direct upload) or "link" (external URL)
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");

  // Form Fields
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const [type, setType] = useState("PDF");
  const [url, setUrl] = useState("");
  const [formErr, setFormErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected file for upload
  const [selectedFile, setSelectedFile] = useState<SelectedLocalFile | null>(null);
  const fileInputRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const fetchMaterials = async () => {
    try {
      setLoadError("");
      const rows = await api.studyMaterials.list();
      setUploads(rows.filter((row) => row.authorId));
    } catch (error: any) {
      setLoadError(error?.message || "Could not load materials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  // Compute all available subjects (defaults + existing uploads)
  const availableSubjects = useMemo(() => {
    const set = new Set(DEFAULT_SUBJECTS);
    uploads.forEach((u) => {
      if (u.subject) set.add(u.subject);
    });
    return Array.from(set);
  }, [uploads]);

  const allFilterSubjects = ["All", ...availableSubjects];

  // Open file in browser / app
  const openMaterial = async (materialUrl?: string) => {
    if (!materialUrl) return;
    try {
      const fullUrl = materialUrl.startsWith("/") ? `${getApiOrigin()}${materialUrl}` : materialUrl;
      if (Platform.OS === "web") {
        window.open(fullUrl, "_blank");
      } else {
        await Linking.openURL(fullUrl);
      }
    } catch {
      showToast("Could not open this material.");
    }
  };

  // Handle picking a local file on web/mobile
  const handlePickFile = () => {
    if (Platform.OS === "web") {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } else {
      showToast("File selection opened.");
    }
  };

  const handleWebFileChange = (event: any) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setFormErr("File exceeds 50MB maximum limit. Please choose a smaller file.");
      return;
    }

    setFormErr("");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const formattedSize = formatBytes(file.size);
      const inferred = inferTypeFromFileName(file.name);

      setSelectedFile({
        name: file.name,
        size: formattedSize,
        sizeBytes: file.size,
        type: file.type || "application/octet-stream",
        base64,
      });

      // Auto-set title if empty
      if (!title.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }

      // Auto-set type
      setType(inferred);
    };
    reader.onerror = () => {
      setFormErr("Failed to read the selected file.");
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async () => {
    const finalSubject = (isCustomSubject ? customSubjectInput : subject).trim();

    if (!title.trim()) {
      setFormErr("Please enter a title for this material.");
      return;
    }
    if (!finalSubject) {
      setFormErr("Please select or enter a subject.");
      return;
    }

    let finalUrl = url.trim();
    let finalSize: string | undefined = undefined;

    // Validate based on mode
    if (uploadMode === "file") {
      if (!selectedFile) {
        setFormErr("Please select a file to upload from your device, or switch to 'Web Link' mode.");
        return;
      }
    } else {
      if (!finalUrl || !/^(https?:\/\/)/i.test(finalUrl)) {
        setFormErr("Please provide a valid https:// or http:// web link.");
        return;
      }
    }

    setSubmitting(true);
    setFormErr("");

    try {
      // 1. If direct file mode, upload the file first
      if (uploadMode === "file" && selectedFile) {
        const uploadRes = await api.studyMaterials.uploadFile({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          base64Data: selectedFile.base64,
        });
        finalUrl = uploadRes.url;
        finalSize = uploadRes.size;
      }

      // 2. Publish the study material record
      const row = await api.studyMaterials.create({
        title: title.trim(),
        subject: finalSubject,
        type: type || "Notes",
        url: finalUrl,
        size: finalSize,
      });

      setUploads((prev) => [row, ...prev]);

      // Reset Form
      setTitle("");
      setSubject("");
      setIsCustomSubject(false);
      setCustomSubjectInput("");
      setType("PDF");
      setUrl("");
      setSelectedFile(null);
      setShowModal(false);
      showToast(uploadMode === "file" ? "File uploaded & published for students!" : "Material link published!");
    } catch (error: any) {
      setFormErr(error?.message || "Failed to publish study material. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = uploads
    .filter(
      (u) =>
        (filterSubj === "All" || u.subject.toLowerCase() === filterSubj.toLowerCase()) &&
        (!search || u.title.toLowerCase().includes(search.toLowerCase()) || u.subject.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <View style={styles.container}>
      {/* Hidden Web File Input for Direct Uploads */}
      {Platform.OS === "web" ? (
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip"
          onChange={handleWebFileChange}
        />
      ) : null}

      {/* Screen Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Study Materials & Notes</Text>
          <Text style={styles.headerSub}>Publish and manage academic notes accessible to JNV students</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setFormErr("");
            setShowModal(true);
          }}
          accessibilityLabel="Upload New Material"
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Upload Notes</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search published materials by title or subject…"
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Subject Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ flexGrow: 0 }}
      >
        {allFilterSubjects.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, filterSubj === s && styles.chipActive]}
            onPress={() => setFilterSubj(s)}
          >
            <Text style={[styles.chipText, filterSubj === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Materials List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}
      >
        <Text style={styles.resultCount}>
          {loading ? "Loading published materials…" : `${filtered.length} Published Study Materials`}
        </Text>

        {loadError ? (
          <TouchableOpacity onPress={fetchMaterials} style={styles.errorAlert}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errText}>{loadError} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        {!loading && !loadError && filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-upload-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyCardTitle}>No Study Materials Published Yet</Text>
            <Text style={styles.emptyCardSub}>
              Tap the "+ Upload Notes" button at the top to publish your first document or resource link.
            </Text>
          </View>
        ) : null}

        {filtered.map((u) => {
          const isDirectFile = u.url?.includes("/api/study-materials/files/");
          return (
            <TouchableOpacity
              key={u.id}
              style={styles.card}
              onPress={() => openMaterial(u.url)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.typeIcon,
                  { backgroundColor: (TYPE_COLOR[u.type] || "#7C3AED") + "18" },
                ]}
              >
                <Ionicons
                  name={
                    u.type === "PDF"
                      ? "document-text"
                      : u.type === "Slides"
                      ? "easel"
                      : u.type === "Link"
                      ? "link"
                      : "book"
                  }
                  size={20}
                  color={TYPE_COLOR[u.type] || "#7C3AED"}
                />
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {u.title}
                </Text>

                <View style={styles.cardMetaRow}>
                  <View style={styles.subjectTag}>
                    <Text style={styles.subjectTagText}>{u.subject}</Text>
                  </View>
                  <Text style={styles.cardMeta}>· {u.targetClass || "Whole School"}</Text>
                  {u.size ? (
                    <View style={styles.fileSizeBadge}>
                      <Ionicons name="document-outline" size={11} color="#64748B" />
                      <Text style={styles.fileSizeText}>{u.size}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardFooter}>
                  <View
                    style={[
                      styles.typePill,
                      { backgroundColor: (TYPE_COLOR[u.type] || "#7C3AED") + "18" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        { color: TYPE_COLOR[u.type] || "#7C3AED" },
                      ]}
                    >
                      {u.type}
                    </Text>
                  </View>

                  {isDirectFile ? (
                    <View style={styles.directFileTag}>
                      <Ionicons name="cloud-done-outline" size={12} color="#059669" />
                      <Text style={styles.directFileText}>Direct File</Text>
                    </View>
                  ) : null}

                  <Text style={styles.cardDate}>{new Date(u.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>

              <View style={styles.openPill}>
                <Text style={styles.openPillText}>Open</Text>
                <Ionicons name="open-outline" size={14} color="#7C3AED" />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* UPLOAD / PUBLISH MODAL */}
      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Publish Study Materials & Notes</Text>
                <Text style={styles.modalSubtitle}>
                  Make learning resources directly downloadable or link external guides
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* PUBLISH METHOD SELECTOR: Direct Upload vs Web Link */}
              <View style={styles.modeSelectorCard}>
                <Text style={styles.sectionHeading}>HOW WOULD YOU LIKE TO SHARE?</Text>
                <View style={styles.modeTabs}>
                  <TouchableOpacity
                    onPress={() => setUploadMode("file")}
                    style={[styles.modeTab, uploadMode === "file" && styles.modeTabActive]}
                  >
                    <Ionicons
                      name="cloud-upload"
                      size={18}
                      color={uploadMode === "file" ? "#7C3AED" : "#64748B"}
                    />
                    <View>
                      <Text
                        style={[
                          styles.modeTabTitle,
                          uploadMode === "file" && styles.modeTabTitleActive,
                        ]}
                      >
                        Upload File Directly
                      </Text>
                      <Text style={styles.modeTabSub}>PDF, Word, PPT, Notes file</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setUploadMode("link")}
                    style={[styles.modeTab, uploadMode === "link" && styles.modeTabActive]}
                  >
                    <Ionicons
                      name="link"
                      size={18}
                      color={uploadMode === "link" ? "#7C3AED" : "#64748B"}
                    />
                    <View>
                      <Text
                        style={[
                          styles.modeTabTitle,
                          uploadMode === "link" && styles.modeTabTitleActive,
                        ]}
                      >
                        Provide Web Link
                      </Text>
                      <Text style={styles.modeTabSub}>Google Drive, Dropbox, URL</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Material Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Chapter 5 – Electromagnetic Waves Formula Sheet"
                  placeholderTextColor="#94A3B8"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={180}
                />
              </View>

              {/* SUBJECT SELECTOR (Select Existing OR Create Custom) */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Subject *</Text>
                  {isCustomSubject ? (
                    <TouchableOpacity
                      onPress={() => {
                        setIsCustomSubject(false);
                        setCustomSubjectInput("");
                      }}
                      style={styles.switchSubjectLink}
                    >
                      <Text style={styles.switchSubjectText}>← Choose from predefined subjects</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {!isCustomSubject ? (
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
                    >
                      {availableSubjects.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.pill, subject === s && styles.pillActive]}
                          onPress={() => setSubject(s)}
                        >
                          <Text style={[styles.pillText, subject === s && styles.pillTextActive]}>
                            {s}
                          </Text>
                        </TouchableOpacity>
                      ))}

                      {/* "+ New Subject" Pill */}
                      <TouchableOpacity
                        style={[styles.pill, styles.pillCustom]}
                        onPress={() => {
                          setIsCustomSubject(true);
                          setSubject("");
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={15} color="#7C3AED" />
                        <Text style={styles.pillCustomText}>+ Add New Subject</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </>
                ) : (
                  <View style={styles.customSubjectBox}>
                    <Ionicons name="create-outline" size={17} color="#7C3AED" />
                    <TextInput
                      style={styles.customSubjectInput}
                      placeholder="Type custom subject name (e.g. Sanskrit, Accountancy, Arts...)"
                      placeholderTextColor="#94A3B8"
                      value={customSubjectInput}
                      onChangeText={setCustomSubjectInput}
                      maxLength={80}
                      autoFocus
                    />
                  </View>
                )}
              </View>

              {/* DIRECT FILE UPLOAD ZONE (When in "file" mode) */}
              {uploadMode === "file" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Select File from Device *</Text>
                  {selectedFile ? (
                    <View style={styles.selectedFileBox}>
                      <View style={styles.fileIconBadge}>
                        <Ionicons name="document-text" size={24} color="#7C3AED" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedFileName} numberOfLines={1}>
                          {selectedFile.name}
                        </Text>
                        <Text style={styles.selectedFileSize}>
                          {selectedFile.size} · Direct upload ready
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={handlePickFile}
                        style={styles.changeFileBtn}
                      >
                        <Text style={styles.changeFileText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setSelectedFile(null)}
                        style={styles.removeFileBtn}
                      >
                        <Ionicons name="trash-outline" size={17} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.dropZone}
                      onPress={handlePickFile}
                      activeOpacity={0.8}
                    >
                      <View style={styles.dropZoneIcon}>
                        <Ionicons name="cloud-upload" size={28} color="#7C3AED" />
                      </View>
                      <Text style={styles.dropZoneTitle}>Click to Choose Notes File</Text>
                      <Text style={styles.dropZoneSub}>
                        Supports PDF, Word (.docx), PowerPoint (.pptx), Text, and Images (up to 50MB)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* SECURE URL INPUT (When in "link" mode) */}
              {uploadMode === "link" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Resource Web Link *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://drive.google.com/... or web URL"
                    placeholderTextColor="#94A3B8"
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <Text style={styles.uploadBoxHint}>
                    Paste a shared public or institutional link from Google Drive, Dropbox, or school portal.
                  </Text>
                </View>
              )}

              {/* Material Type Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Material Classification *</Text>
                <View style={styles.typeGrid}>
                  {TYPES.map((t) => {
                    const active = type === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.typeCard,
                          active && {
                            borderColor: TYPE_COLOR[t] || "#7C3AED",
                            backgroundColor: (TYPE_COLOR[t] || "#7C3AED") + "14",
                          },
                        ]}
                        onPress={() => setType(t)}
                      >
                        <Ionicons
                          name={
                            t === "PDF"
                              ? "document-text"
                              : t === "Slides"
                              ? "easel"
                              : t === "Link"
                              ? "link"
                              : "book"
                          }
                          size={15}
                          color={active ? TYPE_COLOR[t] || "#7C3AED" : "#64748B"}
                        />
                        <Text
                          style={[
                            styles.typeCardText,
                            active && { color: TYPE_COLOR[t] || "#7C3AED", fontWeight: "700" },
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Form Error Banner */}
              {formErr ? (
                <View style={styles.errorAlert}>
                  <Ionicons name="alert-circle" size={17} color="#DC2626" />
                  <Text style={styles.errText}>{formErr}</Text>
                </View>
              ) : null}

              {/* Submit Confirmation Button */}
              <TouchableOpacity
                style={[styles.confirmBtn, submitting && { opacity: 0.65 }]}
                onPress={handleUploadSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.confirmBtnText}>Uploading & Publishing…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={uploadMode === "file" ? "cloud-upload" : "checkmark-circle"}
                      size={19}
                      color="#FFFFFF"
                    />
                    <Text style={styles.confirmBtnText}>
                      {uploadMode === "file" ? "Upload & Publish Notes" : "Publish Material Link"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Toast Notification */}
      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 1,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
    outlineStyle: "none" as any,
  },
  chips: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#475569",
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  resultCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    marginBottom: 12,
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    lineHeight: 18,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 2,
  },
  subjectTag: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  subjectTagText: {
    color: "#7C3AED",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  fileSizeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  fileSizeText: {
    color: "#475569",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  cardMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  typePill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  typePillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  directFileTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  directFileText: {
    color: "#059669",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  cardDate: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginLeft: "auto",
  },
  openPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
  },
  openPillText: {
    color: "#7C3AED",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },

  /* Empty State Card */
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 36,
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  emptyCardTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  emptyCardSub: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 320,
  },

  /* Modal */
  modal: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 18,
    gap: 16,
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
  },

  /* Mode Selector */
  modeSelectorCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 8,
  },
  sectionHeading: {
    color: "#94A3B8",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  modeTabs: {
    flexDirection: "row",
    gap: 10,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
  },
  modeTabActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  modeTabTitle: {
    color: "#334155",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  modeTabTitleActive: {
    color: "#5B21B6",
  },
  modeTabSub: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },

  /* Form Elements */
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    outlineStyle: "none" as any,
  },
  switchSubjectLink: {
    padding: 2,
  },
  switchSubjectText: {
    color: "#7C3AED",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pillActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  pillText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#334155",
  },
  pillTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  pillCustom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F3FF",
    borderColor: "#C7D2FE",
  },
  pillCustomText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  customSubjectBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: "#FFFFFF",
  },
  customSubjectInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#0F172A",
    outlineStyle: "none" as any,
  },

  /* Drop Zone */
  dropZone: {
    borderWidth: 2,
    borderColor: "#C7D2FE",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 22,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
  },
  dropZoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  dropZoneTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
  },
  dropZoneSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
  },

  /* Selected File */
  selectedFileBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 8,
    padding: 10,
  },
  fileIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedFileName: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#5B21B6",
  },
  selectedFileSize: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#475569",
    marginTop: 1,
  },
  changeFileBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  changeFileText: {
    color: "#334155",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  removeFileBtn: {
    padding: 4,
  },

  /* Type Cards Grid */
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  typeCardText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#475569",
  },
  uploadBoxHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 2,
  },

  /* Buttons & Errors */
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: 8,
  },
  errText: {
    flex: 1,
    color: "#DC2626",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 4,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  toast: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  toastText: {
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
