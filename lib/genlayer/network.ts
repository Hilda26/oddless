/**
 * Oddless — canonical network definition.
 *
 * This is the ONLY place chain id / RPC / explorer are allowed to be
 * declared. Every other module (client, wallet, explorer links, tests,
 * deploy scripts) imports from here. `scripts/check-network-config.ts`
 * parses this exact file in CI and fails the build if it does not resolve
 * to Studionet (chain 61999, RPC https://studio.genlayer.com/api).
 *
 * Do NOT configure this for chain 61997 (Studio-dev), localnet, or any
 * other GenLayer network for production builds/deployments.
 */
import { studionet } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
export const STUDIONET_EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const STUDIONET_CURRENCY_SYMBOL = "GEN";
export const STUDIONET_CHAIN_ID_HEX = `0x${STUDIONET_CHAIN_ID.toString(16)}`;

/**
 * Runtime-configurable network values. Defaults are the hard-coded
 * Studionet constants above; environment variables may only ever be used
 * to point at the SAME canonical network (e.g. a mirrored RPC), never to
 * silently redirect production to a different chain. The network guard
 * (`assertCanonicalNetwork`) still hard-fails if these ever drift off
 * 61999 / the expected RPC host.
 */
export const NETWORK = {
  chainId: Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? STUDIONET_CHAIN_ID),
  rpcUrl: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? STUDIONET_RPC_URL,
  explorerUrl: process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL ?? STUDIONET_EXPLORER_URL,
  chainName: process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME ?? "GenLayer Studionet",
  symbol: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL ?? STUDIONET_CURRENCY_SYMBOL,
} as const;

/**
 * The chain object handed to `genlayer-js`'s `createClient`. Built from the
 * SDK's own `studionet` export so RPC/consensus-contract wiring inside
 * genlayer-js stays correct, with our (possibly env-overridden) RPC/name
 * layered on top for display purposes only.
 */
export const oddlessChain: GenLayerChain = {
  ...studionet,
  name: NETWORK.chainName,
  rpcUrls: {
    default: { http: [NETWORK.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "GenLayer Studio Explorer", url: NETWORK.explorerUrl },
  },
};

/** Thrown by `assertCanonicalNetwork` when configuration has drifted. */
export class NonCanonicalNetworkError extends Error {
  constructor(detail: string) {
    super(`Oddless refuses to run on a non-canonical network: ${detail}`);
    this.name = "NonCanonicalNetworkError";
  }
}

/**
 * Hard runtime guard. Call at module init in any file that talks to the
 * chain. Throws (rather than silently proceeding) if the resolved network
 * configuration is not Studionet — this is the "automated check" required
 * by the build spec, enforced both at build time (`check-network-config`)
 * and at runtime (defense in depth against a bad env var in production).
 */
export function assertCanonicalNetwork(): void {
  if (NETWORK.chainId !== STUDIONET_CHAIN_ID) {
    throw new NonCanonicalNetworkError(
      `chain id ${NETWORK.chainId} !== ${STUDIONET_CHAIN_ID}`,
    );
  }
  if (!NETWORK.rpcUrl.startsWith(STUDIONET_RPC_URL)) {
    throw new NonCanonicalNetworkError(
      `rpc url "${NETWORK.rpcUrl}" is not the canonical Studionet endpoint`,
    );
  }
}

export function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}
