import { exportPapers, type Paper } from "./research-preview";

export type ResearchSession = { id: number; query: string; followups: { question: string; paperId: string | null }[] };
export const exportFormats = ["APA", "MLA", "Chicago", "Harvard", "BibTeX", "AMA/Numeric"] as const;
export type ExportFormat = typeof exportFormats[number];
export type CitationPreferences = { citationFormat: "author-year" | "numeric"; exportFormat: ExportFormat };
export const defaultPreferences: CitationPreferences = { citationFormat: "author-year", exportFormat: "APA" };
export function readPreferences(value: unknown): CitationPreferences {
  const p = value as Partial<CitationPreferences> | null;
  return { citationFormat: p?.citationFormat === "numeric" ? "numeric" : "author-year", exportFormat: exportFormats.includes(p?.exportFormat as ExportFormat) ? p!.exportFormat! : "APA" };
}
export function parseSession(value: unknown): ResearchSession | null {
  if (!value || typeof value !== "object") return null;
  const s = value as ResearchSession;
  if (!Number.isSafeInteger(s.id) || typeof s.query !== "string" || !s.query.trim() || s.query.length > 20000 || !Array.isArray(s.followups) || s.followups.length > 100) return null;
  if (!s.followups.every(f => f && typeof f.question === "string" && f.question.length <= 20000 && (f.paperId === null || typeof f.paperId === "string"))) return null;
  return { id: s.id, query: s.query, followups: s.followups.map(f => ({ question: f.question, paperId: f.paperId })) };
}
export function threadLink(base: string, session: ResearchSession) {
  const url = new URL(base); url.search = "";
  url.hash = `thread=${encodeURIComponent(JSON.stringify({ version: 1, session }))}`;
  return url.toString();
}
export function sessionFromHash(hash: string): ResearchSession | null {
  if (!hash.startsWith("#thread=") || hash.length > 300000) return null;
  try { const data = JSON.parse(decodeURIComponent(hash.slice(8))); return data.version === 1 ? parseSession(data.session) : null; } catch { return null; }
}
export type ThreadCollection = { id: string; name: string; threadIds: number[] };
export type ThreadLibrary = { threads: ResearchSession[]; collections: ThreadCollection[] };
export const emptyLibrary = (): ThreadLibrary => ({ threads: [], collections: [{ id: "favorites", name: "My favorites", threadIds: [] }] });
export function readLibrary(value: unknown): ThreadLibrary {
  if (!value || typeof value !== "object") return emptyLibrary();
  const data = value as ThreadLibrary;
  const threads = Array.isArray(data.threads) ? data.threads.map(parseSession).filter((s): s is ResearchSession => !!s) : [];
  const ids = new Set(threads.map(s => s.id));
  const collections = Array.isArray(data.collections) ? data.collections.filter(c => c && typeof c.id === "string" && typeof c.name === "string" && c.name.trim() && Array.isArray(c.threadIds)).map(c => ({ id: c.id, name: c.name, threadIds: [...new Set(c.threadIds.filter(id => ids.has(id)))] })) : [];
  return { threads, collections: collections.length ? collections : emptyLibrary().collections };
}
export function saveThread(library: ThreadLibrary, session: ResearchSession, save: boolean): ThreadLibrary {
  return { threads: save ? [...library.threads.filter(s => s.id !== session.id), session] : library.threads.filter(s => s.id !== session.id), collections: library.collections.map(c => ({ ...c, threadIds: save ? c.threadIds : c.threadIds.filter(id => id !== session.id) })) };
}

// Formats use only the metadata available in the curated preview; no volume or page data is invented.
function authorParts(author: string) {
  const suffix = author.endsWith(" Jr.") ? ", Jr." : "";
  const words = author.replace(/ Jr\.$/, "").split(" ");
  const family = words.splice(author.includes("Budd Haeberlein") ? -2 : -1).join(" ");
  const initials = words.map(w => `${w[0]}.`).join(" ");
  return { family, initials, suffix, inverted: `${family}, ${words.join(" ")}${suffix}` };
}
export function formatCitation(p: Paper, format: ExportFormat) {
  if (format === "BibTeX") return exportPapers([p], "bib");
  const authors = p.authors.map(authorParts);
  if (!authors.length || !p.year || !p.doi || !p.journal) return [p.authors.join(", "), p.year ? `(${p.year}).` : "(n.d.).", p.title + ".", p.journal, p.doi ? `https://doi.org/${p.doi}` : p.url].filter(Boolean).join(" ");
  const doi = `https://doi.org/${p.doi}`;
  const initials = authors.map(a => `${a.family}, ${a.initials}${a.suffix}`);
  if (format === "APA") return `${initials.length > 1 ? `${initials.slice(0, -1).join(", ")}, & ${initials.at(-1)}` : initials[0]} (${p.year}). ${p.title}. ${p.journal}. ${doi}`;
  if (format === "MLA") return `${authors[0].inverted}${authors.length > 2 ? ", et al." : authors.length === 2 ? `, and ${p.authors[1]}.` : "."} “${p.title}.” ${p.journal}, ${p.year}, ${doi}.`;
  if (format === "Chicago") return `${authors[0].inverted}${authors.length > 1 ? `, ${p.authors.slice(1, -1).map(a => `${a}, `).join("")}and ${p.authors.at(-1)}` : ""}. “${p.title}.” ${p.journal} (${p.year}). ${doi}.`;
  if (format === "Harvard") return `${initials.join(" and ")} (${p.year}) ‘${p.title}’, ${p.journal}. Available at: ${doi}.`;
  return `${authors.slice(0, authors.length > 6 ? 3 : 6).map(a => `${a.family} ${a.initials.replace(/[. ]/g, "")}${a.suffix.replace(/[,.]/g, "")}`).join(", ")}${authors.length > 6 ? ", et al" : ""}. ${p.title}. ${p.journal}. ${p.year}. doi:${p.doi}`;
}
