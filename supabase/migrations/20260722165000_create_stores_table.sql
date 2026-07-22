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

-- Registered merchants that can receive orders
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id),
    name VARCHAR NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stores_profile_id ON stores(profile_id);
CREATE INDEX idx_stores_is_active ON stores(is_active);

CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE stores DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE stores IS 'Registered stores (merchants) that can receive delivery orders.';

GRANT ALL ON stores TO authenticated;
GRANT ALL ON stores TO service_role;
