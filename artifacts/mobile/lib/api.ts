import type { MemoryFeedPage } from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolveApiBaseUrl } from "./api-url";

const TOKEN_KEY = "auth_token";
const STORE_ADMIN_TOKEN_KEY = "store_admin_token";

function getBaseUrl(): string {
  return resolveApiBaseUrl({
    configuredApiUrl: process.env.EXPO_PUBLIC_API_URL,
    domain: process.env.EXPO_PUBLIC_DOMAIN,
    metroHostUri: Constants.expoConfig?.hostUri,
    browserOrigin: Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : undefined,
    native: Platform.OS !== "web",
    development: __DEV__,
  });
}

export function getApiOrigin(): string {
  return getBaseUrl().replace(/\/api\/?$/, "");
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoreAdminToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORE_ADMIN_TOKEN_KEY);
}

export async function setStoreAdminToken(token: string): Promise<void> {
  await AsyncStorage.setItem(STORE_ADMIN_TOKEN_KEY, token);
}

export async function clearStoreAdminToken(): Promise<void> {
  await AsyncStorage.removeItem(STORE_ADMIN_TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 15000, session: "user" | "store_admin" = "user"): Promise<T> {
  const token = session === "store_admin" ? await getStoreAdminToken() : await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The request took too long. Please try again.");
    }
    throw new Error("Network error. Check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    let errorMessage = body.error;
    if (!errorMessage) {
      if (res.status === 530 || res.status === 502 || res.status === 503 || res.status === 504) {
        errorMessage = "Server temporarily unreachable. Please check your network or try again in a moment.";
      } else {
        errorMessage = `Request failed (${res.status})`;
      }
    }
    const error = new Error(errorMessage) as Error & {
      code?: string;
      status?: number;
    };
    error.code = body.code;
    error.status = res.status;
    throw error;
  }
  return res.json();
}

const adminRequest = <T,>(path: string, options: RequestInit = {}) => request<T>(path, options, 15000, "store_admin");

function queryString(params: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

async function uploadMedia(uri: string, fileName: string, mimeType?: string, endpoint = "/memories/uploads") {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("The selected media could not be read. Please choose it again.");
  const blob = await response.blob();
  if (!blob.size || blob.size > 50 * 1024 * 1024) throw new Error("Choose a file under 50 MB.");
  return request<UploadedMemoryMedia>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": mimeType || blob.type || "application/octet-stream",
      "X-Media-Filename": encodeURIComponent(fileName),
    },
    body: blob,
  }, 120000);
}

export const api = {
  auth: {
    signup: (data: SignupData) =>
      request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
    demoLogin: (role: string) =>
      request<AuthResponse>("/auth/demo-login", { method: "POST", body: JSON.stringify({ role }) }),
    signin: (email: string, password: string) =>
      request<AuthResponse>("/auth/signin", { method: "POST", body: JSON.stringify({ email, password }) }),
    firebase: (idToken: string, profileData?: Partial<SignupData>) =>
      request<AuthResponse>("/auth/firebase", {
        method: "POST",
        body: JSON.stringify({ idToken, profileData }),
      }),
    signout: () => request<{ ok: boolean }>("/auth/signout", { method: "POST" }),
    me: () => request<{ profile: UserProfile }>("/auth/me"),
  },
  academicTeacherAssignments: {
    overview: (academicYear?: string) => request<AcademicManagementOverview>(`/academic-teacher-assignments/overview${queryString({ academicYear })}`),
    bulk: (data: { assignmentType: AcademicAssignmentType; academicYear: string; teacherId: string; subject?: string; selections: Array<{ className: string; section: string; periodsPerWeek?: number | null }> }) => request<{ assignments: AcademicTeacherAssignment[] }>("/academic-teacher-assignments/bulk", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { assignmentType: AcademicAssignmentType; academicYear: string; teacherId: string; subject?: string; selection: { className: string; section: string; periodsPerWeek?: number | null } }) => request<AcademicTeacherAssignment>(`/academic-teacher-assignments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: string) => request<{ id: string; active: false }>(`/academic-teacher-assignments/${encodeURIComponent(id)}`, { method: "DELETE" }),
    updateSettings: (data: { allowMultipleSubjectTeachers: boolean }) => request<{ allowMultipleSubjectTeachers: boolean }>("/academic-teacher-assignments/settings", { method: "PATCH", body: JSON.stringify(data) }),
    teacherAssignments: (academicYear?: string) => request<{ assignments: AcademicTeacherAssignment[] }>(`/teacher/academic-assignments${queryString({ academicYear })}`),
  },
  academicClasses: {
    list: (includeHistory = false) => request<TeacherClassAssignment[]>(`/academic-classes${queryString({ includeHistory: includeHistory ? "true" : undefined })}`),
    teachers: () => request<VerifiedTeacher[]>("/academic-classes/teachers"),
    assign: (data: { teacherId: string; className: string; subject: string }) => request<TeacherClassAssignment>("/academic-classes", { method: "POST", body: JSON.stringify(data) }),
    roster: (id: string) => request<AcademicStudent[]>(`/academic-classes/${encodeURIComponent(id)}/students`),
    revoke: (id: string) => request<{ id: string; active: boolean }>(`/academic-classes/${encodeURIComponent(id)}`, { method: "DELETE" }),
    teacherOverview: () => request<TeacherClassesOverview>("/academic-classes/teacher-overview"),
    classOverview: (id: string) => request<ClassDetailOverview>(`/academic-classes/${encodeURIComponent(id)}/overview`),
    attendance: (id: string, date?: string) => request<ClassAttendanceRecord[]>(`/academic-classes/${encodeURIComponent(id)}/attendance${queryString({ date })}`),
    recordAttendance: (id: string, data: { date: string; students: Array<{ studentId: string; studentName: string; status: "present" | "absent" | "leave"; remarks?: string }> }) =>
      request<ClassAttendanceRecord>(`/academic-classes/${encodeURIComponent(id)}/attendance`, { method: "POST", body: JSON.stringify(data) }),
    results: (id: string) => request<ClassAssessmentRecord[]>(`/academic-classes/${encodeURIComponent(id)}/results`),
    recordAssessment: (id: string, data: { title: string; subject?: string; totalMarks: number; date?: string; scores: Array<{ studentId: string; studentName: string; marksObtained: number; remarks?: string }>; published?: boolean; weightage?: number }) =>
      request<ClassAssessmentRecord>(`/academic-classes/${encodeURIComponent(id)}/results`, { method: "POST", body: JSON.stringify(data) }),
    timetable: (id: string) => request<ClassTimetableData>(`/academic-classes/${encodeURIComponent(id)}/timetable`),
    updateTimetable: (id: string, data: { schedule: Record<string, ClassTimetableSlot[]> }) =>
      request<ClassTimetableData>(`/academic-classes/${encodeURIComponent(id)}/timetable`, { method: "POST", body: JSON.stringify(data) }),
  },
  schoolAdmin: {
    classes: () => request<SchoolClassList>("/school-admin/classes"),
    dashboardMetrics: () => request<SchoolAdminDashboardMetrics>("/school-admin/dashboard-metrics"),
    directory: (params: { role?: string; query?: string; className?: string; page?: number; pageSize?: number }) => request<SchoolDirectoryPage>(`/school-admin/directory${queryString({ role: params.role, q: params.query, class: params.className, page: params.page, pageSize: params.pageSize })}`),
  },
  businesses: {
    list: (params: { q?: string; category?: string; city?: string } = {}) => request<Business[]>(`/businesses${queryString(params)}`),
    get: (id: string) => request<BusinessDetails>(`/businesses/${encodeURIComponent(id)}`),
    create: (data: Record<string, unknown>) => request<Business>("/businesses", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) => request<Business>(`/businesses/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
    review: (id: string, rating: number, text: string) => request<BusinessReview>(`/businesses/${encodeURIComponent(id)}/reviews`, { method: "POST", body: JSON.stringify({ rating, text }) }),
  },
  bloodRequests: {
    list: (params: { bloodGroup?: string; city?: string } = {}) => request<BloodRequest[]>(`/blood-requests${queryString(params)}`),
    create: (data: Record<string, unknown>) => request<BloodRequest>("/blood-requests", { method: "POST", body: JSON.stringify(data) }),
    respond: (id: string, message: string) => request<{ success: boolean }>(`/blood-requests/${encodeURIComponent(id)}/respond`, { method: "POST", body: JSON.stringify({ message }) }),
    update: (id: string, status: string) => request<BloodRequest>(`/blood-requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  },
  communityReports: {
    submit: (targetType: "business" | "blood_request", targetId: string, reason: string, details?: string) => request<{ success: boolean; id: string }>("/community-reports", { method: "POST", body: JSON.stringify({ targetType, targetId, reason, details }) }),
  },
  opportunities: {
    list: (params: Record<string, unknown> = {}) => request<{ items: Opportunity[]; page: number; limit: number; total: number; hasMore: boolean }>(`/opportunities${queryString(params)}`),
    categories: () => request<string[]>("/opportunities/categories"),
    mine: () => request<Opportunity[]>("/opportunities/mine"),
    registrations: () => request<OpportunityRegistration[]>("/opportunities/my-registrations"),
    saved: () => request<SavedOpportunity[]>("/opportunities/saved"),
    save: (id: string) => request<{ saved: boolean }>(`/opportunities/${encodeURIComponent(id)}/save`, { method: "POST" }),
    unsave: (id: string) => request<{ saved: boolean }>(`/opportunities/${encodeURIComponent(id)}/save`, { method: "DELETE" }),
    analytics: () => request<OpportunityAnalytics>("/opportunities/analytics/mine"),
    get: (id: string) => request<OpportunityDetails>(`/opportunities/${encodeURIComponent(id)}`),
    create: (data: OpportunityInput) => request<Opportunity>("/opportunities", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<OpportunityInput>) => request<Opportunity>(`/opportunities/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
    register: (id: string) => request<{ registered: boolean }>(`/opportunities/${encodeURIComponent(id)}/register`, { method: "POST" }),
    cancelRegistration: (id: string) => request<{ cancelled: boolean }>(`/opportunities/${encodeURIComponent(id)}/register`, { method: "DELETE" }),
    submit: (id: string, data: { content?: string; submissionUrl?: string }) => request<OpportunitySubmission>(`/opportunities/${encodeURIComponent(id)}/submission`, { method: "POST", body: JSON.stringify(data) }),
    participants: (id: string) => request<OpportunityParticipant[]>(`/opportunities/${encodeURIComponent(id)}/participants`),
    submissions: (id: string) => request<OpportunitySubmission[]>(`/opportunities/${encodeURIComponent(id)}/submissions`),
    reviewSubmission: (id: string, submissionId: string, data: { status: string; score: number | null; organizerFeedback: string }) => request<OpportunitySubmission>(`/opportunities/${encodeURIComponent(id)}/submissions/${encodeURIComponent(submissionId)}`, { method: "PATCH", body: JSON.stringify(data) }),
    report: (id: string, reason: string) => request<{ success: boolean }>(`/opportunities/${encodeURIComponent(id)}/report`, { method: "POST", body: JSON.stringify({ reason }) }),
    publishResults: (id: string, published: boolean) => request<{ resultsPublished: boolean }>(`/opportunities/${encodeURIComponent(id)}/results`, { method: "PATCH", body: JSON.stringify({ published }) }),
  },
  alumniVerification: {
    status: () => request<any>("/alumni-verification/status"),
    peers: () => request<{ peers: any[] }>("/alumni-verification/peers"),
    request: () => request<any>("/alumni-verification/request", { method: "POST" }),
    inbox: () => request<any[]>("/alumni-verification/inbox"),
    respond: (id: string, decision: "confirmed" | "declined") => request<any>(`/alumni-verification/requests/${encodeURIComponent(id)}/respond`, { method: "POST", body: JSON.stringify({ decision }) }),
    appeal: (reportId: string, reason: string) => request<any>("/alumni-verification/appeals", { method: "POST", body: JSON.stringify({ reportId, reason }) }),
  },
  alumniMembership: {
    plans: () => request<{ plans: AlumniMembershipPlan[] }>("/alumni/membership/plans"),
    status: () => request<AlumniMembershipStatus>("/alumni/membership/status"),
    subscribe: (planId: string, paymentMethod = "upi", idempotencyKey?: string) =>
      request<{ success: boolean; message: string; membership: any; payment: any }>("/alumni/membership/subscribe", {
        method: "POST",
        body: JSON.stringify({ planId, paymentMethod, idempotencyKey }),
      }),
    renew: (planId?: string, paymentMethod = "upi") =>
      request<{ success: boolean; message: string; membership: any; payment: any }>("/alumni/membership/renew", {
        method: "POST",
        body: JSON.stringify({ planId, paymentMethod }),
      }),
    history: () => request<{ history: any[] }>("/alumni/membership/history"),
  },
  profileAnalytics: {
    recordVisit: (targetUserId: string, eventType = "profile_visit", entityId?: string) =>
      request<{ recorded: boolean }>("/analytics/profile-visit", {
        method: "POST",
        body: JSON.stringify({ targetUserId, eventType, entityId }),
      }),
    insights: (userId?: string, range: "7d" | "30d" | "90d" = "30d") =>
      request<ProfileInsightsData>(`/alumni/analytics/insights${queryString({ userId, range })}`),
  },
  competition: {
    dashboard: () => request<CompetitionDashboardData>("/competition/dashboard"),
    battles: (status?: string) => request<{ battles: HouseBattleItem[] }>(`/competition/battles${queryString({ status })}`),
    randomMatch: () => request<{ battle: HouseBattleItem }>("/competition/battles/random-match", { method: "POST" }),
    joinBattle: (id: string) => request<{ battle: HouseBattleItem; participant: any }>(`/competition/battles/${encodeURIComponent(id)}/join`, { method: "POST" }),
    submitBattleAnswer: (id: string, questionId: number, answerIndex: number, timeTakenSeconds = 5) =>
      request<{ correct: boolean; pointsEarned: number; currentScore: number; explanation?: string }>(`/competition/battles/${encodeURIComponent(id)}/answer`, {
        method: "POST",
        body: JSON.stringify({ questionId, answerIndex, timeTakenSeconds }),
      }),
    finishBattle: (id: string) => request<any>(`/competition/battles/${encodeURIComponent(id)}/finish`, { method: "POST" }),
    dailyPuzzles: () => request<{ puzzles: DailyPuzzleItem[] }>("/competition/daily-puzzles"),
    submitDailyPuzzle: (id: string, guess: any, isPractice = false, timeTakenSeconds = 20) =>
      request<{ success: boolean; isCorrect: boolean; feedback: any; pointsAwarded: number; isPractice: boolean }>(`/competition/daily-puzzles/${encodeURIComponent(id)}/attempt`, {
        method: "POST",
        body: JSON.stringify({ guess, isPractice, timeTakenSeconds }),
      }),
    playerLeaderboard: (params: { timeRange?: string; house?: string; search?: string } = {}) =>
      request<{ leaderboard: PlayerLeaderboardEntry[]; filters: any; connectionStatus: string }>(`/competition/leaderboard/players${queryString(params)}`),
    houseLeaderboard: () =>
      request<{ standings: HouseChampionshipStanding[]; leadingHouse: string; connectionStatus: string }>("/competition/leaderboard/houses"),
    activityFeed: () => request<{ activities: CompetitionActivityItem[] }>("/competition/activity-feed"),
    events: () => request<{ tournaments: any[] }>("/competition/events"),
    adminScoreAdjust: (targetUserId: string, house: string, points: number, reason: string) =>
      request<{ success: boolean; message: string; scoreId: string }>("/competition/admin/score-adjust", {
        method: "POST",
        body: JSON.stringify({ targetUserId, house, points, reason }),
      }),
  },
  ranking: {
    overview: () => request<RankingOverviewData>("/ranking/overview"),
    individual: (params: { state?: string; jnv?: string; role?: string; period?: string; search?: string } = {}) =>
      request<{ leaderboard: IndividualRankingItem[]; count: number }>(`/ranking/individual${queryString(params)}`),
    jnv: (params: { state?: string; periodType?: string; period?: string } = {}) =>
      request<{ scores: JnvRankingScoreItem[]; period: string; periodType: string; methodologyNote: string }>(`/ranking/jnv${queryString(params)}`),
    awards: () => request<{ monthlyAwards: RankingAwardItem[]; annualAwards: RankingAwardItem[]; totalAwards: number }>("/ranking/awards"),
    methodology: () => request<RankingMethodologyData>("/ranking/methodology"),
    profile: (id: string) => request<RankingProfileData>(`/ranking/profile/${encodeURIComponent(id)}`),
    adminScoreAdjust: (targetUserId: string, points: number, reason: string) =>
      request<{ success: boolean; message: string; entry: any }>("/ranking/admin/score-adjust", {
        method: "POST",
        body: JSON.stringify({ targetUserId, points, reason }),
      }),
  },
  yearbook: {
    list: (jnvName?: string, jnvState?: string, cohortYear?: string) => request<YearbookEntry[]>(`/yearbook${queryString({ jnvName, jnvState, cohortYear })}`),
    mine: () => request<YearbookSubmission[]>("/yearbook/my-submissions"),
    submit: (memoryId: string, cohortYear?: string) => request<YearbookSubmission>("/yearbook/submissions", { method: "POST", body: JSON.stringify({ memoryId, cohortYear }) }),
    withdraw: (id: string) => request<{ withdrawn: boolean }>(`/yearbook/submissions/${encodeURIComponent(id)}/withdraw`, { method: "POST" }),
    reviewQueue: () => request<YearbookReviewItem[]>("/yearbook/review-queue"),
    review: (id: string, status: "approved" | "rejected", reviewNote?: string) => request<YearbookReviewItem>(`/yearbook/submissions/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ status, reviewNote }) }),
  },
  games: {
    summary: () => request<GameSummary>("/games/summary"),
    start: (gameId: GameId, difficulty?: GameDifficulty) => request<StartedGame>("/games/sessions", { method: "POST", body: JSON.stringify({ gameId, difficulty }) }),
    answer: (sessionId: string, round: number, answer: string | number) => request<GameResult>(`/games/sessions/${encodeURIComponent(sessionId)}/answer`, { method: "POST", body: JSON.stringify({ round, answer }) }),
    finish: (sessionId: string) => request<{ result: GameResult }>(`/games/sessions/${encodeURIComponent(sessionId)}/finish`, { method: "POST" }),
    submitArtwork: (sessionId: string, strokes: DrawingStroke[]) => request<{ result: GameResult }>(`/games/sessions/${encodeURIComponent(sessionId)}/artwork`, { method: "POST", body: JSON.stringify({ strokes }) }),
    saveChess: (sessionId: string, pgn: string) => request<{ result: GameResult }>(`/games/sessions/${encodeURIComponent(sessionId)}/chess`, { method: "POST", body: JSON.stringify({ pgn }) }),
  },
  news: {
    list: (params?: { lang?: "en" | "hi" }) =>
      request<NewsItem[]>(params?.lang ? `/news?lang=${params.lang}` : "/news"),
    create: (data: { title: string; description: string; category: string; sourceName?: string; sourceUrl?: string; imageUrl?: string; publishedAt?: string }) =>
      request<NewsItem>("/news", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/news/${id}`, { method: "DELETE" }),
  },
  groups: {
    list: () => request<Group[]>("/groups"),
    ensureStaffWorkspace: (rejoin = false) => request<Group>("/groups/ensure-staff", { method: "POST", body: JSON.stringify({ rejoin }) }),
    ensureOfficialsWorkspace: () => request<Group>("/groups/ensure-officials", { method: "POST" }),
    create: (data: { name: string; subject?: string; class?: string; memberIds?: string[]; avatarKey?: string | null }) =>
      request<Group>("/groups", { method: "POST", body: JSON.stringify(data) }),
    createInviteLink: (groupId: string) => request<{ token: string; groupName: string; expiresAt: string }>(`/groups/${encodeURIComponent(groupId)}/invite-link`, { method: "POST" }),
    joinByInvite: (token: string) => request<{ id: string; name: string; joined: boolean }>("/groups/join-by-invite", { method: "POST", body: JSON.stringify({ token }) }),
    getMessages: (groupId: string, before?: { createdAt: string; id: string }) => {
      const query = before ? `?before=${encodeURIComponent(before.createdAt)}&beforeId=${encodeURIComponent(before.id)}` : "";
      return request<GroupMessage[]>(`/groups/${encodeURIComponent(groupId)}/messages${query}`);
    },
    sendMessage: (groupId: string, text: string, reply?: { replyToId: string; replyToText: string; replyToSender: string }) =>
      request<GroupMessage>(`/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ text, ...reply }) }),
    editMessage: (groupId: string, msgId: string, text: string) =>
      request<GroupMessage>(`/groups/${groupId}/messages/${msgId}`, { method: "PATCH", body: JSON.stringify({ text }) }),
    deleteMessage: (groupId: string, msgId: string) =>
      request<GroupMessage>(`/groups/${groupId}/messages/${msgId}`, { method: "DELETE" }),
    reactToMessage: (groupId: string, msgId: string, emoji: string) =>
      request<GroupMessage>(`/groups/${groupId}/messages/${msgId}/react`, { method: "POST", body: JSON.stringify({ emoji }) }),
    getTyping: (groupId: string) => request<{ typing: string[] }>(`/groups/${groupId}/typing`),
    setTyping: (groupId: string, typing: boolean) =>
      request<{ ok: boolean }>(`/groups/${groupId}/typing`, { method: "POST", body: JSON.stringify({ typing }) }),
    ensureCommunity: (data: { kind: "house" | "class" | "batch" | "school" | "all" | "interest" | "staff" | "officials"; interestId?: string }) =>
      request<Group>("/groups/ensure-community", { method: "POST", body: JSON.stringify(data) }),
    members: (groupId: string) => request<GroupMember[]>(`/groups/${encodeURIComponent(groupId)}/members`),
    addMembers: (groupId: string, memberIds: string[]) => request<GroupMember[]>(`/groups/${encodeURIComponent(groupId)}/members`, { method: "POST", body: JSON.stringify({ memberIds }) }),
    updateMemberRole: (groupId: string, userId: string, role: "admin" | "member") => request<{ userId: string; role: string }>(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    settings: (groupId: string) => request<GroupSettings>(`/groups/${encodeURIComponent(groupId)}/settings`),
    updateSettings: (groupId: string, data: { adminOnlyMessages: boolean }) => request<Group>(`/groups/${encodeURIComponent(groupId)}/settings`, { method: "PATCH", body: JSON.stringify(data) }),
    updateAvatar: (groupId: string, avatarKey: string | null) => request<Group>(`/groups/${encodeURIComponent(groupId)}/avatar`, { method: "PATCH", body: JSON.stringify({ avatarKey }) }),
    leave: (groupId: string) => request<{ left: boolean; deleted: boolean }>(`/groups/${encodeURIComponent(groupId)}/leave`, { method: "POST" }),
    delete: (groupId: string) => request<{ deleted: boolean }>(`/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" }),
  },
  problems: {
    list: () => request<Problem[]>("/problems"),
    create: (data: { title: string; description: string; category: string; priority: string; anonymous: boolean }) =>
      request<Problem>("/problems", { method: "POST", body: JSON.stringify(data) }),
    get: (id: string) => request<ProblemWithComments>(`/problems/${id}`),
    addComment: (id: string, text: string) =>
      request<ProblemComment>(`/problems/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
    updateStatus: (id: string, status: string) =>
      request<Problem>(`/problems/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  },
  events: {
    list: () => request<Event[]>("/events"),
    create: (data: { title: string; description: string; date: string; location?: string; mediaKey?: string }) =>
      request<Event>("/events", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { title: string; description: string; date: string; location?: string | null; mediaKey?: string }) =>
      request<Event>(`/events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<{ deleted: boolean }>(`/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
    register: (id: string, data: Record<string, string>) =>
      request<Record<string, unknown>>(`/events/${encodeURIComponent(id)}/register`, { method: "POST", body: JSON.stringify(data) }),
  },
  users: {
    alumni: () => request<AlumniUser[]>("/users/alumni"),
    get: (id: string) => request<PublicUserProfile>(`/users/profile/${encodeURIComponent(id)}`),
    reportContext: (id: string) => request<PublicUserProfile>(`/users/${encodeURIComponent(id)}/report-context`),
    updateMe: (data: Partial<UserProfile>) =>
      request<UserProfile>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
    manage: () => request<ManagedUser[]>("/users/manage"),
    suspend: (id: string, suspended: boolean) =>
      request<ManagedUser>(`/users/${id}/suspend`, { method: "PATCH", body: JSON.stringify({ suspended }) }),
    search: (query: string) => request<ChatContact[]>(`/users/search?q=${encodeURIComponent(query)}`),
    profileStats: (id: string) => request<ProfileStats>(`/users/${encodeURIComponent(id)}/profile-stats`),
    followers: (id: string) => request<ProfileConnection[]>(`/users/${encodeURIComponent(id)}/followers`),
    following: (id: string) => request<ProfileConnection[]>(`/users/${encodeURIComponent(id)}/following`),
  },
  mentorRequests: {
    list: () => request<MentorRequest[]>("/mentor-requests"),
    mentors: () => request<MentorDirectoryEntry[]>("/mentor-requests/mentors"),
    availability: () => request<MentorProfile>("/mentor-requests/availability"),
    updateAvailability: (data: MentorProfile) => request<MentorProfile>("/mentor-requests/availability", { method: "PATCH", body: JSON.stringify(data) }),
    create: (data: { mentorId: string; mentorName: string; category: string; message: string }) =>
      request<MentorRequest>("/mentor-requests", { method: "POST", body: JSON.stringify(data) }),
    respond: (id: string, status: "accepted" | "declined") => request<MentorRequest>(`/mentor-requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    schedule: (id: string, scheduledAt: string) => request<MentorRequest>(`/mentor-requests/${encodeURIComponent(id)}/schedule`, { method: "PATCH", body: JSON.stringify({ scheduledAt }) }),
    complete: (id: string) => request<MentorRequest>(`/mentor-requests/${encodeURIComponent(id)}/complete`, { method: "POST" }),
    feedback: (id: string, rating: number, feedback: string) => request<MentorRequest>(`/mentor-requests/${encodeURIComponent(id)}/feedback`, { method: "POST", body: JSON.stringify({ rating, feedback }) }),
  },
  schoolSupport: {
    list: () => request<SchoolSupportRequest[]>("/school-support"),
    submit: (type: string, note: string) => request<SchoolSupportRequest>("/school-support", { method: "POST", body: JSON.stringify({ type, note }) }),
    update: (id: string, status: string, outcome: string) => request<SchoolSupportRequest>(`/school-support/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status, outcome }) }),
  },
  jobs: {
    list: () => request<Job[]>("/jobs"),
    create: (data: { title: string; company: string; location?: string; salary?: string; type?: string; category?: string; description?: string }) =>
      request<Job>("/jobs", { method: "POST", body: JSON.stringify(data) }),
    remove: (id: string) => request<{ success: boolean }>(`/jobs/${id}`, { method: "DELETE" }),
  },
  verification: {
    myStatus: () => request<{ verificationStatus: string; request: VerificationRequest | null }>("/verification/my-status"),
    permissions: () => request<{ canReview: boolean; canDecide: boolean; canManageReviewers: boolean; jnvId: string }>("/verification/permissions"),
    requests: () => request<VerificationRequest[]>("/verification/requests"),
    create: (data: { evidenceSummary: string }) =>
      request<VerificationRequest>("/verification/requests", { method: "POST", body: JSON.stringify(data) }),
    review: (id: string, status: string, notes?: string, infoRequest?: string) =>
      request<VerificationRequest>(`/verification/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes, infoRequest }),
      }),
    requestAudit: (id: string) => request<VerificationAuditEvent[]>(`/verification/requests/${encodeURIComponent(id)}/audit`),
    assignments: () => request<VerificationAssignment[]>("/verification/assignments"),
    appointReviewer: (userId: string) => request<VerificationAssignment>("/verification/assignments", { method: "POST", body: JSON.stringify({ userId }) }),
    removeReviewer: (id: string) => request<{ success: boolean }>(`/verification/assignments/${encodeURIComponent(id)}`, { method: "DELETE" }),
    myCredential: () => request<DigitalCredential>("/verification/my-credential"),
    previewAlumniBatch: (graduationYear: string) => request<AlumniBatchPreview>("/verification/alumni-batches/preview", { method: "POST", body: JSON.stringify({ graduationYear }) }),
    processAlumniBatch: (batchId: string, selectedUserIds: string[], confirmation: string) => request<AlumniBatchProcessResult>(`/verification/alumni-batches/${encodeURIComponent(batchId)}/process`, { method: "POST", body: JSON.stringify({ selectedUserIds, confirmation }) }),
    alumniBatch: (batchId: string) => request<{ batch: { id: string; status: string }; results: AlumniTransitionResult[] }>(`/verification/alumni-batches/${encodeURIComponent(batchId)}`),
    credentialReconcilePreview: () => request<CredentialReconcilePreview>("/verification/credentials/reconcile-preview"),
    reconcileCredentials: (userIds: string[]) => request<{ issued: number; skipped: number }>("/verification/credentials/reconcile", { method: "POST", body: JSON.stringify({ userIds, confirmed: true }) }),
    checkCredential: (token: string) => request<PublicCredentialStatus>(`/verification/public/${encodeURIComponent(token)}`),
    resubmit: (id: string, data: { applicantResponse: string }) =>
      request<VerificationRequest>(`/verification/requests/${encodeURIComponent(id)}/resubmit`, { method: "POST", body: JSON.stringify(data) }),
    withdraw: (id: string) => request<{ success: boolean; status: string }>(`/verification/requests/${encodeURIComponent(id)}/withdraw`, { method: "POST" }),
  },
  recognition: {
    profile: (userId: string) => request<RecognitionProfile>(`/recognition/profile/${encodeURIComponent(userId)}`),
    summary: (offset = 0) => request<RecognitionSummary>(`/recognition/summary${queryString({ offset })}`),
    leaderboard: (period: string, category: string, offset = 0) => request<{ rows: RecognitionLeader[]; currentUserRank: number | null; nextOffset: number | null; rules: RecognitionRule[] }>(`/recognition/leaderboard${queryString({ period, category, offset })}`),
    hallOfFame: () => request<RecognitionAward[]>("/recognition/hall-of-fame"),
    adminReview: () => request<{ candidates: RecognitionAward[]; rules: RecognitionRule[]; points: RecognitionAdminPoint[]; history: RecognitionAward[] }>("/recognition/admin"),
    prepareMonth: (period: string) => request<{ candidatesCreated: number }>("/recognition/prepare-month", { method: "POST", body: JSON.stringify({ period }) }),
    prepareYear: (year: number) => request<{ candidatesCreated: number }>("/recognition/prepare-year", { method: "POST", body: JSON.stringify({ year }) }),
    finalize: (awardId: string, reason: string) => request<RecognitionAward>(`/recognition/awards/${encodeURIComponent(awardId)}/finalize`, { method: "POST", body: JSON.stringify({ reason }) }),
    reversePoints: (pointId: string, reason: string) => request<{ reversed: boolean }>(`/recognition/points/${encodeURIComponent(pointId)}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
    revokeAward: (awardId: string, reason: string) => request<{ revoked: boolean }>(`/recognition/awards/${encodeURIComponent(awardId)}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }),
    awardVerified: (data: { userId: string; activity: string; referenceId: string; reason: string }) => request<RecognitionAward>("/recognition/verified-activity", { method: "POST", body: JSON.stringify(data) }),
    updateRule: (activity: string, data: { points: number; dailyLimit: number; enabled: boolean; reason: string }) => request<RecognitionRule>(`/recognition/rules/${encodeURIComponent(activity)}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  teacherFeedback: {
    submit: (data: { teacherId: string; teacherName: string; subject?: string; rating: number; comment: string; anonymous: boolean }) =>
      request<TeacherFeedbackItem>("/teacher-feedback", { method: "POST", body: JSON.stringify(data) }),
    list: () => request<TeacherFeedbackItem[]>("/teacher-feedback"),
  },
  announcements: {
    list: () => request<Announcement[]>("/announcements"),
    create: (data: { title: string; body: string; target?: string; priority?: string; pinned?: boolean }) =>
      request<Announcement>("/announcements", { method: "POST", body: JSON.stringify(data) }),
    togglePin: (id: string, pinned: boolean) =>
      request<Announcement>(`/announcements/${id}/pin`, { method: "PATCH", body: JSON.stringify({ pinned }) }),
    delete: (id: string) => request<{ success: boolean }>(`/announcements/${id}`, { method: "DELETE" }),
  },
  assignments: {
    list: () => request<AssignmentWithSubs[]>("/assignments"),
    create: (data: { title: string; subject: string; targetClass: string; dueDate: string; description?: string }) =>
      request<AssignmentWithSubs>("/assignments", { method: "POST", body: JSON.stringify(data) }),
    submit: (id: string, note?: string) =>
      request<AssignmentSubmission>(`/assignments/${id}/submit`, { method: "POST", body: JSON.stringify({ note }) }),
    review: (id: string, subId: string, remarks: string) =>
      request<AssignmentSubmission>(`/assignments/${id}/submissions/${subId}/review`, { method: "PATCH", body: JSON.stringify({ remarks }) }),
  },
  studyMaterials: {
    list: () => request<StudyMaterial[]>("/study-materials"),
    create: (data: { title: string; subject: string; type?: string; url?: string; size?: string; targetClass?: string }) =>
      request<StudyMaterial>("/study-materials", { method: "POST", body: JSON.stringify(data) }),
    uploadFile: (data: { fileName: string; base64Data: string; contentType?: string }) =>
      request<{ url: string; fileName: string; size: string; contentType: string }>("/study-materials/upload", { method: "POST", body: JSON.stringify(data) }),
    toggleBookmark: (id: string) =>
      request<{ bookmarked: boolean }>(`/study-materials/${id}/bookmark`, { method: "POST" }),
  },
  qa: {
    list: () => request<QaQuestion[]>("/qa"),
    ask: (data: { question: string; category?: string }) =>
      request<QaQuestion>("/qa", { method: "POST", body: JSON.stringify(data) }),
    answer: (id: string, answer: string) =>
      request<QaAnswer>(`/qa/${id}/answer`, { method: "POST", body: JSON.stringify({ answer }) }),
  },
  connections: {
    list: () => request<Connection[]>("/connections"),
    request: (toId: string) =>
      request<Connection>("/connections/request", { method: "POST", body: JSON.stringify({ toId }) }),
    accept: (id: string) =>
      request<Connection>(`/connections/${id}/accept`, { method: "PATCH" }),
    decline: (id: string) =>
      request<Connection>(`/connections/${id}/decline`, { method: "PATCH" }),
    remove: (id: string) =>
      request<{ success: boolean; id: string }>(`/connections/${id}`, { method: "DELETE" }),
  },
  memories: {
    list: () => request<Memory[]>("/memories"),
    create: (data: { caption?: string; imageUrl?: string }) =>
      request<Memory>("/memories", { method: "POST", body: JSON.stringify(data) }),
    toggleLike: (id: string) =>
      request<{ liked: boolean; likes: number }>(`/memories/${id}/like`, { method: "POST" }),
    profileList: (authorId: string, limit = 12, cursor?: string) => request<MemoryFeedPage>(
      `/memories?authorId=${encodeURIComponent(authorId)}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
    uploadMedia: (uri: string, fileName: string, mimeType?: string) => uploadMedia(uri, fileName, mimeType),
    cleanupUploads: (keys: string[]) => request<{ deleted: number }>("/memories/uploads", { method: "DELETE", body: JSON.stringify({ keys }) }),
  },
  achievements: {
    list: () => request<Achievement[]>("/achievements"),
    uploadImage: async (uri: string, fileName: string, mimeType?: string) => {
      const response = await fetch(uri);
      if (!response.ok) throw new Error("The selected photo could not be read. Please choose it again.");
      const image = await response.blob();
      if (!image.size || image.size > 10 * 1024 * 1024) throw new Error("Choose a photo under 10 MB.");
      return request<{ key: string }>("/achievements/uploads", {
        method: "POST",
        headers: { "Content-Type": mimeType || image.type || "application/octet-stream", "X-Media-Filename": encodeURIComponent(fileName) },
        body: image,
      }, 120000);
    },
    cleanupImage: (key: string) => request<{ deleted: number }>("/memories/uploads", { method: "DELETE", body: JSON.stringify({ keys: [key] }) }),
    create: (data: { title: string; description: string; category?: string; imageKey?: string }) =>
      request<Achievement>("/achievements", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { title: string; description: string; category?: string; imageKey?: string }) =>
      request<Achievement>(`/achievements/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<{ deleted: boolean }>(`/achievements/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  clubs: {
    list: () => request<ClubWithMeta[]>("/clubs"),
    create: (data: { name: string; description: string; icon?: string; color?: string; bg?: string }) =>
      request<ClubWithMeta>("/clubs", { method: "POST", body: JSON.stringify(data) }),
    toggleJoin: (id: string) =>
      request<{ joined: boolean; joinStatus: string }>(`/clubs/${id}/join`, { method: "POST" }),
    postAnnouncement: (id: string, text: string) =>
      request<ClubAnnouncement>(`/clubs/${id}/announcements`, { method: "POST", body: JSON.stringify({ text }) }),
    takeOver: (id: string) =>
      request<ClubWithMeta>(`/clubs/${id}/manager`, { method: "PATCH" }),
    requests: () => request<ClubJoinRequest[]>("/clubs/requests"),
    chat: (id: string) =>
      request<{ id: string; name: string }>(`/clubs/${id}/chat`, { method: "POST" }),
    leave: (id: string) =>
      request<{ joined: boolean; joinStatus?: string }>(`/clubs/${id}/leave`, { method: "POST" }),
    reviewRequest: (clubId: string, requestId: string, decision: "approved" | "denied") =>
      request<{ requestId: string; clubId: string; status: string; studentId: string }>(`/clubs/${clubId}/requests/${requestId}`, { method: "PATCH", body: JSON.stringify({ decision }) }),
  },
  studentQueries: {
    list: () => request<StudentQueryWithAnswers[]>("/student-queries"),
    create: (data: { question: string; subject?: string; category?: string }) =>
      request<StudentQueryWithAnswers>("/student-queries", { method: "POST", body: JSON.stringify(data) }),
    answer: (id: string, answer: string) =>
      request<QueryAnswer>(`/student-queries/${id}/answer`, { method: "POST", body: JSON.stringify({ answer }) }),
  },
  reports: {
    submit: (data: { reportedUserId: string; reason: string; details?: string }) =>
      request<Report>("/reports", { method: "POST", body: JSON.stringify(data) }),
    list: () => request<Report[]>("/reports"),
    alumniModeration: () => request<AlumniModerationReport[]>("/reports/alumni"),
    moderateAlumni: (id: string, decision: string, reason: string) => request<AlumniModerationReport>(`/reports/${encodeURIComponent(id)}/alumni-review`, { method: "POST", body: JSON.stringify({ decision, reason }) }),
  },
  directMessages: {
    conversations: () => request<DirectConversation[]>("/direct-conversations"),
    messages: (conversationId: string) => request<DirectMessage[]>(`/direct-conversations/${encodeURIComponent(conversationId)}/messages`),
    send: (conversationId: string, content: string) => request<DirectMessage>(`/direct-conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
    typing: (conversationId: string) => request<{ typing: string[] }>(`/direct-conversations/${encodeURIComponent(conversationId)}/typing`),
    setTyping: (conversationId: string, typing: boolean) => request<{ ok: boolean }>(`/direct-conversations/${encodeURIComponent(conversationId)}/typing`, { method: "POST", body: JSON.stringify({ typing }) }),
    requests: () => request<DirectMessageRequest[]>("/direct-message-requests"),
    sendRequest: (recipientId: string, content: string) => request<DirectMessageRequest>("/direct-message-requests", { method: "POST", body: JSON.stringify({ recipientId, content }) }),
    respondToRequest: (requestId: string, decision: "accept" | "decline") => request<{ success: boolean; status: string }>(`/direct-message-requests/${encodeURIComponent(requestId)}`, { method: "PATCH", body: JSON.stringify({ decision }) }),
  },
  notifications: {
    list: (params?: { filter?: string; limit?: number }) => request<SocialNotification[]>(`/social-notifications${queryString(params ?? {})}`),
    unreadCount: () => request<NotificationCounts>("/social-notifications/unread-count"),
    markRead: (id: string) => request<{ id: string; readAt: string }>(`/social-notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
    markUnread: (id: string) => request<{ id: string; readAt: null }>(`/social-notifications/${encodeURIComponent(id)}/unread`, { method: "PATCH" }),
    markAllRead: () => request<{ success: boolean; readAt: string }>("/social-notifications/read-all", { method: "PATCH" }),
    delete: (id: string) => request<{ success: boolean; id: string }>(`/social-notifications/${encodeURIComponent(id)}`, { method: "DELETE" }),
    clearAll: () => request<{ success: boolean }>("/social-notifications/clear-all", { method: "DELETE" }),
    getPreferences: () => request<NotificationPreferences>("/social-notifications/preferences"),
    updatePreferences: (updates: Partial<NotificationPreferences>) => request<NotificationPreferences>("/social-notifications/preferences", { method: "PATCH", body: JSON.stringify(updates) }),
  },
  storeAdmin: {
    login: (email: string, password: string) => adminRequest<StoreAdminLoginResponse>("/store-admin/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    loginWithFirebase: (idToken: string) => adminRequest<StoreAdminLoginResponse>("/store-admin/login/firebase", { method: "POST", body: JSON.stringify({ idToken }) }),
    me: () => adminRequest<{ staff: StoreAdminStaff }> ("/store-admin/me"),
    logout: () => adminRequest<{ ok: boolean }>("/store-admin/logout", { method: "POST" }),
    dashboard: () => adminRequest<StoreAdminDashboard>("/store-admin/dashboard"),
    products: (params: { page?: number; pageSize?: number; q?: string; status?: string } = {}) => adminRequest<StoreAdminProductPage>(`/store-admin/products${queryString(params)}`),
    createProduct: (product: StoreAdminProductInput) => adminRequest<StoreAdminProduct>("/store-admin/products", { method: "POST", body: JSON.stringify(product) }),
    updateProduct: (id: string, product: Partial<StoreAdminProductInput>) => adminRequest<StoreAdminProduct>(`/store-admin/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(product) }),
    archiveProduct: (id: string) => adminRequest<{ id: string; status: string }>(`/store-admin/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
    categories: () => adminRequest<StoreAdminCategory[]>("/store-admin/categories"),
    createCategory: (category: { name: string; description?: string; imageUrl?: string }) => adminRequest<StoreAdminCategory>("/store-admin/categories", { method: "POST", body: JSON.stringify(category) }),
    updateCategory: (id: string, updates: Partial<Pick<StoreAdminCategory, "name" | "description" | "imageUrl" | "visible">>) => adminRequest<StoreAdminCategory>(`/store-admin/categories/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(updates) }),
    deactivateCategory: (id: string) => adminRequest<{ id: string; visible: boolean }>(`/store-admin/categories/${encodeURIComponent(id)}`, { method: "DELETE" }),
    sellers: (status?: string) => adminRequest<{ items: StoreSeller[] }>(`/store-admin/sellers${queryString({ status })}`),
    updateSeller: (id: string, status: "approved" | "rejected" | "suspended") => adminRequest<StoreSeller>(`/store-admin/sellers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    auditLogs: (limit = 50) => adminRequest<{ items: ApiRecord[] }>(`/store-admin/audit-logs${queryString({ limit })}`),
    staff: () => adminRequest<{ items: StoreAdminMember[] }>("/store-admin/staff"),
    assignStaff: (email: string, role: StoreAdminRole, currentPassword: string) => adminRequest<ApiRecord>("/store-admin/staff", { method: "POST", body: JSON.stringify({ email, role, currentPassword }) }),
    updateStaff: (userId: string, updates: { role?: StoreAdminRole; active?: boolean; currentPassword: string }) => adminRequest<ApiRecord>(`/store-admin/staff/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify(updates) }),
  },
  store: {
    config: () => request<StoreConfig>("/store/config"),
    categories: () => request<StoreCategory[]>("/store/categories"),
    products: (params: { q?: string; category?: string; brand?: string; minPricePaise?: number; maxPricePaise?: number; sort?: string; page?: number; pageSize?: number } = {}) => request<StoreProductPage>(`/store/products${queryString(params)}`),
    product: (id: string) => request<StoreProduct & { reviews: StoreReview[]; reviewCount: number; averageRating: number | null }>(`/store/products/${encodeURIComponent(id)}`),
    cart: () => request<{ items: StoreCartItem[]; subtotalPaise: number }>("/store/cart"),
    setCartItem: (productId: string, quantity: number, variantSelection: Record<string, string> = {}) => request<{ id: string }>("/store/cart/items", { method: "PUT", body: JSON.stringify({ productId, quantity, variantSelection }) }),
    removeCartItem: (cartItemId: string) => request<{ removed: boolean }>(`/store/cart/items/${encodeURIComponent(cartItemId)}`, { method: "DELETE" }),
    addresses: () => request<StoreAddress[]>("/store/addresses"),
    addAddress: (address: StoreAddressInput) => request<StoreAddress>("/store/addresses", { method: "POST", body: JSON.stringify(address) }),
    updateAddress: (id: string, address: StoreAddressInput) => request<StoreAddress>(`/store/addresses/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(address) }),
    deleteAddress: (id: string) => request<{ deleted: boolean }>(`/store/addresses/${encodeURIComponent(id)}`, { method: "DELETE" }),
    wishlist: () => request<{ items: StoreProduct[] }>("/store/wishlist"),
    saveWishlist: (productId: string) => request<{ saved: boolean }>(`/store/wishlist/${encodeURIComponent(productId)}`, { method: "POST" }),
    removeWishlist: (productId: string) => request<{ saved: boolean }>(`/store/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" }),
    previewCheckout: (addressId: string) => request<StoreCheckoutPreview>("/store/checkout/preview", { method: "POST", body: JSON.stringify({ addressId }) }),
    placeOrder: (addressId: string, idempotencyKey: string, paymentMethod = "upi") => request<StoreOrderDetails>("/store/orders", { method: "POST", body: JSON.stringify({ addressId, idempotencyKey, paymentMethod }) }),
    cancelOrder: (id: string, reason?: string) => request<StoreOrder>(`/store/orders/${encodeURIComponent(id)}/cancel`, { method: "PATCH", body: JSON.stringify({ reason }) }),
    orders: () => request<{ items: StoreOrder[] }>("/store/orders"),
    order: (id: string) => request<StoreOrderDetails>(`/store/orders/${encodeURIComponent(id)}`),
    reviews: (productId: string) => request<StoreReview[]>(`/store/products/${encodeURIComponent(productId)}/reviews`),
    submitReview: (productId: string, rating: number, body: string) => request<StoreReview>(`/store/products/${encodeURIComponent(productId)}/reviews`, { method: "POST", body: JSON.stringify({ rating, body }) }),
    applyAsSeller: (displayName: string, description: string) => request<StoreSeller>("/store/sellers/apply", { method: "POST", body: JSON.stringify({ displayName, description }) }),
    sellerApplication: () => request<StoreSeller>("/store/sellers/me"),
  },
};

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
  verificationStatus?: "unverified" | "pending" | "verified" | "community_verified" | "under_review" | "rejected" | "suspended" | "revoked";
  communityVerifiedAt?: string;
  resumeUrl?: string;
  subject?: string;
  designation?: string;
  bio?: string;
  phone?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  uploadedPhotoURL?: string;
  avatarConfig?: import("@workspace/api-zod").AvatarConfig;
  avatarThumbnailURL?: string;
  profileImageType?: "photo" | "avatar" | "default";
  profileVisibility?: "public" | "private";
  isPremium?: boolean;
  premiumExpiresAt?: string;
  instagramUrl?: string;
  currentLocation?: string;
}

export interface SignupData extends Omit<UserProfile, "uid"> {
  password: string;
}

export interface AuthResponse {
  token: string;
  profile: UserProfile;
}

export interface RecognitionProfile {
  totalPoints: number;
  monthlyRank: number | null;
  annualRank: number | null;
  awardCount: number;
  awards: Array<{ id: string; category: string; period: string; score: number; summary: string }>;
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  category: string;
  authorId?: string;
  authorName?: string;
  jnvName?: string;
  createdAt: string;
  sourceName?: string;
  sourceUrl?: string;
  imageUrl?: string;
  publishedAt?: string;
  isLive?: boolean;
  language?: "en" | "hi";
}

export interface Group {
  id: string;
  name: string;
  subject: string;
  class?: string;
  jnvName?: string;
  jnvState?: string;
  teacherName?: string;
  teacherId?: string;
  memberCount?: number;
  createdAt: string;
  clubId?: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  lastMessageSenderId?: string | null;
  lastMessageSenderName?: string | null;
  avatarUrl?: string;
  adminOnlyMessages?: boolean;
}

export interface GroupSettings extends Group {
  canLeave: boolean;
  canDelete: boolean;
  canManageRoles: boolean;
  canConfigureAdminOnlyMessages: boolean;
  canUpdateAvatar: boolean;
  requiresAdminDecision: boolean;
  groupType?: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  text: string;
  senderName?: string | null;
  senderId?: string | null;
  role?: string | null;
  reactions?: string | null;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToSender?: string | null;
  isEdited?: boolean | null;
  deletedAt?: string | null;
  createdAt: string;
}

export interface MentorProfile { available: boolean; categories: string[]; bio: string }
export interface MentorDirectoryEntry extends AlumniUser { categories: string[]; bio: string }
export interface SchoolSupportRequest { id: string; alumniId: string; jnvId: string; type: string; note: string; status: string; outcome: string; createdAt: string; updatedAt: string }

export interface ReactionEntry {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  anonymous: boolean;
  submittedBy?: string;
  submittedByName?: string;
  jnvName?: string;
  createdAt: string;
}

export interface ProblemComment {
  id: string;
  problemId: string;
  text: string;
  authorId?: string;
  authorName?: string;
  role?: string;
  createdAt: string;
}

export interface ProblemWithComments extends Problem {
  comments: ProblemComment[];
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location?: string;
  organizer?: string;
  jnvName?: string;
  createdAt: string;
  organizerId?: string;
}

export interface AlumniUser {
  id: string;
  fullName: string;
  profession?: string;
  company?: string;
  field?: string;
  skills?: string[];
  jnvName?: string;
  verificationStatus?: string;
}

export interface PublicUserProfile {
  id: string;
  fullName: string;
  role: string;
  jnvName: string;
  jnvState: string;
  house?: string;
  photoURL?: string;
  class?: string;
  passoutYear?: string;
  profession?: string;
  field?: string;
  company?: string;
  skills: string[];
  verificationStatus?: string | null;
  subject?: string;
  designation?: string;
  bio?: string;
  profileVisibility?: "public" | "private";
  isRestricted?: boolean;
}

export interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  jnvName: string;
  jnvState: string;
  verificationStatus?: string;
  class?: string;
  profession?: string;
  subject?: string;
  createdAt: string;
  passoutYear?: string;
}

export interface MentorRequest {
  id: string;
  studentId?: string;
  studentName?: string;
  mentorId?: string;
  mentorName?: string;
  category?: string;
  message?: string;
  status: string;
  createdAt: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  feedbackRating?: number | null;
  feedback?: string | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string | null;
  type: string;
  category: string;
  description: string;
  postedBy?: string | null;
  postedByName?: string | null;
  postedByJnv?: string | null;
  createdAt: string;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  role: string;
  jnvName: string;
  jnvState: string;
  method: string;
  status: string;
  documentUrls?: string | null;
  notes?: string | null;
  infoRequest?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  evidenceSummary?: string | null;
  applicantResponse?: string | null;
  adminRecommendation?: string | null;
  adminNotes?: string | null;
  adminReviewedBy?: string | null;
  adminReviewedAt?: string | null;
  officialNotes?: string | null;
  officialReviewedBy?: string | null;
  officialReviewedAt?: string | null;
}

export interface TeacherFeedbackItem {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  jnvName: string;
  subject?: string | null;
  rating: number;
  comment: string;
  anonymous: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  target: string;
  priority: string;
  pinned: boolean;
  authorId?: string;
  authorName?: string;
  jnvName?: string;
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  note?: string;
  status: string;
  remarks?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface AssignmentWithSubs {
  id: string;
  title: string;
  subject: string;
  targetClass: string;
  dueDate: string;
  description?: string;
  authorId?: string;
  authorName?: string;
  jnvName?: string;
  createdAt: string;
  submissions: AssignmentSubmission[];
}

export interface StudyMaterial {
  id: string;
  title: string;
  subject: string;
  type: string;
  url?: string;
  size?: string;
  authorId?: string;
  authorName?: string;
  jnvName?: string;
  targetClass?: string;
  createdAt: string;
  bookmarked: boolean;
}

export interface QaAnswer {
  id: string;
  questionId: string;
  answer: string;
  answeredById?: string;
  answeredByName?: string;
  answeredByRole?: string;
  batch?: string;
  subject?: string;
  createdAt: string;
}

export interface QaQuestion {
  id: string;
  question: string;
  category: string;
  askedById?: string;
  askedByName?: string;
  askedByClass?: string;
  jnvName?: string;
  createdAt: string;
  answers: QaAnswer[];
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  status: string;
  createdAt: string;
}

export interface Memory {
  id: string;
  caption?: string;
  imageUrl?: string;
  authorId?: string;
  authorName?: string;
  jnvName?: string;
  likes: number;
  createdAt: string;
  liked: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string | null;
  authorId?: string;
  authorName?: string;
  jnvName?: string;
  batch?: string;
  createdAt: string;
}

export interface ClubAnnouncement {
  id: string;
  clubId: string;
  text: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
}

export interface ClubWithMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  members: number;
  managerId?: string;
  managerName?: string;
  jnvName?: string;
  nextEvent: string;
  createdAt: string;
  managed: boolean;
  joined: boolean;
  announcements: ClubAnnouncement[];
  joinStatus?: "none" | "pending" | "approved" | "denied";
}

export interface QueryAnswer {
  id: string;
  queryId: string;
  answer: string;
  answeredById?: string;
  answeredByName?: string;
  createdAt: string;
}

export interface StudentQueryWithAnswers {
  id: string;
  question: string;
  subject: string;
  category: string;
  studentId?: string;
  studentName?: string;
  studentClass?: string;
  jnvName?: string;
  solved: boolean;
  createdAt: string;
  answers: QueryAnswer[];
}

export interface Report {
  id: string;
  reportedUserId?: string;
  reportedUserName?: string;
  reason: string;
  details?: string;
  reporterId?: string;
  reporterName?: string;
  status: string;
  createdAt: string;
}


export interface ClubJoinRequest {
  id: string;
  clubId: string;
  studentId: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  student?: { id: string; fullName: string; role: string; class?: string; jnvName?: string };
  club?: { id: string; name: string };
}


export interface ProfileConnection {
  id: string;
  fullName: string;
  role: string;
  jnvName: string;
  photoURL?: string;
  isRestricted: boolean;
}


export interface ProfileStats {
  posts: number | null;
  followers: number | null;
  following: number | null;
  restricted: boolean;
}


export interface PublicCredentialStatus {
  status: "valid" | "suspended" | "revoked" | "not_found" | string;
  credentialId?: string;
  role?: string;
  jnvName?: string;
  jnvState?: string;
  issuedAt?: string;
}


export interface DigitalCredential {
  credentialId: string;
  userId: string;
  fullName: string;
  photoURL?: string | null;
  publicVerificationUrl: string | null;
  publicProfileUrl: string | null;
  status: string;
  role: string;
  jnvName: string;
  jnvState: string;
  issuedAt: string;
}


export interface VerificationAuditEvent {
  id: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  createdAt: string;
  actorName?: string | null;
}


export interface VerificationAssignment {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  jnvName: string;
  jnvState: string;
  assignmentRole: "admin" | "official";
  active: boolean;
}


export interface CredentialReconcilePreview {
  candidates: Array<{ id: string; fullName: string; role: string }>;
  reviewRequired: number;
  message: string;
}


export interface AlumniBatchProcessResult {
  batchId: string;
  status: string;
  summary: { selected: number; succeeded: number; alreadyTransitioned: number; skipped: number; failed: number };
  results: AlumniTransitionResult[];
}


export interface AlumniTransitionResult {
  id: string;
  userId: string;
  previousRole: string | null;
  newRole: string | null;
  result: "succeeded" | "already_transitioned" | "skipped" | "failed" | string;
  reason: string | null;
  credentialId: string | null;
}


export interface AlumniBatchPreview {
  batchId: string;
  jnvName: string;
  jnvState: string;
  graduationYear: string;
  totalClass12Accounts: number;
  alreadyTransitioned: number;
  reviewRequired: number;
  excluded: number;
  confirmationText: string;
  students: Array<{
    id: string;
    fullName: string;
    role: string;
    class: string | null;
    passoutYear: string | null;
    verificationStatus: string | null;
    graduationReview: "recorded" | "conflict" | "official_confirmation_required";
    selectable: boolean;
    reason: string;
  }>;
}


export interface DirectMessageRequest {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  status: string;
  createdAt: string;
}


export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string;
}


export interface DirectConversation {
  id: string;
  peerId: string;
  peerName: string;
  peerPhotoUrl?: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
}


export interface ChatContact {
  id: string;
  fullName: string;
  role: string;
  jnvName?: string;
  photoURL?: string;
}


export interface GroupMember {
  id: string;
  fullName: string;
  role: string;
  photoURL?: string;
  phone?: string;
  accountRole?: string;
  subject?: string | null;
}

// Shared response types used by the feature screens. Keep API response shapes
// extensible while endpoints continue to evolve independently.
type ApiRecord = Record<string, any>;
export type StoreAdminRole = "super_admin" | "store_manager" | "product_manager" | "order_manager" | "inventory_manager" | "seller_manager" | "finance_manager" | "customer_support";
export interface StoreAdminStaff { name: string; email: string; role: StoreAdminRole; permissions: string[] }
export interface StoreAdminLoginResponse { token: string; expiresInSeconds: number; staff: StoreAdminStaff }
export interface StoreAdminProductInput { name: string; description?: string; pricePaise: number; originalPricePaise?: number | null; sku?: string | null; brand?: string | null; variants?: Array<{ name: string; options: Array<{ value: string; stock: number }> }>; stock?: number; discountPercent?: number; categoryId?: string | null; images?: string[]; specifications?: Record<string, string>; status?: string; featured?: boolean }
export interface StoreAdminProduct extends StoreAdminProductInput { id: string; pricePaise: number; stock: number; status: string; createdAt: string; updatedAt: string }
export interface StoreAdminProductPage { items: StoreAdminProduct[]; page: number; pageSize: number; total: number }
export interface StoreAdminCategory { id: string; name: string; description: string | null; imageUrl: string | null; visible: boolean }
export interface StoreAdminMember { userId: string; name: string; email: string; role: StoreAdminRole; active: boolean; createdAt: string }
export interface StoreAdminDashboard { products: { total: number; published: number; lowStock: number; outOfStock: number }; sellers: { total: number; pending: number }; availableModules: string[]; integrations: { payments: string; delivery: string } }
export interface StoreConfig { paymentsEnabled: boolean; deliveryEnabled: boolean; checkoutEnabled: boolean; paymentCredentialsPresent: boolean; deliveryConfigurationPresent: boolean; note?: string }
export interface StoreCategory { id: string; name: string; description?: string | null; imageUrl?: string | null }
export interface StoreProduct { id: string; name: string; description: string; specifications?: Record<string, string>; images: string[]; pricePaise: number; originalPricePaise?: number | null; discountPercent: number; sku?: string | null; brand?: string | null; variants: Array<{ name: string; options: Array<{ value: string; stock: number }> }>; stock: number; featured: boolean; categoryId: string | null; category: string | null; createdAt: string }
export interface StoreProductPage { items: StoreProduct[]; page: number; pageSize: number; total: number; hasMore: boolean }
export interface StoreCartItem { id: string; productId: string; variantSelection: string; quantity: number; productName: string; pricePaise: number; stock: number; status: string; images: string[]; categoryId: string | null; category: string | null; updatedAt: string }
export interface StoreAddressInput { recipientName: string; phone: string; type: "home" | "hostel" | "school" | "other"; line1: string; line2?: string; city: string; district: string; state: string; pincode: string; instructions?: string; isDefault?: boolean }
export interface StoreAddress extends StoreAddressInput { id: string; createdAt: string; updatedAt: string }
export interface StoreCheckoutPreview { items: Array<{ productId: string; name: string; quantity: number; pricePaise: number; stock: number; status: string }>; subtotalPaise: number; shippingPaise: number | null; discountPaise?: number; totalPaise: number | null; address: Pick<StoreAddress, "id" | "type" | "city" | "district" | "state" | "pincode">; canPlaceOrder: boolean; unavailable: Array<unknown>; integrations: StoreConfig; message?: string }
export interface StoreOrder { id: string; orderNumber: string; subtotalPaise: number; shippingPaise: number; discountPaise: number; totalPaise: number; status: string; paymentStatus: string; createdAt: string }
export interface StoreOrderDetails extends StoreOrder { items: Array<{ id: string; productName: string; unitPricePaise: number; quantity: number; imageUrl: string | null }>; events: Array<{ status: string; note: string | null; createdAt: string }> }
export interface StoreReview { id: string; rating: number; body: string; reviewer?: string; createdAt: string }
export interface StoreSeller { id: string; displayName: string; description: string; status: string }
export interface AcademicStudent {
  id: string;
  fullName: string;
  class: string | null;
  photoURL?: string | null;
  uploadedPhotoURL?: string | null;
  house?: string | null;
  enrollYear?: string | null;
}

export interface TeacherClassesOverview {
  totalAssignedClasses: number;
  totalStudents: number;
  pendingAssignments: number;
  upcomingTests: number;
  recentActivities: Array<{
    id: string;
    title: string;
    description: string;
    type: "assignment" | "material" | "announcement" | "attendance" | "test";
    timestamp: string;
    icon: string;
    color: string;
  }>;
}

export interface ClassDetailOverview {
  assignment: TeacherClassAssignment;
  totalStudents: number;
  todayAttendanceRate: number;
  pendingAssignments: number;
  upcomingExams: number;
  performanceAverage: number;
  announcements: Announcement[];
}

export interface ClassAttendanceRecord {
  id: string;
  assignmentId: string;
  className: string;
  section: string;
  date: string;
  markedById: string;
  markedByName: string;
  recordedAt: string;
  students: Array<{
    studentId: string;
    studentName: string;
    status: "present" | "absent" | "leave";
    remarks?: string;
  }>;
}

export interface ClassAssessmentRecord {
  id: string;
  assignmentId: string;
  className: string;
  section: string;
  subject: string;
  title: string;
  date: string;
  totalMarks: number;
  weightage?: number;
  createdById: string;
  createdByName: string;
  published: boolean;
  createdAt: string;
  scores: Array<{
    studentId: string;
    studentName: string;
    marksObtained: number;
    remarks?: string;
    grade?: string;
  }>;
}

export interface ClassTimetableSlot {
  period: number;
  time: string;
  subject: string;
  teacherName: string;
  room?: string;
}

export interface ClassTimetableData {
  assignmentId: string;
  className: string;
  section: string;
  schedule: Record<string, ClassTimetableSlot[]>;
}
export type AlumniModerationReport = ApiRecord;
export type BloodRequest = ApiRecord;
export type Business = ApiRecord;
export interface BusinessDetails extends Business { mediaUrls: string[]; reviews: BusinessReview[] }
export type BusinessReview = ApiRecord;
export interface DrawingStroke { color: string; size: number; points: Array<{ x: number; y: number }> }
export type GameDifficulty = "easy" | "medium" | "hard";
export type GameId = "gk-blitz" | "word-master" | "math-ninja" | "art-battle" | "chess-cup";
export type GameResult = ApiRecord;
export interface GameSummary { points: number; houses: Array<{ house: string; points: number }> }
export interface GameQuestion { round: number; total: number; category?: string; prompt: string; type: string; options?: string[]; definition?: string }
export interface Opportunity extends ApiRecord { id: string; title: string; status: string; eligibleRoles: string[]; eligibleClasses: string[] }
export interface SavedOpportunity extends Opportunity { savedAt: string }
export interface OpportunityAnalytics extends ApiRecord { totalOpportunities: number; activeOpportunities: number; registrations: number; submissions: number }
export interface OpportunityDetails extends Opportunity { eligibleRoles: string[]; eligibleClasses: string[]; mySubmission?: OpportunitySubmission | null }
export type OpportunityInput = ApiRecord;
export type OpportunityParticipant = ApiRecord;
export interface OpportunityRegistration extends Opportunity { registrationStatus: string; resultsPublished?: boolean; submission?: OpportunitySubmission | null }
export interface OpportunitySubmission extends ApiRecord { id: string; content?: string; submissionUrl?: string; status: string; score: number | null; organizerFeedback: string; submittedAt: string }
export interface RecognitionAdminPoint extends ApiRecord { id: string; userName: string; reason: string; periodMonth: string; points: number }
export interface RecognitionAward extends ApiRecord { id: string; category: string; period: string; score: number; summary: string; status: string; winnerName?: string; jnvName?: string }
export interface RecognitionLeader extends ApiRecord { userId: string; fullName: string; role: string; jnvName: string; score: number; activityCount: number; communityScore: number; mentorScore: number; careerScore: number; impactScore: number }
export interface RecognitionRule extends ApiRecord { activity: string; points: number; dailyLimit: number; enabled: string }
export interface RecognitionSummary extends ApiRecord { totalPoints: number; contributionCount: number; history: RecognitionAdminPoint[]; awards: RecognitionAward[]; nextHistoryOffset: number | null }
export interface SchoolAdminDashboardMetrics { classes: number; students: number; events: number; issues: number }
export interface SchoolClassList { classes: Array<{ className: string; students: number }>; unassignedStudents: number }
export type SchoolDirectoryEntry = { id: string; fullName: string; role: string; jnvName: string; jnvState: string; photoURL?: string | null; class?: string | null; house?: string | null; subject?: string | null; designation?: string | null; verificationStatus: string; createdAt: string }
export interface SchoolDirectoryPage { users: SchoolDirectoryEntry[]; classes: Array<{ className: string | null; students: number }>; school: { jnvName: string; jnvState: string }; counts: Record<string, number>; total: number; page: number; pageSize: number }
export type AcademicAssignmentType = "class_teacher" | "subject_teacher";
export interface AcademicTeacherAssignment { id: string; jnvId: string; jnvName: string; jnvState: string; teacherId: string; teacherName: string; className: string; section: string; subject: string; assignmentType: AcademicAssignmentType; academicYear: string; periodsPerWeek: number | null; assignedById: string; modifiedById: string | null; active: boolean; createdAt: string; updatedAt: string; revokedAt: string | null }
export interface AcademicManagementOverview {
  academicYear: string;
  academicYears: string[];
  teachers: Array<{ id: string; fullName: string; subject: string | null }>;
  classSections: Array<{ className: string; section: string; students: number }>;
  assignments: AcademicTeacherAssignment[];
  history: Array<{ id: string; assignmentId: string | null; actorName: string; actorId: string | null; action: "created" | "updated" | "removed"; academicYear: string; previousData: Record<string, unknown> | null; newData: Record<string, unknown> | null; createdAt: string }>;
  settings: { allowMultipleSubjectTeachers: boolean };
  summary: { classTeacherAssignments: number; subjectTeacherAssignments: number; teachersAssigned: number; classSections: number; configuredPeriodsPerWeek: number; workloads: Array<{ teacherId: string; teacherName: string; classes: number; subjects: number; periodsPerWeek: number }>; timetableAvailable: boolean };
}
export interface StartedGame { sessionId: string; gameId: GameId; difficulty: GameDifficulty; seconds: number; total: number; prompt?: string; question: GameQuestion | null }
export interface TeacherClassAssignment { id: string; teacherId: string; teacherName: string; className: string; subject: string; active: boolean; jnvName?: string; jnvState?: string; assignmentType?: AcademicAssignmentType; section?: string; academicYear?: string; periodsPerWeek?: number | null; revokedAt?: string | null }
export type UploadedMemoryMedia = ApiRecord;
export type VerifiedTeacher = ApiRecord;
export type YearbookEntry = ApiRecord;
export type YearbookReviewItem = ApiRecord;
export type YearbookSubmission = ApiRecord;

export interface Event {
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
}

export interface AlumniUser {
  isRestricted?: boolean;
}

export interface PublicUserProfile {
  resumeUrl?: string | null;
}

export interface Memory {
  mediaUrls?: string[];
}

export interface SocialNotification {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  actorPhotoURL?: string | null;
  actorRole?: string | null;
  actorJnvName?: string | null;
  entityId?: string | null;
  message: string;
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationPreferences {
  userId: string;
  likesComments: boolean;
  followsConnections: boolean;
  messages: boolean;
  alumniVerification: boolean;
  opportunities: boolean;
  mentorship: boolean;
  events: boolean;
  systemAnnouncements: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  updatedAt: string;
}

export interface NotificationCounts {
  unreadCount: number;
  counts: Record<string, number>;
}

export interface AlumniMembershipPlan {
  id: string;
  slug: string;
  name: string;
  billingCycle: "monthly" | "yearly";
  durationMonths: number;
  pricePaise: number;
  originalPricePaise?: number | null;
  features: string[];
  isActive: boolean;
}

export interface AlumniMembershipStatus {
  isPremium: boolean;
  membership: {
    id: string;
    userId: string;
    planId: string;
    status: "active" | "expired" | "cancelled" | "pending";
    startsAt: string;
    expiresAt: string;
    renewedAt?: string | null;
  } | null;
  plan: AlumniMembershipPlan | null;
  expiresAt: string | null;
  daysRemaining: number;
}

export interface ProfileInsightsMetric {
  value: number;
  formatted: string;
  trend: string;
  label: string;
}

export interface ProfileInsightsData {
  range: string;
  periodLabel: string;
  stats: {
    profileVisits: ProfileInsightsMetric;
    uniqueVisitors: ProfileInsightsMetric;
    postLikes: ProfileInsightsMetric;
    shares: ProfileInsightsMetric;
  };
}

export interface CompetitionDashboardData {
  user: {
    id: string;
    fullName: string;
    house: string;
    houseMeta: { name: string; color: string; emoji: string };
    individualPoints: number;
    houseRank: number;
  };
  houseStandings: Array<{
    house: string;
    displayName: string;
    color: string;
    emoji: string;
    points: number;
    progressPercent: number;
  }>;
  liveBattlesCount: number;
  todayPuzzles: Array<{
    id: string;
    puzzleType: string;
    title: string;
    maxRewardPoints: number;
    completed: boolean;
  }>;
  connectionStatus: string;
}

export interface HouseBattleItem {
  id: string;
  title: string;
  format: string;
  houseA: string;
  houseB: string;
  houseAMeta: { name: string; color: string; emoji: string };
  houseBMeta: { name: string; color: string; emoji: string };
  status: "scheduled" | "lobby" | "live" | "completed" | "cancelled";
  scoreA: number;
  scoreB: number;
  winnerHouse?: string | null;
  questions?: Array<{ id: number; prompt: string; options: string[] }>;
  durationSeconds: number;
  startsAt?: string | null;
  completedAt?: string | null;
}

export interface DailyPuzzleItem {
  id: string;
  puzzleType: "word_of_day" | "connections" | "number_ninja" | "mini_crossword" | "daily_gk" | "pattern_master";
  title: string;
  puzzleDate: string;
  maxRewardPoints: number;
  puzzleData: Record<string, any>;
  hasAttempted: boolean;
  isCompleted: boolean;
  scoreAwarded: number;
  attemptsUsed: number;
  streakCount: number;
}

export interface PlayerLeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  photoURL?: string | null;
  house: string;
  houseDisplayName: string;
  houseColor: string;
  houseEmoji: string;
  totalPoints: number;
  gamesPlayed: number;
  isCurrentUser: boolean;
}

export interface HouseChampionshipStanding {
  rank: number;
  house: string;
  displayName: string;
  color: string;
  emoji: string;
  motto: string;
  totalPoints: number;
  progressPercent: number;
  victories: number;
}

export interface CompetitionActivityItem {
  id: string;
  userId: string;
  userName: string;
  photoURL?: string | null;
  house: string;
  houseDisplayName: string;
  houseColor: string;
  houseEmoji: string;
  points: number;
  sourceType: string;
  reason: string;
  createdAt: string;
}

export interface UserBadgeInfo {
  badgeKey: string;
  badgeTitle: string;
  icon: string;
  color: string;
  currentPoints: number;
  nextTierPoints: number;
  progressPercent: number;
}

export interface IndividualRankingItem {
  rank: number;
  userId: string;
  fullName: string;
  role: string;
  jnvName: string;
  jnvState: string;
  avatarUrl?: string | null;
  periodPoints: number;
  activityCount: number;
  badge: UserBadgeInfo;
  rankMovement: "up" | "down" | "same" | "new";
  isCurrentUser: boolean;
}

export interface JnvRankingScoreItem {
  id: string;
  jnvName: string;
  jnvState: string;
  region: string;
  period: string;
  periodType: string;
  institutionalScore: number;
  communityScore: number;
  totalScore: number;
  rank: number;
  dataCoverage: "sufficient" | "insufficient_data";
  categoryBreakdown: {
    academic: number;
    studentDevelopment: number;
    wellbeing: number;
    infrastructure: number;
    alumni: number;
    communityContribution: number;
  };
  activeContributorsCount: number;
  status: string;
}

export interface RankingAwardItem {
  id: string;
  awardType: "navodaya_of_the_month" | "navodayan_of_the_month" | "navodaya_of_the_year" | "navodayan_of_the_year";
  period: string;
  periodType: "month" | "year";
  targetType: "user" | "jnv";
  winnerUserId?: string | null;
  winnerJnvName?: string | null;
  winnerJnvState?: string | null;
  winnerName: string;
  winnerRole?: string | null;
  winnerAvatarUrl?: string | null;
  score: number;
  summary: string;
  highlights?: string[];
  scorecard: Record<string, unknown>;
  status: string;
  finalizedAt?: string | null;
}

export interface RankingOverviewData {
  userStats: {
    userId: string;
    fullName: string;
    jnvName: string;
    role: string;
    totalPoints: number;
    monthPoints: number;
    rank: number;
    badge: UserBadgeInfo;
  };
  topIndividuals: IndividualRankingItem[];
  topJnvs: JnvRankingScoreItem[];
  currentAwards: {
    navodayaMonth?: RankingAwardItem | null;
    navodayanMonth?: RankingAwardItem | null;
    navodayaYear?: RankingAwardItem | null;
    navodayanYear?: RankingAwardItem | null;
  };
  recentActivity: Array<{
    id: string;
    userId: string;
    userName: string;
    jnvName: string;
    points: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface RankingMethodologyData {
  title: string;
  version: string;
  individualScoring: {
    description: string;
    activities: Array<{ activity: string; points: number; note: string }>;
    badges: Array<{ badge: string; range: string; color: string }>;
    tieBreakPolicy: string;
  };
  jnvInstitutionalScoring: {
    institutionalWeight: string;
    communityWeight: string;
    categories: Array<{ category: string; weight: string; metrics: string }>;
    normalizationPolicy: string;
    dataCoveragePolicy: string;
    disclaimer: string;
  };
}

export interface RankingProfileData {
  user: {
    id: string;
    fullName: string;
    role: string;
    jnvName: string;
    jnvState: string;
    avatarUrl?: string | null;
    verificationStatus: string;
  };
  stats: {
    totalPoints: number;
    monthlyPoints: number;
    annualPoints: number;
    rank: number;
    badge: UserBadgeInfo;
  };
  earnedBadges: Array<{
    id: string;
    badgeKey: string;
    badgeTitle: string;
    badgeType: string;
    icon: string;
    color: string;
    unlockedAt: string;
  }>;
  earnedAwards: RankingAwardItem[];
  activityBreakdown: Array<{
    activity: string;
    count: number;
    totalPoints: number;
  }>;
  pointsHistory: Array<{
    id: string;
    activity: string;
    points: number;
    reason: string;
    periodMonth: string;
    createdAt: string;
  }>;
}
