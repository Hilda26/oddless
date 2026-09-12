import Link from "next/link";
import type { Challenge } from "@/lib/contract/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatWeiToGen } from "@/lib/validation/gen";

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <Link
      href={`/d/${challenge.id}`}
      className="group block border-2 border-ink bg-paper hover:halftone-shadow transition-shadow"
    >
      <div className="grid grid-cols-2">
        <div className="bg-side-a text-paper px-4 py-3 font-display text-lg truncate">
          {challenge.sideALabel}
        </div>
        <div className="bg-side-b text-paper px-4 py-3 font-display text-lg truncate text-right">
          {challenge.sideBLabel}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <p className="font-ui font-semibold leading-snug line-clamp-2">{challenge.question}</p>
        <div className="flex items-center justify-between font-meta text-xs text-ink-soft">
          <span>{formatWeiToGen(challenge.stakeWei)} GEN stake</span>
          <StatusPill status={challenge.status} />
        </div>
      </div>
    </Link>
  );
}
