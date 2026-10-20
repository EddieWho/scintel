import { mkdir, cp, rm, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const out = new URL("dist/", root);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of ["index.html", "favicon.svg", "src"]) {
  await cp(new URL(name, root), new URL(name, out), { recursive: true });
}
await writeFile(new URL(".nojekyll", out), "");
console.log(
  "Built dist/ — static files with relative paths, ready for GitHub Pages.",
);
