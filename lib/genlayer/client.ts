"use client";

import { createClient } from "genlayer-js";
import type { GenLayerClient } from "genlayer-js/types";
import { assertCanonicalNetwork, oddlessChain } from "./network";

assertCanonicalNetwork();

let readClient: GenLayerClient<typeof oddlessChain> | null = null;

/**
 * Unsigned/ephemeral client for public reads. No account, no signer — safe
 * to use before a wallet is connected and for all `readContract` calls,
 * per spec §2 ("an unsigned/ephemeral client for public reads").
 */
export function getReadClient(): GenLayerClient<typeof oddlessChain> {
  if (!readClient) {
    readClient = createClient({ chain: oddlessChain, endpoint: oddlessChain.rpcUrls.default.http[0] });
  }
  return readClient;
}

/**
 * Write client bound to the browser's injected EIP-1193 provider
 * (MetaMask or compatible). The user signs their own transactions — this
 * app never holds a private key. Pass the currently-connected address so
 * genlayer-js routes signing through `window.ethereum`.
 */
export function getWriteClient(account: `0x${string}`): GenLayerClient<typeof oddlessChain> {
  const provider = getInjectedProvider();
  return createClient({
    chain: oddlessChain,
    endpoint: oddlessChain.rpcUrls.default.http[0],
    account,
    ...(provider ? { provider } : {}),
  });
}

export interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function getInjectedProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export function hasInjectedWallet(): boolean {
  return getInjectedProvider() !== null;
}
