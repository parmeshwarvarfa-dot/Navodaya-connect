import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

export default function CommunityScreen() {
  useEffect(() => {
    router.replace({ pathname: "/(tabs)/chats", params: { filter: "groups" } } as any);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#7C3AED" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F7FF" },
});
