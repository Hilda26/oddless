"""Direct-mode tests for accept / expire_unmatched / expire_unfunded."""
from tests.contract.direct.conftest import SANITY_VALID_JSON, VALID_SOURCES, future_ts, to_hex, warp_forward


def _open_challenge(contract, direct_vm, creator, opponent=""):
    direct_vm.sender = creator
    challenge_id = contract.create_challenge(
        "Will Atlas publish Release Note A before cutoff?",
        "Yes",
        "No",
        1,
        future_ts(3600),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        opponent,
    )
    direct_vm.mock_llm(r".*", SANITY_VALID_JSON)
    contract.run_sanity_check(challenge_id)
    return challenge_id


def test_open_accept_sets_opponent(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _open_challenge(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_bob
    contract.accept(challenge_id)

    state = contract.get_challenge(challenge_id)
    assert state["status"] == "MATCHED"
    bob_hex = to_hex(direct_bob)
    assert state["opponent"].lower() == bob_hex.lower()


def test_creator_cannot_accept_own_challenge(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _open_challenge(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Creator cannot accept"):
        contract.accept(challenge_id)


def test_direct_mode_requires_preset_opponent(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/oddless_duel.py")
    bob_hex = to_hex(direct_bob)
    challenge_id = _open_challenge(contract, direct_vm, direct_alice, opponent=bob_hex)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("reserved for a specific opponent"):
        contract.accept(challenge_id)

    direct_vm.sender = direct_bob
    contract.accept(challenge_id)
    state = contract.get_challenge(challenge_id)
    assert state["status"] == "MATCHED"


def test_no_side_selection_after_matching(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Opponent automatically takes the opposite side: accept() takes only
    a challenge_id, and the opponent is assigned Side B implicitly (the
    creator is always Side A — see docs/ARCHITECTURE.md)."""
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _open_challenge(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    contract.accept(challenge_id)  # no side parameter accepted by design

    state = contract.get_challenge(challenge_id)
    bob_hex = to_hex(direct_bob)
    assert state["opponent"].lower() == bob_hex.lower()
    assert state["status"] == "MATCHED"


def test_late_accept_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    challenge_id = contract.create_challenge(
        "Will Atlas publish Release Note A before cutoff?",
        "Yes",
        "No",
        1,
        future_ts(1),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        "",
    )
    direct_vm.mock_llm(r".*", SANITY_VALID_JSON)
    contract.run_sanity_check(challenge_id)

    warp_forward(direct_vm, 10)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Accept deadline has passed"):
        contract.accept(challenge_id)


def test_expire_unmatched_is_permissionless(direct_vm, direct_deploy, direct_alice, direct_charlie):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    challenge_id = contract.create_challenge(
        "Will Atlas publish Release Note A before cutoff?",
        "Yes",
        "No",
        1,
        future_ts(1),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        "",
    )
    direct_vm.mock_llm(r".*", SANITY_VALID_JSON)
    contract.run_sanity_check(challenge_id)

    warp_forward(direct_vm, 10)

    direct_vm.sender = direct_charlie  # anyone may call this — caller earns nothing
    contract.expire_unmatched(challenge_id)

    state = contract.get_challenge(challenge_id)
    assert state["status"] == "CANCELLED"


def test_expire_unfunded_after_fund_window(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _open_challenge(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    contract.accept(challenge_id)

    with direct_vm.expect_revert("Fund window has not expired"):
        contract.expire_unfunded(challenge_id)

    warp_forward(direct_vm, 24 * 60 * 60 + 10)
    contract.expire_unfunded(challenge_id)

    state = contract.get_challenge(challenge_id)
    assert state["status"] == "CANCELLED"
