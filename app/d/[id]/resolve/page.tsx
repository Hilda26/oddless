"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useChallenge } from "@/lib/contract/hooks";
import { useTransaction } from "@/lib/tx/useTransaction";
import { duelContract } from "@/lib/contract/duel";
import { ChallengeHeader } from "@/components/duel/ChallengeHeader";
import { Countdown } from "@/components/duel/Countdown";
import { TxLifecycle } from "@/components/duel/TxLifecycle";
import { Button } from "@/components/ui/Button";

export default function ResolvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const challengeId = /^\d+$/.test(id) ? BigInt(id) : null;
  const wallet = useWallet();
  const { data: challenge, loading, error, refetch } = useChallenge(challengeId);
  const resolveTx = useTransaction<null>();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (challengeId === null) return <p className="p-10 font-ui text-side-a">Invalid duel id.</p>;
  if (loading) return <p className="p-10 font-ui text-ink-soft">Loading…</p>;
  if (error || !challenge) return <p className="p-10 font-ui text-side-a">{error ?? "Duel not found."}</p>;

  const canResolve = now >= challenge.resolveAfter.getTime();

  async function resolve() {
    if (!wallet.address) return;
    await resolveTx.execute({
      isCorrectNetwork: wallet.isCorrectNetwork,
      write: () => duelContract.resolve(wallet.address as `0x${string}`, challengeId!),
      reread: async () => {
        await refetch();
        return null;
      },
    });
  }

  const isDecided = ["SIDE_A_WIN", "SIDE_B_WIN", "VOID", "SETTLED"].includes(challenge.status);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <ChallengeHeader challenge={challenge} />

      <div className="border-2 border-ink p-6 space-y-4">
        <h2 className="font-display text-2xl">EVIDENCE &amp; RESOLUTION</h2>
        <p className="font-ui text-sm">
          Anyone can trigger resolution once the event window opens — the caller earns nothing.
          Every validator independently fetches the sources below and checks the leader&apos;s
          claimed excerpts against what they find themselves.
        </p>
        <ol className="list-decimal list-inside font-meta text-sm space-y-1 break-all">
          {challenge.sourceUrls.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="underline">
                {url}
              </a>
            </li>
          ))}
        </ol>

        <div className="flex gap-6 flex-wrap">
          <Countdown target={challenge.resolveAfter} label="Resolves after" />
          <Countdown target={challenge.resolveBy} label="Final timeout" />
        </div>

        {isDecided ? (
          <div className="space-y-2">
            <p className="font-ui font-bold">
              Decided: {challenge.winnerSide === "A" ? challenge.sideALabel : challenge.winnerSide === "B" ? challenge.sideBLabel : "VOID"}
            </p>
            {challenge.resolutionReason && (
              <p className="font-ui text-sm text-ink-soft">{challenge.resolutionReason}</p>
            )}
            <Link href={`/d/${id}/settlement`}>
              <Button>View settlement</Button>
            </Link>
          </div>
        ) : (
          <>
            <Button onClick={resolve} disabled={!canResolve || resolveTx.state !== "IDLE" || wallet.status !== "CONNECTED"}>
              {canResolve ? "Resolve now" : "Too early to resolve"}
            </Button>
            <TxLifecycle state={resolveTx.state} txHash={resolveTx.txHash} error={resolveTx.error} />
          </>
        )}
      </div>
    </div>
  );
}
