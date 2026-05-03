# Navodaya Connect

A premium community mobile app for Jawahar Navodaya Vidyalaya (JNV) connecting Students, Alumni, Teachers, and Officials.

## Architecture

- **Framework**: Expo SDK 54 (React Native) with Expo Router file-based routing
- **Backend**: Express + Drizzle ORM + PostgreSQL (via `@workspace/api-server`)
- **Auth**: Token-based (Bearer token in AsyncStorage, no Firebase)
- **State**: React Context (AuthContext) + React Query
- **Styling**: React Native StyleSheet with premium design tokens in `constants/colors.ts`

## Key Files

- `artifacts/mobile/` — Main Expo app
  - `app/_layout.tsx` — Root layout with AuthProvider, QueryClient, SafeAreaProvider
  - `app/index.tsx` — Auth redirect logic
  - `app/(auth)/` — Sign In / Sign Up screens (3-step registration)
  - `app/(tabs)/` — Main tab navigation (Home, Groups, Problems, Mentorship, Profile)
  - `app/(screens)/` — Secondary screens (News, Events, Rankings, Store, Alumni, Community, Group Chat, etc.)
  - `context/AuthContext.tsx` — Token-based auth context using REST API
  - `lib/api.ts` — Full API client (all REST calls, token management)
  - `constants/colors.ts` — Design tokens (blue gradient theme)
  - `data/jnvData.ts` — All Indian states and JNV names lookup data

- `artifacts/api-server/` — Express REST API
  - `src/routes/auth.ts` — POST /auth/signup, /auth/signin, /auth/signout, GET /auth/me
  - `src/routes/news.ts` — GET/POST/DELETE /news
  - `src/routes/groups.ts` — GET/POST /groups, GET/POST /groups/:id/messages
  - `src/routes/problems.ts` — GET/POST /problems, GET /problems/:id, POST /problems/:id/comments, PATCH /problems/:id/status
  - `src/routes/events.ts` — GET/POST /events
  - `src/routes/users.ts` — GET /users/alumni, PATCH /users/me
  - `src/routes/mentorRequests.ts` — GET/POST /mentor-requests
  - `src/lib/auth.ts` — requireAuth middleware + getUser helper

- `lib/db/src/schema/` — Drizzle ORM table schemas
  - `users.ts`, `sessions.ts`, `news.ts`, `groups.ts`, `problems.ts`, `events.ts`, `mentorRequests.ts`

## Database Tables (PostgreSQL)

- `users` — User profiles with role-based fields + verificationStatus
- `sessions` — Auth tokens (Bearer, 90-day expiry)
- `news` — News posts (created by teachers/officials)
- `groups` — Teacher-created study groups
- `group_messages` — Group chat messages
- `problems` — Student-reported problems with status tracking
- `problem_comments` — Comments from alumni/teachers/officials
- `events` — Events (created by teachers/officials)
- `mentor_requests` — Mentorship requests from students to verified alumni

## API Base URL

`https://${EXPO_PUBLIC_DOMAIN}/api` — the mobile app reads `EXPO_PUBLIC_DOMAIN` (set in the Expo workflow env to `$REPLIT_DEV_DOMAIN`).

## User Roles

- **student** — Can view content, submit problems, request mentorship, join groups
- **alumni** — Can help with problems, mentor students, get verified, join profession groups
- **teacher** — Can create groups, post news, create events, manage students
- **official** — Can post news, create events, update problem statuses

## Features

1. Authentication (Sign Up 3-step / Sign In) with role + JNV selection
2. Home Dashboard with feature grid and news feed
3. News system (CRUD for teachers/officials, view for others)
4. Teacher Groups with polling-based group chat (5s interval)
5. Problems system (submit, track, comment, update status)
6. Mentorship (request from verified alumni, category-based)
7. Rankings (India + State, podium display, mock data)
8. Events (create for teachers/officials, view for all)
9. Store (products, cart, place orders — local state)
10. Alumni Directory (searchable, verified alumni only)
11. Community Groups (4 profession groups: IT, Medical, UPSC, Defence)
12. Alumni Verification (submit request → sets verificationStatus to "pending")
13. Profile with role-specific info and quick navigation
14. Edit Profile (updates via PATCH /users/me)
15. Notifications screen

## Design

- Blue gradient theme (#1E40AF → #2563EB)
- Premium cards with soft shadows
- Rounded corners (16px radius)
- Inter font family (400/500/600/700)
- iOS-style bottom navigation with BlurView
