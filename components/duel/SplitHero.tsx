"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Head-to-head event poster / split-screen duel card — the design thesis
 * for Oddless (spec §13). Two colored halves converge on a shared center
 * line carrying the challenge terms, echoing a fight-card poster rather
 * than a SaaS dashboard.
 */
export function SplitHero() {
  const reduceMotion = useReducedMotion();

  const sideVariants = (fromX: number) => ({
    hidden: { opacity: 0, x: reduceMotion ? 0 : fromX },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
  });

  return (
    <section className="relative overflow-hidden border-b-2 border-ink min-h-[86vh] flex flex-col">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sideVariants(-40)}
          className="bg-side-a text-paper flex flex-col items-center justify-center gap-4 py-16 px-6 relative"
        >
          <span className="font-meta text-sm tracking-widest uppercase opacity-80">Side A</span>
          <span className="font-display text-[14vw] sm:text-[6vw] leading-none text-stroke text-side-a select-none">
            YES
          </span>
        </motion.div>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sideVariants(40)}
          className="bg-side-b text-paper flex flex-col items-center justify-center gap-4 py-16 px-6 relative"
        >
          <span className="font-meta text-sm tracking-widest uppercase opacity-80">Side B</span>
          <span className="font-display text-[14vw] sm:text-[6vw] leading-none text-stroke text-side-b select-none">
            NO
          </span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-6 px-4 text-center pointer-events-none"
      >
        <div className="bg-paper border-2 border-ink px-6 py-4 sm:px-10 sm:py-6 halftone-shadow pointer-events-auto max-w-2xl">
          <h1 className="font-display text-3xl sm:text-5xl leading-[0.95] mb-3">
            TWO SIDES.
            <br />
            SAME STAKE.
            <br />
            NO HOUSE.
          </h1>
          <p className="font-ui text-sm sm:text-base text-ink-soft mb-5">
            Pick a side of a public question, lock equal test-GEN, and let GenLayer settle it from
            evidence both wallets agreed to up front. No odds desk. No liquidity pool. No rake.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/new">
              <Button variant="primary" size="lg">
                Start a duel
              </Button>
            </Link>
            <Link href="/duels">
              <Button variant="ghost" size="lg">
                Browse open duels
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
