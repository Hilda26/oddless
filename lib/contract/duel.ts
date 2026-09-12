import { getReadClient, getWriteClient } from "@/lib/genlayer/client";
import { toChallenge, type Challenge, type RawChallenge } from "./types";
import type { ResolutionPolicy } from "@/lib/validation/challenge";

export function getDuelAddress(): `0x${string}` {
  const address = process.env.NEXT_PUBLIC_DUEL_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "NEXT_PUBLIC_DUEL_CONTRACT_ADDRESS is not configured. Deploy the contracts and set it in .env.local.",
    );
  }
  return address as `0x${string}`;
}

export interface CreateChallengeInput {
  question: string;
  sideALabel: string;
  sideBLabel: string;
  stakeWei: bigint;
  acceptDeadline: Date;
  resolveAfter: Date;
  resolveBy: Date;
  sourceUrls: string[];
  resolutionPolicy: ResolutionPolicy;
  opponentAddress?: string;
}

function toUnixSeconds(date: Date): bigint {
  return BigInt(Math.floor(date.getTime() / 1000));
}

/**
 * Typed adapter over the deployed OddlessDuel contract. Every read goes
 * through the unsigned/ephemeral read client; every write requires a
 * connected wallet address so genlayer-js can route signing through the
 * browser's injected provider.
 */
export const duelContract = {
  async getChallenge(challengeId: bigint): Promise<Challenge> {
    const client = getReadClient();
    const raw = (await client.readContract({
      address: getDuelAddress(),
      functionName: "get_challenge",
      args: [challengeId],
    })) as unknown as RawChallenge;
    return toChallenge(raw);
  },

  async getChallengeCount(): Promise<bigint> {
    const client = getReadClient();
    const count = await client.readContract({
      address: getDuelAddress(),
      functionName: "get_challenge_count",
      args: [],
    });
    return BigInt(count as number);
  },

  async listChallengeIds(): Promise<bigint[]> {
    const client = getReadClient();
    const ids = (await client.readContract({
      address: getDuelAddress(),
      functionName: "list_challenge_ids",
      args: [],
    })) as number[];
    return ids.map((id) => BigInt(id));
  },

  async createChallenge(account: `0x${string}`, input: CreateChallengeInput): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getDuelAddress(),
      functionName: "create_challenge",
      args: [
        input.question,
        input.sideALabel,
        input.sideBLabel,
        input.stakeWei,
        toUnixSeconds(input.acceptDeadline),
        toUnixSeconds(input.resolveAfter),
        toUnixSeconds(input.resolveBy),
        input.sourceUrls,
        input.resolutionPolicy,
        input.opponentAddress ?? "",
      ],
      value: 0n,
    }) as Promise<`0x${string}`>;
  },

  async runSanityCheck(account: `0x${string}`, challengeId: bigint): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getDuelAddress(),
      functionName: "run_sanity_check",
      args: [challengeId],
      value: 0n,
    }) as Promise<`0x${string}`>;
  },

  async accept(account: `0x${string}`, challengeId: bigint): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getDuelAddress(),
      functionName: "accept",
      args: [challengeId],
      value: 0n,
    }) as Promise<`0x${string}`>;
  },

  async resolve(account: `0x${string}`, challengeId: bigint): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getDuelAddress(),
      functionName: "resolve",
      args: [challengeId],
      value: 0n,
    }) as Promise<`0x${string}`>;
  },

  async expireUnmatched(account: `0x${string}`, challengeId: bigint): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getDuelAddress(),
      functionName: "expire_unmatched",
      args: [challengeId],
      value: 0n,
    }) as Promise<`0x${string}`>;
  },

  async expireUnfunded(account: `0x${string}`, challengeId: bigint): Promise<`0x${string}`> {
    const client = getWriteClient(account);
    return client.writeContract({
      address: getDuelAddress(),
      functionName: "expire_unfunded",
      args: [challengeId],
      value: 0n,
    }) as Promise<`0x${string}`>;
  },
};
