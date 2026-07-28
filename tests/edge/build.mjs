// Bundles edge functions for Node-based testing. Remote (esm.sh / deno.land /
// npm:) imports are rewritten to local stubs so the REAL function code runs
// against the mock harness. Output: tests/edge/.build/<name>.mjs
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const outDir = resolve(here, ".build");
mkdirSync(outDir, { recursive: true });

const TARGETS = [
  "report-incident",
  "validate-trial-sources",
  "bootstrap-city",
  "auto-resolve-incidents",
  "serve-sitemap",
  "auto-maintain-sources",
  "alert-source-health",
  "ingest-incident",
  "ingest-email",
  "sync-511-traffic",
];

const stub = (name) => resolve(here, "stubs", name);

const remoteImportPlugin = {
  name: "remote-imports",
  setup(buildApi) {
    buildApi.onResolve({ filter: /^(https?:\/\/|npm:)/ }, (args) => {
      const p = args.path;
      if (p.includes("@supabase/supabase-js")) return { path: stub("supabase-js.ts") };
      if (p.includes("deno.land/std") && p.includes("http/server")) return { path: stub("std-server.ts") };
      if (p.includes("deno.land/x/xhr")) return { path: stub("empty.ts") };
      if (p.includes("esm.sh/resend")) return { path: stub("resend.ts") };
      if (p.includes("esm.sh/zod")) return { path: "zod-v3", external: true };
      throw new Error(`No stub mapping for remote import: ${p}`);
    });
  },
};

for (const name of TARGETS) {
  await build({
    entryPoints: [resolve(root, "supabase/functions", name, "index.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: resolve(outDir, `${name}.mjs`),
    plugins: [remoteImportPlugin],
    external: ["zod-v3"],
    logLevel: "error",
  });
}

console.log(`[edge-tests] bundled ${TARGETS.length} functions -> tests/edge/.build/`);
