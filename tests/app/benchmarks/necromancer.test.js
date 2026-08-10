import test from "node:test";

import { assertManifestBenchmarks } from "./preset-benchmark.js";

test("Necromancer manifest benchmark DPS matches saved rotations", () =>
  assertManifestBenchmarks("necromancer"));
