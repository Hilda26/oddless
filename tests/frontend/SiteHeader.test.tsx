import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/duel/SiteHeader";
import { useWallet } from "@/lib/wallet/WalletProvider";

vi.mock("@/lib/wallet/WalletProvider", () => ({
  useWallet: vi.fn(),
}));

vi.mocked(useWallet).mockReturnValue({
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
});

describe("SiteHeader — mobile core flow (spec §15: no desktop-only hover for critical actions)", () => {
  it("renders every primary destination as a real, focusable link — not a hover-only element", () => {
    render(<SiteHeader />);

    // The mobile nav renders the same three destinations as the desktop
    // nav, as real <a> elements (via next/link), reachable by keyboard
    // and tap, not exposed only on :hover.
    const openLinks = screen.getAllByRole("link", { name: /open duels|^open$/i });
    const newLinks = screen.getAllByRole("link", { name: /new duel|^new$/i });
    const mineLinks = screen.getAllByRole("link", { name: /my duels|^mine$/i });

    expect(openLinks.length).toBeGreaterThanOrEqual(1);
    expect(newLinks.length).toBeGreaterThanOrEqual(1);
    expect(mineLinks.length).toBeGreaterThanOrEqual(1);

    for (const link of [...openLinks, ...newLinks, ...mineLinks]) {
      expect(link).toHaveAttribute("href");
      expect(link.tabIndex).not.toBe(-1);
    }
  });
});
