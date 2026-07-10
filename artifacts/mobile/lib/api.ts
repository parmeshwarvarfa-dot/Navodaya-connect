import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "http://localhost:80/api";
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
  const res = await fetch(`${getBaseUrl()}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    signup: (data: SignupData) =>
      request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
    signin: (email: string, password: string) =>
      request<AuthResponse>("/auth/signin", { method: "POST", body: JSON.stringify({ email, password }) }),
    signout: () => request<{ ok: boolean }>("/auth/signout", { method: "POST" }),
    me: () => request<{ profile: UserProfile }>("/auth/me"),
  },
  news: {
    list: () => request<NewsItem[]>("/news"),
    create: (data: { title: string; description: string; category: string }) =>
      request<NewsItem>("/news", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/news/${id}`, { method: "DELETE" }),
  },
  groups: {
    list: () => request<Group[]>("/groups"),
    create: (data: { name: string; subject: string; class?: string }) =>
      request<Group>("/groups", { method: "POST", body: JSON.stringify(data) }),
    getMessages: (groupId: string) => request<GroupMessage[]>(`/groups/${groupId}/messages`),
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
  },
  users: {
    alumni: () => request<AlumniUser[]>("/users/alumni"),
    updateMe: (data: Partial<UserProfile>) =>
      request<UserProfile>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
    manage: () => request<ManagedUser[]>("/users/manage"),
    suspend: (id: string, suspended: boolean) =>
      request<ManagedUser>(`/users/${id}/suspend`, { method: "PATCH", body: JSON.stringify({ suspended }) }),
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
    requests: () => request<VerificationRequest[]>("/verification/requests"),
    create: (method?: string, documentUrls?: string[]) =>
      request<VerificationRequest>("/verification/requests", { method: "POST", body: JSON.stringify({ method: method ?? "official", documentUrls }) }),
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
  verificationStatus?: "unverified" | "pending" | "verified" | "rejected" | "suspended";
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
  documentUrls?: string | null;
  notes?: string | null;
  infoRequest?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
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
