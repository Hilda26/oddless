import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import { WalletProvider } from "@/lib/wallet/WalletProvider";
import { SiteHeader } from "@/components/duel/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Oddless — Two sides. Same stake. No house.",
    template: "%s — Oddless",
  },
  description:
    "No-house, equal-stake, two-wallet public-event duels settled by GenLayer Intelligent Contracts on Studionet.",
};

export const viewport: Viewport = {
  themeColor: "#f2f0ea",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-acid focus:text-ink focus:px-4 focus:py-2 focus:font-ui focus:font-bold"
        >
          Skip to content
        </a>
        <WalletProvider>
          <SiteHeader />
          <main id="main-content">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
