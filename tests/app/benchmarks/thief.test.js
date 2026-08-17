import test from "node:test";

import { assertManifestRegressions } from "./preset-benchmark.js";

test("Thief presets load and stay within 1% DPS", () =>
  assertManifestRegressions("thief"));
