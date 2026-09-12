"""Direct-mode tests for the Duel <-> Vault cross-contract boundary
(spec §10): correct binding, wrong-address rejection, and idempotent
settlement — from the Duel side only. Deploying both Duel and Vault
together (real cross-contract dispatch) is a network-level capability
gltest's single-process direct mode does not simulate — see
docs/CONSENSUS.md — so full Vault<->Duel wiring is covered by the
integration suite (tests/contract/integration/)."""
from tests.contract.direct.conftest import (
    SANITY_VALID_JSON,
    VALID_SOURCES,
    future_ts,
    resolution_json,
    to_hex as _addr,
    warp_forward,
)


def test_set_vault_can_only_be_called_once_by_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice  # deployer/owner — must be set BEFORE deploy
    duel = direct_deploy("contracts/oddless_duel.py")
    duel.set_vault(_addr(direct_bob))

    with direct_vm.expect_revert("already set"):
        duel.set_vault(_addr(direct_bob))


def test_set_vault_rejects_non_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    duel = direct_deploy("contracts/oddless_duel.py")

    direct_vm.sender = direct_bob  # not the deployer
    with direct_vm.expect_revert("Only the deployer"):
        duel.set_vault(_addr(direct_bob))


def test_mark_locked_rejects_wrong_address(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    direct_vm.sender = direct_alice
    duel = direct_deploy("contracts/oddless_duel.py")
    duel.set_vault(_addr(direct_bob))

    challenge_id = duel.create_challenge(
        "Will Atlas publish Release Note A before cutoff?",
        "Yes",
        "No",
        1,
        future_ts(3600),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        "",
    )
    direct_vm.mock_llm(r".*", SANITY_VALID_JSON)
    duel.run_sanity_check(challenge_id)
    direct_vm.sender = direct_charlie
    duel.accept(challenge_id)

    # Charlie (not the bound vault) tries to force a lock.
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("not the bound vault"):
        duel.mark_locked(challenge_id)

    # The real bound vault address succeeds.
    direct_vm.sender = direct_bob
    duel.mark_locked(challenge_id)
    assert duel.get_challenge(challenge_id)["status"] == "LOCKED"


def test_mark_settled_rejects_before_resolution(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    duel = direct_deploy("contracts/oddless_duel.py")
    duel.set_vault(_addr(direct_bob))
    challenge_id = duel.create_challenge(
        "Will Atlas publish Release Note A before cutoff?",
        "Yes",
        "No",
        1,
        future_ts(3600),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        "",
    )
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not in a resolved state"):
        duel.mark_settled(challenge_id)


def test_mark_settled_is_exactly_once(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    duel = direct_deploy("contracts/oddless_duel.py")
    duel.set_vault(_addr(direct_bob))
    challenge_id = duel.create_challenge(
        "Will the final fixture say RED or BLUE?",
        "RED",
        "BLUE",
        1,
        future_ts(5),
        future_ts(5),
        future_ts(20),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        "",
    )
    direct_vm.mock_llm(r".*classification.*|.*checking whether.*", SANITY_VALID_JSON)
    duel.run_sanity_check(challenge_id)
    direct_vm.sender = direct_bob  # bob plays the opponent role here too
    duel.accept(challenge_id)  # well within accept_deadline — no warp needed yet
    duel.mark_locked(challenge_id)

    warp_forward(direct_vm, 6)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Winner: RED"})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("SIDE_A", len(VALID_SOURCES)))
    duel.resolve(challenge_id)

    duel.mark_settled(challenge_id)
    assert duel.get_challenge(challenge_id)["status"] == "SETTLED"

    # Once SETTLED, the status guard itself blocks a second call (status is
    # no longer one of SIDE_A_WIN/SIDE_B_WIN/VOID) — the `settled` flag is
    # a second, redundant guard for defense in depth. Either way, a second
    # settlement attempt is rejected — exactly once, no double payout.
    with direct_vm.expect_revert("not in a resolved state"):
        duel.mark_settled(challenge_id)
