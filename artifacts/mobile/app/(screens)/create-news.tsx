import { router } from "expo-router";
import { useEffect } from "react";

export default function CreateNews() {
  useEffect(() => { router.replace("/(screens)/news" as any); }, []);
  return null;
}
