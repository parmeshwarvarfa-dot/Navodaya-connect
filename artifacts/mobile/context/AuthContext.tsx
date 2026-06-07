import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken } from "@/lib/api";
import type { UserProfile, SignupData } from "@/lib/api";

export type { UserProfile };
export type UserRole = "student" | "alumni" | "teacher" | "official";

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  isVerified: boolean;
  signUp: (email: string, password: string, profileData: Omit<SignupData, "email" | "password">) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const { profile: p } = await api.auth.me();
          setProfile(p);
        }
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    profileData: Omit<SignupData, "email" | "password">
  ) => {
    const { token, profile: p } = await api.auth.signup({ email, password, ...profileData });
    await setToken(token);
    setProfile(p);
  };

  const signIn = async (email: string, password: string) => {
    const { token, profile: p } = await api.auth.signin(email, password);
    await setToken(token);
    setProfile(p);
  };

  const signOut = async () => {
    try { await api.auth.signout(); } catch {}
    await clearToken();
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
    <AuthContext.Provider value={{ user, profile, loading, isVerified, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
