import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getListMemoryCommentsQueryKey,
  useCreateMemoryComment,
  useListMemoryComments,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { SocialMemory } from "@workspace/api-client-react";

type Props = {
  visible: boolean;
  memory: SocialMemory | null;
  onClose: () => void;
  onMessage: (message: string) => void;
};

export default function MemoryCommentsSheet({ visible, memory, onClose, onMessage }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const query = useListMemoryComments(memory?.id ?? "", {
    query: {
      enabled: visible && !!memory,
      queryKey: getListMemoryCommentsQueryKey(memory?.id ?? ""),
    },
  });
  const createComment = useCreateMemoryComment();

  useEffect(() => {
    if (!visible) {
      setText("");
      setReplyTo(null);
    }
  }, [visible]);

  const submit = async () => {
    const content = text.trim();
    if (!memory || !content) return;
    try {
      await createComment.mutateAsync({
        id: memory.id,
        data: { content, ...(replyTo ? { parentId: replyTo.id } : {}) },
      });
      setText("");
      setReplyTo(null);
      await queryClient.invalidateQueries({ queryKey: getListMemoryCommentsQueryKey(memory.id) });
      await queryClient.invalidateQueries({ queryKey: ["/api/memories"] });
      onMessage("Comment added.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not add your comment.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Comments</Text>
          <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Close comments">
            <Ionicons name="close" size={22} color="#27334B" />
          </TouchableOpacity>
        </View>
        {!memory?.commentsEnabled ? (
          <View style={styles.disabledState}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#8792A5" />
            <Text style={styles.disabledText}>Comments are turned off for this post.</Text>
          </View>
        ) : (
          <>
            {query.isLoading ? (
              <View style={styles.center}><Text style={styles.muted}>Loading comments…</Text></View>
            ) : query.isError ? (
              <View style={styles.center}>
                <Text style={styles.muted}>Comments could not be loaded.</Text>
                <TouchableOpacity onPress={() => query.refetch()}><Text style={styles.retry}>Try again</Text></TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={query.data ?? []}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.empty}>Start the conversation.</Text>}
                renderItem={({ item }) => (
                  <View style={[styles.commentRow, item.parentId && styles.replyRow]}>
                    {item.authorPhotoUrl ? (
                      <Image source={{ uri: item.authorPhotoUrl }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitial}>{(item.authorName || "J").charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.commentContent}>
                      <View style={styles.commentBubble}>
                        <Text style={styles.author}>{item.authorName || "JNV member"}</Text>
                        <Text style={styles.commentText}>{item.content}</Text>
                      </View>
                      <View style={styles.commentMeta}>
                        <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                        {!item.parentId && (
                          <TouchableOpacity onPress={() => setReplyTo({ id: item.id, name: item.authorName })}>
                            <Text style={styles.replyAction}>Reply</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={styles.composer}>
              {replyTo && (
                <View style={styles.replyBanner}>
                  <Text style={styles.replyBannerText}>Replying to {replyTo.name}</Text>
                  <TouchableOpacity onPress={() => setReplyTo(null)} accessibilityLabel="Cancel reply">
                    <Ionicons name="close" size={17} color="#66748C" />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.inputRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
                  placeholderTextColor="#98A2B3"
                  maxLength={2000}
                  multiline
                  style={styles.input}
                />
                <TouchableOpacity
                  style={[styles.send, (!text.trim() || createComment.isPending) && styles.sendDisabled]}
                  disabled={!text.trim() || createComment.isPending}
                  onPress={submit}
                  accessibilityLabel="Send comment"
                >
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#fff" },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#EDF0F5" },
  title: { color: "#1E2940", fontSize: 17, fontFamily: "Inter_700Bold" },
  close: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#F2F4F8" },
  list: { padding: 16, paddingBottom: 30, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  muted: { color: "#8792A5", fontSize: 13, fontFamily: "Inter_400Regular" },
  retry: { color: "#355BE5", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { color: "#8792A5", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 50 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 14 },
  replyRow: { marginLeft: 42 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EDF0F7" },
  avatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E8EDFF", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#355BE5", fontSize: 13, fontFamily: "Inter_700Bold" },
  commentContent: { flex: 1 },
  commentBubble: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, backgroundColor: "#F3F5F9" },
  author: { color: "#29354A", fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 4 },
  commentText: { color: "#3F4A60", fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" },
  commentMeta: { flexDirection: "row", gap: 13, paddingHorizontal: 8, paddingTop: 5 },
  time: { color: "#98A2B3", fontSize: 10, fontFamily: "Inter_400Regular" },
  replyAction: { color: "#6E7B91", fontSize: 10, fontFamily: "Inter_700Bold" },
  composer: { borderTopWidth: 1, borderTopColor: "#EDF0F5", padding: 12 },
  replyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F4F6FC", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, marginBottom: 8 },
  replyBannerText: { color: "#66748C", fontSize: 11, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, maxHeight: 100, minHeight: 42, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 10, borderRadius: 22, backgroundColor: "#F1F3F8", color: "#1E2940", fontSize: 13, fontFamily: "Inter_400Regular" },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#355BE5", alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.45 },
  disabledState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  disabledText: { color: "#8792A5", fontSize: 13, fontFamily: "Inter_500Medium" },
});
