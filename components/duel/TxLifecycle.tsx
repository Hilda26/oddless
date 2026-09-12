"use client";

import type { TxState } from "@/lib/tx/useTransaction";
import { explorerTxUrl } from "@/lib/tx/explorer";

const STEPS: { state: TxState; label: string }[] = [
  { state: "AWAITING_SIGNATURE", label: "Awaiting signature" },
  { state: "SUBMITTED", label: "Submitted" },
  { state: "CONSENSUS_RUNNING", label: "Consensus running" },
  { state: "FINALIZED", label: "Finalized" },
  { state: "EXECUTION_CONFIRMED", label: "Execution confirmed" },
  { state: "STATE_REREAD", label: "Reading final state" },
];

const FAILURE_COPY: Partial<Record<TxState, string>> = {
  USER_REJECTED: "You rejected the transaction in your wallet.",
  WRONG_NETWORK: "Wrong network — switch to Studionet and try again.",
  RPC_ERROR: "Network error talking to Studionet. You can safely retry.",
  CONSENSUS_FAILURE: "Consensus did not finalize in time. It may still land — check the explorer link.",
  EXECUTION_ERROR: "The transaction finalized, but execution failed on-chain.",
  STATE_MISMATCH: "The on-chain state after finalization didn't match what we expected.",
};

function stepIndex(state: TxState): number {
  return STEPS.findIndex((s) => s.state === state);
}

export function TxLifecycle({
  state,
  txHash,
  error,
}: {
  state: TxState;
  txHash: string | null;
  error: string | null;
}) {
  if (state === "IDLE") return null;

  const failureMessage = FAILURE_COPY[state];
  const currentIndex = stepIndex(state);
  const isDone = state === "DONE";

  return (
    <div className="border-2 border-ink bg-paper p-4 space-y-3" role="status" aria-live="polite">
      {!failureMessage ? (
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((step, i) => {
            const reached = isDone || i <= currentIndex;
            const active = !isDone && i === currentIndex;
            return (
              <li
                key={step.state}
                className={[
                  "font-meta text-[11px] uppercase px-2 py-1 border-2 border-ink",
                  reached ? "bg-ink text-acid" : "bg-paper text-ink-soft",
                  active ? "animate-pulse" : "",
                ].join(" ")}
              >
                {step.label}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="font-ui font-bold text-side-a">{failureMessage}</p>
      )}

      {error && failureMessage && <p className="font-meta text-xs text-ink-soft">{error}</p>}

      {txHash && (
        <a
          href={explorerTxUrl(txHash)}
          target="_blank"
          rel="noreferrer"
          className="font-meta text-xs underline underline-offset-4 inline-block"
        >
          View transaction on the explorer →
        </a>
      )}

      {isDone && <p className="font-ui font-bold text-side-b">Done — state re-read and confirmed.</p>}
    </div>
  );
}
