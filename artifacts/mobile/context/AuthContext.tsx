import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { api, getToken, setToken, clearToken } from "@/lib/api";
import type { UserProfile, SignupData } from "@/lib/api";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { firebaseAuth } from "@/lib/firebase";

export type { UserProfile };
export type UserRole = "student" | "alumni" | "teacher" | "official";

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  isVerified: boolean;
  signUp: (email: string, password: string, profileData: Omit<SignupData, "email" | "password">) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      try {
        const token = await getToken();
        if (token) {
          const { profile: p } = await api.auth.me();
          if (!cancelled) setProfile(p);
        } else if (firebaseUser) {
          const response = await api.auth.firebase(await firebaseUser.getIdToken());
          await setToken(response.token);
          if (!cancelled) setProfile(response.profile);
        }
      } catch {
        await clearToken();
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
    const response = await api.auth.firebase(await firebaseUser.getIdToken(), profileData);
    await setToken(response.token);
    setProfile(response.profile);
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
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    try {
      await syncFirebaseUser(credential.user, profileData);
    } catch (error) {
      await deleteUser(credential.user).catch(() => {});
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("Please enter a valid email address.");
    }
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await syncFirebaseUser(credential.user);
    } catch (firebaseError: any) {
      if (firebaseError?.code === "auth/user-not-found" || firebaseError?.code === "auth/invalid-credential") {
        const { token, profile: p } = await api.auth.signin(email.trim(), password);
        await setToken(token);
        setProfile(p);
      } else {
        throw firebaseError;
      }
    }
  };

  const signInWithGoogle = async () => {
    if (Platform.OS !== "web") {
      throw new Error("Google sign-in requires a configured native OAuth client for this build.");
    }
    const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    await syncFirebaseUser(credential.user);
  };

  const signInWithApple = async () => {
    if (Platform.OS === "web") {
      const credential = await signInWithPopup(firebaseAuth, new OAuthProvider("apple.com"));
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
    const signedIn = await signInWithCredential(firebaseAuth, credential);
    await syncFirebaseUser(signedIn.user);
  };

  const forgotPassword = async (email: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("Please enter a valid email address.");
    }
    await sendPasswordResetEmail(firebaseAuth, email.trim());
  };

  const signOut = async () => {
    try { await api.auth.signout(); } catch {}
    await clearToken();
    await firebaseSignOut(firebaseAuth).catch(() => {});
    setProfile(null);
  };

  const refreshProfile = async () => {
    try {
      const { profile: p } = await api.auth.me();
      setProfile(p);
    } catch {}
  };

  const user = profile ? { uid: profile.uid } : null;
  const isVerified = profile?.role === "official" || profile?.verificationStatus === "verified";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isVerified, signUp, signIn, signInWithGoogle, signInWithApple, forgotPassword, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
