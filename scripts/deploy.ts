/**
 * Deploys OddlessDuel + OddlessVault to GenLayer Studionet, wires them
 * together, and records full deployment evidence (spec §19).
 *
 * Requires a funded Studionet signer in DEPLOYER_PRIVATE_KEY (local env
 * only — never committed, never shipped to the browser, never read by
 * any NEXT_PUBLIC_* code path). The deployed product itself never uses
 * this key; every user-facing write is signed by the user's own wallet.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... npx tsx scripts/deploy.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { TransactionStatus, type TransactionHash } from "genlayer-js/types";
import { oddlessChain, assertCanonicalNetwork, NETWORK, STUDIONET_EXPLORER_URL } from "../lib/genlayer/network";

assertCanonicalNetwork();

function gitSha(): string {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "unknown (not a git repository, or no commits yet)";
  }
}

function hashSource(relPath: string) {
  const path = join(__dirname, "..", relPath);
  const source = readFileSync(path);
  return {
    path: relPath,
    bytes: source.length,
    sha256: createHash("sha256").update(source).digest("hex"),
    source,
  };
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    console.error(
      "DEPLOYER_PRIVATE_KEY is not set. This script needs a funded Studionet " +
        "signer's private key as a local environment variable — it is never " +
        "read by the shipped app. See docs/DEPLOYMENT.md.",
    );
    process.exit(1);
  }

  const account = createAccount(privateKey);
  console.log(`Deployer address: ${account.address}`);
  console.log(`Network: ${NETWORK.chainName} (chain ${NETWORK.chainId})`);
  console.log(`RPC: ${NETWORK.rpcUrl}`);

  const client = createClient({
    chain: oddlessChain,
    endpoint: oddlessChain.rpcUrls.default.http[0],
    account,
  });

  const duelSource = hashSource("contracts/oddless_duel.py");
  const vaultSource = hashSource("contracts/oddless_vault.py");
  console.log("\nContract source evidence:");
  console.log(`  oddless_duel.py:  ${duelSource.bytes} bytes, sha256=${duelSource.sha256}`);
  console.log(`  oddless_vault.py: ${vaultSource.bytes} bytes, sha256=${vaultSource.sha256}`);

  console.log("\nDeploying OddlessDuel...");
  const duelDeployTx = await client.deployContract({ code: duelSource.source, args: [] });
  const duelReceipt = await client.waitForTransactionReceipt({
    hash: duelDeployTx as unknown as TransactionHash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
    interval: 5000,
  });
  const duelAddress = extractDeployedAddress(duelReceipt);
  console.log(`  Deployed at: ${duelAddress}`);
  console.log(`  Tx: ${duelDeployTx}`);

  console.log("\nDeploying OddlessVault...");
  const vaultDeployTx = await client.deployContract({ code: vaultSource.source, args: [] });
  const vaultReceipt = await client.waitForTransactionReceipt({
    hash: vaultDeployTx as unknown as TransactionHash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
    interval: 5000,
  });
  const vaultAddress = extractDeployedAddress(vaultReceipt);
  console.log(`  Deployed at: ${vaultAddress}`);
  console.log(`  Tx: ${vaultDeployTx}`);

  console.log("\nWiring Duel -> Vault (set_vault)...");
  const setVaultTx = await client.writeContract({
    address: duelAddress,
    functionName: "set_vault",
    args: [vaultAddress],
    value: 0n,
  });
  const setVaultReceipt = await client.waitForTransactionReceipt({
    hash: setVaultTx,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
    interval: 5000,
  });
  console.log(`  Tx: ${setVaultTx} (status: ${setVaultReceipt.statusName ?? setVaultReceipt.status})`);

  console.log("Wiring Vault -> Duel (set_duel)...");
  const setDuelTx = await client.writeContract({
    address: vaultAddress,
    functionName: "set_duel",
    args: [duelAddress],
    value: 0n,
  });
  const setDuelReceipt = await client.waitForTransactionReceipt({
    hash: setDuelTx,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
    interval: 5000,
  });
  console.log(`  Tx: ${setDuelTx} (status: ${setDuelReceipt.statusName ?? setDuelReceipt.status})`);

  const record = {
    deployedAt: new Date().toISOString(),
    gitSha: gitSha(),
    network: { chainId: NETWORK.chainId, rpcUrl: NETWORK.rpcUrl, explorerUrl: STUDIONET_EXPLORER_URL },
    signerAddress: account.address,
    contracts: {
      oddless_duel: {
        sourceBytes: duelSource.bytes,
        sourceSha256: duelSource.sha256,
        address: duelAddress,
        deployTx: duelDeployTx,
        explorerTxUrl: `${STUDIONET_EXPLORER_URL}/tx/${duelDeployTx}`,
        explorerAddressUrl: `${STUDIONET_EXPLORER_URL}/address/${duelAddress}`,
      },
      oddless_vault: {
        sourceBytes: vaultSource.bytes,
        sourceSha256: vaultSource.sha256,
        address: vaultAddress,
        deployTx: vaultDeployTx,
        explorerTxUrl: `${STUDIONET_EXPLORER_URL}/tx/${vaultDeployTx}`,
        explorerAddressUrl: `${STUDIONET_EXPLORER_URL}/address/${vaultAddress}`,
      },
    },
    wiring: {
      setVaultTx,
      setVaultStatus: setVaultReceipt.statusName ?? String(setVaultReceipt.status),
      setDuelTx,
      setDuelStatus: setDuelReceipt.statusName ?? String(setDuelReceipt.status),
    },
  };

  const deploymentsDir = join(__dirname, "..", "deployments");
  if (!existsSync(deploymentsDir)) mkdirSync(deploymentsDir);
  const outFile = join(deploymentsDir, `studionet-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(record, null, 2));

  console.log(`\n✅ Deployment record written to ${outFile}`);
  console.log("\nAdd these to your .env.local:");
  console.log(`NEXT_PUBLIC_DUEL_CONTRACT_ADDRESS=${duelAddress}`);
  console.log(`NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
}

function extractDeployedAddress(receipt: Record<string, unknown>): `0x${string}` {
  const txDataDecoded = receipt.txDataDecoded as { contractAddress?: string } | undefined;
  const dataField = receipt.data as { contract_address?: string } | undefined;
  const address = txDataDecoded?.contractAddress ?? dataField?.contract_address;
  if (!address) {
    throw new Error(
      `Could not extract deployed contract address from receipt: ${JSON.stringify(receipt)}`,
    );
  }
  return address as `0x${string}`;
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err);
  process.exit(1);
});
