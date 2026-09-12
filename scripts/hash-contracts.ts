/**
 * Computes the exact byte count and SHA-256 of each contract's source, as
 * required deployment evidence (spec §19). Run before every deployment
 * and record the output alongside the resulting contract address /
 * deployment transaction in docs/DEPLOYMENT.md.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const CONTRACTS = ["oddless_duel.py", "oddless_vault.py"];

for (const name of CONTRACTS) {
  const path = join(__dirname, "..", "contracts", name);
  const source = readFileSync(path);
  const sha256 = createHash("sha256").update(source).digest("hex");
  console.log(`${name}`);
  console.log(`  bytes:  ${source.length}`);
  console.log(`  sha256: ${sha256}`);
  console.log();
}
