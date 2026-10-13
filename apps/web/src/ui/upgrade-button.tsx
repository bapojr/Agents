import { FigmaAsset } from "./figma-assets";

export function UpgradeButton({ onClick, label = "Upgrade", className = "" }: { onClick: () => void; label?: string; className?: string }) {
  return <button className={`upgrade-button primary-button ${className}`} onClick={onClick}><FigmaAsset name="main-imgGroup11097" /><span>{label}</span></button>;
}
