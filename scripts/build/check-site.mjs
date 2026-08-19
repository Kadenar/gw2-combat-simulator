import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const siteRoot = path.resolve("dist", "site");
const pages = [
  "index.html",
  "patch-preview.html",
  "elementalist.html",
  "engineer.html",
  "guardian.html",
  "mesmer.html",
  "necromancer.html",
  "ranger.html",
  "revenant.html",
  "thief.html",
  "warrior.html",
];
const runtimeAssets = [
  path.join("Builds", "elementalist", "manifest.json"),
  path.join("Rotations", "elementalist", "r-power-tempest-sword.json"),
];
const sourceAssetPattern = /(?:src|href)=["'](?:\.\/)?(?:css|js)\//;

for (const page of pages) {
  const source = await readFile(path.join(siteRoot, page), "utf8");

  if (sourceAssetPattern.test(source)) {
    throw new Error(`${page} still references an unbundled source asset.`);
  }

  if (!source.includes("assets/")) {
    throw new Error(`${page} does not reference a bundled asset.`);
  }
}

await Promise.all(
  runtimeAssets.map((asset) => access(path.join(siteRoot, asset))),
);

console.log(
  `Verified ${pages.length} bundled pages and ${runtimeAssets.length} runtime asset roots.`,
);
