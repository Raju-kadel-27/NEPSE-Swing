"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Plain-language explanations for trading terms, shown on hover/tap.
export const GLOSSARY = {
  buyAt: "Place a limit order anywhere in this range. Don't pay more than the top number.",
  sellIfBelow: "Your stop-loss. If the price closes below this, sell to keep the loss small.",
  takeProfit: "The price to aim for within your holding period, sized to how far this stock usually moves in that time. Consider selling some or all here.",
  score: "Quality score out of 100: how strong the company, its price trend and its safety to trade look together.",
  company: "Earnings growth, valuation against its sector, return on equity and dividends.",
  trend: "Whether the price is rising, its momentum and how much trading volume is behind it.",
  safety: "Higher is safer: enough daily trading to get in and out, normal volatility, no sudden spikes or dilution.",
  sellable: "In NEPSE, shares you buy can only be sold 3 trading days later, so the stop-loss can't protect you before then.",
} as const;

export function InfoTip({ text, label = "What does this mean?" }: { text: string; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className="inline-flex text-muted-foreground/70 hover:text-foreground" onClick={(e) => e.preventDefault()}>
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}
