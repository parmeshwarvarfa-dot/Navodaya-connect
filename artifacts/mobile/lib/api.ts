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

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
  });

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
    signout: () =>
      request<{ ok: boolean }>("/auth/signout", { method: "POST" }),
    me: () => request<{ profile: UserProfile }>("/auth/me"),
  },
  news: {
    list: () => request<NewsItem[]>("/news"),
    create: (data: { title: string; description: string; category: string }) =>
      request<NewsItem>("/news", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/news/${id}`, { method: "DELETE" }),
  },
  groups: {
    list: () => request<Group[]>("/groups"),
    create: (data: { name: string; subject: string; class?: string }) =>
      request<Group>("/groups", { method: "POST", body: JSON.stringify(data) }),
    getMessages: (groupId: string) => request<GroupMessage[]>(`/groups/${groupId}/messages`),
    sendMessage: (groupId: string, text: string) =>
      request<GroupMessage>(`/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
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
  },
  mentorRequests: {
    list: () => request<MentorRequest[]>("/mentor-requests"),
    create: (data: { mentorId: string; mentorName: string; category: string; message: string }) =>
      request<MentorRequest>("/mentor-requests", { method: "POST", body: JSON.stringify(data) }),
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
  verificationStatus?: "unverified" | "pending" | "verified";
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
  senderName?: string;
  senderId?: string;
  role?: string;
  createdAt: string;
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
