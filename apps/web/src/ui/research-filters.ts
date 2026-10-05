export type YearFilter = { kind: "all" } | { kind: "last"; years: number } | { kind: "custom"; from: number; to: number };
export type ResearchFilters = {
  year: YearFilter;
  hasPdf: boolean;
  openAccess: boolean;
  minCitations: number | null;
  fields: string[];
  quartiles: string[];
};

export function emptyFilters(): ResearchFilters {
  return { year: { kind: "all" }, hasPdf: false, openAccess: false, minCitations: null, fields: [], quartiles: [] };
}

// Labels and grouping from Figma's expanded Field of Study component.
export const studyFields = [
  { label: "Life Sciences", options: ["Agricultural and Biological Sciences", "Biochemistry, Genetics and Molecular Biology", "Immunology and Microbiology", "Neuroscience"] },
  { label: "Health Sciences", options: ["Medicine", "Nursing", "Pharmacology, Toxicology and Pharmaceutics", "Dentistry", "Health Professions"] },
  { label: "Physical Sciences", options: ["Physics and Astronomy", "Chemistry", "Earth and Planetary Sciences", "Environmental Science", "Energy"] },
  { label: "Social Sciences", options: ["Social Sciences", "Psychology", "Economics, Econometrics and Finance", "Business, Management and Accounting", "Decision Sciences"] },
  { label: "Formal Sciences", options: ["Mathematics", "Computer Science"] },
  { label: "Engineering", options: ["Engineering", "Chemical Engineering"] },
  { label: "Arts & Humanities", options: ["Arts & Humanities"] },
] as const;

export function filterSummary(value: ResearchFilters): string {
  const { year } = value;
  const parts = [year.kind === "all" ? "All years" : year.kind === "last" ? `Last ${year.years} years` : `${year.from}–${year.to}`];
  if (value.hasPdf) parts.push("Has PDF");
  if (value.openAccess) parts.push("Open Access");
  if (value.minCitations !== null) parts.push(`Citations ≥ ${value.minCitations}`);
  parts.push(...value.fields, ...value.quartiles);
  return parts.join(", ");
}

export function validateFilterNumbers(kind: YearFilter["kind"], years: string, from: string, to: string, citations: string, currentYear: number): string | null {
  const positiveInteger = (value: string) => value.trim() !== "" && Number.isSafeInteger(Number(value)) && Number(value) >= 1;
  if (kind === "last" && (!positiveInteger(years) || Number(years) > currentYear)) return "Enter a valid number of years.";
  if (kind === "custom" && (!positiveInteger(from) || !positiveInteger(to) || Number(from) > Number(to) || Number(to) > currentYear)) return `Enter a valid year range ending by ${currentYear}.`;
  if (citations.trim() !== "" && !positiveInteger(citations)) return "Enter a minimum citation count of 1 or more.";
  return null;
}
