import assert from "node:assert/strict";
import test from "node:test";
import {
  criticalChance,
  criticalDamageMultiplier,
} from "../js/platform/gw2/damage.js";
import { gw2ConditionDurationMultiplier } from "../js/platform/gw2/runtime-rules.js";
import {
  conditionDurationFractionFromExpertise,
  conditionDurationPercentFromExpertise,
  criticalChanceFractionFromPrecision,
  criticalChancePercentFromPrecision,
  criticalDamageMultiplierFromFerocity,
  criticalDamagePercentFromFerocity,
} from "../js/platform/gw2/stat-scaling.js";

test("stat scaling preserves exact percent- and fraction-form values", () => {
  assert.equal(criticalChancePercentFromPrecision(896), 0.047619047619047616);
  assert.equal(
    criticalChanceFractionFromPrecision(896),
    0.0004761904761904773,
  );

  assert.equal(criticalDamagePercentFromFerocity(2), 150.13333333333333);
  assert.equal(
    criticalDamageMultiplierFromFerocity(2),
    1.5013333333333334,
  );

  assert.equal(conditionDurationPercentFromExpertise(5), 0.3333333333333333);
  assert.equal(
    conditionDurationFractionFromExpertise(5),
    0.0033333333333333335,
  );
});

test("runtime stat wrappers retain their caps and floors", () => {
  assert.equal(criticalChance(894), 0);
  assert.equal(criticalChance(2996), 1);
  assert.equal(criticalDamageMultiplier(-100), 1.5);

  assert.equal(
    gw2ConditionDurationMultiplier("Burning", { expertise: -100 }),
    1,
  );
  assert.equal(
    gw2ConditionDurationMultiplier("Burning", { expertise: 3000 }),
    2,
  );
});
