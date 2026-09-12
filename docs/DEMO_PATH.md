# Demo path

A concrete, minute-by-minute walk-through for demonstrating Oddless
end-to-end on Studionet with two wallets. Uses safe, controlled fixtures
(spec §14) — no real-money stakes, and any real external example a user
creates is clearly their own creation, not something this project
publishes as a curated market.

## Prerequisites

- Two browser profiles (or two browsers), each with a wallet extension
  holding a small amount of test GEN on Studionet.
- Contracts deployed and wired (`docs/DEPLOYMENT.md`), with
  `NEXT_PUBLIC_DUEL_CONTRACT_ADDRESS` / `NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS`
  set.
- `npm run dev` running locally, or the app deployed somewhere both
  browsers can reach.

## Fixture question

> **"Does example.org's homepage describe itself as being for
> illustrative examples (Side A) or does it not (Side B)?"**
>
> - Side A: `YES`
> - Side B: `NO`
> - Stake: `1` GEN
> - Sources (priority order):
>   1. `https://example.org/`
>   2. `https://www.iana.org/help/example-domains`
> - Resolution policy: `PRIORITY_ORDER`

`example.org` is the IANA reserved documentation domain — its content
("This domain is for use in illustrative examples...") has been stable
for decades, making this a safe, deterministic fixture for a live demo
without depending on any real sporting/news event actually occurring on
schedule. This is exactly the fixture used by
`tests/contract/integration/test_oddless_duel.py`.

## Walkthrough

1. **Wallet A — create.** Go to `/new`. Fill in the fixture above (leave
   opponent blank — open mode). Check every ambiguity-checklist box.
   Submit; watch the transaction lifecycle panel move through
   `AWAITING_SIGNATURE → SUBMITTED → CONSENSUS_RUNNING → FINALIZED →
   EXECUTION_CONFIRMED → STATE_REREAD`, then land on `/d/0`.
2. **Wallet A — sanity check.** On `/d/0`, the status is `DRAFT`. Click
   "Run sanity check." The pre-open semantic check runs (leader/validator
   LLM classification); status flips to `OPEN`.
3. **Wallet B — accept.** Open `/duels` in Wallet B's browser, find the
   open duel, click through to `/d/0/accept`, click "Accept & take NO."
   Status flips to `MATCHED`.
4. **Both wallets — fund.** Still on `/d/0/accept`, each wallet clicks
   "Fund 1 GEN." Once both are in, status flips to `LOCKED` (a real
   cross-contract `Vault.fund → Duel.mark_locked` call — may take a few
   seconds; `resolve()` will simply reject with "not locked/resolvable"
   if attempted a moment too early, and can be retried).
5. **Anyone — resolve.** Once `resolve_after` has passed, go to
   `/d/0/resolve` (either wallet, or a third uninvolved one — resolving
   earns nothing) and click "Resolve now." Every validator independently
   fetches both sources and checks the leader's claimed excerpts.
6. **Anyone — settle.** On `/d/0/settlement`, click "Settle now." The
   winner receives both stakes (2 GEN); if the fixture landed on VOID,
   both wallets get their own 1 GEN back.
7. **Verify.** Every transaction detail on every screen links to
   `https://explorer-studio.genlayer.com/tx/<hash>` — open a couple to
   show the real finalized transactions and their execution results.

## Alternative: a real external question

A user may of course create a duel about a real upcoming event instead of
the fixture above. Label it clearly as a **user-created public-event
duel** when demonstrating it (per spec §14) — it is not a curated,
Oddless-endorsed market, and its resolution is only as good as the
sources the creator chose.
