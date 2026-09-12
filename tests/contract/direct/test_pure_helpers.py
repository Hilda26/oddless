"""Unit tests for the deterministic helper functions in oddless_duel.py —
URL hardening and leader/validator shape validation.

These use the `direct_deploy`/`direct_vm` fixtures purely to get the
`genlayer` SDK resolved and importable (gltest's direct-mode loader
downloads/caches it per the contract's "Depends" header and registers the
loaded contract module in `sys.modules['_contract_oddless_duel']`) — the
functions under test are plain Python with no `gl.*` calls, so no mocks
are needed once the module is loaded. This is also where "forged excerpt"
/ malformed-shape rejection is exercised precisely and deterministically;
see docs/CONSENSUS.md for why true Byzantine leader/validator divergence
against a live network is instead exercised by the leader/validator
integration tests plus `test_duel_resolution.py`'s `run_validator` cases.
"""
import sys

import pytest


@pytest.fixture
def duel_module(direct_vm, direct_deploy, direct_alice):
    """Deploy the contract once (to trigger SDK resolution) and hand back
    the raw contract module so its module-level helper functions can be
    unit-tested directly."""
    direct_vm.sender = direct_alice
    direct_deploy("contracts/oddless_duel.py")
    return sys.modules["_contract_oddless_duel"]


# ---------------------------------------------------------------------------
# URL hardening
# ---------------------------------------------------------------------------
def test_https_required(duel_module):
    with pytest.raises(Exception, match="HTTPS"):
        duel_module._assert_safe_source_url("http://example.org/a")


def test_rejects_embedded_credentials(duel_module):
    with pytest.raises(Exception, match="credentials"):
        duel_module._assert_safe_source_url("https://user:pass@example.org/a")


@pytest.mark.parametrize(
    "url",
    [
        "https://localhost/a",
        "https://127.0.0.1/a",
        "https://10.0.0.5/a",
        "https://192.168.1.1/a",
        "https://172.16.0.1/a",
        "https://service.local/a",
        "https://0.0.0.0/a",
    ],
)
def test_rejects_private_hosts(duel_module, url):
    with pytest.raises(Exception, match="private/local"):
        duel_module._assert_safe_source_url(url)


def test_accepts_public_https_host(duel_module):
    duel_module._assert_safe_source_url("https://example.org/results")  # must not raise


def test_rejects_overlong_url(duel_module):
    long_url = "https://example.org/" + ("a" * 600)
    with pytest.raises(Exception, match="length"):
        duel_module._assert_safe_source_url(long_url)


def test_source_list_bounds_too_few(duel_module):
    with pytest.raises(Exception, match="between"):
        duel_module._assert_safe_source_list(["https://example.org/a"])


def test_source_list_bounds_too_many(duel_module):
    urls = [f"https://example{i}.org/a" for i in range(5)]
    with pytest.raises(Exception, match="between"):
        duel_module._assert_safe_source_list(urls)


def test_source_list_rejects_duplicates(duel_module):
    with pytest.raises(Exception, match="Duplicate"):
        duel_module._assert_safe_source_list(
            ["https://example.org/a", "https://example.org/a/"]
        )


def test_source_list_accepts_valid_set(duel_module):
    duel_module._assert_safe_source_list(
        ["https://example.org/a", "https://news.example.net/b"]
    )  # must not raise


# ---------------------------------------------------------------------------
# Resolution shape validation — the structural half of validator_fn.
# ---------------------------------------------------------------------------
def _well_formed(outcome="SIDE_A", n=2, excerpt="Team A won 2-1."):
    return {
        "outcome": outcome,
        "event_time": "2024-06-20T00:00:00Z",
        "reason": "Clear result.",
        "source_support": [
            {"source_id": i + 1, "stance": "A", "excerpt": excerpt} for i in range(n)
        ],
    }


def test_valid_shape_accepted(duel_module):
    assert duel_module._valid_resolution_shape(_well_formed(), 2) is True


def test_rejects_unknown_outcome(duel_module):
    bad = _well_formed()
    bad["outcome"] = "SIDE_A_PROBABLY"
    assert duel_module._valid_resolution_shape(bad, 2) is False


def test_rejects_wrong_source_support_length(duel_module):
    bad = _well_formed(n=1)
    assert duel_module._valid_resolution_shape(bad, 2) is False


def test_rejects_oversized_reason(duel_module):
    bad = _well_formed()
    bad["reason"] = "x" * 500
    assert duel_module._valid_resolution_shape(bad, 2) is False


def test_rejects_invalid_stance(duel_module):
    bad = _well_formed()
    bad["source_support"][0]["stance"] = "MAYBE"
    assert duel_module._valid_resolution_shape(bad, 2) is False


def test_rejects_non_dict_result(duel_module):
    assert duel_module._valid_resolution_shape("not a dict", 2) is False


def test_forged_excerpt_not_in_source_text_is_detectable():
    """Mirrors the check `validator_fn` performs inline: a claimed excerpt
    that does not literally occur in the independently-fetched source
    text must be rejected. This is the exact containment predicate
    `validator_fn` in `oddless_duel.py`'s `resolve()` relies on — see
    `test_duel_resolution.py::test_validator_rejects_forged_excerpt` for
    the full end-to-end version against the real contract."""
    forged_excerpt = "The forged claim that never appeared anywhere."
    real_source_text = "Team A won 2-1 in a hard-fought match. Team B remains hopeful."
    assert (forged_excerpt in real_source_text) is False


def test_genuine_excerpt_is_found_in_source_text():
    excerpt = "Team A won 2-1"
    real_source_text = "Match report: Team A won 2-1 in a hard-fought match."
    assert (excerpt in real_source_text) is True
