import type { ChallengeStatus } from "./types";

export const STATUS_COPY: Record<ChallengeStatus, { label: string; hint: string }> = {
  DRAFT: { label: "Draft", hint: "Awaiting the pre-open sanity check." },
  OPEN: { label: "Open", hint: "Waiting for an opponent to accept." },
  MATCHED: { label: "Matched", hint: "Opponent found — waiting for both stakes to be funded." },
  LOCKED: { label: "Locked", hint: "Both stakes are in the vault. Waiting for the resolution window." },
  RESOLVING: { label: "Resolving", hint: "Resolution window is open — anyone can call resolve()." },
  SIDE_A_WIN: { label: "Side A won", hint: "Decided. Waiting for settlement to pay out." },
  SIDE_B_WIN: { label: "Side B won", hint: "Decided. Waiting for settlement to pay out." },
  VOID: { label: "Void", hint: "No winner — both stakes are refunded in full." },
  SETTLED: { label: "Settled", hint: "Paid out. This duel is finished." },
  CANCELLED: { label: "Cancelled", hint: "Never matched, funded, or opened — refundable." },
};

export function statusTone(status: ChallengeStatus): "neutral" | "side-a" | "side-b" | "success" | "danger" {
  switch (status) {
    case "SIDE_A_WIN":
      return "side-a";
    case "SIDE_B_WIN":
      return "side-b";
    case "SETTLED":
      return "success";
    case "VOID":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}
