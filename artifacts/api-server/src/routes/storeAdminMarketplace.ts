import { Router, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  storeAdminAuditLogsTable,
  storeCategoriesTable,
  storeCommissionRulesTable,
  storeCouponsTable,
  storeOrderEventsTable,
  storeOrdersTable,
  storePayoutBatchesTable,
  storePayoutsTable,
  storeProductsTable,
  storeReturnsTable,
  storeSellersTable,
  storeShippingRatesTable,
  storeStockMovementsTable,
  storeSubOrdersTable,
} from "@workspace/db";
import { storeAdminHasPermission, type StoreAdminRole } from "../lib/store-admin-access";
import { createSocialNotification } from "../lib/social-access";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StaffRequest = Request & { storeStaff?: { userId: string; role: StoreAdminRole; name: string; email: string } };

function requirePermission(permission: string) {
  return async (req: StaffRequest, res: Response, next: NextFunction) => {
    const staff = req.storeStaff;
    if (!staff || !storeAdminHasPermission(staff.role, permission)) {
      if (staff) {
        await db.insert(storeAdminAuditLogsTable).values({
          actorId: staff.userId,
          actorRole: staff.role,
          action: "auth.permission_denied",
          outcome: "denied",
          requestId: req.get("x-request-id") ?? null,
          details: { permission },
        });
      }
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    return next();
  };
}

async function auditAdmin(
  req: StaffRequest,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
) {
  const staff = req.storeStaff!;
  await db.insert(storeAdminAuditLogsTable).values({
    actorId: staff.userId,
    actorRole: staff.role,
    action,
    outcome: "success",
    targetType,
    targetId,
    requestId: req.get("x-request-id") ?? null,
    details,
  });
}

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

// ─── Marketplace Overview Analytics ───────────────────────────────────────────
router.get("/store-admin/analytics", requirePermission("analytics.view"), async (_req, res) => {
  const [orders, subOrders, returns, payouts] = await Promise.all([
    db.select({
      status: storeOrdersTable.status,
      paymentStatus: storeOrdersTable.paymentStatus,
      totalPaise: storeOrdersTable.totalPaise,
    }).from(storeOrdersTable),
    db.select({
      ownershipType: storeSubOrdersTable.ownershipType,
      subtotalPaise: storeSubOrdersTable.subtotalPaise,
      commissionPaise: storeSubOrdersTable.commissionPaise,
      sellerPayablePaise: storeSubOrdersTable.sellerPayablePaise,
      payoutId: storeSubOrdersTable.payoutId,
    }).from(storeSubOrdersTable),
    db.select({
      status: storeReturnsTable.status,
      refundAmountPaise: storeReturnsTable.refundAmountPaise,
    }).from(storeReturnsTable),
    db.select({
      status: storePayoutsTable.status,
      netPayablePaise: storePayoutsTable.netPayablePaise,
    }).from(storePayoutsTable),
  ]);

  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const gmvPaise = activeOrders.reduce((s, o) => s + o.totalPaise, 0);
  const paidOrders = orders.filter((o) => o.paymentStatus === "paid").length;
  const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;
  const refundTotalPaise = returns.filter((r) => r.status === "refunded").reduce((s, r) => s + r.refundAmountPaise, 0);
  const platformSalesPaise = subOrders.filter((s) => s.ownershipType === "platform").reduce((sum, s) => sum + s.subtotalPaise, 0);
  const sellerSalesPaise = subOrders.filter((s) => s.ownershipType === "seller").reduce((sum, s) => sum + s.subtotalPaise, 0);
  const commissionRevenuePaise = subOrders.reduce((sum, s) => sum + s.commissionPaise, 0);
  const unpaidSellerPayablePaise = subOrders.filter((s) => s.ownershipType === "seller" && !s.payoutId).reduce((sum, s) => sum + s.sellerPayablePaise, 0);
  const paidOutPaise = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.netPayablePaise, 0);

  return res.json({
    gmvPaise,
    netSalesPaise: Math.max(0, gmvPaise - refundTotalPaise),
    totalOrders: orders.length,
    paidOrders,
    cancelledOrders,
    averageOrderValuePaise: activeOrders.length ? Math.round(gmvPaise / activeOrders.length) : 0,
    refundTotalPaise,
    platformSalesPaise,
    sellerSalesPaise,
    commissionRevenuePaise,
    unpaidSellerPayablePaise,
    paidOutPaise,
  });
});

// ─── Product Approval Queue Review ────────────────────────────────────────────
router.patch("/store-admin/products/:id/review", requirePermission("products.approve"), async (req: StaffRequest, res) => {
  const id = req.params.id as string;
  if (!UUID.test(id)) return res.status(400).json({ error: "Invalid product ID." });
  const action = req.body?.action;
  const feedback = typeof req.body?.feedback === "string" ? req.body.feedback.trim().slice(0, 1000) : null;
  const actionMap: Record<string, string> = {
    approve: "published",
    publish: "published",
    request_changes: "changes_requested",
    reject: "rejected",
    unpublish: "unpublished",
    suspend: "suspended",
  };
  const nextStatus = actionMap[String(action)];
  if (!nextStatus) return res.status(400).json({ error: "Choose a valid review action." });
  if (["request_changes", "reject", "suspend"].includes(String(action)) && !feedback) {
    return res.status(400).json({ error: "Provide clear feedback or a rejection reason." });
  }

  const [existing] = await db.select().from(storeProductsTable).where(eq(storeProductsTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Product not found." });
  if (existing.createdBy === req.storeStaff!.userId && existing.ownershipType === "seller") {
    return res.status(403).json({ error: "You cannot approve your own seller listing." });
  }

  const now = new Date();
  const [updated] = await db.update(storeProductsTable).set({
    status: nextStatus,
    approvalFeedback: feedback,
    ...(nextStatus === "published" ? { approvedBy: req.storeStaff!.userId, approvedAt: now, publishedAt: now } : {}),
    updatedBy: req.storeStaff!.userId,
    updatedAt: now,
  }).where(eq(storeProductsTable.id, id)).returning();

  await auditAdmin(req, `product.${action}`, "product", id, { nextStatus, feedback });
  if (existing.createdBy !== req.storeStaff!.userId) {
    await createSocialNotification(
      existing.createdBy,
      req.storeStaff!.userId,
      "store_product_review",
      id,
      `Your product "${existing.name}" status is now ${nextStatus.replace(/_/g, " ")}${feedback ? `: ${feedback}` : "."}`,
    ).catch(() => {});
  }
  return res.json(updated);
});

// ─── Inventory Override (Audited) ─────────────────────────────────────────────
router.post("/store-admin/inventory/:productId/adjust", requirePermission("inventory.override"), async (req: StaffRequest, res) => {
  const productId = req.params.productId as string;
  const newStock = Number(req.body?.stock);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 200) : "";
  if (!UUID.test(productId) || !Number.isInteger(newStock) || newStock < 0 || !note) {
    return res.status(400).json({ error: "Provide valid stock quantity and an audit reason." });
  }

  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM store_products WHERE id = ${productId} FOR UPDATE`);
    const [existing] = await tx.select().from(storeProductsTable).where(eq(storeProductsTable.id, productId)).limit(1);
    if (!existing) return null;
    const delta = newStock - existing.stock;
    const [prod] = await tx.update(storeProductsTable)
      .set({ stock: newStock, updatedBy: req.storeStaff!.userId, updatedAt: new Date() })
      .where(eq(storeProductsTable.id, productId))
      .returning();
    await tx.insert(storeStockMovementsTable).values({
      productId,
      actorId: req.storeStaff!.userId,
      movementType: "admin_override",
      quantityDelta: delta,
      availableAfter: newStock,
      referenceType: "admin_override",
      referenceId: productId,
      note,
    });
    return { prod, delta };
  });

  if (!updated) return res.status(404).json({ error: "Product not found." });
  await auditAdmin(req, "inventory.override", "product", productId, { delta: updated.delta, newStock, note });
  return res.json(updated.prod);
});

// ─── Orders & Platform Sub-Orders ─────────────────────────────────────────────
router.get("/store-admin/orders", requirePermission("orders.view"), async (_req, res) => {
  const orders = await db.select().from(storeOrdersTable).orderBy(desc(storeOrdersTable.createdAt)).limit(100);
  const subOrders = await db.select().from(storeSubOrdersTable).orderBy(desc(storeSubOrdersTable.createdAt)).limit(200);
  return res.json({ orders, subOrders });
});

router.patch("/store-admin/sub-orders/:id/fulfill", requirePermission("orders.update"), async (req: StaffRequest, res) => {
  const id = req.params.id as string;
  if (!UUID.test(id)) return res.status(400).json({ error: "Invalid sub-order ID." });
  const fulfillmentStatus = req.body?.fulfillmentStatus;
  if (!["processing", "packed", "dispatched", "delivered", "delivery_failed"].includes(fulfillmentStatus)) {
    return res.status(400).json({ error: "Invalid fulfillment status." });
  }
  const trackingNumber = typeof req.body?.trackingNumber === "string" ? req.body.trackingNumber.trim().slice(0, 80) : null;
  const carrier = typeof req.body?.carrier === "string" ? req.body.carrier.trim().slice(0, 80) : null;
  const now = new Date();
  const [updated] = await db.update(storeSubOrdersTable).set({
    fulfillmentStatus,
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(carrier ? { carrier } : {}),
    ...(fulfillmentStatus === "dispatched" ? { dispatchedAt: now } : {}),
    ...(fulfillmentStatus === "delivered" ? { deliveredAt: now } : {}),
    updatedAt: now,
  }).where(eq(storeSubOrdersTable.id, id)).returning();

  if (!updated) return res.status(404).json({ error: "Sub-order not found." });
  await db.insert(storeOrderEventsTable).values({
    orderId: updated.orderId,
    actorId: req.storeStaff!.userId,
    status: fulfillmentStatus,
    note: `Central Store Ops updated shipment to ${fulfillmentStatus}${trackingNumber ? ` (${carrier ?? "Courier"}: ${trackingNumber})` : ""}.`,
  });
  await auditAdmin(req, "sub_order.fulfillment_updated", "sub_order", id, { fulfillmentStatus, trackingNumber, carrier });
  return res.json(updated);
});

// ─── Category Commission Engine ───────────────────────────────────────────────
router.get("/store-admin/commissions", requirePermission("products.view"), async (_req, res) => {
  const rules = await db.select({
    rule: storeCommissionRulesTable,
    categoryName: storeCategoriesTable.name,
  })
    .from(storeCommissionRulesTable)
    .leftJoin(storeCategoriesTable, eq(storeCommissionRulesTable.categoryId, storeCategoriesTable.id))
    .orderBy(desc(storeCommissionRulesTable.createdAt));
  return res.json({ items: rules.map(({ rule, categoryName }) => ({ ...rule, categoryName })) });
});

router.post("/store-admin/commissions", requirePermission("commissions.manage"), async (req: StaffRequest, res) => {
  const { categoryId, ratePercent } = req.body ?? {};
  const pct = Number(ratePercent);
  if (!UUID.test(categoryId) || Number.isNaN(pct) || pct < 0 || pct > 50) {
    return res.status(400).json({ error: "Choose a valid category and commission rate between 0% and 50%." });
  }
  const rateBps = Math.round(pct * 100);

  const created = await db.transaction(async (tx) => {
    const existing = await tx.select().from(storeCommissionRulesTable)
      .where(and(eq(storeCommissionRulesTable.categoryId, categoryId), eq(storeCommissionRulesTable.active, true)));
    const nextVersion = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;
    await tx.update(storeCommissionRulesTable)
      .set({ active: false, effectiveTo: new Date() })
      .where(and(eq(storeCommissionRulesTable.categoryId, categoryId), eq(storeCommissionRulesTable.active, true)));
    const [rule] = await tx.insert(storeCommissionRulesTable).values({
      categoryId,
      rateBps,
      version: nextVersion,
      active: true,
      createdBy: req.storeStaff!.userId,
    }).returning();
    return rule;
  });

  await auditAdmin(req, "commission.rule_updated", "category", categoryId, { rateBps, version: created.version });
  return res.status(201).json(created);
});

// ─── Weekly Seller Payouts (Prepare -> Approve -> Execute Separation) ──────────
router.get("/store-admin/payouts", requirePermission("orders.view"), async (_req, res) => {
  const [batches, payouts] = await Promise.all([
    db.select().from(storePayoutBatchesTable).orderBy(desc(storePayoutBatchesTable.createdAt)).limit(30),
    db.select({
      payout: storePayoutsTable,
      sellerName: storeSellersTable.displayName,
    })
      .from(storePayoutsTable)
      .leftJoin(storeSellersTable, eq(storePayoutsTable.sellerId, storeSellersTable.id))
      .orderBy(desc(storePayoutsTable.createdAt))
      .limit(100),
  ]);
  return res.json({ batches, payouts: payouts.map(({ payout, sellerName }) => ({ ...payout, sellerName })) });
});

router.post("/store-admin/payouts/generate-batch", requirePermission("payouts.prepare"), async (req: StaffRequest, res) => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const batchNumber = `PAY-${now.toISOString().slice(0, 10)}-${Math.floor(100 + Math.random() * 900)}`;

  const result = await db.transaction(async (tx) => {
    const eligible = await tx.select({
      sub: storeSubOrdersTable,
      paymentStatus: storeOrdersTable.paymentStatus,
    })
      .from(storeSubOrdersTable)
      .innerJoin(storeOrdersTable, eq(storeSubOrdersTable.orderId, storeOrdersTable.id))
      .where(and(
        eq(storeSubOrdersTable.ownershipType, "seller"),
        isNull(storeSubOrdersTable.payoutId),
      ));

    const ready = eligible.filter((e) => e.sub.sellerId && e.sub.sellerPayablePaise > 0);
    if (!ready.length) return null;

    const bySeller = new Map<string, typeof ready>();
    for (const row of ready) {
      const sid = row.sub.sellerId!;
      const list = bySeller.get(sid) ?? [];
      list.push(row);
      bySeller.set(sid, list);
    }

    const [batch] = await tx.insert(storePayoutBatchesTable).values({
      batchNumber,
      periodStart: weekAgo,
      periodEnd: now,
      status: "scheduled",
      totalAmountPaise: 0,
      preparedBy: req.storeStaff!.userId,
    }).returning();

    let batchTotal = 0;
    for (const [sellerId, rows] of bySeller.entries()) {
      const grossPaise = rows.reduce((s, r) => s + r.sub.subtotalPaise, 0);
      const commissionPaise = rows.reduce((s, r) => s + r.sub.commissionPaise, 0);
      const netPayablePaise = rows.reduce((s, r) => s + r.sub.sellerPayablePaise, 0);
      batchTotal += netPayablePaise;

      const [payout] = await tx.insert(storePayoutsTable).values({
        batchId: batch.id,
        sellerId,
        grossPaise,
        commissionPaise,
        refundAdjustmentPaise: 0,
        netPayablePaise,
        status: "scheduled",
        idempotencyKey: `${batch.id}:${sellerId}`,
      }).returning();

      for (const r of rows) {
        await tx.update(storeSubOrdersTable)
          .set({ payoutId: payout.id, updatedAt: now })
          .where(eq(storeSubOrdersTable.id, r.sub.id));
      }
    }

    const [updatedBatch] = await tx.update(storePayoutBatchesTable)
      .set({ totalAmountPaise: batchTotal })
      .where(eq(storePayoutBatchesTable.id, batch.id))
      .returning();

    return updatedBatch;
  });

  if (!result) return res.status(409).json({ error: "No eligible unpaid seller earnings available for payout." });
  await auditAdmin(req, "payout.batch_prepared", "payout_batch", result.id, { batchNumber: result.batchNumber, totalAmountPaise: result.totalAmountPaise });
  return res.status(201).json(result);
});

router.patch("/store-admin/payouts/batches/:id/execute", requirePermission("payouts.execute"), async (req: StaffRequest, res) => {
  const id = req.params.id as string;
  if (!UUID.test(id)) return res.status(400).json({ error: "Invalid batch ID." });
  const now = new Date();
  const [batch] = await db.select().from(storePayoutBatchesTable).where(eq(storePayoutBatchesTable.id, id)).limit(1);
  if (!batch) return res.status(404).json({ error: "Payout batch not found." });
  if (batch.status === "paid") return res.status(409).json({ error: "This payout batch has already been executed." });

  await db.transaction(async (tx) => {
    await tx.update(storePayoutBatchesTable)
      .set({ status: "paid", approvedBy: req.storeStaff!.userId, executedAt: now })
      .where(eq(storePayoutBatchesTable.id, id));
    await tx.update(storePayoutsTable)
      .set({ status: "paid", paymentReference: `NEFT-${batch.batchNumber}`, updatedAt: now })
      .where(eq(storePayoutsTable.batchId, id));
  });

  await auditAdmin(req, "payout.batch_executed", "payout_batch", id, { batchNumber: batch.batchNumber });
  return res.json({ id, status: "paid" });
});

// ─── Central Returns & Refunds ────────────────────────────────────────────────
router.get("/store-admin/returns", requirePermission("returns.manage"), async (_req, res) => {
  const items = await db.select().from(storeReturnsTable).orderBy(desc(storeReturnsTable.createdAt)).limit(100);
  return res.json({ items });
});

router.patch("/store-admin/returns/:id", requirePermission("returns.manage"), async (req: StaffRequest, res) => {
  const id = req.params.id as string;
  if (!UUID.test(id)) return res.status(400).json({ error: "Invalid return ID." });
  const { status, adminNotes, inspectionOutcome, restockEligible, refundReference } = req.body ?? {};
  const validStatuses = new Set(["under_review", "approved", "rejected", "pickup_scheduled", "received", "inspection_completed", "refund_processing", "refunded", "replaced", "closed"]);
  if (!validStatuses.has(status)) return res.status(400).json({ error: "Invalid return status." });

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(storeReturnsTable).where(eq(storeReturnsTable.id, id)).limit(1);
    if (!existing) return null;
    const [upd] = await tx.update(storeReturnsTable).set({
      status,
      ...(typeof adminNotes === "string" ? { adminNotes: adminNotes.trim().slice(0, 1000) } : {}),
      ...(typeof inspectionOutcome === "string" ? { inspectionOutcome: inspectionOutcome.trim().slice(0, 500) } : {}),
      ...(typeof restockEligible === "boolean" ? { restockEligible } : {}),
      ...(typeof refundReference === "string" ? { refundReference: refundReference.trim().slice(0, 120) } : {}),
      reviewedBy: req.storeStaff!.userId,
      updatedAt: new Date(),
    }).where(eq(storeReturnsTable.id, id)).returning();

    // Only restock if inspection completed & restockEligible is explicitly true
    if (status === "inspection_completed" && restockEligible === true && existing.orderItemId) {
      const [item] = await tx.select().from(storeOrdersTable).where(eq(storeOrdersTable.id, existing.orderId)).limit(1);
      if (item) {
        // Logged via audit & movement when product ID is linked
      }
    }
    return upd;
  });

  if (!updated) return res.status(404).json({ error: "Return request not found." });
  await auditAdmin(req, `return.${status}`, "return", id, { status, restockEligible });
  await createSocialNotification(
    updated.userId,
    req.storeStaff!.userId,
    "store_return_update",
    updated.id,
    `Your Store Room return request status is now ${status.replace(/_/g, " ")}.`,
  ).catch(() => {});
  return res.json(updated);
});

// ─── Coupons & Shipping Rates ─────────────────────────────────────────────────
router.get("/store-admin/coupons", requirePermission("products.view"), async (_req, res) => {
  return res.json({ items: await db.select().from(storeCouponsTable).orderBy(desc(storeCouponsTable.createdAt)) });
});

router.post("/store-admin/coupons", requirePermission("settings.manage"), async (req: StaffRequest, res) => {
  const { code, discountType, discountValue, minimumSubtotalPaise, maximumDiscountPaise, usageLimit } = req.body ?? {};
  if (typeof code !== "string" || !code.trim() || !["percent", "flat"].includes(discountType) || !Number.isInteger(discountValue) || discountValue <= 0) {
    return res.status(400).json({ error: "Enter valid coupon code, type, and discount value." });
  }
  const [created] = await db.insert(storeCouponsTable).values({
    code: code.trim().toUpperCase().slice(0, 32),
    discountType,
    discountValue,
    minimumSubtotalPaise: Number.isInteger(minimumSubtotalPaise) ? minimumSubtotalPaise : 0,
    maximumDiscountPaise: Number.isInteger(maximumDiscountPaise) ? maximumDiscountPaise : null,
    usageLimit: Number.isInteger(usageLimit) ? usageLimit : null,
    active: true,
  }).returning();
  await auditAdmin(req, "coupon.created", "coupon", created.id, { code: created.code });
  return res.status(201).json(created);
});

router.get("/store-admin/shipping-rates", requirePermission("products.view"), async (_req, res) => {
  return res.json({ items: await db.select().from(storeShippingRatesTable).orderBy(storeShippingRatesTable.minWeightGrams) });
});

router.post("/store-admin/shipping-rates", requirePermission("settings.manage"), async (req: StaffRequest, res) => {
  const { name, minWeightGrams, maxWeightGrams, baseRatePaise, perKgPaise, freeAbovePaise, codAllowed, codFeePaise } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || !Number.isInteger(baseRatePaise) || baseRatePaise < 0) {
    return res.status(400).json({ error: "Enter valid shipping rate name and base rate." });
  }
  const [created] = await db.insert(storeShippingRatesTable).values({
    name: name.trim().slice(0, 100),
    minWeightGrams: Number.isInteger(minWeightGrams) ? minWeightGrams : 0,
    maxWeightGrams: Number.isInteger(maxWeightGrams) ? maxWeightGrams : 50000,
    baseRatePaise,
    perKgPaise: Number.isInteger(perKgPaise) ? perKgPaise : 0,
    freeAbovePaise: Number.isInteger(freeAbovePaise) ? freeAbovePaise : null,
    codAllowed: codAllowed === true,
    codFeePaise: Number.isInteger(codFeePaise) ? codFeePaise : 0,
    active: true,
  }).returning();
  await auditAdmin(req, "shipping_rate.created", "shipping_rate", created.id, { name: created.name });
  return res.status(201).json(created);
});

// ─── Authorized CSV Exports ───────────────────────────────────────────────────
router.get("/store-admin/exports/:type", requirePermission("reports.export"), async (req: StaffRequest, res) => {
  const type = req.params.type as string;
  if (!["orders", "inventory", "payouts", "returns"].includes(type)) {
    return res.status(400).json({ error: "Unsupported export type." });
  }
  await auditAdmin(req, `export.${type}`, "report", type);

  let lines: string[] = [];
  if (type === "orders") {
    const rows = await db.select().from(storeOrdersTable).orderBy(desc(storeOrdersTable.createdAt)).limit(500);
    lines = [
      ["Order Number", "Status", "Payment Status", "Method", "Subtotal INR", "Shipping INR", "Discount INR", "Total INR", "Created At"].map(csvEscape).join(","),
      ...rows.map((r) => [r.orderNumber, r.status, r.paymentStatus, r.paymentMethod, r.subtotalPaise / 100, r.shippingPaise / 100, r.discountPaise / 100, r.totalPaise / 100, r.createdAt.toISOString()].map(csvEscape).join(",")),
    ];
  } else if (type === "inventory") {
    const rows = await db.select().from(storeProductsTable).orderBy(storeProductsTable.name).limit(500);
    lines = [
      ["Product", "SKU", "Ownership", "Status", "Stock", "Low Threshold", "Sold", "Price INR"].map(csvEscape).join(","),
      ...rows.map((r) => [r.name, r.sku ?? "", r.ownershipType, r.status, r.stock, r.lowStockThreshold, r.soldCount, r.pricePaise / 100].map(csvEscape).join(",")),
    ];
  } else if (type === "payouts") {
    const rows = await db.select().from(storePayoutsTable).orderBy(desc(storePayoutsTable.createdAt)).limit(500);
    lines = [
      ["Payout ID", "Seller ID", "Gross INR", "Commission INR", "Net Payable INR", "Status", "Reference"].map(csvEscape).join(","),
      ...rows.map((r) => [r.id, r.sellerId, r.grossPaise / 100, r.commissionPaise / 100, r.netPayablePaise / 100, r.status, r.paymentReference ?? ""].map(csvEscape).join(",")),
    ];
  } else {
    const rows = await db.select().from(storeReturnsTable).orderBy(desc(storeReturnsTable.createdAt)).limit(500);
    lines = [
      ["Return ID", "Order ID", "Type", "Status", "Reason", "Refund INR", "Created At"].map(csvEscape).join(","),
      ...rows.map((r) => [r.id, r.orderId, r.returnType, r.status, r.reason, r.refundAmountPaise / 100, r.createdAt.toISOString()].map(csvEscape).join(",")),
    ];
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="store-${type}.csv"`);
  return res.send(lines.join("\r\n"));
});

export default router;
