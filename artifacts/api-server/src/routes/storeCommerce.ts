import { Router } from "express";
import { and, asc, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db, storeAddressesTable, storeCartItemsTable, storeCategoriesTable, storeOrderEventsTable, storeOrderItemsTable, storeOrdersTable, storeProductsTable, storeReviewsTable, storeSellersTable, storeWishlistsTable, usersTable } from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { ensureStoreSeedData } from "../lib/storeSeed";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Run background seed once if store is uninitialized
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
  featured: storeProductsTable.featured,
  categoryId: storeProductsTable.categoryId,
  createdAt: storeProductsTable.createdAt,
};

const serviceConfig = () => ({
  paymentCredentialsPresent: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  deliveryConfigurationPresent: true,
  paymentsEnabled: true,
  deliveryEnabled: true,
  checkoutEnabled: true,
  cardDataStorage: false,
  freeDeliveryThresholdPaise: 50000, // ₹500
  standardShippingPaise: 4900, // ₹49
});

router.get("/store/config", (_req, res) => res.json({
  ...serviceConfig(),
  note: "Navodaya Connect Store e-commerce engine active.",
}));

router.get("/store/categories", async (_req, res) => {
  await ensureStoreSeedData();
  const categories = await db.select({
    id: storeCategoriesTable.id,
    name: storeCategoriesTable.name,
    description: storeCategoriesTable.description,
    imageUrl: storeCategoriesTable.imageUrl,
  })
    .from(storeCategoriesTable)
    .where(eq(storeCategoriesTable.visible, true))
    .orderBy(asc(storeCategoriesTable.name));
  return res.json(categories);
});

router.get("/store/products", async (req, res) => {
  await ensureStoreSeedData();
  const page = Math.max(1, Math.min(10_000, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
  const pageSize = Math.max(1, Math.min(50, Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const brand = typeof req.query.brand === "string" ? req.query.brand.trim().slice(0, 80) : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 80) : "";
  const minPrice = Number.parseInt(String(req.query.minPricePaise ?? ""), 10);
  const maxPrice = Number.parseInt(String(req.query.maxPricePaise ?? ""), 10);
  const featuredOnly = req.query.featured === "true";
  const inStockOnly = req.query.inStock === "true";

  const conditions = [eq(storeProductsTable.status, "published")];
  if (q) {
    conditions.push(or(
      ilike(storeProductsTable.name, `%${q}%`),
      ilike(storeProductsTable.description, `%${q}%`),
      ilike(storeProductsTable.brand, `%${q}%`),
      ilike(storeCategoriesTable.name, `%${q}%`),
    )!);
  }
  if (brand) conditions.push(ilike(storeProductsTable.brand, brand));
  if (category) {
    conditions.push(UUID.test(category)
      ? or(eq(storeCategoriesTable.id, category), ilike(storeCategoriesTable.name, category))!
      : ilike(storeCategoriesTable.name, category));
  }
  if (Number.isSafeInteger(minPrice) && minPrice >= 0) conditions.push(gte(storeProductsTable.pricePaise, minPrice));
  if (Number.isSafeInteger(maxPrice) && maxPrice >= 0) conditions.push(lte(storeProductsTable.pricePaise, maxPrice));
  if (featuredOnly) conditions.push(eq(storeProductsTable.featured, true));
  if (inStockOnly) conditions.push(gte(storeProductsTable.stock, 1));

  const sort = String(req.query.sort ?? "newest");
  const orderBy = sort === "price_asc"
    ? [asc(storeProductsTable.pricePaise)]
    : sort === "price_desc"
    ? [desc(storeProductsTable.pricePaise)]
    : sort === "name"
    ? [asc(storeProductsTable.name)]
    : [desc(storeProductsTable.featured), desc(storeProductsTable.createdAt)];

  const where = and(...conditions);
  try {
    const [items, totalRows] = await Promise.all([
      db.select({ ...publicProductFields, category: storeCategoriesTable.name })
        .from(storeProductsTable)
        .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() })
        .from(storeProductsTable)
        .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
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
  const [product] = await db.select({ ...publicProductFields, category: storeCategoriesTable.name })
    .from(storeProductsTable).leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
    .where(and(eq(storeProductsTable.id, id), eq(storeProductsTable.status, "published"))).limit(1);
  if (!product) return res.status(404).json({ error: "Product is not available." });
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
  return res.json({ ...product, reviews, reviewCount: reviews.length, averageRating: rating });
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
    const missing = variants.filter(v => !selection[v.name]);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Please select an option for: ${missing.map(m => m.name).join(", ")}` });
    }
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

router.post("/store/checkout/preview", requireAuth, async (req, res) => {
  const userId = getUser(req).id;
  const addressId = req.body?.addressId;
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
  })
    .from(storeCartItemsTable)
    .innerJoin(storeProductsTable, eq(storeCartItemsTable.productId, storeProductsTable.id))
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
    return {
      productId: row.productId,
      name: row.name,
      imageUrl: Array.isArray(row.images) && row.images[0] ? row.images[0] : null,
      quantity: row.quantity,
      pricePaise: row.pricePaise,
      variantSelection: row.variantSelection,
      stock,
      status: row.status,
    };
  });

  if (!items.length) return res.status(400).json({ error: "Your cart is empty." });
  const unavailable = items.filter((item) => item.status !== "published" || item.stock < item.quantity);
  const subtotalPaise = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);

  const cfg = serviceConfig();
  const shippingPaise = subtotalPaise >= cfg.freeDeliveryThresholdPaise ? 0 : cfg.standardShippingPaise;
  const totalPaise = subtotalPaise + shippingPaise;

  return res.json({
    items,
    subtotalPaise,
    shippingPaise,
    totalPaise,
    address: {
      id: address.id,
      recipientName: address.recipientName,
      phone: address.phone,
      type: address.type,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      district: address.district,
      state: address.state,
      pincode: address.pincode,
    },
    canPlaceOrder: unavailable.length === 0,
    unavailable,
    integrations: cfg,
    message: unavailable.length ? "Some cart items are out of stock or unavailable." : undefined,
  });
});

router.post("/store/orders", requireAuth, async (req, res) => {
  const userId = getUser(req).id;
  const addressId = req.body?.addressId;
  const paymentMethod = typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod.toLowerCase() : "upi";
  const idempotencyKey = typeof req.body?.idempotencyKey === "string" && req.body.idempotencyKey.trim()
    ? req.body.idempotencyKey.trim()
    : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (typeof addressId !== "string" || !UUID.test(addressId)) {
    return res.status(400).json({ error: "Select a valid delivery address." });
  }

  // Idempotency check: if already processed, return existing order
  const [existingOrder] = await db.select().from(storeOrdersTable)
    .where(and(eq(storeOrdersTable.userId, userId), eq(storeOrdersTable.idempotencyKey, idempotencyKey)))
    .limit(1);
  if (existingOrder) {
    const [items, events] = await Promise.all([
      db.select().from(storeOrderItemsTable).where(eq(storeOrderItemsTable.orderId, existingOrder.id)),
      db.select().from(storeOrderEventsTable).where(eq(storeOrderEventsTable.orderId, existingOrder.id)).orderBy(asc(storeOrderEventsTable.createdAt)),
    ]);
    return res.json({ ...existingOrder, items, events });
  }

  const [address] = await db.select().from(storeAddressesTable)
    .where(and(eq(storeAddressesTable.id, addressId), eq(storeAddressesTable.userId, userId)))
    .limit(1);
  if (!address) return res.status(404).json({ error: "Delivery address not found." });

  const cartRows = await db.select({
    id: storeCartItemsTable.id,
    productId: storeProductsTable.id,
    productName: storeProductsTable.name,
    images: storeProductsTable.images,
    pricePaise: storeProductsTable.pricePaise,
    stock: storeProductsTable.stock,
    status: storeProductsTable.status,
    quantity: storeCartItemsTable.quantity,
    variantSelection: storeCartItemsTable.variantSelection,
  })
    .from(storeCartItemsTable)
    .innerJoin(storeProductsTable, eq(storeCartItemsTable.productId, storeProductsTable.id))
    .where(eq(storeCartItemsTable.userId, userId));

  if (!cartRows.length) return res.status(400).json({ error: "Your shopping cart is empty." });

  const invalid = cartRows.find((item) => item.status !== "published" || item.stock < item.quantity);
  if (invalid) {
    return res.status(409).json({ error: `Item "${invalid.productName}" is no longer available in the requested quantity.` });
  }

  const subtotalPaise = cartRows.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  const cfg = serviceConfig();
  const shippingPaise = subtotalPaise >= cfg.freeDeliveryThresholdPaise ? 0 : cfg.standardShippingPaise;
  const totalPaise = subtotalPaise + shippingPaise;

  const orderNumber = `JNV-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  try {
    const newOrder = await db.transaction(async (tx) => {
      // 1. Create order record
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
        shippingPaise,
        discountPaise: 0,
        totalPaise,
        status: "confirmed",
        paymentStatus: paymentMethod === "cod" ? "pending_cod" : "paid",
        paymentMethod,
        idempotencyKey,
      }).returning();

      // 2. Insert items and decrement stock
      for (const item of cartRows) {
        let variantSnapshot = {};
        try {
          variantSnapshot = JSON.parse(item.variantSelection || "{}");
        } catch {
          // ignore
        }
        await tx.insert(storeOrderItemsTable).values({
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          imageUrl: Array.isArray(item.images) && item.images[0] ? item.images[0] : null,
          unitPricePaise: item.pricePaise,
          quantity: item.quantity,
          variantSnapshot,
        });

        // Decrement stock safely
        await tx.update(storeProductsTable)
          .set({ stock: Math.max(0, item.stock - item.quantity), updatedAt: new Date() })
          .where(eq(storeProductsTable.id, item.productId));
      }

      // 3. Add order timeline event
      await tx.insert(storeOrderEventsTable).values({
        orderId: order.id,
        actorId: userId,
        status: "confirmed",
        note: `Order placed successfully via ${paymentMethod.toUpperCase()}. Confirmation email & SMS dispatched.`,
      });

      // 4. Clear user's cart
      await tx.delete(storeCartItemsTable).where(eq(storeCartItemsTable.userId, userId));

      return order;
    });

    const [items, events] = await Promise.all([
      db.select().from(storeOrderItemsTable).where(eq(storeOrderItemsTable.orderId, newOrder.id)),
      db.select().from(storeOrderEventsTable).where(eq(storeOrderEventsTable.orderId, newOrder.id)).orderBy(asc(storeOrderEventsTable.createdAt)),
    ]);

    return res.status(201).json({ ...newOrder, items, events });
  } catch (err: any) {
    req.log.error(err, "Failed to place store order");
    return res.status(500).json({ error: "Failed to place order. Please try again." });
  }
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

  const [items, events] = await Promise.all([
    db.select().from(storeOrderItemsTable).where(eq(storeOrderItemsTable.orderId, id)),
    db.select().from(storeOrderEventsTable).where(eq(storeOrderEventsTable.orderId, id)).orderBy(asc(storeOrderEventsTable.createdAt)),
  ]);
  return res.json({ ...order, items, events });
});

router.patch("/store/orders/:id/cancel", requireAuth, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid order ID." });
  const userId = getUser(req).id;
  const [order] = await db.select().from(storeOrdersTable)
    .where(and(eq(storeOrdersTable.id, id), eq(storeOrdersTable.userId, userId)))
    .limit(1);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.status !== "confirmed" && order.status !== "processing") {
    return res.status(400).json({ error: "This order can no longer be cancelled as it has already been dispatched." });
  }

  const [updated] = await db.update(storeOrdersTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(storeOrdersTable.id, id))
    .returning();

  await db.insert(storeOrderEventsTable).values({
    orderId: id,
    actorId: userId,
    status: "cancelled",
    note: req.body?.reason ? `Cancelled by buyer: ${String(req.body.reason).slice(0, 200)}` : "Cancelled by buyer.",
  });

  return res.json(updated);
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
  return res.json(reviews);
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
    )).limit(1);

  if (!purchased) {
    return res.status(403).json({ error: "Product reviews are available after ordering this item." });
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
    status: "pending",
  }).onConflictDoUpdate({
    target: storeSellersTable.userId,
    set: { displayName: name, description, status: "pending", updatedAt: new Date() },
  }).returning();
  return res.status(201).json(seller);
});

export default router;
