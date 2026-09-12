import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletProvider, useWallet } from "@/lib/wallet/WalletProvider";

const STUDIONET_HEX = "0xf22f"; // 61999

function TestConsumer() {
  const wallet = useWallet();
  return (
    <div>
      <span data-testid="status">{wallet.status}</span>
      <span data-testid="address">{wallet.address ?? "none"}</span>
      <span data-testid="error">{wallet.error ?? "none"}</span>
      <button onClick={() => void wallet.connect()}>connect</button>
      <button onClick={() => void wallet.switchToStudionet()}>switch</button>
      <button onClick={wallet.disconnect}>disconnect</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <WalletProvider>
      <TestConsumer />
    </WalletProvider>,
  );
}

class MockProvider {
  listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  accounts: string[] = [];
  chainId = STUDIONET_HEX;
  rejectNext = false;

  request = vi.fn(async ({ method }: { method: string }) => {
    if (method === "eth_accounts") return this.accounts;
    if (method === "eth_chainId") return this.chainId;
    if (method === "eth_requestAccounts") {
      if (this.rejectNext) {
        this.rejectNext = false;
        const err: { code?: number } = new Error("User rejected");
        err.code = 4001;
        throw err;
      }
      this.accounts = ["0xAbC0000000000000000000000000000000dEaD"];
      return this.accounts;
    }
    if (method === "wallet_switchEthereumChain") {
      this.chainId = STUDIONET_HEX;
      return null;
    }
    return null;
  });

  on(event: string, handler: (...args: unknown[]) => void) {
    this.listeners[event] ??= [];
    this.listeners[event].push(handler);
  }

  removeListener(event: string, handler: (...args: unknown[]) => void) {
    this.listeners[event] = (this.listeners[event] ?? []).filter((h) => h !== handler);
  }

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.listeners[event] ?? []) handler(...args);
  }
}

let mockProvider: MockProvider | undefined;

beforeEach(() => {
  mockProvider = undefined;
  // @ts-expect-error test override
  delete window.ethereum;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WalletProvider — no wallet installed", () => {
  it("reports NO_WALLET when window.ethereum is absent", async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("NO_WALLET"));
  });
});

describe("WalletProvider — connect flow", () => {
  it("connects and reports CONNECTED on the correct network", async () => {
    mockProvider = new MockProvider();
    // @ts-expect-error test override
    window.ethereum = mockProvider;
    const user = userEvent.setup();
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("DISCONNECTED"));
    await user.click(screen.getByText("connect"));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("CONNECTED"));
    expect(screen.getByTestId("address").textContent).toBe("0xAbC0000000000000000000000000000000dEaD");
  });

  it("surfaces USER_REJECTED-style error on connection rejection", async () => {
    mockProvider = new MockProvider();
    mockProvider.rejectNext = true;
    // @ts-expect-error test override
    window.ethereum = mockProvider;
    const user = userEvent.setup();
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("DISCONNECTED"));
    await user.click(screen.getByText("connect"));

    await waitFor(() => expect(screen.getByTestId("error").textContent).toMatch(/rejected/i));
    expect(screen.getByTestId("status").textContent).toBe("DISCONNECTED");
  });
});

describe("WalletProvider — wrong network", () => {
  it("reports WRONG_NETWORK when connected off Studionet, and can switch", async () => {
    mockProvider = new MockProvider();
    mockProvider.chainId = "0x1"; // mainnet, not Studionet
    mockProvider.accounts = ["0xAbC0000000000000000000000000000000dEaD"];
    // @ts-expect-error test override
    window.ethereum = mockProvider;
    const user = userEvent.setup();
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("WRONG_NETWORK"));

    await user.click(screen.getByText("switch"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("CONNECTED"));
  });
});

describe("WalletProvider — account/provider changes", () => {
  it("moves to DISCONNECTED when the wallet reports no accounts (provider-initiated disconnect)", async () => {
    mockProvider = new MockProvider();
    mockProvider.accounts = ["0xAbC0000000000000000000000000000000dEaD"];
    // @ts-expect-error test override
    window.ethereum = mockProvider;
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("CONNECTED"));

    act(() => {
      mockProvider!.emit("accountsChanged", []);
    });

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("DISCONNECTED"));
  });

  it("app-initiated disconnect clears local state", async () => {
    mockProvider = new MockProvider();
    mockProvider.accounts = ["0xAbC0000000000000000000000000000000dEaD"];
    // @ts-expect-error test override
    window.ethereum = mockProvider;
    const user = userEvent.setup();
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("CONNECTED"));
    await user.click(screen.getByText("disconnect"));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("DISCONNECTED"));
    expect(screen.getByTestId("address").textContent).toBe("none");
  });
});
