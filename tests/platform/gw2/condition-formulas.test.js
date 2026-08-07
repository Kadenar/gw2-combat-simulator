import assert from "node:assert/strict";
import test from "node:test";
import {
  conditionTickDamage as canonicalConditionTickDamage,
} from "js/platform/gw2/condition-formulas.js";
import {
  conditionTickDamage as publicConditionTickDamage,
} from "js/platform/gw2/index.js";

test("the public condition damage export preserves the canonical signature", () => {
  assert.equal(publicConditionTickDamage, canonicalConditionTickDamage);
  assert.equal(
    publicConditionTickDamage("Torment", 1000, { stationary: false }),
    82,
  );
});
