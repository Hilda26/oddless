import { getReadClient, getWriteClient } from "@/lib/genlayer/client";
import { toDeposit, type Deposit, type RawDeposit } from "./types";

export function getVaultAddress(): `0x${string}` {
  const address = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS is not configured. Deploy the contracts and set it in .env.local.",
    );
  }
  return address as `0x${string}`;
}

/** Typed adapter over the deployed OddlessVault contract. */
export const vaultContract = {
  async getDeposit(challengeId: bigint): Promise<Deposit> {
    const client = getReadClient();
    const raw = (await client.readContract({
      address: getVaultAddress(),
      functionName: "get_deposit",
      args: [challengeId],
    })) as unknown as RawDeposit;
    return toDeposit(raw);
  },

  async getBalanceWei(): Promise<bigint> {
    const client = getReadClient();
    const balance = await client.readContract({
      address: getVaultAddress(),
      functionName: "get_balance",
      args: [],
    });
    return BigInt(balance as number);
  },

  /** Fund the connected wallet's exact stake for a challenge. `stakeWei`
   * must equal the challenge's stake exactly — the contract enforces
   * this again independently; this parameter only sets the transaction
   * value. */
  async fund(account: `0x${string}`, challengeId: bigint, stakeWei: bigint): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getVaultAddress(),
      functionName: "fund",
      args: [challengeId],
      value: stakeWei,
    }) as Promise<`0x${string}`>;
  },

  async refundUnmatched(account: `0x${string}`, challengeId: bigint): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getVaultAddress(),
      functionName: "refund_unmatched",
      args: [challengeId],
      value: 0n,
    }) as Promise<`0x${string}`>;
  },

  async settle(account: `0x${string}`, challengeId: bigint): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getVaultAddress(),
      functionName: "settle",
      args: [challengeId],
      value: 0n,
    }) as Promise<`0x${string}`>;
  },
};
