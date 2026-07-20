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

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "ADMITTED"
  | "IN_DELIVERY"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED";

export interface OrderItem {
  name: string;
  quantity: number;
  unit_price?: string;
  notes?: string;
}

export interface Order {
  id: string;
  customer_profile_id: string;
  store_profile_id: string;
  escrow_agreement_id: string | null;
  amount: number;
  currency: string;
  items: OrderItem[];
  delivery_address: string;
  status: OrderStatus;
  delivery_token: string | null;
  delivery_proof_url: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderInsert = Omit<
  Order,
  | "id"
  | "created_at"
  | "updated_at"
  | "escrow_agreement_id"
  | "status"
  | "delivery_token"
  | "delivery_proof_url"
  | "currency"
> & {
  escrow_agreement_id?: string | null;
  status?: OrderStatus;
  delivery_token?: string | null;
  delivery_proof_url?: string | null;
  currency?: string;
};

export type OrderUpdate = Partial<
  Omit<Order, "id" | "created_at" | "updated_at">
>;
