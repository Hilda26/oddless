/**
 * One-time wiring: tells OddlessDuel where OddlessVault lives, and
 * OddlessVault where OddlessDuel lives. Safe to re-run — if a side is
 * already wired, that specific call reverts with "already set" and is
 * reported as such rather than failing the whole script.
 *
 * Requires the private key of the account that DEPLOYED each contract
 * (each contract only accepts this call once, from its own deployer).
 * If you deployed both contracts from the same wallet, one key does both.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... npx tsx scripts/wire-contracts.ts
 *
 * Reads the two contract addresses from .env.local
 * (NEXT_PUBLIC_DUEL_CONTRACT_ADDRESS / NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS).
 */
import "./_load-env";
import { createClient, createAccount } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import { oddlessChain, assertCanonicalNetwork, NETWORK } from "../lib/genlayer/network";

assertCanonicalNetwork();

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  const duelAddress = process.env.NEXT_PUBLIC_DUEL_CONTRACT_ADDRESS as `0x${string}` | undefined;
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS as `0x${string}` | undefined;

  if (!privateKey) {
    console.error("Set DEPLOYER_PRIVATE_KEY to the deployer account's private key.");
    process.exit(1);
  }
  if (!duelAddress || !vaultAddress) {
    console.error(
      "Set NEXT_PUBLIC_DUEL_CONTRACT_ADDRESS / NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS in .env.local first.",
    );
    process.exit(1);
  }

  const account = createAccount(privateKey);
  console.log(`Signer: ${account.address}`);
  console.log(`Network: ${NETWORK.chainName} (chain ${NETWORK.chainId})\n`);

  const client = createClient({
    chain: oddlessChain,
    endpoint: oddlessChain.rpcUrls.default.http[0],
    account,
  });

  async function wireOnce(label: string, targetAddress: `0x${string}`, functionName: string, args: string[]) {
    console.log(`${label}...`);
    try {
      const tx = await client.writeContract({
        address: targetAddress,
        functionName,
        args,
        value: 0n,
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: tx,
        status: TransactionStatus.ACCEPTED,
        retries: 200,
        interval: 5000,
      });
      const status = (receipt as { statusName?: string }).statusName ?? String((receipt as { status?: unknown }).status);
      console.log(`  tx: ${tx}`);
      console.log(`  status: ${status}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already set/i.test(message)) {
        console.log(`  already wired — nothing to do.\n`);
      } else {
        console.error(`  ✗ failed: ${message}\n`);
      }
    }
  }

  await wireOnce("Wiring Duel -> Vault (set_vault)", duelAddress, "set_vault", [vaultAddress]);
  await wireOnce("Wiring Vault -> Duel (set_duel)", vaultAddress, "set_duel", [duelAddress]);

  console.log("Done. Re-run this script any time to double-check — already-wired sides are no-ops.");
}

main().catch((err) => {
  console.error("Wiring script failed:", err);
  process.exit(1);
});
