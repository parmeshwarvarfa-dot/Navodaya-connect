import type { AvatarConfig } from "@workspace/api-zod";

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: "student" | "alumni" | "teacher" | "official";
  jnvState: string;
  jnvName: string;
  jnvId?: string;
  profileVisibility?: "public" | "private";
  house: "Aravali" | "Nilgiri" | "Shivalik" | "Udaygiri";
  photoURL?: string;
  avatarConfig?: AvatarConfig;
  avatarThumbnailURL?: string;
  uploadedPhotoURL?: string;
  profileImageType?: "photo" | "avatar" | "default";
  class?: string;
  enrollYear?: string;
  passoutYear?: string;
  profession?: string;
  field?: string;
  company?: string;
  skills?: string[];
  verificationStatus?: "unverified" | "pending" | "verified";
  subject?: string;
  designation?: string;
}
