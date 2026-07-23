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

import { AdminDisputedOrdersSection } from "@/components/admin-disputed-orders-section";
import { getDashboardSession } from "@/lib/dashboard/get-dashboard-session";
import { isAdminProfileId } from "@/lib/admin";

export default async function AdminDashboardPage() {
  const { profile } = await getDashboardSession();
  const isAdmin = isAdminProfileId(profile.id);

  return (
    <>
      <div className="mb-6">
        <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
          Admin dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Resolve disputed orders as the platform arbiter.
        </p>
      </div>

      {isAdmin ? (
        <AdminDisputedOrdersSection profileId={profile.id} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Your profile is not in <code className="text-xs">ADMIN_PROFILE_IDS</code>.
          Add your profile id to <code className="text-xs">.env.local</code> and
          restart the server to act as arbiter.
        </p>
      )}
    </>
  );
}
