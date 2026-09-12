"""Direct-mode tests for the pre-open semantic sanity check
(run_sanity_check): VALID_BINARY opens the challenge; anything else
cancels it — before any stake has been locked."""
from tests.contract.direct.conftest import (
    SANITY_AMBIGUOUS_JSON,
    SANITY_VALID_JSON,
    VALID_SOURCES,
    future_ts,
)


def _create(contract, direct_vm, sender):
    direct_vm.sender = sender
    return contract.create_challenge(
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


def test_valid_binary_opens_challenge(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _create(contract, direct_vm, direct_alice)

    direct_vm.mock_llm(r".*Classify.*|.*checking whether.*", SANITY_VALID_JSON)
    result = contract.run_sanity_check(challenge_id)
    assert result == "VALID_BINARY"

    state = contract.get_challenge(challenge_id)
    assert state["status"] == "OPEN"
    assert state["sanity_status"] == "VALID_BINARY"


def test_ambiguous_cancels_challenge(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _create(contract, direct_vm, direct_alice)

    direct_vm.mock_llm(r".*", SANITY_AMBIGUOUS_JSON)
    result = contract.run_sanity_check(challenge_id)
    assert result == "AMBIGUOUS"

    state = contract.get_challenge(challenge_id)
    assert state["status"] == "CANCELLED"


def test_only_creator_can_run_sanity_check(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _create(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_bob
    direct_vm.mock_llm(r".*", SANITY_VALID_JSON)
    with direct_vm.expect_revert("Only the creator"):
        contract.run_sanity_check(challenge_id)


def test_cannot_run_sanity_check_twice(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    challenge_id = _create(contract, direct_vm, direct_alice)

    direct_vm.mock_llm(r".*", SANITY_VALID_JSON)
    contract.run_sanity_check(challenge_id)

    with direct_vm.expect_revert("not in DRAFT"):
        contract.run_sanity_check(challenge_id)
