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
import {
  Order,
  OrderInsert,
  OrderItem,
  OrderStatus,
  OrderUpdate,
} from "@/types/orders";

const ORDER_SELECT = `
  *,
  customer_profile:profiles!orders_customer_profile_id_fkey (
    id,
    name,
    auth_user_id
  ),
  store_profile:profiles!orders_store_profile_id_fkey (
    id,
    name,
    auth_user_id
  )
`;

export type OrderWithProfiles = Order & {
  customer_profile?: {
    id: string;
    name: string;
    auth_user_id: string;
  };
  store_profile?: {
    id: string;
    name: string;
    auth_user_id: string;
  };
};

export const createOrderService = (supabase: SupabaseClient) => {
  const updateOrder = async (
    orderId: string,
    updates: OrderUpdate
  ): Promise<Order> => {
    const { data, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update order: ${error.message}`);
    }

    return data as Order;
  };

  return {
    async createOrder(params: {
      customerProfileId: string;
      storeProfileId: string;
      amount: number;
      deliveryAddress: string;
      items?: OrderItem[];
      currency?: string;
    }): Promise<Order> {
      const payload: OrderInsert = {
        customer_profile_id: params.customerProfileId,
        store_profile_id: params.storeProfileId,
        amount: params.amount,
        delivery_address: params.deliveryAddress,
        items: params.items ?? [],
        currency: params.currency ?? "USDC",
        status: "PENDING_PAYMENT",
      };

      const { data: order, error } = await supabase
        .from("orders")
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create order: ${error.message}`);
      }

      return order as Order;
    },

    async getOrderById(orderId: string): Promise<OrderWithProfiles | null> {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch order: ${error.message}`);
      }

      return data as OrderWithProfiles | null;
    },

    async listOrdersForProfile(
      profileId: string
    ): Promise<OrderWithProfiles[]> {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .or(
          `customer_profile_id.eq.${profileId},store_profile_id.eq.${profileId}`
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to list orders: ${error.message}`);
      }

      return (data as OrderWithProfiles[]) || [];
    },

    updateOrder,

    async updateOrderStatus(
      orderId: string,
      status: OrderStatus
    ): Promise<Order> {
      return updateOrder(orderId, { status });
    },

    async linkEscrowAgreement(
      orderId: string,
      escrowAgreementId: string
    ): Promise<Order> {
      return updateOrder(orderId, { escrow_agreement_id: escrowAgreementId });
    },

    async getOrderByDeliveryToken(
      token: string
    ): Promise<OrderWithProfiles | null> {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("delivery_token", token)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch order by delivery token: ${error.message}`);
      }

      return data as OrderWithProfiles | null;
    },

    async startDelivery(orderId: string, token: string): Promise<Order> {
      return updateOrder(orderId, {
        status: "IN_DELIVERY",
        delivery_token: token,
      });
    },
  };
};