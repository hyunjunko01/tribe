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

import { cn } from "@/lib/utils";

type TribeLogoProps = {
  className?: string;
  /** Display width in px (height follows SVG aspect). */
  size?: number;
  priority?: boolean;
};

export function TribeLogo({
  className,
  size = 40,
  priority,
}: TribeLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG logo from /public
    <img
      src="/logo.svg"
      alt="Tribe"
      width={size}
      height={Math.round(size * (310 / 570))}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={cn("block max-w-none select-none", className)}
      style={{ width: size, height: "auto" }}
    />
  );
}
