import test from "node:test";

import { assertManifestRegressions } from "./preset-benchmark.js";

test("Guardian presets load and stay within 1% DPS", () =>
  assertManifestRegressions("guardian"));
