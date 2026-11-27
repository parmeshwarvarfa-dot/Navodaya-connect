export const STORE_ADMIN_PERMISSIONS = {
  super_admin: [
    "products.view", "products.create", "products.edit", "products.delete", "products.approve",
    "categories.manage", "inventory.manage", "inventory.override",
    "orders.view", "orders.update", "sellers.approve",
    "payments.view", "refunds.approve", "returns.manage",
    "commissions.manage", "payouts.prepare", "payouts.approve", "payouts.execute",
    "analytics.view", "reports.export", "staff.manage", "settings.manage", "audit_logs.view",
  ],
  store_manager: [
    "products.view", "products.create", "products.edit", "products.delete", "products.approve",
    "categories.manage", "inventory.manage", "inventory.override",
    "orders.view", "orders.update", "sellers.approve", "returns.manage",
    "analytics.view", "reports.export",
  ],
  product_manager: ["products.view", "products.create", "products.edit", "products.submit", "products.delete", "categories.manage"],
  order_manager: ["orders.view", "orders.update", "returns.manage"],
  inventory_manager: ["products.view", "inventory.manage", "inventory.override"],
  seller_manager: ["products.view", "sellers.approve"],
  finance_manager: [
    "orders.view", "payments.view", "refunds.approve", "commissions.manage",
    "payouts.prepare", "payouts.approve", "payouts.execute", "analytics.view", "reports.export",
  ],
  customer_support: ["orders.view", "returns.manage"],
} as const;

export type StoreAdminRole = keyof typeof STORE_ADMIN_PERMISSIONS;
export function isStoreAdminRole(value: string): value is StoreAdminRole {
  return Object.hasOwn(STORE_ADMIN_PERMISSIONS, value);
}
export function storeAdminHasPermission(role: StoreAdminRole, permission: string): boolean {
  return (STORE_ADMIN_PERMISSIONS[role] as readonly string[]).includes(permission);
}
