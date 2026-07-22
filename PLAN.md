# Tribe — Project Plan

> **For agents:** Read this file first when starting a new session.  
> README = setup & env. **This file = product direction, roadmap, and current status.**

Last updated: 2026-07-22

---

## 1. What we are building

**Tribe is delivery-app middleware**, not a consumer delivery app.

We provide **USDC escrow + delivery proof + settlement** on Arc testnet so that integrators (e.g. a food-delivery platform) can plug in:

- **Consumer client** — create order, pay, track, cancel
- **Merchant client** — admit orders, issue rider upload link, see disputes
- **Rider** — off-chain; uploads photo via one-time link (no full account)

Identity, menus, rider dispatch, and branding stay with the integrator. Tribe owns the **payment lifecycle API**.

Reference sample: Circle [arc-escrow](https://github.com/circlefin/arc-escrow).

---

## 2. Hackathon target (~3 weeks)

**Goal: Level 3 — “framework middleware skeleton”** (not bare MVP, not production).

| Level | Description | Status |
|-------|-------------|--------|
| 1 | Demo MVP (API + test UI) | Done |
| 2 | Role model (store registry + UI split) | In progress |
| 3 | Refund + dispute resolve + integrator docs | Planned |
| 4 | API keys, multi-tenant, production hardening | Out of scope for hackathon |

**Explicitly deprioritize:** AI prompt tuning (pass once in demo is enough), legacy escrow UI removal, rider app polish, per-integrator API keys.

---

## 3. Architecture (layers)

```text
┌─────────────────────┐     ┌─────────────────────┐
│  Consumer demo UI   │     │   Merchant demo UI   │
│  /dashboard/customer│     │  /dashboard/store    │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └─────────────┬─────────────┘
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
- **Store eligibility:** only profiles in **`stores`** table (`is_active`) can receive orders.
- Same human can be customer on one order and a registered store on another (like Uber Eats owner ordering food elsewhere).

### Data model (core tables)

| Table | Purpose |
|-------|---------|
| `profiles` | Auth-linked user |
| `wallets` | Circle wallet per profile |
| `stores` | **Registered merchants** (Week 1) |
| `orders` | Business order on top of escrow |
| `escrow_agreements` | Payment layer (Circle deploy/deposit/release) |
| `transactions` | On-chain tx tracking |

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

\* Cancel + on-chain refund — **not implemented yet** (Week 2).

### Key endpoints (today)

| Action | Endpoint | Who |
|--------|----------|-----|
| List registered stores | `GET /api/stores` | Customer |
| Register as store | `POST /api/stores` | Merchant onboarding |
| Create order | `POST /api/orders` (`storeId`) | Customer |
| List orders | `GET /api/orders` | Participant |
| Pay into escrow | `POST /api/orders/[id]/pay` | Customer |
| Admit | `POST /api/orders/[id]/admit` | Store |
| Cancel | `POST /api/orders/[id]/cancel` | Customer or store (DB only) |
| Delivery link | `POST /api/orders/[id]/delivery-link` | Store |
| Upload proof | `POST /api/orders/proof?token=...` | Rider (public) |

### Planned endpoints (Week 2+)

| Action | Endpoint | Notes |
|--------|----------|-------|
| Resolve dispute | `POST /api/orders/[id]/resolve` | `refund` \| `release` |
| Cancel with refund | extend cancel | On-chain refund when paid |

---

## 5. Current progress

### Done

- [x] Orders schema + types
- [x] Full backend order path: create → pay → admit → delivery-link → proof → complete/dispute
- [x] Circle webhooks → `PAID`, `COMPLETED`
- [x] Dashboard test UI: create/list/actions, `/deliver?token=...`
- [x] Pay deploy fix (Circle alphanumeric contract name; pay retry)
- [x] **`stores` table + migration** (`20260722165000_create_stores_table.sql`)
- [x] **`GET/POST /api/stores`**
- [x] **Create order requires registered `storeId`**
- [x] Register store card + create order uses `GET /api/stores`

### In progress (Week 1 remainder)

- [ ] Apply `stores` migration on remote Supabase (`npx supabase db push`)
- [ ] **UI split:** `/dashboard/customer` vs `/dashboard/store`
- [ ] Move Register store → merchant view only; Create order → customer view only
- [ ] Filter orders list by role on each view

### Not started

- [ ] Cancel → on-chain refund (Week 2)
- [ ] Dispute resolve API + UI (Week 2)
- [ ] Integrator README sections: Consumer / Merchant API (Week 3)
- [ ] Optional URL namespaces: `/api/customer/*`, `/api/store/*` (Week 3, thin wrappers OK)
- [ ] Hide or remove legacy escrow agreement UI from dashboard

---

## 6. Three-week roadmap

### Week 1 — Domain & roles (current)

1. `stores` migration + `GET/POST /api/stores` — **done**
2. Order create validates registered store — **done**
3. UI: `/dashboard/customer`, `/dashboard/store` — **next**
4. Customer picker: registered stores only — **done**

**Week 1 exit criteria:** Two test accounts; store registers; customer orders only from store list; store admits from store view.

### Week 2 — Money & disputes

1. Cancel + on-chain refund (rules by status)
2. `POST /api/orders/[id]/resolve` for `DISPUTED` → refund or release
3. Store UI: disputed orders + resolve actions (demo arbiter = store or admin)

**Week 2 exit criteria:** Wrong proof → disputed → manual refund works end-to-end.

### Week 3 — Integrator story & polish

1. README or `docs/INTEGRATION.md`: Merchant vs Consumer flows, sequence diagrams
2. Optional API route grouping for docs
3. Fixed demo script + hide legacy escrow UI
4. Record demo: customer → store → rider → complete + dispute refund path

**Week 3 exit criteria:** Can pitch “middleware skeleton” with one recorded E2E flow.

---

## 7. Demo script (target)

1. **Merchant account:** Register store → see incoming order → Admit → copy delivery link
2. **Customer account:** Pick registered store → Create & pay → wait for `PAID`
3. **Rider:** Open `/deliver?token=...` → upload photo
4. **Happy path:** Order → `COMPLETED`, funds to store
5. **Unhappy path:** Bad photo → `DISPUTED` → resolve refund to customer

**Pitch line:** Real delivery apps keep identity and UX; Tribe is escrow + proof middleware on Arc.

---

## 8. Testing notes

- Requires: `npm run dev`, ngrok → Circle webhooks, USDC on Arc testnet
- Two Supabase auth accounts (customer + store) for full flow
- Store must **Register store** before appearing in customer picker
- Migration must be applied before `/api/stores` works:

  ```bash
  npx supabase db push
  ```

- AI proof pass threshold: `valid === true && confidence === "HIGH"` (see `app/api/orders/proof/route.ts`)

---

## 9. Key files (agent map)

| Area | Path |
|------|------|
| Plan (this file) | `PLAN.md` |
| Setup | `README.md` |
| Stores migration | `supabase/migrations/20260722165000_create_stores_table.sql` |
| Store service / API | `app/services/store.service.ts`, `app/api/stores/route.ts` |
| Order APIs | `app/api/orders/**` |
| Payment / escrow chain | `app/services/order-payment.service.ts` |
| Circle webhooks | `app/api/webhooks/circle/route.ts` |
| Proof + AI | `app/api/orders/proof/route.ts` |
| Customer UI | `components/create-order-card.tsx`, `components/orders-list.tsx` |
| Store register UI | `components/register-store-card.tsx` |
| Dashboard shell | `app/dashboard/page.tsx`, `components/orders-section.tsx` |
| Rider page | `app/deliver/` |

---

## 10. Decisions log

| Date | Decision |
|------|----------|
| 2026-07-20 | Option A: `orders` business layer on top of existing `escrow_agreements` |
| 2026-07-22 | Target Level 3 middleware skeleton for hackathon (~3 weeks) |
| 2026-07-22 | `stores` table for registered merchants; `storeId` on create order |
| 2026-07-22 | UI split by route (customer/store), same API underneath |
| 2026-07-22 | Do not split API URLs yet; enforce rules in domain layer first |
| 2026-07-22 | AI validation: minimal tuning; dispute resolve is higher priority |

---

## 11. When picking up work

1. Read **§5 Current progress** and **§6 Roadmap**
2. Check `git status` for uncommitted work
3. Confirm migration applied if touching stores
4. Prefer smallest diff; match existing patterns in `app/api/orders/` and services
5. Do not commit unless the user asks

**Suggested next task:** Week 1 — split dashboard into `/dashboard/customer` and `/dashboard/store`.
