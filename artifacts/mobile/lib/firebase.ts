import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

function cleanFirebaseValue(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.replace(/^["']|["']$/g, "").trim();
}

const firebaseConfig = {
  apiKey: cleanFirebaseValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: cleanFirebaseValue(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: cleanFirebaseValue(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: cleanFirebaseValue(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanFirebaseValue(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanFirebaseValue(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

if (__DEV__) {
  console.info("[Firebase] web configuration loaded", {
    hasApiKey: Boolean(firebaseConfig.apiKey),
    hasAuthDomain: Boolean(firebaseConfig.authDomain),
    hasProjectId: Boolean(firebaseConfig.projectId),
    hasAppId: Boolean(firebaseConfig.appId),
    configured: Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId),
  });
}

const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

const firebaseApp = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;
let firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

export { firebaseApp, firebaseAuth };

export function requireFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    throw new Error(
      "Firebase authentication is not configured. Add the Firebase web app values to the local .env file.",
    );
  }
  return firebaseAuth;
}