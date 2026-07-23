/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Zap,
  CheckCircle,
  Wallet,
  ShoppingBag,
  Bike,
  Lock,
  Scale,
} from "lucide-react";

const LandingPage = () => {
  return (
    <div className="flex flex-col items-center w-full px-5">
      <section className="w-full max-w-6xl space-y-16 py-8">
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Shield className="w-8 h-8 text-blue-500" />
              <Zap className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-amber-600 leading-tight">
              Tribe
            </p>
            <p className="mt-4 text-xl md:text-2xl text-center text-muted-foreground max-w-2xl mx-auto">
              Delivery escrow middleware on Arc — USDC lock, proof, and settlement
              for customer and store clients.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>USDC on Arc testnet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>AI delivery proof</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Arbiter dispute resolve</span>
            </div>
          </div>
        </div>

        <section className="w-full space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            Built for delivery platforms
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<ShoppingBag className="w-8 h-8 text-blue-500" />}
              title="Customer & store APIs"
              description="Integrators keep identity and UX. Tribe owns pay, admit, cancel, and settle."
            />
            <FeatureCard
              icon={<Lock className="w-8 h-8 text-green-500" />}
              title="Escrow until delivery"
              description="Customer USDC stays locked until proof passes or an arbiter decides."
            />
            <FeatureCard
              icon={<Wallet className="w-8 h-8 text-amber-500" />}
              title="Release or refund"
              description="Happy path releases to the store; disputes refund or release via admin."
            />
          </div>
        </section>
      </section>

      <section className="w-full bg-gradient-to-b from-background to-muted/50 py-16">
        <div className="max-w-5xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start px-5">
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-100 dark:bg-blue-900/50 rounded-full p-4 mb-4">
                <ShoppingBag className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Create & pay</h3>
              <p className="text-sm text-muted-foreground">
                Customer picks a registered store and pays USDC into escrow.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="bg-green-100 dark:bg-green-900/50 rounded-full p-4 mb-4">
                <Bike className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Deliver & prove</h3>
              <p className="text-sm text-muted-foreground">
                Store admits, issues a rider link; rider uploads a photo — no account.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="bg-yellow-100 dark:bg-yellow-900/50 rounded-full p-4 mb-4">
                <CheckCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI checks proof</h3>
              <p className="text-sm text-muted-foreground">
                Pass releases funds to the store; fail freezes the order as disputed.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="bg-purple-100 dark:bg-purple-900/50 rounded-full p-4 mb-4">
                <Scale className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Arbiter settles</h3>
              <p className="text-sm text-muted-foreground">
                Admin refunds the customer or releases to the store when needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full max-w-5xl py-16 space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold">
            Try the middleware demo
          </h2>
          <p className="text-lg text-muted-foreground">
            Sign up, open customer or store dashboards, and run an order end to end.
          </p>
        </div>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link href="/sign-up">
            <Button size="lg">Get started</Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      <footer className="w-full border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-5 text-center text-sm text-muted-foreground">
          Tribe — delivery escrow middleware. Built on Circle’s arc-escrow sample.
        </div>
      </footer>
    </div>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
}) => {
  return (
    <div className="bg-card p-6 rounded-lg border border-border">
      <div className="flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-center mb-2">{title}</h3>
      <p className="text-muted-foreground text-center">{description}</p>
    </div>
  );
};

export default LandingPage;
