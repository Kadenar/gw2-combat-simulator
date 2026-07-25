import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCanonicalCatalog } from "../js/platform/engine/catalog.js";
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
  simulateSequence,
} from "../js/professions/mesmer/simulation.js";
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
  assert.ok(available.totalDamage > 0);
  assert.equal(expired.totalDamage, 0);
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
  const compatibility = simulateSequence(["Bladecall"], config);

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
});
