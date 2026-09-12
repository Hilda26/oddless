"use client";

import Link from "next/link";
import { useChallengeList } from "@/lib/contract/hooks";
import { ChallengeCard } from "@/components/duel/ChallengeCard";
import { Button } from "@/components/ui/Button";

export default function OpenDuelsPage() {
  const { data: challenges, loading, error } = useChallengeList();

  const open = (challenges ?? []).filter((c) => c.status === "OPEN");
  const others = (challenges ?? []).filter((c) => c.status !== "OPEN");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-display text-4xl">OPEN DUELS</h1>
        <Link href="/new">
          <Button>Start a duel</Button>
        </Link>
      </div>

      {loading && <p className="font-ui text-ink-soft">Loading duels from Studionet…</p>}
      {error && <p className="font-ui text-side-a">{error}</p>}

      {!loading && open.length === 0 && (
        <p className="font-ui text-ink-soft">No open duels waiting for an opponent right now.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {open.map((c) => (
          <ChallengeCard key={c.id.toString()} challenge={c} />
        ))}
      </div>

      {others.length > 0 && (
        <div>
          <h2 className="font-display text-2xl mb-4">RECENT</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {others.slice(0, 12).map((c) => (
              <ChallengeCard key={c.id.toString()} challenge={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
