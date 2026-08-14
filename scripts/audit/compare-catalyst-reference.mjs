if (!process.argv.some((argument) => argument.startsWith("--suite="))) {
  process.argv.push("--suite=catalyst");
}

await import("./compare-power-tempest-reference.mjs");
