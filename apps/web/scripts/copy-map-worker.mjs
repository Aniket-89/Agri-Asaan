// Copies MapLibre's web worker into public/ so the browser can load it.
// MapLibre 6 looks for the worker next to its own module file, which no longer
// exists after bundling, so the app points it at /vendor/ instead
// (see src/components/maps/load-maplibre.ts). Runs before dev and build.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
const { version } = JSON.parse(readFileSync(require.resolve("maplibre-gl/package.json"), "utf8"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vendor");

mkdirSync(target, { recursive: true });
copyFileSync(source, join(target, "maplibre-gl-worker.mjs"));
console.log(`Copied MapLibre ${version} worker to public/vendor/`);
