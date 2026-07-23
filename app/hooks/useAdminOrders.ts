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

import { useCallback, useEffect, useState } from "react";
import type { OrderWithProfiles } from "@/app/services/order.service";

const DISPUTED_POLL_MS = 5000;

export function useAdminOrders() {
  const [orders, setOrders] = useState<OrderWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch("/api/admin/orders?status=DISPUTED");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to load orders");
      }

      setOrders(data.orders ?? []);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load orders";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (orders.length === 0) return;

    const id = window.setInterval(() => {
      refresh(false);
    }, DISPUTED_POLL_MS);

    return () => window.clearInterval(id);
  }, [orders.length, refresh]);

  return { orders, loading, error, refresh };
}
