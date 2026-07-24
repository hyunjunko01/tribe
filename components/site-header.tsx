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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { TribeLogo } from "@/components/tribe-logo";

export function SiteHeader({ authSlot }: { authSlot: ReactNode }) {
  const pathname = usePathname();

  // Landing hero already carries brand + CTAs — keep the first viewport clean.
  if (pathname === "/") {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-b-foreground/10 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-5 text-sm">
        <div className="flex items-center gap-5 font-semibold">
          <ThemeSwitcher />
          <Link
            href="/"
            aria-label="Tribe home"
            className="-my-2 transition-opacity hover:opacity-80"
          >
            <TribeLogo size={64} className="dark:invert" priority />
          </Link>
        </div>
        <div>{authSlot}</div>
      </div>
    </nav>
  );
}
