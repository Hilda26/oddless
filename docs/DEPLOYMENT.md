# Deployment

## Canonical network

Studionet only:

```text
Chain ID: 61999
RPC:      https://studio.genlayer.com/api
Explorer: https://explorer-studio.genlayer.com
Currency: GEN
```

`npm run check:network` fails the build if `lib/genlayer/network.ts`
resolves to anything else — see `.github/workflows/ci.yml`'s `frontend`
job, which runs it on every push/PR.

## Pre-deployment evidence

```bash
python -m py_compile contracts/oddless_duel.py contracts/oddless_vault.py
PYTHONIOENCODING=utf-8 genvm-lint check contracts/oddless_duel.py
PYTHONIOENCODING=utf-8 genvm-lint check contracts/oddless_vault.py
pytest tests/contract/direct/ -v
npm run hash:contracts
```

(`PYTHONIOENCODING=utf-8` works around a Windows-console-only encoding
bug in `genvm-lint`'s own success-message printing — not a finding about
either contract; see `docs/CONSENSUS.md`.)

As of this build, all of the above have actually been run and pass:

- `oddless_duel.py`: **✓ Validation passed** — 13 methods (4 view, 9
  write). `genvm-lint`'s remaining findings are a documented style
  suggestion and a documented false positive — see `docs/CONSENSUS.md`.
- `oddless_vault.py`: **✓ Lint passed (2 checks)** — 6 methods (2 view, 4
  write).
- `pytest tests/contract/direct/`: **65 passed**.
- Source evidence, computed via `npx tsx scripts/hash-contracts.ts` at
  the time this document was last updated:

  | File | Bytes | SHA-256 |
  | --- | --- | --- |
  | `contracts/oddless_duel.py` | 28652 | `b523e5093c49fc2cb686ef77e162629f49906cf950e1645a9f12b2edd6e5b1a7` |
  | `contracts/oddless_vault.py` | 9841 | `6073d9cc2985af148849bbb9c0d119f304abd047dc6c2a87805d81f9da754325` |

  These values are tied to the exact byte content of both files as of
  this commit — **re-run `npm run hash:contracts` immediately before any
  real deployment** and use that fresh output as the actual evidence; do
  not reuse the numbers above if either contract file has changed since.

## Deploying

Requires a **funded Studionet signer**. This project's own product code
never holds or generates one — `DEPLOYER_PRIVATE_KEY` is read only by
`scripts/deploy.ts`, locally or as an opt-in CI secret, and is never
bundled into any `NEXT_PUBLIC_*` value.

```bash
DEPLOYER_PRIVATE_KEY=0x... npx tsx scripts/deploy.ts
```

This deploys `OddlessDuel`, then `OddlessVault`, then wires them
(`Duel.set_vault(vault)`, `Vault.set_duel(duel)`), waiting for each
transaction to reach `ACCEPTED` before continuing. It writes a full
evidence record to `deployments/studionet-<timestamp>.json`:

```json
{
  "deployedAt": "...",
  "gitSha": "...",
  "network": { "chainId": 61999, "rpcUrl": "...", "explorerUrl": "..." },
  "signerAddress": "0x...",
  "contracts": {
    "oddless_duel":  { "sourceBytes": ..., "sourceSha256": "...", "address": "0x...", "deployTx": "0x...", "explorerTxUrl": "...", "explorerAddressUrl": "..." },
    "oddless_vault": { "sourceBytes": ..., "sourceSha256": "...", "address": "0x...", "deployTx": "0x...", "explorerTxUrl": "...", "explorerAddressUrl": "..." }
  },
  "wiring": { "setVaultTx": "0x...", "setVaultStatus": "...", "setDuelTx": "0x...", "setDuelStatus": "..." }
}
```

Then set, in `.env.local` (never `.env` — it is gitignored on purpose):

```bash
NEXT_PUBLIC_DUEL_CONTRACT_ADDRESS=<address from the record above>
NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS=<address from the record above>
```

## Actual deployment status for this build

**No live deployment has been produced in this session.** The single
external blocker is exactly what the spec anticipates: **no funded
Studionet signer was available in this environment.** Every command
above has been prepared, wired end-to-end, and exercised against the
real (downloaded) py-genlayer-std v0.2.12 runtime through direct-mode
testing — the only step not performed is submitting real transactions to
the live Studionet RPC, which requires GEN-funded credentials this
environment does not hold.

To produce real deployment evidence: obtain a Studionet-funded private
key (e.g. from the GenLayer Studio faucet/dashboard for the target
account), export it as `DEPLOYER_PRIVATE_KEY`, and run
`npx tsx scripts/deploy.ts`. Do not paste that key into chat, a commit,
or any `NEXT_PUBLIC_*` variable.

## Opt-in live CI (`integration` job)

`.github/workflows/ci.yml`'s `integration` job runs
`gltest tests/contract/integration/` against Studionet using a repository
secret `DEPLOYER_PRIVATE_KEY`, and only on manual `workflow_dispatch` —
never on push/PR, per spec §18.
