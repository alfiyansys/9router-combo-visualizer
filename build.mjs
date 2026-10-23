// Bundles src/ into dist/9router-combo-visualizer.user.js. No dependencies.
// `node build.mjs --check` fails if dist/ is out of date with src/ (run before committing).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const { version } = JSON.parse(read("./package.json"));
const out = new URL("./dist/9router-combo-visualizer.user.js", import.meta.url);

const bundle = [
  read("./src/header.txt").replace("{{version}}", version).trimEnd(),
  "",
  read("./src/core.js").trimEnd(),
  "",
  read("./src/userscript.js").trimEnd(),
  "",
].join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(out, "utf8"); } catch {}
  if (current !== bundle) { console.error("dist/ is stale: run `npm run build`"); process.exit(1); }
  console.log("dist/ is up to date");
} else {
  mkdirSync(new URL("./dist/", import.meta.url), { recursive: true });
  writeFileSync(out, bundle);
  console.log(`built ${out.pathname} (v${version}, ${bundle.length} bytes)`);
}
