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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestUsdcButton } from "@/components/request-usdc-button";
import { USDCButton } from "@/components/usdc-button";
import { WalletBalance } from "@/components/wallet-balance";
import { WalletInformationDialog } from "@/components/wallet-information-dialog";
import type { Wallet } from "@/types/database.types";

interface DashboardWalletCardProps {
  wallet: Wallet;
  className?: string;
}

export function DashboardWalletCard({ wallet, className }: DashboardWalletCardProps) {
  return (
    <Card className={className ?? "break-inside-avoid w-[calc(50%-0.5rem)]"}>
      <CardHeader className="flex-row items-center space-between">
        <CardTitle>Account balance</CardTitle>
        <WalletInformationDialog wallet={wallet} />
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-6">
          <div className="flex flex-col space-y-1.5">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
              <WalletBalance walletId={wallet.circle_wallet_id} />
            </h1>
          </div>
          <div className="flex gap-2">
            <USDCButton className="flex-1" mode="BUY" walletAddress={wallet.wallet_address} />
            <USDCButton className="flex-1" mode="SELL" walletAddress={wallet.wallet_address} />
            {process.env.NODE_ENV === "development" && (
              <RequestUsdcButton walletAddress={wallet.wallet_address} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
