"use client";

import { ChartNoAxesCombined } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Picks" },
  { href: "/track-record", label: "Track record" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader({ status }: { status: React.ReactNode }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ChartNoAxesCombined className="size-4" />
          </span>
          <span className="hidden sm:inline">NEPSE Picks</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" || path.startsWith("/stock") : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn("rounded-md px-3 py-1.5 transition-colors", active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {status}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
