import test from "node:test";

import { assertManifestBenchmarks } from "./preset-benchmark.js";

test("Guardian manifest benchmark DPS matches saved rotations", () =>
  assertManifestBenchmarks("guardian"));
