"use client";

import { useCallback, useRef, useState } from "react";
import { getReadClient } from "@/lib/genlayer/client";
import type { TransactionHash } from "genlayer-js/types";

/**
 * The full write-transaction lifecycle (spec §13). A transaction hash is
 * never treated as application success — every write flow visibly passes
 * through these states, and a finalized failure never leaves the UI
 * spinning.
 */
export type TxState =
  | "IDLE"
  | "AWAITING_SIGNATURE"
  | "SUBMITTED"
  | "CONSENSUS_RUNNING"
  | "FINALIZED"
  | "EXECUTION_CONFIRMED"
  | "STATE_REREAD"
  | "DONE"
  | "USER_REJECTED"
  | "WRONG_NETWORK"
  | "RPC_ERROR"
  | "CONSENSUS_FAILURE"
  | "EXECUTION_ERROR"
  | "STATE_MISMATCH";

export const TX_FAILURE_STATES: ReadonlySet<TxState> = new Set([
  "USER_REJECTED",
  "WRONG_NETWORK",
  "RPC_ERROR",
  "CONSENSUS_FAILURE",
  "EXECUTION_ERROR",
  "STATE_MISMATCH",
]);

export function isTerminal(state: TxState): boolean {
  return state === "DONE" || TX_FAILURE_STATES.has(state);
}

export function isFailure(state: TxState): boolean {
  return TX_FAILURE_STATES.has(state);
}

interface ExecuteParams<T> {
  /** Guard evaluated before anything else — e.g. `isCorrectNetwork`. */
  isCorrectNetwork: boolean;
  /** Perform the signed write; must resolve to the transaction hash. */
  write: () => Promise<`0x${string}`>;
  /** Re-read the affected contract state after finalization. */
  reread: () => Promise<T>;
  /** Optional sanity check on the re-read state; false => STATE_MISMATCH. */
  validate?: (result: T) => boolean;
  /** Retries/interval for waitForTransactionReceipt (defaults are generous
   * for Studionet's consensus latency). */
  retries?: number;
  intervalMs?: number;
}

interface TxHookState<T> {
  state: TxState;
  txHash: `0x${string}` | null;
  error: string | null;
  result: T | null;
}

const initial = <T,>(): TxHookState<T> => ({
  state: "IDLE",
  txHash: null,
  error: null,
  result: null,
});

/**
 * Generic transaction-lifecycle hook shared by every write flow in the
 * app (create, sanity-check, accept, fund, resolve, settle, refund).
 * Concrete flows only supply `write` / `reread` / `validate`.
 */
export function useTransaction<T>() {
  const [state, setState] = useState<TxHookState<T>>(initial<T>());
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setState(initial<T>());
  }, []);

  const execute = useCallback(async (params: ExecuteParams<T>): Promise<boolean> => {
    const runId = ++runIdRef.current;
    const stillCurrent = () => runIdRef.current === runId;

    if (!params.isCorrectNetwork) {
      setState({ state: "WRONG_NETWORK", txHash: null, error: "Wrong network — switch to Studionet.", result: null });
      return false;
    }

    setState({ state: "AWAITING_SIGNATURE", txHash: null, error: null, result: null });

    let hash: `0x${string}`;
    try {
      hash = await params.write();
    } catch (err: unknown) {
      if (!stillCurrent()) return false;
      const code = (err as { code?: number })?.code;
      if (code === 4001) {
        setState({ state: "USER_REJECTED", txHash: null, error: "Transaction was rejected in your wallet.", result: null });
      } else {
        setState({
          state: "RPC_ERROR",
          txHash: null,
          error: err instanceof Error ? err.message : "RPC error while submitting the transaction.",
          result: null,
        });
      }
      return false;
    }

    if (!stillCurrent()) return false;
    setState({ state: "SUBMITTED", txHash: hash, error: null, result: null });
    setState((prev) => ({ ...prev, state: "CONSENSUS_RUNNING" }));

    const client = getReadClient();
    let receipt: Awaited<ReturnType<typeof client.waitForTransactionReceipt>>;
    try {
      receipt = await client.waitForTransactionReceipt({
        hash: hash as unknown as TransactionHash,
        retries: params.retries ?? 30,
        interval: params.intervalMs ?? 5000,
      });
    } catch (err) {
      if (!stillCurrent()) return false;
      setState({
        state: "CONSENSUS_FAILURE",
        txHash: hash,
        error: err instanceof Error ? err.message : "Consensus did not finalize this transaction in time.",
        result: null,
      });
      return false;
    }

    if (!stillCurrent()) return false;
    setState((prev) => ({ ...prev, state: "FINALIZED" }));

    const executionFailed =
      (receipt as { txExecutionResultName?: string }).txExecutionResultName === "FINISHED_WITH_ERROR" ||
      (receipt as { statusName?: string }).statusName === "CANCELED";
    if (executionFailed) {
      setState({
        state: "EXECUTION_ERROR",
        txHash: hash,
        error: "The transaction finalized but execution failed on-chain.",
        result: null,
      });
      return false;
    }

    setState((prev) => ({ ...prev, state: "EXECUTION_CONFIRMED" }));
    setState((prev) => ({ ...prev, state: "STATE_REREAD" }));

    let result: T;
    try {
      result = await params.reread();
    } catch (err) {
      if (!stillCurrent()) return false;
      setState({
        state: "RPC_ERROR",
        txHash: hash,
        error: err instanceof Error ? err.message : "Failed to re-read contract state after finalization.",
        result: null,
      });
      return false;
    }

    if (!stillCurrent()) return false;
    if (params.validate && !params.validate(result)) {
      setState({
        state: "STATE_MISMATCH",
        txHash: hash,
        error: "Re-read on-chain state did not match the expected outcome.",
        result,
      });
      return false;
    }

    setState({ state: "DONE", txHash: hash, error: null, result });
    return true;
  }, []);

  return { ...state, execute, reset, isTerminal: isTerminal(state.state), isFailure: isFailure(state.state) };
}
