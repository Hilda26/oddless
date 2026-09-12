import { describe, expect, it } from "vitest";
import { toChallenge, type RawChallenge } from "@/lib/contract/types";

const BASE: RawChallenge = {
  id: 0,
  creator: "0xCreator00000000000000000000000000000000",
  opponent: "0xOpponent0000000000000000000000000000000",
  is_open: false,
  question: "Will X happen?",
  side_a_label: "Yes",
  side_b_label: "No",
  stake: "1000000000000000000",
  accept_deadline: 1000,
  resolve_after: 2000,
  resolve_by: 3000,
  source_urls: ["https://example.org"],
  resolution_policy: "PRIORITY_ORDER",
  status: "LOCKED",
  sanity_status: "VALID_BINARY",
  sanity_reason: "",
  definition_hash: "0xabc",
  matched_at: 1500,
  winner_side: "",
  event_time: "",
  resolution_reason: "",
  source_support: [],
  resolved_at: 0,
  locked: true,
  settled: false,
};

describe("toChallenge — authoritative state derivation", () => {
  it("derives RESOLVING only when LOCKED and past resolve_after with no result yet", () => {
    const challenge = toChallenge(BASE, 2500);
    expect(challenge.status).toBe("RESOLVING");
  });

  it("keeps LOCKED as-is before resolve_after", () => {
    const challenge = toChallenge(BASE, 1800);
    expect(challenge.status).toBe("LOCKED");
  });

  it("never overrides an already-decided on-chain status", () => {
    const decided: RawChallenge = { ...BASE, status: "SIDE_A_WIN", winner_side: "A" };
    const challenge = toChallenge(decided, 9999);
    expect(challenge.status).toBe("SIDE_A_WIN");
  });

  it("converts stake to a bigint without precision loss", () => {
    const challenge = toChallenge({ ...BASE, stake: "123456789012345678901234567890" }, 0);
    expect(challenge.stakeWei).toBe(123456789012345678901234567890n);
  });

  it("represents an unset opponent as null, not an empty string", () => {
    const challenge = toChallenge({ ...BASE, opponent: "" }, 0);
    expect(challenge.opponent).toBeNull();
  });
});
