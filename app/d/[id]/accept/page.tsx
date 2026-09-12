"use client";

import { use } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useChallenge, useDeposit } from "@/lib/contract/hooks";
import { useTransaction } from "@/lib/tx/useTransaction";
import { duelContract } from "@/lib/contract/duel";
import { vaultContract } from "@/lib/contract/vault";
import { ChallengeHeader } from "@/components/duel/ChallengeHeader";
import { TxLifecycle } from "@/components/duel/TxLifecycle";
import { Button } from "@/components/ui/Button";
import { formatWeiToGen } from "@/lib/validation/gen";

export default function AcceptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const challengeId = /^\d+$/.test(id) ? BigInt(id) : null;
  const wallet = useWallet();
  const { data: challenge, loading, error, refetch } = useChallenge(challengeId);
  const { data: deposit, refetch: refetchDeposit } = useDeposit(challengeId);
  const acceptTx = useTransaction<null>();
  const fundTx = useTransaction<null>();

  if (challengeId === null) return <p className="p-10 font-ui text-side-a">Invalid duel id.</p>;
  if (loading) return <p className="p-10 font-ui text-ink-soft">Loading…</p>;
  if (error || !challenge) return <p className="p-10 font-ui text-side-a">{error ?? "Duel not found."}</p>;

  const address = wallet.address?.toLowerCase();
  const isCreator = address === challenge.creator.toLowerCase();
  const isOpponent = !!challenge.opponent && address === challenge.opponent.toLowerCase();

  async function accept() {
    if (!wallet.address) return;
    await acceptTx.execute({
      isCorrectNetwork: wallet.isCorrectNetwork,
      write: () => duelContract.accept(wallet.address as `0x${string}`, challengeId!),
      reread: async () => {
        await refetch();
        return null;
      },
    });
  }

  async function fund() {
    if (!wallet.address || !challenge) return;
    await fundTx.execute({
      isCorrectNetwork: wallet.isCorrectNetwork,
      write: () => vaultContract.fund(wallet.address as `0x${string}`, challengeId!, challenge.stakeWei),
      reread: async () => {
        await Promise.all([refetch(), refetchDeposit()]);
        return null;
      },
    });
  }

  const myPaid = isCreator ? deposit?.creatorPaidWei : isOpponent ? deposit?.opponentPaidWei : 0n;
  const iHaveFunded = !!myPaid && myPaid > 0n;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <ChallengeHeader challenge={challenge} />

      {challenge.status === "OPEN" && (
        <div className="border-2 border-ink p-6 space-y-4">
          <h2 className="font-display text-2xl">ACCEPT THIS DUEL</h2>
          {isCreator ? (
            <p className="font-ui text-sm text-side-a">You created this duel — you can&apos;t accept your own challenge.</p>
          ) : !challenge.isOpen && !isOpponent ? (
            <p className="font-ui text-sm text-side-a">This duel is reserved for a specific opponent.</p>
          ) : (
            <>
              <p className="font-ui text-sm">
                Accepting takes Side B ({challenge.sideBLabel}) automatically. You&apos;ll fund your
                stake in the next step.
              </p>
              <Button onClick={accept} disabled={acceptTx.state !== "IDLE" || wallet.status !== "CONNECTED"}>
                Accept &amp; take {challenge.sideBLabel}
              </Button>
            </>
          )}
          <TxLifecycle state={acceptTx.state} txHash={acceptTx.txHash} error={acceptTx.error} />
        </div>
      )}

      {challenge.status === "MATCHED" && (
        <div className="border-2 border-ink p-6 space-y-4">
          <h2 className="font-display text-2xl">FUND YOUR STAKE</h2>
          <p className="font-ui text-sm">
            Both sides must fund exactly {formatWeiToGen(challenge.stakeWei)} GEN before this duel
            locks. No overfunding, no unequal stakes.
          </p>
          <ul className="font-meta text-sm space-y-1">
            <li>Creator funded: {deposit && deposit.creatorPaidWei > 0n ? "✅" : "—"}</li>
            <li>Opponent funded: {deposit && deposit.opponentPaidWei > 0n ? "✅" : "—"}</li>
          </ul>
          {isCreator || isOpponent ? (
            iHaveFunded ? (
              <p className="font-ui text-sm text-side-b">
                You&apos;ve funded your stake. Waiting on the other side.
              </p>
            ) : (
              <Button onClick={fund} disabled={fundTx.state !== "IDLE" || wallet.status !== "CONNECTED"}>
                Fund {formatWeiToGen(challenge.stakeWei)} GEN
              </Button>
            )
          ) : (
            <p className="font-ui text-sm text-ink-soft">
              You&apos;re not a party to this duel — only the creator and matched opponent can fund it.
            </p>
          )}
          <TxLifecycle state={fundTx.state} txHash={fundTx.txHash} error={fundTx.error} />
        </div>
      )}

      {(challenge.status === "LOCKED" || challenge.status === "RESOLVING") && (
        <div className="border-2 border-ink p-6 space-y-3">
          <p className="font-ui">Both stakes are locked in the vault.</p>
          <Link href={`/d/${id}/resolve`}>
            <Button>Go to resolution</Button>
          </Link>
        </div>
      )}

      {!["OPEN", "MATCHED", "LOCKED", "RESOLVING"].includes(challenge.status) && (
        <div className="border-2 border-ink p-6">
          <p className="font-ui">
            This duel is past the matching/funding stage.{" "}
            <Link href={`/d/${id}`} className="underline">
              View its current state
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
