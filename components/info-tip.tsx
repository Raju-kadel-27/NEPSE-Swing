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
  rupees: "Rupees per share if you buy at the top of the range: profit if it reaches the target, loss if it hits the stop. The net figures assume a Rs 1 lakh trade and take off broker commission, the SEBON fee, the DP fee and 7.5% capital gains tax. Reward:risk is how many rupees you aim to make for each rupee you risk.",
  lowerHigh: "The stock turned down from this price in the last 6 months, below its 52-week high, so sellers may show up here again. In 10 years of past trades, price reached a level like this about 3 times in 4 but went on to the full target only about 1 time in 5. Selling there wins more often, but holding to the target with the stop earned more overall.",
  resultsDue: "Companies must publish quarterly results within about 30 days of the quarter end (SEBON rule). The price can move sharply on the day results come out, either way, so a smaller position or waiting for the result lowers the risk.",
  resultsOverdue: "The company is late with its quarterly results. Late reports are often weak ones; be careful.",
  accumulation: "Someone is quietly buying: this often comes before good news, such as strong quarterly results. In 10 years of NEPSE data, stocks with this pattern beat the market by about 1% over the next 2 months on average, but only about half of them did, so treat it as a reason to watch, not to buy on its own.",
  change1y: "Price change over the last year, counting bonus and right shares you would have received. Merolagani's '1 Year Yield' uses raw prices, so it looks lower after a bonus issue (NABIL: 9.2% raw vs 14.6% including its 5% bonus). Cash dividends are not included.",
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
