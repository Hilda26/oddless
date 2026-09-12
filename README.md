# Oddless

**Two sides. Same stake. No house.**

A no-house, equal-stake, two-wallet public-event duel: pick a side of a
binary question, lock equal test-GEN with an opponent, and let GenLayer
Intelligent Contracts settle it from public evidence both sides agreed to
before staking. No order book, no liquidity pool, no odds desk, no
creator rake — exactly two parties, opposite sides, one outcome.

This is a **Studionet demonstration using test GEN**, not real-money
gambling infrastructure.

## Stack

- **Contracts**: two Python Intelligent Contracts (`contracts/oddless_duel.py`,
  `contracts/oddless_vault.py`) targeting the stable Studionet-compatible
  `py-genlayer` runtime.
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript (strict),
  Tailwind CSS 4, Framer Motion, Zod, `viem`, `genlayer-js@1.1.8` (pinned
  exactly).
- **Network**: GenLayer **Studionet only** (chain `61999`,
  `https://studio.genlayer.com/api`) — enforced by
  `lib/genlayer/network.ts` + `npm run check:network`.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in contract addresses after deploying
npm run dev
```

```bash
python -m venv .venv && source .venv/Scripts/activate  # or .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
pytest tests/contract/direct/ -v
```

## Repository layout

```text
app/                  Next.js App Router pages
components/           React components (duel/, ui/)
contracts/            oddless_duel.py, oddless_vault.py
lib/
  genlayer/            network.ts (single source of truth), client.ts
  wallet/              WalletProvider.tsx
  contract/            typed adapters + hooks
  validation/          Zod schemas, GEN<->wei helpers, URL hardening
  tx/                  transaction lifecycle hook, explorer helper
tests/
  contract/direct/      pytest, mocked, no live node — 65 tests
  contract/integration/ gltest, opt-in, real Studionet — see docs/CONSENSUS.md
  frontend/             vitest + Testing Library — 63 tests
scripts/               deploy.ts, hash-contracts.ts, check-network-config.ts
docs/                  see below
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — contract split, design
  decisions, verified runtime-compatibility fixes.
- [`docs/CONSENSUS.md`](docs/CONSENSUS.md) — the leader/validator standard,
  prompt hardening, why direct-mode testing has real limits (and how this
  repo covers the gap).
- [`docs/SECURITY.md`](docs/SECURITY.md) — authorization boundaries,
  replay/idempotence, URL hardening, what never happens.
- [`docs/CONTRACT_SURFACE.md`](docs/CONTRACT_SURFACE.md) — every method,
  the status machine, the cross-contract interface.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — exact deploy commands,
  evidence format, current deployment status.
- [`docs/DEMO_PATH.md`](docs/DEMO_PATH.md) — a concrete two-wallet
  walkthrough using a safe, stable fixture question.

## Status at a glance

| Check | Result |
| --- | --- |
| `npm run lint` | ✅ clean |
| `npm run typecheck` | ✅ clean |
| `npm test` (vitest) | ✅ 63/63 |
| `npm run build` | ✅ succeeds |
| `pytest tests/contract/direct/` | ✅ 65/65 |
| `genvm-lint check` (both contracts) | ✅ Validation passed (see `docs/CONSENSUS.md` for the two documented, investigated findings) |
| Live Studionet deployment | ✅ live, deployed and wired — see `docs/DEPLOYMENT.md` |

## Contributing / working on this repo

Never commit `.env` or `DEPLOYER_PRIVATE_KEY`. The product itself never
manages a signer — every write the user makes is signed by their own
wallet via the injected EIP-1193 provider.
