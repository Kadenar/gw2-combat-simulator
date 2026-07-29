import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(target);
    return /\.(?:js|mjs)$/.test(entry.name) ? [target] : [];
  });
}

const files = javascriptFiles(process.cwd()).sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(
      result.stderr ||
        result.stdout ||
        `${file}: ${result.error?.message || "syntax check failed"}\n`,
    );
    process.exit(result.status || 1);
  }
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
