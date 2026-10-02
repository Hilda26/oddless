# Recovery Actions Review

## Summary

Implemented the requested application recovery path for expired duels:

- Added an app path on `/d/[id]/accept` for expired matched challenges where only one participant funded.
- The recovery flow calls `expire_unfunded` first, waits for finalization and a re-read confirming `CANCELLED`, then calls `refund_unmatched`.
- Exposed `expire_unmatched` for open challenges whose accept window passed and were never accepted.
- Added refund handling for already-cancelled challenges with a recorded, unrefunded participant deposit.
- Updated the challenge detail page so expired open duels route users to recovery instead of an accept action.

## Supporting Changes

- `useTransaction.execute` now returns `true` or `false`, allowing multi-step application flows to continue only after a confirmed successful write.
- `useChallenge().refetch()` and `useDeposit().refetch()` now return the freshly read state so transaction validation can use authoritative contract data.
- Added a small `useNow` hook so deadline-based UI updates without calling `Date.now()` during render.

## Focused Test Coverage

Added `tests/integration/recovery-actions.test.tsx` covering:

- One-sided deposit recovery calls `expire_unfunded` before `refund_unmatched`.
- Never-accepted expired challenges expose and call `expire_unmatched`.

## Verification

Passed locally:

- `npm run typecheck`
- `npm run lint`
- `npm test`

