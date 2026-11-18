"use client";

import { BookOpen, LineChart, ListChecks, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Today's Picks", icon: ListChecks },
  { href: "/track-record", label: "Performance", icon: LineChart },
  { href: "/methodology", label: "How it works", icon: BookOpen },
];

// Brand mark: a price line dipping into a highlighted buy-zone band on a gradient tile.
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
      <rect x="5" y="15" width="22" height="8" rx="2" fill="white" fillOpacity="0.22" />
      <path d="M7 10l5 3.5 4 6.5 3-4 6 -7" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="20" r="2.4" fill="oklch(0.85 0.17 155)" />
    </svg>
  );
}

export function SiteHeader({ status }: { status: React.ReactNode }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/65">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="BuyZone home">
          <Logo />
          <span className="hidden text-base font-semibold tracking-tight sm:inline">Buy<span className="text-primary">Zone</span></span>
        </Link>
        <nav aria-label="Main" className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" || path.startsWith("/stock") : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 whitespace-nowrap transition-colors sm:px-3",
                  active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <n.icon className="hidden size-4 sm:block" />
                {n.label}
                {active && <span aria-hidden className="absolute inset-x-3 -bottom-[13px] hidden h-0.5 rounded-full bg-primary sm:block" />}
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
