"""Direct-mode tests for OddlessVault that don't require a live Duel
deployment. gltest's direct mode is a single-contract-per-VM harness (it
has no cross-contract dispatch hook installed by default — attempting a
real `gl.get_contract_at(...)`/`@gl.contract_interface` call raises), so
`fund` / `refund_unmatched` / `settle` (each of which reads Duel through
`@gl.contract_interface`) are exercised in the integration suite instead
— see tests/contract/integration/test_oddless_vault.py and
docs/CONSENSUS.md for why."""
from tests.contract.direct.conftest import to_hex


def test_get_deposit_defaults_for_unknown_challenge(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    vault = direct_deploy("contracts/oddless_vault.py")

    deposit = vault.get_deposit(999)
    assert deposit == {
        "creator_paid": 0,
        "opponent_paid": 0,
        "refunded_creator": False,
        "refunded_opponent": False,
        "settled": False,
    }


def test_get_balance_starts_at_zero(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    vault = direct_deploy("contracts/oddless_vault.py")
    assert vault.get_balance() == 0


def test_set_duel_can_only_be_called_once_by_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice  # deployer/owner — must be set before deploy
    vault = direct_deploy("contracts/oddless_vault.py")

    vault.set_duel(to_hex(direct_bob))
    with direct_vm.expect_revert("already set"):
        vault.set_duel(to_hex(direct_bob))


def test_set_duel_rejects_non_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    vault = direct_deploy("contracts/oddless_vault.py")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the deployer"):
        vault.set_duel(to_hex(direct_bob))


def test_fund_without_duel_configured_reverts(direct_vm, direct_deploy, direct_alice):
    """Calling into an unwired Vault fails clearly rather than silently —
    the `_duel()` guard runs before any cross-contract dispatch is
    attempted."""
    direct_vm.sender = direct_alice
    vault = direct_deploy("contracts/oddless_vault.py")

    direct_vm.value = 1  # payable methods read value via vm.value, not a call kwarg
    with direct_vm.expect_revert("Duel contract not configured"):
        vault.fund(0)
