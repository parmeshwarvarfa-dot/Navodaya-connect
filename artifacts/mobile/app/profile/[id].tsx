import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function SharedProfileLink() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  useEffect(() => {
    if (!id || !USER_ID.test(id)) {
      router.replace("/(tabs)" as any);
      return;
    }
    router.replace({ pathname: "/(screens)/user-profile" as any, params: { userId: id } });
  }, [id]);
  return <View style={styles.page}><ActivityIndicator color="#355BE5" /></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F6FA" } });
