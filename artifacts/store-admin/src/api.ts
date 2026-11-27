const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "store_admin_portal_token";

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  return res.json();
}

export interface StaffProfile {
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export const storeAdminApi = {
  login: (email: string, password: string) =>
    adminFetch<{ token: string; expiresInSeconds: number; staff: StaffProfile }>("/store-admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => adminFetch<{ staff: StaffProfile }>("/store-admin/me"),
  logout: () => adminFetch<{ ok: boolean }>("/store-admin/logout", { method: "POST" }),
  dashboard: () => adminFetch<any>("/store-admin/dashboard"),
  analytics: () => adminFetch<any>("/store-admin/analytics"),
  products: (params: { page?: number; pageSize?: number; q?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return adminFetch<{ items: any[]; total: number; page: number; pageSize: number }>(`/store-admin/products${q ? `?${q}` : ""}`);
  },
  createProduct: (data: any) => adminFetch<any>("/store-admin/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => adminFetch<any>(`/store-admin/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
  reviewProduct: (id: string, action: string, feedback?: string) =>
    adminFetch<any>(`/store-admin/products/${encodeURIComponent(id)}/review`, { method: "PATCH", body: JSON.stringify({ action, feedback }) }),
  archiveProduct: (id: string) => adminFetch<any>(`/store-admin/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
  adjustInventory: (productId: string, stock: number, note: string) =>
    adminFetch<any>(`/store-admin/inventory/${encodeURIComponent(productId)}/adjust`, { method: "POST", body: JSON.stringify({ stock, note }) }),
  categories: () => adminFetch<any[]>("/store-admin/categories"),
  createCategory: (data: any) => adminFetch<any>("/store-admin/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) => adminFetch<any>(`/store-admin/categories/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
  sellers: (status?: string) => adminFetch<{ items: any[] }>(`/store-admin/sellers${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  updateSeller: (id: string, status: string) =>
    adminFetch<any>(`/store-admin/sellers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  orders: () => adminFetch<{ orders: any[]; subOrders: any[] }>("/store-admin/orders"),
  fulfillSubOrder: (id: string, data: { fulfillmentStatus: string; trackingNumber?: string; carrier?: string }) =>
    adminFetch<any>(`/store-admin/sub-orders/${encodeURIComponent(id)}/fulfill`, { method: "PATCH", body: JSON.stringify(data) }),
  returns: () => adminFetch<{ items: any[] }>("/store-admin/returns"),
  updateReturn: (id: string, data: any) => adminFetch<any>(`/store-admin/returns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
  commissions: () => adminFetch<{ items: any[] }>("/store-admin/commissions"),
  setCommission: (categoryId: string, ratePercent: number) =>
    adminFetch<any>("/store-admin/commissions", { method: "POST", body: JSON.stringify({ categoryId, ratePercent }) }),
  payouts: () => adminFetch<{ batches: any[]; payouts: any[] }>("/store-admin/payouts"),
  generatePayoutBatch: () => adminFetch<any>("/store-admin/payouts/generate-batch", { method: "POST" }),
  executePayoutBatch: (id: string) => adminFetch<any>(`/store-admin/payouts/batches/${encodeURIComponent(id)}/execute`, { method: "PATCH" }),
  coupons: () => adminFetch<{ items: any[] }>("/store-admin/coupons"),
  createCoupon: (data: any) => adminFetch<any>("/store-admin/coupons", { method: "POST", body: JSON.stringify(data) }),
  shippingRates: () => adminFetch<{ items: any[] }>("/store-admin/shipping-rates"),
  createShippingRate: (data: any) => adminFetch<any>("/store-admin/shipping-rates", { method: "POST", body: JSON.stringify(data) }),
  staff: () => adminFetch<{ items: any[] }>("/store-admin/staff"),
  assignStaff: (email: string, role: string, currentPassword: string) =>
    adminFetch<any>("/store-admin/staff", { method: "POST", body: JSON.stringify({ email, role, currentPassword }) }),
  updateStaff: (userId: string, data: { role?: string; active?: boolean; currentPassword: string }) =>
    adminFetch<any>(`/store-admin/staff/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify(data) }),
  auditLogs: (limit = 80) => adminFetch<{ items: any[] }>(`/store-admin/audit-logs?limit=${limit}`),
  downloadCsv: async (type: "orders" | "inventory" | "payouts" | "returns") => {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/store-admin/exports/${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `store-${type}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
