"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Picks" },
  { href: "/track-record", label: "Track record" },
  { href: "/methodology", label: "Methodology" },
];

// Brand mark: a rising candle line on a gradient tile.
function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.62 0.17 258)" />
          <stop offset="100%" stopColor="oklch(0.5 0.19 275)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
      <path d="M7 21.5l5.5-5.5 4 3.5L25 10.5" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="10.5" r="2.4" fill="oklch(0.85 0.17 155)" />
    </svg>
  );
}

export function SiteHeader({ status }: { status: React.ReactNode }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span className="hidden sm:inline">NEPSE<span className="text-primary">Picks</span></span>
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" || path.startsWith("/stock") : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn("shrink-0 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors sm:px-3", active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {status}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
