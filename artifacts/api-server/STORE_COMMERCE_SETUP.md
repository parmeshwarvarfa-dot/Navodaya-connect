# JNV Store deployment notes

The Store uses the existing Navodaya Connect API and Postgres database. Apply both Store migrations before starting the API:

1. `lib/db/migrations/20261030_add_secure_store_admin.sql`
2. `lib/db/migrations/20261030_isolate_store_admin_sessions.sql`
3. `lib/db/migrations/20261030_add_store_commerce.sql`

Apply these through the project's normal reviewed database migration process. The API's Store routes require the resulting tables and columns.

Provision the first Super Admin through a trusted database operator, following the commented example in `20261030_add_secure_store_admin.sql`. There is no public registration or self-promotion endpoint. Store admin sessions are isolated from normal app sessions; apply the session migration to revoke legacy dashboard tokens from the normal session table.

Admin login has server-side role checks, an eight-hour expiry, login throttling, SHA-256-digested session tokens at rest, and audit records. The app stores the admin bearer token under a separate local key so Store admin sign-in/out does not replace the regular app token. Roles map to server-checked permissions; a configurable per-person permission editor and MFA are not implemented. Use the existing account recovery process; there is no separate public Store admin recovery flow.

## Payments and delivery

The API reports payment and delivery checkout as disabled. Setting environment variables alone does not enable checkout: a verified gateway adapter, signed webhook handling, idempotent payment reconciliation, a delivery serviceability/label/tracking adapter, and operational testing are not implemented. The UI therefore validates cart/address data and clearly stops before placing an order. Do not advertise live checkout until those adapters are implemented and tested.

The current configuration indicators are `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `STORE_DELIVERY_PROVIDER`. Keep secrets only in the API runtime secret store; do not put them in Expo `EXPO_PUBLIC_*` variables. These indicators do not activate payments or shipping.

## Current Store scope

Implemented backend/UI foundations include a database-driven published catalog, category/search/price sorting, product details and option selection, authenticated persistent cart and wishlist, owned delivery addresses (including hostel/JNV types), checkout preview with server-side price/stock checks, order history display, verified-delivered-purchase review submissions, seller applications, Store admin product/category/inventory/staff/audit tools, seller application approval, and category visibility/editing. The admin route has its own login and responsive wide-screen sidebar/mobile navigation; each protected endpoint checks the dedicated Store admin session and permission.

The following still need implementation before production commerce: payment and shipping adapters; transactional/idempotent order creation; shipment and manual tracking operations; cancellation/return/refund processing; coupons and discount engine; review moderation/votes/photos; seller product/order/settlement dashboard; category image upload/subcategories/reordering; support tickets, Store notifications, invoices, full sales analytics, configurable per-user permissions, MFA, and comprehensive integration/security tests. Do not represent these as available features yet.
