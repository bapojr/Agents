import { describe, expect, it } from "vitest";
import { emptyFilters } from "../src/ui/research-filters";
import { exportPapers, filterPapers, papers } from "../src/ui/research-preview";

describe("research preview source integrity and filtering", () => {
  it("keeps stable, unique source and passage IDs", () => {
    expect(new Set(papers.map(p => p.doi)).size).toBe(papers.length);
    const ids = papers.flatMap(p => p.evidence.map(e => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    papers.forEach(p => {
      expect(p.url).toMatch(/^https:\/\/pmc.ncbi.nlm.nih.gov\/articles\/PMC\d+\/$/);
      p.evidence.forEach(e => {
        if (e.page) expect(e.page).toBeLessThanOrEqual(p.pages!);
        e.rects?.forEach(([x, y, w, h]) => { expect(x + w).toBeLessThanOrEqual(100); expect(y + h).toBeLessThanOrEqual(100); expect(w * h).toBeGreaterThan(0); });
      });
    });
  });
  it("uses inclusive custom bounds and last-year boundaries", () => {
    expect(filterPapers(papers, { ...emptyFilters(), year: { kind: "custom", from: 2019, to: 2020 } }).map(p => p.year)).toEqual([2019, 2020]);
    expect(filterPapers(papers, { ...emptyFilters(), year: { kind: "last", years: 2 } }, "", 2020).map(p => p.year)).toEqual([2019, 2020]);
    expect(filterPapers(papers, { ...emptyFilters(), year: { kind: "last", years: 1 } }, "", 2026)).toEqual([]);
  });
  it("does not invent citation counts or quartiles to satisfy filters", () => {
    expect(filterPapers(papers, { ...emptyFilters(), minCitations: 1 })).toEqual([]);
    expect(filterPapers(papers, { ...emptyFilters(), quartiles: ["Q1"] })).toEqual([]);
  });
  it("combines text, discipline, PDF and open-access constraints", () => {
    expect(filterPapers(papers, { ...emptyFilters(), hasPdf: true, openAccess: true, fields: ["Medicine"] }, " DICKSON ").map(p => p.id)).toEqual(["deture2019"]);
    expect(filterPapers(papers, { ...emptyFilters(), fields: ["Computer Science"] })).toEqual([]);
  });
});

describe("reference exports", () => {
  it("exports selected records without adding other sources", () => {
    const text = exportPapers([papers[1]], "bib");
    expect(text).toContain(papers[1].doi);
    expect(text).not.toContain(papers[0].doi);
    expect(text).toContain("author = {Clifford R. Jack Jr. and David A. Bennett");
  });
  it("quotes CSV punctuation and mitigates spreadsheet formula injection", () => {
    const text = exportPapers([{ ...papers[0], title: '=SUM(1,2) "quoted"\nline' }], "csv");
    expect(text).toContain('"\'=SUM(1,2) ""quoted""\nline"');
  });
  it("writes one RIS author per field and terminates every record", () => {
    const text = exportPapers(papers, "ris");
    expect(text.match(/^ER  - /gm)?.length).toBe(3);
    expect(text).toContain("AU  - Michael A. DeTure\nAU  - Dennis W. Dickson");
  });
});
