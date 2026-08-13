import assert from "node:assert/strict";
import test from "node:test";

import { buildChartSeries } from "../../js/app/rotation/result-model.js";

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
