"use client";

import { useEffect, useState } from "react";

function format(msRemaining: number): string {
  if (msRemaining <= 0) return "now";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Accessible live countdown. Announces politely, not aggressively, and
 * updates on a 1s interval that is cleared on unmount. */
export function Countdown({ target, label }: { target: Date; label: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target.getTime() - now;
  const isPast = remaining <= 0;

  return (
    <span className="font-meta text-sm" aria-live="polite">
      {label}: <strong className={isPast ? "text-side-a" : ""}>{isPast ? "passed" : format(remaining)}</strong>
    </span>
  );
}
