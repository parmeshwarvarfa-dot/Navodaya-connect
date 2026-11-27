import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { CreateMemoryRequest, SocialMemory } from "@workspace/api-client-react";
import { api, type UploadedMemoryMedia } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { isPostEditable, formatEditTimeRemaining } from "@/lib/post-editing";
import ImageAdjustmentModal from "@/components/media/ImageAdjustmentModal";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

type Visibility = "public" | "followers";
type PostType = NonNullable<CreateMemoryRequest["postType"]>;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMemoryRequest) => Promise<void>;
  initial?: SocialMemory | null;
  initialPostType?: PostType;
  onMessage: (message: string) => void;
};

export default function MemoryComposer({ visible, onClose, onSubmit, initial, initialPostType, onMessage }: Props) {
  const { profile } = useAuth();
  const [postType, setPostType] = useState<PostType>("text");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDurationHours, setPollDurationHours] = useState<24 | 72 | 168 | 336>(168);
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [pendingImageEdits, setPendingImageEdits] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [editingImageIndex, setEditingImageIndex] = useState(0);
  const [showImageAdjustment, setShowImageAdjustment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const uploadController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPostType((initial?.postType as PostType) || initialPostType || "text");
    setCaption(initial?.caption ?? "");
    setVisibility((initial?.visibility as Visibility) === "followers" ? "followers" : "public");
    setCommentsEnabled(initial?.commentsEnabled ?? true);
    setPollOptions(["", ""]);
    setPollDurationHours(168);
    setAssets([]);
    setPendingImageEdits([]);
    setEditingImageIndex(0);
    setShowImageAdjustment(false);
    setUploadProgress("");
  }, [visible, initial?.id, initialPostType]);

  const chooseMedia = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onMessage("Allow photo library access to attach media.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.85,
      });
      if (!result.canceled) {
        const chosen = result.assets ?? [];
        if (chosen.length > 10) {
          onMessage("Choose up to 10 photos or videos for one post.");
          return;
        }
        const tooLarge = chosen.find((asset) => (asset.fileSize ?? 0) > 50 * 1024 * 1024);
        if (tooLarge) {
          onMessage("Each photo or video must be under 50 MB.");
          return;
        }
        const hasVideo = chosen.some((asset) => asset.type === "video");
        const hasPhoto = chosen.some((asset) => asset.type === "image");
        if (hasVideo && hasPhoto) {
          onMessage("Choose photos or videos for a post, not both together.");
          return;
        }
        if (hasVideo && chosen.length > 1) {
          onMessage("Choose one video per post. You can select multiple photos.");
          return;
        }
        setAssets(chosen);
        if (hasVideo) setPostType("video");
        else if (chosen.length) {
          setPostType("photo");
          const chosenImages = chosen.filter((asset) => asset.type === "image");
          setPendingImageEdits(chosenImages);
          setEditingImageIndex(0);
          setShowImageAdjustment(chosenImages.length > 0);
        }
      }
    } catch {
      onMessage("Could not open your photo library. Please try again.");
    }
  };

  const uploadMedia = async (uploadedKeys: string[], signal: AbortSignal) => {
    if (!assets.length) return [];
    const uploaded: UploadedMemoryMedia[] = [];
    for (const [index, asset] of assets.entries()) {
      if (signal.aborted) throw new Error("Upload canceled.");
      setUploadProgress(`Uploading ${index + 1} of ${assets.length}…`);
      const name = asset.fileName?.replace(/[^a-zA-Z0-9._ -]/g, "_") || "memory-media";
      const uploadedAsset = await api.memories.uploadMedia(asset.uri, name, asset.mimeType, signal);
      uploaded.push(uploadedAsset);
      uploadedKeys.push(uploadedAsset.key);
    }
    return uploaded;
  };

  const moveAsset = (index: number, offset: -1 | 1) => {
    setAssets((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  };

  const submit = async () => {
    const cleanCaption = caption.trim();
    if (!cleanCaption && postType !== "photo" && postType !== "video") {
      onMessage(postType === "poll" ? "Add a question before sharing your poll." : "Add some text before sharing this post.");
      return;
    }
    if (!initial && (postType === "photo" || postType === "video") && assets.length === 0) {
      onMessage("Choose at least one photo or video.");
      return;
    }
    const cleanPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (postType === "poll" && cleanPollOptions.length < 2) {
      onMessage("A poll needs at least two answer choices.");
      return;
    }
    if (initial && !isPostEditable(initial.createdAt)) {
      onMessage("Posts can only be edited within 24 hours of publishing.");
      onClose();
      return;
    }
    setBusy(true);
    const uploadedKeys: string[] = [];
    try {
      if (initial) {
        await onSubmit({
          caption: cleanCaption,
          visibility,
          commentsEnabled,
        });
      } else {
        uploadController.current = new AbortController();
        const mediaAssets = await uploadMedia(uploadedKeys, uploadController.current.signal);
        uploadController.current = null;
        setUploadProgress("");
        await onSubmit({
          caption: cleanCaption,
          postType,
          mediaAssets: mediaAssets.map(({ key }) => ({ key })),
          pollOptions: postType === "poll" ? cleanPollOptions.slice(0, 4) : [],
          ...(postType === "poll" ? { pollDurationHours } : {}),
          visibility,
          commentsEnabled,
        });
      }
      onClose();
    } catch (error) {
      const originalMessage = error instanceof Error ? error.message : "Could not share this post.";
      uploadController.current = null;
      setUploadProgress("");
      if (uploadedKeys.length > 0) {
        try {
          await api.memories.cleanupUploads(uploadedKeys);
        } catch {
          onMessage(`${originalMessage} A temporary upload may remain; retry the post when your connection is available.`);
          return;
        }
      }
      onMessage(originalMessage);
    } finally {
      uploadController.current = null;
      setBusy(false);
      setUploadProgress("");
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Close composer" onPress={onClose} disabled={busy} style={styles.close}>
            <Ionicons name="close" size={23} color="#192238" />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.title}>{initial ? "Edit post" : "Create a post"}</Text>
            {initial ? (
              <Text style={{ fontSize: 11, color: "#7C3AED", fontFamily: "Inter_500Medium" }}>
                {formatEditTimeRemaining(initial.createdAt) ?? "24h edit window expired"}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={submit} disabled={busy} style={[styles.shareButton, busy && styles.disabled]}>
            <Text style={styles.shareText}>{busy ? uploadProgress || "Sharing…" : initial ? "Save" : "Publish"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {!initial ? (
            <View style={styles.creatorRow}>
              {profile?.photoURL
                ? <Image source={{ uri: profile.photoURL }} style={styles.creatorAvatar} />
                : <View style={styles.creatorAvatarFallback}><Text style={styles.creatorInitial}>{profile?.fullName?.slice(0, 1).toUpperCase() || "N"}</Text></View>}
              <View style={styles.creatorCopy}>
                <Text style={styles.creatorName}>{profile?.fullName || "Navodaya member"}</Text>
                <Text style={styles.creatorAudience}>{visibility === "public" ? "Everyone" : "Followers"}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.label}>{postType === "poll" ? "Ask your community" : "What would you like to share?"}</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Share a memory, achievement, event, or thought…"
            placeholderTextColor="#98A2B3"
            multiline
            maxLength={4000}
            textAlignVertical="top"
            style={styles.caption}
          />
          <Text style={styles.counter}>{caption.length}/4000</Text>

          {!initial && postType !== "poll" && (
            <View style={styles.mediaBlock}>
              <TouchableOpacity style={styles.mediaButton} onPress={chooseMedia}>
                <Ionicons name="images-outline" size={20} color="#7C3AED" />
                <Text style={styles.mediaButtonText}>{assets.length ? "Add or replace media" : "Add photos or video (optional)"}</Text>
              </TouchableOpacity>
              {assets.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                  {assets.map((asset, index) => (
                    <View key={`${asset.uri}-${index}`} style={styles.previewWrap}>
                      {asset.type === "video" ? (
                        <View style={styles.videoPreview}><Ionicons name="play-circle" size={30} color="#fff" /></View>
                      ) : (
                        <Image source={{ uri: asset.uri }} style={styles.previewImage} />
                      )}
                      <TouchableOpacity
                        style={styles.removeMedia}
                        onPress={() => setAssets((previous) => {
                          const next = previous.filter((_, itemIndex) => itemIndex !== index);
                          if (next.length === 0) setPostType("text");
                          return next;
                        })}
                        accessibilityLabel="Remove attachment"
                      >
                        <Ionicons name="close" size={13} color="#fff" />
                      </TouchableOpacity>
                      {assets.length > 1 ? (
                        <View style={styles.reorderControls}>
                          <TouchableOpacity onPress={() => moveAsset(index, -1)} disabled={index === 0} accessibilityLabel="Move media left">
                            <Ionicons name="chevron-back-circle" size={21} color={index === 0 ? "#CBD5E1" : "#6D28D9"} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => moveAsset(index, 1)} disabled={index === assets.length - 1} accessibilityLabel="Move media right">
                            <Ionicons name="chevron-forward-circle" size={21} color={index === assets.length - 1 ? "#CBD5E1" : "#6D28D9"} />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              )}
              <Text style={styles.helper}>Choose up to 10 photos or one video, under 50 MB each. Photos can be cropped and reordered.</Text>
              {busy && uploadProgress ? (
                <TouchableOpacity style={styles.cancelUpload} onPress={() => uploadController.current?.abort()}>
                  <Ionicons name="close-circle-outline" size={16} color="#B42318" />
                  <Text style={styles.cancelUploadText}>Cancel upload</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {!initial && postType === "poll" && (
            <View style={styles.pollBlock}>
              <Text style={styles.label}>Answer choices</Text>
              {pollOptions.map((option, index) => (
                <View key={index} style={styles.pollInputRow}>
                  <TextInput
                    style={styles.pollInput}
                    value={option}
                    onChangeText={(text) => setPollOptions((previous) => previous.map((value, itemIndex) => itemIndex === index ? text : value))}
                    placeholder={`Choice ${index + 1}`}
                    placeholderTextColor="#98A2B3"
                    maxLength={100}
                  />
                  {index > 1 && (
                    <TouchableOpacity onPress={() => setPollOptions((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>
                      <Ionicons name="remove-circle-outline" size={22} color="#A1AABA" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < 4 && (
                <TouchableOpacity style={styles.addChoice} onPress={() => setPollOptions((previous) => [...previous, ""])}>
                  <Ionicons name="add-circle-outline" size={17} color="#7C3AED" />
                  <Text style={styles.addChoiceText}>Add choice</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.label}>Poll duration</Text>
              <View style={styles.durationRow}>
                {([
                  [24, "1 day"],
                  [72, "3 days"],
                  [168, "7 days"],
                  [336, "14 days"],
                ] as const).map(([hours, label]) => (
                  <TouchableOpacity
                    key={hours}
                    style={[styles.durationChoice, pollDurationHours === hours && styles.durationChoiceActive]}
                    onPress={() => setPollDurationHours(hours)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: pollDurationHours === hours }}
                  >
                    <Text style={[styles.durationText, pollDurationHours === hours && styles.durationTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.label}>Who can see this post?</Text>
          <View style={styles.visibilityRow}>
            {([
              { value: "public", label: "Everyone", icon: "earth-outline" },
              { value: "followers", label: "Followers", icon: "people-outline" },
            ] as const).map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setVisibility(option.value)}
                style={[styles.visibilityChoice, visibility === option.value && styles.visibilityChoiceActive]}
              >
                <Ionicons name={option.icon} size={16} color={visibility === option.value ? "#7C3AED" : "#6B778C"} />
                <Text style={[styles.visibilityText, visibility === option.value && styles.visibilityTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.commentsToggle} onPress={() => setCommentsEnabled((value) => !value)}>
            <Ionicons name={commentsEnabled ? "chatbubbles-outline" : "chatbubble-ellipses-outline"} size={17} color="#53627a" />
            <Text style={styles.commentsText}>Allow comments</Text>
            <View style={[styles.switch, commentsEnabled && styles.switchOn]}>
              <View style={[styles.switchThumb, commentsEnabled && styles.switchThumbOn]} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <ImageAdjustmentModal
      visible={showImageAdjustment}
      asset={pendingImageEdits[editingImageIndex] ?? null}
      title={pendingImageEdits.length > 1 ? `Adjust photo ${editingImageIndex + 1} of ${pendingImageEdits.length}` : "Adjust post photo"}
      onCancel={() => {
        setShowImageAdjustment(false);
        setPendingImageEdits([]);
        setEditingImageIndex(0);
        setAssets([]);
      }}
      onDone={(adjustedAsset) => {
        const source = pendingImageEdits[editingImageIndex];
        setAssets((previous) => previous.map((asset) => asset.uri === source?.uri ? adjustedAsset : asset));
        if (editingImageIndex + 1 < pendingImageEdits.length) setEditingImageIndex((current) => current + 1);
        else {
          setShowImageAdjustment(false);
          setPendingImageEdits([]);
          setEditingImageIndex(0);
        }
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#F7F8FC" },
  header: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E9EDF4" },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F3F8", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#192238" },
  shareButton: { minWidth: 62, alignItems: "center", backgroundColor: "#7C3AED", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  shareText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.6 },
  body: { padding: 20, paddingBottom: 48 },
  label: { color: "#29344A", fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 10, marginTop: 18 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#E9E5F0" },
  creatorAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EDE9FE" },
  creatorAvatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" },
  creatorInitial: { color: "#6D28D9", fontSize: 16, fontFamily: "Inter_700Bold" },
  creatorCopy: { gap: 3 },
  creatorName: { color: "#211B45", fontSize: 13, fontFamily: "Inter_700Bold" },
  creatorAudience: { color: "#64748B", fontSize: 11, fontFamily: "Inter_500Medium" },
  caption: { minHeight: 124, padding: 14, borderWidth: 1, borderColor: "#E0E5EF", borderRadius: 14, backgroundColor: "#fff", color: "#192238", fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  counter: { textAlign: "right", color: "#98A2B3", fontSize: 11, marginTop: 6 },
  mediaBlock: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E0E5EF", backgroundColor: "#fff" },
  mediaButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1, borderStyle: "dashed", borderColor: "#C4B5FD", borderRadius: 12, backgroundColor: "#FAF8FF" },
  mediaButtonText: { color: "#6D28D9", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  previewRow: { gap: 9, paddingTop: 12 },
  previewWrap: { position: "relative", paddingBottom: 25 },
  previewImage: { width: 78, height: 78, borderRadius: 10, backgroundColor: "#E8ECF4" },
  videoPreview: { width: 78, height: 78, borderRadius: 10, backgroundColor: "#263556", alignItems: "center", justifyContent: "center" },
  removeMedia: { position: "absolute", right: -5, top: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: "#18233A", alignItems: "center", justifyContent: "center" },
  reorderControls: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between" },
  helper: { color: "#8490A4", fontSize: 11, lineHeight: 16, marginTop: 10 },
  cancelUpload: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 12 },
  cancelUploadText: { color: "#B42318", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pollBlock: { marginTop: 4 },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationChoice: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0E5EF" },
  durationChoiceActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  durationText: { color: "#64748B", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  durationTextActive: { color: "#FFFFFF" },
  pollInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  pollInput: { flex: 1, minHeight: 46, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: "#E0E5EF", backgroundColor: "#fff", color: "#192238", fontFamily: "Inter_400Regular", fontSize: 13 },
  addChoice: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  addChoiceText: { color: "#6D28D9", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  visibilityRow: { flexDirection: "row", gap: 10 },
  visibilityChoice: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, borderWidth: 1, borderColor: "#E0E5EF", borderRadius: 12, backgroundColor: "#fff" },
  visibilityChoiceActive: { borderColor: "#AAB9EE", backgroundColor: "#F4F6FF" },
  visibilityText: { color: "#6B778C", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  visibilityTextActive: { color: "#6D28D9" },
  commentsToggle: { marginTop: 18, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E0E5EF" },
  commentsText: { flex: 1, color: "#39465F", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  switch: { width: 39, height: 23, padding: 3, borderRadius: 12, backgroundColor: "#D6DCE7", justifyContent: "center" },
  switchOn: { backgroundColor: "#7C3AED" },
  switchThumb: { width: 17, height: 17, borderRadius: 9, backgroundColor: "#fff" },
  switchThumbOn: { alignSelf: "flex-end" },
});
