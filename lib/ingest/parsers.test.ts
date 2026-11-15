import { describe, expect, it } from "vitest";
import { normFY, parseCompanyDetail } from "./merolagani";
import { parseCurrentInterbank } from "./nrb";
import { parseTodayPrices } from "./sharesansar";

const row = (label: string, value: string) => `<tbody><tr><th>${label}</th><td>${value}</td></tr></tbody>`;

const MEROLAGANI = `<html><head><title>merolagani - Test Holdings Limited (TST) Detail, News</title></head><body>
<table id="accordion">
${row("Sector", "Hydro Power")}
${row("Market Price", "<strong><span>1,234.50</span></strong>")}
${row("EPS", '61.12 <span class="text-primary">(FY:082-083, Q:4)</span>')}
${row("P/E Ratio", "20.20")}
${row("Book Value", "268.77")}
${row("PBV", "4.59")}
${row("52 Weeks High - Low", "2,717.00-1,967.00")}
${row("120 Day Average", "1,200.00")}
${row("30-Day Avg Volume", "12,727.00")}
<tbody><tr><th><a href="#dividend-panel">% Dividend</a></th><td>5.00 <span class="text-primary">(FY:081-082)</span></td></tr>
<tr id="dividend-panel"><td colspan="2"><table><tbody>
<tr><th>#</th><th>Fiscal Year</th><th>Value</th></tr>
<tr><td>1.</td><td>5.00%</td><td>(FY: 081-082)</td></tr>
<tr><td>2.</td><td>3.00%</td><td>(FY: 080-081)</td></tr>
</tbody></table></td></tr></tbody>
<tbody><tr><th><a href="#bonus-panel">% Bonus</a></th><td>10.00 <span class="text-primary">(FY:081-082)</span></td></tr>
<tr id="bonus-panel"><td colspan="2"><table><tbody></tbody></table></td></tr></tbody>
</table></body></html>`;

const SHARESANSAR = `<html><body><input id="fromdate" value="2026-11-13" />
<div id="todayshareprice_data"><table><thead><tr>
<th>S.No</th><th>Symbol</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Vol</th><th>Prev. Close</th><th>Turnover</th>
<th>120 Days</th><th>180 Days</th><th>52 Weeks High</th><th>52 Weeks Low</th></tr></thead><tbody>
<tr><td>1</td><td>ABC</td><td>100.00</td><td>110.00</td><td>99.00</td><td>105.50</td><td>1,905.00</td><td>100.00</td><td>201,000.00</td><td>98</td><td>95</td><td>120</td><td>80</td></tr>
<tr><td>2</td><td>BAD</td><td>-</td><td>-</td><td>-</td><td>-</td><td>0</td><td>-</td><td>0</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>
</tbody></table></div>
<script>var c = [{"id":1,"symbol":"ABC","companyname":"Abc Limited"}];</script></body></html>`;

describe("merolagani parser", () => {
  const d = parseCompanyDetail("TST", MEROLAGANI);
  it("reads the summary rows", () => {
    expect(d).toMatchObject({ name: "Test Holdings Limited", sector: "Hydro Power", price: 1234.5, eps: 61.12, epsFiscalYear: "082/83", epsQuarter: 4, pe: 20.2, bookValue: 268.77, high52: 2717, low52: 1967, avg120: 1200, avgVolume30: 12727 });
  });
  it("reads dividend history and falls back to the summary for an empty panel", () => {
    expect(d.cashDividends).toEqual([{ fiscalYear: "081/82", value: 5 }, { fiscalYear: "080/81", value: 3 }]);
    expect(d.bonuses).toEqual([{ fiscalYear: "081/82", value: 10 }]);
  });
  it("throws when the layout changes", () => {
    expect(() => parseCompanyDetail("X", "<html></html>")).toThrow(/layout changed/);
  });
  it("normalises fiscal years", () => {
    expect(normFY("078-079")).toBe("078/79");
  });
});

describe("sharesansar parser", () => {
  const t = parseTodayPrices(SHARESANSAR);
  it("reads rows, skips untraded ones and picks up names", () => {
    expect(t.date).toBe("2026-11-13");
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({ symbol: "ABC", close: 105.5, volume: 1905, turnover: 201000, prevClose: 100, avg120: 98, high52: 120 });
    expect(t.names.ABC).toBe("Abc Limited");
  });
});

describe("parseCurrentInterbank", () => {
  it("reads the current and previous weighted average interbank rate", () => {
    const html = `<table><tbody><tr><td><div>Weighted Average Interbank Rate (Daily)</div><div class="text-muted">Last updated: November 6, 2026</div></td>
      <td><div> 2.7500</div><div>November 6, 2026</div></td><td><div> 2.6100</div><div>November 5, 2026</div></td></tr></tbody></table>
      <table><tbody><tr><td><div>Weighted Average Reverse Repo Rate</div></td><td><div>4.2753</div><div>June 25, 2023</div></td></tr></tbody></table>`;
    expect(parseCurrentInterbank(html)).toEqual([
      { date: "2026-11-06", interbankRate: 2.75, excessLiquidity: null },
      { date: "2026-11-05", interbankRate: 2.61, excessLiquidity: null },
    ]);
  });
  it("returns nothing when the table is missing", () => {
    expect(parseCurrentInterbank("<html></html>")).toEqual([]);
  });
});
