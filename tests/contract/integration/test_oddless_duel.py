"""Integration tests for OddlessDuel against a real GenLayer node (real
multi-validator consensus, real web fetches, real LLM calls).

Run with:  gltest tests/contract/integration/test_oddless_duel.py -v -s

Uses a stable, safe, controlled public fixture (spec §14): example.org is
the IANA reserved documentation domain whose content
("This domain is for use in illustrative examples...") has been stable
for decades, making it a reasonable, low-risk real-world source for CI
without depending on any live sporting/news event.
"""
import pytest
from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded

from tests.contract.integration.conftest import VALID_SOURCES, future_ts

FIXTURE_SOURCES = [
    "https://example.org/",
    "https://www.iana.org/help/example-domains",
]
FIXTURE_QUESTION = (
    "Does example.org's homepage describe itself as being for illustrative "
    "examples (Side A) or does it not (Side B)?"
)


def _deploy_duel():
    factory = get_contract_factory(contract_file_path="contracts/oddless_duel.py")
    return factory.deploy(wait_triggered_transactions=True)


@pytest.mark.integration
def test_create_challenge_and_sanity_check_opens_it():
    accounts = get_accounts()
    creator = accounts[0]
    duel = _deploy_duel().connect(creator)

    create_receipt = duel.create_challenge(
        args=[
            FIXTURE_QUESTION,
            "YES",
            "NO",
            1,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            FIXTURE_SOURCES,
            "PRIORITY_ORDER",
            "",
        ]
    ).transact()
    assert tx_execution_succeeded(create_receipt)

    challenge_id = 0
    sanity_receipt = duel.run_sanity_check(args=[challenge_id]).transact()
    assert tx_execution_succeeded(sanity_receipt)

    state = duel.get_challenge(args=[challenge_id]).call()
    assert state["sanity_status"] == "VALID_BINARY"
    assert state["status"] == "OPEN"


@pytest.mark.integration
def test_ambiguous_question_is_cancelled_not_opened():
    accounts = get_accounts()
    creator = accounts[0]
    duel = _deploy_duel().connect(creator)

    create_receipt = duel.create_challenge(
        args=[
            "Is this a good question, sort of, maybe, depends on vibes?",
            "Vibes A",
            "Vibes B",
            1,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            FIXTURE_SOURCES,
            "PRIORITY_ORDER",
            "",
        ]
    ).transact()
    assert tx_execution_succeeded(create_receipt)

    challenge_id = 0
    duel.run_sanity_check(args=[challenge_id]).transact()

    state = duel.get_challenge(args=[challenge_id]).call()
    assert state["sanity_status"] != "VALID_BINARY"
    assert state["status"] == "CANCELLED"


@pytest.mark.integration
def test_full_open_accept_lock_resolve_flow_with_real_vault():
    """End-to-end: deploy Duel + Vault, wire them, open a challenge,
    accept it, fund both sides (real cross-contract `mark_locked`),
    resolve it against the real example.org page, and settle (real
    cross-contract `mark_settled` + real GEN payout)."""
    accounts = get_accounts()
    creator, opponent = accounts[0], accounts[1]

    duel_factory = get_contract_factory(contract_file_path="contracts/oddless_duel.py")
    vault_factory = get_contract_factory(contract_file_path="contracts/oddless_vault.py")

    duel = duel_factory.deploy(account=creator, wait_triggered_transactions=True)
    vault = vault_factory.deploy(account=creator, wait_triggered_transactions=True)

    assert tx_execution_succeeded(
        duel.set_vault(args=[vault.address]).transact()
    )
    assert tx_execution_succeeded(
        vault.set_duel(args=[duel.address]).transact()
    )

    stake = 1_000_000_000_000_000_000  # 1 GEN

    create_receipt = duel.create_challenge(
        args=[
            FIXTURE_QUESTION,
            "YES",
            "NO",
            stake,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            FIXTURE_SOURCES,
            "PRIORITY_ORDER",
            "",
        ]
    ).transact()
    assert tx_execution_succeeded(create_receipt)
    challenge_id = 0

    assert tx_execution_succeeded(duel.run_sanity_check(args=[challenge_id]).transact())
    assert duel.get_challenge(args=[challenge_id]).call()["status"] == "OPEN"

    duel_as_opponent = duel.connect(opponent)
    assert tx_execution_succeeded(duel_as_opponent.accept(args=[challenge_id]).transact())
    assert duel.get_challenge(args=[challenge_id]).call()["status"] == "MATCHED"

    vault_as_creator = vault.connect(creator)
    vault_as_opponent = vault.connect(opponent)

    fund_creator_receipt = vault_as_creator.fund(args=[challenge_id]).transact(
        value=stake, wait_triggered_transactions=True
    )
    assert tx_execution_succeeded(fund_creator_receipt)

    fund_opponent_receipt = vault_as_opponent.fund(args=[challenge_id]).transact(
        value=stake, wait_triggered_transactions=True
    )
    assert tx_execution_succeeded(fund_opponent_receipt)

    # Real cross-contract mark_locked should have fired as a triggered
    # transaction from the second `fund` call.
    assert duel.get_challenge(args=[challenge_id]).call()["status"] == "LOCKED"

    resolve_receipt = duel.resolve(args=[challenge_id]).transact(
        wait_interval=10000, wait_retries=30
    )
    assert tx_execution_succeeded(resolve_receipt)

    resolved_state = duel.get_challenge(args=[challenge_id]).call()
    assert resolved_state["status"] in ("SIDE_A_WIN", "SIDE_B_WIN", "VOID")

    settle_receipt = vault.settle(args=[challenge_id]).transact(
        wait_triggered_transactions=True
    )
    assert tx_execution_succeeded(settle_receipt)

    assert duel.get_challenge(args=[challenge_id]).call()["status"] == "SETTLED"
    deposit = vault.get_deposit(args=[challenge_id]).call()
    assert deposit["settled"] is True
