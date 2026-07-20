-- Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-- SPDX-License-Identifier: Apache-2.0

-- Orders table: business layer on top of escrow_agreements
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    customer_profile_id UUID NOT NULL REFERENCES profiles(id),
    store_profile_id UUID NOT NULL REFERENCES profiles(id),
    escrow_agreement_id UUID UNIQUE REFERENCES escrow_agreements(id),
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR NOT NULL DEFAULT 'USDC',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    delivery_address TEXT NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'PENDING_PAYMENT',
    delivery_token VARCHAR NULL,
    delivery_proof_url TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX idx_orders_customer_profile_id ON orders(customer_profile_id);
CREATE INDEX idx_orders_store_profile_id ON orders(store_profile_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_delivery_token ON orders(delivery_token);

-- updated_at trigger (reuses existing function)
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS disabled for hackathon MVP (matches other tables)
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE orders IS 'Delivery orders; RLS disabled for hackathon MVP.';

GRANT ALL ON orders TO authenticated;
GRANT ALL ON orders TO service_role;
