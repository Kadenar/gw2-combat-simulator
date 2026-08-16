import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChartSeries,
  formatResultTimelineTime,
  formatTimelineTime,
  resultCombatReferenceMs,
} from "../../js/app/rotation/result-model.js";

test("timeline times can reuse a precomputed combat reference", () => {
  const result = {
    events: [
      { type: "damage", at: 0.5 },
      { type: "combat_start", at: 1.25 },
    ],
  };
  const referenceMs = resultCombatReferenceMs(result);

  assert.equal(referenceMs, 1250);
  assert.equal(formatTimelineTime(2500, referenceMs), "1.25s");
  assert.equal(
    formatTimelineTime(2500, referenceMs),
    formatResultTimelineTime(2500, result),
  );
  assert.equal(formatTimelineTime(1249, referenceMs), "0.00s");
});

test("Empowered Armaments chart series remains capped at one stack", () => {
  const series = buildChartSeries(
    {
      duration: 8,
      events: [
        {
          type: "buff",
          at: 0,
          kind: "guardian-empowered-armaments",
          duration: 6,
        },
        {
          type: "buff",
          at: 1,
          kind: "guardian-empowered-armaments",
          duration: 7,
        },
      ],
    },
    1000,
  );

  assert.deepEqual(
    series.effects["Empowered Armaments"].map((point) => point.v),
    [1, 1, 1, 1, 1, 1, 1, 1, 0],
  );
});

test("Radiant Armaments chart series identifies the active radiant weapon", () => {
  const radiantBuff = (at, radiantWeapon) => ({
    type: "buff",
    at,
    kind: "guardian-radiant-armaments",
    radiantWeapon,
    duration: 10,
  });
  const series = buildChartSeries(
    {
      duration: 8,
      events: [
        radiantBuff(0, "hammer"),
        radiantBuff(2, "staff"),
        radiantBuff(4, "blade"),
        radiantBuff(6, "bulwark"),
      ],
    },
    1000,
  );

  assert.deepEqual(
    series.effects["Radiant Armaments (Hammer)"].map((point) => point.v),
    [1, 1, 0, 0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(
    series.effects["Radiant Armaments (Staff)"].map((point) => point.v),
    [0, 0, 1, 1, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(
    series.effects["Radiant Armaments (Sword)"].map((point) => point.v),
    [0, 0, 0, 0, 1, 1, 0, 0, 0],
  );
  assert.deepEqual(
    series.effects["Radiant Armaments (Shield)"].map((point) => point.v),
    [0, 0, 0, 0, 0, 0, 1, 1, 1],
  );
});
