import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  loadEnvFile(new URL("../.env", import.meta.url));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.error("Create the local environment first: python3 scripts/init_env.py");
  process.exit(1);
}

// Load .env here instead of passing --env-file to Next.js. Next's child processes
// inherit runtime flags through NODE_OPTIONS, which does not accept --env-file.
const child = spawn(process.execPath, [
  "apps/web/node_modules/next/dist/bin/next", "dev", "apps/web",
  "--hostname", "127.0.0.1", "--port", "3000",
], { cwd: root, env: process.env, stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(`Could not start the preview: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
