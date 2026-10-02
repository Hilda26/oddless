import { Suspense } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AcceptPage from "@/app/d/[id]/accept/page";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useChallenge, useDeposit } from "@/lib/contract/hooks";
import { duelContract } from "@/lib/contract/duel";
import { vaultContract } from "@/lib/contract/vault";
import type { Challenge, Deposit } from "@/lib/contract/types";

const waitForTransactionReceipt = vi.fn();

vi.mock("@/lib/genlayer/client", () => ({
  getReadClient: () => ({ waitForTransactionReceipt }),
}));

vi.mock("@/lib/wallet/WalletProvider", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@/lib/contract/hooks", () => ({
  useChallenge: vi.fn(),
  useDeposit: vi.fn(),
}));

vi.mock("@/lib/contract/duel", () => ({
  duelContract: {
    accept: vi.fn(),
    expireUnmatched: vi.fn(),
    expireUnfunded: vi.fn(),
  },
}));

vi.mock("@/lib/contract/vault", () => ({
  vaultContract: {
    fund: vi.fn(),
    refundUnmatched: vi.fn(),
  },
}));

const creator = "0xAbC0000000000000000000000000000000dEaD";
const opponent = "0xDef0000000000000000000000000000000BEEF";

const baseChallenge: Challenge = {
  id: 7n,
  creator,
  opponent,
  isOpen: false,
  question: "Will Atlas publish Release Note A before cutoff?",
  sideALabel: "Yes",
  sideBLabel: "No",
  stakeWei: 1_000_000_000_000_000_000n,
  acceptDeadline: new Date(Date.now() - 48 * 60 * 60 * 1000),
  resolveAfter: new Date(Date.now() + 60 * 60 * 1000),
  resolveBy: new Date(Date.now() + 2 * 60 * 60 * 1000),
  sourceUrls: ["https://example.org/results", "https://news.example.net/scores"],
  resolutionPolicy: "PRIORITY_ORDER",
  status: "MATCHED",
  sanityStatus: "VALID_BINARY",
  sanityReason: "",
  definitionHash: "0xabc",
  matchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
  winnerSide: "",
  eventTime: "",
  resolutionReason: "",
  sourceSupport: [],
  resolvedAt: null,
  locked: false,
  settled: false,
};

const baseDeposit: Deposit = {
  creatorPaidWei: 1_000_000_000_000_000_000n,
  opponentPaidWei: 0n,
  refundedCreator: false,
  refundedOpponent: false,
  settled: false,
};

async function renderAcceptPage() {
  let rendered: ReturnType<typeof render> | undefined;
  await act(async () => {
    rendered = render(
      <Suspense fallback={<p>Loading route</p>}>
        <AcceptPage params={Promise.resolve({ id: "7" })} />
      </Suspense>,
    );
  });
  return rendered!;
}

function mockWallet() {
  vi.mocked(useWallet).mockReturnValue({
    status: "CONNECTED",
    address: creator,
    chainId: 61999,
    error: null,
    hasWallet: true,
    isCorrectNetwork: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    switchToStudionet: vi.fn(),
    clearError: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWallet();
  waitForTransactionReceipt.mockResolvedValue({
    statusName: "FINALIZED",
    txExecutionResultName: "FINISHED_WITH_RETURN",
  });
  vi.mocked(duelContract.expireUnfunded).mockResolvedValue("0xexpire");
  vi.mocked(duelContract.expireUnmatched).mockResolvedValue("0xexpire");
  vi.mocked(vaultContract.refundUnmatched).mockResolvedValue("0xrefund");
});

describe("recovery actions", () => {
  it("recovers a one-sided matched deposit by expiring unfunded first, then refunding unmatched", async () => {
    const cancelledChallenge = { ...baseChallenge, status: "CANCELLED" as const };
    const refundedDeposit = { ...baseDeposit, refundedCreator: true };
    vi.mocked(useChallenge).mockReturnValue({
      data: baseChallenge,
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(cancelledChallenge),
    });
    vi.mocked(useDeposit).mockReturnValue({
      data: baseDeposit,
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(refundedDeposit),
    });

    await renderAcceptPage();
    await userEvent.click(await screen.findByRole("button", { name: /expire.*refund stake/i }));

    await waitFor(() => expect(vaultContract.refundUnmatched).toHaveBeenCalledWith(creator, 7n));
    expect(duelContract.expireUnfunded).toHaveBeenCalledWith(creator, 7n);
    const expireOrder = vi.mocked(duelContract.expireUnfunded).mock.invocationCallOrder[0];
    const refundOrder = vi.mocked(vaultContract.refundUnmatched).mock.invocationCallOrder[0];
    expect(expireOrder).toBeDefined();
    expect(refundOrder).toBeDefined();
    expect(expireOrder!).toBeLessThan(refundOrder!);
  });

  it("exposes expire_unmatched for an open challenge that was never accepted", async () => {
    const openExpiredChallenge: Challenge = {
      ...baseChallenge,
      opponent: null,
      isOpen: true,
      status: "OPEN",
      matchedAt: null,
    };
    vi.mocked(useChallenge).mockReturnValue({
      data: openExpiredChallenge,
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ ...openExpiredChallenge, status: "CANCELLED" }),
    });
    vi.mocked(useDeposit).mockReturnValue({
      data: { ...baseDeposit, creatorPaidWei: 0n },
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ ...baseDeposit, creatorPaidWei: 0n }),
    });

    await renderAcceptPage();
    await userEvent.click(await screen.findByRole("button", { name: /expire challenge/i }));

    await waitFor(() => expect(duelContract.expireUnmatched).toHaveBeenCalledWith(creator, 7n));
    expect(vaultContract.refundUnmatched).not.toHaveBeenCalled();
  });
});
