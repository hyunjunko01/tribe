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
import { getAuthenticatedProfileId } from "@/app/api/orders/_auth";

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
        { error: "Only the store can admit this order" },
        { status: 403 }
      );
    }

    if (order.status !== "PAID") {
      return NextResponse.json(
        {
          error: `Order cannot be admitted from status ${order.status}. Expected PAID.`,
        },
        { status: 409 }
      );
    }

    const updated = await orderService.updateOrderStatus(
      params.id,
      "ADMITTED"
    );

    return NextResponse.json(
      { success: true, order: updated },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error admitting order:", error);
    return NextResponse.json(
      { error: "Failed to admit order", details: error.message },
      { status: 500 }
    );
  }
}
