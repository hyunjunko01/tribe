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

import { createSupabaseServerComponentClient } from "@/lib/supabase/server-client";
import type { Wallet } from "@/types/database.types";
import { redirect } from "next/navigation";

export interface DashboardSession {
  user: { id: string };
  profile: { id: string };
  wallet: Wallet;
}

export async function getDashboardSession(): Promise<DashboardSession> {
  const supabase = createSupabaseServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile?.id) {
    redirect("/sign-in?error=Profile%20not%20found.");
  }

  const { data: wallet } = await supabase
    .schema("public")
    .from("wallets")
    .select()
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!wallet?.circle_wallet_id) {
    redirect(
      "/sign-in?error=Wallet%20not%20found.%20Please%20sign%20in%20again%20to%20create%20one."
    );
  }

  return { user, profile, wallet };
}
