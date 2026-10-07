import type { ResearchFilters } from "./research-filters";

import type { Paper } from "./paper-data";
export type { Paper, Evidence } from "./paper-data";

// Historical curated preview retained for existing non-search modes.
export const exampleQuestion = "What is the relationship between Alzheimer’s disease and dementia? Can different types of dementia overlap?";
export const papers: Paper[] = [
  {
    id: "deture2019", title: "The neuropathological diagnosis of Alzheimer’s disease",
    authors: ["Michael A. DeTure", "Dennis W. Dickson"], shortAuthor: "DeTure & Dickson", year: 2019,
    journal: "Molecular Neurodegeneration", doi: "10.1186/s13024-019-0333-5",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6679484/", type: "Review",
    summary: "A review of the defining pathology of Alzheimer’s disease and related pathologies that complicate diagnosis. It covers amyloid plaques, neurofibrillary tangles, vascular disease, Lewy body disease, and other conditions.",
    finding: "Alzheimer’s pathology often coexists with other age-related disease processes.",
    limitation: "A narrative review, not a trial testing a treatment or a single estimate of risk.",
    fields: ["Neuroscience", "Medicine"], openAccess: true, pdf: "/research/deture-2019/paper.pdf", pages: 18,
    evidence: [
      { id: "deture-cause", section: "Abstract", page: 1, text: "Alzheimer’s disease is the most common cause of dementia globally.", rects: [[55.767,34.406,33.606,1.529],[10.617,36.182,11.669,1.264]] },
      { id: "deture-overlap", section: "Abstract", page: 1, text: "Defining the relationships between and interdependence of various co-pathologies remains an active area of investigation.", rects: [[26.901,42.254,62.488,1.264],[10.617,43.774,17.554,1.264]] },
    ],
  },
  {
    id: "jack2018", title: "NIA-AA Research Framework: Toward a biological definition of Alzheimer’s disease",
    authors: ["Clifford R. Jack Jr.", "David A. Bennett", "Kaj Blennow", "Maria C. Carrillo", "Billy Dunn", "Samantha Budd Haeberlein", "David M. Holtzman", "William Jagust", "Frank Jessen", "Jason Karlawish", "Enchi Liu", "Jose Luis Molinuevo", "Thomas Montine", "Creighton Phelps", "Katherine P. Rankin", "Christopher C. Rowe", "Philip Scheltens", "Eric Siemers", "Heather M. Snyder", "Reisa Sperling"],
    shortAuthor: "Jack et al.", year: 2018, journal: "Alzheimer’s & Dementia", doi: "10.1016/j.jalz.2018.02.018",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5958625/", type: "Research framework",
    summary: "This 2018 framework separates the biology of Alzheimer’s disease from its clinical symptoms. It organizes research biomarkers by amyloid, tau, and neurodegeneration, and describes cognitive staging along a continuum.",
    finding: "The 2018 framework defines Alzheimer’s biologically and stages cognitive symptoms separately.",
    limitation: "Designed for research, not routine clinical care; this historical framework is not current diagnostic guidance.",
    fields: ["Neuroscience", "Medicine"], openAccess: true,
    evidence: [{ id: "jack-continuum", section: "Abstract", text: "We focus on AD as a continuum, and cognitive staging may be accomplished using continuous measures." }],
  },
  {
    id: "king2020", title: "The Neuropathological Diagnosis of Alzheimer’s Disease—The Challenges of Pathological Mimics and Concomitant Pathology",
    authors: ["Andrew King", "Istvan Bodi", "Claire Troakes"], shortAuthor: "King et al.", year: 2020,
    journal: "Brain Sciences", doi: "10.3390/brainsci10080479", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7463915/", type: "Review",
    summary: "A review of pathological mimics and additional pathologies in Alzheimer’s disease. It discusses how Lewy bodies, TDP-43, and vascular pathology can complicate the interpretation of symptoms and neuropathology.",
    finding: "Multiple pathologies can contribute to the clinical picture and complicate attribution of symptoms.",
    limitation: "The contribution of each coexisting pathology is difficult to disentangle; coexistence does not establish one disease becoming another.",
    fields: ["Neuroscience", "Medicine"], openAccess: true,
    evidence: [{ id: "king-overlap", section: "Abstract", text: "the threshold of each individual pathology to cause dementia" }],
  },
];

export function filterPapers(items: Paper[], filters: ResearchFilters, search = "", now = new Date().getFullYear()) {
  return items.filter(p => {
    const y = filters.year;
    if (y.kind === "custom" && (p.year === undefined || p.year < y.from || p.year > y.to)) return false;
    if (y.kind === "last" && (p.year === undefined || p.year < now - y.years + 1 || p.year > now)) return false;
    if (filters.hasPdf && !p.pdf) return false;
    if (filters.openAccess && !p.openAccess) return false;
    if (filters.minCitations !== null && (p.citationCount === undefined || p.citationCount < filters.minCitations)) return false;
    if (filters.quartiles.length && (!p.quartile || !filters.quartiles.includes(p.quartile))) return false;
    if (filters.fields.length && !filters.fields.some(f => p.fields.includes(f))) return false;
    return `${p.title} ${p.authors.join(" ")} ${p.year} ${p.journal}`.toLowerCase().includes(search.trim().toLowerCase());
  });
}
export const citation = (p: Paper) => `${p.authors.join(", ")} (${p.year}). ${p.title}. ${p.journal}. https://doi.org/${p.doi}`;
const csvCell = (s: string) => `"${s.replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
export function exportPapers(items: Paper[], format: "csv" | "bib" | "ris") {
  if (format === "csv") return [["Title", "Authors", "Year", "Journal", "DOI", "Key finding", "Study type"], ...items.map(p => [p.title, p.authors.join("; "), p.year ? String(p.year) : "", p.journal, p.doi, p.finding, p.type])].map(r => r.map(csvCell).join(",")).join("\r\n");
  if (format === "ris") return items.map(p => `TY  - JOUR\nTI  - ${p.title}\n${p.authors.map(a => `AU  - ${a}`).join("\n")}\nPY  - ${p.year}\nJO  - ${p.journal}\nDO  - ${p.doi}\nUR  - ${p.url}\nER  - `).join("\n\n");
  return items.map(p => `@article{${p.id},\n${Object.entries({ title: p.title, author: p.authors.join(" and "), year: p.year, journal: p.journal, doi: p.doi }).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => `  ${key} = {${value}}`).join(",\n")}\n}`).join("\n\n");
}
export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
