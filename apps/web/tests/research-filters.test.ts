import { describe, expect, it } from "vitest";
import { emptyFilters, filterSummary, validateFilterNumbers } from "../src/ui/research-filters";

describe("research filter validation", () => {
  it("allows empty optional citations and ignores inactive year inputs", () => {
    expect(validateFilterNumbers("all", "", "bad", "", "", 2026)).toBeNull();
    expect(validateFilterNumbers("last", "5", "", "", "12", 2026)).toBeNull();
    expect(validateFilterNumbers("custom", "", "2021", "2026", "1", 2026)).toBeNull();
  });
  it.each(["", "0", "-1", "1.5", "2027", "NaN"])("rejects invalid last-year count %s", years => {
    expect(validateFilterNumbers("last", years, "", "", "", 2026)).not.toBeNull();
  });
  it.each([["2025", "2020"], ["2020", "2027"], ["", "2026"], ["0", "2026"], ["2020.5", "2026"]])("rejects invalid range %s to %s", (from, to) => {
    expect(validateFilterNumbers("custom", "", from, to, "", 2026)).not.toBeNull();
  });
  it.each(["0", "-2", "1.5", "Infinity", "9007199254740992"])("rejects invalid citation count %s", citations => {
    expect(validateFilterNumbers("all", "", "", "", citations, 2026)).not.toBeNull();
  });
  it("retains all selected dimensions in the accessible summary", () => {
    expect(filterSummary({ ...emptyFilters(), year: { kind: "custom", from: 2020, to: 2025 }, hasPdf: true, openAccess: true, minCitations: 12, fields: ["Medicine"], quartiles: ["Q1", "Q2"] }))
      .toBe("2020–2025, Has PDF, Open Access, Citations ≥ 12, Medicine, Q1, Q2");
  });
});
