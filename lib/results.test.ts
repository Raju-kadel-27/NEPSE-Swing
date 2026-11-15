import { describe, expect, it } from "vitest";
import { lastEndedQuarter, quarterEnd, resultsInfo } from "./results";

describe("results calendar", () => {
  it("maps Nepali fiscal quarters to Gregorian quarter ends", () => {
    expect(quarterEnd({ fiscalYear: "083/84", quarter: 1 })).toBe("2026-10-17");
    expect(quarterEnd({ fiscalYear: "083/84", quarter: 2 })).toBe("2027-01-14");
    expect(quarterEnd({ fiscalYear: "082/83", quarter: 4 })).toBe("2026-07-16");
  });
  it("finds the latest ended quarter", () => {
    expect(lastEndedQuarter("2026-11-13")).toEqual({ fiscalYear: "083/84", quarter: 1 });
    expect(lastEndedQuarter("2026-10-01")).toEqual({ fiscalYear: "082/83", quarter: 4 });
    expect(lastEndedQuarter("2027-02-01")).toEqual({ fiscalYear: "083/84", quarter: 2 });
  });
  it("marks reported, pending and overdue companies", () => {
    const r = resultsInfo("2026-11-13", { fiscalYear: "083/84", quarter: 1 });
    expect([r.status, r.due, r.daysLeft]).toEqual(["reported", "2026-11-16", 3]);
    expect(resultsInfo("2026-11-13", { fiscalYear: "082/83", quarter: 4 }).status).toBe("pending");
    expect(resultsInfo("2026-11-20", { fiscalYear: "082/83", quarter: 4 }).status).toBe("overdue");
    expect(resultsInfo("2026-11-13", { fiscalYear: "082/83", quarter: 3 }).status).toBe("overdue");
    expect(resultsInfo("2026-11-13", { fiscalYear: null, quarter: null }).status).toBe("unknown");
  });
});
