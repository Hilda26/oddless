import { z } from "zod";
import { assertSafeSourceList, MAX_SOURCES, MIN_SOURCES } from "./url";
import { parseGenToWei } from "./gen";

export const RESOLUTION_POLICIES = ["PRIORITY_ORDER", "MAJORITY", "UNANIMOUS"] as const;
export type ResolutionPolicy = (typeof RESOLUTION_POLICIES)[number];

export const RESOLUTION_POLICY_COPY: Record<ResolutionPolicy, { label: string; help: string }> = {
  PRIORITY_ORDER: {
    label: "Priority order",
    help: "Sources are listed in priority order. The highest-priority source that resolves the question wins; lower sources are only consulted if higher ones are silent.",
  },
  MAJORITY: {
    label: "Majority agreement",
    help: "The outcome is whatever a majority of sources agree on. If there is no majority, the duel is VOID.",
  },
  UNANIMOUS: {
    label: "Unanimous agreement",
    help: "Every source must agree on the same outcome. Any material disagreement makes the duel VOID.",
  },
};

const isoDateTimeString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "must be a valid date/time" });

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 40-hex-character address");

export const challengeFormSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(12, "Question must be at least 12 characters.")
      .max(280, "Question must be at most 280 characters."),
    sideALabel: z.string().trim().min(1).max(40),
    sideBLabel: z.string().trim().min(1).max(40),
    stakeGen: z.string().trim().min(1, "Stake is required."),
    acceptDeadline: isoDateTimeString,
    resolveAfter: isoDateTimeString,
    resolveBy: isoDateTimeString,
    sourceUrls: z
      .array(z.string().trim().url("Each source must be a valid URL."))
      .min(MIN_SOURCES, `Provide at least ${MIN_SOURCES} sources.`)
      .max(MAX_SOURCES, `Provide at most ${MAX_SOURCES} sources.`),
    resolutionPolicy: z.enum(RESOLUTION_POLICIES),
    opponentAddress: z.union([addressSchema, z.literal("")]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sideALabel.trim().toLowerCase() === data.sideBLabel.trim().toLowerCase()) {
      ctx.addIssue({
        code: "custom",
        path: ["sideBLabel"],
        message: "Side B must be different from Side A.",
      });
    }

    try {
      parseGenToWei(data.stakeGen);
    } catch (err) {
      ctx.addIssue({
        code: "custom",
        path: ["stakeGen"],
        message: err instanceof Error ? err.message : "Invalid stake amount.",
      });
    }

    try {
      assertSafeSourceList(data.sourceUrls);
    } catch (err) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceUrls"],
        message: err instanceof Error ? err.message : "Unsafe source URL.",
      });
    }

    const now = Date.now();
    const accept = Date.parse(data.acceptDeadline);
    const resolveAfter = Date.parse(data.resolveAfter);
    const resolveBy = Date.parse(data.resolveBy);

    if (accept <= now) {
      ctx.addIssue({
        code: "custom",
        path: ["acceptDeadline"],
        message: "Accept deadline must be in the future.",
      });
    }
    if (resolveAfter <= accept) {
      ctx.addIssue({
        code: "custom",
        path: ["resolveAfter"],
        message: "Event resolution time must be after the accept deadline.",
      });
    }
    if (resolveBy <= resolveAfter) {
      ctx.addIssue({
        code: "custom",
        path: ["resolveBy"],
        message: "Final timeout must be after the event resolution time.",
      });
    }
    const maxWindowMs = 1000 * 60 * 60 * 24 * 120; // 120 days, generous but bounded
    if (resolveBy - resolveAfter > maxWindowMs) {
      ctx.addIssue({
        code: "custom",
        path: ["resolveBy"],
        message: "The window between resolution time and final timeout is too long (max 120 days).",
      });
    }
  });

export type ChallengeFormValues = z.infer<typeof challengeFormSchema>;

/**
 * Client-side ambiguity checklist (spec §4). This is UX guidance only — it
 * does not run on-chain. The contract's own pre-open semantic sanity check
 * (VALID_BINARY / AMBIGUOUS / NON_EXCLUSIVE / UNRESOLVABLE, evaluated by
 * `run_sanity_check`) is the actual authority and is re-derived
 * independently by every validator before a challenge can open.
 */
export const AMBIGUITY_CHECKLIST = [
  {
    id: "mutually-exclusive",
    label: "Exactly two outcomes",
    description:
      "The question can only resolve to Side A or Side B — never both, and there's no plausible third outcome.",
  },
  {
    id: "public-verifiable",
    label: "Publicly verifiable",
    description:
      "A neutral stranger could confirm the answer using only the public sources you're about to list — no private or insider knowledge required.",
  },
  {
    id: "timing-fixed",
    label: "Timing is fixed",
    description:
      "The event resolution time is realistic, and your sources will plausibly have published the answer by then.",
  },
  {
    id: "labels-distinct",
    label: "Labels don't overlap",
    description: "Side A and Side B labels are unambiguous and can't both be argued as \"true.\"",
  },
  {
    id: "sources-independent",
    label: "Sources are independent",
    description: "Your sources are not all mirrors of the same single upstream feed.",
  },
] as const;
