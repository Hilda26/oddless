import type { Challenge } from "@/lib/contract/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatWeiToGen } from "@/lib/validation/gen";
import { explorerAddressUrl } from "@/lib/tx/explorer";

function truncate(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ChallengeHeader({ challenge }: { challenge: Challenge }) {
  return (
    <div className="border-2 border-ink halftone-shadow bg-paper">
      <div className="grid grid-cols-2">
        <div className="bg-side-a text-paper px-4 py-6 sm:px-8 sm:py-10">
          <span className="font-meta text-xs uppercase opacity-80">Side A</span>
          <h2 className="font-display text-3xl sm:text-5xl leading-none mt-1">{challenge.sideALabel}</h2>
          <a
            href={explorerAddressUrl(challenge.creator)}
            target="_blank"
            rel="noreferrer"
            className="font-meta text-xs underline underline-offset-4 mt-2 inline-block opacity-90"
          >
            {truncate(challenge.creator)}
          </a>
        </div>
        <div className="bg-side-b text-paper px-4 py-6 sm:px-8 sm:py-10 text-right">
          <span className="font-meta text-xs uppercase opacity-80">Side B</span>
          <h2 className="font-display text-3xl sm:text-5xl leading-none mt-1">{challenge.sideBLabel}</h2>
          {challenge.opponent ? (
            <a
              href={explorerAddressUrl(challenge.opponent)}
              target="_blank"
              rel="noreferrer"
              className="font-meta text-xs underline underline-offset-4 mt-2 inline-block opacity-90"
            >
              {truncate(challenge.opponent)}
            </a>
          ) : (
            <span className="font-meta text-xs opacity-80 mt-2 inline-block">
              {challenge.isOpen ? "open — anyone may accept" : "reserved opponent"}
            </span>
          )}
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <StatusPill status={challenge.status} />
          <span className="font-meta text-sm">{formatWeiToGen(challenge.stakeWei)} GEN / side</span>
        </div>
        <p className="font-ui text-lg font-semibold">{challenge.question}</p>
        <p className="font-meta text-xs text-ink-soft">
          Resolution policy: {challenge.resolutionPolicy} · Sources: {challenge.sourceUrls.length}
        </p>
      </div>
    </div>
  );
}
