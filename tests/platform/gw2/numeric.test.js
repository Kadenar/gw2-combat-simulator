import assert from "node:assert/strict";
import test from "node:test";

import { clamp, finiteNumber } from "js/platform/gw2/numeric.js";

test("clamp restricts values to an inclusive range", () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(11, 0, 10), 10);
});

test("finiteNumber coerces numeric input and rejects non-finite results", () => {
  assert.equal(finiteNumber("12.5", 0), 12.5);
  assert.equal(finiteNumber("invalid", 7), 7);
  assert.equal(finiteNumber(Number.POSITIVE_INFINITY, -1), -1);
});
