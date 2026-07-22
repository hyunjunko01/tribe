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

import { Suspense } from "react";
import DeliverClient from "./deliver-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4 py-10 text-sm text-muted-foreground">
          Loading delivery form…
        </div>
      }
    >
      <DeliverClient />
    </Suspense>
  );
}
