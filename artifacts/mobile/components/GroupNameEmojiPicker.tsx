import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const GROUP_NAME_EMOJIS = [
  "😀", "😎", "😍", "🤩", "🎉", "✨", "⭐", "🌟",
  "🎓", "📚", "🧪", "🔬", "💻", "🧠", "💡", "🎯",
  "🏆", "🏫", "💬", "⚽", "🎨", "🎵", "🚀", "🔥", "❤️",
];

export default function GroupNameEmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={open ? "Hide group name emojis" : "Add emoji to group name"}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.toggleEmoji}>😀</Text>
        <Text style={styles.toggleText}>{open ? "Hide emojis" : "Add emoji to name"}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color="#3D5AF1" />
      </TouchableOpacity>
      {open && (
        <View style={styles.emojiGrid}>
          {GROUP_NAME_EMOJIS.map((emoji, index) => (
            <TouchableOpacity
              key={`${emoji}-${index}`}
              style={styles.emojiButton}
              onPress={() => onSelect(emoji)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${emoji} to group name`}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: -5, marginBottom: 12 },
  toggle: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingVertical: 4 },
  toggleEmoji: { fontSize: 17 },
  toggleText: { color: "#3D5AF1", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6, padding: 8, borderRadius: 12, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB" },
  emojiButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#FFFFFF" },
  emoji: { fontSize: 21 },
});
