"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { Button } from "@/components/ui/Button";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const wallet = useWallet();
  const [copied, setCopied] = useState(false);

  if (wallet.status === "NO_WALLET") {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="font-meta text-xs underline underline-offset-4 hover:text-side-a"
      >
        Install a wallet
      </a>
    );
  }

  if (wallet.status === "DISCONNECTED") {
    return (
      <Button size="sm" onClick={() => void wallet.connect()}>
        Connect wallet
      </Button>
    );
  }

  if (wallet.status === "CONNECTING") {
    return (
      <Button size="sm" disabled>
        Connecting…
      </Button>
    );
  }

  if (wallet.status === "WRONG_NETWORK" || wallet.status === "SWITCHING_NETWORK") {
    return (
      <Button
        size="sm"
        variant="danger"
        disabled={wallet.status === "SWITCHING_NETWORK"}
        onClick={() => void wallet.switchToStudionet()}
      >
        {wallet.status === "SWITCHING_NETWORK" ? "Switching…" : "Wrong network — switch to Studionet"}
      </Button>
    );
  }

  // CONNECTED
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          if (wallet.address) {
            await navigator.clipboard.writeText(wallet.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        className="font-meta text-xs border-2 border-ink px-3 py-1.5 hover:bg-acid transition-colors"
        aria-label="Copy wallet address"
      >
        {copied ? "Copied!" : truncateAddress(wallet.address ?? "")}
      </button>
      <Button size="sm" variant="ghost" onClick={wallet.disconnect}>
        Disconnect
      </Button>
    </div>
  );
}
