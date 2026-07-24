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
import { useCallback, useEffect, useRef, useState } from "react";
import { TribeLogo } from "@/components/tribe-logo";
import { cn } from "@/lib/utils";

const SECTION_COUNT = 3;
/** Page transition duration (ms) — slower than native smooth scroll */
const PAGE_SCROLL_MS = 950;

const BEATS = [
  {
    n: "01",
    title: "Pay",
    body: "Customer USDC locks in escrow when the order is paid",
  },
  {
    n: "02",
    title: "Prove",
    body: "Rider uploads a photo via one-time link; AI checks delivery",
  },
  {
    n: "03",
    title: "Settle",
    body: "Pass releases to the store; dispute → admin refund or release",
  },
] as const;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateScrollTo(
  scroller: HTMLElement,
  top: number,
  duration: number
) {
  const start = scroller.scrollTop;
  const delta = top - start;
  if (Math.abs(delta) < 1) {
    return Promise.resolve();
  }

  scroller.classList.add("is-paging");
  const startTime = performance.now();

  return new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      scroller.scrollTop = start + delta * easeInOutCubic(t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        scroller.scrollTop = top;
        scroller.classList.remove("is-paging");
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

function useRevealOnScroll<T extends HTMLElement>(root: HTMLElement | null) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      },
      { root: root ?? undefined, threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  return ref;
}

export default function LandingPage({ demoHref }: { demoHref: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const pagingRef = useRef(false);

  const storyRef = useRevealOnScroll<HTMLElement>(scrollerEl);
  const demoRef = useRevealOnScroll<HTMLElement>(scrollerEl);

  const setScrollerNode = useCallback((node: HTMLDivElement | null) => {
    scrollerRef.current = node;
    setScrollerEl(node);
  }, []);

  const goToPage = useCallback(async (nextIndex: number) => {
    const scroller = scrollerRef.current;
    if (!scroller || pagingRef.current) return;

    const clamped = Math.min(SECTION_COUNT - 1, Math.max(0, nextIndex));
    if (clamped === pageRef.current) return;

    pagingRef.current = true;
    pageRef.current = clamped;
    setPage(clamped);

    await animateScrollTo(
      scroller,
      clamped * scroller.clientHeight,
      PAGE_SCROLL_MS
    );
    pagingRef.current = false;
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let touchStartY = 0;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (pagingRef.current) return;
      if (Math.abs(event.deltaY) < 8) return;

      const dir = event.deltaY > 0 ? 1 : -1;
      void goToPage(pageRef.current + dir);
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (pagingRef.current) return;
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      const dy = touchStartY - endY;
      if (Math.abs(dy) < 48) return;
      void goToPage(pageRef.current + (dy > 0 ? 1 : -1));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        void goToPage(pageRef.current + 1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        void goToPage(pageRef.current - 1);
      }
    };

    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [scrollerEl, goToPage]);

  const showArrow = page < SECTION_COUNT - 1;

  return (
    <>
      <div ref={setScrollerNode} className="landing-page w-full text-black">
        {/* Section 1 — Hero */}
        <section className="landing-section landing-hero relative flex flex-col items-center justify-center px-6">
          <div
            aria-hidden
            className="landing-grid pointer-events-none absolute inset-0"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.06)_100%)]"
          />

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="landing-hero-enter">
              <TribeLogo size={360} priority />
            </div>
            <h1 className="landing-hero-enter landing-hero-enter-delay-1 mt-6 text-xl font-medium tracking-tight text-neutral-800 sm:text-2xl md:text-3xl">
              Delivery escrow middleware
            </h1>
            <p className="landing-hero-enter landing-hero-enter-delay-2 mt-4 max-w-xl text-sm leading-relaxed text-neutral-600 sm:text-base">
              USDC lock, AI delivery proof, and arbiter settlement on Arc — for
              platforms that already own the app
            </p>
            <div className="landing-hero-enter landing-hero-enter-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={demoHref}
                className="inline-flex h-11 items-center justify-center bg-black px-6 text-sm font-semibold text-white transition-opacity hover:opacity-80"
              >
                Try the demo
              </Link>
            </div>
          </div>
        </section>

        {/* Section 2 — Pay · Prove · Settle */}
        <section
          ref={storyRef}
          className="landing-section landing-reveal relative flex flex-col items-center justify-center bg-black px-6 py-24 text-white"
        >
          <div className="mx-auto w-full max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Pay · Prove · Settle
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-neutral-400 sm:text-base">
              Integrators keep identity, menus, and riders. Tribe owns the
              payment lifecycle.
            </p>

            <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-0">
              {BEATS.map((beat, index) => (
                <div
                  key={beat.title}
                  className="landing-beat relative px-2 md:px-8"
                  style={{ transitionDelay: `${120 + index * 120}ms` }}
                >
                  {index > 0 && (
                    <div
                      aria-hidden
                      className="absolute left-0 top-0 hidden h-full w-px bg-neutral-700 md:block"
                    />
                  )}
                  <p className="text-xs font-medium tracking-[0.2em] text-neutral-500">
                    {beat.n}
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                    {beat.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                    {beat.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3 — Demo video */}
        <section
          ref={demoRef}
          className="landing-section landing-reveal flex flex-col items-center justify-center bg-white px-6 py-24"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              See the full order path
            </h2>
            <p className="mt-4 max-w-xl text-center text-sm text-neutral-600 sm:text-base">
              Watch the escrow flow, or open a live role dashboard.
            </p>

            <div className="landing-demo-media mt-12 w-full max-w-2xl">
              <div className="flex aspect-video w-full flex-col items-center justify-center border border-neutral-300 bg-neutral-50">
                <p className="text-sm font-medium tracking-wide text-neutral-800">
                  Demo video coming soon
                </p>
                <p className="mt-2 max-w-sm px-4 text-center text-xs text-neutral-500">
                  End-to-end: store admit → customer pay → rider proof → settle
                  or dispute
                </p>
              </div>
            </div>

            <footer className="mt-12 text-center text-xs text-neutral-500">
              Built on Circle’s arc-escrow sample · Arc testnet
            </footer>
          </div>
        </section>
      </div>

      {showArrow && (
        <button
          type="button"
          onClick={() => void goToPage(page + 1)}
          aria-label="다음 페이지로 이동"
          className={cn(
            "landing-scroll-hint fixed bottom-8 left-1/2 z-50 -translate-x-1/2 p-2 transition-colors",
            page === 1
              ? "text-neutral-400 hover:text-white"
              : "text-neutral-400 hover:text-black"
          )}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 7.5L10 13.5L16 7.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </>
  );
}
