import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Info } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMeta } from "@/lib/data";
import { longDate } from "@/lib/format";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "NEPSE Picks", template: "%s · NEPSE Picks" },
  description: "Ranked NEPSE stock ideas for a 2-3 month holding period, from fundamentals, technicals and risk.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { isDemo, asOf, historyDays } = await getMeta();

  const status = (
    <span className="hidden items-center gap-2 rounded-full border px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
      <span className={`size-1.5 rounded-full ${isDemo ? "bg-warning" : "bg-success"}`} />
      {isDemo ? "Demo data" : `Prices as of ${longDate(asOf)}`}
    </span>
  );

  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delayDuration={150}>
            {isDemo && (
              <div className="bg-warning/15 px-4 py-2 text-center text-sm text-foreground">
                Demo data: prices and financials are simulated. Connect a database before trading on these picks.
              </div>
            )}
            <SiteHeader status={status} />
            {!isDemo && historyDays < 200 && (
              <div className="border-b bg-muted/40">
                <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-xs text-muted-foreground sm:px-6">
                  <Info className="mt-px size-3.5 shrink-0" />
                  <span>
                    We started tracking prices recently ({historyDays} trading day{historyDays === 1 ? "" : "s"} so far). Buy ranges and stop
                    levels become more precise over the next few weeks.
                  </span>
                </div>
              </div>
            )}
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
            <footer className="border-t">
              <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
                <p>Not investment advice. Scores rank evidence; they do not predict prices. Always use a stop-loss.</p>
                <p>Data: ShareSansar, Merolagani</p>
              </div>
            </footer>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
