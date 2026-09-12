# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
oddless_vault.py — Oddless Vault contract.

Owns native GEN custody and settlement for exactly-two-party duels. Never
runs an LLM and never performs a nondeterministic block — all money math
here is plain deterministic arithmetic gated on state it reads from
`oddless_duel.py` through a typed `@gl.contract_interface`. This is the
"leader/validator standard does not apply to money" half of the design:
Duel decides *what happened*, Vault decides *who gets paid* from that
already-consensus-settled fact, exact once.

See docs/ARCHITECTURE.md for the cross-contract boundary and
docs/SECURITY.md for the replay/idempotence guarantees this relies on.
"""
from dataclasses import dataclass
from genlayer import *

# See oddless_duel.py for why this exists instead of `Address.ZERO`.
ZERO_ADDRESS = Address("0x" + "0" * 40)

STATUS_OPEN = "OPEN"
STATUS_MATCHED = "MATCHED"
STATUS_LOCKED = "LOCKED"
STATUS_SIDE_A_WIN = "SIDE_A_WIN"
STATUS_SIDE_B_WIN = "SIDE_B_WIN"
STATUS_VOID = "VOID"
STATUS_CANCELLED = "CANCELLED"


@gl.contract_interface
class IOddlessDuel:
    class View:
        def get_challenge_for_settlement(self, challenge_id: u256) -> dict: ...

    class Write:
        def mark_locked(self, challenge_id: u256) -> None: ...
        def mark_settled(self, challenge_id: u256) -> None: ...


@allow_storage
@dataclass
class Deposit:
    creator_paid: u256
    opponent_paid: u256
    refunded_creator: bool
    refunded_opponent: bool
    settled: bool


class OddlessVault(gl.Contract):
    duel_address: Address
    owner: Address
    deposits: TreeMap[u256, Deposit]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.duel_address = ZERO_ADDRESS

    # ------------------------------------------------------------------
    # Wiring
    # ------------------------------------------------------------------
    @gl.public.write
    def set_duel(self, duel_address: str) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("Only the deployer may set the duel contract")
        if self.duel_address != ZERO_ADDRESS:
            raise Exception("Duel already set")
        self.duel_address = Address(duel_address)

    def _duel(self) -> "IOddlessDuel":
        if self.duel_address == ZERO_ADDRESS:
            raise Exception("Duel contract not configured")
        return IOddlessDuel(self.duel_address)

    def _get_or_init_deposit(self, challenge_id: u256) -> Deposit:
        if challenge_id not in self.deposits:
            self.deposits[challenge_id] = Deposit(
                creator_paid=u256(0),
                opponent_paid=u256(0),
                refunded_creator=False,
                refunded_opponent=False,
                settled=False,
            )
        return self.deposits[challenge_id]

    # ------------------------------------------------------------------
    # Funding — exact stake, exact once per participant (spec §6, §9).
    # ------------------------------------------------------------------
    @gl.public.write.payable
    def fund(self, challenge_id: u256) -> None:
        duel = self._duel()
        info = duel.view().get_challenge_for_settlement(challenge_id)
        status = info["status"]
        if status not in (STATUS_OPEN, STATUS_MATCHED):
            raise Exception("Challenge is not open for funding")

        stake = int(info["stake"])
        value = int(gl.message.value)
        if value != stake:
            raise Exception("Must fund the exact stake amount — no overfunding, no underfunding")

        sender = gl.message.sender_address
        creator = Address(info["creator"])
        opponent_hex = info["opponent"]
        opponent = Address(opponent_hex) if opponent_hex else ZERO_ADDRESS

        deposit = self._get_or_init_deposit(challenge_id)

        if sender == creator:
            if int(deposit.creator_paid) != 0:
                raise Exception("Creator has already funded this challenge")
            deposit.creator_paid = u256(value)
        elif opponent != ZERO_ADDRESS and sender == opponent:
            if status != STATUS_MATCHED:
                raise Exception("Opponent must be matched before funding")
            if int(deposit.opponent_paid) != 0:
                raise Exception("Opponent has already funded this challenge")
            deposit.opponent_paid = u256(value)
        else:
            raise Exception("Only the creator or matched opponent may fund this challenge")

        self.deposits[challenge_id] = deposit

        both_funded = int(deposit.creator_paid) == stake and int(deposit.opponent_paid) == stake
        if status == STATUS_MATCHED and both_funded:
            # Cross-contract state transition — Duel is the sole authority
            # over its own status; Vault only ever *requests* the flip
            # after independently observing both deposits credited.
            duel.emit().mark_locked(challenge_id)

    # ------------------------------------------------------------------
    # Refunds for challenges that never matched/never got fully funded.
    # ------------------------------------------------------------------
    @gl.public.write
    def refund_unmatched(self, challenge_id: u256) -> None:
        duel = self._duel()
        info = duel.view().get_challenge_for_settlement(challenge_id)
        if info["status"] != STATUS_CANCELLED:
            raise Exception("Challenge is not cancelled")

        if challenge_id not in self.deposits:
            raise Exception("No deposits recorded for this challenge")
        deposit = self.deposits[challenge_id]

        creator = Address(info["creator"])
        opponent_hex = info["opponent"]
        opponent = Address(opponent_hex) if opponent_hex else ZERO_ADDRESS

        refunded_any = False

        if int(deposit.creator_paid) > 0 and not deposit.refunded_creator:
            amount = int(deposit.creator_paid)
            deposit.refunded_creator = True
            self.deposits[challenge_id] = deposit  # state before transfer
            gl.get_contract_at(creator).emit_transfer(u256(amount))
            deposit = self.deposits[challenge_id]
            refunded_any = True

        if (
            opponent != ZERO_ADDRESS
            and int(deposit.opponent_paid) > 0
            and not deposit.refunded_opponent
        ):
            amount = int(deposit.opponent_paid)
            deposit.refunded_opponent = True
            self.deposits[challenge_id] = deposit  # state before transfer
            gl.get_contract_at(opponent).emit_transfer(u256(amount))
            refunded_any = True

        if not refunded_any:
            raise Exception("Nothing left to refund")

    # ------------------------------------------------------------------
    # Settlement — exact once, beneficiary and amount fully deterministic
    # from Duel's already-settled decision (spec §11).
    # ------------------------------------------------------------------
    @gl.public.write
    def settle(self, challenge_id: u256) -> str:
        duel = self._duel()
        info = duel.view().get_challenge_for_settlement(challenge_id)
        status = info["status"]
        if status not in (STATUS_SIDE_A_WIN, STATUS_SIDE_B_WIN, STATUS_VOID):
            raise Exception("Challenge is not in a resolved state")

        if challenge_id not in self.deposits:
            raise Exception("No deposits recorded for this challenge")
        deposit = self.deposits[challenge_id]
        if deposit.settled:
            raise Exception("Already settled")

        stake = int(info["stake"])
        creator = Address(info["creator"])
        opponent_hex = info["opponent"]
        if not opponent_hex:
            raise Exception("Challenge has no matched opponent")
        opponent = Address(opponent_hex)

        if int(deposit.creator_paid) != stake or int(deposit.opponent_paid) != stake:
            raise Exception("Both parties must have funded the exact stake before settlement")

        # State updates before outbound transfer/message (spec §9).
        deposit.settled = True
        self.deposits[challenge_id] = deposit

        if status == STATUS_VOID:
            gl.get_contract_at(creator).emit_transfer(u256(stake))
            gl.get_contract_at(opponent).emit_transfer(u256(stake))
        else:
            winner_side = info["winner_side"]
            beneficiary = creator if winner_side == "A" else opponent
            pot = u256(stake * 2)
            gl.get_contract_at(beneficiary).emit_transfer(pot)

        duel.emit().mark_settled(challenge_id)
        return status

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------
    @gl.public.view
    def get_deposit(self, challenge_id: u256) -> dict:
        if challenge_id not in self.deposits:
            return {
                "creator_paid": 0,
                "opponent_paid": 0,
                "refunded_creator": False,
                "refunded_opponent": False,
                "settled": False,
            }
        d = self.deposits[challenge_id]
        return {
            "creator_paid": int(d.creator_paid),
            "opponent_paid": int(d.opponent_paid),
            "refunded_creator": d.refunded_creator,
            "refunded_opponent": d.refunded_opponent,
            "settled": d.settled,
        }

    @gl.public.view
    def get_balance(self) -> int:
        return int(self.balance)
