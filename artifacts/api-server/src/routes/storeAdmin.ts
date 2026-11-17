import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, ilike, lt, or } from "drizzle-orm";
import { db, storeAdminSessionsTable, storeAdminAuditLogsTable, storeAdminStaffTable, storeCategoriesTable, storeProductsTable, storeSellersTable, usersTable } from "@workspace/db";
import { isStoreAdminRole, STORE_ADMIN_PERMISSIONS, storeAdminHasPermission, type StoreAdminRole } from "../lib/store-admin-access";
import { verifyFirebaseToken } from "./auth";

const router = Router();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const loginBuckets = new Map<string, { attempts: number; resetAt: number; blockedUntil: number }>();
const sessionDigest = (token: string) => createHash("sha256").update(token).digest("hex");

type StaffRequest = Request & { storeStaff?: { userId: string; role: StoreAdminRole; name: string; email: string } };
const hasPermission = storeAdminHasPermission;

async function audit(req: Request, actorId: string | null, actorRole: string | null, action: string, outcome: "success" | "denied" | "failure", targetType?: string, targetId?: string, details: Record<string, unknown> = {}) {
  await db.insert(storeAdminAuditLogsTable).values({ actorId, actorRole, action, outcome, targetType: targetType ?? null, targetId: targetId ?? null, requestId: req.get("x-request-id") ?? req.get("x-correlation-id") ?? null, details });
}

function rateLimitLogin(req: Request, res: Response, next: NextFunction) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
  const key = `${req.ip ?? "unknown"}:${email}`;
  const now = Date.now();
  if (loginBuckets.size > 5000) {
    for (const [bucketKey, entry] of loginBuckets) if (entry.resetAt <= now && entry.blockedUntil <= now) loginBuckets.delete(bucketKey);
    if (loginBuckets.size > 10_000 && !loginBuckets.has(key)) return res.status(429).json({ error: "Administrator sign-in is temporarily rate limited." });
  }
  let bucket = loginBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { attempts: 0, resetAt: now + 15 * 60_000, blockedUntil: 0 };
  if (bucket.blockedUntil > now) return res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
  bucket.attempts += 1;
  if (bucket.attempts > 8) {
    bucket.blockedUntil = now + 15 * 60_000;
    loginBuckets.set(key, bucket);
    req.log.warn({ ip: req.ip, loginAttemptLimit: true }, "Store admin sign-in rate limited");
    return res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
  }
  loginBuckets.set(key, bucket);
  next();
}

router.post("/store-admin/login", rateLimitLogin, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password || email.length > 254 || password.length > 200) return res.status(400).json({ error: "Enter your work email and password." });
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    const [staff] = user ? await db.select().from(storeAdminStaffTable).where(and(eq(storeAdminStaffTable.userId, user.id), eq(storeAdminStaffTable.active, true))).limit(1) : [];
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !staff || !isStoreAdminRole(staff.role) || !passwordMatches) {
      await audit(req, user?.id ?? null, staff?.role ?? null, "auth.login.failed", "denied");
      return res.status(401).json({ error: "Invalid administrator credentials." });
    }
    const token = randomBytes(32).toString("base64url");
    await db.insert(storeAdminSessionsTable).values({ userId: user.id, token: sessionDigest(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    await audit(req, user.id, staff.role, "auth.login.succeeded", "success");
    return res.json({ token, expiresInSeconds: SESSION_TTL_MS / 1000, staff: { name: user.fullName, email: user.email, role: staff.role, permissions: STORE_ADMIN_PERMISSIONS[staff.role] } });
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Store admin sign-in failed");
    return res.status(503).json({ error: "Administrator sign-in is temporarily unavailable." });
  }
});

router.post("/store-admin/login/firebase", rateLimitLogin, async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";
  if (!idToken || idToken.length > 12_000) return res.status(400).json({ error: "A valid sign-in session is required." });
  try {
    const identity = await verifyFirebaseToken(idToken);
    if (!identity?.email || identity.emailVerified !== true) return res.status(401).json({ error: "Verify your account email before signing in as Store staff." });
    const email = identity.email.toLowerCase();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    const [staff] = user ? await db.select().from(storeAdminStaffTable).where(and(eq(storeAdminStaffTable.userId, user.id), eq(storeAdminStaffTable.active, true))).limit(1) : [];
    if (!user || !staff || !isStoreAdminRole(staff.role)) {
      await audit(req, user?.id ?? null, staff?.role ?? null, "auth.login.failed", "denied");
      return res.status(403).json({ error: "This account is not authorized to access Store administration." });
    }
    const token = randomBytes(32).toString("base64url");
    await db.insert(storeAdminSessionsTable).values({ userId: user.id, token: sessionDigest(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    await audit(req, user.id, staff.role, "auth.login.succeeded", "success", "session", undefined, { provider: "firebase" });
    return res.json({ token, expiresInSeconds: SESSION_TTL_MS / 1000, staff: { name: user.fullName, email: user.email, role: staff.role, permissions: STORE_ADMIN_PERMISSIONS[staff.role] } });
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Firebase Store admin sign-in failed");
    return res.status(503).json({ error: "Administrator sign-in is temporarily unavailable." });
  }
});

async function requireStoreAdmin(req: StaffRequest, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith("Bearer ")) return res.status(401).json({ error: "Administrator sign-in required." });
  try {
    const [session] = await db.select().from(storeAdminSessionsTable).where(eq(storeAdminSessionsTable.token, sessionDigest(bearer.slice(7)))).limit(1);
    const now = Date.now();
    if (!session || session.expiresAt.getTime() <= now || session.createdAt && now - session.createdAt.getTime() > SESSION_TTL_MS) return res.status(401).json({ error: "Administrator session expired. Sign in again." });
    const [staff] = await db.select().from(storeAdminStaffTable).where(and(eq(storeAdminStaffTable.userId, session.userId), eq(storeAdminStaffTable.active, true))).limit(1);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
    const role: string = staff?.role ?? "";
    if (!staff || !user || !isStoreAdminRole(role)) {
      await audit(req, user?.id ?? null, staff?.role ?? null, "auth.access_denied", "denied");
      return res.status(403).json({ error: "Access denied." });
    }
    req.storeStaff = { userId: user.id, role, name: user.fullName, email: user.email };
    return next();
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Store admin authorization failed");
    return res.status(503).json({ error: "Administrator authorization is temporarily unavailable." });
  }
}

function requirePermission(permission: string) {
  return async (req: StaffRequest, res: Response, next: NextFunction) => {
    const staff = req.storeStaff;
    if (!staff || !hasPermission(staff.role, permission)) {
      if (staff) await audit(req, staff.userId, staff.role, "auth.permission_denied", "denied", undefined, undefined, { permission });
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

async function requireProductUpdatePermission(req: StaffRequest, res: Response, next: NextFunction) {
  const staff = req.storeStaff;
  const fields = Object.keys(req.body ?? {});
  const canEditProduct = staff && hasPermission(staff.role, "products.edit");
  const inventoryOnly = fields.length > 0 && fields.every((field) => field === "stock") && staff && hasPermission(staff.role, "inventory.manage");
  if (!staff || (!canEditProduct && !inventoryOnly)) {
    if (staff) await audit(req, staff.userId, staff.role, "auth.permission_denied", "denied", undefined, undefined, { permission: "products.edit or inventory.manage" });
    return res.status(403).json({ error: "You do not have permission to perform this action." });
  }
  return next();
}

router.use("/store-admin", requireStoreAdmin);

router.get("/store-admin/me", async (req: StaffRequest, res) => {
  const staff = req.storeStaff!;
  return res.json({ staff: { name: staff.name, email: staff.email, role: staff.role, permissions: STORE_ADMIN_PERMISSIONS[staff.role] } });
});

router.post("/store-admin/logout", async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (token) await db.delete(storeAdminSessionsTable).where(eq(storeAdminSessionsTable.token, sessionDigest(token)));
  const staff = (req as StaffRequest).storeStaff;
  if (staff) await audit(req, staff.userId, staff.role, "auth.logout", "success", "session");
  return res.json({ ok: true });
});

router.get("/store-admin/dashboard", requirePermission("products.view"), async (req: StaffRequest, res) => {
  const [total] = await db.select({ value: count() }).from(storeProductsTable);
  const [active] = await db.select({ value: count() }).from(storeProductsTable).where(eq(storeProductsTable.status, "published"));
  const [lowStock] = await db.select({ value: count() }).from(storeProductsTable).where(and(eq(storeProductsTable.status, "published"), lt(storeProductsTable.stock, 10)));
  const [outOfStock] = await db.select({ value: count() }).from(storeProductsTable).where(eq(storeProductsTable.stock, 0));
  const sellers = hasPermission(req.storeStaff!.role, "sellers.approve") ? await db.select({ value: count() }).from(storeSellersTable) : [];
  const pendingSellers = hasPermission(req.storeStaff!.role, "sellers.approve") ? await db.select({ value: count() }).from(storeSellersTable).where(eq(storeSellersTable.status, "pending")) : [];
  return res.json({ products: { total: total.value, published: active.value, lowStock: lowStock.value, outOfStock: outOfStock.value }, sellers: { total: sellers[0]?.value ?? 0, pending: pendingSellers[0]?.value ?? 0 }, availableModules: ["products", "categories", "inventory", "auditLogs", ...(hasPermission(req.storeStaff!.role, "sellers.approve") ? ["sellers"] : [])], integrations: { payments: "not_configured", delivery: "not_configured" } });
});

router.get("/store-admin/products", requirePermission("products.view"), async (req: StaffRequest, res) => {
  const page = Math.max(1, Math.min(5000, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const conditions = [search ? or(ilike(storeProductsTable.name, `%${search}%`), ilike(storeProductsTable.description, `%${search}%`)) : undefined,
    ["draft", "pending_approval", "approved", "published", "rejected", "out_of_stock", "archived"].includes(status) ? eq(storeProductsTable.status, status) : undefined].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  const items = await db.select().from(storeProductsTable).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(storeProductsTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const [total] = await db.select({ value: count() }).from(storeProductsTable).where(conditions.length ? and(...conditions) : undefined);
  return res.json({ items, page, pageSize, total: total.value });
});

const STATUSES = new Set(["draft", "pending_approval", "approved", "published", "rejected", "out_of_stock", "archived"]);
function validateProduct(body: any, partial = false): string | null {
  if (!partial || body.name !== undefined) if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 160) return "Product name is required (160 characters maximum).";
  if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 10000)) return "Description is too long.";
  if (!partial || body.pricePaise !== undefined) if (!Number.isSafeInteger(body.pricePaise) || body.pricePaise < 0 || body.pricePaise > 100_000_000) return "Enter a valid price in paise.";
  if (body.stock !== undefined && (!Number.isSafeInteger(body.stock) || body.stock < 0 || body.stock > 1_000_000)) return "Enter a valid stock quantity.";
  if (body.discountPercent !== undefined && (!Number.isInteger(body.discountPercent) || body.discountPercent < 0 || body.discountPercent > 100)) return "Discount must be between 0 and 100 percent.";
  if (body.originalPricePaise !== undefined && body.originalPricePaise !== null && (!Number.isSafeInteger(body.originalPricePaise) || body.originalPricePaise < 0 || body.originalPricePaise > 100_000_000)) return "Enter a valid original price in paise.";
  if (body.sku !== undefined && body.sku !== null && (typeof body.sku !== "string" || body.sku.trim().length > 80)) return "SKU must be under 80 characters.";
  if (body.brand !== undefined && body.brand !== null && (typeof body.brand !== "string" || body.brand.trim().length > 100)) return "Brand must be under 100 characters.";
  if (body.status !== undefined && !STATUSES.has(body.status)) return "Invalid product status.";
  if (body.images !== undefined && (!Array.isArray(body.images) || body.images.length > 8 || body.images.some((item: unknown) => typeof item !== "string" || item.length > 2048 || !/^https:\/\//i.test(item)))) return "Images must be HTTPS URLs (up to 8). Upload service is not configured.";
  if (body.specifications !== undefined && (!body.specifications || typeof body.specifications !== "object" || Array.isArray(body.specifications) || Object.keys(body.specifications).length > 30)) return "Specifications must be an object with up to 30 fields.";
  if (body.variants !== undefined && (!Array.isArray(body.variants) || body.variants.length > 12 || body.variants.some((variant: any) => !variant || typeof variant.name !== "string" || !variant.name.trim() || variant.name.length > 60 || !Array.isArray(variant.options) || variant.options.length > 100 || variant.options.some((option: any) => !option || typeof option.value !== "string" || !option.value.trim() || option.value.length > 80 || !Number.isSafeInteger(option.stock) || option.stock < 0 || option.stock > 1_000_000)))) return "Variants must have named options with non-negative stock counts.";
  if (body.categoryId !== undefined && body.categoryId !== null && (typeof body.categoryId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.categoryId))) return "Invalid category.";
  if (body.featured !== undefined && typeof body.featured !== "boolean") return "Featured must be true or false.";
  return null;
}

router.post("/store-admin/products", requirePermission("products.create"), async (req: StaffRequest, res) => {
  const message = validateProduct(req.body);
  if (message) return res.status(400).json({ error: message });
  const staff = req.storeStaff!;
  const requestedStatus = req.body.status ?? "draft";
  const status = requestedStatus === "published" && !hasPermission(staff.role, "products.approve") ? "pending_approval" : requestedStatus;
  if (["approved", "rejected"].includes(status) && !hasPermission(staff.role, "products.approve")) return res.status(403).json({ error: "Only an approver can approve or reject a product." });
  try {
    const result = await db.transaction(async (tx) => {
      const [product] = await tx.insert(storeProductsTable).values({ name: req.body.name.trim(), description: req.body.description ?? "", specifications: req.body.specifications ?? {}, images: req.body.images ?? [], pricePaise: req.body.pricePaise, originalPricePaise: req.body.originalPricePaise ?? null, sku: req.body.sku?.trim() || null, brand: req.body.brand?.trim() || null, variants: req.body.variants ?? [], discountPercent: req.body.discountPercent ?? 0, categoryId: req.body.categoryId ?? null, stock: req.body.stock ?? 0, status, featured: req.body.featured ?? false, createdBy: staff.userId, updatedBy: staff.userId }).returning();
      await tx.insert(storeAdminAuditLogsTable).values({ actorId: staff.userId, actorRole: staff.role, action: "products.created", outcome: "success", targetType: "product", targetId: product.id, requestId: req.get("x-request-id") ?? null });
      return product;
    });
    return res.status(201).json(result);
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Store product creation failed");
    return res.status(400).json({ error: "Product could not be created. Check that its category exists." });
  }
});

router.patch("/store-admin/products/:id", requireProductUpdatePermission, async (req: StaffRequest, res) => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) return res.status(400).json({ error: "Invalid product ID." });
  const message = validateProduct(req.body, true);
  if (message) return res.status(400).json({ error: message });
  const staff = req.storeStaff!;
  if (req.body.status === "published" && !hasPermission(staff.role, "products.approve")) return res.status(403).json({ error: "This role cannot publish products." });
  if (["approved", "rejected"].includes(req.body.status) && !hasPermission(staff.role, "products.approve")) return res.status(403).json({ error: "Only an approver can approve or reject a product." });
  if (!Object.keys(req.body ?? {}).some((key) => ["name", "description", "specifications", "images", "pricePaise", "originalPricePaise", "sku", "brand", "variants", "discountPercent", "categoryId", "stock", "status", "featured"].includes(key))) return res.status(400).json({ error: "No editable fields supplied." });
  try {
    const updated = await db.transaction(async (tx) => {
      const [product] = await tx.update(storeProductsTable).set({ ...("name" in req.body ? { name: req.body.name.trim() } : {}), ...("description" in req.body ? { description: req.body.description } : {}), ...("specifications" in req.body ? { specifications: req.body.specifications } : {}), ...("images" in req.body ? { images: req.body.images } : {}), ...("pricePaise" in req.body ? { pricePaise: req.body.pricePaise } : {}), ...("originalPricePaise" in req.body ? { originalPricePaise: req.body.originalPricePaise } : {}), ...("sku" in req.body ? { sku: req.body.sku?.trim() || null } : {}), ...("brand" in req.body ? { brand: req.body.brand?.trim() || null } : {}), ...("variants" in req.body ? { variants: req.body.variants } : {}), ...("discountPercent" in req.body ? { discountPercent: req.body.discountPercent } : {}), ...("categoryId" in req.body ? { categoryId: req.body.categoryId } : {}), ...("stock" in req.body ? { stock: req.body.stock } : {}), ...("status" in req.body ? { status: req.body.status } : {}), ...("featured" in req.body ? { featured: req.body.featured } : {}), updatedBy: staff.userId, updatedAt: new Date() }).where(eq(storeProductsTable.id, productId)).returning();
      if (!product) return null;
      await tx.insert(storeAdminAuditLogsTable).values({ actorId: staff.userId, actorRole: staff.role, action: "products.updated", outcome: "success", targetType: "product", targetId: product.id, requestId: req.get("x-request-id") ?? null, details: { fields: Object.keys(req.body) } });
      return product;
    });
    return updated ? res.json(updated) : res.status(404).json({ error: "Product not found." });
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Store product update failed");
    return res.status(400).json({ error: "Product could not be updated. Check that its category exists." });
  }
});

router.delete("/store-admin/products/:id", requirePermission("products.delete"), async (req: StaffRequest, res) => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) return res.status(400).json({ error: "Invalid product ID." });
  const staff = req.storeStaff!;
  const [product] = await db.update(storeProductsTable).set({ status: "archived", updatedBy: staff.userId, updatedAt: new Date() }).where(eq(storeProductsTable.id, productId)).returning({ id: storeProductsTable.id });
  if (!product) return res.status(404).json({ error: "Product not found." });
  await audit(req, staff.userId, staff.role, "products.archived", "success", "product", product.id);
  return res.json({ id: product.id, status: "archived" });
});

router.get("/store-admin/categories", requirePermission("products.view"), async (_req, res) => res.json(await db.select().from(storeCategoriesTable).orderBy(storeCategoriesTable.name)));
router.post("/store-admin/categories", requirePermission("categories.manage"), async (req: StaffRequest, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : null;
  const imageUrl = req.body?.imageUrl;
  if (!name || name.length > 80 || (description?.length ?? 0) > 2000 || imageUrl !== undefined && imageUrl !== null && (typeof imageUrl !== "string" || imageUrl.length > 2048 || !/^https:\/\//i.test(imageUrl))) return res.status(400).json({ error: "Enter a valid category name, description, and HTTPS image URL." });
  const staff = req.storeStaff!;
  try {
    const result = await db.transaction(async (tx) => {
      const [category] = await tx.insert(storeCategoriesTable).values({ name, description, imageUrl: imageUrl ?? null }).returning();
      await tx.insert(storeAdminAuditLogsTable).values({ actorId: staff.userId, actorRole: staff.role, action: "categories.created", outcome: "success", targetType: "category", targetId: category.id, requestId: req.get("x-request-id") ?? null });
      return category;
    });
    return res.status(201).json(result);
  } catch { return res.status(409).json({ error: "A category with that name already exists." }); }
});

router.patch("/store-admin/categories/:id", requirePermission("categories.manage"), async (req: StaffRequest, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid category ID." });
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ error: "Provide category fields to update." });
  const patch: Partial<typeof storeCategoriesTable.$inferInsert> = {};
  if ("name" in req.body) { if (typeof req.body.name !== "string" || !req.body.name.trim() || req.body.name.trim().length > 80) return res.status(400).json({ error: "Enter a category name under 80 characters." }); patch.name = req.body.name.trim(); }
  if ("description" in req.body) { if (typeof req.body.description !== "string" || req.body.description.length > 2000) return res.status(400).json({ error: "Category description must be under 2,000 characters." }); patch.description = req.body.description.trim(); }
  if ("imageUrl" in req.body) { if (req.body.imageUrl !== null && (typeof req.body.imageUrl !== "string" || req.body.imageUrl.length > 2048 || !/^https:\/\//i.test(req.body.imageUrl))) return res.status(400).json({ error: "Use an HTTPS category image URL." }); patch.imageUrl = req.body.imageUrl; }
  if ("visible" in req.body) { if (typeof req.body.visible !== "boolean") return res.status(400).json({ error: "Category visibility must be true or false." }); patch.visible = req.body.visible; }
  if (!Object.keys(patch).length) return res.status(400).json({ error: "Provide category fields to update." });
  try { const [category] = await db.update(storeCategoriesTable).set(patch).where(eq(storeCategoriesTable.id, id)).returning(); if (!category) return res.status(404).json({ error: "Category not found." }); await audit(req, req.storeStaff?.userId ?? null, req.storeStaff?.role ?? null, "category.updated", "success", "category", id, { fields: Object.keys(patch) }); return res.json(category); }
  catch { return res.status(409).json({ error: "Category could not be updated. The name may already be in use." }); }
});
router.delete("/store-admin/categories/:id", requirePermission("categories.manage"), async (req: StaffRequest, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid category ID." });
  const [category] = await db.update(storeCategoriesTable).set({ visible: false }).where(eq(storeCategoriesTable.id, id)).returning({ id: storeCategoriesTable.id });
  if (!category) return res.status(404).json({ error: "Category not found." });
  await audit(req, req.storeStaff?.userId ?? null, req.storeStaff?.role ?? null, "category.deactivated", "success", "category", id);
  return res.json({ id, visible: false });
});

router.get("/store-admin/sellers", requirePermission("sellers.approve"), async (req, res) => {
  const status = typeof req.query.status === "string" && ["pending", "approved", "rejected", "suspended"].includes(req.query.status) ? req.query.status : undefined;
  return res.json({ items: await db.select().from(storeSellersTable).where(status ? eq(storeSellersTable.status, status) : undefined).orderBy(desc(storeSellersTable.createdAt)).limit(200) });
});
router.patch("/store-admin/sellers/:id", requirePermission("sellers.approve"), async (req: StaffRequest, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id; const status = req.body?.status;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !["approved", "rejected", "suspended"].includes(status)) return res.status(400).json({ error: "Choose a valid seller and approval status." });
  const [seller] = await db.select().from(storeSellersTable).where(eq(storeSellersTable.id, id)).limit(1);
  if (!seller) return res.status(404).json({ error: "Seller application not found." });
  if (seller.userId === req.storeStaff?.userId) return res.status(403).json({ error: "Staff cannot approve or reject their own seller application." });
  const [updated] = await db.update(storeSellersTable).set({ status, updatedAt: new Date() }).where(eq(storeSellersTable.id, id)).returning();
  await audit(req, req.storeStaff?.userId ?? null, req.storeStaff?.role ?? null, `seller.${status}`, "success", "seller", id, { sellerUserId: seller.userId });
  return res.json(updated);
});

router.get("/store-admin/audit-logs", requirePermission("audit_logs.view"), async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const items = await db.select().from(storeAdminAuditLogsTable).orderBy(desc(storeAdminAuditLogsTable.createdAt)).limit(limit);
  return res.json({ items });
});

router.get("/store-admin/staff", requirePermission("staff.manage"), async (_req, res) => {
  const members = await db.select({ userId: storeAdminStaffTable.userId, role: storeAdminStaffTable.role, active: storeAdminStaffTable.active, createdAt: storeAdminStaffTable.createdAt, name: usersTable.fullName, email: usersTable.email })
    .from(storeAdminStaffTable).innerJoin(usersTable, eq(storeAdminStaffTable.userId, usersTable.id)).orderBy(usersTable.fullName);
  return res.json({ items: members });
});

router.post("/store-admin/staff", requirePermission("staff.manage"), async (req: StaffRequest, res) => {
  const staff = req.storeStaff!;
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const role = typeof req.body?.role === "string" ? req.body.role : "";
  const password = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const [actor] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, staff.userId)).limit(1);
  if (!password || !actor || !await bcrypt.compare(password, actor.passwordHash)) return res.status(403).json({ error: "Confirm this change with your current password." });
  if (staff.role !== "super_admin" || !isStoreAdminRole(role)) return res.status(403).json({ error: "Only a Super Admin can assign a store role." });
  if (!email || email.length > 254) return res.status(400).json({ error: "Enter the email of an existing Navodaya Connect account." });
  const [target] = await db.select({ id: usersTable.id, name: usersTable.fullName, email: usersTable.email }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!target) return res.status(404).json({ error: "No Navodaya Connect account has that email." });
  if (target.id === staff.userId) return res.status(400).json({ error: "You cannot change your own store role." });
  try {
    const member = await db.transaction(async (tx) => {
      const [saved] = await tx.insert(storeAdminStaffTable).values({ userId: target.id, role, active: true, updatedAt: new Date() }).onConflictDoUpdate({ target: storeAdminStaffTable.userId, set: { role, active: true, updatedAt: new Date() } }).returning();
      await tx.delete(storeAdminSessionsTable).where(eq(storeAdminSessionsTable.userId, target.id));
      await tx.insert(storeAdminAuditLogsTable).values({ actorId: staff.userId, actorRole: staff.role, action: "staff.role.assigned", outcome: "success", targetType: "staff", targetId: target.id, requestId: req.get("x-request-id") ?? null, details: { role } });
      return saved;
    });
    return res.status(200).json({ userId: member.userId, name: target.name, email: target.email, role: member.role, active: member.active });
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Store staff role assignment failed");
    return res.status(500).json({ error: "The staff assignment could not be saved." });
  }
});

router.patch("/store-admin/staff/:userId", requirePermission("staff.manage"), async (req: StaffRequest, res) => {
  const staff = req.storeStaff!;
  const targetId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const role = typeof req.body?.role === "string" ? req.body.role : undefined;
  const active = typeof req.body?.active === "boolean" ? req.body.active : undefined;
  const password = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const [actor] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, staff.userId)).limit(1);
  if (!password || !actor || !await bcrypt.compare(password, actor.passwordHash)) return res.status(403).json({ error: "Confirm this change with your current password." });
  if (staff.role !== "super_admin" || !targetId || !/^[0-9a-f-]{36}$/i.test(targetId) || role !== undefined && !isStoreAdminRole(role) || active === undefined && role === undefined) return res.status(400).json({ error: "Select a valid staff member and role or access state." });
  if (targetId === staff.userId) return res.status(400).json({ error: "You cannot change or revoke your own access." });
  try {
    const [target] = await db.select().from(storeAdminStaffTable).where(eq(storeAdminStaffTable.userId, targetId)).limit(1);
    if (!target) return res.status(404).json({ error: "Staff member not found." });
    const removesSuperAdmin = target.active && target.role === "super_admin" && (active === false || role !== undefined && role !== "super_admin");
    const result = await db.transaction(async (tx) => {
      if (removesSuperAdmin) {
        const [countAdmins] = await tx.select({ value: count() }).from(storeAdminStaffTable).where(and(eq(storeAdminStaffTable.active, true), eq(storeAdminStaffTable.role, "super_admin")));
        if (countAdmins.value < 2) throw new Error("Keep at least one active Super Admin.");
      }
      const [saved] = await tx.update(storeAdminStaffTable).set({ ...(role !== undefined ? { role } : {}), ...(active !== undefined ? { active } : {}), updatedAt: new Date() }).where(eq(storeAdminStaffTable.userId, targetId)).returning();
      await tx.delete(storeAdminSessionsTable).where(eq(storeAdminSessionsTable.userId, targetId));
      await tx.insert(storeAdminAuditLogsTable).values({ actorId: staff.userId, actorRole: staff.role, action: "staff.access.changed", outcome: "success", targetType: "staff", targetId, requestId: req.get("x-request-id") ?? null, details: { ...(role ? { role } : {}), ...(active !== undefined ? { active } : {}) } });
      return saved;
    });
    return res.json({ userId: result.userId, role: result.role, active: result.active });
  } catch (error) {
    if (error instanceof Error && error.message === "Keep at least one active Super Admin.") return res.status(409).json({ error: error.message });
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Store staff access change failed");
    return res.status(500).json({ error: "Staff access could not be changed." });
  }
});

export default router;
