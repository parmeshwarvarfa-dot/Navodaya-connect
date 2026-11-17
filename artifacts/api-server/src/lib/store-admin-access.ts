export const STORE_ADMIN_PERMISSIONS = {
  super_admin: ["products.view", "products.create", "products.edit", "products.delete", "products.approve", "categories.manage", "inventory.manage", "orders.view", "orders.update", "sellers.approve", "payments.view", "refunds.approve", "analytics.view", "staff.manage", "settings.manage", "audit_logs.view"],
  store_manager: ["products.view", "products.create", "products.edit", "products.delete", "products.approve", "categories.manage", "inventory.manage", "orders.view", "orders.update", "sellers.approve", "analytics.view"],
  product_manager: ["products.view", "products.create", "products.edit", "products.submit", "products.delete", "categories.manage"],
  order_manager: ["orders.view", "orders.update"],
  inventory_manager: ["products.view", "inventory.manage"],
  seller_manager: ["products.view", "sellers.approve"],
  finance_manager: ["orders.view", "payments.view", "refunds.approve"],
  customer_support: ["orders.view"],
} as const;

export type StoreAdminRole = keyof typeof STORE_ADMIN_PERMISSIONS;
export function isStoreAdminRole(value: string): value is StoreAdminRole {
  return Object.hasOwn(STORE_ADMIN_PERMISSIONS, value);
}
export function storeAdminHasPermission(role: StoreAdminRole, permission: string): boolean {
  return (STORE_ADMIN_PERMISSIONS[role] as readonly string[]).includes(permission);
}
