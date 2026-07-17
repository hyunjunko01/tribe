# Tribe

USDC escrow for delivery orders on [Arc](https://www.arc.network/) testnet. Tribe locks payment between a **customer** and a **store** until delivery is confirmed. Riders stay off-chain (existing web2 tools); they submit a delivery photo via a one-time link. An AI agent checks the proof, then completes or freezes the order for human review.

Built with Next.js, Supabase, Circle Developer Controlled Wallets, and OpenAI. Based on Circle’s [Workflow Escrow Refund Protocol](https://github.com/akelani-circle/workflow-escrow-refund-protocol) sample.

## Table of Contents

- [MVP Flow](#mvp-flow)
- [Roles](#roles)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Environment Variables](#environment-variables)
- [User Accounts](#user-accounts)
- [Security & Usage Model](#security--usage-model)
- [Attribution](#attribution)

## MVP Flow

1. **Customer creates an order** and pays USDC into escrow right away.
2. **Store admits** the paid order (or the order can be cancelled / timed out and refunded).
3. Store prepares the order and calls a rider with existing web2 methods.
4. **Rider uploads delivery evidence** (photo) via a secure link — no full rider account required.
5. **AI validates** the photo.
  - Pass → `completeOrder` → funds released to the store (`withdraw`).
  - Fail → order status freezes as **disputed**; a human arbiter resolves it (complete or refund).
6. **Cancel** is supported before delivery starts (e.g. customer cancels before store admits, or store cannot fulfill).

> On-chain money movement is customer ↔ store only. The rider is an off-chain participant in the MVP.

## Roles


| Role                   | Escrow mapping | Responsibility                                        |
| ---------------------- | -------------- | ----------------------------------------------------- |
| Customer               | Depositor      | Creates order, pays into escrow, may cancel early     |
| Store                  | Beneficiary    | Admits order, fulfills, receives USDC on success      |
| Rider                  | Off-chain      | Delivers and uploads proof via link                   |
| Arbiter (agent wallet) | Arbiter        | Deploys escrow contracts; refunds / resolves disputes |


## Tech Stack

- **App:** [Next.js](https://nextjs.org/)
- **Database & auth:** [Supabase](https://supabase.com/)
- **Wallets & escrow txs:** [Circle Developer Controlled Wallets](https://developers.circle.com/wallets/dev-controlled) on Arc testnet
- **Contracts:** EIP-712 Refund Protocol via `@circle-fin/smart-contract-platform`
- **Delivery proof:** [OpenAI](https://platform.openai.com/) vision models
- **Realtime UI:** Supabase Realtime

## Prerequisites

- **Node.js v22+** — Install via [nvm](https://github.com/nvm-sh/nvm)
- **Supabase CLI** — Install via `npm install -g supabase` or see [Supabase CLI docs](https://supabase.com/guides/cli/getting-started)
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
   Retrieve your project URL and API keys from the Supabase dashboard under **Settings → API**.
5. Start the development server:
  ```bash
   npm run dev
  ```
   The app will be available at `http://localhost:3000`.
6. Set up Circle Webhooks (for local development):
  In a separate terminal, expose your local server:
   Copy the HTTPS URL from ngrok and configure a webhook in the Circle Console:
  - Navigate to [Circle Console → Webhooks](https://console.circle.com/webhooks)
  - Add a new webhook endpoint: `https://your-ngrok-url.ngrok.io/api/webhooks/circle`
  - Keep ngrok running while developing to receive webhook events

## How It Works

- Each order can deploy a Refund Protocol escrow contract on Arc testnet (via Circle Smart Contract Platform).
- Customer deposits USDC with `pay()`; store receives funds with `withdraw()` after successful validation.
- Refunds / dispute resolution use arbiter or recipient refund functions on the same contract.
- Delivery proof is uploaded off-chain (Supabase Storage); OpenAI validates the image.
- If AI rejects the proof, the order is marked **disputed** (funds stay in escrow) until a human decides.
- Circle webhooks update transaction and order status in real time.

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


**Do not commit** `.env.local`, API keys, entity secrets, or Circle recovery files.

## User Accounts

### Default Account

On first visit, sign up with any email and password. During development, the same user can act as customer (depositor) or store (beneficiary) across different orders.

### Signup Rate Limits

Supabase limits email signups to **2 per hour** by default (unless custom SMTP is configured). If you hit an "email rate limit exceeded" error during testing:

- **Local Supabase (Docker):** Email verification is handled by the built-in [Inbucket](http://127.0.0.1:54324) mail server — check it to confirm signups. The rate limit can be adjusted in `supabase/config.toml` under `[auth.rate_limit]`.
- **Remote Supabase (Cloud):** Use real email addresses (disposable emails may fail verification). If you hit the limit, you can manually add users via the Supabase dashboard under **Authentication → Users**.

## Security & Usage Model

This project:

- Targets **Arc testnet** only for the hackathon MVP
- Stores secrets in environment variables (never in the repo)
- Verifies Circle webhook signatures
- Is **not** production-ready without further hardening

## Attribution

Tribe builds on Circle’s open-source escrow sample:

- [workflow-escrow-refund-protocol](https://github.com/akelani-circle/workflow-escrow-refund-protocol)

Licensed under the Apache License, Version 2.0 where applicable for upstream code.