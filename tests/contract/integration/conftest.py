"""Shared helpers for integration tests (require a running GenLayer node —
Studionet by default per gltest.config.yaml; point at localnet for a fast
local loop during development).

Run with:  gltest tests/contract/integration/ -v -s

These tests are opt-in (spec §18: "Live funded Studionet checks must be
opt-in") — they are never part of the default `npm test`/CI-required
pipeline, only a separate, explicitly-invoked CI job.
"""
import time


def future_ts(seconds_from_now: int) -> int:
    return int(time.time()) + seconds_from_now


VALID_SOURCES = [
    "https://example.org/results",
    "https://news.example.net/scores",
]
