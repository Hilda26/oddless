import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WalletButton } from "@/components/duel/WalletButton";
import { useWallet } from "@/lib/wallet/WalletProvider";

vi.mock("@/lib/wallet/WalletProvider", () => ({
  useWallet: vi.fn(),
}));

const mockedUseWallet = vi.mocked(useWallet);

function setWallet(overrides: Partial<ReturnType<typeof useWallet>>) {
  mockedUseWallet.mockReturnValue({
    status: "DISCONNECTED",
    address: null,
    chainId: null,
    error: null,
    hasWallet: true,
    isCorrectNetwork: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    switchToStudionet: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  });
}

describe("WalletButton — renders the right affordance per wallet state", () => {
  it("NO_WALLET: offers an install link, not a connect button", () => {
    setWallet({ status: "NO_WALLET" });
    render(<WalletButton />);
    expect(screen.getByText(/install a wallet/i)).toBeInTheDocument();
  });

  it("DISCONNECTED: shows a Connect wallet button", () => {
    setWallet({ status: "DISCONNECTED" });
    render(<WalletButton />);
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("WRONG_NETWORK: shows a switch-network button, distinctly styled as a warning", () => {
    setWallet({ status: "WRONG_NETWORK" });
    render(<WalletButton />);
    expect(screen.getByRole("button", { name: /wrong network/i })).toBeInTheDocument();
  });

  it("CONNECTED: shows the truncated address and a disconnect button", () => {
    setWallet({ status: "CONNECTED", address: "0xAbC0000000000000000000000000000000dEaD" });
    render(<WalletButton />);
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/copy wallet address/i)).toHaveTextContent("0xAbC0…dEaD");
  });
});
