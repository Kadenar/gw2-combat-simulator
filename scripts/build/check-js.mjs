import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const SKIPPED_DIRECTORIES = new Set([
  ".analysis-inputs",
  ".claude",
  ".git",
  ".lavish",
  "dist",
  "node_modules",
]);

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
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.JS,
  );
  const diagnostics = source.parseDiagnostics || [];

  if (diagnostics.length) {
    for (const diagnostic of diagnostics) {
      const position = diagnostic.start == null
        ? null
        : source.getLineAndCharacterOfPosition(diagnostic.start);
      const location = position
        ? `${file}:${position.line + 1}:${position.character + 1}`
        : file;

      process.stderr.write(
        `${location} ${ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n",
        )}\n`,
      );
    }

    process.exit(1);
  }
}

console.log(`Syntax checked ${files.length} JavaScript files.`);
