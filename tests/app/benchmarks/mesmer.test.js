import test from "node:test";

import { assertManifestBenchmarks } from "./preset-benchmark.js";

test("Mesmer manifest benchmark DPS matches saved rotations", () =>
  assertManifestBenchmarks("mesmer"));
