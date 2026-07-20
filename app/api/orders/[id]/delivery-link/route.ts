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

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createOrderService } from "@/app/services/order.service";
import { getAuthenticatedProfileId } from "@/app/api/orders/_auth";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000"
  );
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    const orderService = createOrderService(supabase);
    const order = await orderService.getOrderById(params.id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.store_profile_id !== auth.profileId) {
      return NextResponse.json(
        { error: "Only the store can create a delivery link" },
        { status: 403 }
      );
    }

    const canIssue =
      order.status === "ADMITTED" ||
      (order.status === "IN_DELIVERY" && !order.delivery_proof_url);

    if (!canIssue) {
      return NextResponse.json(
        {
          error: `Delivery link cannot be created from status ${order.status}. Expected ADMITTED (or IN_DELIVERY without proof).`,
        },
        { status: 409 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const updated = await orderService.startDelivery(params.id, token);
    const baseUrl = getBaseUrl().replace(/\/$/, "");
    const uploadUrl = `${baseUrl}/api/orders/proof?token=${token}`;

    return NextResponse.json(
      {
        success: true,
        order: updated,
        token,
        uploadUrl,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating delivery link:", error);
    return NextResponse.json(
      { error: "Failed to create delivery link", details: error.message },
      { status: 500 }
    );
  }
}
