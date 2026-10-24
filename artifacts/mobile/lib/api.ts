import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { MemoryFeedPage } from "@workspace/api-client-react";

const TOKEN_KEY = "auth_token";

function getBaseUrl(): string {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const expoHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (configuredApiUrl) {
    // In Expo Go, localhost points to the phone itself. Reuse the Metro LAN host
    // when the local .env still has the usual localhost API URL.
    if (
      Platform.OS !== "web" &&
      expoHost &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(configuredApiUrl)
    ) {
      return configuredApiUrl.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)/i, `$1${expoHost}`).replace(/\/+$/, "");
    }
    return configuredApiUrl.replace(/\/+$/, "");
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  if (Platform.OS !== "web" && expoHost) return `http://${expoHost}:3001/api`;
  return "http://localhost:3001/api";
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(body.error || `Request failed: ${res.status}`) as Error & {
      code?: string;
      status?: number;
    };
    error.code = body.code;
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const api = {
  auth: {
    signup: (data: SignupData) =>
      request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
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
  news: {
    list: () => request<NewsItem[]>("/news"),
    create: (data: { title: string; description: string; category: string; sourceName?: string; sourceUrl?: string; imageUrl?: string; publishedAt?: string }) =>
      request<NewsItem>("/news", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/news/${id}`, { method: "DELETE" }),
  },
  groups: {
    list: () => request<Group[]>("/groups"),
    ensureCommunity: (data: { kind: "house" | "class" | "batch" | "school" | "all" | "interest"; interestId?: string }) =>
      request<Group>("/groups/ensure-community", { method: "POST", body: JSON.stringify(data) }),
    create: (data: { name: string; memberIds?: string[]; subject?: string; class?: string }) =>
      request<Group>("/groups", { method: "POST", body: JSON.stringify(data) }),
    members: (groupId: string) => request<GroupMember[]>(`/groups/${encodeURIComponent(groupId)}/members`),
    addMembers: (groupId: string, memberIds: string[]) => request<GroupMember[]>(`/groups/${encodeURIComponent(groupId)}/members`, { method: "POST", body: JSON.stringify({ memberIds }) }),
    getMessages: (groupId: string, before?: { createdAt: string; id: string }) => request<GroupMessage[]>(
      `/groups/${groupId}/messages${before ? `?before=${encodeURIComponent(before.createdAt)}&beforeId=${encodeURIComponent(before.id)}` : ""}`,
    ),
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
    create: (data: { title: string; description: string; date: string; location?: string }) =>
      request<Event>("/events", { method: "POST", body: JSON.stringify(data) }),
    register: (id: string, data: Record<string, string>) =>
      request<Record<string, unknown>>(`/events/${encodeURIComponent(id)}/register`, { method: "POST", body: JSON.stringify(data) }),
  },
  users: {
    alumni: () => request<AlumniUser[]>("/users/alumni"),
    search: (query: string) => request<ChatContact[]>(`/users/search?q=${encodeURIComponent(query)}`),
    get: (id: string) => request<PublicUserProfile>(`/users/profile/${encodeURIComponent(id)}`),
    profileStats: (id: string) => request<ProfileStats>(`/users/${encodeURIComponent(id)}/profile-stats`),
    followers: (id: string) => request<ProfileConnection[]>(`/users/${encodeURIComponent(id)}/followers`),
    following: (id: string) => request<ProfileConnection[]>(`/users/${encodeURIComponent(id)}/following`),
    updateMe: (data: Partial<UserProfile>) =>
      request<UserProfile>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
    manage: () => request<ManagedUser[]>("/users/manage"),
    suspend: (id: string, suspended: boolean) =>
      request<ManagedUser>(`/users/${id}/suspend`, { method: "PATCH", body: JSON.stringify({ suspended }) }),
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
  mentorRequests: {
    list: () => request<MentorRequest[]>("/mentor-requests"),
    create: (data: { mentorId: string; mentorName: string; category: string; message: string }) =>
      request<MentorRequest>("/mentor-requests", { method: "POST", body: JSON.stringify(data) }),
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
    requests: () => request<VerificationRequest[]>("/verification/requests"),
    resubmit: (id: string, data: { applicantResponse: string; documentUrls?: string[] }) =>
      request<VerificationRequest>(`/verification/requests/${encodeURIComponent(id)}/resubmit`, { method: "POST", body: JSON.stringify(data) }),
    withdraw: (id: string) => request<{ success: boolean; status: string }>(`/verification/requests/${encodeURIComponent(id)}/withdraw`, { method: "POST" }),
    create: (data: { evidenceSummary: string; documentUrls: string[] }) =>
      request<VerificationRequest>("/verification/requests", { method: "POST", body: JSON.stringify(data) }),
    review: (id: string, status: string, notes?: string, infoRequest?: string) =>
      request<VerificationRequest>(`/verification/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes, infoRequest }),
      }),
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
  },
  memories: {
    list: () => request<Memory[]>("/memories"),
    profileList: (authorId: string, limit = 12, cursor?: string) => request<MemoryFeedPage>(
      `/memories?authorId=${encodeURIComponent(authorId)}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
    create: (data: { caption?: string; imageUrl?: string }) =>
      request<Memory>("/memories", { method: "POST", body: JSON.stringify(data) }),
    toggleLike: (id: string) =>
      request<{ liked: boolean; likes: number }>(`/memories/${id}/like`, { method: "POST" }),
  },
  achievements: {
    list: () => request<Achievement[]>("/achievements"),
    create: (data: { title: string; description: string; category?: string }) =>
      request<Achievement>("/achievements", { method: "POST", body: JSON.stringify(data) }),
  },
  clubs: {
    list: () => request<ClubWithMeta[]>("/clubs"),
    requests: () => request<ClubJoinRequest[]>("/clubs/requests"),
    create: (data: { name: string; description: string; icon?: string; color?: string; bg?: string }) =>
      request<ClubWithMeta>("/clubs", { method: "POST", body: JSON.stringify(data) }),
    toggleJoin: (id: string) =>
      request<{ joined: boolean }>(`/clubs/${id}/join`, { method: "POST" }),
    chat: (id: string) =>
      request<{ id: string; name: string }>(`/clubs/${id}/chat`, { method: "POST" }),
    leave: (id: string) =>
      request<{ joined: boolean; joinStatus?: string }>(`/clubs/${id}/leave`, { method: "POST" }),
    reviewRequest: (clubId: string, requestId: string, decision: "approved" | "denied") =>
      request<{ requestId: string; clubId: string; status: string; studentId: string }>(`/clubs/${clubId}/requests/${requestId}`, { method: "PATCH", body: JSON.stringify({ decision }) }),
    postAnnouncement: (id: string, text: string) =>
      request<ClubAnnouncement>(`/clubs/${id}/announcements`, { method: "POST", body: JSON.stringify({ text }) }),
    takeOver: (id: string) =>
      request<ClubWithMeta>(`/clubs/${id}/manager`, { method: "PATCH" }),
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
  uploadedPhotoURL?: string;
  avatarConfig?: import("@workspace/api-zod").AvatarConfig;
  avatarThumbnailURL?: string;
  profileImageType?: "photo" | "avatar" | "default";
  class?: string;
  enrollYear?: string;
  passoutYear?: string;
  profession?: string;
  field?: string;
  company?: string;
  skills?: string[];
  verificationStatus?: "unverified" | "pending" | "verified" | "rejected" | "suspended";
  profileVisibility?: "public" | "private";
  subject?: string;
  designation?: string;
  bio?: string;
  phone?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
}

export interface SignupData extends Omit<UserProfile, "uid"> {
  password: string;
}

export interface AuthResponse {
  token: string;
  profile: UserProfile;
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
}

export interface Group {
  id: string;
  name: string;
  subject: string;
  clubId?: string;
  class?: string;
  jnvName?: string;
  jnvState?: string;
  teacherName?: string;
  teacherId?: string;
  memberCount?: number;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  lastMessageSenderId?: string | null;
  lastMessageSenderName?: string | null;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  fullName: string;
  role: string;
  photoURL?: string;
  phone?: string;
}

export interface ChatContact {
  id: string;
  fullName: string;
  role: string;
  jnvName?: string;
  photoURL?: string;
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

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string;
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
  organizerId?: string;
  jnvName?: string;
  createdAt: string;
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
  passoutYear?: string;
  profession?: string;
  subject?: string;
  createdAt: string;
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

export interface AlumniTransitionResult {
  id: string;
  userId: string;
  previousRole: string | null;
  newRole: string | null;
  result: "succeeded" | "already_transitioned" | "skipped" | "failed" | string;
  reason: string | null;
  credentialId: string | null;
}

export interface AlumniBatchProcessResult {
  batchId: string;
  status: string;
  summary: { selected: number; succeeded: number; alreadyTransitioned: number; skipped: number; failed: number };
  results: AlumniTransitionResult[];
}

export interface CredentialReconcilePreview {
  candidates: Array<{ id: string; fullName: string; role: string }>;
  reviewRequired: number;
  message: string;
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
  evidenceSummary?: string | null;
  documentUrls?: string | null;
  notes?: string | null;
  infoRequest?: string | null;
  applicantResponse?: string | null;
  adminRecommendation?: string | null;
  adminNotes?: string | null;
  adminReviewedBy?: string | null;
  adminReviewedAt?: string | null;
  officialNotes?: string | null;
  officialReviewedBy?: string | null;
  officialReviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
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

export interface VerificationAuditEvent {
  id: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  createdAt: string;
  actorName?: string | null;
}

export interface DigitalCredential {
  credentialId: string;
  fullName: string;
  publicVerificationUrl: string;
  status: string;
  role: string;
  jnvName: string;
  jnvState: string;
  issuedAt: string;
}

export interface PublicCredentialStatus {
  status: "valid" | "suspended" | "revoked" | "not_found" | string;
  credentialId?: string;
  role?: string;
  jnvName?: string;
  jnvState?: string;
  issuedAt?: string;
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

export interface ProfileStats {
  posts: number | null;
  followers: number | null;
  following: number | null;
  restricted: boolean;
}

export interface ProfileConnection {
  id: string;
  fullName: string;
  role: string;
  jnvName: string;
  photoURL?: string;
  isRestricted: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
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
  joinStatus?: "none" | "pending" | "approved" | "denied";
  announcements: ClubAnnouncement[];
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
