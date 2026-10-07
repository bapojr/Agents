import { FigmaAsset } from "./figma-assets";

export function UpgradeButton({ onClick }: { onClick: () => void }) {
  return <button className="upgrade-button primary-button" onClick={onClick}><FigmaAsset name="main-imgGroup11097" /><span>Upgrade</span></button>;
}
