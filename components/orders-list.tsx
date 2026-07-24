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

import { useState } from "react";
import { toast } from "sonner";
import type { OrderWithProfiles } from "@/app/services/order.service";
import type { OrderStatus } from "@/types/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type OrderListViewRole = "customer" | "store" | "admin";

interface OrdersListProps {
  profileId: string;
  viewRole: OrderListViewRole;
  orders: OrderWithProfiles[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "ADMITTED"];

function statusVariant(
  status: OrderStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "DISPUTED":
    case "CANCELLED":
      return "destructive";
    case "PENDING_PAYMENT":
      return "outline";
    default:
      return "secondary";
  }
}

function formatAmount(amount: number, currency: string) {
  return `${Number(amount).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} ${currency}`;
}

function orderPartiesLabel(
  order: OrderWithProfiles,
  profileId: string,
  viewRole: OrderListViewRole
) {
  if (viewRole === "admin") {
    const customer = order.customer_profile?.name || "Customer";
    const store = order.store_profile?.name || "Store";
    return `${customer} → ${store}`;
  }

  if (order.customer_profile_id === profileId) {
    return order.store_profile?.name || "Store";
  }
  return order.customer_profile?.name || "Customer";
}

function nextStepHint(
  order: OrderWithProfiles,
  viewRole: OrderListViewRole
): string | null {
  if (viewRole === "customer") {
    switch (order.status) {
      case "PENDING_PAYMENT":
        return "Next: pay into escrow";
      case "PAID":
        return "Waiting for the store to admit";
      case "ADMITTED":
      case "IN_DELIVERY":
        return "Waiting for delivery proof";
      case "DISPUTED":
        return "Waiting for admin to resolve";
      case "COMPLETED":
        return "Settled — funds released to store";
      case "CANCELLED":
        return "Order cancelled";
      default:
        return null;
    }
  }

  if (viewRole === "store") {
    switch (order.status) {
      case "PAID":
        return "Next: admit this order";
      case "ADMITTED":
        return "Next: create a delivery link for the rider";
      case "IN_DELIVERY":
        return order.delivery_proof_url
          ? "Proof submitted — waiting for AI check"
          : "Waiting for rider photo upload";
      case "DISPUTED":
        return "View only — admin resolves refund or release";
      case "COMPLETED":
        return "Settled — funds released";
      case "CANCELLED":
        return "Order cancelled";
      default:
        return null;
    }
  }

  if (viewRole === "admin" && order.status === "DISPUTED") {
    return "Next: refund customer or release to store";
  }

  return null;
}

export function OrdersList({
  profileId,
  viewRole,
  orders,
  loading,
  error,
  onRefresh,
}: OrdersListProps) {
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const runAction = async (
    orderId: string,
    action: () => Promise<void>,
    successMessage: string
  ) => {
    setBusyOrderId(orderId);
    try {
      await action();
      toast.success(successMessage);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyOrderId(null);
    }
  };

  const payOrder = (orderId: string) =>
    runAction(
      orderId,
      async () => {
        const res = await fetch(`/api/orders/${orderId}/pay`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.details || data.error || "Payment failed");
        }
      },
      "Payment started"
    );

  const admitOrder = (orderId: string) =>
    runAction(
      orderId,
      async () => {
        const res = await fetch(`/api/orders/${orderId}/admit`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.details || "Admit failed");
        }
      },
      "Order admitted"
    );

  const cancelOrder = (orderId: string) =>
    runAction(
      orderId,
      async () => {
        const res = await fetch(`/api/orders/${orderId}/cancel`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.details || "Cancel failed");
        }
      },
      "Order cancelled"
    );

  const createDeliveryLink = (orderId: string) =>
    runAction(
      orderId,
      async () => {
        const res = await fetch(`/api/orders/${orderId}/delivery-link`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error || data.details || "Failed to create delivery link"
          );
        }

        const uploadUrl = data.uploadUrl as string;
        if (uploadUrl && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(uploadUrl);
          toast.info("Delivery link copied to clipboard");
        } else if (uploadUrl) {
          toast.info(uploadUrl);
        }
      },
      "Delivery link ready"
    );

  const resolveDispute = (orderId: string, action: "refund" | "release") =>
    runAction(
      orderId,
      async () => {
        const res = await fetch(`/api/orders/${orderId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.details || "Resolve failed");
        }
      },
      action === "refund"
        ? "Dispute resolved — refund started"
        : "Dispute resolved — release started"
    );

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>
          {viewRole === "admin" ? "Disputed orders" : "Orders"}
        </CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRefresh()}
          disabled={loading}
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading && orders.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {viewRole === "customer"
              ? "No orders yet. Create one to start the escrow flow."
              : viewRole === "admin"
                ? "No disputed orders right now."
                : "No incoming orders yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const busy = busyOrderId === order.id;
              const canCancel = CANCELLABLE.includes(order.status);
              const canIssueLink =
                viewRole === "store" &&
                (order.status === "ADMITTED" ||
                  (order.status === "IN_DELIVERY" && !order.delivery_proof_url));
              const hint = nextStepHint(order, viewRole);

              return (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={statusVariant(order.status)}
                        className="font-mono text-[11px] tracking-wide"
                      >
                        {order.status}
                      </Badge>
                    </div>
                    <p className="truncate text-sm font-medium">
                      {formatAmount(order.amount, order.currency)} ·{" "}
                      {orderPartiesLabel(order, profileId, viewRole)}
                    </p>
                    {hint && (
                      <p className="text-xs font-medium text-foreground/80">
                        {hint}
                      </p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {order.delivery_address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {viewRole === "customer" &&
                      order.status === "PENDING_PAYMENT" && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => payOrder(order.id)}
                        >
                          Pay
                        </Button>
                      )}
                    {viewRole === "store" && order.status === "PAID" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => admitOrder(order.id)}
                      >
                        Admit
                      </Button>
                    )}
                    {canIssueLink && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => createDeliveryLink(order.id)}
                      >
                        Delivery link
                      </Button>
                    )}
                    {viewRole === "admin" && order.status === "DISPUTED" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => resolveDispute(order.id, "refund")}
                        >
                          Refund customer
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => resolveDispute(order.id, "release")}
                        >
                          Release to store
                        </Button>
                      </>
                    )}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => cancelOrder(order.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
