import { cp } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

const pageEntries = [
  "index.html",
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

const runtimeDirectories = ["Builds", "Rotations"];

function copyRuntimeData() {
  return {
    name: "copy-runtime-data",
    async writeBundle() {
      await Promise.all(
        runtimeDirectories.map((directory) =>
          cp(path.resolve(directory), path.resolve("dist", "site", directory), {
            recursive: true,
          }),
        ),
      );
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "./",
  publicDir: false,
  plugins: [copyRuntimeData()],
  worker: {
    format: "es",
  },
  build: {
    outDir: "dist/site",
    emptyOutDir: true,
    minify: mode !== "development",
    sourcemap: mode === "development",
    rolldownOptions: {
      input: pageEntries.map((page) => path.resolve(page)),
    },
  },
}));
