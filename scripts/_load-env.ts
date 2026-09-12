/**
 * Minimal .env.local loader for one-off scripts run via `tsx`.
 *
 * Unlike `next dev`/`next build`, plain `tsx script.ts` does not load
 * `.env.local` automatically — this file does that, side-effect only.
 * Import it FIRST (before anything that reads process.env at module
 * load time) in any script under scripts/.
 *
 * Real environment variables already set in the shell always win — this
 * only fills in values that aren't already present.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip one layer of matching surrounding quotes, if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const root = join(__dirname, "..");
// Load in the same precedence order Next.js itself documents:
// .env.local last-loaded-wins would override .env, but since we only
// fill in *missing* keys, load .env.local first so it takes priority.
loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));
