"""Direct-mode tests for resolve(): locking gate, timing gate, SIDE_A/
SIDE_B/VOID outcomes, and the final-timeout-forces-VOID rule. True
Byzantine leader/validator divergence is a network-level property — see
docs/CONSENSUS.md — and is exercised by the integration suite plus the
pure shape/excerpt predicate tests in test_pure_helpers.py."""
from tests.contract.direct.conftest import (
    SANITY_VALID_JSON,
    VALID_SOURCES,
    future_ts,
    resolution_json,
    resolution_payload,
    to_hex,
    warp_forward,
)


def _locked_challenge(contract, direct_vm, creator, opponent, resolve_after_offset=5, resolve_by_offset=20):
    direct_vm.sender = creator
    challenge_id = contract.create_challenge(
        "Will the final fixture say RED or BLUE?",
        "RED",
        "BLUE",
        1,
        future_ts(resolve_after_offset),  # accept_deadline == resolve_after is allowed
        future_ts(resolve_after_offset),
        future_ts(resolve_by_offset),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        "",
    )
    direct_vm.mock_llm(r".*classification.*|.*checking whether.*", SANITY_VALID_JSON)
    contract.run_sanity_check(challenge_id)

    direct_vm.sender = opponent
    contract.accept(challenge_id)  # well within accept_deadline — no warp needed yet

    # Simulate the vault-only lock transition directly in this contract's
    # own tests by acting as the (test-only) vault: bind vault_address to
    # this test's sender so `mark_locked` is callable here. Cross-contract
    # wiring itself is covered in test_cross_contract.py.
    direct_vm.sender = creator
    contract.set_vault(to_hex(creator))
    direct_vm.sender = creator
    contract.mark_locked(challenge_id)
    return challenge_id


def test_resolve_too_early_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(
        contract, direct_vm, direct_alice, direct_bob, resolve_after_offset=999, resolve_by_offset=1999
    )
    with direct_vm.expect_revert("Too early to resolve"):
        contract.resolve(challenge_id)


def test_resolve_side_a_win(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(contract, direct_vm, direct_alice, direct_bob)

    warp_forward(direct_vm, 6)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Match result: 1:0. Winner: team A."})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("SIDE_A", len(VALID_SOURCES)))

    status = contract.resolve(challenge_id)
    assert status == "SIDE_A_WIN"

    state = contract.get_challenge(challenge_id)
    assert state["winner_side"] == "A"
    assert state["status"] == "SIDE_A_WIN"


def test_resolve_side_b_win(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(contract, direct_vm, direct_alice, direct_bob)

    warp_forward(direct_vm, 6)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Match result: 0:2. Winner: team B."})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("SIDE_B", len(VALID_SOURCES)))

    status = contract.resolve(challenge_id)
    assert status == "SIDE_B_WIN"
    assert contract.get_challenge(challenge_id)["winner_side"] == "B"


def test_resolve_void(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(contract, direct_vm, direct_alice, direct_bob)

    warp_forward(direct_vm, 6)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Event cancelled, no result."})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("VOID", len(VALID_SOURCES)))

    status = contract.resolve(challenge_id)
    assert status == "VOID"
    assert contract.get_challenge(challenge_id)["winner_side"] == ""


def test_resolve_inconclusive_before_timeout_reverts_and_is_retryable(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(
        contract, direct_vm, direct_alice, direct_bob, resolve_after_offset=5, resolve_by_offset=6000
    )

    warp_forward(direct_vm, 6)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Match not yet played."})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("INCONCLUSIVE", len(VALID_SOURCES)))

    with direct_vm.expect_revert("Evidence inconclusive"):
        contract.resolve(challenge_id)

    # No state was mutated by the failed attempt — still LOCKED.
    assert contract.get_challenge(challenge_id)["status"] == "LOCKED"


def test_resolve_inconclusive_after_final_timeout_forces_void(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(
        contract, direct_vm, direct_alice, direct_bob, resolve_after_offset=5, resolve_by_offset=10
    )

    warp_forward(direct_vm, 20)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Still nothing published."})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("UNAVAILABLE", len(VALID_SOURCES)))

    status = contract.resolve(challenge_id)
    assert status == "VOID"
    assert "final timeout" in contract.get_challenge(challenge_id)["resolution_reason"]


def test_resolve_requires_locked_status(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    challenge_id = contract.create_challenge(
        "Will the final fixture say RED or BLUE?",
        "RED",
        "BLUE",
        1,
        future_ts(3600),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        "",
    )
    with direct_vm.expect_revert("not locked/resolvable"):
        contract.resolve(challenge_id)


# ---------------------------------------------------------------------------
# Real leader/validator divergence, using gltest's `run_validator` cheatcode.
#
# In direct mode, `resolve()` itself only ever executes `leader_fn` (there is
# no simulated multi-node consensus in a single process) — gltest instead
# *captures* the (result, leader_fn, validator_fn) triple from the
# `run_nondet_unsafe` call so a test can replay `validator_fn` explicitly,
# optionally with a forged leader result or with different web/LLM mocks in
# place (simulating a validator that independently fetched different
# evidence). This is what actually exercises the "forged excerpt" and
# "validator disagreement" cases end-to-end against the real contract code,
# rather than only the extracted pure predicate in test_pure_helpers.py.
# ---------------------------------------------------------------------------
def test_validator_rejects_forged_excerpt(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(contract, direct_vm, direct_alice, direct_bob)

    warp_forward(direct_vm, 6)
    real_source_text = "Match result: 1:0. Winner: team A. Clean sheet for the home side."
    direct_vm.mock_web(r".*", {"status": 200, "body": real_source_text})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("SIDE_A", len(VALID_SOURCES)))

    # The genuine leader call succeeds (leader_fn only, in direct mode).
    contract.resolve(challenge_id)

    # Now replay the validator with a forged excerpt that never appeared in
    # the (still correctly mocked) source text. It must be rejected.
    forged = resolution_payload("SIDE_A", len(VALID_SOURCES), excerpt="The forged claim that never appeared anywhere.")
    accepted = direct_vm.run_validator(leader_result=forged)
    assert accepted is False


def test_validator_rejects_disagreeing_leader(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(contract, direct_vm, direct_alice, direct_bob)

    warp_forward(direct_vm, 6)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Match result: 1:0. Winner: team A."})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("SIDE_A", len(VALID_SOURCES)))
    contract.resolve(challenge_id)

    # A leader claiming SIDE_B, when this validator's own independent
    # fetch (same mocks — a genuinely different validator would see the
    # same public page) supports SIDE_A, must be rejected outright.
    lying_leader_result = resolution_payload("SIDE_B", len(VALID_SOURCES), excerpt="Winner: team A.")
    accepted = direct_vm.run_validator(leader_result=lying_leader_result)
    assert accepted is False


def test_validator_accepts_genuinely_matching_leader(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(contract, direct_vm, direct_alice, direct_bob)

    warp_forward(direct_vm, 6)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Match result: 1:0. Winner: team A."})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("SIDE_A", len(VALID_SOURCES)))
    contract.resolve(challenge_id)

    # Replaying the validator with no override re-derives the same result
    # from the same mocks and must agree.
    accepted = direct_vm.run_validator()
    assert accepted is True


def test_validator_rejects_malformed_leader_shape(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _locked_challenge(contract, direct_vm, direct_alice, direct_bob)

    warp_forward(direct_vm, 6)
    direct_vm.mock_web(r".*", {"status": 200, "body": "Match result: 1:0. Winner: team A."})
    direct_vm.mock_llm(r".*adjudicating.*", resolution_json("SIDE_A", len(VALID_SOURCES)))
    contract.resolve(challenge_id)

    malformed = {"outcome": "SIDE_A_PROBABLY", "source_support": []}
    accepted = direct_vm.run_validator(leader_result=malformed)
    assert accepted is False
