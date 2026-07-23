# Tribe Integration Guide

Tribe is **delivery-app middleware**: USDC escrow, delivery proof, and settlement on Arc testnet.

Integrators keep their own identity, menus, rider dispatch, and branding. You plug in two clients against Tribe’s payment lifecycle API:

- **Customer client** — create order, pay, track, cancel
- **Store client** — register store, admit orders, issue rider upload links, cancel / view disputes

A third party (**admin / arbiter**) settles `DISPUTED` orders. Riders stay off-chain and upload proof via a one-time link (no Tribe account).

> This doc describes the **shipped API today**. Optional `/api/customer/*` and `/api/store/*` aliases may be added later; until then, call the endpoints below directly.

---

## 1. What you own vs what Tribe owns

| Integrator owns | Tribe owns |
| --- | --- |
| User signup UX, menus, cart, branding | Escrow deploy / deposit / release / refund |
| Rider dispatch (SMS, app, etc.) | Delivery proof token + AI validation |
| Mapping your users ↔ Tribe profiles | Order status machine |
| Showing Tribe statuses in your UI | Admin dispute resolve (`refund` \| `release`) |

Auth today: **Supabase session cookies** (same as the demo dashboards). Each authenticated user has a `profiles.id` and a Circle wallet. Production API keys / multi-tenant isolation are out of scope for this hackathon skeleton.

---

## 2. Order lifecycle

```text
PENDING_PAYMENT ──pay──▶ PAID ──admit──▶ ADMITTED
       │                      │              │
       │                      │         delivery-link
       │                      │              ▼
       │                      │         IN_DELIVERY
       │                      │              │
       │                      │         proof (AI)
       │                      │         ╱         ╲
       │                      │   COMPLETED    DISPUTED
       ▼                      ▼              (admin: refund | release)
   CANCELLED              CANCELLED*
```

| Status | Meaning |
| --- | --- |
| `PENDING_PAYMENT` | Order created; escrow not funded yet |
| `PAID` | Customer paid; waiting for store admit (webhook may set this after chain confirm) |
| `ADMITTED` | Store accepted; can issue delivery link |
| `IN_DELIVERY` | Delivery token issued; waiting for rider proof |
| `COMPLETED` | Proof passed (or admin released); funds to store |
| `DISPUTED` | Proof failed; admin must resolve |
| `CANCELLED` | Cancelled before delivery, or dispute refunded |

\* Cancel from `PAID` / `ADMITTED` triggers an on-chain refund (`refundByRecipient`).

---

## 3. Customer client flow

Typical sequence for a **customer-facing** app (or Tribe `/dashboard/customer`):

```text
1. GET  /api/stores
2. POST /api/orders          { storeId, amount, deliveryAddress, items? }
3. POST /api/orders/:id/pay
4. Poll GET /api/orders or GET /api/orders/:id  until PAID / ADMITTED / …
5. Optional: POST /api/orders/:id/cancel   (before IN_DELIVERY)
```

### 3.1 List registered stores

```http
GET /api/stores
```

**Auth:** logged-in user  
**Response:**

```json
{
  "success": true,
  "stores": [{ "id": "<store-uuid>", "name": "Demo Pizza" }]
}
```

Only **active registered stores** with a wallet appear. Use `stores[].id` as `storeId` when creating an order.

### 3.2 Create order

```http
POST /api/orders
Content-Type: application/json

{
  "storeId": "<store-uuid>",
  "amount": 12.5,
  "deliveryAddress": "123 Main St",
  "items": [
    { "name": "Margherita", "quantity": 1, "unit_price": "12.5" }
  ],
  "currency": "USDC"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `storeId` | yes | From `GET /api/stores` |
| `amount` | yes | Positive number |
| `deliveryAddress` | yes | Free text |
| `items` | no | Helps AI proof validation |
| `currency` | no | Defaults to USDC |

**Rules:** customer and store must be different profiles; store must be registered and active.

**Response:** `{ success, order }` with `status: "PENDING_PAYMENT"`.

### 3.3 Pay into escrow

```http
POST /api/orders/:id/pay
```

**Who:** order customer only  
**Effect:** deploys escrow (agent wallet = arbiter), then deposits USDC. Status moves toward `PAID` as Circle webhooks confirm.

**Response (201):**

```json
{
  "success": true,
  "order": { "...": "..." },
  "escrowAgreementId": "...",
  "deployTransactionId": "...",
  "contractId": "...",
  "message": "Order payment initiated. Escrow deploy in progress."
}
```

Poll order status after pay; do not assume `PAID` in the same response.

### 3.4 List / get orders

```http
GET /api/orders
GET /api/orders/:id
```

`GET /api/orders` returns orders where the caller is **customer or store**. Filter client-side by `customer_profile_id` for a customer UI.

### 3.5 Cancel (customer)

```http
POST /api/orders/:id/cancel
```

Allowed while status is `PENDING_PAYMENT`, `PAID`, or `ADMITTED`.  
If already paid (`PAID` / `ADMITTED` with escrow), Tribe starts an on-chain refund.

---

## 4. Store client flow

Typical sequence for a **store-facing** app (or Tribe `/dashboard/store`):

```text
0. POST /api/stores          { name }     // once per profile
1. GET  /api/orders                       // filter store_profile_id
2. POST /api/orders/:id/admit             // when PAID
3. POST /api/orders/:id/delivery-link     // share uploadUrl with rider
4. Rider uploads proof (public link) → COMPLETED or DISPUTED
5. Optional: POST /api/orders/:id/cancel  // before IN_DELIVERY
```

Store **cannot** resolve disputes. On `DISPUTED`, show status only; admin settles.

### 4.1 Register as store

```http
POST /api/stores
Content-Type: application/json

{ "name": "Demo Pizza" }
```

**Auth:** logged-in user with a Circle wallet  
**Response (201):** `{ success, store }` (`store.id`, `store.profile_id`, `name`, …)

One active registration per profile. After this, the store appears in `GET /api/stores` for customers.

### 4.2 Admit order

```http
POST /api/orders/:id/admit
```

**Who:** order store only  
**Requires:** `status === "PAID"`  
**Result:** `ADMITTED`

### 4.3 Issue delivery link

```http
POST /api/orders/:id/delivery-link
```

**Who:** order store only  
**Allowed:** `ADMITTED`, or `IN_DELIVERY` without proof yet  

**Response (201):**

```json
{
  "success": true,
  "order": { "status": "IN_DELIVERY", "...": "..." },
  "token": "<opaque-token>",
  "uploadUrl": "https://your-host/deliver?token=<opaque-token>"
}
```

Send `uploadUrl` to the rider (SMS, chat, etc.). The rider opens the page and uploads a photo — **no login**.

### 4.4 Cancel (store)

Same endpoint as customer: `POST /api/orders/:id/cancel`.  
Either participant may cancel before `IN_DELIVERY`.

### 4.5 Disputed orders (store)

When AI rejects proof, status becomes `DISPUTED`. Store UI should show the badge only. Settlement is **admin-only**:

- `GET /api/admin/orders?status=DISPUTED`
- `POST /api/orders/:id/resolve` with `{ "action": "refund" | "release" }`

Admin access is gated by `ADMIN_PROFILE_IDS` (see README).

---

## 5. Rider proof (integrator note)

Not a full Tribe client — usually triggered by the store’s delivery link.

```http
POST /api/orders/proof?token=<token>
Content-Type: multipart/form-data

file: <image/jpeg|png>
```

| AI result | Order outcome |
| --- | --- |
| Pass (`valid` + `confidence: "HIGH"`) | Release to store → `COMPLETED` |
| Fail | Freeze as `DISPUTED` |

---

## 6. Endpoint cheat sheet

### Customer

| Step | Method | Path |
| --- | --- | --- |
| List stores | `GET` | `/api/stores` |
| Create order | `POST` | `/api/orders` |
| Pay | `POST` | `/api/orders/:id/pay` |
| List / get | `GET` | `/api/orders`, `/api/orders/:id` |
| Cancel | `POST` | `/api/orders/:id/cancel` |

### Store

| Step | Method | Path |
| --- | --- | --- |
| Register | `POST` | `/api/stores` |
| List / get | `GET` | `/api/orders`, `/api/orders/:id` |
| Admit | `POST` | `/api/orders/:id/admit` |
| Delivery link | `POST` | `/api/orders/:id/delivery-link` |
| Cancel | `POST` | `/api/orders/:id/cancel` |

### Admin / rider (supporting)

| Step | Method | Path | Who |
| --- | --- | --- | --- |
| List disputed | `GET` | `/api/admin/orders?status=DISPUTED` | Admin |
| Resolve | `POST` | `/api/orders/:id/resolve` | Admin |
| Upload proof | `POST` | `/api/orders/proof?token=…` | Rider (public) |

---

## 7. Demo wiring (reference UI)

| Role | Demo route |
| --- | --- |
| Customer | `/dashboard/customer` |
| Store | `/dashboard/store` |
| Admin | `/dashboard/admin` |
| Rider | `/deliver?token=…` |

Use these screens to validate the API before wiring your own apps. Setup and env vars: [README.md](../README.md). Product roadmap: [PLAN.md](../PLAN.md).

---

## 8. Pitch line

Real delivery apps keep identity and UX; **Tribe is escrow + proof middleware on Arc**. AI proposes; the arbiter settles disputes.
