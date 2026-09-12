"use client";

import { useWallet } from "@/lib/wallet/WalletProvider";

export function NetworkBanner() {
  const wallet = useWallet();

  if (wallet.status !== "WRONG_NETWORK") return null;

  return (
    <div role="alert" className="bg-side-a text-paper font-ui font-bold text-center text-sm py-2 px-4">
      You&apos;re on the wrong network. Oddless only runs on GenLayer Studionet (chain 61999).{" "}
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={() => void wallet.switchToStudionet()}
      >
        Switch now
      </button>
    </div>
  );
}
