import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleNativeApplicationCatalog,
  defineNativeModule,
  defineNativeProfession,
  nativeSkillRuntimeOwner,
  onResolvedDamage,
  onResolvedPlayerCriticalHit,
} from "../js/platform/gw2/native-profession.js";

const replaceHandler = Object.freeze({
  mode: "replace",
  beforeEffects: () => undefined,
});
const skill = (id, name, extra = {}) => Object.freeze({
  id,
  name,
  implemented: true,
  castTimeMs: 0,
  effects: [],
  ...extra,
});
const coreModule = () => defineNativeModule({
  id: "Core",
  data: {
    generatedSkills: [skill(1, "Core Skill", { handlerId: "test.core" })],
    traits: [{ id: 10, name: "Core Trait", specialization: "Core Line" }],
    specializations: [{ id: 20, name: "Core Line", elite: false }],
    handlers: { "test.core": replaceHandler },
    weapons: ["Sword"],
    weaponHands: { Sword: "mh" },
  },
  state: { scheduler: () => ({ coreValue: 1 }) },
});
const eliteModule = () => defineNativeModule({
  id: "Elite",
  data: {
    generatedSkills: [
      skill(2, "Elite Skill", {
        specialization: "Elite",
        handlerId: "test.elite",
      }),
      skill(3, "Elite Mechanic Weapon", {
        type: "Weapon",
        specialization: "Elite",
      }),
    ],
    traits: [{ id: 11, name: "Elite Trait", specialization: "Elite" }],
    specializations: [{ id: 21, name: "Elite", elite: true }],
    handlers: { "test.elite": replaceHandler },
  },
  state: { scheduler: () => ({ eliteValue: 2 }) },
});

test("module-first assembly derives application and active runtime catalogs", () => {
  const modules = [coreModule(), eliteModule()];
  const catalog = assembleNativeApplicationCatalog(modules);
  const family = defineNativeProfession({ id: "fixture", name: "Fixture", modules });

  assert.equal(family.catalog, catalog);
  assert.deepEqual(catalog.skills.map(({ id }) => id).sort(), [1, 2, 3]);
  assert.equal(nativeSkillRuntimeOwner(modules, catalog.skillsById.get(3)), "Core");
  assert.deepEqual(
    family.resolveRuntime({ specialization: "Core" }).catalog.skills.map(({ id }) => id),
    [1, 3],
  );
  assert.deepEqual(
    family.resolveRuntime({ specialization: "Elite" }).catalog.skills.map(({ id }) => id).sort(),
    [1, 2, 3],
  );
  assert.deepEqual(family.specializationIds, ["Elite"]);
  assert.equal(family.resolveRuntime({ specialization: "Core" }).catalog.skillHandlers.has("test.elite"), false);
  assert.equal(family.resolveRuntime({ specialization: "Elite" }).catalog.skillHandlers.has("test.elite"), true);
});

test("module-first assembly rejects duplicate and incomplete contributions", () => {
  const core = coreModule();
  assert.throws(
    () => assembleNativeApplicationCatalog([core, defineNativeModule({
      id: "Duplicate",
      data: { generatedSkills: [skill(1, "Duplicate")] },
      state: { scheduler: () => ({}) },
    })]),
    /Duplicate generated skill id 1/,
  );
  assert.throws(
    () => assembleNativeApplicationCatalog([core, defineNativeModule({
      id: "DuplicateHand",
      data: { weapons: ["Sword"], weaponHands: { Sword: "oh" } },
      state: { scheduler: () => ({}) },
    })]),
    /Duplicate weapon-hand entry Sword/,
  );
  assert.throws(
    () => assembleNativeApplicationCatalog([core, defineNativeModule({
      id: "UnusedHandler",
      data: { handlers: { "test.unused": replaceHandler } },
      state: { scheduler: () => ({}) },
    })]),
    /Skill handler test\.unused is unused/,
  );
  assert.throws(
    () => defineNativeModule({ id: "Broken", data: {}, state: {} }),
    /Broken\.state\.scheduler must be a function/,
  );
});

test("phase-explicit reactions retain stable order", () => {
  const calls = [];
  const core = defineNativeModule({
    id: "Core",
    data: {},
    state: { scheduler: () => ({}) },
    mechanics: {
      reactions: [
        onResolvedDamage({ id: "later", order: 20, handler: () => calls.push("later") }),
        onResolvedDamage({ id: "first", order: -10, handler: () => calls.push("first") }),
        onResolvedDamage({ id: "middle", order: 0, handler: () => calls.push("middle") }),
      ],
    },
  });
  const runtime = defineNativeProfession({
    id: "ordered",
    name: "Ordered",
    modules: [core],
  }).resolveRuntime({ specialization: "Core" });
  runtime.eventReactions.damage({}, { type: "damage", at: 0 }, {});
  assert.deepEqual(calls, ["first", "middle", "later"]);
});

test("critical-hit helper preserves deterministic and stochastic semantics", () => {
  const state = { progress: 0, readyAt: 0, procs: 0, rolls: 0 };
  const context = {
    random: {
      stochastic: false,
      roll: (chance, stream) => {
        state.rolls += 1;
        assert.equal(chance, 0.5);
        assert.equal(stream, "fixture.critical");
        return true;
      },
    },
  };
  const reaction = onResolvedPlayerCriticalHit({
    id: "fixture.critical",
    chanceOnCriticalHit: 0.5,
    sourceIds: [7],
    expectedProgress: {
      get: () => state.progress,
      set: (_context, value) => { state.progress = value; },
    },
    internalCooldown: {
      duration: 1,
      readyAt: () => state.readyAt,
      setReadyAt: (_context, value) => { state.readyAt = value; },
    },
    attribution: { kind: "trait", id: 99 },
    handler: () => { state.procs += 1; },
  });
  const event = { type: "damage", at: 0, actorType: "player", sourceId: 7 };
  const deterministic = { hitContext: { critical: { chance: 0.5 } } };
  for (let index = 0; index < 8; index += 1) {
    reaction.handler(context, { ...event, at: index / 4 }, deterministic);
  }
  assert.equal(state.procs, 1);
  assert.equal(state.rolls, 0);
  assert.equal(state.progress, 1);

  context.random.stochastic = true;
  reaction.handler(context, { ...event, at: 2 }, {
    hitContext: { critical: { chance: 0.5, didCrit: false } },
  });
  reaction.handler(context, { ...event, at: 2 }, {
    hitContext: { critical: { chance: 0.5, didCrit: true } },
  });
  assert.equal(state.procs, 2);
  assert.equal(state.rolls, 1);
  assert.deepEqual(reaction.attribution, { kind: "trait", id: 99 });

  reaction.handler(context, { ...event, at: 3, actorType: "summon" }, {
    hitContext: { critical: { chance: 1, didCrit: true } },
  });
  reaction.handler(context, { ...event, at: 3, sourceId: 8 }, {
    hitContext: { critical: { chance: 1, didCrit: true } },
  });
  assert.equal(state.procs, 2);
});
