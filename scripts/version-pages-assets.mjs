import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [rootArgument, revisionArgument] = process.argv.slice(2);

if (!rootArgument || !revisionArgument) {
  throw new Error(
    "Usage: node scripts/version-pages-assets.mjs <site-directory> <revision>",
  );
}

const siteRoot = path.resolve(rootArgument);
const revision = encodeURIComponent(revisionArgument);
const sourceExtensions = new Set([".html", ".js"]);
const localAssetPattern =
  /(["'])((?:\.{1,2}\/|(?:css|js)\/)[^"'?#\s<>]+?\.(?:css|js))(?:\?[^"']*)?\1/g;

async function versionFile(filePath) {
  const source = await readFile(filePath, "utf8");
  const versioned = source.replace(
    localAssetPattern,
    (_match, quote, assetPath) => `${quote}${assetPath}?v=${revision}${quote}`,
  );

  if (versioned !== source) {
    await writeFile(filePath, versioned);
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walk(entryPath);
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      await versionFile(entryPath);
    }
  }));
}

await walk(siteRoot);
