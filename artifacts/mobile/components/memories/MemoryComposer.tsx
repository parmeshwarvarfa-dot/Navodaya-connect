import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import type { CreateMemoryRequest, SocialMemory } from "@workspace/api-client-react";
import { firebaseApp } from "@/lib/firebase";

type Visibility = "public" | "followers";
type PostType = NonNullable<CreateMemoryRequest["postType"]>;

const POST_TYPES: { value: PostType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "text", label: "Post", icon: "chatbubble-outline" },
  { value: "photo", label: "Photo", icon: "image-outline" },
  { value: "video", label: "Video", icon: "videocam-outline" },
  { value: "poll", label: "Poll", icon: "stats-chart-outline" },
  { value: "achievement", label: "Achievement", icon: "trophy-outline" },
  { value: "event", label: "Event", icon: "calendar-outline" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMemoryRequest) => Promise<void>;
  initial?: SocialMemory | null;
  onMessage: (message: string) => void;
};

export default function MemoryComposer({ visible, onClose, onSubmit, initial, onMessage }: Props) {
  const [postType, setPostType] = useState<PostType>("text");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPostType((initial?.postType as PostType) || "text");
    setCaption(initial?.caption ?? "");
    setVisibility((initial?.visibility as Visibility) === "followers" ? "followers" : "public");
    setCommentsEnabled(initial?.commentsEnabled ?? true);
    setPollOptions(["", ""]);
    setAssets([]);
  }, [visible, initial?.id]);

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
        const tooLarge = chosen.find((asset) => (asset.fileSize ?? 0) > 100 * 1024 * 1024);
        if (tooLarge) {
          onMessage("Each photo or video must be under 100 MB.");
          return;
        }
        const hasVideo = chosen.some((asset) => asset.type === "video");
        const hasPhoto = chosen.some((asset) => asset.type === "image");
        if (hasVideo && hasPhoto) {
          onMessage("Choose photos or videos for a post, not both together.");
          return;
        }
        setAssets(chosen);
        if (hasVideo) setPostType("video");
        else if (chosen.length) setPostType("photo");
      }
    } catch {
      onMessage("Could not open your photo library. Please try again.");
    }
  };

  const selectPostType = (type: PostType) => {
    if (type !== postType && assets.length > 0) {
      setAssets([]);
    }
    setPostType(type);
  };

  const uploadMedia = async () => {
    if (!assets.length) return [];
    if (!firebaseApp?.options.storageBucket) {
      throw new Error("Photo and video posts need Firebase Storage. Set EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET in .env and restart Expo.");
    }
    const storage = getStorage(firebaseApp);
    const uploaded: string[] = [];
    for (const asset of assets) {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error("Could not read the selected media file.");
      const blob = await response.blob();
      const name = asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") || `upload-${Date.now()}`;
      const path = `memories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob, asset.mimeType ? { contentType: asset.mimeType } : undefined);
      uploaded.push(await getDownloadURL(storageRef));
    }
    return uploaded;
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
    setBusy(true);
    try {
      if (initial) {
        await onSubmit({
          caption: cleanCaption,
          visibility,
          commentsEnabled,
        });
      } else {
        const mediaUrls = await uploadMedia();
        await onSubmit({
          caption: cleanCaption,
          postType,
          mediaUrls,
          pollOptions: postType === "poll" ? cleanPollOptions.slice(0, 4) : [],
          visibility,
          commentsEnabled,
        });
      }
      onClose();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not share this post.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Close composer" onPress={onClose} disabled={busy} style={styles.close}>
            <Ionicons name="close" size={23} color="#192238" />
          </TouchableOpacity>
          <Text style={styles.title}>{initial ? "Edit post" : "Create a post"}</Text>
          <TouchableOpacity onPress={submit} disabled={busy} style={[styles.shareButton, busy && styles.disabled]}>
            <Text style={styles.shareText}>{busy ? "Sharing…" : initial ? "Save" : "Share"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {!initial && (
            <>
              <Text style={styles.label}>Post type</Text>
              <View style={styles.typeGrid}>
                {POST_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.typeChoice, postType === type.value && styles.typeChoiceActive]}
                    onPress={() => selectPostType(type.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: postType === type.value }}
                  >
                    <Ionicons name={type.icon} size={16} color={postType === type.value ? "#fff" : "#53627a"} />
                    <Text style={[styles.typeText, postType === type.value && styles.typeTextActive]}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

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

          {!initial && (postType === "photo" || postType === "video") && (
            <View style={styles.mediaBlock}>
              <TouchableOpacity style={styles.mediaButton} onPress={chooseMedia}>
                <Ionicons name="images-outline" size={20} color="#355BE5" />
                <Text style={styles.mediaButtonText}>{assets.length ? "Change media" : "Choose photos or video"}</Text>
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
                        onPress={() => setAssets((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                        accessibilityLabel="Remove attachment"
                      >
                        <Ionicons name="close" size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              <Text style={styles.helper}>Photos and videos are uploaded to this app’s existing Firebase Storage bucket.</Text>
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
                  <Ionicons name="add-circle-outline" size={17} color="#355BE5" />
                  <Text style={styles.addChoiceText}>Add choice</Text>
                </TouchableOpacity>
              )}
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
                <Ionicons name={option.icon} size={16} color={visibility === option.value ? "#355BE5" : "#6B778C"} />
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
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#F7F8FC" },
  header: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E9EDF4" },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F3F8", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#192238" },
  shareButton: { minWidth: 62, alignItems: "center", backgroundColor: "#355BE5", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  shareText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.6 },
  body: { padding: 20, paddingBottom: 48 },
  label: { color: "#29344A", fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 10, marginTop: 18 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChoice: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E0E5EF" },
  typeChoiceActive: { backgroundColor: "#355BE5", borderColor: "#355BE5" },
  typeText: { color: "#53627a", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  typeTextActive: { color: "#fff" },
  caption: { minHeight: 124, padding: 14, borderWidth: 1, borderColor: "#E0E5EF", borderRadius: 14, backgroundColor: "#fff", color: "#192238", fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  counter: { textAlign: "right", color: "#98A2B3", fontSize: 11, marginTop: 6 },
  mediaBlock: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E0E5EF", backgroundColor: "#fff" },
  mediaButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1, borderStyle: "dashed", borderColor: "#AAB9EE", borderRadius: 12, backgroundColor: "#F7F8FF" },
  mediaButtonText: { color: "#355BE5", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  previewRow: { gap: 9, paddingTop: 12 },
  previewWrap: { position: "relative" },
  previewImage: { width: 78, height: 78, borderRadius: 10, backgroundColor: "#E8ECF4" },
  videoPreview: { width: 78, height: 78, borderRadius: 10, backgroundColor: "#263556", alignItems: "center", justifyContent: "center" },
  removeMedia: { position: "absolute", right: -5, top: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: "#18233A", alignItems: "center", justifyContent: "center" },
  helper: { color: "#8490A4", fontSize: 11, lineHeight: 16, marginTop: 10 },
  pollBlock: { marginTop: 4 },
  pollInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  pollInput: { flex: 1, minHeight: 46, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: "#E0E5EF", backgroundColor: "#fff", color: "#192238", fontFamily: "Inter_400Regular", fontSize: 13 },
  addChoice: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  addChoiceText: { color: "#355BE5", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  visibilityRow: { flexDirection: "row", gap: 10 },
  visibilityChoice: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, borderWidth: 1, borderColor: "#E0E5EF", borderRadius: 12, backgroundColor: "#fff" },
  visibilityChoiceActive: { borderColor: "#AAB9EE", backgroundColor: "#F4F6FF" },
  visibilityText: { color: "#6B778C", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  visibilityTextActive: { color: "#355BE5" },
  commentsToggle: { marginTop: 18, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E0E5EF" },
  commentsText: { flex: 1, color: "#39465F", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  switch: { width: 39, height: 23, padding: 3, borderRadius: 12, backgroundColor: "#D6DCE7", justifyContent: "center" },
  switchOn: { backgroundColor: "#355BE5" },
  switchThumb: { width: 17, height: 17, borderRadius: 9, backgroundColor: "#fff" },
  switchThumbOn: { alignSelf: "flex-end" },
});
