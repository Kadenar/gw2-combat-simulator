import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createEventQueue } from "js/platform/engine/event-queue.js";
import { createGw2ConditionResolution } from "js/platform/gw2/resolver/condition-resolution.js";
import { createGw2ResolverExtensions } from "js/platform/gw2/resolver/extensions.js";
import {
  createGw2ResolverReactionRegistry,
  defineGw2ResolverReactions,
} from "js/platform/gw2/resolver/reaction-registry.js";
import { createGw2ResolverRuntimeState } from "js/platform/gw2/resolver/runtime-state.js";

test("generic resolver modules contain no concrete equipment policy", () => {
  const resolver = new URL("js/platform/gw2/resolver/", import.meta.url);
  for (const [filename, forbidden] of [
    ["event-handlers.ts", /relic-rules|gear-data|FOOD_DATA|sigil-severance|criticalProgress/],
    ["condition-resolution.ts", /relic-rules|handleConditionRelics|onConditionApplied/],
    ["hit-resolution.ts", /relic-rules|relicStrikeMultiplier/],
    ["runtime-state.ts", /relic-rules|createRelicRuntime/],
    ["resolve-timeline.ts", /relic-rules|recordPassiveRelicTimeline/],
  ]) {
    assert.doesNotMatch(
      readFileSync(new URL(filename, resolver), "utf8"),
      forbidden,
      filename,
    );
  }
  assert.match(
    readFileSync(new URL("event-handlers.ts", resolver), "utf8"),
    /weakness-vulnerability\.resolved/,
  );
});

test("GW2 resolver registry orders hooks stably and returns the last result", () => {
  const calls = [];
  const professionReactions = defineGw2ResolverReactions({
    "damage.resolved": () => {
      calls.push("profession");
      return { owner: "profession" };
    },
  });
  const registry = createGw2ResolverReactionRegistry({
    professionReactions,
    contributions: {
      "damage.resolved": [
        {
          id: "common.early",
          order: -100,
          handler: () => calls.push("early"),
        },
        {
          id: "common.tie-a",
          order: 100,
          handler: () => calls.push("tie-a"),
        },
        {
          id: "common.tie-b",
          order: 100,
          handler: () => {
            calls.push("tie-b");
            return { owner: "last" };
          },
        },
      ],
    },
  });

  assert.deepEqual(
    registry.dispatch("damage.resolved", {}, { type: "damage", at: 0 }),
    { owner: "last" },
  );
  assert.deepEqual(calls, ["early", "profession", "tie-a", "tie-b"]);
  assert.equal(
    registry.dispatch("blind.resolved", {}, { type: "blind", at: 0 }),
    undefined,
  );
});

test("GW2 resolver declarations reject unknown stages and duplicate hook ids", () => {
  assert.throws(
    () => defineGw2ResolverReactions({ damage: () => {} }),
    /Unknown GW2 resolver stage: damage/,
  );
  assert.throws(
    () => createGw2ResolverReactionRegistry({
      contributions: {
        "buff.applied": [
          { id: "same", order: 0, handler: () => {} },
          { id: "same", order: 1, handler: () => {} },
        ],
      },
    }),
    /Duplicate eventReactions\.buff\.applied hook id: same/,
  );
});

test("condition stage runs once after state and ticks, including relic recursion", () => {
  const trace = [];
  const professionReactions = defineGw2ResolverReactions({
    "condition.applied": (context, application, details) => {
      trace.push({
        condition: application.condition,
        applications: context.conditionApplications.length,
        queued: context.queue.length,
        active: details.activeConditionStackCount(
          context,
          application.condition,
          application.at,
        ),
      });
    },
  });
  const extensions = createGw2ResolverExtensions({
    config: { relic: "Fractal" },
    professionReactions,
  });
  const conditions = createGw2ConditionResolution({
    reactions: extensions.reactions,
  });
  const queue = createEventQueue();
  const context = createGw2ResolverRuntimeState({
    config: { relic: "Fractal", target: {} },
    traits: new Set(),
    horizon: 10,
    query: {
      statsAt: () => ({
        power: 1000,
        precision: 1000,
        toughness: 1000,
        vitality: 1000,
        ferocity: 0,
        conditionDamage: 0,
        expertise: 0,
        concentration: 0,
        healingPower: 0,
      }),
      conditionDurationMultiplier: () => 1,
    },
    helpers: { conditionName: value => String(value) },
    queue,
    createEquipmentState: extensions.createEquipmentState,
  });

  assert.equal(conditions.applyCondition(context, {
    type: "condition",
    at: 0,
    source: "Fixture",
    condition: "Bleeding",
    duration: 0,
    stacks: 6,
  }), null);
  assert.deepEqual(trace, []);

  const application = conditions.applyCondition(context, {
    type: "condition",
    at: 0,
    source: "Fixture",
    sourceId: "fixture.bleed",
    skillName: "Fixture Bleed",
    condition: "Bleeding",
    duration: 2,
    stacks: 6,
  });

  assert.equal(application.condition, "Bleeding");
  assert.deepEqual(trace.map(entry => entry.condition), [
    "Bleeding",
    "Burning",
    "Torment",
  ]);
  assert.deepEqual(trace.map(entry => entry.applications), [1, 2, 3]);
  assert.deepEqual(trace.map(entry => entry.active), [6, 2, 3]);
  assert.ok(trace.every(entry => entry.queued > 0));
});
