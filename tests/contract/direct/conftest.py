"""Shared helpers for direct-mode (in-memory, mocked) contract tests."""
import datetime as _dt
import json
import sys
import time


def to_hex(addr_bytes):
    """Convert address bytes/objects to checksummed hex matching contract
    output. The contracts return addresses via `Address.as_hex`, which
    produces EIP-55 checksummed hex."""
    if hasattr(addr_bytes, "as_hex"):
        return addr_bytes.as_hex
    from genlayer.py.types import Address

    return Address(addr_bytes).as_hex


def future_ts(seconds_from_now: int) -> int:
    return int(time.time()) + seconds_from_now


def warp_forward(direct_vm, seconds: int) -> None:
    """Advance the direct-mode VM's transaction clock by `seconds`. The VM
    exposes only `warp(iso_timestamp)` (absolute), so this reads the
    current `_datetime`, adds the offset, and warps forward.

    gltest's `vm.warp()` updates `vm._datetime` (which feeds
    `datetime.datetime.now()` inside the active VM context) but does not
    propagate into an already-imported contract's frozen
    `gl.message_raw["datetime"]` snapshot — unlike `sender`/`value`,
    which `VMContext._refresh_gl_message()` keeps live on every call.
    `oddless_duel.py` reads `gl.message_raw["datetime"]` (the stable
    v0.2.12 API for deterministic transaction time — see its `_now()`),
    so this helper mirrors that same refresh for `datetime`, purely as a
    test-time convenience; nothing about the contract itself changes.
    """
    current = _dt.datetime.fromisoformat(direct_vm._datetime.replace("Z", "+00:00"))
    new = current + _dt.timedelta(seconds=seconds)
    new_iso = new.isoformat().replace("+00:00", "Z")
    direct_vm.warp(new_iso)

    gl = sys.modules.get("genlayer.gl")
    if gl is not None and getattr(gl, "message_raw", None) is not None:
        gl.message_raw["datetime"] = new_iso


VALID_SOURCES = [
    "https://example.org/results",
    "https://news.example.net/scores",
]

SANITY_VALID_JSON = json.dumps(
    {"classification": "VALID_BINARY", "reason": "Two clear, mutually exclusive outcomes."}
)
SANITY_AMBIGUOUS_JSON = json.dumps(
    {"classification": "AMBIGUOUS", "reason": "Wording is unclear."}
)


def resolution_payload(outcome: str, n_sources: int, event_time="2024-06-20T00:00:00Z", excerpt=None):
    """Build a well-formed resolve() judgment dict (not yet JSON-encoded —
    useful both for LLM mocking and for `direct_vm.run_validator(leader_result=...)`
    overrides)."""
    stance = "A" if outcome == "SIDE_A" else ("B" if outcome == "SIDE_B" else "UNCLEAR")
    default_excerpt = "Match result: 1:0. Winner: team A." if outcome not in ("VOID",) else ""
    support = [
        {
            "source_id": i + 1,
            "stance": stance,
            "excerpt": excerpt if excerpt is not None else default_excerpt,
        }
        for i in range(n_sources)
    ]
    return {
        "outcome": outcome,
        "event_time": event_time,
        "source_support": support,
        "reason": f"Outcome determined as {outcome} from provided sources.",
    }


def resolution_json(outcome: str, n_sources: int, event_time="2024-06-20T00:00:00Z", excerpt=None):
    return json.dumps(resolution_payload(outcome, n_sources, event_time, excerpt))
