import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import { ApiError, clearAdminToken, getAdminToken, setAdminToken, storeAdminApi, type StaffProfile } from "./api";

type NavKey =
  | "dashboard"
  | "products"
  | "categories"
  | "sellers"
  | "inventory"
  | "orders"
  | "returns"
  | "shipping"
  | "commissions"
  | "payouts"
  | "reports"
  | "staff"
  | "audit";

const rupees = (paise?: number | null) =>
  `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const ADMIN_ROLES = [
  "store_manager",
  "product_manager",
  "order_manager",
  "inventory_manager",
  "seller_manager",
  "finance_manager",
  "customer_support",
];

function StatusBadge({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const cls =
    s === "published" || s === "approved" || s === "paid" || s === "confirmed" || s === "delivered" || s === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "pending_approval" || s === "pending" || s === "pending_review" || s === "requested" || s === "scheduled"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : s === "rejected" || s === "suspended" || s === "cancelled" || s === "archived"
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-violet-50 text-violet-700 border-violet-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {s.replaceAll("_", " ")}
    </span>
  );
}

export default function App() {
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const [nav, setNav] = useState<NavKey>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  // Data stores
  const [dashboard, setDashboard] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [ordersData, setOrdersData] = useState<{ orders: any[]; subOrders: any[] }>({ orders: [], subOrders: [] });
  const [returns, setReturns] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payoutsData, setPayoutsData] = useState<{ batches: any[]; payouts: any[] }>({ batches: [], payouts: [] });
  const [coupons, setCoupons] = useState<any[]>([]);
  const [shippingRates, setShippingRates] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Forms / modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ name: "", price: "", stock: "10", categoryId: "", sku: "", description: "", imageUrl: "" });
  const [catName, setCatName] = useState("");
  const [commCatId, setCommCatId] = useState("");
  const [commPct, setCommPct] = useState("10");
  const [staffForm, setStaffForm] = useState({ email: "", role: "product_manager", currentPassword: "" });
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const has = useCallback((perm: string) => Boolean(staff?.permissions.includes(perm)), [staff]);

  const loadCore = useCallback(async () => {
    setError("");
    try {
      const me = await storeAdminApi.me();
      setStaff(me.staff);
      const perms = me.staff.permissions;
      const tasks: Promise<void>[] = [];

      if (perms.includes("products.view")) {
        tasks.push(
          storeAdminApi.dashboard().then(setDashboard),
          storeAdminApi.products({ pageSize: 100, q: productSearch, status: productStatusFilter }).then((r) => setProducts(r.items)),
          storeAdminApi.categories().then((c) => {
            setCategories(c);
            if (!commCatId && c[0]) setCommCatId(c[0].id);
          }),
        );
      }
      if (perms.includes("analytics.view")) {
        tasks.push(storeAdminApi.analytics().then(setAnalytics).catch(() => {}));
      }
      if (perms.includes("sellers.approve")) {
        tasks.push(storeAdminApi.sellers().then((r) => setSellers(r.items)));
      }
      if (perms.includes("orders.view")) {
        tasks.push(storeAdminApi.orders().then(setOrdersData).catch(() => {}));
      }
      if (perms.includes("returns.manage")) {
        tasks.push(storeAdminApi.returns().then((r) => setReturns(r.items)).catch(() => {}));
      }
      if (perms.includes("commissions.manage") || perms.includes("products.view")) {
        tasks.push(storeAdminApi.commissions().then((r) => setCommissions(r.items)).catch(() => {}));
      }
      if (perms.includes("payouts.prepare") || perms.includes("payouts.execute") || perms.includes("orders.view")) {
        tasks.push(storeAdminApi.payouts().then(setPayoutsData).catch(() => {}));
      }
      if (perms.includes("products.view")) {
        tasks.push(
          storeAdminApi.coupons().then((r) => setCoupons(r.items)).catch(() => {}),
          storeAdminApi.shippingRates().then((r) => setShippingRates(r.items)).catch(() => {}),
        );
      }
      if (perms.includes("staff.manage")) {
        tasks.push(storeAdminApi.staff().then((r) => setStaffList(r.items)).catch(() => {}));
      }
      if (perms.includes("audit_logs.view")) {
        tasks.push(storeAdminApi.auditLogs(80).then((r) => setAuditLogs(r.items)).catch(() => {}));
      }
      await Promise.all(tasks);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        clearAdminToken();
        setStaff(null);
      } else {
        setError(e instanceof Error ? e.message : "Could not load Store Admin workspace.");
      }
    } finally {
      setBooting(false);
    }
  }, [productSearch, productStatusFilter, commCatId]);

  useEffect(() => {
    if (getAdminToken()) {
      void loadCore();
    } else {
      setBooting(false);
    }
  }, [loadCore]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setSigningIn(true);
    try {
      const res = await storeAdminApi.login(email.trim(), password);
      setAdminToken(res.token);
      setPassword("");
      setStaff(res.staff);
      await loadCore();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Invalid administrator credentials.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await storeAdminApi.logout();
    } catch {}
    clearAdminToken();
    setStaff(null);
  };

  const navGroups = useMemo(() => {
    if (!staff) return [];
    const groups: Array<{ title: string; items: Array<{ key: NavKey; label: string; icon: any; badge?: number }> }> = [
      {
        title: "Overview",
        items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
      },
      {
        title: "Marketplace",
        items: [
          ...(has("products.view") ? [{ key: "products" as const, label: "Products", icon: Package, badge: products.filter((p) => p.status === "pending_approval").length || undefined }] : []),
          ...(has("products.view") ? [{ key: "categories" as const, label: "Categories", icon: FolderTree }] : []),
          ...(has("sellers.approve") ? [{ key: "sellers" as const, label: "Sellers", icon: Store, badge: sellers.filter((s) => ["pending", "pending_review"].includes(s.status)).length || undefined }] : []),
          ...(has("inventory.manage") || has("inventory.override") ? [{ key: "inventory" as const, label: "Inventory", icon: Boxes, badge: dashboard?.products?.lowStock || undefined }] : []),
        ],
      },
      {
        title: "Orders & Fulfillment",
        items: [
          ...(has("orders.view") ? [{ key: "orders" as const, label: "Orders", icon: ClipboardList }] : []),
          ...(has("returns.manage") ? [{ key: "returns" as const, label: "Returns & Refunds", icon: RotateCcw, badge: returns.filter((r) => r.status === "requested").length || undefined }] : []),
          ...(has("settings.manage") || has("products.view") ? [{ key: "shipping" as const, label: "Shipping & Coupons", icon: Truck }] : []),
        ],
      },
      {
        title: "Finance",
        items: [
          ...(has("commissions.manage") ? [{ key: "commissions" as const, label: "Commissions", icon: Percent }] : []),
          ...(has("payouts.prepare") || has("payouts.execute") ? [{ key: "payouts" as const, label: "Seller Payouts", icon: Banknote }] : []),
          ...(has("analytics.view") || has("reports.export") ? [{ key: "reports" as const, label: "Reports & Exports", icon: Download }] : []),
        ],
      },
      {
        title: "Administration",
        items: [
          ...(has("staff.manage") ? [{ key: "staff" as const, label: "Staff & Permissions", icon: Users }] : []),
          ...(has("audit_logs.view") ? [{ key: "audit" as const, label: "Audit Logs", icon: FileText }] : []),
        ],
      },
    ];
    return groups.filter((g) => g.items.length > 0);
  }, [staff, has, products, sellers, dashboard, returns]);

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600 font-medium">Verifying Store Admin session...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-violet-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-violet-600">Navodaya Connect</p>
              <h1 className="text-xl font-bold text-slate-900">Store Admin Portal</h1>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6">
            Dedicated administration console for Store Room operations. Sign in with an authorized Store staff account.
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@navodayaconnect.org"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            {authError ? <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{authError}</p> : null}
            <button
              type="submit"
              disabled={signingIn}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition cursor-pointer"
            >
              {signingIn ? "Signing in..." : "Sign in to Store Admin"}
            </button>
          </form>
          <p className="mt-6 text-[11px] text-slate-400 text-center">
            Protected by server-side RBAC, session hashing, and audit logging.
          </p>
        </div>
      </div>
    );
  }

  const activeNavLabel = navGroups.flatMap((g) => g.items).find((i) => i.key === nav)?.label || "Dashboard";

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      ) : null}

      {/* Responsive Sidebar: Drawer on mobile/tablet, fixed proportional width on desktop */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-200 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-20" : "w-64"}`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Navodaya Connect</p>
                <p className="text-sm font-bold text-slate-900 truncate">Store Admin</p>
              </div>
            )}
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="hidden lg:inline-flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
            title="Toggle sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.title}>
              {!sidebarCollapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = nav === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setNav(item.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                        active ? "bg-violet-50 text-violet-700 font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-violet-600" : "text-slate-400"}`} />
                      {!sidebarCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                      {!sidebarCollapsed && item.badge ? (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-violet-600 text-white">{item.badge}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 shrink-0">
          {!sidebarCollapsed && (
            <div className="mb-2 px-3 py-2 rounded-xl bg-slate-50">
              <p className="text-xs font-semibold text-slate-900 truncate">{staff.name}</p>
              <p className="text-[11px] text-slate-500 capitalize truncate">{staff.role.replaceAll("_", " ")}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {!sidebarCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Store Admin / {activeNavLabel}</p>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{activeNavLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => void loadCore()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {toast ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast}</span>
            </div>
          ) : null}
          {error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between gap-2">
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-xs underline">Dismiss</button>
            </div>
          ) : null}

          {/* DASHBOARD */}
          {nav === "dashboard" && (
            <div className="space-y-6">
              {dashboard?.integrations?.payments === "not_configured" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-amber-900">
                    <span className="font-semibold">Integration Notice:</span> Payment gateway keys are not yet configured in environment variables; online checkout uses pending verification mode until Razorpay credentials are added.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Products", val: dashboard?.products?.total ?? 0, sub: `${dashboard?.products?.published ?? 0} published`, target: "products" as NavKey },
                  { label: "Pending Approvals", val: products.filter((p) => p.status === "pending_approval").length, sub: "Awaiting review", target: "products" as NavKey },
                  { label: "Seller Applications", val: sellers.filter((s) => ["pending", "pending_review"].includes(s.status)).length, sub: `${sellers.filter((s) => s.status === "approved").length} active sellers`, target: "sellers" as NavKey },
                  { label: "Low Stock Alerts", val: dashboard?.products?.lowStock ?? 0, sub: `${dashboard?.products?.outOfStock ?? 0} out of stock`, target: "inventory" as NavKey },
                  { label: "Total Orders", val: analytics?.totalOrders ?? ordersData.orders.length, sub: `${analytics?.paidOrders ?? 0} paid`, target: "orders" as NavKey },
                  { label: "Gross Sales (GMV)", val: rupees(analytics?.gmvPaise), sub: `Net: ${rupees(analytics?.netSalesPaise)}`, target: "reports" as NavKey },
                  { label: "Commission Revenue", val: rupees(analytics?.commissionRevenuePaise), sub: "Category-based", target: "commissions" as NavKey },
                  { label: "Unpaid Seller Payable", val: rupees(analytics?.unpaidSellerPayablePaise), sub: `Paid out: ${rupees(analytics?.paidOutPaise)}`, target: "payouts" as NavKey },
                ].map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setNav(c.target)}
                    className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-violet-300 hover:shadow-sm transition cursor-pointer"
                  >
                    <p className="text-xs font-medium text-slate-500">{c.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{c.val}</p>
                    <p className="text-[11px] text-violet-600 font-medium mt-1">{c.sub}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-900">Recent Orders</h2>
                    <button onClick={() => setNav("orders")} className="text-xs font-semibold text-violet-600 hover:underline cursor-pointer">View all</button>
                  </div>
                  {ordersData.orders.slice(0, 5).length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No orders yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {ordersData.orders.slice(0, 5).map((o) => (
                        <div key={o.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-semibold text-slate-800">{o.orderNumber}</p>
                            <p className="text-slate-500">{new Date(o.createdAt).toLocaleDateString("en-IN")}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="font-bold text-slate-900">{rupees(o.totalPaise)}</p>
                            <StatusBadge status={o.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-900">Pending Seller Applications</h2>
                    <button onClick={() => setNav("sellers")} className="text-xs font-semibold text-violet-600 hover:underline cursor-pointer">Manage</button>
                  </div>
                  {sellers.filter((s) => ["pending", "pending_review"].includes(s.status)).length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No pending seller applications.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {sellers.filter((s) => ["pending", "pending_review"].includes(s.status)).slice(0, 5).map((s) => (
                        <div key={s.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-semibold text-slate-800">{s.displayName}</p>
                            <p className="text-slate-500 truncate max-w-xs">{s.description || s.sellerType}</p>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PRODUCTS */}
          {nav === "products" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="flex flex-1 gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <select
                    value={productStatusFilter}
                    onChange={(e) => setProductStatusFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">All statuses</option>
                    <option value="pending_approval">Pending approval</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                {has("products.create") && (
                  <button
                    onClick={() => setProductModalOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Platform Product
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Ownership</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 capitalize">{p.ownershipType || "platform"}</td>
                          <td className="px-4 py-3 font-semibold">{rupees(p.pricePaise)}</td>
                          <td className="px-4 py-3">{p.stock}</td>
                          <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                            {has("products.approve") && p.status === "pending_approval" && (
                              <>
                                <button
                                  onClick={async () => {
                                    await storeAdminApi.reviewProduct(p.id, "approve");
                                    notify(`Approved & published "${p.name}"`);
                                    await loadCore();
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={async () => {
                                    const reason = window.prompt("Rejection reason:", "Please update product details.");
                                    if (!reason) return;
                                    await storeAdminApi.reviewProduct(p.id, "reject", reason);
                                    notify(`Rejected "${p.name}"`);
                                    await loadCore();
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {has("products.approve") && p.status === "draft" && (
                              <button
                                onClick={async () => {
                                  await storeAdminApi.updateProduct(p.id, { status: "published" });
                                  notify(`Published "${p.name}"`);
                                  await loadCore();
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 cursor-pointer"
                              >
                                Publish
                              </button>
                            )}
                            {has("products.delete") && p.status !== "archived" && (
                              <button
                                onClick={async () => {
                                  await storeAdminApi.archiveProduct(p.id);
                                  notify(`Archived "${p.name}"`);
                                  await loadCore();
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                              >
                                Archive
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORIES */}
          {nav === "categories" && (
            <div className="space-y-4">
              {has("categories.manage") && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!catName.trim()) return;
                    await storeAdminApi.createCategory({ name: catName.trim() });
                    setCatName("");
                    notify("Category created.");
                    await loadCore();
                  }}
                  className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3"
                >
                  <input
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="New category name"
                    className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                  <button type="submit" className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer">
                    Create Category
                  </button>
                </form>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((c) => (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{c.visible ? "Visible" : "Hidden"}</p>
                    </div>
                    {has("categories.manage") && (
                      <button
                        onClick={async () => {
                          await storeAdminApi.updateCategory(c.id, { visible: !c.visible });
                          await loadCore();
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 cursor-pointer"
                      >
                        {c.visible ? "Hide" : "Show"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SELLERS */}
          {nav === "sellers" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Seller</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sellers.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{s.displayName}</p>
                          <p className="text-xs text-slate-500">{s.description}</p>
                        </td>
                        <td className="px-4 py-3 text-xs capitalize">{s.sellerType || "individual"}</td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          {["pending", "pending_review"].includes(s.status) && (
                            <>
                              <button
                                onClick={async () => {
                                  await storeAdminApi.updateSeller(s.id, "approved");
                                  notify(`Approved seller ${s.displayName}`);
                                  await loadCore();
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  await storeAdminApi.updateSeller(s.id, "rejected");
                                  notify(`Rejected seller ${s.displayName}`);
                                  await loadCore();
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {s.status === "approved" && (
                            <button
                              onClick={async () => {
                                await storeAdminApi.updateSeller(s.id, "suspended");
                                notify(`Suspended seller ${s.displayName}`);
                                await loadCore();
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {nav === "inventory" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Ownership</th>
                      <th className="px-4 py-3">On Hand</th>
                      <th className="px-4 py-3">Adjust Stock (Audited)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-xs capitalize">{p.ownershipType || "platform"}</td>
                        <td className="px-4 py-3 font-bold">{p.stock}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={stockDrafts[p.id] ?? String(p.stock)}
                              onChange={(e) => setStockDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                              className="w-24 border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                            />
                            <button
                              onClick={async () => {
                                const val = Number(stockDrafts[p.id] ?? p.stock);
                                await storeAdminApi.adjustInventory(p.id, val, "Store Admin stock adjustment");
                                notify(`Updated stock for ${p.name}`);
                                await loadCore();
                              }}
                              className="px-3 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {nav === "orders" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Order #</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3">Order Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ordersData.orders.map((o) => (
                        <tr key={o.id}>
                          <td className="px-4 py-3 font-semibold">{o.orderNumber}</td>
                          <td className="px-4 py-3 font-bold">{rupees(o.totalPaise)}</td>
                          <td className="px-4 py-3 text-xs">{o.paymentStatus} ({o.paymentMethod})</td>
                          <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                          <td className="px-4 py-3 text-xs text-slate-500">{new Date(o.createdAt).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* RETURNS */}
          {nav === "returns" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Refund Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returns.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-medium">{r.reason}</td>
                        <td className="px-4 py-3 text-xs capitalize">{r.returnType}</td>
                        <td className="px-4 py-3 font-bold">{rupees(r.refundAmountPaise)}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {r.status === "requested" && (
                            <>
                              <button
                                onClick={async () => { await storeAdminApi.updateReturn(r.id, { status: "approved" }); await loadCore(); }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => { await storeAdminApi.updateReturn(r.id, { status: "rejected" }); await loadCore(); }}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SHIPPING & COUPONS */}
          {nav === "shipping" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h2 className="text-sm font-bold">Configured Shipping Rate Cards ({shippingRates.length})</h2>
                {shippingRates.length === 0 ? (
                  <p className="text-xs text-slate-500">Default fallback shipping applies (₹49 under ₹500, Free above ₹500).</p>
                ) : (
                  shippingRates.map((sr) => (
                    <div key={sr.id} className="p-3 rounded-xl bg-slate-50 text-xs flex justify-between">
                      <span className="font-semibold">{sr.name}</span>
                      <span>Base {rupees(sr.baseRatePaise)} · COD {sr.codAllowed ? "Yes" : "No"}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h2 className="text-sm font-bold">Active Coupons ({coupons.length})</h2>
                {coupons.map((cp) => (
                  <div key={cp.id} className="p-3 rounded-xl bg-slate-50 text-xs flex justify-between">
                    <span className="font-bold text-violet-700">{cp.code}</span>
                    <span>{cp.discountType === "percent" ? `${cp.discountValue}%` : rupees(cp.discountValue)} · Used {cp.usedCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COMMISSIONS */}
          {nav === "commissions" && (
            <div className="space-y-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!commCatId) return;
                  await storeAdminApi.setCommission(commCatId, Number(commPct));
                  notify("Commission rule saved.");
                  await loadCore();
                }}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 items-end"
              >
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select value={commCatId} onChange={(e) => setCommCatId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-40">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rate (%)</label>
                  <input type="number" step="0.5" min="0" max="50" value={commPct} onChange={(e) => setCommPct(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <button type="submit" className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer">Save Rule</button>
              </form>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {commissions.map((cr) => (
                      <tr key={cr.id}>
                        <td className="px-4 py-3 font-medium">{cr.categoryName || "Category"}</td>
                        <td className="px-4 py-3 font-bold">{(cr.rateBps / 100).toFixed(2)}%</td>
                        <td className="px-4 py-3">v{cr.version}</td>
                        <td className="px-4 py-3"><StatusBadge status={cr.active ? "active" : "archived"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYOUTS */}
          {nav === "payouts" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">Weekly seller payout batches</p>
                {has("payouts.prepare") && (
                  <button
                    onClick={async () => {
                      try {
                        await storeAdminApi.generatePayoutBatch();
                        notify("Weekly payout batch generated.");
                        await loadCore();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "No unpaid seller earnings ready.");
                      }
                    }}
                    className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                  >
                    Generate Weekly Batch
                  </button>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Total Payable</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payoutsData.batches.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-3 font-semibold">{b.batchNumber}</td>
                        <td className="px-4 py-3 font-bold">{rupees(b.totalAmountPaise)}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                        <td className="px-4 py-3 text-right">
                          {b.status === "scheduled" && has("payouts.execute") && (
                            <button
                              onClick={async () => { await storeAdminApi.executePayoutBatch(b.id); notify("Batch executed."); await loadCore(); }}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Execute Payout
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REPORTS & EXPORTS */}
          {nav === "reports" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["orders", "inventory", "payouts", "returns"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => void storeAdminApi.downloadCsv(type)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-violet-400 transition flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <p className="font-bold text-sm capitalize text-slate-900">Export {type} CSV</p>
                    <p className="text-xs text-slate-500 mt-1">Audited backend export</p>
                  </div>
                  <Download className="w-5 h-5 text-violet-600" />
                </button>
              ))}
            </div>
          )}

          {/* STAFF & PERMISSIONS */}
          {nav === "staff" && (
            <div className="space-y-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await storeAdminApi.assignStaff(staffForm.email, staffForm.role, staffForm.currentPassword);
                  setStaffForm({ email: "", role: "product_manager", currentPassword: "" });
                  notify("Staff role updated.");
                  await loadCore();
                }}
                className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
              >
                <input required placeholder="User email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                <select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} className="border border-slate-200 rounded-xl px-3 py-2 text-sm">
                  {ADMIN_ROLES.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
                </select>
                <input required type="password" placeholder="Your password" value={staffForm.currentPassword} onChange={(e) => setStaffForm({ ...staffForm, currentPassword: e.target.value })} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                <button type="submit" className="bg-violet-600 text-white rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer">Assign Role</button>
              </form>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffList.map((m) => (
                      <tr key={m.userId}>
                        <td className="px-4 py-3 font-semibold">{m.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{m.email}</td>
                        <td className="px-4 py-3 text-xs capitalize">{String(m.role).replaceAll("_", " ")}</td>
                        <td className="px-4 py-3"><StatusBadge status={m.active ? "active" : "suspended"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AUDIT LOGS */}
          {nav === "audit" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Actor Role</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Timestamp</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-3 font-medium">{l.action}</td>
                        <td className="px-4 py-3 text-xs capitalize">{String(l.actorRole || "system").replaceAll("_", " ")}</td>
                        <td className="px-4 py-3"><StatusBadge status={l.outcome} /></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{new Date(l.createdAt).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Platform Product Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">New Platform Product</h2>
              <button onClick={() => setProductModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await storeAdminApi.createProduct({
                    name: prodForm.name,
                    pricePaise: Math.round(Number(prodForm.price) * 100),
                    stock: Number(prodForm.stock),
                    categoryId: prodForm.categoryId || null,
                    sku: prodForm.sku || null,
                    description: prodForm.description,
                    images: prodForm.imageUrl.startsWith("https://") ? [prodForm.imageUrl] : [],
                    status: "draft",
                  });
                  setProductModalOpen(false);
                  setProdForm({ name: "", price: "", stock: "10", categoryId: "", sku: "", description: "", imageUrl: "" });
                  notify("Platform product saved as draft.");
                  await loadCore();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not create product.");
                } finally {
                  setBusy(false);
                }
              }}
              className="space-y-3"
            >
              <input required placeholder="Product Name" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" placeholder="Price (₹)" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                <input required type="number" placeholder="Stock" value={prodForm.stock} onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <select value={prodForm.categoryId} onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="SKU (optional)" value={prodForm.sku} onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              <input placeholder="HTTPS Image URL (optional)" value={prodForm.imageUrl} onChange={(e) => setProdForm({ ...prodForm, imageUrl: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              <textarea placeholder="Description" value={prodForm.description} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm min-h-[80px]" />
              <button type="submit" disabled={busy} className="w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer">
                {busy ? "Saving..." : "Save Draft"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
