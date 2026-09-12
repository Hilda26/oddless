import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTransaction } from "@/lib/tx/useTransaction";

const waitForTransactionReceipt = vi.fn();

vi.mock("@/lib/genlayer/client", () => ({
  getReadClient: () => ({ waitForTransactionReceipt }),
}));

beforeEach(() => {
  waitForTransactionReceipt.mockReset();
});

describe("useTransaction lifecycle", () => {
  it("short-circuits to WRONG_NETWORK without attempting a write", async () => {
    const { result } = renderHook(() => useTransaction<null>());
    const write = vi.fn();

    await act(async () => {
      await result.current.execute({
        isCorrectNetwork: false,
        write,
        reread: async () => null,
      });
    });

    expect(result.current.state).toBe("WRONG_NETWORK");
    expect(write).not.toHaveBeenCalled();
  });

  it("reports USER_REJECTED when the wallet rejects (error code 4001)", async () => {
    const { result } = renderHook(() => useTransaction<null>());
    const write = vi.fn().mockRejectedValue(Object.assign(new Error("rejected"), { code: 4001 }));

    await act(async () => {
      await result.current.execute({ isCorrectNetwork: true, write, reread: async () => null });
    });

    expect(result.current.state).toBe("USER_REJECTED");
  });

  it("reports RPC_ERROR on a non-rejection write failure", async () => {
    const { result } = renderHook(() => useTransaction<null>());
    const write = vi.fn().mockRejectedValue(new Error("network down"));

    await act(async () => {
      await result.current.execute({ isCorrectNetwork: true, write, reread: async () => null });
    });

    expect(result.current.state).toBe("RPC_ERROR");
    expect(result.current.error).toMatch(/network down/);
  });

  it("walks through SUBMITTED -> ... -> DONE on a clean finalized success, re-reading state", async () => {
    waitForTransactionReceipt.mockResolvedValue({
      statusName: "FINALIZED",
      txExecutionResultName: "FINISHED_WITH_RETURN",
    });
    const reread = vi.fn().mockResolvedValue({ ok: true });
    const write = vi.fn().mockResolvedValue("0xhash");

    const { result } = renderHook(() => useTransaction<{ ok: boolean }>());

    await act(async () => {
      await result.current.execute({ isCorrectNetwork: true, write, reread });
    });

    expect(result.current.state).toBe("DONE");
    expect(result.current.txHash).toBe("0xhash");
    expect(result.current.result).toEqual({ ok: true });
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it("reports EXECUTION_ERROR on a finalized-but-failed execution, without calling reread", async () => {
    waitForTransactionReceipt.mockResolvedValue({
      statusName: "FINALIZED",
      txExecutionResultName: "FINISHED_WITH_ERROR",
    });
    const reread = vi.fn().mockResolvedValue(null);
    const write = vi.fn().mockResolvedValue("0xhash");

    const { result } = renderHook(() => useTransaction<null>());

    await act(async () => {
      await result.current.execute({ isCorrectNetwork: true, write, reread });
    });

    expect(result.current.state).toBe("EXECUTION_ERROR");
    expect(reread).not.toHaveBeenCalled();
  });

  it("reports CONSENSUS_FAILURE when the receipt never arrives in time", async () => {
    waitForTransactionReceipt.mockRejectedValue(new Error("timed out"));
    const write = vi.fn().mockResolvedValue("0xhash");

    const { result } = renderHook(() => useTransaction<null>());

    await act(async () => {
      await result.current.execute({ isCorrectNetwork: true, write, reread: async () => null });
    });

    expect(result.current.state).toBe("CONSENSUS_FAILURE");
  });

  it("reports STATE_MISMATCH when re-read state fails validation", async () => {
    waitForTransactionReceipt.mockResolvedValue({ statusName: "FINALIZED" });
    const write = vi.fn().mockResolvedValue("0xhash");

    const { result } = renderHook(() => useTransaction<{ status: string }>());

    await act(async () => {
      await result.current.execute({
        isCorrectNetwork: true,
        write,
        reread: async () => ({ status: "SOMETHING_UNEXPECTED" }),
        validate: (r) => r.status === "EXPECTED",
      });
    });

    expect(result.current.state).toBe("STATE_MISMATCH");
  });

  it("never reports success from the tx hash alone — reread always runs before DONE", async () => {
    let rereadCalled = false;
    waitForTransactionReceipt.mockImplementation(async () => {
      expect(rereadCalled).toBe(false); // hash exists, but reread hasn't run yet
      return { statusName: "FINALIZED" };
    });
    const reread = vi.fn().mockImplementation(async () => {
      rereadCalled = true;
      return null;
    });
    const write = vi.fn().mockResolvedValue("0xhash");

    const { result } = renderHook(() => useTransaction<null>());
    await act(async () => {
      await result.current.execute({ isCorrectNetwork: true, write, reread });
    });

    expect(rereadCalled).toBe(true);
    expect(result.current.state).toBe("DONE");
  });
});
