"use client";

import { useWallet } from "@/lib/wallet/WalletProvider";
import { useChallengeList } from "@/lib/contract/hooks";
import { ChallengeCard } from "@/components/duel/ChallengeCard";
import { Button } from "@/components/ui/Button";

export default function MyDuelsPage() {
  const wallet = useWallet();
  const { data: challenges, loading, error } = useChallengeList();

  const mine = wallet.address
    ? (challenges ?? []).filter(
        (c) =>
          c.creator.toLowerCase() === wallet.address!.toLowerCase() ||
          c.opponent?.toLowerCase() === wallet.address!.toLowerCase(),
      )
    : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <h1 className="font-display text-4xl">MY DUELS</h1>

      {wallet.status !== "CONNECTED" ? (
        <div className="border-2 border-ink p-6 max-w-md">
          <p className="font-ui mb-4">Connect your wallet to see the duels you&apos;ve created or joined.</p>
          <Button onClick={() => void wallet.connect()}>Connect wallet</Button>
        </div>
      ) : (
        <>
          {loading && <p className="font-ui text-ink-soft">Loading your duels…</p>}
          {error && <p className="font-ui text-side-a">{error}</p>}
          {!loading && mine.length === 0 && (
            <p className="font-ui text-ink-soft">You haven&apos;t created or joined any duels yet.</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mine.map((c) => (
              <ChallengeCard key={c.id.toString()} challenge={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
