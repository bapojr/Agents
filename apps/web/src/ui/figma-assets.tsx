import manifest from "../../public/figma/manifest.json";

const files = new Map(manifest.map((asset) => [asset.key, asset]));
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function FigmaAsset({ name, className = "" }: { name: string; className?: string }) {
  const asset = files.get(name);
  if (!asset) throw new Error(`Unknown Figma asset: ${name}`);
  return <img className={`figma-asset ${className}`} src={`${basePath}/figma/${asset.file}`}
    width={"width" in asset ? Number(asset.width) || undefined : undefined}
    height={"height" in asset ? Number(asset.height) || undefined : undefined}
    alt="" aria-hidden="true" draggable={false} />;
}

export const icons = {
  search: "main-imgGroup1000003342",
  research: "main-imgGroup1000003339",
  answers: "main-imgGroup1000005838",
  compare: "main-imgGroup1000003343",
  questions: "main-imgGroup1000002202",
  papers: "main-imgGroup1000005726",
  chat: "main-imgMessageSmile",
  literature: "main-imgGroup1000002414",
  web: "main-imgGroup1000005686",
  library: "main-imgBuildingColumns",
  collection: "main-imgGroup1000003341",
} as const;

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`icon-slot ${className}`}><FigmaAsset name={name} /></span>;
}

export function PaperpalLogo({ expanded = false }: { expanded?: boolean }) {
  return <span className={`paperpal-logo ${expanded ? "full-logo" : ""}`} aria-hidden="true">
    <span className="brand-mark">
      <FigmaAsset name="main-imgVector" className="brand-shadow" />
      <FigmaAsset name="main-imgVector1" className="brand-base" />
      <FigmaAsset name="main-imgGroup" className="brand-detail" />
      <FigmaAsset name="main-imgVector2" className="brand-fold" />
      <FigmaAsset name="main-imgVector3" className="brand-smile" />
    </span>
    {expanded && <FigmaAsset name="sidebar-imgGroup1000010176" className="brand-wordmark" />}
  </span>;
}
