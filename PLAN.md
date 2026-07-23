# Tribe — Project Plan

> **For agents:** Read this file first when starting a new session.  
> README = setup & env. **This file = product direction, roadmap, and current status.**

Last updated: 2026-07-23 (Phase 8 integrator tidy-up done)

---

## 1. What we are building

**Tribe is delivery-app middleware**, not a consumer delivery app.

We provide **USDC escrow + delivery proof + settlement** on Arc testnet so that integrators (e.g. a food-delivery platform) can plug in:

- **Customer client** — create order, pay, track, cancel
- **Store client** — admit orders, issue rider upload link, see disputes
- **Admin / arbiter** — resolve `DISPUTED` orders (`refund` | `release`); agent wallet on-chain
- **Rider** — off-chain; uploads photo via one-time link (no full account)

Identity, menus, rider dispatch, and branding stay with the integrator. Tribe owns the **payment lifecycle API**.

Reference sample: Circle [arc-escrow](https://github.com/circlefin/arc-escrow).

---

## 2. Hackathon target

**Goal: Level 3 — “framework middleware skeleton”** (not bare MVP, not production).  
Work in **phases (§5)** — order matters, calendar weeks do not.


| Level | Phase(s) | Scope                                  | Status       |
| ----- | -------- | -------------------------------------- | ------------ |
| 1     | 0–2      | Demo MVP — order API + test UI         | **Done**     |
| 2a    | 4        | Store registry (DB + API + validation) | **Done**     |
| 2b    | 5        | Customer / store UI split              | **Done**     |
| 3a    | 6        | Cancel refund + dispute resolve (store UI, temporary) | **Done** |
| 3a+   | 7        | Arbiter / admin dispute resolve        | **Done**     |
| 3b    | 8        | Integrator docs + demo polish          | **Done**     |
| 4     | —        | API keys, multi-tenant, production     | Out of scope |


**Explicitly deprioritize:** AI prompt tuning (pass once in demo is enough), deleting unused arc-escrow agreement component files, rider app polish, per-integrator API keys.

**Progress detail:** see **§5 Commit-sized checklist** (one checkbox ≈ one commit).

---

## 3. Architecture (layers)

```text
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Customer demo UI   │     │     Store demo UI     │     │   Admin / arbiter   │
│  /dashboard/customer│     │  /dashboard/store    │     │  /dashboard/admin   │
└──────────┬──────────┘     └──────────┬──────────┘     └──────────┬──────────┘
           │                           │                           │
           └───────────────────────────┴───────────────────────────┘
                                       ▼
                          ┌──────────────────────┐
                          │   Tribe API (middleware) │
                          │   orders, stores, pay,   │
                          │   proof, resolve         │
                          └──────────┬───────────┘
                                     ▼
                          ┌──────────────────────┐
                          │ Supabase + Circle Arc │
                          └──────────────────────┘
```

### Role model (important)

- **Not** a global “this user is forever a customer” flag.
- **Per order:** `customer_profile_id` (who created) + `store_profile_id` (who receives).
- **Store eligibility:** only profiles in `**stores`** table (`is_active`) can receive orders.
- Same human can be customer on one order and a registered store on another (like Uber Eats owner ordering food elsewhere).
- **`DISPUTED` settlement:** ideal owner is **admin / arbiter** (agent wallet / integrator ops), not the store. Phase 6 store resolve UI is a **temporary demo**; Phase 7 moves authority to admin.

### Data model (core tables)


| Table               | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `profiles`          | Auth-linked user                              |
| `wallets`           | Circle wallet per profile                     |
| `stores`            | **Registered stores** (Phase 4)               |
| `orders`            | Business order on top of escrow               |
| `escrow_agreements` | Payment layer (Circle deploy/deposit/release) |
| `transactions`      | On-chain tx tracking                          |


---

## 4. Order lifecycle (API)

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
       ▼                      ▼              (resolve: refund | release)
   CANCELLED              CANCELLED*
```

 Cancel + on-chain refund — implemented (Phase 6).
 Dispute resolve (`refund` | `release`) — **admin / arbiter only** (Phase 7).
 Store resolve UI removed; store can view `DISPUTED` only.

### Key endpoints (today)


| Action                 | Endpoint                              | Who                         |
| ---------------------- | ------------------------------------- | --------------------------- |
| List registered stores | `GET /api/stores`                     | Customer                    |
| Register as store      | `POST /api/stores`                    | Store registration          |
| Create order           | `POST /api/orders` (`storeId`)        | Customer                    |
| List orders            | `GET /api/orders`                     | Participant                 |
| Pay into escrow        | `POST /api/orders/[id]/pay`           | Customer                    |
| Admit                  | `POST /api/orders/[id]/admit`         | Store                       |
| Cancel                 | `POST /api/orders/[id]/cancel`        | Customer or store (+ refund if paid) |
| Resolve dispute        | `POST /api/orders/[id]/resolve`       | Admin arbiter (`refund` \| `release`); uses `refundByArbiter` for refund |
| Delivery link          | `POST /api/orders/[id]/delivery-link` | Store                       |
| Upload proof           | `POST /api/orders/proof?token=...`    | Rider (public)              |
| List disputed orders   | `GET /api/admin/orders?status=DISPUTED` | Admin                      |


### Role-prefixed aliases (Phase 8)

Thin re-exports of the canonical handlers above — same auth and domain rules.


| Client   | Alias | Canonical |
| -------- | ----- | --------- |
| Customer | `GET /api/customer/stores` | `GET /api/stores` |
| Customer | `GET/POST /api/customer/orders` | `GET/POST /api/orders` |
| Customer | `GET /api/customer/orders/[id]` | `GET /api/orders/[id]` |
| Customer | `POST /api/customer/orders/[id]/pay` | `POST /api/orders/[id]/pay` |
| Customer | `POST /api/customer/orders/[id]/cancel` | `POST /api/orders/[id]/cancel` |
| Store    | `POST /api/store/register` | `POST /api/stores` |
| Store    | `GET /api/store/orders` | `GET /api/orders` |
| Store    | `GET /api/store/orders/[id]` | `GET /api/orders/[id]` |
| Store    | `POST /api/store/orders/[id]/admit` | `POST /api/orders/[id]/admit` |
| Store    | `POST /api/store/orders/[id]/delivery-link` | `POST /api/orders/[id]/delivery-link` |
| Store    | `POST /api/store/orders/[id]/cancel` | `POST /api/orders/[id]/cancel` |


---

## 5. Commit-sized checklist

One row ≈ one focused commit. Pick the **first unchecked** item when starting work.

### Phase 0 — Base (arc-escrow fork)


| ✓   | Task                                            | Commit    | Suggested message              |
| --- | ----------------------------------------------- | --------- | ------------------------------ |
| [x] | Circle escrow, auth, wallets, legacy agreements | `f63de5c` | `initial commit: escrow setup` |
| [x] | README setup docs                               | `7ed03c6` | `update README.md`             |


### Phase 1 — Order backend (Level 1)


| ✓   | Task                                                | Commit    | Suggested message                   |
| --- | --------------------------------------------------- | --------- | ----------------------------------- |
| [x] | `orders` migration + types                          | `9f77b7b` | *(part of backend MVP commit)*      |
| [x] | Order service (CRUD, status, delivery token)        | `9f77b7b` | *(part of)*                         |
| [x] | `GET/POST /api/orders`, `GET /api/orders/[id]`      | `9f77b7b` | *(part of)*                         |
| [x] | `POST /api/orders/[id]/admit`, `/cancel`            | `9f77b7b` | *(part of)*                         |
| [x] | `POST /api/orders/[id]/pay` + order-payment service | `9f77b7b` | *(part of)*                         |
| [x] | `POST /api/orders/[id]/delivery-link`               | `9f77b7b` | *(part of)*                         |
| [x] | `POST /api/orders/proof` + AI validate + release    | `9f77b7b` | *(part of)*                         |
| [x] | Circle webhook → order `PAID` / `COMPLETED`         | `9f77b7b` | `Implement backend MVP order path.` |


### Phase 2 — Order test UI (Level 1)


| ✓   | Task                                         | Commit    | Suggested message                                 |
| --- | -------------------------------------------- | --------- | ------------------------------------------------- |
| [x] | `useOrders` hook + polling                   | `d9ad7d3` | *(part of UI commit)*                             |
| [x] | `CreateOrderCard` (create + pay)             | `d9ad7d3` | *(part of)*                                       |
| [x] | `OrdersList` (pay / admit / link / cancel)   | `d9ad7d3` | *(part of)*                                       |
| [x] | Wire dashboard `OrdersSection`               | `d9ad7d3` | *(part of)*                                       |
| [x] | Rider page `/deliver?token=...`              | `d9ad7d3` | *(part of)*                                       |
| [x] | Delivery link → `/deliver` URL (not raw API) | `d9ad7d3` | *(part of)*                                       |
| [x] | Pay deploy fix (Circle name + retry)         | `d9ad7d3` | `Add orders dashboard UI and rider deliver page.` |


### Phase 3 — Planning doc


| ✓   | Task                            | Commit    | Suggested message                        |
| --- | ------------------------------- | --------- | ---------------------------------------- |
| [x] | Add `PLAN.md` (initial roadmap) | `eef7020` | `Add project plan and roadmap document.` |


### Phase 4 — Store registry (Level 2a)


| ✓   | Task                                       | Commit    | Suggested message                                              |
| --- | ------------------------------------------ | --------- | -------------------------------------------------------------- |
| [x] | `stores` migration                         | `2e3d293` | *(part of store registry commit)*                              |
| [x] | `types/stores.ts` + database types         | `2e3d293` | *(part of)*                                                    |
| [x] | `store.service.ts`                         | `2e3d293` | *(part of)*                                                    |
| [x] | `GET/POST /api/stores`                     | `2e3d293` | *(part of)*                                                    |
| [x] | Order create requires registered `storeId` | `2e3d293` | *(part of)*                                                    |
| [x] | `RegisterStoreCard`                        | `2e3d293` | *(part of)*                                                    |
| [x] | Create order picker → `GET /api/stores`    | `2e3d293` | `Add store registry and restrict orders to registered stores.` |
| [x] | Apply migration on remote Supabase         | —         | *(ops, not a code commit)*                                     |


### Phase 5 — UI split (Level 2b) — **Done**


| ✓   | Task                                                   | Commit | Suggested message                                              |
| --- | ------------------------------------------------------ | ------ | -------------------------------------------------------------- |
| [x] | Add `/dashboard/customer` route (shell + wallet)       | —      | `Add customer dashboard route.`                                |
| [x] | Add `/dashboard/store` route (shell + wallet)          | —      | `Add store dashboard route.`                                   |
| [x] | Customer/store nav or redirect from `/dashboard`       | —      | `Add customer and store dashboard navigation.`                 |
| [x] | Customer view: create order + customer-filtered orders | —      | `Show create order and customer orders on customer dashboard.` |
| [x] | Store view: register store + store-filtered orders     | —      | `Show store registration and store orders on store dashboard.` |
| [x] | Remove duplicate actions from wrong role view          | —      | `Hide role-specific order actions on the wrong dashboard.`     |


**Phase 5 done when:** all rows checked + exit criteria in §6 (Phase 4–5) met.

### Phase 6 — Refund & dispute (Level 3a) — **Done**


| ✓   | Task                                                    | Commit | Suggested message                                   |
| --- | ------------------------------------------------------- | ------ | --------------------------------------------------- |
| [x] | On-chain refund helper in order-payment service         | —      | `Add on-chain refund helper for order escrow.`      |
| [x] | Extend `POST /api/orders/[id]/cancel` with refund rules | —      | `Refund escrow on cancel when order was paid.`      |
| [x] | `POST /api/orders/[id]/resolve` (`refund` \| `release`) | —      | `Add dispute resolve endpoint for disputed orders.` |
| [x] | Store dashboard: disputed orders + resolve buttons      | —      | `Add dispute resolve actions to store dashboard.`   |


> **Note:** Phase 6 store resolve was a temporary demo. Phase 7 moved authority to admin/arbiter.

### Phase 7 — Arbiter / admin dispute — **Done**


| ✓   | Task                                                              | Commit | Suggested message                                              |
| --- | ----------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| [x] | Admin auth gate (who may act as arbiter)                          | —      | `Add admin gate for dispute resolve.`                          |
| [x] | Admin resolve API (only admin; `refund` \| `release`)             | —      | `Restrict dispute resolve to admin arbiter.`                   |
| [x] | Prefer `refundByArbiter` for admin refund path                    | —      | `Use arbiter wallet for disputed order refunds.`               |
| [x] | `/dashboard/admin` — list `DISPUTED` orders + resolve buttons     | —      | `Add admin dashboard for disputed order resolve.`              |
| [x] | Hide store resolve buttons; store can view disputed only          | —      | `Move dispute resolve actions from store to admin dashboard.`  |


**Phase 7 done when:** `DISPUTED` → admin resolves refund/release; store cannot settle disputes.

### Phase 8 — Integrator story (Level 3b)


| ✓   | Task                                                   | Commit | Suggested message                                      |
| --- | ------------------------------------------------------ | ------ | ------------------------------------------------------ |
| [x] | `docs/INTEGRATION.md` — Customer vs Store flows        | —      | `Add integrator guide for customer and store clients.` |
| [x] | Optional `/api/customer/*`, `/api/store/*` doc aliases | —      | `Add customer and store API route aliases.`            |
| [x] | Hide legacy escrow agreements on dashboard             | —      | `Hide legacy escrow UI from dashboard.`                |
| [x] | Final README + integration doc sync with shipped API   | —      | `Update docs for middleware demo flow.`                |


> **Legacy UI note:** Agreement upload/list components from arc-escrow remain in the repo but are **not mounted** on any dashboard route. Landing + nav branding retargeted to Tribe (paper-contract copy removed). Full file deletion is optional cleanup later.


---

### Quick status


| Phase | Name                  | Status                         |
| ----- | --------------------- | ------------------------------ |
| 0–2   | MVP backend + test UI | **Done**                       |
| 3     | PLAN doc              | **Done**                       |
| 4     | Store registry        | **Done**                       |
| 5     | UI split              | **Done**                       |
| 6     | Refund & dispute      | **Done** (store resolve was temporary) |
| 7     | Arbiter / admin dispute | **Done**                             |
| 8     | Integrator docs       | **Done**                               |


Hackathon Level 3 skeleton is complete. Optional next: visual frontend polish / recorded E2E demo.


---

## 6. Phase exit criteria


| Phase(s) | Goal             | Exit criteria                                                                                            | Status   |
| -------- | ---------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| **4**    | Store registry   | Registered stores only can receive orders; `GET/POST /api/stores` works                                  | Done     |
| **5**    | UI split         | Two accounts → store registers → customer orders from store list → store admits from **store dashboard** | Done     |
| **6**    | Refund & dispute | Bad proof → `DISPUTED` → resolve refund to customer (on-chain); store UI OK for demo                     | Done     |
| **7**    | Arbiter resolve  | `DISPUTED` → **admin/arbiter** refund or release; store cannot settle                                    | **Done** |
| **8**    | Integrator story | Recorded E2E demo + integration doc; can pitch “middleware skeleton”                                     | **Done** |


---

## 7. Demo script (target)

1. **Store account:** Register store → see incoming order → Admit → copy delivery link
2. **Customer account:** Pick registered store → Create & pay → wait for `PAID`
3. **Rider:** Open `/deliver?token=...` → upload photo
4. **Happy path:** Order → `COMPLETED`, funds to store
5. **Unhappy path:** Bad photo → `DISPUTED` → **admin/arbiter** resolves refund to customer

**Pitch line:** Real delivery apps keep identity and UX; Tribe is escrow + proof middleware on Arc. AI proposes; arbiter settles disputes.

---

## 8. Testing notes

- Requires: `npm run dev`, ngrok → Circle webhooks, USDC on Arc testnet
- Two Supabase auth accounts (customer + store) for full flow
- Store must **Register store** (`POST /api/stores`) before appearing in customer picker
- `stores` migration applied on remote Supabase (required once; already done)
- AI proof pass threshold: `valid === true && confidence === "HIGH"` (see `app/api/orders/proof/route.ts`)

---

## 9. Key files (agent map)


| Area                   | Path                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| Plan (this file)       | `PLAN.md`                                                        |
| Setup                  | `README.md`                                                      |
| Integrator guide       | `docs/INTEGRATION.md`                                            |
| Customer API aliases   | `app/api/customer/**`                                            |
| Store API aliases      | `app/api/store/**`                                               |
| Stores migration       | `supabase/migrations/20260722165000_create_stores_table.sql`     |
| Store service / API    | `app/services/store.service.ts`, `app/api/stores/route.ts`       |
| Order APIs             | `app/api/orders/**`                                              |
| Payment / escrow chain | `app/services/order-payment.service.ts`                          |
| Circle webhooks        | `app/api/webhooks/circle/route.ts`                               |
| Proof + AI             | `app/api/orders/proof/route.ts`                                  |
| Customer UI            | `components/create-order-card.tsx`, `components/orders-list.tsx` |
| Store register UI      | `components/register-store-card.tsx`                             |
| Dashboard shell        | `app/dashboard/page.tsx`, `components/orders-section.tsx`        |
| Admin dispute UI       | `app/dashboard/admin/`                                               |
| Admin gate             | `lib/admin.ts` (`ADMIN_PROFILE_IDS`)                                 |
| Rider page             | `app/deliver/`                                                   |


---

## 10. Terminology (use consistently)

**Use `store` everywhere** — code, docs, commit messages, pitch. Do **not** rename to `merchant`.


| Term         | Meaning                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| **store**    | Registered business in `stores` table; order recipient; store-side UI/API |
| **customer** | Order creator; payer; customer-side UI/API                                |
| **rider**    | Off-chain; uploads proof via token link (no account)                      |
| **admin / arbiter** | Platform operator who resolves `DISPUTED` orders; maps to agent wallet on-chain |


Why not merchant? Payment/PG jargon (Stripe-style). Our domain is delivery — “store” is clearer and matches the schema (`stores`, `storeId`, `store_profile_id`).

---

## 11. Decisions log


| Date       | Decision                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| 2026-07-20 | Option A: `orders` business layer on top of existing `escrow_agreements` |
| 2026-07-22 | Target Level 3 middleware skeleton for hackathon (phases 0–7)            |
| 2026-07-22 | `stores` table for registered stores; `storeId` on create order          |
| 2026-07-22 | UI split by route (customer/store), same API underneath                  |
| 2026-07-22 | Do not split API URLs yet; enforce rules in domain layer first           |
| 2026-07-22 | AI validation: minimal tuning; dispute resolve is higher priority        |
| 2026-07-22 | **Terminology: `store` not `merchant`** — no code rename needed          |
| 2026-07-22 | **Roadmap by phase, not calendar week**                                  |
| 2026-07-22 | **Progress tracked in commit-sized checklist (§5)**                      |
| 2026-07-23 | **`DISPUTED` should be settled by admin/arbiter**, not store (store resolve = temporary demo) |
| 2026-07-23 | Phase 7 = admin dispute UI/API; former integrator docs phase renumbered to Phase 8 |
| 2026-07-23 | Phase 8 done: INTEGRATION.md, customer/store aliases, hide legacy demo surface, README sync |


---

## 12. When picking up work

1. Read **§5 Commit-sized checklist** — take the **first unchecked** row
2. Check **§6 Phase exit criteria** for the current phase goal
3. Check `git log --oneline -5` and `git status`
4. One commit per row when possible; use the suggested message column
5. After shipping, check the box in §5 (PLAN.md edits do not need their own commit)
6. Do not commit unless the user asks

**Next code commit:** Optional — frontend visual polish, or delete unused arc-escrow agreement UI files.