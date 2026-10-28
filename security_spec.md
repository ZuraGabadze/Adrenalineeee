# Firestore Security Specification — ADRENALINEE Store

## 1. Data Invariants
1. **Default Deny**: All unmapped paths (`/{document=**}`) deny all reads and writes unconditionally.
2. **Admin-Only Catalog & Config Mutation**: Only verified administrators (`isAdmin()`) can create, update, or delete `/site_settings/{settingId}`, `/products/{productId}`, `/admins/{adminId}`, and `/audit_logs/{logId}`.
3. **Order Ownership & Terminal State Locking**:
   - An `/orders/{orderId}` document can only be created if `ownerId == request.auth.uid`, `status == 'pending'`, and `createdAt == request.time`.
   - Non-admin owners cannot transition order status to `paid` or `delivered`, nor can any non-admin modify an order once it reaches terminal states (`delivered`, `refunded`, `failed`).
4. **Strict Schema & Volumetric Bounds**: Every string field enforces `.size() <= maxLength`, every ID enforces `isValidId()`, and every write checks `keys().hasAll(...)` and `keys().hasOnly(...)`.
5. **Temporal Integrity**: `createdAt` must equal `request.time` on create and remain immutable on update; `updatedAt` must equal `request.time` on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Product**: Adding `"isFree": true` to `/products/vip` -> Rejected by `keys().hasOnly(...)`.
2. **Email Spoofing Admin Bypass**: Authenticated user with `email == "gabuniaannygemini@gmail.com"` but `email_verified == false` attempting to update `/site_settings/main` -> Rejected by `request.auth.token.email_verified == true`.
3. **Order Owner Spoofing**: Authenticated user `uid_A` creating `/orders/ord_1` with `ownerId: "uid_B"` -> Rejected by `incoming().ownerId == request.auth.uid`.
4. **Order Status Self-Payment Escalation**: Authenticated user creating or updating `/orders/ord_1` with `status: "paid"` -> Rejected because create requires `status == 'pending'` and only `isAdmin()` can update `status`.
5. **Terminal State Re-opening**: Attempting to update an order whose `existing().status == 'delivered'` without admin privileges -> Rejected by terminal state lock.
6. **ID Poisoning Attack**: Creating a document with a 1500-char ID or special characters -> Rejected by `isValidId(id)`.
7. **Denial-of-Wallet Oversized String**: Sending a 50,000-character string in `announcementKa` -> Rejected by `.size() <= 500`.
8. **Timestamp Forgery on Create**: Creating `/orders/ord_1` with a past `createdAt` timestamp -> Rejected by `incoming().createdAt == request.time`.
9. **Immortal Field Mutation**: Updating `createdAt` or `ownerId` on an existing `/orders/{orderId}` document -> Rejected by immutability checks.
10. **Unauthorized Order List Scraping**: Authenticated user running an unfiltered `list` query on `/orders` -> Rejected by `resource.data.ownerId == request.auth.uid || isAdmin()`.
11. **Audit Log Tampering / Deletion**: Admin or user attempting to `update` or `delete` `/audit_logs/{logId}` -> Rejected because audit logs are append-only (`allow update, delete: if false`).
12. **Self-Assigned Admin Escalation**: Regular user attempting to create `/admins/{uid}` -> Rejected because only bootstrapped admin can write to `/admins`.
