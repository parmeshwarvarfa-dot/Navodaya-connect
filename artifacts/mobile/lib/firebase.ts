import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

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

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
  throw new Error("Firebase authentication is not configured. Add the Firebase web app configuration to the Expo environment.");
}

if (__DEV__) {
  console.info("[Firebase] web configuration loaded", {
    hasApiKey: Boolean(firebaseConfig.apiKey),
    hasAuthDomain: Boolean(firebaseConfig.authDomain),
    hasProjectId: Boolean(firebaseConfig.projectId),
    hasAppId: Boolean(firebaseConfig.appId),
  });
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// The API session is persisted by the API client. Firebase remains the
// source of truth for the current credential.
export { app as firebaseApp };
export const firebaseAuth = getAuth(app);