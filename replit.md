# Navodaya Connect

A premium community mobile app for Jawahar Navodaya Vidyalaya (JNV) alumni, students, teachers, and officials.

## Architecture

- **Framework**: Expo SDK 54 (React Native) with Expo Router file-based routing
- **Backend**: Express + Drizzle ORM + PostgreSQL (via `@workspace/api-server`)
- **Auth**: Token-based (Bearer token in AsyncStorage, no Firebase)
- **State**: React Context (AuthContext) + React Query
- **Styling**: React Native StyleSheet with design tokens in `constants/colors.ts`

## Design System

- **Primary**: Deep Navy Blue `#1A3C6E` (headers, navbars, Connect button)
- **Accent/CTA**: Saffron `#FF7A00` (RSVP, Post, active tab icons, highlights)
- **Background**: `#F5F7FB`
- **Cards**: White with subtle border
- **Border Radius**: 12px (cards), 20px (pills)
- **Fonts**: Inter (400/500/600/700)
- **Bottom tab**: Active icon = Saffron, inactive = gray

## Bottom Tab Structure (5 tabs)

1. **Home** (`index.tsx`) — Social feed: community posts, stories, quick action pills, event cards
2. **Alumni** (`alumni.tsx`) — Searchable alumni directory with filter chips (All/Verified/Engineers/Doctors/IAS/Defence)
3. **Events** (`events.tsx`) — Event cards with RSVP toggle, tabbed (Upcoming / My RSVPs), create event for teachers/officials
4. **Jobs** (`jobs.tsx`) — Alumni-posted job listings with category filters, mock data + post job form
5. **Profile** (`profile.tsx`) — Social profile: saffron avatar ring, stats row (connections/events/posts), menu groups

## Key Files

- `artifacts/mobile/` — Main Expo app
  - `app/_layout.tsx` — Root layout with AuthProvider, QueryClient, SafeAreaProvider
  - `app/index.tsx` — Auth redirect logic
  - `app/(auth)/sign-in.tsx` — Sign In (Deep Navy header, Saffron school icon)
  - `app/(auth)/sign-up.tsx` — Sign Up 3-step (role + JNV selection + role-specific details)
  - `app/(tabs)/_layout.tsx` — Tab navigator: Home, Alumni, Events, Jobs, Profile
  - `app/(tabs)/index.tsx` — Social feed home
  - `app/(tabs)/alumni.tsx` — Alumni directory tab
  - `app/(tabs)/events.tsx` — Events with RSVP tab
  - `app/(tabs)/jobs.tsx` — Jobs board tab (alumni-posted, mock data)
  - `app/(tabs)/profile.tsx` — Social profile tab
  - `app/(tabs)/groups.tsx` — Groups (accessible via profile/home, not in tab bar)
  - `app/(tabs)/problems.tsx` — Problems (accessible via profile/home, not in tab bar)
  - `app/(tabs)/mentorship.tsx` — Mentorship (accessible via profile/home, not in tab bar)
  - `app/(screens)/` — Secondary screens (News, Rankings, Store, Community, etc.)
  - `constants/colors.ts` — Design tokens (deep navy + saffron theme)
  - `context/AuthContext.tsx` — Token-based auth context using REST API
  - `lib/api.ts` — Full API client (all REST calls, token management)
  - `data/jnvData.ts` — All Indian states and JNV names lookup data
  - `components/PremiumButton.tsx` — Button with primary (navy), saffron, secondary, outline, ghost variants
  - `components/PremiumCard.tsx` — Card with border + shadow
  - `components/PremiumInput.tsx` — Input with focus highlight, password toggle

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
- `news` — News posts (created by teachers/officials, shown in Home feed)
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
- **alumni** — Can help with problems, mentor students, get verified, post jobs, appear in alumni directory
- **teacher** — Can create groups, post news, create events, manage students
- **official** — Can post news, create events, update problem statuses

## Features

1. Authentication (Sign Up 3-step / Sign In) with role + JNV selection
2. **Social Feed** home screen with community posts (from News API), events, quick actions
3. **Alumni Directory** with search + filter chips (Verified, Engineers, Doctors, IAS/IPS, Defence)
4. **Events** with RSVP system, tabbed Upcoming/My RSVPs, create for teachers/officials
5. **Jobs Board** — alumni-posted jobs with category filter, post job form (local state)
6. **Social Profile** with saffron avatar ring, connections/events/posts stats, grouped menu
7. Groups system with polling-based group chat (5s interval)
8. Problems system (submit, track, comment, update status)
9. Mentorship (request from verified alumni, category-based)
10. Rankings (India + State, podium display)
11. News system (CRUD for teachers/officials, view for all)
12. Alumni Verification (submit request → sets verificationStatus to "pending")
13. Edit Profile (updates via PATCH /users/me)
14. Notifications screen
15. Community Groups (IT, Medical, UPSC, Defence)
16. Store (products, cart, place orders — local state)
