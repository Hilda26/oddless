# Architecture

## Product shape

Oddless is a no-house, equal-stake, two-wallet duel over a binary public
question. There is no order book, no liquidity pool, no odds desk, and no
creator rake — exactly two parties, opposite sides, equal stake, settled by
GenLayer consensus from evidence both parties agreed to before staking.

## Contracts

Two Intelligent Contracts, each owning a real boundary:

- **`contracts/oddless_duel.py`** — challenge terms, the pre-open semantic
  sanity check, matching (direct or open-accept), and independently-verified
  event resolution. Holds no funds.
- **`contracts/oddless_vault.py`** — native GEN custody and settlement.
  Never runs an LLM, never executes a nondeterministic block. Reads Duel's
  final state through a typed `@gl.contract_interface` and drives every
  money movement from that already-decided fact.

This split is the real multi-contract boundary the spec requires: Duel is
the **canonical primitive + execution gate** (only Duel can classify a
question, match two wallets, and decide who won); Vault is the **custody +
settlement consumer** (only Vault moves GEN, and only after independently
re-reading Duel's state — never trusting a cached or caller-supplied
value). Cross-contract calls are one-directional and narrowly scoped:

- Vault → Duel: `get_challenge_for_settlement` (view), and two
  vault-only write calls back into Duel — `mark_locked`, `mark_settled` —
  each gated by `gl.message.sender_address == self.vault_address`.
- Duel never calls into Vault. It has no knowledge of money at all beyond
  the `stake` amount stored as challenge terms.

### Design decisions worth stating explicitly

- **Creator is always Side A; the opponent is always Side B.** The spec's
  "no side selection after matching" (§7) is satisfied by never having a
  side-selection step at all — `accept(challenge_id)` takes no side
  argument. This is simpler than tracking a separate "creator's side"
  field and equally correct.
- **Accept and fund are two separate calls, on two separate contracts**
  (`Duel.accept` then `Vault.fund`), each a real transaction the user
  signs. A `fund_window` (24h, `FUND_WINDOW_SECONDS`) covers the case
  where a challenge is `MATCHED` but one or both sides never fund —
  `Duel.expire_unfunded` (permissionless) cancels it so `Vault.refund_unmatched`
  can return any stake already paid in.
- **`RESOLVING` is a frontend-derived status, not on-chain storage.**
  GenVM write transactions are atomic — from the contract's own
  perspective, there is no observable "mid-resolution" state between
  `LOCKED` and a decided outcome; a failed `resolve()` call simply
  reverts with no state change. The frontend computes `RESOLVING` as
  `LOCKED && now >= resolve_after && no result yet` purely for display
  (see `lib/contract/types.ts#toChallenge`). The chain's own status field
  never lies about this.
- **`source_urls`, being an ordered list, doubles as the "source
  hierarchy"** the spec calls out as a separate concept from the URL list
  itself: index 0 is the highest-priority source. `resolution_policy`
  (`PRIORITY_ORDER` / `MAJORITY` / `UNANIMOUS`) is the separate, sealed
  rule for how the leader/validator prompt should treat multiple sources
  that disagree.
- **`Address.ZERO` and `gl.vm.get_timestamp()` do not exist** in the
  py-genlayer-std runtime this project's pinned dependency hash actually
  resolves to (v0.2.12 — see "Runtime compatibility" below). Both
  contracts define their own `ZERO_ADDRESS` sentinel and a `_now()`
  helper built on `gl.message_raw["datetime"]` instead. Both are narrow,
  additive compatibility shims; no product logic changed to accommodate
  them.

## Cross-contract call latency

`Vault.fund()` requests `Duel.mark_locked()` as a nested cross-contract
write once both deposits are confirmed. GenVM cross-contract calls are
asynchronous relative to the outer transaction — there is a real, small
window where Vault's own bookkeeping already shows both sides funded but
Duel's `status` has not yet flipped from `MATCHED` to `LOCKED`. `resolve()`
already requires `status == LOCKED`, so an early `resolve()` attempt simply
reverts and can be retried a few seconds later — this is a safe,
self-correcting consequence of the async model, not a race condition that
can lose funds (see `docs/CONSENSUS.md`).

## Runtime compatibility

The pinned contract dependency header —

```text
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

— is the exact hash given by the build spec, and resolves (verified via
`gltest`'s direct-mode SDK loader, which downloads the matching
`py-genlayer-std` release from the `genlayerlabs/genvm` GitHub releases)
to **v0.2.12**. Everything in both contracts was written and verified
against that exact runtime, not against later API-reference pages that
describe subsequent point releases. Three narrow compatibility
adjustments were required, each isolated to a one- or two-line shim with
no product-logic changes:

| Symbol used in later docs | Present in v0.2.12? | Fix used here |
| --- | --- | --- |
| `Address.ZERO` | No | Module-level `ZERO_ADDRESS = Address("0x" + "0"*40)` |
| `gl.vm.get_timestamp()` | No | `_now()` helper reading `gl.message_raw["datetime"]` (confirmed present in this runtime's `genlayer._internal.msg` module) |
| — | `Keccak256`/`KeccakHash` | Present and used exactly as documented (`Keccak256(data).hexdigest()`) |

See `tests/contract/direct/` for the full suite that exercises all three
of these against the real, downloaded v0.2.12 runtime (not a mock of it) —
65 direct-mode tests pass. See `docs/DEPLOYMENT.md` for what this means
for the actual deployed bytecode/hash on Studionet.

## Frontend

Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS 4,
Framer Motion, Zod, `viem`, `genlayer-js` pinned exactly to `1.1.8`.

```text
lib/
  genlayer/   network.ts (single source of truth), client.ts (read/write clients)
  wallet/     WalletProvider.tsx (full connection lifecycle)
  contract/   types.ts, duel.ts, vault.ts (typed adapters), hooks.ts, status.ts
  validation/ gen.ts (BigInt-safe GEN<->wei), url.ts, challenge.ts (Zod + checklist)
  tx/         useTransaction.ts (lifecycle state machine), explorer.ts
```

Routes: `/`, `/duels`, `/new`, `/d/[id]`, `/d/[id]/accept`,
`/d/[id]/resolve`, `/d/[id]/settlement`, `/me` — matching the spec's
route list exactly, no sportsbook dashboard.

## Visual system

Head-to-head event poster / split-screen duel card, reinterpreted (not
copied) from motion/poster references: paper ground (`#F2F0EA`), ink
black, electric-red Side A / royal-blue Side B, acid-yellow accent,
silver neutral; `Anton` display, `Inter Tight` UI, `Roboto Mono` for
on-chain terms/hashes/addresses. See `app/globals.css` and
`components/duel/SplitHero.tsx`.
