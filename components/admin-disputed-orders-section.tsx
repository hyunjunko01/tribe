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

import { useAdminOrders } from "@/app/hooks/useAdminOrders";
import { OrdersList } from "@/components/orders-list";

interface AdminDisputedOrdersSectionProps {
  profileId: string;
}

export function AdminDisputedOrdersSection({
  profileId,
}: AdminDisputedOrdersSectionProps) {
  const { orders, loading, error, refresh } = useAdminOrders();

  return (
    <div className="break-inside-avoid mb-4">
      <OrdersList
        profileId={profileId}
        viewRole="admin"
        orders={orders}
        loading={loading}
        error={error}
        onRefresh={() => refresh(false)}
      />
    </div>
  );
}
