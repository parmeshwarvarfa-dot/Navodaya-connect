import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import {
  db,
  storeAddressesTable,
  storeCartItemsTable,
  storeCategoriesTable,
  storeCommissionRulesTable,
  storeCouponsTable,
  storeOrderEventsTable,
  storeOrderItemsTable,
  storeOrdersTable,
  storePaymentsTable,
  storeProductsTable,
  storeReturnsTable,
  storeReviewsTable,
  storeSellersTable,
  storeShippingRatesTable,
  storeStockMovementsTable,
  storeSubOrdersTable,
  storeWishlistsTable,
  usersTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { createSocialNotification } from "../lib/social-access";
import { ensureStoreSeedData } from "../lib/storeSeed";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

void ensureStoreSeedData();

const publicProductFields = {
  id: storeProductsTable.id,
  name: storeProductsTable.name,
  description: storeProductsTable.description,
  specifications: storeProductsTable.specifications,
  images: storeProductsTable.images,
  pricePaise: storeProductsTable.pricePaise,
  originalPricePaise: storeProductsTable.originalPricePaise,
  discountPercent: storeProductsTable.discountPercent,
  sku: storeProductsTable.sku,
  brand: storeProductsTable.brand,
  variants: storeProductsTable.variants,
  stock: storeProductsTable.stock,
  soldCount: storeProductsTable.soldCount,
  featured: storeProductsTable.featured,
  categoryId: storeProductsTable.categoryId,
  ownershipType: storeProductsTable.ownershipType,
  sellerId: storeProductsTable.sellerId,
  fulfillmentModel: storeProductsTable.fulfillmentModel,
  weightGrams: storeProductsTable.weightGrams,
  dimensionsCm: storeProductsTable.dimensionsCm,
  codEligible: storeProductsTable.codEligible,
  returnPolicyDays: storeProductsTable.returnPolicyDays,
  condition: storeProductsTable.condition,
  createdAt: storeProductsTable.createdAt,
};

const serviceConfig = () => ({
  paymentCredentialsPresent: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? null,
  deliveryConfigurationPresent: true,
  paymentsEnabled: true,
  deliveryEnabled: true,
  checkoutEnabled: true,
  cardDataStorage: false,
  freeDeliveryThresholdPaise: 50000, // ₹500
  standardShippingPaise: 4900, // ₹49
});

async function calculateShipping(totalWeightGrams: number, subtotalPaise: number, paymentMethod: string) {
  const rates = await db.select().from(storeShippingRatesTable)
    .where(and(
      eq(storeShippingRatesTable.active, true),
      lte(storeShippingRatesTable.minWeightGrams, totalWeightGrams),
      gte(storeShippingRatesTable.maxWeightGrams, totalWeightGrams),
    ))
    .orderBy(asc(storeShippingRatesTable.baseRatePaise))
    .limit(1);

  const cfg = serviceConfig();
  const rate = rates[0];
  if (!rate) {
    const base = subtotalPaise >= cfg.freeDeliveryThresholdPaise ? 0 : cfg.standardShippingPaise;
    return {
      shippingPaise: base,
      codAllowedByRate: true,
      estimatedDaysMin: 3,
      estimatedDaysMax: 7,
      methodName: "Standard Delivery",
    };
  }
  const extraKg = Math.max(0, Math.ceil((totalWeightGrams - 500) / 1000));
  let shippingPaise = rate.freeAbovePaise != null && subtotalPaise >= rate.freeAbovePaise
    ? 0
    : rate.baseRatePaise + extraKg * rate.perKgPaise;
  if (paymentMethod === "cod" && rate.codAllowed && rate.codFeePaise > 0) {
    shippingPaise += rate.codFeePaise;
  }
  return {
    shippingPaise,
    codAllowedByRate: rate.codAllowed,
    estimatedDaysMin: rate.estimatedDaysMin,
    estimatedDaysMax: rate.estimatedDaysMax,
    methodName: rate.name,
  };
}

async function evaluateCoupon(codeRaw: unknown, subtotalPaise: number) {
  if (typeof codeRaw !== "string" || !codeRaw.trim()) return { coupon: null, discountPaise: 0, error: null };
  const code = codeRaw.trim().toUpperCase();
  const [coupon] = await db.select().from(storeCouponsTable).where(eq(storeCouponsTable.code, code)).limit(1);
  if (!coupon || !coupon.active) return { coupon: null, discountPaise: 0, error: "Coupon code is invalid or inactive." };
  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) return { coupon: null, discountPaise: 0, error: "This coupon is not active yet." };
  if (coupon.expiresAt && now > coupon.expiresAt) return { coupon: null, discountPaise: 0, error: "This coupon has expired." };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { coupon: null, discountPaise: 0, error: "Coupon usage limit reached." };
  if (subtotalPaise < coupon.minimumSubtotalPaise) {
    return { coupon: null, discountPaise: 0, error: `Minimum order of ₹${Math.ceil(coupon.minimumSubtotalPaise / 100)} required for this coupon.` };
  }
  let discountPaise = coupon.discountType === "percent"
    ? Math.round((subtotalPaise * coupon.discountValue) / 100)
    : coupon.discountValue;
  if (coupon.maximumDiscountPaise != null) discountPaise = Math.min(discountPaise, coupon.maximumDiscountPaise);
  discountPaise = Math.max(0, Math.min(discountPaise, subtotalPaise));
  return { coupon, discountPaise, error: null };
}

router.get("/store/config", (_req, res) => res.json({
  ...serviceConfig(),
  note: "Navodaya Connect Store hybrid marketplace engine active.",
}));

router.get("/store/categories", async (_req, res) => {
  await ensureStoreSeedData();
  const categories = await db.select({
    id: storeCategoriesTable.id,
    name: storeCategoriesTable.name,
    description: storeCategoriesTable.description,
    imageUrl: storeCategoriesTable.imageUrl,
    parentId: storeCategoriesTable.parentId,
    sortOrder: storeCategoriesTable.sortOrder,
  })
    .from(storeCategoriesTable)
    .where(and(eq(storeCategoriesTable.visible, true), eq(storeCategoriesTable.archived, false)))
    .orderBy(asc(storeCategoriesTable.sortOrder), asc(storeCategoriesTable.name));
  return res.json(categories);
});

router.get("/store/products", async (req, res) => {
  await ensureStoreSeedData();
  const page = Math.max(1, Math.min(10_000, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
  const pageSize = Math.max(1, Math.min(50, Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const brand = typeof req.query.brand === "string" ? req.query.brand.trim().slice(0, 80) : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 80) : "";
  const sellerId = typeof req.query.sellerId === "string" && UUID.test(req.query.sellerId) ? req.query.sellerId : "";
  const minPrice = Number.parseInt(String(req.query.minPricePaise ?? ""), 10);
  const maxPrice = Number.parseInt(String(req.query.maxPricePaise ?? ""), 10);
  const featuredOnly = req.query.featured === "true";
  const inStockOnly = req.query.inStock === "true";
  const discountedOnly = req.query.discounted === "true";

  const conditions = [
    eq(storeProductsTable.status, "published"),
    or(
      eq(storeProductsTable.ownershipType, "platform"),
      eq(storeSellersTable.status, "approved"),
    )!,
  ];
  if (q) {
    conditions.push(or(
      ilike(storeProductsTable.name, `%${q}%`),
      ilike(storeProductsTable.description, `%${q}%`),
      ilike(storeProductsTable.brand, `%${q}%`),
      ilike(storeCategoriesTable.name, `%${q}%`),
    )!);
  }
  if (brand) conditions.push(ilike(storeProductsTable.brand, brand));
  if (sellerId) conditions.push(eq(storeProductsTable.sellerId, sellerId));
  if (category) {
    conditions.push(UUID.test(category)
      ? or(eq(storeCategoriesTable.id, category), ilike(storeCategoriesTable.name, category))!
      : ilike(storeCategoriesTable.name, category));
  }
  if (Number.isSafeInteger(minPrice) && minPrice >= 0) conditions.push(gte(storeProductsTable.pricePaise, minPrice));
  if (Number.isSafeInteger(maxPrice) && maxPrice >= 0) conditions.push(lte(storeProductsTable.pricePaise, maxPrice));
  if (featuredOnly) conditions.push(eq(storeProductsTable.featured, true));
  if (inStockOnly) conditions.push(gte(storeProductsTable.stock, 1));
  if (discountedOnly) conditions.push(gte(storeProductsTable.discountPercent, 1));

  const sort = String(req.query.sort ?? "newest");
  const orderBy = sort === "price_asc"
    ? [asc(storeProductsTable.pricePaise)]
    : sort === "price_desc"
      ? [desc(storeProductsTable.pricePaise)]
      : sort === "popularity"
        ? [desc(storeProductsTable.soldCount), desc(storeProductsTable.featured)]
        : sort === "name"
          ? [asc(storeProductsTable.name)]
          : [desc(storeProductsTable.featured), desc(storeProductsTable.createdAt)];

  const where = and(...conditions);
  try {
    const [items, totalRows] = await Promise.all([
      db.select({
        ...publicProductFields,
        category: storeCategoriesTable.name,
        sellerName: storeSellersTable.displayName,
      })
        .from(storeProductsTable)
        .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
        .leftJoin(storeSellersTable, eq(storeProductsTable.sellerId, storeSellersTable.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() })
        .from(storeProductsTable)
        .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
        .leftJoin(storeSellersTable, eq(storeProductsTable.sellerId, storeSellersTable.id))
        .where(where),
    ]);
    return res.json({
      items,
      page,
      pageSize,
      total: totalRows[0]?.total ?? 0,
      hasMore: page * pageSize < (totalRows[0]?.total ?? 0),
    });
  } catch (err: any) {
    req.log.error(err, "Failed to load store products");
    return res.status(500).json({ error: "Could not load products at this time." });
  }
});

router.get("/store/products/:id", async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid product ID." });
  const [product] = await db.select({
    ...publicProductFields,
    category: storeCategoriesTable.name,
    sellerName: storeSellersTable.displayName,
    sellerStatus: storeSellersTable.status,
  })
    .from(storeProductsTable)
    .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
    .leftJoin(storeSellersTable, eq(storeProductsTable.sellerId, storeSellersTable.id))
    .where(and(eq(storeProductsTable.id, id), eq(storeProductsTable.status, "published")))
    .limit(1);
  if (!product || (product.ownershipType === "seller" && product.sellerStatus !== "approved")) {
    return res.status(404).json({ error: "Product is not available." });
  }
  const reviews = await db.select({
    id: storeReviewsTable.id,
    rating: storeReviewsTable.rating,
    body: storeReviewsTable.body,
    createdAt: storeReviewsTable.createdAt,
    reviewer: usersTable.fullName,
  })
    .from(storeReviewsTable)
    .innerJoin(usersTable, eq(storeReviewsTable.userId, usersTable.id))
    .where(and(eq(storeReviewsTable.productId, id), eq(storeReviewsTable.status, "published")))
    .orderBy(desc(storeReviewsTable.createdAt))
    .limit(50);
  const rating = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : null;
  return res.json({
    ...product,
    reviews: reviews.map((r) => ({ ...r, verifiedPurchase: true })),
    reviewCount: reviews.length,
    averageRating: rating,
  });
});

// ─── Public Seller Profile (Approved Sellers Only, Zero Private Data) ─────────
router.get("/store/sellers/:id", async (req, res) => {
  const sellerId = req.params.id as string;
  if (!UUID.test(sellerId)) return res.status(400).json({ error: "Invalid seller ID." });
  const [seller] = await db.select({
    id: storeSellersTable.id,
    displayName: storeSellersTable.displayName,
    description: storeSellersTable.description,
    logoUrl: storeSellersTable.logoUrl,
    sellerType: storeSellersTable.sellerType,
    status: storeSellersTable.status,
    createdAt: storeSellersTable.createdAt,
  }).from(storeSellersTable).where(and(eq(storeSellersTable.id, sellerId), eq(storeSellersTable.status, "approved"))).limit(1);
  if (!seller) return res.status(404).json({ error: "Seller not found." });

  const products = await db.select({ ...publicProductFields, category: storeCategoriesTable.name })
    .from(storeProductsTable)
    .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
    .where(and(eq(storeProductsTable.sellerId, sellerId), eq(storeProductsTable.status, "published")))
    .orderBy(desc(storeProductsTable.createdAt))
    .limit(50);

  return res.json({ seller, products });
});

router.get("/store/cart", requireAuth, async (req, res) => {
  const user = getUser(req);
  const rows = await db.select({
    id: storeCartItemsTable.id,
    productId: storeProductsTable.id,
    variantSelection: storeCartItemsTable.variantSelection,
    quantity: storeCartItemsTable.quantity,
    productName: storeProductsTable.name,
    pricePaise: storeProductsTable.pricePaise,
    originalPricePaise: storeProductsTable.originalPricePaise,
    stock: storeProductsTable.stock,
    variants: storeProductsTable.variants,
    status: storeProductsTable.status,
    images: storeProductsTable.images,
    categoryId: storeProductsTable.categoryId,
    category: storeCategoriesTable.name,
    sellerId: storeProductsTable.sellerId,
    ownershipType: storeProductsTable.ownershipType,
    codEligible: storeProductsTable.codEligible,
    weightGrams: storeProductsTable.weightGrams,
    updatedAt: storeCartItemsTable.updatedAt,
  })
    .from(storeCartItemsTable)
    .innerJoin(storeProductsTable, eq(storeCartItemsTable.productId, storeProductsTable.id))
    .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
    .where(eq(storeCartItemsTable.userId, user.id))
    .orderBy(asc(storeCartItemsTable.createdAt));

  const items = rows.map((row) => {
    let stock = row.stock;
    if (Array.isArray(row.variants) && row.variants.length) {
      try {
        const selected = JSON.parse(row.variantSelection || "{}") as Record<string, string>;
        const variants = row.variants as Array<{ name: string; options: Array<{ value: string; stock: number }> }>;
        const counts = variants.map((variant) => variant.options.find((option) => option.value === selected[variant.name])?.stock ?? 0);
        stock = counts.length ? Math.min(...counts) : 0;
      } catch {
        stock = 0;
      }
    }
    const { variants: _variants, ...item } = row;
    return { ...item, stock };
  });

  const subtotalPaise = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  return res.json({ items, subtotalPaise });
});

router.put("/store/cart/items", requireAuth, async (req, res) => {
  const user = getUser(req);
  const productId = req.body?.productId;
  const quantity = req.body?.quantity;
  const selection = req.body?.variantSelection ?? {};
  if (typeof productId !== "string" || !UUID.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return res.status(400).json({ error: "Choose a product and a quantity between 1 and 99." });
  }
  if (!selection || typeof selection !== "object" || Array.isArray(selection) || Object.keys(selection).length > 12) {
    return res.status(400).json({ error: "Choose valid product options." });
  }

  const [product] = await db.select({
    id: storeProductsTable.id,
    stock: storeProductsTable.stock,
    status: storeProductsTable.status,
    variants: storeProductsTable.variants,
  }).from(storeProductsTable).where(eq(storeProductsTable.id, productId)).limit(1);

  if (!product || product.status !== "published") return res.status(404).json({ error: "Product is not available." });
  const variants = Array.isArray(product.variants) ? product.variants as Array<{ name: string; options: Array<{ value: string; stock: number }> }> : [];

  if (variants.length > 0) {
    const missing = variants.filter((v) => !selection[v.name]);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Please select an option for: ${missing.map((m) => m.name).join(", ")}` });
    }
  }
  if (quantity > product.stock) {
    return res.status(409).json({ error: `Only ${product.stock} unit(s) available in stock.` });
  }

  const variantSelection = JSON.stringify(Object.fromEntries(Object.entries(selection).sort(([a], [b]) => a.localeCompare(b))));
  const [item] = await db.insert(storeCartItemsTable).values({
    userId: user.id,
    productId,
    variantSelection,
    quantity,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [storeCartItemsTable.userId, storeCartItemsTable.productId, storeCartItemsTable.variantSelection],
    set: { quantity, updatedAt: new Date() },
  }).returning();

  return res.json(item);
});

router.delete("/store/cart/items/:itemId", requireAuth, async (req, res) => {
  const user = getUser(req);
  const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
  if (!itemId || !UUID.test(itemId)) return res.status(400).json({ error: "Invalid cart item ID." });
  await db.delete(storeCartItemsTable).where(and(eq(storeCartItemsTable.userId, user.id), eq(storeCartItemsTable.id, itemId)));
  return res.json({ removed: true });
});

router.delete("/store/cart", requireAuth, async (req, res) => {
  const user = getUser(req);
  await db.delete(storeCartItemsTable).where(eq(storeCartItemsTable.userId, user.id));
  return res.json({ cleared: true });
});

function validateAddress(body: any): string | null {
  if (!body || typeof body !== "object") return "Enter delivery address details.";
  for (const field of ["recipientName", "phone", "line1", "city", "district", "state"]) {
    if (typeof body[field] !== "string" || !body[field].trim() || body[field].length > 160) {
      return `Enter a valid ${field}.`;
    }
  }
  if (typeof body.pincode !== "string" || !/^\d{6}$/.test(body.pincode)) return "Enter a valid 6-digit PIN code.";
  if (!new Set(["home", "hostel", "school", "other"]).has(body.type ?? "home")) return "Choose a valid address type.";
  if (body.phone.replace(/\D/g, "").length < 10 || body.phone.length > 24) return "Enter a valid contact number.";
  if (body.line2 !== undefined && (typeof body.line2 !== "string" || body.line2.length > 160)) return "Address line 2 is too long.";
  if (body.instructions !== undefined && (typeof body.instructions !== "string" || body.instructions.length > 300)) return "Delivery instructions must be under 300 characters.";
  return null;
}

router.get("/store/addresses", requireAuth, async (req, res) => {
  return res.json(await db.select().from(storeAddressesTable).where(eq(storeAddressesTable.userId, getUser(req).id)).orderBy(desc(storeAddressesTable.isDefault), asc(storeAddressesTable.createdAt)));
});

router.post("/store/addresses", requireAuth, async (req, res) => {
  const problem = validateAddress(req.body);
  if (problem) return res.status(400).json({ error: problem });
  const userId = getUser(req).id;
  const isDefault = req.body.isDefault === true;
  try {
    const address = await db.transaction(async (tx) => {
      if (isDefault) await tx.update(storeAddressesTable).set({ isDefault: false, updatedAt: new Date() }).where(eq(storeAddressesTable.userId, userId));
      const [inserted] = await tx.insert(storeAddressesTable).values({
        userId,
        recipientName: req.body.recipientName.trim(),
        phone: req.body.phone.trim(),
        type: req.body.type ?? "home",
        line1: req.body.line1.trim(),
        line2: req.body.line2?.trim() ?? null,
        city: req.body.city.trim(),
        district: req.body.district.trim(),
        state: req.body.state.trim(),
        pincode: req.body.pincode,
        instructions: req.body.instructions?.trim() ?? null,
        isDefault,
      }).returning();
      return inserted;
    });
    return res.status(201).json(address);
  } catch {
    return res.status(409).json({ error: "Address could not be saved." });
  }
});

router.patch("/store/addresses/:id", requireAuth, async (req, res) => {
  const userId = getUser(req).id;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid address ID." });
  const problem = validateAddress(req.body);
  if (problem) return res.status(400).json({ error: problem });
  try {
    const address = await db.transaction(async (tx) => {
      if (req.body.isDefault === true) await tx.update(storeAddressesTable).set({ isDefault: false, updatedAt: new Date() }).where(eq(storeAddressesTable.userId, userId));
      const [updated] = await tx.update(storeAddressesTable).set({
        recipientName: req.body.recipientName.trim(),
        phone: req.body.phone.trim(),
        type: req.body.type ?? "home",
        line1: req.body.line1.trim(),
        line2: req.body.line2?.trim() ?? null,
        city: req.body.city.trim(),
        district: req.body.district.trim(),
        state: req.body.state.trim(),
        pincode: req.body.pincode,
        instructions: req.body.instructions?.trim() ?? null,
        isDefault: req.body.isDefault === true,
        updatedAt: new Date(),
      }).where(and(eq(storeAddressesTable.id, id), eq(storeAddressesTable.userId, userId))).returning();
      return updated;
    });
    return address ? res.json(address) : res.status(404).json({ error: "Address not found." });
  } catch {
    return res.status(409).json({ error: "Address could not be updated." });
  }
});

router.delete("/store/addresses/:id", requireAuth, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid address ID." });
  const [deleted] = await db.delete(storeAddressesTable).where(and(eq(storeAddressesTable.id, id), eq(storeAddressesTable.userId, getUser(req).id))).returning({ id: storeAddressesTable.id });
  return deleted ? res.json({ deleted: true }) : res.status(404).json({ error: "Address not found." });
});

router.get("/store/wishlist", requireAuth, async (req, res) => {
  const items = await db.select({
    ...publicProductFields,
    category: storeCategoriesTable.name,
    savedAt: storeWishlistsTable.createdAt,
  })
    .from(storeWishlistsTable)
    .innerJoin(storeProductsTable, eq(storeWishlistsTable.productId, storeProductsTable.id))
    .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
    .where(eq(storeWishlistsTable.userId, getUser(req).id))
    .orderBy(desc(storeWishlistsTable.createdAt));
  return res.json({ items });
});

router.post("/store/wishlist/:productId", requireAuth, async (req, res) => {
  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  if (!productId || !UUID.test(productId)) return res.status(400).json({ error: "Invalid product ID." });
  const [product] = await db.select({ id: storeProductsTable.id, status: storeProductsTable.status }).from(storeProductsTable).where(eq(storeProductsTable.id, productId)).limit(1);
  if (!product || product.status !== "published") return res.status(404).json({ error: "Product not found." });
  await db.insert(storeWishlistsTable).values({ userId: getUser(req).id, productId }).onConflictDoNothing();
  return res.json({ saved: true });
});

router.delete("/store/wishlist/:productId", requireAuth, async (req, res) => {
  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  if (!productId || !UUID.test(productId)) return res.status(400).json({ error: "Invalid product ID." });
  await db.delete(storeWishlistsTable).where(and(eq(storeWishlistsTable.userId, getUser(req).id), eq(storeWishlistsTable.productId, productId)));
  return res.json({ saved: false });
});

// ─── Checkout Preview (Coupon + Weight Shipping + Selective COD) ───────────────
router.post("/store/checkout/preview", requireAuth, async (req, res) => {
  const userId = getUser(req).id;
  const addressId = req.body?.addressId;
  const paymentMethod = typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod.toLowerCase() : "online";
  if (typeof addressId !== "string" || !UUID.test(addressId)) return res.status(400).json({ error: "Select a valid delivery address." });
  const [address] = await db.select().from(storeAddressesTable).where(and(eq(storeAddressesTable.id, addressId), eq(storeAddressesTable.userId, userId))).limit(1);
  if (!address) return res.status(404).json({ error: "Delivery address not found." });

  const rows = await db.select({
    productId: storeProductsTable.id,
    name: storeProductsTable.name,
    images: storeProductsTable.images,
    quantity: storeCartItemsTable.quantity,
    pricePaise: storeProductsTable.pricePaise,
    stock: storeProductsTable.stock,
    variants: storeProductsTable.variants,
    variantSelection: storeCartItemsTable.variantSelection,
    status: storeProductsTable.status,
    weightGrams: storeProductsTable.weightGrams,
    codEligible: storeProductsTable.codEligible,
    ownershipType: storeProductsTable.ownershipType,
    sellerId: storeProductsTable.sellerId,
    sellerCodEnabled: storeSellersTable.codEnabled,
    sellerStatus: storeSellersTable.status,
  })
    .from(storeCartItemsTable)
    .innerJoin(storeProductsTable, eq(storeCartItemsTable.productId, storeProductsTable.id))
    .leftJoin(storeSellersTable, eq(storeProductsTable.sellerId, storeSellersTable.id))
    .where(eq(storeCartItemsTable.userId, userId));

  const items = rows.map((row) => {
    let stock = row.stock;
    if (Array.isArray(row.variants) && row.variants.length) {
      try {
        const selected = JSON.parse(row.variantSelection || "{}") as Record<string, string>;
        const variants = row.variants as Array<{ name: string; options: Array<{ value: string; stock: number }> }>;
        const counts = variants.map((variant) => variant.options.find((option) => option.value === selected[variant.name])?.stock ?? 0);
        stock = counts.length ? Math.min(...counts) : 0;
      } catch {
        stock = 0;
      }
    }
    const sellerActive = row.ownershipType === "platform" || row.sellerStatus === "approved";
    return {
      productId: row.productId,
      name: row.name,
      imageUrl: Array.isArray(row.images) && row.images[0] ? row.images[0] : null,
      quantity: row.quantity,
      pricePaise: row.pricePaise,
      variantSelection: row.variantSelection,
      stock,
      status: sellerActive ? row.status : "unavailable",
      weightGrams: row.weightGrams,
      codEligible: row.codEligible && (row.ownershipType === "platform" || Boolean(row.sellerCodEnabled)),
    };
  });

  if (!items.length) return res.status(400).json({ error: "Your cart is empty." });
  const unavailable = items.filter((item) => item.status !== "published" || item.stock < item.quantity);
  const subtotalPaise = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  const totalWeightGrams = items.reduce((sum, item) => sum + (item.weightGrams || 250) * item.quantity, 0);

  const couponEval = await evaluateCoupon(req.body?.couponCode, subtotalPaise);
  const shipping = await calculateShipping(totalWeightGrams, subtotalPaise, paymentMethod);
  const codEligible = shipping.codAllowedByRate && items.every((i) => i.codEligible);
  const totalPaise = Math.max(0, subtotalPaise - couponEval.discountPaise + shipping.shippingPaise);

  return res.json({
    items,
    subtotalPaise,
    discountPaise: couponEval.discountPaise,
    couponCode: couponEval.coupon?.code ?? null,
    couponError: couponEval.error,
    shippingPaise: shipping.shippingPaise,
    shippingMethod: shipping.methodName,
    estimatedDaysMin: shipping.estimatedDaysMin,
    estimatedDaysMax: shipping.estimatedDaysMax,
    codEligible,
    totalPaise,
    address,
    canPlaceOrder: unavailable.length === 0,
    unavailable,
    integrations: serviceConfig(),
    message: unavailable.length ? "Some cart items are out of stock or unavailable." : undefined,
  });
});

// ─── Concurrency-Safe Multi-Seller Order Creation ─────────────────────────────
router.post("/store/orders", requireAuth, async (req, res) => {
  const userId = getUser(req).id;
  const addressId = req.body?.addressId;
  const paymentMethod = typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod.toLowerCase() : "upi";
  const idempotencyKey = typeof req.body?.idempotencyKey === "string" && req.body.idempotencyKey.trim()
    ? req.body.idempotencyKey.trim().slice(0, 120)
    : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (typeof addressId !== "string" || !UUID.test(addressId)) {
    return res.status(400).json({ error: "Select a valid delivery address." });
  }

  const [existingOrder] = await db.select().from(storeOrdersTable)
    .where(and(eq(storeOrdersTable.userId, userId), eq(storeOrdersTable.idempotencyKey, idempotencyKey)))
    .limit(1);
  if (existingOrder) {
    const [items, events, subOrders] = await Promise.all([
      db.select().from(storeOrderItemsTable).where(eq(storeOrderItemsTable.orderId, existingOrder.id)),
      db.select().from(storeOrderEventsTable).where(eq(storeOrderEventsTable.orderId, existingOrder.id)).orderBy(asc(storeOrderEventsTable.createdAt)),
      db.select().from(storeSubOrdersTable).where(eq(storeSubOrdersTable.orderId, existingOrder.id)),
    ]);
    return res.json({ ...existingOrder, items, events, subOrders });
  }

  const [address] = await db.select().from(storeAddressesTable)
    .where(and(eq(storeAddressesTable.id, addressId), eq(storeAddressesTable.userId, userId)))
    .limit(1);
  if (!address) return res.status(404).json({ error: "Delivery address not found." });

  const orderNumber = `JNV-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  try {
    const txResult = await db.transaction(async (tx) => {
      const cartRows = await tx.select({
        cartId: storeCartItemsTable.id,
        productId: storeProductsTable.id,
        productName: storeProductsTable.name,
        images: storeProductsTable.images,
        pricePaise: storeProductsTable.pricePaise,
        status: storeProductsTable.status,
        categoryId: storeProductsTable.categoryId,
        sellerId: storeProductsTable.sellerId,
        ownershipType: storeProductsTable.ownershipType,
        fulfillmentModel: storeProductsTable.fulfillmentModel,
        weightGrams: storeProductsTable.weightGrams,
        codEligible: storeProductsTable.codEligible,
        quantity: storeCartItemsTable.quantity,
        variantSelection: storeCartItemsTable.variantSelection,
      })
        .from(storeCartItemsTable)
        .innerJoin(storeProductsTable, eq(storeCartItemsTable.productId, storeProductsTable.id))
        .where(eq(storeCartItemsTable.userId, userId));

      if (!cartRows.length) return { error: "Your shopping cart is empty.", status: 400 as const };

      // Lock all product rows in deterministic order to prevent deadlocks and overselling
      const productIds = [...new Set(cartRows.map((c) => c.productId))].sort();
      for (const pid of productIds) {
        await tx.execute(sql`SELECT id FROM store_products WHERE id = ${pid} FOR UPDATE`);
      }

      // Re-fetch locked stock & seller status
      const lockedProducts = await tx.select({
        id: storeProductsTable.id,
        stock: storeProductsTable.stock,
        status: storeProductsTable.status,
        sellerId: storeProductsTable.sellerId,
        ownershipType: storeProductsTable.ownershipType,
        codEligible: storeProductsTable.codEligible,
        sellerCodEnabled: storeSellersTable.codEnabled,
        sellerStatus: storeSellersTable.status,
        sellerUserId: storeSellersTable.userId,
      })
        .from(storeProductsTable)
        .leftJoin(storeSellersTable, eq(storeProductsTable.sellerId, storeSellersTable.id))
        .where(inArray(storeProductsTable.id, productIds));

      const prodMap = new Map(lockedProducts.map((p) => [p.id, p]));
      for (const item of cartRows) {
        const p = prodMap.get(item.productId);
        if (!p || p.status !== "published" || (p.ownershipType === "seller" && p.sellerStatus !== "approved")) {
          return { error: `Item "${item.productName}" is no longer available.`, status: 409 as const };
        }
        if (p.stock < item.quantity) {
          return { error: `Insufficient stock for "${item.productName}" (only ${p.stock} left).`, status: 409 as const };
        }
      }

      const subtotalPaise = cartRows.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
      const totalWeightGrams = cartRows.reduce((sum, item) => sum + (item.weightGrams || 250) * item.quantity, 0);
      const shipping = await calculateShipping(totalWeightGrams, subtotalPaise, paymentMethod);
      const couponEval = await evaluateCoupon(req.body?.couponCode, subtotalPaise);
      if (req.body?.couponCode && couponEval.error) {
        return { error: couponEval.error, status: 400 as const };
      }

      if (paymentMethod === "cod") {
        const allCodOk = shipping.codAllowedByRate && cartRows.every((c) => {
          const p = prodMap.get(c.productId)!;
          return p.codEligible && (p.ownershipType === "platform" || Boolean(p.sellerCodEnabled));
        });
        if (!allCodOk) {
          return { error: "Cash on Delivery is not available for one or more items in your cart.", status: 400 as const };
        }
      }

      const totalPaise = Math.max(0, subtotalPaise - couponEval.discountPaise + shipping.shippingPaise);
      const razorpayReady = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
      const initialOrderStatus = paymentMethod === "cod" || !razorpayReady ? "confirmed" : "pending_payment";
      const initialPaymentStatus = paymentMethod === "cod" ? "pending_cod" : razorpayReady ? "pending" : "not_configured";

      const [order] = await tx.insert(storeOrdersTable).values({
        orderNumber,
        userId,
        addressSnapshot: {
          recipientName: address.recipientName,
          phone: address.phone,
          type: address.type,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          district: address.district,
          state: address.state,
          pincode: address.pincode,
          instructions: address.instructions,
        },
        subtotalPaise,
        shippingPaise: shipping.shippingPaise,
        discountPaise: couponEval.discountPaise,
        couponCode: couponEval.coupon?.code ?? null,
        totalPaise,
        status: initialOrderStatus,
        paymentStatus: initialPaymentStatus,
        fulfillmentStatus: "not_started",
        paymentMethod,
        idempotencyKey,
      }).returning();

      if (couponEval.coupon) {
        await tx.update(storeCouponsTable)
          .set({ usedCount: sql`${storeCouponsTable.usedCount} + 1` })
          .where(eq(storeCouponsTable.id, couponEval.coupon.id));
      }

      // Load active category commission rules
      const rules = await tx.select().from(storeCommissionRulesTable).where(eq(storeCommissionRulesTable.active, true));
      const ruleByCat = new Map(rules.map((r) => [r.categoryId ?? "", r]));

      // Group cart items by seller/platform for multi-seller sub-orders
      const groups = new Map<string, typeof cartRows>();
      for (const item of cartRows) {
        const key = item.ownershipType === "seller" && item.sellerId ? `seller:${item.sellerId}` : "platform:main";
        const list = groups.get(key) ?? [];
        list.push(item);
        groups.set(key, list);
      }

      const sellerNotifications: Array<{ sellerUserId: string; orderNumber: string }> = [];
      for (const [key, groupItems] of groups.entries()) {
        const isSeller = key.startsWith("seller:");
        const sellerId = isSeller ? key.slice(7) : null;
        const groupSubtotal = groupItems.reduce((s, i) => s + i.pricePaise * i.quantity, 0);
        const groupDiscount = subtotalPaise > 0 ? Math.round((couponEval.discountPaise * groupSubtotal) / subtotalPaise) : 0;
        const groupShipping = subtotalPaise > 0 ? Math.round((shipping.shippingPaise * groupSubtotal) / subtotalPaise) : 0;

        let groupCommission = 0;
        let lastRateBps = 0;
        for (const gi of groupItems) {
          if (isSeller) {
            const rule = ruleByCat.get(gi.categoryId ?? "");
            const rateBps = rule?.rateBps ?? 1000; // fallback 10% if admin hasn't overridden
            lastRateBps = rateBps;
            groupCommission += Math.round((gi.pricePaise * gi.quantity * rateBps) / 10000);
          }
        }
        const sellerPayablePaise = isSeller ? Math.max(0, groupSubtotal - groupDiscount - groupCommission) : 0;

        const [subOrder] = await tx.insert(storeSubOrdersTable).values({
          orderId: order.id,
          sellerId,
          ownershipType: isSeller ? "seller" : "platform",
          fulfillmentModel: isSeller ? "seller" : "platform",
          subtotalPaise: groupSubtotal,
          shippingPaise: groupShipping,
          discountPaise: groupDiscount,
          commissionRateBps: lastRateBps,
          commissionPaise: groupCommission,
          sellerPayablePaise,
          fulfillmentStatus: "not_started",
        }).returning();

        for (const item of groupItems) {
          let variantSnapshot = {};
          try { variantSnapshot = JSON.parse(item.variantSelection || "{}"); } catch {}
          const itemRateBps = isSeller ? (ruleByCat.get(item.categoryId ?? "")?.rateBps ?? 1000) : 0;
          const itemCommission = isSeller ? Math.round((item.pricePaise * item.quantity * itemRateBps) / 10000) : 0;

          await tx.insert(storeOrderItemsTable).values({
            orderId: order.id,
            subOrderId: subOrder.id,
            sellerId,
            ownershipType: isSeller ? "seller" : "platform",
            productId: item.productId,
            productName: item.productName,
            imageUrl: Array.isArray(item.images) && item.images[0] ? item.images[0] : null,
            unitPricePaise: item.pricePaise,
            quantity: item.quantity,
            commissionPaise: itemCommission,
            variantSnapshot,
          });

          // Atomic conditional stock decrement (never goes negative)
          const [decremented] = await tx.update(storeProductsTable)
            .set({
              stock: sql`${storeProductsTable.stock} - ${item.quantity}`,
              soldCount: sql`${storeProductsTable.soldCount} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(and(eq(storeProductsTable.id, item.productId), gte(storeProductsTable.stock, item.quantity)))
            .returning({ stock: storeProductsTable.stock });

          if (!decremented) {
            throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
          }

          await tx.insert(storeStockMovementsTable).values({
            productId: item.productId,
            actorId: userId,
            movementType: "order_sale",
            quantityDelta: -item.quantity,
            availableAfter: decremented.stock,
            referenceType: "order",
            referenceId: order.id,
            note: `Order ${orderNumber}`,
          });

          if (isSeller) {
            const p = prodMap.get(item.productId);
            if (p?.sellerUserId) sellerNotifications.push({ sellerUserId: p.sellerUserId, orderNumber });
          }
        }
      }

      await tx.insert(storePaymentsTable).values({
        orderId: order.id,
        gateway: paymentMethod === "cod" ? "cod" : "razorpay",
        amountPaise: totalPaise,
        currency: "INR",
        status: initialPaymentStatus,
        method: paymentMethod,
        signatureVerified: false,
        idempotencyKey: `pay-${idempotencyKey}`,
      });

      await tx.insert(storeOrderEventsTable).values({
        orderId: order.id,
        actorId: userId,
        status: initialOrderStatus,
        note: `Order ${orderNumber} created (${paymentMethod.toUpperCase()}).`,
      });

      await tx.delete(storeCartItemsTable).where(eq(storeCartItemsTable.userId, userId));
      return { order, sellerNotifications };
    });

    if ("error" in txResult) {
      return res.status(txResult.status!).json({ error: txResult.error });
    }

    // Notifications outside transaction
    await createSocialNotification(
      userId,
      userId,
      "store_order_placed",
      txResult.order.id,
      `Your Store Room order ${txResult.order.orderNumber} (${txResult.order.status}) has been placed.`,
    ).catch(() => {});

    for (const sn of txResult.sellerNotifications) {
      await createSocialNotification(
        sn.sellerUserId,
        userId,
        "store_seller_order",
        txResult.order.id,
        `New seller order received: ${sn.orderNumber}.`,
      ).catch(() => {});
    }

    const [items, events, subOrders] = await Promise.all([
      db.select().from(storeOrderItemsTable).where(eq(storeOrderItemsTable.orderId, txResult.order.id)),
      db.select().from(storeOrderEventsTable).where(eq(storeOrderEventsTable.orderId, txResult.order.id)).orderBy(asc(storeOrderEventsTable.createdAt)),
      db.select().from(storeSubOrdersTable).where(eq(storeSubOrdersTable.orderId, txResult.order.id)),
    ]);

    return res.status(201).json({ ...txResult.order, items, events, subOrders });
  } catch (err: any) {
    if (err instanceof Error && err.message.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(409).json({ error: `Insufficient stock for ${err.message.split(":")[1]}.` });
    }
    req.log.error(err, "Failed to place store order");
    return res.status(500).json({ error: "Failed to place order. Please try again." });
  }
});

// ─── Razorpay Payment Verification & Idempotent Webhook ───────────────────────
router.post("/store/payments/verify", requireAuth, async (req, res) => {
  const userId = getUser(req).id;
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body ?? {};
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return res.status(503).json({ error: "Online payment gateway is not configured." });
  if (!UUID.test(orderId) || typeof razorpayOrderId !== "string" || typeof razorpayPaymentId !== "string" || typeof razorpaySignature !== "string") {
    return res.status(400).json({ error: "Invalid payment verification payload." });
  }

  const expected = createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  const sigBuf = Buffer.from(razorpaySignature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return res.status(400).json({ error: "Invalid payment signature." });
  }

  const [order] = await db.select().from(storeOrdersTable).where(and(eq(storeOrdersTable.id, orderId), eq(storeOrdersTable.userId, userId))).limit(1);
  if (!order) return res.status(404).json({ error: "Order not found." });

  await db.transaction(async (tx) => {
    await tx.update(storePaymentsTable).set({
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      status: "paid",
      signatureVerified: true,
      updatedAt: new Date(),
    }).where(eq(storePaymentsTable.orderId, order.id));
    await tx.update(storeOrdersTable).set({
      paymentStatus: "paid",
      status: "confirmed",
      updatedAt: new Date(),
    }).where(eq(storeOrdersTable.id, order.id));
    await tx.insert(storeOrderEventsTable).values({
      orderId: order.id,
      actorId: userId,
      status: "confirmed",
      note: `Payment verified (${razorpayPaymentId}).`,
    });
  });

  return res.json({ verified: true, orderId: order.id, paymentStatus: "paid" });
});

router.post("/store/payments/webhook", async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const sig = req.headers["x-razorpay-signature"];
  if (!webhookSecret || typeof sig !== "string") {
    return res.status(401).json({ error: "Webhook verification failed." });
  }
  const rawBody = JSON.stringify(req.body ?? {});
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  if (sig !== expected) return res.status(401).json({ error: "Invalid webhook signature." });

  const eventId = req.body?.payload?.payment?.entity?.id;
  const gatewayOrderId = req.body?.payload?.payment?.entity?.order_id;
  if (typeof gatewayOrderId === "string" && typeof eventId === "string") {
    const [payment] = await db.select().from(storePaymentsTable).where(eq(storePaymentsTable.gatewayOrderId, gatewayOrderId)).limit(1);
    if (payment && payment.status !== "paid") {
      await db.transaction(async (tx) => {
        await tx.update(storePaymentsTable).set({
          gatewayPaymentId: eventId,
          status: "paid",
          signatureVerified: true,
          rawPayload: req.body,
          updatedAt: new Date(),
        }).where(eq(storePaymentsTable.id, payment.id));
        await tx.update(storeOrdersTable).set({ paymentStatus: "paid", status: "confirmed", updatedAt: new Date() })
          .where(eq(storeOrdersTable.id, payment.orderId));
      });
    }
  }
  return res.json({ ok: true });
});

router.get("/store/orders", requireAuth, async (req, res) => {
  const orders = await db.select().from(storeOrdersTable)
    .where(eq(storeOrdersTable.userId, getUser(req).id))
    .orderBy(desc(storeOrdersTable.createdAt))
    .limit(50);
  return res.json({ items: orders });
});

router.get("/store/orders/:id", requireAuth, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid order ID." });
  const [order] = await db.select().from(storeOrdersTable)
    .where(and(eq(storeOrdersTable.id, id), eq(storeOrdersTable.userId, getUser(req).id)))
    .limit(1);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const [items, events, subOrders] = await Promise.all([
    db.select().from(storeOrderItemsTable).where(eq(storeOrderItemsTable.orderId, id)),
    db.select().from(storeOrderEventsTable).where(eq(storeOrderEventsTable.orderId, id)).orderBy(asc(storeOrderEventsTable.createdAt)),
    db.select({
      id: storeSubOrdersTable.id,
      sellerId: storeSubOrdersTable.sellerId,
      ownershipType: storeSubOrdersTable.ownershipType,
      fulfillmentModel: storeSubOrdersTable.fulfillmentModel,
      fulfillmentStatus: storeSubOrdersTable.fulfillmentStatus,
      trackingNumber: storeSubOrdersTable.trackingNumber,
      carrier: storeSubOrdersTable.carrier,
      dispatchedAt: storeSubOrdersTable.dispatchedAt,
      deliveredAt: storeSubOrdersTable.deliveredAt,
    }).from(storeSubOrdersTable).where(eq(storeSubOrdersTable.orderId, id)),
  ]);
  return res.json({ ...order, items, events, subOrders });
});

router.patch("/store/orders/:id/cancel", requireAuth, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid order ID." });
  const userId = getUser(req).id;
  const [order] = await db.select().from(storeOrdersTable)
    .where(and(eq(storeOrdersTable.id, id), eq(storeOrdersTable.userId, userId)))
    .limit(1);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (!["pending_payment", "confirmed", "processing"].includes(order.status)) {
    return res.status(400).json({ error: "This order can no longer be cancelled as it has already been dispatched." });
  }

  const updated = await db.transaction(async (tx) => {
    const [upd] = await tx.update(storeOrdersTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(storeOrdersTable.id, id))
      .returning();

    const items = await tx.select().from(storeOrderItemsTable).where(eq(storeOrderItemsTable.orderId, id));
    for (const item of items) {
      if (!item.productId) continue;
      const [restocked] = await tx.update(storeProductsTable)
        .set({ stock: sql`${storeProductsTable.stock} + ${item.quantity}`, updatedAt: new Date() })
        .where(eq(storeProductsTable.id, item.productId))
        .returning({ stock: storeProductsTable.stock });
      if (restocked) {
        await tx.insert(storeStockMovementsTable).values({
          productId: item.productId,
          actorId: userId,
          movementType: "order_cancel_restock",
          quantityDelta: item.quantity,
          availableAfter: restocked.stock,
          referenceType: "order",
          referenceId: id,
          note: "Order cancelled by buyer",
        });
      }
    }

    await tx.insert(storeOrderEventsTable).values({
      orderId: id,
      actorId: userId,
      status: "cancelled",
      note: req.body?.reason ? `Cancelled by buyer: ${String(req.body.reason).slice(0, 200)}` : "Cancelled by buyer.",
    });
    return upd;
  });

  return res.json(updated);
});

// ─── Customer Returns ─────────────────────────────────────────────────────────
router.get("/store/returns", requireAuth, async (req, res) => {
  const items = await db.select().from(storeReturnsTable)
    .where(eq(storeReturnsTable.userId, getUser(req).id))
    .orderBy(desc(storeReturnsTable.createdAt));
  return res.json({ items });
});

router.post("/store/returns", requireAuth, async (req, res) => {
  const userId = getUser(req).id;
  const { orderId, orderItemId, quantity, returnType, reason, description } = req.body ?? {};
  if (!UUID.test(orderId) || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "Select an order and provide a return reason." });
  }
  const [order] = await db.select().from(storeOrdersTable)
    .where(and(eq(storeOrdersTable.id, orderId), eq(storeOrdersTable.userId, userId)))
    .limit(1);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.status === "cancelled") return res.status(400).json({ error: "Cancelled orders cannot be returned." });

  let refundAmountPaise = order.totalPaise;
  let subOrderId: string | null = null;
  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
  if (UUID.test(orderItemId)) {
    const [item] = await db.select().from(storeOrderItemsTable)
      .where(and(eq(storeOrderItemsTable.id, orderItemId), eq(storeOrderItemsTable.orderId, order.id)))
      .limit(1);
    if (!item) return res.status(404).json({ error: "Order item not found." });
    if (qty > item.quantity) return res.status(400).json({ error: "Return quantity exceeds purchased quantity." });
    refundAmountPaise = item.unitPricePaise * qty;
    subOrderId = item.subOrderId;
  }

  const [ret] = await db.insert(storeReturnsTable).values({
    orderId: order.id,
    subOrderId,
    orderItemId: UUID.test(orderItemId) ? orderItemId : null,
    userId,
    quantity: qty,
    returnType: returnType === "replacement" ? "replacement" : "refund",
    reason: reason.trim().slice(0, 200),
    description: typeof description === "string" ? description.trim().slice(0, 2000) : "",
    refundAmountPaise,
    status: "requested",
  }).returning();

  return res.status(201).json(ret);
});

router.get("/store/products/:id/reviews", async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid product ID." });
  const reviews = await db.select({
    id: storeReviewsTable.id,
    rating: storeReviewsTable.rating,
    body: storeReviewsTable.body,
    createdAt: storeReviewsTable.createdAt,
    reviewer: usersTable.fullName,
  })
    .from(storeReviewsTable)
    .innerJoin(usersTable, eq(storeReviewsTable.userId, usersTable.id))
    .where(and(eq(storeReviewsTable.productId, id), eq(storeReviewsTable.status, "published")))
    .orderBy(desc(storeReviewsTable.createdAt))
    .limit(50);
  return res.json(reviews.map((r) => ({ ...r, verifiedPurchase: true })));
});

router.post("/store/products/:id/reviews", requireAuth, async (req, res) => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rating = req.body?.rating;
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!productId || !UUID.test(productId) || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.length > 2000) {
    return res.status(400).json({ error: "Enter a rating from 1 to 5 and a review under 2,000 characters." });
  }
  const userId = getUser(req).id;
  const [purchased] = await db.select({ id: storeOrderItemsTable.id })
    .from(storeOrderItemsTable)
    .innerJoin(storeOrdersTable, eq(storeOrderItemsTable.orderId, storeOrdersTable.id))
    .where(and(
      eq(storeOrdersTable.userId, userId),
      eq(storeOrderItemsTable.productId, productId),
      or(eq(storeOrdersTable.status, "confirmed"), eq(storeOrdersTable.status, "fulfilled"), eq(storeOrdersTable.status, "completed"))!,
    )).limit(1);

  if (!purchased) {
    return res.status(403).json({ error: "Verified purchase required: only customers who ordered this item can review it." });
  }

  const [review] = await db.insert(storeReviewsTable).values({
    userId,
    productId,
    rating,
    body,
  }).onConflictDoUpdate({
    target: [storeReviewsTable.userId, storeReviewsTable.productId],
    set: { rating, body, updatedAt: new Date() },
  }).returning();

  return res.status(201).json(review);
});

router.get("/store/sellers/me", requireAuth, async (req, res) => {
  const [seller] = await db.select().from(storeSellersTable).where(eq(storeSellersTable.userId, getUser(req).id)).limit(1);
  return seller ? res.json(seller) : res.status(404).json({ error: "No seller application found." });
});

router.post("/store/sellers/apply", requireAuth, async (req, res) => {
  const user = getUser(req);
  const name = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  if (!name || name.length > 120 || description.length > 2000) {
    return res.status(400).json({ error: "Enter a seller name and a description under 2,000 characters." });
  }
  const [seller] = await db.insert(storeSellersTable).values({
    userId: user.id,
    displayName: name,
    description,
    status: "pending_review",
    agreementAcceptedAt: new Date(),
  }).onConflictDoUpdate({
    target: storeSellersTable.userId,
    set: { displayName: name, description, status: "pending_review", updatedAt: new Date() },
  }).returning();
  return res.status(201).json(seller);
});

export default router;
