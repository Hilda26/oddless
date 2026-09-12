import type { ChallengeStatus } from "@/lib/contract/types";
import { STATUS_COPY, statusTone } from "@/lib/contract/status";

const TONE_CLASSES: Record<ReturnType<typeof statusTone>, string> = {
  neutral: "bg-silver text-ink",
  "side-a": "bg-side-a text-paper",
  "side-b": "bg-side-b text-paper",
  success: "bg-ink text-acid",
  danger: "bg-ink text-side-a",
};

export function StatusPill({ status }: { status: ChallengeStatus }) {
  const copy = STATUS_COPY[status];
  const tone = statusTone(status);
  return (
    <span
      className={`inline-block font-meta text-xs font-bold uppercase tracking-wider px-2.5 py-1 ${TONE_CLASSES[tone]}`}
      title={copy.hint}
    >
      {copy.label}
    </span>
  );
}
