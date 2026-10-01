import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Export the same UI entry points without copying server routes or local secrets.
const root = fileURLToPath(new URL("../", import.meta.url));
const web = path.join(root, "apps/web");
const staging = path.join(web, ".pages");
const basePath = "/Agents";
await rm(staging, { recursive: true, force: true });
await mkdir(path.join(staging, "src/app"), { recursive: true });
for (const file of ["layout.tsx", "page.tsx"]) {
  await cp(path.join(web, "src/app", file), path.join(staging, "src/app", file));
}
await cp(path.join(web, "src/ui"), path.join(staging, "src/ui"), { recursive: true });
await cp(path.join(web, "public"), path.join(staging, "public"), { recursive: true });
await cp(path.join(web, "package.json"), path.join(staging, "package.json"));
const tsconfig = JSON.parse(await readFile(path.join(web, "tsconfig.json"), "utf8"));
tsconfig.include = ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"];
await writeFile(path.join(staging, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
await writeFile(path.join(staging, "next.config.mjs"), `export default {
  output: "export", basePath: ${JSON.stringify(basePath)}, trailingSlash: true,
  poweredByHeader: false, env: { NEXT_PUBLIC_BASE_PATH: ${JSON.stringify(basePath)} },
};\n`);
const child = spawn(process.execPath, [path.join(web, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
  cwd: staging, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
const result = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (code) => resolve(code ?? 1));
});
if (result !== 0) process.exit(result);
await writeFile(path.join(staging, "out/.nojekyll"), "");
console.log("GitHub Pages UI: apps/web/.pages/out (base path /Agents)");
