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
import type { OrderItem } from "@/types/orders";

interface CreateOrderRequest {
  storeProfileId: string;
  amount: number;
  deliveryAddress: string;
  items?: OrderItem[];
  currency?: string;
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    const orderService = createOrderService(supabase);
    const orders = await orderService.listOrdersForProfile(auth.profileId);

    return NextResponse.json({ success: true, orders }, { status: 200 });
  } catch (error: any) {
    console.error("Error listing orders:", error);
    return NextResponse.json(
      { error: "Failed to list orders", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    const body: CreateOrderRequest = await req.json();

    if (
      !body.storeProfileId ||
      body.amount == null ||
      !body.deliveryAddress
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: storeProfileId, amount, deliveryAddress",
        },
        { status: 400 }
      );
    }

    if (typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    if (body.storeProfileId === auth.profileId) {
      return NextResponse.json(
        { error: "Customer and store must be different profiles" },
        { status: 400 }
      );
    }

    const { data: storeProfile, error: storeError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.storeProfileId)
      .maybeSingle();

    if (storeError || !storeProfile) {
      return NextResponse.json(
        { error: "Store profile not found" },
        { status: 404 }
      );
    }

    const orderService = createOrderService(supabase);
    const order = await orderService.createOrder({
      customerProfileId: auth.profileId,
      storeProfileId: body.storeProfileId,
      amount: body.amount,
      deliveryAddress: body.deliveryAddress,
      items: body.items,
      currency: body.currency,
    });

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order", details: error.message },
      { status: 500 }
    );
  }
}
