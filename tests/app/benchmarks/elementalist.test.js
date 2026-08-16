import test from "node:test";

import { assertManifestBenchmarks } from "./preset-benchmark.js";

test("Elementalist manifest benchmark DPS matches saved rotations", () =>
  assertManifestBenchmarks("elementalist"));
