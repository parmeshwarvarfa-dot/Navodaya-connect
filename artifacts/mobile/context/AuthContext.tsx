import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "student" | "alumni" | "teacher" | "official";

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  jnvState: string;
  jnvName: string;
  house: "Aravali" | "Nilgiri" | "Shivalik" | "Udaygiri";
  photoURL?: string;
  createdAt?: any;
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

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    profileData: Omit<UserProfile, "uid" | "createdAt">
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    } catch (e) {
      // Firestore read failed silently — user may not have a profile yet
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signUp = async (
    email: string,
    password: string,
    profileData: Omit<UserProfile, "uid" | "createdAt">
  ) => {
    // Step 1: Create the Firebase Auth account
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const fullProfile: UserProfile = {
      ...profileData,
      uid,
      createdAt: serverTimestamp(),
      verificationStatus:
        profileData.role === "alumni" ? "unverified" : undefined,
    };

    // Step 2: Write to Firestore (best-effort — don't block sign-up if this fails)
    try {
      await setDoc(doc(db, "users", uid), fullProfile);
      setProfile(fullProfile);
    } catch (firestoreError) {
      // Auth succeeded; Firestore write failed (likely security rules).
      // User is logged in but profile may be missing — set local state anyway.
      console.warn("Firestore profile write failed:", firestoreError);
      setProfile(fullProfile);
    }
  };

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(cred.user.uid);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
