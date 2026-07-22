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

"use client";

import { useOrders } from "@/app/hooks/useOrders";
import { CreateOrderCard } from "@/components/create-order-card";
import { OrdersList } from "@/components/orders-list";
import { RegisterStoreCard } from "@/components/register-store-card";

export type DashboardOrderRole = "customer" | "store";

interface OrdersSectionProps {
  profileId: string;
  role: DashboardOrderRole;
  children: React.ReactNode;
}

export function OrdersSection({ profileId, role, children }: OrdersSectionProps) {
  const { orders, loading, error, refresh } = useOrders();

  const filteredOrders = orders.filter((order) =>
    role === "customer"
      ? order.customer_profile_id === profileId
      : order.store_profile_id === profileId
  );

  return (
    <>
      <div className="flex flex-wrap gap-4 mb-4">
        {children}
        {role === "customer" && (
          <div className="break-inside-avoid w-[calc(50%-0.5rem)] flex">
            <CreateOrderCard onCreated={() => refresh(true)} />
          </div>
        )}
      </div>

      {role === "store" && (
        <div className="break-inside-avoid mb-4 max-w-md">
          <RegisterStoreCard />
        </div>
      )}

      <div className="break-inside-avoid mb-4">
        <OrdersList
          profileId={profileId}
          viewRole={role}
          orders={filteredOrders}
          loading={loading}
          error={error}
          onRefresh={() => refresh(false)}
        />
      </div>
    </>
  );
}
