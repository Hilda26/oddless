"""Integration tests for OddlessVault against a real GenLayer node —
funding rules, refunds, settlement, and conservation. Complements
test_oddless_duel.py's full end-to-end happy path with the failure and
edge cases that specifically require real cross-contract dispatch (not
reproducible in gltest's single-contract direct mode; see
docs/CONSENSUS.md)."""
import pytest
from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded, tx_execution_failed

from tests.contract.integration.conftest import VALID_SOURCES, future_ts

STAKE = 1_000_000_000_000_000_000  # 1 GEN


def _deploy_wired_pair(creator):
    duel_factory = get_contract_factory(contract_file_path="contracts/oddless_duel.py")
    vault_factory = get_contract_factory(contract_file_path="contracts/oddless_vault.py")
    duel = duel_factory.deploy(account=creator, wait_triggered_transactions=True)
    vault = vault_factory.deploy(account=creator, wait_triggered_transactions=True)
    duel.set_vault(args=[vault.address]).transact()
    vault.set_duel(args=[duel.address]).transact()
    return duel, vault


def _open_and_match(duel, creator, opponent, question_suffix=""):
    duel = duel.connect(creator)
    create_receipt = duel.create_challenge(
        args=[
            f"Will Atlas publish Release Note A before cutoff?{question_suffix}",
            "Yes",
            "No",
            STAKE,
            future_ts(3600),
            future_ts(7200),
            future_ts(14400),
            VALID_SOURCES,
            "PRIORITY_ORDER",
            "",
        ]
    ).transact()
    assert tx_execution_succeeded(create_receipt)
    challenge_id = duel.get_challenge_count(args=[]).call() - 1

    duel.run_sanity_check(args=[challenge_id]).transact()
    duel.connect(opponent).accept(args=[challenge_id]).transact()
    return challenge_id


@pytest.mark.integration
def test_rejects_wrong_stake_amount():
    accounts = get_accounts()
    creator, opponent = accounts[0], accounts[1]
    duel, vault = _deploy_wired_pair(creator)
    challenge_id = _open_and_match(duel, creator, opponent, " (wrong-stake)")

    receipt = vault.connect(creator).fund(args=[challenge_id]).transact(value=STAKE + 1)
    assert tx_execution_failed(receipt)


@pytest.mark.integration
def test_rejects_double_funding_by_same_party():
    accounts = get_accounts()
    creator, opponent = accounts[0], accounts[1]
    duel, vault = _deploy_wired_pair(creator)
    challenge_id = _open_and_match(duel, creator, opponent, " (double-fund)")

    first = vault.connect(creator).fund(args=[challenge_id]).transact(value=STAKE)
    assert tx_execution_succeeded(first)

    second = vault.connect(creator).fund(args=[challenge_id]).transact(value=STAKE)
    assert tx_execution_failed(second)


@pytest.mark.integration
def test_rejects_funding_from_uninvolved_party():
    accounts = get_accounts()
    creator, opponent, stranger = accounts[0], accounts[1], accounts[2]
    duel, vault = _deploy_wired_pair(creator)
    challenge_id = _open_and_match(duel, creator, opponent, " (stranger)")

    receipt = vault.connect(stranger).fund(args=[challenge_id]).transact(value=STAKE)
    assert tx_execution_failed(receipt)


@pytest.mark.integration
def test_creator_refund_when_never_matched():
    accounts = get_accounts()
    creator = accounts[0]
    duel, vault = _deploy_wired_pair(creator)
    duel = duel.connect(creator)

    create_receipt = duel.create_challenge(
        args=[
            "Will Atlas publish Release Note A before cutoff? (unmatched-refund)",
            "Yes",
            "No",
            STAKE,
            future_ts(2),
            future_ts(7200),
            future_ts(14400),
            VALID_SOURCES,
            "PRIORITY_ORDER",
            "",
        ]
    ).transact()
    assert tx_execution_succeeded(create_receipt)
    challenge_id = duel.get_challenge_count(args=[]).call() - 1
    duel.run_sanity_check(args=[challenge_id]).transact()

    fund_receipt = vault.connect(creator).fund(args=[challenge_id]).transact(value=STAKE)
    assert tx_execution_succeeded(fund_receipt)

    # Wait out the accept deadline, then expire + refund.
    import time

    time.sleep(5)
    assert tx_execution_succeeded(duel.expire_unmatched(args=[challenge_id]).transact())

    refund_receipt = vault.refund_unmatched(args=[challenge_id]).transact(
        wait_triggered_transactions=True
    )
    assert tx_execution_succeeded(refund_receipt)

    deposit = vault.get_deposit(args=[challenge_id]).call()
    assert deposit["refunded_creator"] is True

    # Exact once.
    second = vault.refund_unmatched(args=[challenge_id]).transact()
    assert tx_execution_failed(second)


@pytest.mark.integration
def test_settle_before_locked_fails():
    accounts = get_accounts()
    creator, opponent = accounts[0], accounts[1]
    duel, vault = _deploy_wired_pair(creator)
    challenge_id = _open_and_match(duel, creator, opponent, " (not-locked)")

    receipt = vault.settle(args=[challenge_id]).transact()
    assert tx_execution_failed(receipt)


@pytest.mark.integration
def test_vault_balance_returns_to_zero_after_full_settlement():
    """Conservation: the vault holds exactly the live stakes in flight and
    nothing more once every challenge it has touched is settled/refunded."""
    accounts = get_accounts()
    creator, opponent = accounts[0], accounts[1]
    duel, vault = _deploy_wired_pair(creator)
    challenge_id = _open_and_match(duel, creator, opponent, " (conservation)")

    vault.connect(creator).fund(args=[challenge_id]).transact(value=STAKE)
    vault.connect(opponent).fund(args=[challenge_id]).transact(
        value=STAKE, wait_triggered_transactions=True
    )
    assert vault.get_balance(args=[]).call() == STAKE * 2

    duel.resolve(args=[challenge_id]).transact(wait_interval=10000, wait_retries=30)
    vault.settle(args=[challenge_id]).transact(wait_triggered_transactions=True)

    assert vault.get_balance(args=[]).call() == 0
