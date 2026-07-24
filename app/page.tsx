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

import Hero from "@/components/hero";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server-client";

export default async function Index() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <Hero demoHref={user ? "/dashboard" : "/sign-up"} />;
}
