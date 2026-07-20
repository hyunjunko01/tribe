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
import { createOrderPaymentService } from "@/app/services/order-payment.service";
import { getAuthenticatedProfileId } from "@/app/api/orders/_auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    const paymentService = createOrderPaymentService(supabase);
    const result = await paymentService.initiateOrderPayment(
      params.id,
      auth.profileId
    );

    return NextResponse.json(
      {
        success: true,
        order: result.order,
        escrowAgreementId: result.escrowAgreementId,
        deployTransactionId: result.deployTransactionId,
        contractId: result.contractId,
        message: "Order payment initiated. Escrow deploy in progress.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error initiating order payment:", error);

    const message = error.message ?? "Unknown error";
    const status =
      message.includes("not found") ? 404
      : message.includes("Only the customer") ||
          message.includes("cannot be paid") ||
          message.includes("already has an escrow")
        ? 409
      : message.includes("wallet not found") ? 422
      : 500;

    return NextResponse.json(
      { error: "Failed to initiate order payment", details: message },
      { status }
    );
  }
}
