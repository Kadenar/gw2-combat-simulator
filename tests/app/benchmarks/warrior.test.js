import test from "node:test";

import { assertManifestRegressions } from "./preset-benchmark.js";

test("Warrior presets load and stay within 1% DPS", () =>
  assertManifestRegressions("warrior"));
