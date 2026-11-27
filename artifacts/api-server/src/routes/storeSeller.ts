import { Router, type Request, type Response, type NextFunction } from "express";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  storeCategoriesTable,
  storeCommissionRulesTable,
  storeOrderEventsTable,
  storeOrderItemsTable,
  storeOrdersTable,
  storePayoutsTable,
  storeProductsTable,
  storeReturnsTable,
  storeSellersTable,
  storeStockMovementsTable,
  storeSubOrdersTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { createSocialNotification } from "../lib/social-access";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SellerRequest = Request & { sellerAccount?: typeof storeSellersTable.$inferSelect };

async function requireApprovedSeller(req: SellerRequest, res: Response, next: NextFunction) {
  const user = getUser(req);
  const [seller] = await db.select().from(storeSellersTable).where(eq(storeSellersTable.userId, user.id)).limit(1);
  if (!seller) return res.status(403).json({ error: "Apply for a seller account first." });
  if (seller.status !== "approved") {
    return res.status(403).json({
      error: seller.status === "suspended"
        ? "Your seller account is currently suspended."
        : "Your seller application must be approved before accessing seller operations.",
      sellerStatus: seller.status,
    });
  }
  req.sellerAccount = seller;
  return next();
}

// ─── Seller Onboarding Application ────────────────────────────────────────────
router.post("/seller/apply", requireAuth, async (req, res) => {
  const user = getUser(req);
  const body = req.body ?? {};
  const sellerType = body.sellerType === "business" ? "business" : "individual";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const legalName = typeof body.legalName === "string" ? body.legalName.trim().slice(0, 140) : null;
  const businessName = typeof body.businessName === "string" ? body.businessName.trim().slice(0, 140) : null;
  const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim().slice(0, 24) : null;
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().slice(0, 160) : user.email;
  const taxId = typeof body.taxId === "string" ? body.taxId.trim().slice(0, 40) : null;
  const bankAccountHolder = typeof body.bankAccountHolder === "string" ? body.bankAccountHolder.trim().slice(0, 120) : null;
  const bankAccountLast4 = typeof body.bankAccountNumber === "string"
    ? body.bankAccountNumber.replace(/\D/g, "").slice(-4) || null
    : typeof body.bankAccountLast4 === "string"
      ? body.bankAccountLast4.replace(/\D/g, "").slice(-4) || null
      : null;
  const bankIfsc = typeof body.bankIfsc === "string" ? body.bankIfsc.trim().toUpperCase().slice(0, 20) : null;
  const intendedCategories = Array.isArray(body.intendedCategories)
    ? body.intendedCategories.filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0).slice(0, 10)
    : [];
  const businessAddress = body.businessAddress && typeof body.businessAddress === "object" && !Array.isArray(body.businessAddress)
    ? Object.fromEntries(
        Object.entries(body.businessAddress)
          .filter(([k, v]) => typeof k === "string" && typeof v === "string")
          .slice(0, 10)
          .map(([k, v]) => [k, String(v).trim().slice(0, 160)]),
      )
    : {};

  if (!displayName || displayName.length > 120 || description.length > 2000) {
    return res.status(400).json({ error: "Enter a seller display name (max 120 chars) and description (max 2,000 chars)." });
  }
  if (body.agreementAccepted !== true) {
    return res.status(400).json({ error: "You must accept the Navodaya Connect Seller Agreement." });
  }

  const [existing] = await db.select().from(storeSellersTable).where(eq(storeSellersTable.userId, user.id)).limit(1);
  if (existing?.status === "suspended") {
    return res.status(403).json({ error: "Suspended seller accounts cannot re-apply. Contact Store support." });
  }

  const [seller] = await db.insert(storeSellersTable).values({
    userId: user.id,
    sellerType,
    displayName,
    legalName,
    businessName,
    description,
    contactPhone,
    contactEmail,
    businessAddress,
    taxId,
    bankAccountHolder,
    bankAccountLast4,
    bankIfsc,
    intendedCategories,
    agreementAcceptedAt: new Date(),
    status: "pending_review",
  }).onConflictDoUpdate({
    target: storeSellersTable.userId,
    set: {
      sellerType,
      displayName,
      legalName,
      businessName,
      description,
      contactPhone,
      contactEmail,
      businessAddress,
      taxId,
      bankAccountHolder,
      bankAccountLast4,
      bankIfsc,
      intendedCategories,
      agreementAcceptedAt: new Date(),
      status: existing?.status === "approved" ? "approved" : "pending_review",
      rejectionReason: null,
      updatedAt: new Date(),
    },
  }).returning();

  return res.status(201).json(seller);
});

router.get("/seller/me", requireAuth, async (req, res) => {
  const [seller] = await db.select().from(storeSellersTable).where(eq(storeSellersTable.userId, getUser(req).id)).limit(1);
  return seller ? res.json(seller) : res.status(404).json({ error: "No seller account found." });
});

// ─── Approved Seller Portal Operations ────────────────────────────────────────
router.use("/seller", requireAuth, requireApprovedSeller);

router.get("/seller/dashboard", async (req: SellerRequest, res) => {
  const seller = req.sellerAccount!;
  const [products, subOrders, payouts] = await Promise.all([
    db.select({
      status: storeProductsTable.status,
      stock: storeProductsTable.stock,
      lowStockThreshold: storeProductsTable.lowStockThreshold,
    }).from(storeProductsTable).where(eq(storeProductsTable.sellerId, seller.id)),
    db.select({
      subtotalPaise: storeSubOrdersTable.subtotalPaise,
      commissionPaise: storeSubOrdersTable.commissionPaise,
      sellerPayablePaise: storeSubOrdersTable.sellerPayablePaise,
      fulfillmentStatus: storeSubOrdersTable.fulfillmentStatus,
      payoutId: storeSubOrdersTable.payoutId,
    }).from(storeSubOrdersTable).where(eq(storeSubOrdersTable.sellerId, seller.id)),
    db.select({
      netPayablePaise: storePayoutsTable.netPayablePaise,
      status: storePayoutsTable.status,
    }).from(storePayoutsTable).where(eq(storePayoutsTable.sellerId, seller.id)),
  ]);

  const grossSalesPaise = subOrders.reduce((s, o) => s + o.subtotalPaise, 0);
  const totalCommissionPaise = subOrders.reduce((s, o) => s + o.commissionPaise, 0);
  const netEarningsPaise = subOrders.reduce((s, o) => s + o.sellerPayablePaise, 0);
  const unpaidPayablePaise = subOrders.filter((o) => !o.payoutId).reduce((s, o) => s + o.sellerPayablePaise, 0);
  const paidOutPaise = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.netPayablePaise, 0);

  return res.json({
    seller: { id: seller.id, displayName: seller.displayName, status: seller.status, codEnabled: seller.codEnabled },
    products: {
      total: products.length,
      published: products.filter((p) => p.status === "published").length,
      pendingApproval: products.filter((p) => ["pending_approval", "submitted"].includes(p.status)).length,
      lowStock: products.filter((p) => p.stock <= p.lowStockThreshold).length,
    },
    orders: {
      total: subOrders.length,
      pendingFulfillment: subOrders.filter((o) => ["not_started", "processing", "packed"].includes(o.fulfillmentStatus)).length,
      delivered: subOrders.filter((o) => o.fulfillmentStatus === "delivered").length,
    },
    financials: {
      grossSalesPaise,
      totalCommissionPaise,
      netEarningsPaise,
      unpaidPayablePaise,
      paidOutPaise,
    },
  });
});

router.get("/seller/products", async (req: SellerRequest, res) => {
  const seller = req.sellerAccount!;
  const items = await db
    .select({
      product: storeProductsTable,
      categoryName: storeCategoriesTable.name,
    })
    .from(storeProductsTable)
    .leftJoin(storeCategoriesTable, eq(storeProductsTable.categoryId, storeCategoriesTable.id))
    .where(eq(storeProductsTable.sellerId, seller.id))
    .orderBy(desc(storeProductsTable.createdAt));

  return res.json({ items: items.map(({ product, categoryName }) => ({ ...product, categoryName })) });
});

router.post("/seller/products", async (req: SellerRequest, res) => {
  const user = getUser(req);
  const seller = req.sellerAccount!;
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const categoryId = typeof body.categoryId === "string" && UUID.test(body.categoryId) ? body.categoryId : null;
  const pricePaise = Number(body.pricePaise);
  const originalPricePaise = body.originalPricePaise != null ? Number(body.originalPricePaise) : null;
  const stock = Number.isInteger(body.stock) ? Number(body.stock) : 0;
  const weightGrams = Number.isInteger(body.weightGrams) && body.weightGrams > 0 ? Number(body.weightGrams) : 250;
  const lowStockThreshold = Number.isInteger(body.lowStockThreshold) && body.lowStockThreshold >= 0 ? Number(body.lowStockThreshold) : 10;
  const images = Array.isArray(body.images)
    ? body.images.filter((u: unknown): u is string => typeof u === "string" && /^https:\/\//i.test(u)).slice(0, 8)
    : [];
  const sku = typeof body.sku === "string" && body.sku.trim() ? body.sku.trim().slice(0, 80) : null;
  const brand = typeof body.brand === "string" && body.brand.trim() ? body.brand.trim().slice(0, 100) : seller.displayName;
  const saveAsDraft = body.saveAsDraft === true;

  if (!name || name.length > 160 || !categoryId || !Number.isSafeInteger(pricePaise) || pricePaise < 100 || pricePaise > 100_000_000 || stock < 0 || stock > 1_000_000) {
    return res.status(400).json({ error: "Enter valid product name, category, price (>= ₹1), and stock." });
  }

  // Ensure an active category & commission rule exists before allowing submission
  const [cat] = await db.select().from(storeCategoriesTable).where(eq(storeCategoriesTable.id, categoryId)).limit(1);
  if (!cat || cat.archived) return res.status(400).json({ error: "Choose an active product category." });
  const [rule] = await db.select().from(storeCommissionRulesTable)
    .where(and(eq(storeCommissionRulesTable.categoryId, categoryId), eq(storeCommissionRulesTable.active, true)))
    .limit(1);
  if (!saveAsDraft && !rule) {
    return res.status(409).json({ error: "No active commission rule is configured for this category yet. Contact Store Admin." });
  }

  const discountPercent = originalPricePaise && originalPricePaise > pricePaise
    ? Math.round(((originalPricePaise - pricePaise) / originalPricePaise) * 100)
    : 0;

  try {
    const product = await db.transaction(async (tx) => {
      const [created] = await tx.insert(storeProductsTable).values({
        name,
        description,
        specifications: body.specifications && typeof body.specifications === "object" && !Array.isArray(body.specifications) ? body.specifications : {},
        images,
        pricePaise,
        originalPricePaise,
        discountPercent,
        sku,
        brand,
        variants: Array.isArray(body.variants) ? body.variants : [],
        categoryId,
        ownershipType: "seller",
        sellerId: seller.id,
        fulfillmentModel: "seller",
        weightGrams,
        dimensionsCm: body.dimensionsCm && typeof body.dimensionsCm === "object" ? body.dimensionsCm : {},
        stock,
        lowStockThreshold,
        codEligible: seller.codEnabled && body.codEligible === true,
        returnPolicyDays: Number.isInteger(body.returnPolicyDays) ? Math.max(0, Math.min(30, Number(body.returnPolicyDays))) : 7,
        condition: body.condition === "refurbished" ? "refurbished" : "new",
        // Sellers can NEVER self-publish; non-draft always enters pending_approval
        status: saveAsDraft ? "draft" : "pending_approval",
        createdBy: user.id,
        updatedBy: user.id,
      }).returning();

      if (stock > 0) {
        await tx.insert(storeStockMovementsTable).values({
          productId: created.id,
          actorId: user.id,
          movementType: "initial_stock",
          quantityDelta: stock,
          availableAfter: stock,
          referenceType: "product",
          referenceId: created.id,
          note: "Initial seller stock",
        });
      }
      return created;
    });

    return res.status(201).json(product);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "A product with this SKU already exists." });
    req.log.error(e, "Seller product creation failed");
    return res.status(500).json({ error: "Could not submit product." });
  }
});

router.patch("/seller/products/:id", async (req: SellerRequest, res) => {
  const user = getUser(req);
  const seller = req.sellerAccount!;
  const productId = req.params.id as string;
  if (!UUID.test(productId)) return res.status(400).json({ error: "Invalid product ID." });

  const [existing] = await db.select().from(storeProductsTable)
    .where(and(eq(storeProductsTable.id, productId), eq(storeProductsTable.sellerId, seller.id)))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Product not found." });

  const body = req.body ?? {};
  const materialChange =
    ("name" in body && body.name !== existing.name) ||
    ("description" in body && body.description !== existing.description) ||
    ("pricePaise" in body && body.pricePaise !== existing.pricePaise) ||
    ("categoryId" in body && body.categoryId !== existing.categoryId) ||
    ("images" in body);

  // Material edits to published/approved listings trigger re-review!
  const nextStatus = body.submitForReview === true || (materialChange && ["published", "approved", "changes_requested"].includes(existing.status))
    ? "pending_approval"
    : existing.status;

  const [updated] = await db.update(storeProductsTable).set({
    ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim().slice(0, 160) } : {}),
    ...(typeof body.description === "string" ? { description: body.description.trim().slice(0, 10000) } : {}),
    ...(Number.isSafeInteger(body.pricePaise) && body.pricePaise >= 100 ? { pricePaise: body.pricePaise } : {}),
    ...(Array.isArray(body.images) ? { images: body.images.filter((u: unknown) => typeof u === "string" && /^https:\/\//i.test(u)).slice(0, 8) } : {}),
    ...(typeof body.categoryId === "string" && UUID.test(body.categoryId) ? { categoryId: body.categoryId } : {}),
    ...(Number.isInteger(body.lowStockThreshold) && body.lowStockThreshold >= 0 ? { lowStockThreshold: body.lowStockThreshold } : {}),
    status: nextStatus,
    updatedBy: user.id,
    updatedAt: new Date(),
  }).where(eq(storeProductsTable.id, productId)).returning();

  return res.json(updated);
});

router.patch("/seller/inventory/:productId", async (req: SellerRequest, res) => {
  const user = getUser(req);
  const seller = req.sellerAccount!;
  const productId = req.params.productId as string;
  const newStock = Number(req.body?.stock);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 200) : "Seller stock update";
  if (!UUID.test(productId) || !Number.isInteger(newStock) || newStock < 0 || newStock > 1_000_000) {
    return res.status(400).json({ error: "Provide a valid non-negative integer stock quantity." });
  }

  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM store_products WHERE id = ${productId} FOR UPDATE`);
    const [existing] = await tx.select().from(storeProductsTable)
      .where(and(eq(storeProductsTable.id, productId), eq(storeProductsTable.sellerId, seller.id)))
      .limit(1);
    if (!existing) return null;
    const delta = newStock - existing.stock;
    const [updated] = await tx.update(storeProductsTable)
      .set({ stock: newStock, updatedBy: user.id, updatedAt: new Date() })
      .where(eq(storeProductsTable.id, productId))
      .returning();
    await tx.insert(storeStockMovementsTable).values({
      productId,
      actorId: user.id,
      movementType: delta >= 0 ? "seller_restock" : "seller_adjustment",
      quantityDelta: delta,
      availableAfter: newStock,
      referenceType: "manual",
      referenceId: productId,
      note,
    });
    return updated;
  });

  return outcome ? res.json(outcome) : res.status(404).json({ error: "Product not found." });
});

router.get("/seller/orders", async (req: SellerRequest, res) => {
  const seller = req.sellerAccount!;
  const subOrders = await db
    .select({
      subOrder: storeSubOrdersTable,
      orderNumber: storeOrdersTable.orderNumber,
      orderStatus: storeOrdersTable.status,
      paymentStatus: storeOrdersTable.paymentStatus,
      paymentMethod: storeOrdersTable.paymentMethod,
      addressSnapshot: storeOrdersTable.addressSnapshot,
    })
    .from(storeSubOrdersTable)
    .innerJoin(storeOrdersTable, eq(storeSubOrdersTable.orderId, storeOrdersTable.id))
    .where(eq(storeSubOrdersTable.sellerId, seller.id))
    .orderBy(desc(storeSubOrdersTable.createdAt))
    .limit(100);

  const subIds = subOrders.map((r) => r.subOrder.id);
  const items = subIds.length
    ? await db.select().from(storeOrderItemsTable).where(inArray(storeOrderItemsTable.subOrderId, subIds))
    : [];
  const itemsBySub = new Map<string, typeof items>();
  for (const it of items) {
    if (!it.subOrderId) continue;
    const list = itemsBySub.get(it.subOrderId) ?? [];
    list.push(it);
    itemsBySub.set(it.subOrderId, list);
  }

  return res.json({
    items: subOrders.map(({ subOrder, orderNumber, orderStatus, paymentStatus, paymentMethod, addressSnapshot }) => ({
      ...subOrder,
      orderNumber,
      orderStatus,
      paymentStatus,
      paymentMethod,
      shippingDestination: {
        recipientName: addressSnapshot.recipientName,
        city: addressSnapshot.city,
        state: addressSnapshot.state,
        pincode: addressSnapshot.pincode,
        line1: addressSnapshot.line1,
      },
      items: itemsBySub.get(subOrder.id) ?? [],
    })),
  });
});

router.patch("/seller/orders/:subOrderId/fulfill", async (req: SellerRequest, res) => {
  const user = getUser(req);
  const seller = req.sellerAccount!;
  const subOrderId = req.params.subOrderId as string;
  if (!UUID.test(subOrderId)) return res.status(400).json({ error: "Invalid sub-order ID." });

  const nextStatus = typeof req.body?.fulfillmentStatus === "string" ? req.body.fulfillmentStatus : "";
  const trackingNumber = typeof req.body?.trackingNumber === "string" ? req.body.trackingNumber.trim().slice(0, 80) : null;
  const carrier = typeof req.body?.carrier === "string" ? req.body.carrier.trim().slice(0, 80) : null;

  if (!["processing", "packed", "dispatched", "delivered"].includes(nextStatus)) {
    return res.status(400).json({ error: "Invalid fulfillment status." });
  }
  if (nextStatus === "dispatched" && (!trackingNumber || !carrier)) {
    return res.status(400).json({ error: "Provide courier/carrier name and tracking number when dispatching." });
  }

  const [sub] = await db.select().from(storeSubOrdersTable)
    .where(and(eq(storeSubOrdersTable.id, subOrderId), eq(storeSubOrdersTable.sellerId, seller.id)))
    .limit(1);
  if (!sub) return res.status(404).json({ error: "Seller sub-order not found." });

  const now = new Date();
  const [updated] = await db.update(storeSubOrdersTable).set({
    fulfillmentStatus: nextStatus,
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(carrier ? { carrier } : {}),
    ...(nextStatus === "dispatched" ? { dispatchedAt: now } : {}),
    ...(nextStatus === "delivered" ? { deliveredAt: now } : {}),
    updatedAt: now,
  }).where(eq(storeSubOrdersTable.id, subOrderId)).returning();

  const [parent] = await db.select().from(storeOrdersTable).where(eq(storeOrdersTable.id, sub.orderId)).limit(1);
  if (parent) {
    await db.insert(storeOrderEventsTable).values({
      orderId: parent.id,
      actorId: user.id,
      status: nextStatus,
      note: `Seller ${seller.displayName} marked shipment as ${nextStatus}${trackingNumber ? ` (${carrier}: ${trackingNumber})` : ""}.`,
    });
    await createSocialNotification(
      parent.userId,
      user.id,
      "store_order_update",
      parent.id,
      `Your order ${parent.orderNumber} shipment from ${seller.displayName} is now ${nextStatus}.`,
    ).catch(() => {});
  }

  return res.json(updated);
});

router.get("/seller/earnings", async (req: SellerRequest, res) => {
  const seller = req.sellerAccount!;
  const [ledger, payouts, returns] = await Promise.all([
    db.select().from(storeSubOrdersTable).where(eq(storeSubOrdersTable.sellerId, seller.id)).orderBy(desc(storeSubOrdersTable.createdAt)).limit(100),
    db.select().from(storePayoutsTable).where(eq(storePayoutsTable.sellerId, seller.id)).orderBy(desc(storePayoutsTable.createdAt)).limit(50),
    db.select().from(storeReturnsTable)
      .innerJoin(storeSubOrdersTable, eq(storeReturnsTable.subOrderId, storeSubOrdersTable.id))
      .where(eq(storeSubOrdersTable.sellerId, seller.id))
      .limit(50),
  ]);

  return res.json({
    ledger,
    payouts,
    returnsCount: returns.length,
  });
});

export default router;
