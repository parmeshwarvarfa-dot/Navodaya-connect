import type { AvatarConfig } from "@workspace/api-zod";
import { REFERENCE_AVATAR_IMAGE_URIS } from "./referenceAvatarAssets";

const BASE_CONFIG: Omit<AvatarConfig, "presetId"> = {
  version: 1,
  skinTone: "#D99B72",
  faceShape: "oval",
  hairStyle: "short",
  hairColor: "#30251F",
  eyeStyle: "almond",
  eyeColor: "#3B2B22",
  eyebrowStyle: "natural",
  facialHair: "none",
  mouthStyle: "smile",
  outfit: "hoodie",
  outfitColor: "#3D5AF1",
  accessory: "none",
  accessoryColor: "#1F2937",
};

type AvatarMetadata = {
  id: string;
  name: string;
};

const AVATAR_METADATA: AvatarMetadata[] = Array.from({ length: 12 }, (_, index) => ({
  id: `reference-avatar-${String(index + 1).padStart(2, "0")}`,
  name: `Portrait ${String(index + 1).padStart(2, "0")}`,
}));

export type AvatarPreset = AvatarMetadata & { imageUri: string; config: AvatarConfig };

export const AVATAR_PRESETS: AvatarPreset[] = AVATAR_METADATA.map((avatar, index) => ({
  ...avatar,
  imageUri: REFERENCE_AVATAR_IMAGE_URIS[index],
  config: { ...BASE_CONFIG, presetId: avatar.id },
}));

export const DEFAULT_AVATAR_CONFIG = AVATAR_PRESETS[0].config;
