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

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createOrderService } from "@/app/services/order.service";
import { createOrderPaymentService } from "@/app/services/order-payment.service";
import { getAuthenticatedProfileId } from "@/app/api/orders/_auth";
import type { OrderStatus } from "@/types/orders";

const CANCELLABLE_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "ADMITTED",
];

const REFUNDABLE_STATUSES: OrderStatus[] = ["PAID", "ADMITTED"];

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    const orderService = createOrderService(supabase);
    const paymentService = createOrderPaymentService(supabase);
    const order = await orderService.getOrderById(params.id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isParticipant =
      order.customer_profile_id === auth.profileId ||
      order.store_profile_id === auth.profileId;

    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        {
          error: `Order cannot be cancelled from status ${order.status}. Allowed before IN_DELIVERY.`,
        },
        { status: 409 }
      );
    }

    const needsRefund =
      REFUNDABLE_STATUSES.includes(order.status) && !!order.escrow_agreement_id;

    let refundTransactionId: string | undefined;

    if (needsRefund && order.escrow_agreement_id) {
      refundTransactionId = await paymentService.refundPayment(
        order.escrow_agreement_id,
        "Funds refunded after order cancel"
      );
    }

    const updated = await orderService.updateOrderStatus(
      params.id,
      "CANCELLED"
    );

    return NextResponse.json(
      {
        success: true,
        order: updated,
        refundTransactionId,
        message: needsRefund
          ? "Order cancelled. Escrow refund initiated."
          : "Order cancelled.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: "Failed to cancel order", details: error.message },
      { status: 500 }
    );
  }
}
