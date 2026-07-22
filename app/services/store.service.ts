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

import { SupabaseClient } from "@supabase/supabase-js";
import type { Store, StoreInsert } from "@/types/stores";

export type StoreWithProfile = Store & {
  profile?: {
    id: string;
    name: string;
    email?: string | null;
  };
};

export const createStoreService = (supabase: SupabaseClient) => {
  const getStoreByProfileId = async (profileId: string): Promise<Store | null> => {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch store by profile: ${error.message}`);
    }

    return data as Store | null;
  };

  return {
    async listActiveStores(): Promise<StoreWithProfile[]> {
      const { data, error } = await supabase
        .from("stores")
        .select(
          `
          *,
          profile:profiles!stores_profile_id_fkey (
            id,
            name,
            email,
            wallets ( id )
          )
        `
        )
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        throw new Error(`Failed to list stores: ${error.message}`);
      }

      return (data ?? [])
        .filter((row) => {
          const profile = row.profile as {
            wallets?: Array<{ id: string }>;
          } | null;
          return profile?.wallets && profile.wallets.length > 0;
        })
        .map((row) => {
          const { profile, ...store } = row;
          return { ...store, profile } as StoreWithProfile;
        });
    },

    async getActiveStoreById(storeId: string): Promise<Store | null> {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch store: ${error.message}`);
      }

      return data as Store | null;
    },

    async getActiveStoreByProfileId(profileId: string): Promise<Store | null> {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch store by profile: ${error.message}`);
      }

      return data as Store | null;
    },

    getStoreByProfileId,

    async registerStore(params: {
      profileId: string;
      name: string;
    }): Promise<Store> {
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("id")
        .eq("profile_id", params.profileId)
        .maybeSingle();

      if (walletError) {
        throw new Error(`Failed to verify store wallet: ${walletError.message}`);
      }

      if (!wallet) {
        throw new Error("Store profile must have a wallet before registration");
      }

      const existing = await getStoreByProfileId(params.profileId);
      if (existing) {
        throw new Error("This profile is already registered as a store");
      }

      const payload: StoreInsert = {
        profile_id: params.profileId,
        name: params.name.trim(),
      };

      const { data, error } = await supabase
        .from("stores")
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to register store: ${error.message}`);
      }

      return data as Store;
    },
  };
};
