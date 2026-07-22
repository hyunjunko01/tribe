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
import { getAuthenticatedProfileId } from "@/app/api/orders/_auth";
import { createStoreService } from "@/app/services/store.service";
import type { StorePublic } from "@/types/stores";

interface RegisterStoreRequest {
  name: string;
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    const storeService = createStoreService(supabase);
    const stores = await storeService.listActiveStores();

    const publicStores: StorePublic[] = stores.map((store) => ({
      id: store.id,
      name: store.name,
    }));

    return NextResponse.json({ success: true, stores: publicStores }, { status: 200 });
  } catch (error: any) {
    console.error("Error listing stores:", error);
    return NextResponse.json(
      { error: "Failed to list stores", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const auth = await getAuthenticatedProfileId(supabase);
    if ("error" in auth) return auth.error;

    const body: RegisterStoreRequest = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const storeService = createStoreService(supabase);
    const store = await storeService.registerStore({
      profileId: auth.profileId,
      name: body.name.trim(),
    });

    return NextResponse.json({ success: true, store }, { status: 201 });
  } catch (error: any) {
    console.error("Error registering store:", error);

    const message = error.message ?? "Unknown error";
    const status =
      message.includes("already registered") ? 409
      : message.includes("wallet") ? 422
      : 500;

    return NextResponse.json(
      { error: "Failed to register store", details: message },
      { status }
    );
  }
}
