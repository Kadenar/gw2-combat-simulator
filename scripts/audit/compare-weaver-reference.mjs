if (!process.argv.some((argument) => argument.startsWith("--suite="))) {
  process.argv.push("--suite=weaver");
}

await import("./compare-power-tempest-reference.mjs");
