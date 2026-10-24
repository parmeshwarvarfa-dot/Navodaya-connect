import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const avatarConfigSchema = z.object({
  version: z.literal(1),
  presetId: z.string().max(64).optional(),
  skinTone: hexColor,
  faceShape: z.enum(["oval", "round", "square"]),
  hairStyle: z.enum(["short", "side-part", "curly", "long", "bun", "fade", "ponytail", "wavy", "bob", "braids", "hijab", "buzz", "locs"]),
  hairColor: hexColor,
  eyeStyle: z.enum(["almond", "round", "soft"]).default("almond"),
  eyeColor: hexColor,
  eyebrowStyle: z.enum(["natural", "bold", "arched"]),
  facialHair: z.enum(["none", "stubble", "short-beard", "full-beard", "mustache"]).default("none"),
  mouthStyle: z.enum(["smile", "subtle", "open"]).default("smile"),
  outfit: z.enum(["tee", "hoodie", "jacket", "school", "blazer", "kurta", "saree", "sweater"]),
  outfitColor: hexColor,
  accessory: z.enum(["none", "glasses", "cap"]),
  accessoryColor: hexColor,
});

export type AvatarConfig = z.infer<typeof avatarConfigSchema>;
