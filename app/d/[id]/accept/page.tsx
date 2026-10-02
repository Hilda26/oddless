"use client";

import { use } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useChallenge, useDeposit } from "@/lib/contract/hooks";
import { useTransaction } from "@/lib/tx/useTransaction";
import { duelContract } from "@/lib/contract/duel";
import { vaultContract } from "@/lib/contract/vault";
import type { Challenge, Deposit } from "@/lib/contract/types";
import { ChallengeHeader } from "@/components/duel/ChallengeHeader";
import { TxLifecycle } from "@/components/duel/TxLifecycle";
import { Button } from "@/components/ui/Button";
import { formatWeiToGen } from "@/lib/validation/gen";
import { useNow } from "@/lib/time/useNow";

const FUND_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function AcceptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const challengeId = /^\d+$/.test(id) ? BigInt(id) : null;
  const wallet = useWallet();
  const { data: challenge, loading, error, refetch } = useChallenge(challengeId);
  const { data: deposit, refetch: refetchDeposit } = useDeposit(challengeId);
  const acceptTx = useTransaction<null>();
  const fundTx = useTransaction<null>();
  const expireTx = useTransaction<Challenge | null>();
  const refundTx = useTransaction<Deposit | null>();
  const now = useNow();

  if (challengeId === null) return <p className="p-10 font-ui text-side-a">Invalid duel id.</p>;
  if (loading) return <p className="p-10 font-ui text-ink-soft">Loading…</p>;
  if (error || !challenge) return <p className="p-10 font-ui text-side-a">{error ?? "Duel not found."}</p>;

  const address = wallet.address?.toLowerCase();
  const isCreator = address === challenge.creator.toLowerCase();
  const isOpponent = !!challenge.opponent && address === challenge.opponent.toLowerCase();
  const isParty = isCreator || isOpponent;

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
  const iHaveBeenRefunded = isCreator ? deposit?.refundedCreator : isOpponent ? deposit?.refundedOpponent : false;
  const anyDepositRecorded =
    !!deposit && (deposit.creatorPaidWei > 0n || deposit.opponentPaidWei > 0n);
  const acceptExpired = now > challenge.acceptDeadline.getTime();
  const fundingDeadline = challenge.matchedAt
    ? new Date(challenge.matchedAt.getTime() + FUND_WINDOW_MS)
    : null;
  const fundingExpired = !!fundingDeadline && now > fundingDeadline.getTime();
  const canRecoverMyDeposit = isParty && iHaveFunded && !iHaveBeenRefunded;
  const expireBusy = expireTx.state !== "IDLE" && !expireTx.isTerminal;
  const refundBusy = refundTx.state !== "IDLE" && !refundTx.isTerminal;
  const recoveryBusy = expireBusy || refundBusy;
  const expireAndRefundDone = expireTx.state === "DONE" && (!anyDepositRecorded || refundTx.state === "DONE");

  async function rereadRecoveryState() {
    const [freshChallenge] = await Promise.all([refetch(), refetchDeposit()]);
    return freshChallenge;
  }

  async function refundRecordedDeposit() {
    if (!wallet.address) return false;
    return refundTx.execute({
      isCorrectNetwork: wallet.isCorrectNetwork,
      write: () => vaultContract.refundUnmatched(wallet.address as `0x${string}`, challengeId!),
      reread: async () => {
        const [, freshDeposit] = await Promise.all([refetch(), refetchDeposit()]);
        return freshDeposit;
      },
      validate: (freshDeposit) => {
        if (!freshDeposit) return false;
        if (isCreator) return freshDeposit.refundedCreator;
        if (isOpponent) return freshDeposit.refundedOpponent;
        return freshDeposit.refundedCreator || freshDeposit.refundedOpponent;
      },
    });
  }

  async function expireForRecovery(kind: "unmatched" | "unfunded", shouldRefund: boolean) {
    if (!wallet.address) return;
    const expired = await expireTx.execute({
      isCorrectNetwork: wallet.isCorrectNetwork,
      write: () =>
        kind === "unmatched"
          ? duelContract.expireUnmatched(wallet.address as `0x${string}`, challengeId!)
          : duelContract.expireUnfunded(wallet.address as `0x${string}`, challengeId!),
      reread: rereadRecoveryState,
      validate: (freshChallenge) => freshChallenge?.status === "CANCELLED",
    });
    if (expired && shouldRefund) {
      await refundRecordedDeposit();
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <ChallengeHeader challenge={challenge} />

      {challenge.status === "OPEN" && acceptExpired && (
        <div className="border-2 border-ink p-6 space-y-4">
          <h2 className="font-display text-2xl">EXPIRE UNMATCHED DUEL</h2>
          <p className="font-ui text-sm">
            The accept window has passed without a match. Expire this duel before any recorded
            creator deposit can be refunded.
          </p>
          <Button
            onClick={() => expireForRecovery("unmatched", anyDepositRecorded)}
            disabled={recoveryBusy || expireAndRefundDone || wallet.status !== "CONNECTED"}
          >
            {anyDepositRecorded ? "Expire & refund stake" : "Expire challenge"}
          </Button>
          <TxLifecycle state={expireTx.state} txHash={expireTx.txHash} error={expireTx.error} />
          {anyDepositRecorded && (
            <TxLifecycle state={refundTx.state} txHash={refundTx.txHash} error={refundTx.error} />
          )}
        </div>
      )}

      {challenge.status === "OPEN" && !acceptExpired && (
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
          {fundingExpired ? (
            <p className="font-ui text-sm">
              The 24-hour funding window has passed. Expire the duel first, then the vault can
              return any one-sided deposit.
            </p>
          ) : (
            <p className="font-ui text-sm">
              Both sides must fund exactly {formatWeiToGen(challenge.stakeWei)} GEN before this duel
              locks. No overfunding, no unequal stakes.
            </p>
          )}
          <ul className="font-meta text-sm space-y-1">
            <li>Creator funded: {deposit && deposit.creatorPaidWei > 0n ? "✅" : "—"}</li>
            <li>Opponent funded: {deposit && deposit.opponentPaidWei > 0n ? "✅" : "—"}</li>
          </ul>
          {fundingExpired ? (
            canRecoverMyDeposit ? (
              <Button
                onClick={() => expireForRecovery("unfunded", true)}
                disabled={recoveryBusy || refundTx.state === "DONE" || wallet.status !== "CONNECTED"}
              >
                Expire &amp; refund stake
              </Button>
            ) : (
              <Button
                onClick={() => expireForRecovery("unfunded", false)}
                disabled={recoveryBusy || expireTx.state === "DONE" || wallet.status !== "CONNECTED"}
                variant="ghost"
              >
                Expire unfunded duel
              </Button>
            )
          ) : isCreator || isOpponent ? (
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
          {fundingExpired && (
            <>
              <TxLifecycle state={expireTx.state} txHash={expireTx.txHash} error={expireTx.error} />
              {canRecoverMyDeposit && (
                <TxLifecycle state={refundTx.state} txHash={refundTx.txHash} error={refundTx.error} />
              )}
            </>
          )}
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

      {challenge.status === "CANCELLED" && canRecoverMyDeposit && (
        <div className="border-2 border-ink p-6 space-y-4">
          <h2 className="font-display text-2xl">REFUND RECORDED STAKE</h2>
          <p className="font-ui text-sm">
            This duel has already expired. Recover your one-sided deposit from the vault.
          </p>
          <Button
            onClick={refundRecordedDeposit}
            disabled={refundBusy || refundTx.state === "DONE" || wallet.status !== "CONNECTED"}
          >
            Refund stake
          </Button>
          <TxLifecycle state={refundTx.state} txHash={refundTx.txHash} error={refundTx.error} />
        </div>
      )}

      {!["OPEN", "MATCHED", "LOCKED", "RESOLVING"].includes(challenge.status) && !canRecoverMyDeposit && (
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
