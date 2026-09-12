"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useTransaction } from "@/lib/tx/useTransaction";
import { duelContract } from "@/lib/contract/duel";
import {
  AMBIGUITY_CHECKLIST,
  RESOLUTION_POLICIES,
  RESOLUTION_POLICY_COPY,
  challengeFormSchema,
  type ResolutionPolicy,
} from "@/lib/validation/challenge";
import { parseGenToWei } from "@/lib/validation/gen";
import { MAX_SOURCES, MIN_SOURCES } from "@/lib/validation/url";
import { Button } from "@/components/ui/Button";
import { TxLifecycle } from "./TxLifecycle";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function hoursFromNow(hours: number): string {
  return toLocalInputValue(new Date(Date.now() + hours * 3600 * 1000));
}

export function CreateChallengeForm() {
  const wallet = useWallet();
  const router = useRouter();
  const tx = useTransaction<{ challengeId: bigint }>();

  const [question, setQuestion] = useState("");
  const [sideALabel, setSideALabel] = useState("");
  const [sideBLabel, setSideBLabel] = useState("");
  const [stakeGen, setStakeGen] = useState("1");
  const [acceptDeadline, setAcceptDeadline] = useState(() => hoursFromNow(24));
  const [resolveAfter, setResolveAfter] = useState(() => hoursFromNow(48));
  const [resolveBy, setResolveBy] = useState(() => hoursFromNow(72));
  const [resolutionPolicy, setResolutionPolicy] = useState<ResolutionPolicy>("PRIORITY_ORDER");
  const [opponentAddress, setOpponentAddress] = useState("");
  const [sourceUrls, setSourceUrls] = useState<string[]>(["", ""]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const allChecked = AMBIGUITY_CHECKLIST.every((item) => checklist[item.id]);

  const canSubmit = wallet.status === "CONNECTED" && allChecked && tx.state === "IDLE";

  const updateSourceUrl = (index: number, value: string) => {
    setSourceUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const parsedPreview = useMemo(() => {
    try {
      return parseGenToWei(stakeGen).toString();
    } catch {
      return null;
    }
  }, [stakeGen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const result = challengeFormSchema.safeParse({
      question,
      sideALabel,
      sideBLabel,
      stakeGen,
      acceptDeadline: new Date(acceptDeadline).toISOString(),
      resolveAfter: new Date(resolveAfter).toISOString(),
      resolveBy: new Date(resolveBy).toISOString(),
      sourceUrls: sourceUrls.filter((u) => u.trim().length > 0),
      resolutionPolicy,
      opponentAddress,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    if (!wallet.address) return;
    const values = result.data;

    await tx.execute({
      isCorrectNetwork: wallet.isCorrectNetwork,
      write: async () => {
        return duelContract.createChallenge(wallet.address as `0x${string}`, {
          question: values.question,
          sideALabel: values.sideALabel,
          sideBLabel: values.sideBLabel,
          stakeWei: parseGenToWei(values.stakeGen),
          acceptDeadline: new Date(values.acceptDeadline),
          resolveAfter: new Date(values.resolveAfter),
          resolveBy: new Date(values.resolveBy),
          sourceUrls: values.sourceUrls,
          resolutionPolicy: values.resolutionPolicy,
          opponentAddress: values.opponentAddress || undefined,
        });
      },
      reread: async () => {
        const count = await duelContract.getChallengeCount();
        const challengeId = count - 1n;
        return { challengeId };
      },
    });
  }

  useEffect(() => {
    if (tx.state === "DONE" && tx.result) {
      router.push(`/d/${tx.result.challengeId}`);
    }
  }, [tx.state, tx.result, router]);

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-8 px-4 sm:px-6 py-10">
      <div>
        <h1 className="font-display text-4xl mb-2">START A DUEL</h1>
        <p className="font-ui text-sm text-ink-soft">
          Write a binary question, set equal stakes, and list your public sources. Nothing is
          staked until the sanity check confirms this is a clean binary question.
        </p>
      </div>

      <fieldset className="space-y-4">
        <label className="block">
          <span className="font-ui font-bold text-sm uppercase">Question</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            maxLength={280}
            required
            className="mt-1 w-full border-2 border-ink bg-paper p-3 font-ui focus:outline-none"
            placeholder="Will Atlas publish Release Note A before the cutoff?"
          />
          {fieldErrors.question && <p className="text-side-a text-xs mt-1">{fieldErrors.question}</p>}
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="font-ui font-bold text-sm uppercase text-side-a">Side A label</span>
            <input
              value={sideALabel}
              onChange={(e) => setSideALabel(e.target.value)}
              required
              maxLength={40}
              className="mt-1 w-full border-2 border-ink bg-paper p-2 font-ui focus:outline-none"
              placeholder="Yes"
            />
            {fieldErrors.sideALabel && <p className="text-side-a text-xs mt-1">{fieldErrors.sideALabel}</p>}
          </label>
          <label className="block">
            <span className="font-ui font-bold text-sm uppercase text-side-b">Side B label</span>
            <input
              value={sideBLabel}
              onChange={(e) => setSideBLabel(e.target.value)}
              required
              maxLength={40}
              className="mt-1 w-full border-2 border-ink bg-paper p-2 font-ui focus:outline-none"
              placeholder="No"
            />
            {fieldErrors.sideBLabel && <p className="text-side-a text-xs mt-1">{fieldErrors.sideBLabel}</p>}
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <label className="block max-w-xs">
          <span className="font-ui font-bold text-sm uppercase">Stake (GEN, per side)</span>
          <input
            value={stakeGen}
            onChange={(e) => setStakeGen(e.target.value)}
            inputMode="decimal"
            required
            className="mt-1 w-full border-2 border-ink bg-paper p-2 font-meta focus:outline-none"
          />
          {parsedPreview && <p className="font-meta text-xs text-ink-soft mt-1">{parsedPreview} wei</p>}
          {fieldErrors.stakeGen && <p className="text-side-a text-xs mt-1">{fieldErrors.stakeGen}</p>}
        </label>

        <label className="block max-w-md">
          <span className="font-ui font-bold text-sm uppercase">Opponent (optional)</span>
          <input
            value={opponentAddress}
            onChange={(e) => setOpponentAddress(e.target.value)}
            placeholder="0x… (leave blank for open — first to accept wins the match)"
            className="mt-1 w-full border-2 border-ink bg-paper p-2 font-meta text-sm focus:outline-none"
          />
        </label>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="font-ui font-bold text-sm uppercase">Accept deadline</span>
            <input
              type="datetime-local"
              value={acceptDeadline}
              onChange={(e) => setAcceptDeadline(e.target.value)}
              required
              className="mt-1 w-full border-2 border-ink bg-paper p-2 font-meta text-sm focus:outline-none"
            />
            {fieldErrors.acceptDeadline && <p className="text-side-a text-xs mt-1">{fieldErrors.acceptDeadline}</p>}
          </label>
          <label className="block">
            <span className="font-ui font-bold text-sm uppercase">Event resolves</span>
            <input
              type="datetime-local"
              value={resolveAfter}
              onChange={(e) => setResolveAfter(e.target.value)}
              required
              className="mt-1 w-full border-2 border-ink bg-paper p-2 font-meta text-sm focus:outline-none"
            />
            {fieldErrors.resolveAfter && <p className="text-side-a text-xs mt-1">{fieldErrors.resolveAfter}</p>}
          </label>
          <label className="block">
            <span className="font-ui font-bold text-sm uppercase">Final timeout</span>
            <input
              type="datetime-local"
              value={resolveBy}
              onChange={(e) => setResolveBy(e.target.value)}
              required
              className="mt-1 w-full border-2 border-ink bg-paper p-2 font-meta text-sm focus:outline-none"
            />
            {fieldErrors.resolveBy && <p className="text-side-a text-xs mt-1">{fieldErrors.resolveBy}</p>}
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <span className="font-ui font-bold text-sm uppercase block">
          Sources ({MIN_SOURCES}–{MAX_SOURCES}, priority order)
        </span>
        {sourceUrls.map((url, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="font-meta text-xs text-silver w-5">{i + 1}.</span>
            <input
              value={url}
              onChange={(e) => updateSourceUrl(i, e.target.value)}
              placeholder="https://…"
              className="flex-1 border-2 border-ink bg-paper p-2 font-meta text-sm focus:outline-none"
            />
            {sourceUrls.length > MIN_SOURCES && (
              <button
                type="button"
                onClick={() => setSourceUrls((prev) => prev.filter((_, idx) => idx !== i))}
                className="font-ui text-xs underline"
                aria-label={`Remove source ${i + 1}`}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {sourceUrls.length < MAX_SOURCES && (
          <button
            type="button"
            onClick={() => setSourceUrls((prev) => [...prev, ""])}
            className="font-ui text-xs underline"
          >
            + Add another source
          </button>
        )}
        {fieldErrors.sourceUrls && <p className="text-side-a text-xs mt-1">{fieldErrors.sourceUrls}</p>}

        <label className="block max-w-md">
          <span className="font-ui font-bold text-sm uppercase">Resolution policy</span>
          <select
            value={resolutionPolicy}
            onChange={(e) => setResolutionPolicy(e.target.value as ResolutionPolicy)}
            className="mt-1 w-full border-2 border-ink bg-paper p-2 font-ui focus:outline-none"
          >
            {RESOLUTION_POLICIES.map((policy) => (
              <option key={policy} value={policy}>
                {RESOLUTION_POLICY_COPY[policy].label}
              </option>
            ))}
          </select>
          <p className="font-ui text-xs text-ink-soft mt-1">
            {RESOLUTION_POLICY_COPY[resolutionPolicy].help}
          </p>
        </label>
      </fieldset>

      <fieldset className="border-2 border-ink p-4 space-y-3">
        <legend className="font-ui font-bold text-sm uppercase px-1">Ambiguity checklist</legend>
        {AMBIGUITY_CHECKLIST.map((item) => (
          <label key={item.id} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!checklist[item.id]}
              onChange={(e) => setChecklist((prev) => ({ ...prev, [item.id]: e.target.checked }))}
              className="mt-1 h-4 w-4 accent-ink"
            />
            <span>
              <span className="font-ui font-bold block">{item.label}</span>
              <span className="font-ui text-sm text-ink-soft">{item.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {wallet.status !== "CONNECTED" && (
        <p className="font-ui text-sm text-side-a">Connect your wallet to Studionet to create a duel.</p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={!canSubmit}>
        Create duel
      </Button>

      <TxLifecycle state={tx.state} txHash={tx.txHash} error={tx.error} />
    </form>
  );
}
