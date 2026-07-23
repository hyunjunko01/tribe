# tribe

USDC escrow for delivery orders on [Arc](https://www.arc.network/) testnet. Tribe is **delivery-app middleware**: it locks payment between a **customer** and a **store** until delivery is confirmed. Riders stay off-chain; they submit a delivery photo via a one-time link. AI checks the proof, then completes the order or freezes it for an **admin / arbiter**.

Built with Next.js, Supabase, Circle Developer Controlled Wallets, and OpenAI. Based on Circle’s [arc-escrow](https://github.com/circlefin/arc-escrow) sample.

**Integrator guide:** [docs/INTEGRATION.md](docs/INTEGRATION.md) — Customer vs Store API flows (plus `/api/customer/*` and `/api/store/*` aliases).  
**Roadmap / status:** [PLAN.md](PLAN.md)

## Table of Contents

- [Demo Flow](#demo-flow)
- [Roles](#roles)
- [Demo Routes](#demo-routes)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [API Surface](#api-surface)
- [Environment Variables](#environment-variables)
- [User Accounts](#user-accounts)
- [Security & Usage Model](#security--usage-model)
- [Attribution](#attribution)

## Demo Flow

1. **Store** registers (`POST /api/store/register` or `/api/stores`).
2. **Customer** lists stores, creates an order, and pays USDC into escrow.
3. **Store** admits the paid order and issues a rider delivery link.
4. **Rider** opens `/deliver?token=…` and uploads a photo (no account).
5. **AI** validates the photo.
   - Pass → funds released to the store → `COMPLETED`
   - Fail → order freezes as `DISPUTED`
6. **Admin** resolves disputes (`refund` | `release`) via `/dashboard/admin`.
7. **Cancel** is supported before `IN_DELIVERY` (refunds escrow when already paid).

> On-chain money movement is customer ↔ store. The rider is off-chain. Dispute settlement is admin/arbiter, not the store.

## Roles


| Role                   | Escrow mapping | Responsibility                                        |
| ---------------------- | -------------- | ----------------------------------------------------- |
| Customer               | Depositor      | Creates order, pays into escrow, may cancel early     |
| Store                  | Beneficiary    | Registers, admits, fulfills, receives USDC on success |
| Rider                  | Off-chain      | Delivers and uploads proof via link                   |
| Admin / arbiter        | Arbiter wallet | Resolves `DISPUTED` (`refund` \| `release`)           |


## Demo Routes


| Role     | Path                   |
| -------- | ---------------------- |
| Home     | `/dashboard`           |
| Customer | `/dashboard/customer`  |
| Store    | `/dashboard/store`     |
| Admin    | `/dashboard/admin`     |
| Rider    | `/deliver?token=…`     |


## Tech Stack

- **App:** [Next.js](https://nextjs.org/)
- **Database & auth:** [Supabase](https://supabase.com/)
- **Wallets & escrow txs:** [Circle Developer Controlled Wallets](https://developers.circle.com/wallets/dev-controlled) on Arc testnet
- **Contracts:** EIP-712 Refund Protocol via `@circle-fin/smart-contract-platform`
- **Delivery proof:** [OpenAI](https://platform.openai.com/) vision models
- **Realtime UI:** Supabase Realtime

## Prerequisites

- **Node.js v22+** — Install via [nvm](https://github.com/nvm-sh/nvm)
- **Supabase CLI** — Install via `npm install -g supabase` or see [Supabase CLI docs](https://supabase.com/docs/guides/local-development/cli/getting-started)
- **Docker Desktop** (only if using the local Supabase path) — [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **[ngrok](https://ngrok.com/)** — For local webhook testing
- Circle Developer Controlled Wallets **[API key](https://console.circle.com/signin)** and **[Entity Secret](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)**
- **[OpenAI API key](https://platform.openai.com/api-keys)** — Used for AI delivery-proof validation

## Getting Started

1. Clone the repository and install dependencies:
  ```bash
   git clone git@github.com:hyunjunko01/tribe.git
   cd tribe
   npm install
  ```
2. Set up environment variables:
  ```bash
   cp .env.example .env.local
  ```
   Then edit `.env.local` and fill in all required values (see [Environment Variables](#environment-variables) below). Leave `NEXT_PUBLIC_AGENT_WALLET_ID`, `NEXT_PUBLIC_AGENT_WALLET_ADDRESS`, and `CIRCLE_BLOCKCHAIN` blank — they will be auto-generated in the next step.
3. Generate the agent wallet:
  ```bash
   npm run generate-wallet
  ```
   This creates a Circle developer-controlled wallet (the escrow arbiter) and writes the wallet ID, address, and blockchain values into your `.env.local`.
4. Set up the database — choose one of the two paths below:
  **Path 1: Local Supabase (Docker)**
   Requires Docker Desktop installed and running.
   The output of `npx supabase start` will display the Supabase URL and API keys needed for your `.env.local`.
  **Path 2: Remote Supabase (Cloud)**
   Requires a [Supabase](https://supabase.com/) account and project.
   Retrieve your project URL and API keys from the Supabase dashboard under **Settings → API**. Apply migrations (including `stores` and `orders`) to the remote project.
5. Start the development server:
  ```bash
   npm run dev
  ```
   The app will be available at `http://localhost:3000`.
6. Set up Circle Webhooks (for local development):
  In a separate terminal, expose your local server with ngrok, then configure a webhook in the Circle Console:
  - [Circle Console → Webhooks](https://console.circle.com/webhooks)
  - Endpoint: `https://your-ngrok-url.ngrok.io/api/webhooks/circle`
  - Keep ngrok running while developing to receive webhook events
7. (Optional) Add your `profiles.id` to `ADMIN_PROFILE_IDS` for dispute resolve, then restart the server.

## How It Works

- Each order deploys a Refund Protocol escrow contract on Arc testnet (via Circle Smart Contract Platform).
- Customer deposits USDC with `pay()`; store receives funds with `withdraw()` after successful validation.
- Cancel (when paid) uses `refundByRecipient`; admin dispute refund uses `refundByArbiter`.
- Delivery proof is uploaded off-chain (Supabase Storage); OpenAI validates the image.
- If AI rejects the proof, the order is marked **disputed** until an admin resolves it.
- Circle webhooks update transaction and order status in real time.

## API Surface

Canonical routes live under `/api/orders` and `/api/stores`. Integrators can also use role-prefixed aliases (same handlers):

| Client   | Prefer | Also works |
| -------- | ------ | ---------- |
| Customer | `/api/customer/stores`, `/api/customer/orders/...` | `/api/stores`, `/api/orders/...` |
| Store    | `/api/store/register`, `/api/store/orders/...` | `/api/stores`, `/api/orders/...` |
| Admin    | `/api/admin/orders?status=DISPUTED`, `/api/orders/:id/resolve` | — |
| Rider    | `/api/orders/proof?token=…` | — |

Full request/response details: [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
# Deployment URL
VERCEL_URL=http://localhost:3000
NEXT_PUBLIC_VERCEL_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# USDC Smart Contract
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=

# Agent Wallet (auto-generated by npm run generate-wallet)
NEXT_PUBLIC_AGENT_WALLET_ID=
NEXT_PUBLIC_AGENT_WALLET_ADDRESS=

# Circle
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_BLOCKCHAIN=

# OpenAI
OPENAI_API_KEY=

# Admin / arbiter (comma-separated profiles.id UUIDs)
ADMIN_PROFILE_IDS=
```


| Variable                            | Scope       | Purpose                                                              |
| ----------------------------------- | ----------- | -------------------------------------------------------------------- |
| `VERCEL_URL`                        | Server-side | Base URL of the deployment (e.g., `http://localhost:3000`).          |
| `NEXT_PUBLIC_VERCEL_URL`            | Public      | Public-facing base URL for client-side usage.                        |
| `NEXT_PUBLIC_SUPABASE_URL`          | Public      | Supabase project URL.                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Public      | Supabase anonymous/public key.                                       |
| `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` | Public      | USDC token contract address on the target blockchain.                |
| `NEXT_PUBLIC_AGENT_WALLET_ID`       | Public      | Circle wallet ID for the escrow agent/arbiter. Auto-generated.       |
| `NEXT_PUBLIC_AGENT_WALLET_ADDRESS`  | Public      | Wallet address for the escrow agent/arbiter. Auto-generated.         |
| `CIRCLE_API_KEY`                    | Server-side | Circle API key for wallet and contract operations.                   |
| `CIRCLE_ENTITY_SECRET`              | Server-side | Circle entity secret for signing transactions.                       |
| `CIRCLE_BLOCKCHAIN`                 | Server-side | Blockchain network identifier (e.g., `ARC-TESTNET`). Auto-generated. |
| `OPENAI_API_KEY`                    | Server-side | OpenAI API key for AI delivery-proof validation.                     |
| `ADMIN_PROFILE_IDS`                 | Server-side | Comma-separated `profiles.id` UUIDs allowed to resolve disputes.     |


**Do not commit** `.env.local`, API keys, entity secrets, or Circle recovery files.

## User Accounts

### Default Account

On first visit, sign up with any email and password. During development, the same user can act as customer (depositor) or store (beneficiary) across different orders.

To act as **admin / arbiter**, put that account’s `profiles.id` in `ADMIN_PROFILE_IDS` (comma-separated if multiple), restart the server, then open `/dashboard/admin`.

### Signup Rate Limits

Supabase limits email signups to **2 per hour** by default (unless custom SMTP is configured). If you hit an "email rate limit exceeded" error during testing:

- **Local Supabase (Docker):** Email verification is handled by the built-in [Inbucket](http://127.0.0.1:54324) mail server — check it to confirm signups. The rate limit can be adjusted in `supabase/config.toml` under `[auth.rate_limit]`.
- **Remote Supabase (Cloud):** Use real email addresses (disposable emails may fail verification). If you hit the limit, you can manually add users via the Supabase dashboard under **Authentication → Users**.

## Security & Usage Model

This project:

- Targets **Arc testnet** only for the hackathon MVP
- Stores secrets in environment variables (never in the repo)
- Verifies Circle webhook signatures
- Is **not** production-ready without further hardening (API keys, multi-tenant isolation = Level 4 / out of scope)

## Attribution

Tribe builds on Circle’s open-source escrow sample:

- [arc-escrow](https://github.com/circlefin/arc-escrow)

Licensed under the Apache License, Version 2.0 where applicable for upstream code.
