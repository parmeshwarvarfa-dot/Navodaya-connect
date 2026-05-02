# Navodaya Connect

A premium community mobile app for Jawahar Navodaya Vidyalaya (JNV) connecting Students, Alumni, Teachers, and Officials.

## Architecture

- **Framework**: Expo (React Native) with Expo Router file-based routing
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **State**: React Context (AuthContext) + React Query
- **Styling**: React Native StyleSheet with premium design tokens in `constants/colors.ts`

## Key Files

- `artifacts/mobile/` — Main Expo app
  - `app/_layout.tsx` — Root layout with AuthProvider, QueryClient, SafeAreaProvider
  - `app/index.tsx` — Auth redirect logic
  - `app/(auth)/` — Sign In / Sign Up screens (3-step registration)
  - `app/(tabs)/` — Main tab navigation (Home, Groups, Problems, Mentorship, Profile)
  - `app/(screens)/` — Secondary screens (News, Events, Rankings, Store, Alumni, Community, Group Chat, etc.)
  - `context/AuthContext.tsx` — Firebase Auth + Firestore user profile management
  - `lib/firebase.ts` — Firebase app initialization
  - `constants/colors.ts` — Design tokens (blue gradient theme)
  - `data/jnvData.ts` — All Indian states and JNV names lookup data

## Firebase Collections

- `users` — User profiles with role-based fields
- `news` — News posts (created by teachers/officials)
- `groups` — Teacher-created study groups
- `groups/{id}/messages` — Group chat messages
- `problems` — Student-reported problems with status tracking
- `problems/{id}/comments` — Comments from alumni/teachers/officials
- `events` — Events (created by teachers/officials)
- `orders` — Store orders
- `mentorRequests` — Mentorship requests from students to verified alumni
- `verificationRequests` — Alumni verification requests (needs 2 approvals)

## Environment Variables (Secrets)

All stored as Replit Secrets:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

## User Roles

- **student** — Can view content, submit problems, request mentorship, join groups
- **alumni** — Can help with problems, mentor students, get verified, join profession groups
- **teacher** — Can create groups, post news, create events, manage students
- **official** — Can post news, create events, update problem statuses

## Features Built

1. Authentication (Sign Up 3-step / Sign In) with role + JNV selection
2. Home Dashboard with feature grid and news feed
3. News system (CRUD for teachers/officials, view for others)
4. Teacher Groups with real-time group chat
5. Problems system (submit, track, comment, update status)
6. Mentorship (request from verified alumni, category-based)
7. Rankings (India + State, podium display)
8. Events (create, join)
9. Store (products, cart, place orders)
10. Alumni Directory (searchable)
11. Community Groups (4 profession groups: IT, Medical, UPSC, Defence)
12. Alumni Verification (community-based, 2 approvals needed)
13. Profile with role-specific info and quick navigation
14. Notifications screen
15. Edit Profile

## Design

- Blue gradient theme (#1E40AF → #2563EB)
- Premium cards with soft shadows
- Rounded corners (16px radius)
- Inter font family (400/500/600/700)
- iOS-style bottom navigation with BlurView
- Liquid glass tabs on iOS 26+
