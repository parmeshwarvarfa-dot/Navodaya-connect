import assert from "node:assert/strict";
import test from "node:test";
import { isStoreAdminRole, storeAdminHasPermission } from "./store-admin-access";

test("community account roles never become store administrator roles", () => {
  for (const role of ["student", "alumni", "teacher", "official", "admin", ""])
    assert.equal(isStoreAdminRole(role), false);
});

test("product managers can submit products but cannot approve or publish them", () => {
  assert.equal(storeAdminHasPermission("product_manager", "products.create"), true);
  assert.equal(storeAdminHasPermission("product_manager", "products.submit"), true);
  assert.equal(storeAdminHasPermission("product_manager", "products.approve"), false);
  assert.equal(storeAdminHasPermission("product_manager", "payments.view"), false);
});

test("inventory managers can manage stock without changing product or payment settings", () => {
  assert.equal(storeAdminHasPermission("inventory_manager", "inventory.manage"), true);
  assert.equal(storeAdminHasPermission("inventory_manager", "products.edit"), false);
  assert.equal(storeAdminHasPermission("inventory_manager", "settings.manage"), false);
});

test("only super admins receive staff, settings and audit access", () => {
  assert.equal(storeAdminHasPermission("super_admin", "staff.manage"), true);
  assert.equal(storeAdminHasPermission("super_admin", "settings.manage"), true);
  assert.equal(storeAdminHasPermission("super_admin", "audit_logs.view"), true);
  assert.equal(storeAdminHasPermission("store_manager", "staff.manage"), false);
  assert.equal(storeAdminHasPermission("store_manager", "settings.manage"), false);
});
