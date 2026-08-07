import assert from "node:assert/strict";
import test from "node:test";

import {
  gw2AlliedEffectRecipients,
  gw2AlliedPlayerProcTimeline,
} from "../../../js/platform/gw2/allied-players.js";

test("allied effect recipients prioritize players before companions", () => {
  const partialParty = gw2AlliedEffectRecipients(
    { allies: { count: 2, strikesPerSecond: 1 } },
    {
      maximumRecipients: 5,
      companionIds: ["minion:one", "minion:two", "minion:three"],
    },
  );
  assert.deepEqual(partialParty, {
    includesSelf: true,
    alliedPlayerCount: 2,
    companionIds: ["minion:one", "minion:two"],
    recipientCount: 5,
  });

  const fullParty = gw2AlliedEffectRecipients(
    { allies: { count: 4, strikesPerSecond: 1 } },
    {
      maximumRecipients: 5,
      companionIds: ["minion:one", "minion:two"],
    },
  );
  assert.deepEqual(fullParty, {
    includesSelf: true,
    alliedPlayerCount: 4,
    companionIds: [],
    recipientCount: 5,
  });
});

test("allied proc timelines respect the effect's selected player count", () => {
  const procs = gw2AlliedPlayerProcTimeline(
    { allies: { count: 4, strikesPerSecond: 2 } },
    {
      start: 1,
      duration: 10,
      maximumAllies: 2,
      maximumPerAlly: 3,
      internalCooldown: 1,
    },
  );
  assert.equal(procs.length, 6);
  assert.deepEqual(
    [...new Set(procs.map((proc) => proc.allyIndex))],
    [1, 2],
  );
  assert.deepEqual(
    procs.filter((proc) => proc.allyIndex === 1).map((proc) => proc.at),
    [2, 3, 4],
  );
});
