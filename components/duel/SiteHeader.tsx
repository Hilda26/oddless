import Link from "next/link";
import { WalletButton } from "./WalletButton";
import { NetworkBanner } from "./NetworkBanner";

export function SiteHeader() {
  return (
    <>
      <NetworkBanner />
      <header className="sticky top-0 z-40 bg-paper border-b-2 border-ink">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <Link href="/" className="font-display text-2xl tracking-tight">
            ODDLESS
          </Link>
          <nav className="hidden sm:flex items-center gap-6 font-ui text-sm font-semibold uppercase">
            <Link href="/duels" className="hover:text-side-b">
              Open duels
            </Link>
            <Link href="/new" className="hover:text-side-a">
              New duel
            </Link>
            <Link href="/me" className="hover:text-side-b">
              My duels
            </Link>
          </nav>
          <WalletButton />
        </div>
        <nav className="sm:hidden flex items-center justify-around border-t-2 border-ink font-ui text-xs font-semibold uppercase">
          <Link href="/duels" className="flex-1 text-center py-2 hover:bg-acid">
            Open
          </Link>
          <Link href="/new" className="flex-1 text-center py-2 border-x-2 border-ink hover:bg-acid">
            New
          </Link>
          <Link href="/me" className="flex-1 text-center py-2 hover:bg-acid">
            Mine
          </Link>
        </nav>
      </header>
    </>
  );
}
