import { describe, expect, it } from "vitest";
import { emptyLibrary, exportFormats, formatCitation, readLibrary, readPreferences, saveThread, sessionFromHash, threadLink } from "../src/ui/thread-state";
import { papers } from "../src/ui/research-preview";

const session = { id: 7, query: 'Sleep, café & memory?\n新しい研究', followups: [{ question: "What about limitations?", paperId: papers[0].id }] };
describe("preview thread sharing", () => {
  it("restores the original question and follow-ups from a portable link", () => {
    const url = new URL(threadLink("https://bapojr.github.io/Agents/?old=1#old", session));
    expect(url.pathname).toBe("/Agents/"); expect(url.search).toBe("");
    expect(sessionFromHash(url.hash)).toEqual(session);
  });
  it("rejects malformed or unsupported links without crashing the app", () => {
    for (const hash of ["#thread=%", "#thread=null", '#thread={"version":2}', `#thread=${encodeURIComponent(JSON.stringify({ version: 1, session: { ...session, followups: [{}] } }))}`]) expect(sessionFromHash(hash)).toBeNull();
  });
});
describe("thread library", () => {
  it("updates a saved thread instead of duplicating it and removes collection membership when unsaved", () => {
    let library = saveThread(emptyLibrary(), session, true);
    library.collections[0].threadIds = [session.id];
    library = saveThread(library, { ...session, query: "Updated" }, true);
    expect(library.threads).toHaveLength(1); expect(library.threads[0].query).toBe("Updated");
    library = saveThread(library, session, false);
    expect(library.threads).toEqual([]); expect(library.collections[0].threadIds).toEqual([]);
  });
  it("discards corrupt saved data and orphaned memberships", () => {
    expect(readLibrary({ threads: [null, {}], collections: [{ id: 'x', name: 'Test', threadIds: [7] }] }).collections[0].threadIds).toEqual([]);
    expect(readLibrary(null)).toEqual(emptyLibrary());
  });
});
describe("citation preferences", () => {
  it("defaults invalid stored values and preserves supported preferences", () => {
    expect(readPreferences({ citationFormat: "bad", exportFormat: "bad" })).toEqual({ citationFormat: "author-year", exportFormat: "APA" });
    expect(readPreferences({ citationFormat: "numeric", exportFormat: "Chicago" })).toEqual({ citationFormat: "numeric", exportFormat: "Chicago" });
  });
  it("keeps the DOI and source title in every supported export style", () => {
    for (const format of exportFormats) { const text = formatCitation(papers[0], format); expect(text).toContain(papers[0].doi); expect(text).toContain(papers[0].title); }
    expect(formatCitation(papers[0], "APA")).toContain('DeTure, M. A., & Dickson, D. W. (2019).');
    expect(formatCitation(papers[0], "BibTeX")).toContain('@article{deture2019');
    expect(formatCitation(papers[1], "AMA/Numeric")).toContain('Jack CR Jr, Bennett DA, Blennow K, et al.');
  });
});
