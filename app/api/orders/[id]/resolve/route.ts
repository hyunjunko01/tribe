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
import { isAdminProfileId } from "@/lib/admin";

type ResolveAction = "refund" | "release";

function isResolveAction(value: unknown): value is ResolveAction {
  return value === "refund" || value === "release";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    if (!isAdminProfileId(auth.profileId)) {
      return NextResponse.json(
        { error: "Only an admin arbiter can resolve a disputed order" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (!isResolveAction(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Expected "refund" or "release".' },
        { status: 400 }
      );
    }

    const orderService = createOrderService(supabase);
    const paymentService = createOrderPaymentService(supabase);
    const order = await orderService.getOrderById(params.id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "DISPUTED") {
      return NextResponse.json(
        {
          error: `Order cannot be resolved from status ${order.status}. Expected DISPUTED.`,
        },
        { status: 409 }
      );
    }

    if (!order.escrow_agreement_id) {
      return NextResponse.json(
        { error: "Order has no escrow agreement to resolve" },
        { status: 409 }
      );
    }

    if (action === "refund") {
      const refundTransactionId = await paymentService.refundPaymentByArbiter(
        order.escrow_agreement_id,
        "Funds refunded after dispute resolve by arbiter"
      );

      const updated = await orderService.updateOrderStatus(
        params.id,
        "CANCELLED"
      );

      return NextResponse.json(
        {
          success: true,
          action,
          order: updated,
          refundTransactionId,
          message: "Dispute resolved with arbiter refund to customer.",
        },
        { status: 200 }
      );
    }

    const releaseTransactionId = await paymentService.releasePayment(
      order.escrow_agreement_id,
      "Funds released after dispute resolve by arbiter"
    );

    const updatedOrder = await orderService.getOrderById(params.id);

    return NextResponse.json(
      {
        success: true,
        action,
        order: updatedOrder,
        releaseTransactionId,
        message:
          "Dispute resolved with release to store. Order will complete when the release transaction confirms.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error resolving disputed order:", error);
    return NextResponse.json(
      { error: "Failed to resolve disputed order", details: error.message },
      { status: 500 }
    );
  }
}
