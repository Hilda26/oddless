/**
 * CI/build guard: fails loudly if the canonical network definition has
 * drifted off Studionet (chain 61999, https://studio.genlayer.com/api).
 *
 * This is the automated check required by the build spec — run it in CI
 * (see .github/workflows/ci.yml) and locally via `npm run check:network`.
 * It reads the SAME module the app imports at runtime
 * (lib/genlayer/network.ts), so it can never pass while the app itself
 * is misconfigured.
 */
import "./_load-env";
import {
  NETWORK,
  STUDIONET_CHAIN_ID,
  STUDIONET_RPC_URL,
  assertCanonicalNetwork,
} from "../lib/genlayer/network";

function fail(message: string): never {
  console.error(`❌ check:network FAILED — ${message}`);
  process.exit(1);
}

console.log("Checking Oddless network configuration...");
console.log(`  chainId: ${NETWORK.chainId}`);
console.log(`  rpcUrl:  ${NETWORK.rpcUrl}`);

if (NETWORK.chainId !== STUDIONET_CHAIN_ID) {
  fail(
    `chain id must be ${STUDIONET_CHAIN_ID} (Studionet), got ${NETWORK.chainId}. ` +
      `Do not point production at Studio-dev (61997), localnet, or any other network.`,
  );
}

if (!NETWORK.rpcUrl.startsWith(STUDIONET_RPC_URL)) {
  fail(`rpc url must be ${STUDIONET_RPC_URL}, got "${NETWORK.rpcUrl}".`);
}

try {
  assertCanonicalNetwork();
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

console.log("✅ Network configuration is canonical Studionet (61999).");
