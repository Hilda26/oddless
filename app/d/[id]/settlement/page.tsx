"use client";

import { use } from "react";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useChallenge, useDeposit } from "@/lib/contract/hooks";
import { useTransaction } from "@/lib/tx/useTransaction";
import { vaultContract } from "@/lib/contract/vault";
import { ChallengeHeader } from "@/components/duel/ChallengeHeader";
import { TxLifecycle } from "@/components/duel/TxLifecycle";
import { Button } from "@/components/ui/Button";
import { formatWeiToGen, doubleWei } from "@/lib/validation/gen";

export default function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const challengeId = /^\d+$/.test(id) ? BigInt(id) : null;
  const wallet = useWallet();
  const { data: challenge, loading, error, refetch } = useChallenge(challengeId);
  const { data: deposit, refetch: refetchDeposit } = useDeposit(challengeId);
  const settleTx = useTransaction<null>();

  if (challengeId === null) return <p className="p-10 font-ui text-side-a">Invalid duel id.</p>;
  if (loading) return <p className="p-10 font-ui text-ink-soft">Loading…</p>;
  if (error || !challenge) return <p className="p-10 font-ui text-side-a">{error ?? "Duel not found."}</p>;

  const readyToResolve = ["SIDE_A_WIN", "SIDE_B_WIN", "VOID"].includes(challenge.status);
  const isSettled = challenge.status === "SETTLED";

  async function settle() {
    if (!wallet.address) return;
    await settleTx.execute({
      isCorrectNetwork: wallet.isCorrectNetwork,
      write: () => vaultContract.settle(wallet.address as `0x${string}`, challengeId!),
      reread: async () => {
        await Promise.all([refetch(), refetchDeposit()]);
        return null;
      },
    });
  }

  const winnerLabel =
    challenge.winnerSide === "A"
      ? challenge.sideALabel
      : challenge.winnerSide === "B"
        ? challenge.sideBLabel
        : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <ChallengeHeader challenge={challenge} />

      <div className="border-2 border-ink p-6 space-y-4">
        <h2 className="font-display text-2xl">SETTLEMENT</h2>

        {challenge.status === "VOID" || (isSettled && !winnerLabel) ? (
          <p className="font-ui">
            This duel was <strong>VOID</strong> — each side gets their own{" "}
            {formatWeiToGen(challenge.stakeWei)} GEN stake back. No fee, no house.
          </p>
        ) : winnerLabel ? (
          <p className="font-ui">
            <strong>{winnerLabel}</strong> won. The winner receives both stakes:{" "}
            {formatWeiToGen(doubleWei(challenge.stakeWei))} GEN total.
          </p>
        ) : (
          <p className="font-ui text-ink-soft">Not yet resolved.</p>
        )}

        {challenge.resolutionReason && (
          <p className="font-ui text-sm text-ink-soft">{challenge.resolutionReason}</p>
        )}

        {isSettled ? (
          <p className="font-ui font-bold text-side-b">
            Settled — {deposit?.settled ? "payout confirmed on-chain." : "finalizing…"}
          </p>
        ) : readyToResolve ? (
          <>
            <p className="font-ui text-sm">
              Anyone can trigger settlement now — the caller earns nothing, the vault pays out
              exactly once.
            </p>
            <Button onClick={settle} disabled={settleTx.state !== "IDLE" || wallet.status !== "CONNECTED"}>
              Settle now
            </Button>
            <TxLifecycle state={settleTx.state} txHash={settleTx.txHash} error={settleTx.error} />
          </>
        ) : (
          <p className="font-ui text-ink-soft">This duel hasn&apos;t been resolved yet.</p>
        )}
      </div>
    </div>
  );
}
