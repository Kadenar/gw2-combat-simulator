import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCanonicalCatalog } from "../js/platform/engine/catalog.js";
import {
  deriveAutoattackChains,
  indexAutoattackChains,
} from "../js/platform/engine/autoattack-chains.js";
import {
  blind,
  boon,
  buff,
  condition,
  conditionTimeline,
  control,
  custom,
  repeatedCondition,
  strike,
  strikeTimeline,
} from "../js/platform/engine/effect-factories.js";
import { COMMON_EVENT_TYPES } from "../js/platform/engine/events.js";
import { HandlerRegistry } from "../js/platform/engine/handler-registry.js";
import { defineProfession } from "../js/platform/engine/profession.js";
import { resolveScheduledStream } from "../js/platform/engine/resolver.js";
import { normalizeRotation } from "../js/platform/engine/rotation-commands.js";
import { createSchedulerState } from "../js/platform/engine/scheduler-state.js";
import { createScheduler } from "../js/platform/engine/scheduler.js";
import { buildScheduledEventStream } from "../js/platform/engine/scheduled-event-stream.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  createProfessionWeaponData,
  WEAPON_DATA,
} from "../js/platform/gw2/gear-data.js";
import {
  BUILD_SCHEMA_VERSION,
  migrateMesmerBuild,
  validateMesmerBuild,
} from "../js/professions/mesmer/build.js";
import { mesmerCatalog } from "../js/professions/mesmer/catalog.js";
import { mesmerProfession } from "../js/professions/mesmer/definition.js";
import { guardianCatalog } from "../js/professions/guardian/catalog.js";
import {
  createDefaultConfig,
  simulateMesmer,
} from "./helpers/mesmer-simulation.js";
import { createMesmerState, snapshotMesmerState } from "../js/professions/mesmer/state.js";
import { testProfession } from "./fixtures/test-profession.js";

test("profession contract supplies defaults and deterministic hook ordering", () => {
  const calls = [];
  const profession = defineProfession({
    id: "ordered",
    name: "Ordered",
    schedulerHooks: {
      initialize: [
        { id: "later", order: 20, handler: () => calls.push("later") },
        { id: "first", order: 10, handler: () => calls.push("first") },
        { id: "same", order: 10, handler: () => calls.push("same") },
      ],
    },
    resolverHooks: {
      eventReactions: {
        control: [
          {
            id: "later-control",
            order: 20,
            handler: () => calls.push("later-control"),
          },
          {
            id: "first-control",
            order: 10,
            handler: () => calls.push("first-control"),
          },
        ],
      },
    },
  });
  profession.initialize({});
  assert.deepEqual(calls, ["first", "same", "later"]);
  profession.eventReactions.control({}, { type: "control" });
  assert.deepEqual(
    calls,
    ["first", "same", "later", "first-control", "later-control"],
  );
  assert.equal(profession.validateCast({}, {}), true);
  assert.deepEqual(profession.createProfessionState({}), {});
  assert.equal(profession.modifyStrikeDamage({}, 12), 12);
  assert.deepEqual(profession.paletteGroups({}), []);
});

test("profession contract supports zero or multiple resource views", () => {
  const none = defineProfession({
    id: "resourceless",
    name: "Resourceless",
  });
  const multiple = defineProfession({
    id: "multi-resource",
    name: "Multi Resource",
    ui: {
      resourceViews: () => [
        { id: "pages", maximum: 5, value: 2 },
        { id: "charges", maximum: 3, value: 1 },
      ],
    },
  });
  assert.deepEqual(none.ui.resourceViews({}), []);
  assert.equal(none.ui.resourceView({}), null);
  assert.equal(multiple.ui.resourceViews({}).length, 2);
  assert.equal(multiple.ui.resourceView({}).id, "pages");
});

test("shared autoattack helpers derive and index ID-based chains", () => {
  const chains = deriveAutoattackChains([
    { id: 1, type: "Weapon", slot: "Weapon_1", nextChainId: 2 },
    { id: 2, type: "Weapon", slot: "Weapon_1", nextChainId: 3 },
    { id: 3, type: "Weapon", slot: "Weapon_1", nextChainId: null },
  ]);
  assert.deepEqual(chains, [[1, 2, 3]]);
  assert.deepEqual(indexAutoattackChains(chains).get(2), {
    root: 1,
    index: 1,
    step: 2,
    next: 3,
  });
});

test("shared declarative factories preserve generic effect options", () => {
  assert.deepEqual(
    strike(2, {
      hits: 2,
      atMs: 100,
      source: "Effect",
      metadata: { damageKind: "fixture" },
    }),
    {
      type: "strike",
      coefficient: 2,
      hits: 2,
      atMs: 100,
      source: "Effect",
      metadata: { damageKind: "fixture" },
    },
  );
  assert.deepEqual(
    condition("Burning", 2, 3, {
      atMs: 200,
      source: "Effect",
      metadata: { fixture: true },
    }),
    {
      type: "condition",
      condition: "Burning",
      stacks: 2,
      duration: 3,
      source: "Effect",
      atMs: 200,
      metadata: { fixture: true },
    },
  );
  assert.deepEqual(
    repeatedCondition("Bleeding", {
      count: 2,
      duration: 4,
      firstAtMs: 100,
      intervalMs: 200,
      source: "Effect",
    }).map(effect => [effect.atMs, effect.source]),
    [[100, "Effect"], [300, "Effect"]],
  );
  assert.deepEqual(control("fear", 300, {
    source: "Effect",
    metadata: { breakbar: 100 },
  }), {
    type: "control",
    atMs: 300,
    source: "Effect",
    metadata: { controlKind: "fear", breakbar: 100 },
  });
  assert.deepEqual(blind(350, { source: "Effect" }), {
    type: "blind",
    atMs: 350,
    source: "Effect",
  });
  assert.deepEqual(boon("fury", 2, { stacks: 2 }), {
    type: "boon",
    boon: "fury",
    duration: 2,
    stacks: 2,
  });
  assert.deepEqual(buff("target-vulnerability", 3, { stacks: 5 }), {
    type: "buff",
    kind: "target-vulnerability",
    duration: 3,
    stacks: 5,
  });
  assert.deepEqual(custom("fixture.event", 400, { value: 1 }), {
    type: "custom",
    eventType: "fixture.event",
    atMs: 400,
    event: { value: 1 },
  });
});

test("declarative boons can gate dynamic skill availability", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 920001,
        name: "Grant Aegis",
        castTimeMs: 0,
        effects: [{
          type: "boon",
          boon: "aegis",
          duration: 2,
          stacks: 1,
        }],
      },
      {
        id: 920002,
        name: "Aegis Strike",
        castTimeMs: 0,
        effects: [{ type: "strike", coefficient: 1 }],
      },
    ],
  });
  const profession = defineProfession({
    id: "boon-gated",
    name: "Boon Gated",
    catalog,
    castRules: {
      validateCast: context =>
        context.skill.id !== 920002 || context.hasBuff("aegis"),
    },
  });
  const available = simulateGw2({
    profession,
    rotation: ["Grant Aegis", "Aegis Strike"],
  });
  const expired = simulateGw2({
    profession,
    rotation: [
      "Grant Aegis",
      { type: "wait", durationMs: 2100 },
      "Aegis Strike",
    ],
  });
  const extended = simulateGw2({
    profession,
    rotation: [
      "Grant Aegis",
      { type: "wait", durationMs: 3100 },
      "Aegis Strike",
    ],
    config: { stats: { concentration: 1500 } },
  });
  assert.ok(available.totalDamage > 0);
  assert.equal(expired.totalDamage, 0);
  assert.ok(extended.totalDamage > 0);
  assert.match(expired.warnings.join(" "), /unavailable/);
});

test("handler registry rejects duplicates and missing required handlers", () => {
  const registry = new HandlerRegistry().register("damage", () => {});
  assert.throws(
    () => registry.register("damage", () => {}),
    /Duplicate event handler/,
  );
  assert.throws(() => registry.require(["condition"]), /Missing required/);
  assert.throws(
    () => registry.dispatch({ type: "unknown" }, {}),
    /No event handler/,
  );
});

test("generic scheduler state contains no profession-specific fields", () => {
  const state = createSchedulerState({ profession: testProfession });
  assert.deepEqual(
    Object.keys(state).sort(),
    [
      "activeWeaponSet",
      "ammo",
      "cooldowns",
      "pendingEvents",
      "profession",
      "skillUses",
      "time",
    ].sort(),
  );
  assert.deepEqual(state.profession, { charge: 0, controlEvents: 0 });
  assert.equal(Object.hasOwn(state, "clones"), false);
  assert.equal(Object.hasOwn(state, "numericResource"), false);
});

test("normalized commands migrate legacy casts, waits, concurrency, and interrupts", () => {
  assert.deepEqual(normalizeRotation([
    "Fixture Slash",
    { name: "__wait", waitMs: 250 },
    { name: "Fixture Charge", offset: 100, interruptMs: 50 },
    "__combat_start",
  ], testProfession.catalog), [
    { type: "cast", skillId: 900001 },
    { type: "wait", durationMs: 250 },
    {
      type: "cast",
      skillId: 900002,
      concurrentOffsetMs: 100,
      interruptAfterMs: 50,
    },
    { type: "combat-start" },
  ]);
});

test("normalized commands preserve delayed combat-start offsets", () => {
  assert.deepEqual(normalizeRotation([
    "Fixture Slash",
    { name: "__combat_start", offset: 100 },
  ], testProfession.catalog), [
    { type: "cast", skillId: 900001 },
    { type: "combat-start", concurrentOffsetMs: 100 },
  ]);
});

test("generic simulation starts combat at a delayed marker within a cast", () => {
  const result = simulateGw2({
    profession: testProfession,
    rotation: [
      "Fixture Slash",
      { name: "__combat_start", offset: 100 },
      { type: "wait", durationMs: 1000 },
    ],
    config: {
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0,
      },
      target: { armor: 2597 },
      weaponStrength: 1000,
    },
  });
  const marker = result.events.find(event => event.type === "combat_start");

  assert.equal(marker.at, 0.1);
  assert.equal(result.firstHitTime, 1);
  assert.equal(result.dpsStartTime, 1);
  assert.equal(result.dpsWindow, 1);
  assert.equal(result.dps, result.totalDamage);
});

test("generic simulation uses the first hit after a standalone combat marker", () => {
  const result = simulateGw2({
    profession: testProfession,
    rotation: [
      "__combat_start",
      "Fixture Slash",
      { type: "wait", durationMs: 1000 },
    ],
    config: {
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0,
      },
      target: { armor: 2597 },
      weaponStrength: 1000,
    },
  });

  assert.equal(result.firstHitTime, 1);
  assert.equal(result.dpsStartTime, result.firstHitTime);
  assert.equal(result.dpsWindow, 1);
  assert.equal(result.dps, result.totalDamage);
});

test("concurrent and interrupted casts are first-class scheduler commands", () => {
  const scheduler = createScheduler({ profession: testProfession });
  const result = scheduler.run([
    { type: "cast", skillId: 900001, interruptAfterMs: 400 },
    { type: "cast", skillId: 900002, concurrentOffsetMs: 100 },
  ]);
  const slash = result.events.find(event => event.sourceId === 900001);
  const charge = result.events.find(event =>
    event.type === "action" && event.sourceId === 900002);
  assert.equal(slash.endsAt, 0.4);
  assert.equal(slash.interrupted, true);
  assert.equal(charge.at, 0.1);
  assert.equal(
    result.events.some(event =>
      event.type === "damage" && event.sourceId === 900001),
    false,
  );
});

test("test profession runs end to end without importing Mesmer", () => {
  const base = simulateGw2({
    profession: testProfession,
    rotation: [
      { type: "cast", skillId: 900001 },
      { type: "cast", skillId: 900002 },
    ],
    config: {
      traitIds: ["fixture.power"],
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0,
      },
      target: { armor: 2597 },
      weaponStrength: 1000,
    },
  });
  const withoutTrait = simulateGw2({
    profession: testProfession,
    rotation: [{ type: "cast", skillId: 900001 }],
    config: {
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0,
      },
      target: { armor: 2597 },
      weaponStrength: 1000,
    },
  });
  assert.ok(base.totalDamage > withoutTrait.totalDamage);
  assert.equal(base.profession.charge, 1);
  assert.equal(base.profession.controlEvents, 1);
  assert.equal(base.schedulerState.profession.charge, 0);
  assert.equal(base.events.every(event =>
    event.type && Number.isFinite(event.at) && event.source && event.sourceId != null), true);
});

test("declarative ammo consumes and recharges shared charges", () => {
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930001,
      name: "Fixture Ammo",
      castTimeMs: 0,
      cooldown: 5,
      ammo: 2,
      effects: [{ type: "strike", coefficient: 1 }],
    }],
  });
  const profession = defineProfession({
    id: "ammo-fixture",
    name: "Ammo Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Fixture Ammo",
      "Fixture Ammo",
      { type: "wait", durationMs: 5000 },
    ],
  });

  assert.equal(
    result.resolvedEvents.filter(event => event.type === "damage").length,
    2,
  );
  assert.deepEqual(result.endState.ammo["Fixture Ammo"], {
    charges: 1,
    maximum: 2,
    rechargeDuration: 5,
    nextRechargeAt: 10,
  });
});

test("shared scheduler waits until a skill's exact cooldown expiry", () => {
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930002,
      name: "Fixture Cooldown",
      castTimeMs: 0,
      cooldown: 0.3,
      effects: [{ type: "strike", coefficient: 1 }],
    }],
  });
  const profession = defineProfession({
    id: "cooldown-fixture",
    name: "Cooldown Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: ["Fixture Cooldown", "Fixture Cooldown"],
  });
  const actions = result.events.filter(event =>
    event.type === "action");

  assert.deepEqual(actions.map(event => event.at), [0, 0.3]);
  assert.deepEqual(result.steps.map(step => step.start), [0, 300]);
  assert.equal(result.endState.time, 300);
  assert.equal(result.endState.cooldowns["Fixture Cooldown"].readyAt, 600);
  assert.deepEqual(result.warnings, []);
});

test("declarative multi-hit and delayed effects preserve individual events", () => {
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930010,
      name: "Fixture Flurry",
      type: "Weapon",
      weapon: "Greatsword",
      castTimeMs: 300,
      effects: [{
        type: "strike",
        coefficient: 3,
        hits: 3,
        atMs: 100,
        intervalMs: 100,
      }, {
        type: "strike",
        coefficient: 1,
        atMs: 1000,
      }],
    }],
    weapons: ["Greatsword"],
    weaponHands: { Greatsword: "2h" },
  });
  const profession = defineProfession({
    id: "multi-hit-fixture",
    name: "Multi Hit Fixture",
    catalog,
    resources: {
      createProfessionState: () => ({ hits: 0 }),
    },
    resolverHooks: {
      eventReactions: {
        damage: context => {
          context.state.profession.hits += 1;
        },
      },
    },
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Fixture Flurry",
      { type: "wait", durationMs: 1000 },
    ],
  });
  const events = result.resolvedEvents.filter(event =>
    event.type === "damage");

  assert.deepEqual(
    events.map(event => Number(event.at.toFixed(3))),
    [0.1, 0.2, 0.3, 1],
  );
  assert.deepEqual(events.map(event => event.hitIndex), [1, 2, 3, 1]);
  assert.equal(result.endState.profession.hits, 4);
});

test("declarative strike timelines preserve per-hit coefficients and shared timestamps", () => {
  const ticks = [
    { atMs: 0, coefficient: 0.2 },
    { atMs: 571, coefficient: 0.2 },
    { atMs: 1000, coefficient: 0.5 },
    { atMs: 1142, coefficient: 0.2 },
    { atMs: 1714, coefficient: 0.2 },
    { atMs: 2000, coefficient: 0.5 },
    { atMs: 2285, coefficient: 0.2 },
    { atMs: 2857, coefficient: 0.2 },
    { atMs: 3000, coefficient: 0.5 },
    { atMs: 3428, coefficient: 0.2 },
    { atMs: 4000, coefficient: 0.2 },
    { atMs: 4000, coefficient: 0.5 },
  ];
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930023,
      name: "Fixture Variable Hits",
      castTimeMs: 4000,
      effects: [strikeTimeline(ticks)],
    }],
  });
  const profession = defineProfession({
    id: "variable-hit-fixture",
    name: "Variable Hit Fixture",
    catalog,
  });
  const simulate = quickness => simulateGw2({
    profession,
    rotation: ["Fixture Variable Hits"],
    config: { boons: { quickness } },
  });
  const normal = simulate(false);
  const quick = simulate(true);
  const normalHits = normal.resolvedEvents.filter(event =>
    event.type === "damage");
  const quickHits = quick.resolvedEvents.filter(event =>
    event.type === "damage");
  const quickAction = quick.events.find(event => event.type === "action");

  assert.deepEqual(
    normalHits.map(event => Math.round(event.at * 1000)),
    ticks.map(tick => tick.atMs),
  );
  assert.deepEqual(
    normalHits.map(event => event.coefficient),
    ticks.map(tick => tick.coefficient),
  );
  assert.deepEqual(
    normalHits.slice(-2).map(event => [event.at, event.coefficient]),
    [[4, 0.2], [4, 0.5]],
  );
  assert.ok(Math.abs(
    normalHits.reduce((sum, event) => sum + event.coefficient, 0) - 3.6,
  ) < 1e-12);
  assert.equal(Math.round((quickAction.endsAt - quickAction.at) * 1000), 2680);
  assert.deepEqual(
    quickHits.slice(-2).map(event => [
      Math.round(event.at * 1000),
      event.coefficient,
    ]),
    [[2680, 0.2], [2680, 0.5]],
  );
});

test("declarative condition timelines preserve each application", () => {
  const ticks = [
    {
      atMs: 0,
      condition: "Burning",
      stacks: 1,
      duration: 2,
    },
    {
      atMs: 500,
      condition: "Bleeding",
      stacks: 2,
      duration: 4,
    },
    {
      atMs: 2000,
      condition: "Poisoned",
      stacks: 1,
      duration: 3,
    },
    {
      atMs: 2000,
      condition: "Burning",
      stacks: 3,
      duration: 5,
    },
  ];
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930025,
      name: "Fixture Variable Conditions",
      castTimeMs: 2000,
      effects: [conditionTimeline(ticks)],
    }],
  });
  const profession = defineProfession({
    id: "condition-timeline-fixture",
    name: "Condition Timeline Fixture",
    catalog,
  });
  const simulate = quickness => simulateGw2({
    profession,
    rotation: ["Fixture Variable Conditions"],
    config: { boons: { quickness } },
  });
  const normal = simulate(false);
  const quick = simulate(true);
  const normalApplications = normal.resolvedEvents.filter(event =>
    event.type === "condition");
  const quickApplications = quick.resolvedEvents.filter(event =>
    event.type === "condition");
  const quickAction = quick.events.find(event => event.type === "action");

  assert.deepEqual(
    normalApplications.map(event => ({
      atMs: Math.round(event.at * 1000),
      condition: event.condition,
      stacks: event.stacks,
      duration: event.duration,
    })),
    ticks,
  );
  assert.deepEqual(
    normalApplications.slice(-2).map(event => [event.at, event.condition]),
    [[2, "Poisoned"], [2, "Burning"]],
  );
  assert.ok(normal.conditionDamage > 0);
  assert.equal(Math.round((quickAction.endsAt - quickAction.at) * 1000), 1360);
  assert.deepEqual(
    quickApplications.slice(-2).map(event => [
      Math.round(event.at * 1000),
      event.condition,
    ]),
    [[1360, "Poisoned"], [1360, "Burning"]],
  );
});

test("canonical strike timelines reject invalid or ambiguous hits", () => {
  const skillWithTicks = ticks => ({
    id: 930024,
    name: "Invalid Tick Fixture",
    effects: [{ type: "strike", ticks }],
  });

  assert.throws(
    () => createCanonicalCatalog({
      generated: [skillWithTicks([
        { atMs: 100, coefficient: 0.2 },
        { atMs: 50, coefficient: 0.5 },
      ])],
    }),
    /chronological/,
  );
  assert.throws(
    () => createCanonicalCatalog({
      generated: [skillWithTicks([{ atMs: 0, coefficient: -0.2 }])],
    }),
    /non-negative coefficient/,
  );
  assert.throws(
    () => createCanonicalCatalog({
      generated: [{
        ...skillWithTicks([{ atMs: 0, coefficient: 0.2 }]),
        effects: [{
          type: "strike",
          coefficient: 0.2,
          ticks: [{ atMs: 0, coefficient: 0.2 }],
        }],
      }],
    }),
    /cannot use aggregate/,
  );
});

test("canonical condition timelines reject invalid or ambiguous applications", () => {
  const skillWithTicks = ticks => ({
    id: 930026,
    name: "Invalid Condition Timeline Fixture",
    effects: [{ type: "condition", ticks }],
  });

  assert.throws(
    () => createCanonicalCatalog({
      generated: [skillWithTicks([{
        atMs: 0,
        condition: "Burning",
        stacks: 0,
        duration: 2,
      }])],
    }),
    /positive stacks/,
  );
  assert.throws(
    () => createCanonicalCatalog({
      generated: [{
        ...skillWithTicks([{
          atMs: 0,
          condition: "Burning",
          stacks: 1,
          duration: 2,
        }]),
        effects: [{
          type: "condition",
          condition: "Burning",
          ticks: [{
            atMs: 0,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          }],
        }],
      }],
    }),
    /cannot use aggregate/,
  );
});

test("GW2 Quickness quantizes casts and derives cast-bound effect timing", () => {
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930020,
      name: "Fixture Timeline",
      castTimeMs: 2200,
      effects: [{
        type: "strike",
        coefficient: 4,
        hits: 4,
        atMsList: [550, 1100, 1650, 2200],
      }],
    }, {
      id: 930021,
      name: "Fixture Channel",
      castTimeMs: 600,
      effects: [{
        type: "strike",
        coefficient: 3,
        hits: 3,
        atMs: 200,
        intervalMs: 200,
      }],
    }, {
      id: 930022,
      name: "Fixture Field",
      castTimeMs: 600,
      effects: [{
        type: "strike",
        coefficient: 3,
        hits: 3,
        atCastEndOffsetMs: 1000,
        intervalMs: 1000,
      }],
    }],
  });
  const profession = defineProfession({
    id: "quickness-fixture",
    name: "Quickness Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Fixture Timeline",
      "Fixture Channel",
      "Fixture Field",
      { type: "wait", durationMs: 4000 },
    ],
    config: { boons: { quickness: true } },
  });
  const profile = skillName => {
    const action = result.events.find(event =>
      event.type === "action" && event.skillName === skillName);
    return {
      cast: Math.round((action.endsAt - action.at) * 1000),
      ticks: result.resolvedEvents
        .filter(event =>
          event.type === "damage" && event.skillName === skillName)
        .map(event => Math.round((event.at - action.at) * 1000)),
    };
  };

  assert.deepEqual(profile("Fixture Timeline"), {
    cast: 1480,
    ticks: [370, 740, 1110, 1480],
  });
  assert.deepEqual(profile("Fixture Channel"), {
    cast: 400,
    ticks: [133, 267, 400],
  });
  assert.deepEqual(profile("Fixture Field"), {
    cast: 400,
    ticks: [1400, 2400, 3400],
  });
});

test("GW2 declarative policy enforces active weapons and skill weapon strength", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930011,
        name: "Fixture Greatsword",
        type: "Weapon",
        weapon: "Greatsword",
        castTimeMs: 0,
        effects: [{ type: "strike", coefficient: 1 }],
      },
      {
        id: 930012,
        name: "Fixture Sword",
        type: "Weapon",
        weapon: "Sword",
        castTimeMs: 0,
        effects: [{ type: "strike", coefficient: 1 }],
      },
    ],
    weapons: ["Greatsword", "Sword"],
    weaponHands: { Greatsword: "2h", Sword: "mh" },
  });
  const profession = defineProfession({
    id: "weapon-policy-fixture",
    name: "Weapon Policy Fixture",
    catalog,
  });
  const greatsword = simulateGw2({
    profession,
    rotation: ["Fixture Greatsword"],
  });
  const sword = simulateGw2({
    profession,
    rotation: ["Fixture Sword"],
  });
  const unavailable = simulateGw2({
    profession,
    rotation: ["Fixture Greatsword"],
    config: { primaryWeapon: "Sword" },
  });

  assert.equal(greatsword.strikeDamage / sword.strikeDamage, 1.1);
  assert.equal(unavailable.totalDamage, 0);
  assert.match(unavailable.warnings.join(" "), /unavailable/);
});

test("profession condition-duration hooks remain under the GW2 cap", () => {
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930013,
      name: "Fixture Burn",
      castTimeMs: 0,
      effects: [{
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 1,
      }],
    }],
  });
  const profession = defineProfession({
    id: "duration-cap-fixture",
    name: "Duration Cap Fixture",
    catalog,
    attributeRules: {
      modifyConditionDuration: (_context, duration) => duration * 2,
    },
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Fixture Burn",
      { type: "wait", durationMs: 2000 },
    ],
    config: { stats: { expertise: 1500 } },
  });
  const burning = result.resolvedEvents.find(event =>
    event.type === "condition");

  assert.equal(burning.effectiveDuration, 2);
});

test("resolver modifiers receive stable trait, event, and runtime context", () => {
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930002,
      name: "Context Strike",
      castTimeMs: 0,
      effects: [{ type: "strike", coefficient: 1 }],
    }],
  });
  let observed = null;
  const profession = defineProfession({
    id: "context-fixture",
    name: "Context Fixture",
    catalog,
    attributeRules: {
      modifyStrikeDamage(context, multiplier) {
        observed = {
          actorType: context.actorType,
          hasState: Boolean(context.state),
          skillId: context.skillId,
          trait: context.traits.has("context-fixture.damage"),
        };
        return observed.trait && observed.skillId === 930002
          ? multiplier * 2
          : multiplier;
      },
    },
  });
  const base = simulateGw2({
    profession,
    rotation: ["Context Strike"],
  });
  const modified = simulateGw2({
    profession,
    rotation: ["Context Strike"],
    config: {
      selectedTraits: [],
      selectedTraitIds: ["context-fixture.damage"],
    },
  });

  assert.equal(modified.strikeDamage / base.strikeDamage, 2);
  assert.deepEqual(observed, {
    actorType: "player",
    hasState: true,
    skillId: 930002,
    trait: true,
  });
});

test("Mesmer production simulation is reached through simulateGw2", () => {
  const config = {
    ...createDefaultConfig(),
    target: {
      ...createDefaultConfig().target,
      health: 0,
    },
  };
  const canonical = simulateGw2({
    profession: mesmerProfession,
    rotation: ["Bladecall"],
    config,
  });
  const compatibility = simulateMesmer(["Bladecall"], config);

  assert.equal(canonical.totalDamage, compatibility.totalDamage);
  assert.equal(canonical.strikeDamage, compatibility.strikeDamage);
  assert.equal(canonical.conditionDamage, compatibility.conditionDamage);
  assert.ok(canonical.totalDamage > 0);
  assert.deepEqual(
    Object.keys(canonical.endState).sort(),
    ["activeWeaponSet", "ammo", "cooldowns", "profession", "time"].sort(),
  );
  assert.equal(canonical.endState.profession.resource, 5);
});

test("unknown required custom events fail clearly", () => {
  const stream = buildScheduledEventStream({
    events: [{
      type: "fixture.missing",
      at: 0,
      source: "fixture",
      sourceId: 1,
    }],
    rotationEndTime: 1,
  });
  assert.throws(
    () => resolveScheduledStream({
      stream,
      profession: testProfession,
      handlerRegistry: new HandlerRegistry(),
    }),
    /Missing required event handler/,
  );
});

test("canonical catalog validation rejects duplicate ids and missing handlers", () => {
  assert.throws(
    () => createCanonicalCatalog({
      generated: [
        { id: 1, name: "One", effects: [] },
        { id: 1, name: "Two", effects: [] },
      ],
    }),
    /Duplicate/,
  );
  assert.throws(
    () => createCanonicalCatalog({
      generated: [{ id: 1, name: "One", handlerId: "missing", effects: [] }],
    }),
    /missing handler/,
  );
  assert.equal(mesmerCatalog.skillsById.size, mesmerCatalog.skills.length);
  const lastNameWins = createCanonicalCatalog({
    generated: [
      { id: 1, name: "Variant", effects: [] },
      { id: 2, name: "Variant", effects: [] },
    ],
    skillNameCollision: "last",
  });
  assert.equal(lastNameWins.skillsByName.get("Variant").id, 2);
  assert.throws(
    () => createCanonicalCatalog({ skillNameCollision: "invalid" }),
    /collision policy/,
  );
});

test("canonical catalogs carry validated traits and specializations", () => {
  const catalog = createCanonicalCatalog({
    traits: [{ id: 1, name: "Fixture Trait" }],
    specializations: [{ id: 2, name: "Fixture Line" }],
  });
  assert.equal(catalog.traits[0].name, "Fixture Trait");
  assert.equal(catalog.specializations[0].name, "Fixture Line");
  assert.throws(
    () => createCanonicalCatalog({
      traits: [
        { id: 1, name: "One" },
        { id: 1, name: "Two" },
      ],
    }),
    /Duplicate or missing trait/,
  );
});

test("catalog skill handlers receive calculated recharge timing", () => {
  let observedReadyAt = null;
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930014,
      name: "Timed Handler",
      cooldown: 20,
      castTimeMs: 1000,
      handlerId: "fixture.timed",
      effects: [],
    }],
    skillHandlers: {
      "fixture.timed": context => {
        observedReadyAt = context.rechargeReadyAt;
        return true;
      },
    },
  });
  const profession = defineProfession({
    id: "timed-handler-fixture",
    name: "Timed Handler Fixture",
    catalog,
  });

  simulateGw2({
    profession,
    rotation: ["Timed Handler"],
    config: { boons: { alacrity: true } },
  });
  assert.equal(observedReadyAt, 17);
});

test("canonical skill handlers are callable and dispatched by handler id", () => {
  let handled = 0;
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 930003,
      name: "Handled Skill",
      handlerId: "fixture.handled",
      castTimeMs: 0,
      effects: [{ type: "strike", coefficient: 10 }],
    }],
    skillHandlers: {
      "fixture.handled": () => {
        handled += 1;
        return true;
      },
    },
  });
  const profession = defineProfession({
    id: "handled-fixture",
    name: "Handled Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: ["Handled Skill"],
  });

  assert.equal(handled, 1);
  assert.equal(result.totalDamage, 0);
});

test("shared relic behavior resolves triggering skills by stable id", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930004,
        name: "Duplicate Name",
        type: "Weapon",
        cooldown: 20,
        castTimeMs: 0,
        effects: [{ type: "strike", coefficient: 1 }],
      },
      {
        id: 930005,
        name: "Duplicate Name",
        type: "Weapon",
        cooldown: 0,
        castTimeMs: 0,
        effects: [{ type: "strike", coefficient: 1 }],
      },
    ],
  });
  const profession = defineProfession({
    id: "stable-id-fixture",
    name: "Stable ID Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: "cast", skillId: 930004 }],
    config: { relic: "Fireworks" },
  });

  assert.equal(
    result.procSteps.some(step => step.skill === "Relic of Fireworks"),
    true,
  );
});

test("Mesmer build migrations produce validated schema version 3 data", () => {
  const migrated = migrateMesmerBuild({
    sigils: ["Force", "Impact"],
    assumptions: { vulnerability: 10 },
    rotation: ["Mind Stab", { name: "__wait", waitMs: 125 }],
  });
  assert.equal(migrated.schemaVersion, BUILD_SCHEMA_VERSION);
  assert.equal(migrated.profession, "mesmer");
  assert.equal(migrated.assumptions.targetConditions.Vulnerability, 10);
  assert.deepEqual(migrated.rotation[0], {
    type: "cast",
    skillId: mesmerCatalog.skillsByName.get("Mind Stab").id,
  });
  assert.equal(validateMesmerBuild(migrated).valid, true);
  assert.throws(
    () => migrateMesmerBuild({ profession: "guardian" }),
    /Cannot load guardian/,
  );
});

test("common weapon data includes Guardian weapon families", () => {
  const guardianWeapons = createProfessionWeaponData(
    guardianCatalog,
  );
  const mesmerWeapons = createProfessionWeaponData(mesmerCatalog);
  assert.equal(guardianWeapons.Mace.wielding, "mh");
  assert.equal(guardianWeapons.Sword.wielding, "mh+oh");
  assert.equal(guardianWeapons.Hammer.wielding, "2h");
  assert.equal(guardianWeapons.Longbow.wielding, "2h");
  assert.equal(mesmerWeapons.Dagger.wielding, "mh");
  assert.equal(mesmerWeapons.Pistol.wielding, "oh");
  assert.equal(WEAPON_DATA.Warhorn.wielding, "oh");
  assert.equal(WEAPON_DATA.Shortbow.wielding, "2h");
});

test("Mesmer state creation and snapshots are profession owned", () => {
  const state = createMesmerState({ infiniteForge: true });
  state.numericResource = 3;
  state.clones.push({ id: 1 });
  const snapshot = snapshotMesmerState(state);
  assert.equal(state.nextForgeAt, 3);
  assert.equal(snapshot.numericResource, 3);
  assert.equal(snapshot.cloneCount, 1);
  assert.equal(mesmerProfession.id, "mesmer");
  assert.equal(typeof mesmerProfession.eventReactions.damage, "function");
  assert.equal(typeof mesmerProfession.eventReactions.control, "function");
  assert.equal(Object.hasOwn(mesmerProfession.eventHandlers, "damage"), false);
  assert.equal(Object.hasOwn(mesmerProfession.eventHandlers, "control"), false);
  assert.equal(
    Object.keys(mesmerProfession.eventHandlers)
      .every(type => type.startsWith("mesmer.")),
    true,
  );
  assert.equal(
    COMMON_EVENT_TYPES.some(type =>
      Object.hasOwn(mesmerProfession.eventHandlers, type)),
    false,
  );
});

async function javascriptFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const target = path.join(root, entry.name);
    return entry.isDirectory()
      ? javascriptFiles(target)
      : entry.name.endsWith(".js")
        ? [target]
        : [];
  }));
  return nested.flat();
}

test("platform import boundaries are profession neutral", async () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../js/platform",
  );
  for (const file of await javascriptFiles(root)) {
    const source = await readFile(file, "utf8");
    const relative = path.relative(root, file).replaceAll("\\", "/");
    assert.doesNotMatch(source, /mesmer/i, `${relative} mentions Mesmer`);
    if (relative.startsWith("engine/")) {
      assert.doesNotMatch(source, /(?:\.\.\/)+gw2\//, `${relative} imports GW2`);
      assert.doesNotMatch(source, /(?:\.\.\/)+ui\//, `${relative} imports UI`);
      assert.doesNotMatch(source, /professions\//, `${relative} imports a profession`);
    }
    if (relative.startsWith("gw2/") || relative.startsWith("ui/")) {
      assert.doesNotMatch(source, /professions\//, `${relative} imports a profession`);
    }
  }
});

test("test profession fixture has no Mesmer dependency", async () => {
  const source = await readFile(
    fileURLToPath(new URL("./fixtures/test-profession.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(source, /mesmer/i);
});

test("declarative professions use the standard mechanics module roles", async () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../js/professions",
  );
  for (const profession of ["mesmer", "guardian", "necromancer"]) {
    const mechanicsRoot = path.join(root, profession, "mechanics");
    const prefix = profession.toUpperCase();
    const defaults = await readFile(
      path.join(mechanicsRoot, "skill-defaults.js"),
      "utf8",
    );
    const overrides = await readFile(
      path.join(mechanicsRoot, "skill-overrides.js"),
      "utf8",
    );
    const mechanics = await readFile(
      path.join(mechanicsRoot, "skill-mechanics.js"),
      "utf8",
    );
    await readFile(
      path.join(mechanicsRoot, "autoattack-chains.js"),
      "utf8",
    );

    assert.match(defaults, new RegExp(
      `export const ${prefix}_SKILL_DEFAULTS\\b`,
    ));
    assert.match(overrides, new RegExp(
      `export const ${prefix}_SKILL_OVERRIDES\\b`,
    ));
    assert.match(mechanics, /from "\.\/skill-defaults\.js"/);
    assert.match(mechanics, /from "\.\/skill-overrides\.js"/);
    assert.match(mechanics, new RegExp(
      `export const ${prefix}_SKILL_MECHANICS\\b`,
    ));

    const catalog = await readFile(
      path.join(root, profession, "catalog.js"),
      "utf8",
    );
    assert.match(catalog, /mechanics\/skill-mechanics\.js/);
    assert.doesNotMatch(catalog, /mechanics\/skill-(?:defaults|overrides)\.js/);
  }
});

test("obsolete compatibility trees are removed", async () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../js",
  );
  for (const directory of ["core", "data", "sim"]) {
    await assert.rejects(
      readdir(path.join(root, directory)),
      error => error?.code === "ENOENT",
    );
  }
  await assert.rejects(
    readFile(
      path.join(root, "professions", "mesmer", "app", "app-rotation-ui.js"),
      "utf8",
    ),
    error => error?.code === "ENOENT",
  );
});
