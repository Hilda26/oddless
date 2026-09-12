import { NETWORK } from "@/lib/genlayer/network";

/** Build an explorer URL for a transaction hash on the canonical network. */
export function explorerTxUrl(hash: string): string {
  return `${NETWORK.explorerUrl}/tx/${hash}`;
}

/** Build an explorer URL for an address (contract or account). */
export function explorerAddressUrl(address: string): string {
  return `${NETWORK.explorerUrl}/address/${address}`;
}
