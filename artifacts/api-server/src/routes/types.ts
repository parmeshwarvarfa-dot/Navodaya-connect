export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: "student" | "alumni" | "teacher" | "official";
  jnvState: string;
  jnvName: string;
  house: "Aravali" | "Nilgiri" | "Shivalik" | "Udaygiri";
  photoURL?: string;
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
