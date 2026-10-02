import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { api, getToken, setToken, clearToken } from "@/lib/api";
import type { UserProfile, SignupData } from "@/lib/api";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { firebaseAuth, requireFirebaseAuth } from "@/lib/firebase";

export type { UserProfile };
export type UserRole = "student" | "alumni" | "teacher" | "official";

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  pendingProfile: { email: string; fullName: string } | null;
  loading: boolean;
  isVerified: boolean;
  signUp: (email: string, password: string, profileData: Omit<SignupData, "email" | "password">) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  completeProfile: (profileData: Omit<SignupData, "email" | "password">) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isProfileRequired(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PROFILE_REQUIRED"
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingFirebaseUser, setPendingFirebaseUser] = useState<import("firebase/auth").User | null>(null);
  const [loading, setLoading] = useState(true);
  const manualAuthSync = useRef(false);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (manualAuthSync.current) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        let token = await getToken();
        if (token) {
          try {
            const { profile: currentProfile } = await api.auth.me();
            if (!cancelled) setProfile(currentProfile);
            return;
          } catch {
            await clearToken();
            token = null;
          }
        }

        if (!token && firebaseUser) {
          try {
            await syncFirebaseUser(firebaseUser);
          } catch (error) {
            if (isProfileRequired(error)) {
              if (!cancelled) setPendingFirebaseUser(firebaseUser);
            } else {
              throw error;
            }
          }
        } else if (!firebaseUser && !cancelled) {
          setProfile(null);
        }
      } catch {
        await clearToken();
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const syncFirebaseUser = async (
    firebaseUser: import("firebase/auth").User,
    profileData?: Omit<SignupData, "email" | "password">,
  ) => {
    try {
      const response = await api.auth.firebase(await firebaseUser.getIdToken(), profileData);
      await setToken(response.token);
      setProfile(response.profile);
      setPendingFirebaseUser(null);
    } catch (error) {
      if (isProfileRequired(error)) setPendingFirebaseUser(firebaseUser);
      throw error;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profileData: Omit<SignupData, "email" | "password">
  ) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("Please enter a valid email address.");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const auth = requireFirebaseAuth();
    manualAuthSync.current = true;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const currentFirebaseUser = pendingFirebaseUser ?? auth.currentUser;
      const firebaseUser = currentFirebaseUser?.email?.toLowerCase() === normalizedEmail
        ? currentFirebaseUser
        : (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
      setPendingFirebaseUser(firebaseUser);
      await syncFirebaseUser(firebaseUser, profileData);
    } catch (error) {
      throw error;
    } finally {
      manualAuthSync.current = false;
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("Please enter a valid email address.");
    }
    const auth = requireFirebaseAuth();
    manualAuthSync.current = true;
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await syncFirebaseUser(credential.user);
    } catch (firebaseError: any) {
      if (firebaseError?.code === "auth/user-not-found" || firebaseError?.code === "auth/invalid-credential") {
        const { token, profile: p } = await api.auth.signin(email.trim(), password);
        await setToken(token);
        setProfile(p);
      } else {
        throw firebaseError;
      }
    } finally {
      manualAuthSync.current = false;
    }
  };

  const signInWithGoogle = async () => {
    if (Platform.OS !== "web") {
      throw new Error("Google sign-in requires a configured native OAuth client for this build.");
    }
    const auth = requireFirebaseAuth();
    manualAuthSync.current = true;
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      await syncFirebaseUser(credential.user);
    } finally {
      manualAuthSync.current = false;
    }
  };

  const signInWithFacebook = async () => {
    if (Platform.OS !== "web") {
      throw new Error("Facebook sign-in is currently available in the web build.");
    }
    const auth = requireFirebaseAuth();
    manualAuthSync.current = true;
    try {
      const credential = await signInWithPopup(auth, new FacebookAuthProvider());
      await syncFirebaseUser(credential.user);
    } finally {
      manualAuthSync.current = false;
    }
  };

  const signInWithApple = async () => {
    const auth = requireFirebaseAuth();
    if (Platform.OS === "web") {
      const credential = await signInWithPopup(auth, new OAuthProvider("apple.com"));
      await syncFirebaseUser(credential.user);
      return;
    }

    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) throw new Error("Sign in with Apple is not available on this device.");
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!result.identityToken) throw new Error("Apple sign-in did not return a secure identity token.");
    const credential = new OAuthProvider("apple.com").credential({
      idToken: result.identityToken,
    });
    const signedIn = await signInWithCredential(auth, credential);
    await syncFirebaseUser(signedIn.user);
  };

  const completeProfile = async (
    profileData: Omit<SignupData, "email" | "password">,
  ) => {
    if (!pendingFirebaseUser) {
      throw new Error("Your sign-in session expired. Sign in again to complete your profile.");
    }
    manualAuthSync.current = true;
    try {
      await syncFirebaseUser(pendingFirebaseUser, profileData);
    } finally {
      manualAuthSync.current = false;
    }
  };

  const forgotPassword = async (email: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("Please enter a valid email address.");
    }
    await sendPasswordResetEmail(requireFirebaseAuth(), email.trim());
  };

  const signOut = async () => {
    try { await api.auth.signout(); } catch {}
    await clearToken();
    if (firebaseAuth) await firebaseSignOut(firebaseAuth).catch(() => {});
    setProfile(null);
  };

  const refreshProfile = async () => {
    try {
      const { profile: p } = await api.auth.me();
      setProfile(p);
    } catch {}
  };

  const user = profile ? { uid: profile.uid } : null;
  const pendingProfile = pendingFirebaseUser
    ? { email: pendingFirebaseUser.email ?? "", fullName: pendingFirebaseUser.displayName ?? "" }
    : null;
  const isVerified = profile?.role === "official" || profile?.verificationStatus === "verified";

  return (
    <AuthContext.Provider value={{ user, profile, pendingProfile, loading, isVerified, signUp, signIn, signInWithGoogle, signInWithFacebook, signInWithApple, completeProfile, forgotPassword, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
