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
import { isAdminProfileId } from "@/lib/admin";
import type { OrderStatus } from "@/types/orders";

const ALLOWED_STATUSES: OrderStatus[] = ["DISPUTED"];

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    if (!isAdminProfileId(auth.profileId)) {
      return NextResponse.json(
        { error: "Only an admin arbiter can list admin orders" },
        { status: 403 }
      );
    }

    const statusParam = req.nextUrl.searchParams.get("status") ?? "DISPUTED";

    if (!ALLOWED_STATUSES.includes(statusParam as OrderStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const orderService = createOrderService(supabase);
    const orders = await orderService.listOrdersByStatus(
      statusParam as OrderStatus
    );

    return NextResponse.json({ success: true, orders }, { status: 200 });
  } catch (error: any) {
    console.error("Error listing admin orders:", error);
    return NextResponse.json(
      { error: "Failed to list admin orders", details: error.message },
      { status: 500 }
    );
  }
}
