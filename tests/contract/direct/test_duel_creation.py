"""Direct-mode tests for OddlessDuel.create_challenge — deterministic
validation only, no web/LLM mocks required."""
from tests.contract.direct.conftest import VALID_SOURCES, future_ts, to_hex


def test_create_challenge_direct_mode(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice

    challenge_id = contract.create_challenge(
        "Will Atlas publish Release Note A before cutoff?",
        "Yes",
        "No",
        1_000_000_000_000_000_000,
        future_ts(3600),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "PRIORITY_ORDER",
        "",
    )
    assert int(challenge_id) == 0

    state = contract.get_challenge(challenge_id)
    assert state["status"] == "DRAFT"
    assert state["side_a_label"] == "Yes"
    assert state["side_b_label"] == "No"
    assert state["is_open"] is True
    assert state["stake"] == 1_000_000_000_000_000_000
    assert len(state["source_urls"]) == 2


def test_ids_increment(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice

    first = contract.create_challenge(
        "Will the final fixture say RED or BLUE?",
        "RED",
        "BLUE",
        1,
        future_ts(3600),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "MAJORITY",
        "",
    )
    second = contract.create_challenge(
        "Will the final fixture say RED or BLUE, round two?",
        "RED",
        "BLUE",
        1,
        future_ts(3600),
        future_ts(7200),
        future_ts(14400),
        VALID_SOURCES,
        "MAJORITY",
        "",
    )
    assert int(second) == int(first) + 1


def test_rejects_non_positive_stake(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Stake must be positive"):
        contract.create_challenge(
            "Will the final fixture say RED or BLUE?",
            "RED",
            "BLUE",
            0,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            VALID_SOURCES,
            "MAJORITY",
            "",
        )


def test_rejects_identical_side_labels(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Sides must be different"):
        contract.create_challenge(
            "Will the final fixture say RED or BLUE?",
            "Red",
            "red",
            1,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            VALID_SOURCES,
            "MAJORITY",
            "",
        )


def test_rejects_bad_resolution_policy(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Unknown resolution policy"):
        contract.create_challenge(
            "Will the final fixture say RED or BLUE?",
            "RED",
            "BLUE",
            1,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            VALID_SOURCES,
            "VIBES",
            "",
        )


def test_rejects_too_few_sources(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("between"):
        contract.create_challenge(
            "Will the final fixture say RED or BLUE?",
            "RED",
            "BLUE",
            1,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            ["https://example.org/a"],
            "MAJORITY",
            "",
        )


def test_rejects_insecure_source(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("HTTPS"):
        contract.create_challenge(
            "Will the final fixture say RED or BLUE?",
            "RED",
            "BLUE",
            1,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            ["http://example.org/a", "https://example.org/b"],
            "MAJORITY",
            "",
        )


def test_rejects_past_accept_deadline(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Accept deadline must be in the future"):
        contract.create_challenge(
            "Will the final fixture say RED or BLUE?",
            "RED",
            "BLUE",
            1,
            future_ts(-3600),
            future_ts(7200),
            future_ts(14400),
            VALID_SOURCES,
            "MAJORITY",
            "",
        )


def test_rejects_out_of_order_deadlines(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Resolution time must be at/after accept deadline"):
        contract.create_challenge(
            "Will the final fixture say RED or BLUE?",
            "RED",
            "BLUE",
            1,
            future_ts(7200),
            future_ts(3600),
            future_ts(14400),
            VALID_SOURCES,
            "MAJORITY",
            "",
        )


def test_direct_mode_creator_cannot_preset_self_as_opponent(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/oddless_duel.py")
    direct_vm.sender = direct_alice
    alice_hex = to_hex(direct_alice)
    with direct_vm.expect_revert("Creator cannot challenge themselves"):
        contract.create_challenge(
            "Will the final fixture say RED or BLUE?",
            "RED",
            "BLUE",
            1,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            VALID_SOURCES,
            "MAJORITY",
            alice_hex,
        )
