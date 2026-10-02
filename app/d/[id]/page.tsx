"use client";

import { use } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useChallenge } from "@/lib/contract/hooks";
import { useTransaction } from "@/lib/tx/useTransaction";
import { duelContract } from "@/lib/contract/duel";
import { ChallengeHeader } from "@/components/duel/ChallengeHeader";
import { Countdown } from "@/components/duel/Countdown";
import { TxLifecycle } from "@/components/duel/TxLifecycle";
import { Button } from "@/components/ui/Button";
import { useNow } from "@/lib/time/useNow";

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const challengeId = /^\d+$/.test(id) ? BigInt(id) : null;
  const wallet = useWallet();
  const { data: challenge, loading, error, refetch } = useChallenge(challengeId);
  const sanityTx = useTransaction<null>();
  const now = useNow();

  if (challengeId === null) {
    return <p className="p-10 font-ui text-side-a">Invalid duel id.</p>;
  }
  if (loading) {
    return <p className="p-10 font-ui text-ink-soft">Loading duel #{id} from Studionet…</p>;
  }
  if (error || !challenge) {
    return <p className="p-10 font-ui text-side-a">{error ?? "Duel not found."}</p>;
  }

  const isCreator = wallet.address?.toLowerCase() === challenge.creator.toLowerCase();
  const acceptExpired = now > challenge.acceptDeadline.getTime();

  async function runSanityCheck() {
    if (!wallet.address) return;
    await sanityTx.execute({
      isCorrectNetwork: wallet.isCorrectNetwork,
      write: () => duelContract.runSanityCheck(wallet.address as `0x${string}`, challengeId!),
      reread: async () => {
        await refetch();
        return null;
      },
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <ChallengeHeader challenge={challenge} />

      <div className="grid sm:grid-cols-3 gap-4 font-meta text-sm">
        <Countdown target={challenge.acceptDeadline} label="Accept by" />
        <Countdown target={challenge.resolveAfter} label="Resolves after" />
        <Countdown target={challenge.resolveBy} label="Final timeout" />
      </div>

      <div className="border-2 border-ink p-4">
        <h3 className="font-ui font-bold uppercase text-sm mb-2">Sources (priority order)</h3>
        <ol className="list-decimal list-inside font-meta text-sm space-y-1 break-all">
          {challenge.sourceUrls.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="underline">
                {url}
              </a>
            </li>
          ))}
        </ol>
      </div>

      {challenge.status === "DRAFT" && (
        <div className="border-2 border-ink p-4 space-y-3">
          <p className="font-ui text-sm">
            This duel hasn&apos;t opened yet — it needs a passing sanity check first.
          </p>
          {isCreator ? (
            <Button onClick={runSanityCheck} disabled={sanityTx.state !== "IDLE"}>
              Run sanity check
            </Button>
          ) : (
            <p className="font-ui text-sm text-ink-soft">Only the creator can run this.</p>
          )}
          <TxLifecycle state={sanityTx.state} txHash={sanityTx.txHash} error={sanityTx.error} />
        </div>
      )}

      {challenge.status === "CANCELLED" && challenge.sanityReason && (
        <div className="border-2 border-side-a p-4">
          <p className="font-ui font-bold text-side-a">Cancelled at the sanity check</p>
          <p className="font-ui text-sm">{challenge.sanityReason}</p>
        </div>
      )}

      {(challenge.status === "OPEN" || challenge.status === "MATCHED") && (
        <Link href={`/d/${id}/accept`}>
          <Button variant="primary" size="lg">
            {challenge.status === "OPEN" && acceptExpired
              ? "Expire / recover"
              : challenge.status === "OPEN"
                ? "Accept this duel"
                : "Go to funding"}
          </Button>
        </Link>
      )}

      {(challenge.status === "LOCKED" || challenge.status === "RESOLVING") && (
        <Link href={`/d/${id}/resolve`}>
          <Button variant="primary" size="lg">
            View evidence &amp; resolve
          </Button>
        </Link>
      )}

      {(challenge.status === "SIDE_A_WIN" ||
        challenge.status === "SIDE_B_WIN" ||
        challenge.status === "VOID" ||
        challenge.status === "SETTLED") && (
        <Link href={`/d/${id}/settlement`}>
          <Button variant="primary" size="lg">
            View settlement
          </Button>
        </Link>
      )}
    </div>
  );
}
