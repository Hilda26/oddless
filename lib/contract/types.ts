/**
 * Shared TypeScript types mirroring the on-chain shapes returned by
 * `oddless_duel.py` / `oddless_vault.py`'s view methods. Contract state is
 * authoritative — these types describe what comes back over the wire, not
 * a local cache pretending to be truth (spec §11).
 */

export type ChallengeStatus =
  | "DRAFT"
  | "OPEN"
  | "MATCHED"
  | "LOCKED"
  | "RESOLVING" // frontend-derived only — see docs/ARCHITECTURE.md
  | "SIDE_A_WIN"
  | "SIDE_B_WIN"
  | "VOID"
  | "SETTLED"
  | "CANCELLED";

export type SanityStatus = "" | "VALID_BINARY" | "AMBIGUOUS" | "NON_EXCLUSIVE" | "UNRESOLVABLE";

export type WinnerSide = "" | "A" | "B";

export interface SourceSupportEntry {
  source_id: number;
  stance: "A" | "B" | "UNCLEAR";
  excerpt: string;
}

/** Raw shape returned by `get_challenge` (on-chain field names preserved). */
export interface RawChallenge {
  id: number;
  creator: string;
  opponent: string;
  is_open: boolean;
  question: string;
  side_a_label: string;
  side_b_label: string;
  stake: number | string;
  accept_deadline: number;
  resolve_after: number;
  resolve_by: number;
  source_urls: string[];
  resolution_policy: string;
  status: Exclude<ChallengeStatus, "RESOLVING">;
  sanity_status: SanityStatus;
  sanity_reason: string;
  definition_hash: string;
  matched_at: number;
  winner_side: WinnerSide;
  event_time: string;
  resolution_reason: string;
  source_support: SourceSupportEntry[];
  resolved_at: number;
  locked: boolean;
  settled: boolean;
}

/** Camel-cased, BigInt-safe application view of a challenge. */
export interface Challenge {
  id: bigint;
  creator: `0x${string}`;
  opponent: `0x${string}` | null;
  isOpen: boolean;
  question: string;
  sideALabel: string;
  sideBLabel: string;
  stakeWei: bigint;
  acceptDeadline: Date;
  resolveAfter: Date;
  resolveBy: Date;
  sourceUrls: string[];
  resolutionPolicy: "PRIORITY_ORDER" | "MAJORITY" | "UNANIMOUS";
  /** Authoritative on-chain status, plus a derived "RESOLVING" state for
   * a locked challenge whose resolution window has opened but has not
   * yet produced a result (see docs/ARCHITECTURE.md). */
  status: ChallengeStatus;
  sanityStatus: SanityStatus;
  sanityReason: string;
  definitionHash: string;
  matchedAt: Date | null;
  winnerSide: WinnerSide;
  eventTime: string;
  resolutionReason: string;
  sourceSupport: SourceSupportEntry[];
  resolvedAt: Date | null;
  locked: boolean;
  settled: boolean;
}

export interface Deposit {
  creatorPaidWei: bigint;
  opponentPaidWei: bigint;
  refundedCreator: boolean;
  refundedOpponent: boolean;
  settled: boolean;
}

function deriveStatus(raw: RawChallenge, now: number): ChallengeStatus {
  if (raw.status === "LOCKED" && now >= raw.resolve_after) {
    return "RESOLVING";
  }
  return raw.status;
}

export function toChallenge(raw: RawChallenge, now: number = Date.now() / 1000): Challenge {
  return {
    id: BigInt(raw.id),
    creator: raw.creator as `0x${string}`,
    opponent: raw.opponent ? (raw.opponent as `0x${string}`) : null,
    isOpen: raw.is_open,
    question: raw.question,
    sideALabel: raw.side_a_label,
    sideBLabel: raw.side_b_label,
    stakeWei: BigInt(raw.stake),
    acceptDeadline: new Date(raw.accept_deadline * 1000),
    resolveAfter: new Date(raw.resolve_after * 1000),
    resolveBy: new Date(raw.resolve_by * 1000),
    sourceUrls: raw.source_urls,
    resolutionPolicy: raw.resolution_policy as Challenge["resolutionPolicy"],
    status: deriveStatus(raw, now),
    sanityStatus: raw.sanity_status,
    sanityReason: raw.sanity_reason,
    definitionHash: raw.definition_hash,
    matchedAt: raw.matched_at > 0 ? new Date(raw.matched_at * 1000) : null,
    winnerSide: raw.winner_side,
    eventTime: raw.event_time,
    resolutionReason: raw.resolution_reason,
    sourceSupport: raw.source_support ?? [],
    resolvedAt: raw.resolved_at > 0 ? new Date(raw.resolved_at * 1000) : null,
    locked: raw.locked,
    settled: raw.settled,
  };
}

export interface RawDeposit {
  creator_paid: number | string;
  opponent_paid: number | string;
  refunded_creator: boolean;
  refunded_opponent: boolean;
  settled: boolean;
}

export function toDeposit(raw: RawDeposit): Deposit {
  return {
    creatorPaidWei: BigInt(raw.creator_paid),
    opponentPaidWei: BigInt(raw.opponent_paid),
    refundedCreator: raw.refunded_creator,
    refundedOpponent: raw.refunded_opponent,
    settled: raw.settled,
  };
}
