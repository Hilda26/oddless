# Security

## Authorization boundaries

| Action | Who may call it | Enforced by |
| --- | --- | --- |
| `set_vault` / `set_duel` | Deployer only, exactly once | `owner` captured in `__init__`, guarded against a second call |
| `mark_locked` / `mark_settled` (Duel) | The bound Vault contract only | `gl.message.sender_address == self.vault_address` |
| `run_sanity_check` | The challenge's creator only | explicit address check |
| `accept` | Anyone except the creator; the preset opponent only in DIRECT mode | explicit checks in `accept()` |
| `resolve` / `refund_unmatched` / `settle` / `expire_unmatched` / `expire_unfunded` | Anyone (permissionless by design — spec §8: "Caller earns nothing") | no fee/reward path exists for the caller |
| `fund` | The creator or the matched opponent only, and only their own side once | address + "already funded" checks |

## Replay / idempotence / exact-once

- **Duel status is a strict one-way state machine.** Every transition
  method checks the exact required starting status and rejects anything
  else (`DRAFT → OPEN|CANCELLED`, `OPEN → MATCHED|CANCELLED`,
  `MATCHED → LOCKED|CANCELLED`, `LOCKED → SIDE_A_WIN|SIDE_B_WIN|VOID`,
  those three `→ SETTLED`). A transaction cannot be replayed into a state
  it has already left.
- **Vault's `Deposit` record tracks funded/refunded/settled per
  challenge**, each a one-way flag (`creator_paid`/`opponent_paid` can
  only move from `0` to the exact stake once; `refunded_creator`,
  `refunded_opponent`, and `settled` are one-way booleans). A second
  `fund`, `refund_unmatched`, or `settle` call on an already-completed
  challenge is rejected.
- **State is written before any outbound transfer.** In both
  `refund_unmatched` and `settle`, the relevant `settled`/`refunded_*`
  flag is persisted *before* `emit_transfer` is called — a reentrant or
  duplicate call sees the already-updated flag and is rejected, never a
  chance to double-spend.
- **Settlement amount and beneficiary are fully deterministic**, derived
  only from Duel's already-decided `winner_side` and the stored `stake` —
  never from anything computed inside a nondet block, and never
  influenced by the caller of `settle()` (who receives nothing).

## Public URL hardening (spec §7)

`_assert_safe_source_url` / `_assert_safe_source_list` in
`contracts/oddless_duel.py` (mirrored client-side in `lib/validation/url.ts`
for fast feedback — the contract is the actual authority) enforce:

- HTTPS only.
- No embedded credentials (`user:pass@host`).
- Bounded length (≤ 500 chars).
- 2–4 sources, de-duplicated (case/trailing-slash-insensitive).
- Rejects `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`,
  `172.16.0.0/12`, `0.0.0.0`, and `*.local`.

All fetched text is bounded to 8000 characters per source
(`MAX_SOURCE_TEXT_CHARS`) before being placed in a prompt.

## Prompt-injection resistance

Every prompt that includes fetched web content states explicitly, ahead of
that content, that it is untrusted data — never instructions, never a
redefinition of the task, never a channel for revealing hidden/system
instructions, and never a basis for moving value. See
`docs/CONSENSUS.md` for the exact prompt text and how the validator
independently checks claimed excerpts against its own fetch rather than
trusting the leader's quotation.

## What never happens

- No LLM output is ever used as a raw wei amount. `stake` is a
  caller-supplied `u256` validated once at creation (`> 0`); the only
  arithmetic ever applied to it is `stake * 2` (winner payout) — a fixed,
  auditable constant, never a value derived from a nondet block.
- No storage write and no value transfer happens inside `leader_fn` or
  `validator_fn` — every state mutation and every `emit_transfer` call in
  both contracts sits in the deterministic outer body of a `@gl.public.write`
  method, after the nondet block has already returned.
- No private key, mnemonic, or funded browser wallet is ever generated or
  shipped by this app. Every user-facing write is signed by the user's own
  injected wallet (`lib/genlayer/client.ts#getWriteClient`). The only
  private key involved anywhere in this repository is
  `DEPLOYER_PRIVATE_KEY`, read solely by `scripts/deploy.ts`, never bundled
  into any `NEXT_PUBLIC_*` value, and never present in CI except as an
  opt-in repository secret for the manually-triggered integration job.

## Frontend data trust

Contract state is authoritative. `lib/contract/hooks.ts` always re-reads
from the chain; nothing computed client-side is ever presented as
settled truth (`RESOLVING` is clearly documented as a derived display
label — see `docs/ARCHITECTURE.md`). `useTransaction` never reports
success from a transaction hash alone — it waits for finalization, checks
execution result, and re-reads the affected contract state before
reporting `DONE` (spec §13).
