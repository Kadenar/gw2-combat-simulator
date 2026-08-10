import test from "node:test";

import { assertManifestBenchmarks } from "./preset-benchmark.js";

test("Revenant manifest benchmark DPS matches saved rotations", () =>
  assertManifestBenchmarks("revenant"));
