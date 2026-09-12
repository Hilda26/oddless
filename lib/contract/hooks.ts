"use client";

import { useCallback, useEffect, useState } from "react";
import { duelContract } from "./duel";
import { vaultContract } from "./vault";
import type { Challenge, Deposit } from "./types";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Poll a single challenge's on-chain state. Contract state is
 * authoritative — this never substitutes local/optimistic data for a
 * real re-read (spec §11, §13). */
export function useChallenge(challengeId: bigint | null, pollMs = 6000) {
  const [state, setState] = useState<AsyncState<Challenge>>({
    data: null,
    loading: challengeId !== null,
    error: null,
  });

  const refetch = useCallback(async () => {
    if (challengeId === null) return;
    try {
      const data = await duelContract.getChallenge(challengeId);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load challenge.",
      }));
    }
  }, [challengeId]);

  useEffect(() => {
    if (challengeId === null) return;
    setState({ data: null, loading: true, error: null });
    void refetch();
    const id = setInterval(() => void refetch(), pollMs);
    return () => clearInterval(id);
  }, [challengeId, pollMs, refetch]);

  return { ...state, refetch };
}

export function useDeposit(challengeId: bigint | null, pollMs = 6000) {
  const [state, setState] = useState<AsyncState<Deposit>>({
    data: null,
    loading: challengeId !== null,
    error: null,
  });

  const refetch = useCallback(async () => {
    if (challengeId === null) return;
    try {
      const data = await vaultContract.getDeposit(challengeId);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load deposit.",
      }));
    }
  }, [challengeId]);

  useEffect(() => {
    if (challengeId === null) return;
    void refetch();
    const id = setInterval(() => void refetch(), pollMs);
    return () => clearInterval(id);
  }, [challengeId, pollMs, refetch]);

  return { ...state, refetch };
}

/** Bounded listing of challenges for /duels and /me. Fetches ids then
 * each challenge; bounded by MAX_LIST to keep the page responsive. */
const MAX_LIST = 60;

export function useChallengeList(pollMs = 15000) {
  const [state, setState] = useState<AsyncState<Challenge[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    try {
      const ids = await duelContract.listChallengeIds();
      const bounded = ids.slice(-MAX_LIST).reverse();
      const challenges = await Promise.all(bounded.map((id) => duelContract.getChallenge(id)));
      setState({ data: challenges, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load duels.",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void refetch();
    };
    run();
    const id = setInterval(run, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refetch, pollMs]);

  return { ...state, refetch };
}
