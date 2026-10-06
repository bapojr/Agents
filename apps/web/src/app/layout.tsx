import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "../ui/agents.css";
import "../ui/filters.css";
import "../ui/research-workspace.css";

export const metadata: Metadata = {
  title: "Agents · Paperpal",
  description: "Your starting point for finding papers and exploring research with Paperpal Agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
