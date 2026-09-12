# Contract surface

Generated from the actual method signatures in `contracts/oddless_duel.py`
and `contracts/oddless_vault.py` — verified against the real, downloaded
py-genlayer-std v0.2.12 runtime (see `docs/ARCHITECTURE.md`) via
`genvm-lint check` (`✓ Validation passed` for both) and 65 passing
direct-mode tests.

## `OddlessDuel` (`contracts/oddless_duel.py`)

| Method | Kind | Params | Returns | Notes |
| --- | --- | --- | --- | --- |
| `set_vault(vault_address: str)` | write | — | — | Deployer-only, exactly once |
| `create_challenge(question, side_a_label, side_b_label, stake: u256, accept_deadline: u256, resolve_after: u256, resolve_by: u256, source_urls: list[str], resolution_policy: str, opponent: str = "")` | write | — | `u256` (challenge id) | Validates bounds, URL hardening, date ordering |
| `run_sanity_check(challenge_id: u256)` | write | creator only, DRAFT only | `str` (classification) | Leader/validator LLM classification; opens or cancels |
| `accept(challenge_id: u256)` | write | not creator | — | Sets opponent (open mode) or checks preset opponent |
| `expire_unmatched(challenge_id: u256)` | write | permissionless | — | OPEN past accept_deadline → CANCELLED |
| `expire_unfunded(challenge_id: u256)` | write | permissionless | — | MATCHED past fund window → CANCELLED |
| `mark_locked(challenge_id: u256)` | write | **vault only** | — | MATCHED → LOCKED |
| `mark_settled(challenge_id: u256)` | write | **vault only** | — | resolved → SETTLED |
| `resolve(challenge_id: u256)` | write | permissionless | `str` (new status) | Leader/validator evidence resolution |
| `get_challenge(challenge_id: u256)` | view | — | `dict` | Full challenge state |
| `get_challenge_for_settlement(challenge_id: u256)` | view | — | `dict` | Minimal surface consumed by Vault |
| `get_challenge_count()` | view | — | `int` | |
| `list_challenge_ids()` | view | — | `list[int]` | |

### Status machine

```text
DRAFT --run_sanity_check(VALID_BINARY)--> OPEN
DRAFT --run_sanity_check(other)---------> CANCELLED
OPEN --accept-------------------------->  MATCHED
OPEN --expire_unmatched (deadline)------> CANCELLED
MATCHED --(vault) mark_locked----------->  LOCKED
MATCHED --expire_unfunded (fund window)-> CANCELLED
LOCKED --resolve(SIDE_A)---------------->  SIDE_A_WIN
LOCKED --resolve(SIDE_B)---------------->  SIDE_B_WIN
LOCKED --resolve(VOID/timeout)---------->  VOID
{SIDE_A_WIN,SIDE_B_WIN,VOID} --(vault) mark_settled--> SETTLED
```

`RESOLVING` is never written to storage — see `docs/ARCHITECTURE.md`.

## `OddlessVault` (`contracts/oddless_vault.py`)

| Method | Kind | Params | Returns | Notes |
| --- | --- | --- | --- | --- |
| `set_duel(duel_address: str)` | write | Deployer-only, exactly once | — | |
| `fund(challenge_id: u256)` | **payable write** | creator or matched opponent, exact stake | — | Requests `mark_locked` once both sides funded |
| `refund_unmatched(challenge_id: u256)` | write | permissionless | — | Requires Duel status == CANCELLED |
| `settle(challenge_id: u256)` | write | permissionless | `str` (Duel status at settlement) | Pays winner both stakes, or refunds both on VOID; requests `mark_settled` |
| `get_deposit(challenge_id: u256)` | view | — | `dict` | `creator_paid`, `opponent_paid`, `refunded_creator`, `refunded_opponent`, `settled` |
| `get_balance()` | view | — | `int` | This contract's own GEN balance |

## Cross-contract interface

```python
@gl.contract_interface
class IOddlessDuel:
    class View:
        def get_challenge_for_settlement(self, challenge_id: u256) -> dict: ...
    class Write:
        def mark_locked(self, challenge_id: u256) -> None: ...
        def mark_settled(self, challenge_id: u256) -> None: ...
```

## Frontend adapters

`lib/contract/duel.ts` and `lib/contract/vault.ts` mirror every method
above 1:1 (same names, snake_case → camelCase), returning BigInt-safe,
Date-typed, camelCase application objects via `lib/contract/types.ts`. No
frontend code encodes a raw method-name string outside these two files.
