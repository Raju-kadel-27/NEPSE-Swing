import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared page hero: eyebrow pill, title, intro and an optional aside (e.g. the hold-period picker).
export function PageHeader({ icon: Icon, eyebrow, title, children, aside, className }: {
  icon: LucideIcon; eyebrow: string; title: React.ReactNode; children?: React.ReactNode; aside?: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden rounded-3xl border bg-card", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_0%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent),radial-gradient(40%_70%_at_100%_100%,color-mix(in_oklch,var(--success)_10%,transparent),transparent)]" />
      <div className={cn("relative grid gap-6 p-5 sm:p-7 lg:p-8", aside && "lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10")}>
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border bg-background/70 py-1 pr-3 pl-2.5 text-xs font-medium backdrop-blur">
            <Icon className="size-3.5 text-primary" /> {eyebrow}
          </p>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
          {children && <div className="max-w-2xl space-y-2 text-sm text-muted-foreground sm:text-base">{children}</div>}
        </div>
        {aside && <div className="space-y-2.5 rounded-2xl border bg-background/80 p-4 shadow-sm backdrop-blur lg:w-[22rem]">{aside}</div>}
      </div>
    </section>
  );
}
