import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCanonicalCatalog } from "../../js/platform/engine/catalog.js";
import {
  deriveAutoattackChains,
  indexAutoattackChains,
} from "../../js/platform/engine/autoattack-chains.js";
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
  strikePackets,
  strikeTimeline,
} from "../../js/platform/engine/effect-factories.js";
import { COMMON_EVENT_TYPES } from "../../js/platform/engine/events.js";
import { HandlerRegistry } from "../../js/platform/engine/handler-registry.js";
import { defineProfession } from "../../js/platform/engine/profession.js";
import { resolveScheduledStream } from "../../js/platform/engine/resolver.js";
import {
  normalizeRotation,
  toLegacyRotationEntry,
} from "../../js/platform/engine/rotation-commands.js";
import { createSchedulerState } from "../../js/platform/engine/scheduler-state.js";
import { createScheduler } from "../../js/platform/engine/scheduler.js";
import { buildScheduledEventStream } from "../../js/platform/engine/scheduled-event-stream.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
  SKILL_HANDLER_MODES,
} from "../../js/platform/engine/skill-handlers.js";
import { simulateGw2 } from "../../js/platform/gw2/simulate.js";
import {
  nativeProfessionRegistry,
  professionRegistry,
} from "../../js/app/profession/registry.js";
import {
  createProfessionWeaponData,
  WEAPON_DATA,
} from "../../js/platform/gw2/gear-data.js";
import { createGw2ResolverExtensions } from "../../js/platform/gw2/resolver/extensions.js";
import {
  createRelicRuntime,
  createRelicTimelineRuntime,
  handleWeaknessVulnerabilityRelic,
  materializeBoonRelics,
  relicConditionDurationBonus,
} from "../../js/platform/gw2/relic-rules.js";
import { sigilCriticalContribution } from "../../js/platform/gw2/sigil-rules.js";
import {
  FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
  PRECISION_PER_CRITICAL_CHANCE_FRACTION,
} from "../../js/platform/gw2/stat-scaling.js";
import { GW2_SKILL_FLAGS } from "../../scripts/data/lib/gw2-profession-snapshot.mjs";
import {
  BUILD_SCHEMA_VERSION,
  migrateMesmerBuild,
  validateMesmerBuild,
} from "../../js/professions/mesmer/build.js";
import { mesmerCatalog } from "../../js/professions/mesmer/catalog.js";
import { mesmerProfession } from "../../js/professions/mesmer/definition.js";
import { MESMER_TRAIT_COVERAGE } from "../../js/professions/mesmer/data/trait-coverage.js";
import { MECHANIC_SKILLS } from "../../js/professions/mesmer/mechanics/skill-mechanics.js";
import { guardianCatalog } from "../../js/professions/guardian/catalog.js";
import { necromancerCatalog } from "../../js/professions/necromancer/catalog.js";
import {
  createDefaultConfig,
  simulateMesmer,
} from "../helpers/mesmer-simulation.js";
import { snapshotMesmerState } from "../../js/professions/mesmer/core/state.js";
import { testProfession } from "../fixtures/test-profession.js";

test("native professions share one skill timing contract", async () => {
  for (const entry of nativeProfessionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;
    for (const skill of catalog.skills) {
      assert.equal("activation" in skill, false, skill.name);
      assert.equal("castTime" in skill, false, skill.name);
      assert.ok(Number.isFinite(skill.castTimeMs), skill.name);
      if (skill.quicknessCastTimeMs != null) {
        assert.equal(
          skill.castTimeMs,
          skill.quicknessCastTimeMs * 1.5,
          skill.name,
        );
      }
      if (skill.unaffectedByQuickness) {
        assert.equal(skill.quicknessCastTimeMs, undefined, skill.name);
      }
      assert.ok(Array.isArray(skill.lockouts), skill.name);
      for (const effect of skill.effects) {
        assert.equal("atMsList" in effect, false, skill.name);
        assert.equal("packetOffsets" in effect, false, skill.name);
        assert.equal("atCastEndOffsetMs" in effect, false, skill.name);
        const explicitlyTimed =
          effect.atMs != null ||
          effect.intervalMs != null ||
          effect.ticks != null;
        assert.equal(
          explicitlyTimed,
          effect.timingAnchor != null && effect.timingScale != null,
          skill.name,
        );
      }
    }
  }
});

test("native skill authoring uses one cast timing source", async () => {
  const professionsRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js/professions",
  );

  for (const entry of nativeProfessionRegistry) {
    const files = await javascriptFiles(path.join(professionsRoot, entry.id));
    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        await readFile(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );

      function visit(node) {
        if (ts.isObjectLiteralExpression(node)) {
          const propertyNames = new Set(
            node.properties.flatMap((property) => {
              if (!ts.isPropertyAssignment(property)) return [];
              if (
                !ts.isIdentifier(property.name) &&
                !ts.isStringLiteral(property.name)
              ) {
                return [];
              }
              return [property.name.text];
            }),
          );
          const hasBaseCast = propertyNames.has("castTimeMs");
          const hasQuicknessCast = propertyNames.has("quicknessCastTimeMs");
          const hasQuicknessImmunity = propertyNames.has(
            "unaffectedByQuickness",
          );
          const line =
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1;
          assert.equal(
            hasBaseCast && hasQuicknessCast,
            false,
            `${path.relative(professionsRoot, file)}:${line}`,
          );
          assert.equal(
            hasQuicknessCast && hasQuicknessImmunity,
            false,
            `${path.relative(professionsRoot, file)}:${line}`,
          );
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
});

test("canonical skills derive base casts and can opt out of Quickness", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930000,
        name: "Derived Base Cast",
        quicknessCastTimeMs: 600,
        effects: [],
      },
      {
        id: 930001,
        name: "Quickness Immune Cast",
        castTimeMs: 700,
        unaffectedByQuickness: true,
        effects: [],
      },
    ],
  });

  assert.deepEqual(
    [
      catalog.skillsById.get(930000).castTimeMs,
      catalog.skillsById.get(930000).quicknessCastTimeMs,
    ],
    [900, 600],
  );
  assert.deepEqual(
    [
      catalog.skillsById.get(930001).castTimeMs,
      catalog.skillsById.get(930001).unaffectedByQuickness,
    ],
    [700, true],
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930002,
            name: "Conflicting Quickness Cast",
            castTimeMs: 700,
            quicknessCastTimeMs: 500,
            unaffectedByQuickness: true,
          },
        ],
      }),
    /cannot specify quicknessCastTimeMs/,
  );
});

test("native profession weapon swaps share timing policy", async () => {
  for (const entry of nativeProfessionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;
    const skill = catalog.skillsByName.get("Swap Weapons");
    assert.equal(skill.castTimeMs, 0, catalog.id);
    assert.equal(Number(skill.quicknessCastTimeMs || 0), 0, catalog.id);
    assert.equal(skill.rechargeAnchor, "castStart", catalog.id);
  }
});

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
  assert.deepEqual(calls, [
    "first",
    "same",
    "later",
    "first-control",
    "later-control",
  ]);
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

test("canonical catalogs own derived and exceptional autoattack chains", () => {
  const skill = (id, nextChainId = null, type = "Weapon") => ({
    id,
    name: `Skill ${id}`,
    type,
    slot: type === "Weapon" ? "Weapon_1" : "Profession_1",
    nextChainId,
  });
  const catalog = createCanonicalCatalog({
    generated: [
      skill(1, 2),
      skill(2, 3),
      skill(3),
      skill(4, 5),
      skill(5),
      skill(6, null, "Profession"),
      skill(7, null, "Profession"),
    ],
    autoattackChains: {
      excludeSkillIds: [5],
      additional: [[6, 7]],
    },
  });

  assert.deepEqual(catalog.autoattackChains, [
    [1, 2, 3],
    [6, 7],
  ]);
  assert.deepEqual(catalog.autoattackChainPositions.get(2), {
    root: 1,
    index: 1,
    step: 2,
    next: 3,
  });
  assert.equal(catalog.skillsById.get(2).chainRoot, 1);
  assert.equal(catalog.skillsById.get(2).chainStep, 2);
  assert.equal(catalog.skillsById.get(4).chainRoot, null);
  assert.equal(catalog.skillsById.get(5).chainStep, null);
  assert.equal(catalog.skillsById.get(7).chainRoot, 6);
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
    }).map((effect) => [effect.atMs, effect.source]),
    [
      [100, "Effect"],
      [300, "Effect"],
    ],
  );
  assert.deepEqual(
    control("fear", 300, {
      source: "Effect",
      metadata: { breakbar: 100 },
    }),
    {
      type: "control",
      atMs: 300,
      source: "Effect",
      metadata: { controlKind: "fear", breakbar: 100 },
    },
  );
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
        effects: [
          {
            type: "boon",
            boon: "aegis",
            duration: 2,
            stacks: 1,
          },
        ],
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
      validateCast: (context) =>
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
      "lockouts",
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

test("normalized commands migrate legacy timing and charge-release options", () => {
  assert.deepEqual(
    normalizeRotation(
      [
        "Fixture Slash",
        { name: "__wait", waitMs: 250 },
        {
          name: "Fixture Charge",
          offset: 100,
          interruptMs: 50,
          releaseAtCharges: 3,
        },
        "__cooldown_reset",
        "__combat_start",
      ],
      testProfession.catalog,
    ),
    [
      { type: "cast", skillId: 900001 },
      { type: "wait", durationMs: 250 },
      {
        type: "cast",
        skillId: 900002,
        concurrentOffsetMs: 100,
        interruptAfterMs: 50,
        releaseAtCharges: 3,
      },
      { type: "cooldown-reset" },
      { type: "combat-start" },
    ],
  );
  assert.deepEqual(
    toLegacyRotationEntry(
      {
        type: "cast",
        skillId: 900002,
        releaseAtCharges: 3,
      },
      testProfession.catalog,
    ),
    { name: "Fixture Charge", releaseAtCharges: 3 },
  );
  assert.throws(
    () =>
      normalizeRotation(
        [{ name: "Fixture Charge", releaseAtCharges: 0 }],
        testProfession.catalog,
        { strict: true },
      ),
    /positive whole number/,
  );
});

test("normalized commands preserve signed combat-start offsets", () => {
  assert.deepEqual(
    normalizeRotation(
      ["Fixture Slash", { name: "__combat_start", offset: 100 }],
      testProfession.catalog,
    ),
    [
      { type: "cast", skillId: 900001 },
      { type: "combat-start", concurrentOffsetMs: 100 },
    ],
  );
  assert.deepEqual(
    normalizeRotation(
      ["Fixture Slash", { name: "__combat_start", offset: -440 }],
      testProfession.catalog,
    ),
    [
      { type: "cast", skillId: 900001 },
      { type: "combat-start", concurrentOffsetMs: -440 },
    ],
  );
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
  const marker = result.events.find((event) => event.type === "combat_start");

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
  const slash = result.events.find((event) => event.sourceId === 900001);
  const charge = result.events.find(
    (event) => event.type === "action" && event.sourceId === 900002,
  );
  assert.equal(slash.endsAt, 0.4);
  assert.equal(slash.interrupted, true);
  assert.equal(charge.at, 0.1);
  assert.equal(
    result.events.some(
      (event) => event.type === "damage" && event.sourceId === 900001,
    ),
    false,
  );
});

test("independent casts use a separate serial cast lane", () => {
  const profession = defineProfession({
    id: "independent-casts",
    name: "Independent Casts",
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 910001,
          name: "Player Cast One",
          castTimeMs: 1000,
          effects: [],
        },
        {
          id: 910002,
          name: "Companion Cast",
          castTimeMs: 2000,
          independentCast: true,
          effects: [],
        },
        {
          id: 910003,
          name: "Player Cast Two",
          castTimeMs: 500,
          effects: [],
        },
      ],
    }),
  });
  const result = createScheduler({ profession }).run([
    "Player Cast One",
    "Companion Cast",
    "Player Cast Two",
  ]);
  const [first, companion, second] = result.steps;

  assert.equal(first.start, 0);
  assert.equal(first.end, 1000);
  assert.equal(companion.start, 0);
  assert.equal(companion.end, 2000);
  assert.equal(second.start, 1000);
  assert.equal(second.end, 1500);
  assert.equal(result.state.time, 2);
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
  assert.equal(
    base.events.every(
      (event) =>
        event.type &&
        Number.isFinite(event.at) &&
        event.source &&
        event.sourceId != null,
    ),
    true,
  );
});

test("declarative ammo consumes and recharges shared charges", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930001,
        name: "Fixture Ammo",
        castTimeMs: 0,
        cooldown: 0.25,
        recharge: 0.25,
        ammo: 2,
        ammoRecharge: 5,
        effects: [{ type: "strike", coefficient: 1 }],
      },
    ],
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
    result.resolvedEvents.filter((event) => event.type === "damage").length,
    2,
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === "action")
      .map((event) => event.at),
    [0, 0.25],
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
    generated: [
      {
        id: 930002,
        name: "Fixture Cooldown",
        castTimeMs: 0,
        cooldown: 0.3,
        effects: [{ type: "strike", coefficient: 1 }],
      },
    ],
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
  const actions = result.events.filter((event) => event.type === "action");

  assert.deepEqual(
    actions.map((event) => event.at),
    [0, 0.3],
  );
  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 300],
  );
  assert.equal(result.endState.time, 300);
  assert.equal(result.endState.cooldowns["Fixture Cooldown"].readyAt, 600);
  assert.deepEqual(result.warnings, []);
});

test("declarative multi-hit and delayed effects preserve individual events", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930010,
        name: "Fixture Flurry",
        type: "Weapon",
        weapon: "Greatsword",
        castTimeMs: 300,
        effects: [
          {
            type: "strike",
            coefficient: 3,
            hits: 3,
            atMs: 100,
            intervalMs: 100,
            timingAnchor: "castStart",
            timingScale: "cast",
          },
          {
            type: "strike",
            coefficient: 1,
            atMs: 1000,
            timingAnchor: "castStart",
            timingScale: "fixed",
          },
        ],
      },
    ],
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
        "damage.resolved": (context) => {
          context.profession.hits += 1;
        },
      },
    },
  });
  const result = simulateGw2({
    profession,
    rotation: ["Fixture Flurry", { type: "wait", durationMs: 1000 }],
  });
  const events = result.resolvedEvents.filter(
    (event) => event.type === "damage",
  );

  assert.deepEqual(
    events.map((event) => Number(event.at.toFixed(3))),
    [0.1, 0.2, 0.3, 1],
  );
  assert.deepEqual(
    events.map((event) => event.hitIndex),
    [1, 2, 3, 1],
  );
  assert.equal(result.endState.profession.hits, 4);
});

test("declarative repeated statuses keep fixed pulse intervals", () => {
  const timing = {
    applications: 3,
    atMs: 300,
    intervalMs: 1000,
    intervalTimingScale: "fixed",
    timingAnchor: "castStart",
    timingScale: "cast",
  };
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930037,
        name: "Fixture Pulses",
        castTimeMs: 600,
        effects: [
          {
            type: "blind",
            ...timing,
          },
          {
            type: "condition",
            condition: "Crippled",
            stacks: 1,
            duration: 2,
            ...timing,
          },
        ],
      },
    ],
  });
  const profession = defineProfession({
    id: "pulse-fixture",
    name: "Pulse Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: ["Fixture Pulses", { type: "wait", durationMs: 2500 }],
    config: { boons: { quickness: true } },
  });
  const timestamps = (type) =>
    result.events
      .filter((event) => event.type === type)
      .map((event) => Math.round(event.at * 1000));

  assert.deepEqual(timestamps("blind"), [200, 1200, 2200]);
  assert.deepEqual(timestamps("condition"), [200, 1200, 2200]);
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
    generated: [
      {
        id: 930023,
        name: "Fixture Variable Hits",
        castTimeMs: 4000,
        effects: [
          strikeTimeline(ticks, {
            timingAnchor: "castStart",
            timingScale: "cast",
          }),
        ],
      },
    ],
  });
  const profession = defineProfession({
    id: "variable-hit-fixture",
    name: "Variable Hit Fixture",
    catalog,
  });
  const simulate = (quickness) =>
    simulateGw2({
      profession,
      rotation: ["Fixture Variable Hits"],
      config: { boons: { quickness } },
    });
  const normal = simulate(false);
  const quick = simulate(true);
  const normalHits = normal.resolvedEvents.filter(
    (event) => event.type === "damage",
  );
  const quickHits = quick.resolvedEvents.filter(
    (event) => event.type === "damage",
  );
  const quickAction = quick.events.find((event) => event.type === "action");

  assert.deepEqual(
    normalHits.map((event) => Math.round(event.at * 1000)),
    ticks.map((tick) => tick.atMs),
  );
  assert.deepEqual(
    normalHits.map((event) => event.coefficient),
    ticks.map((tick) => tick.coefficient),
  );
  assert.deepEqual(
    normalHits.slice(-2).map((event) => [event.at, event.coefficient]),
    [
      [4, 0.2],
      [4, 0.5],
    ],
  );
  assert.ok(
    Math.abs(
      normalHits.reduce((sum, event) => sum + event.coefficient, 0) - 3.6,
    ) < 1e-12,
  );
  assert.equal(Math.round((quickAction.endsAt - quickAction.at) * 1000), 2680);
  assert.deepEqual(
    quickHits
      .slice(-2)
      .map((event) => [Math.round(event.at * 1000), event.coefficient]),
    [
      [2680, 0.2],
      [2680, 0.5],
    ],
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
    generated: [
      {
        id: 930025,
        name: "Fixture Variable Conditions",
        castTimeMs: 2000,
        effects: [
          conditionTimeline(ticks, {
            timingAnchor: "castStart",
            timingScale: "cast",
          }),
        ],
      },
    ],
  });
  const profession = defineProfession({
    id: "condition-timeline-fixture",
    name: "Condition Timeline Fixture",
    catalog,
  });
  const simulate = (quickness) =>
    simulateGw2({
      profession,
      rotation: ["Fixture Variable Conditions"],
      config: { boons: { quickness } },
    });
  const normal = simulate(false);
  const quick = simulate(true);
  const normalApplications = normal.resolvedEvents.filter(
    (event) => event.type === "condition",
  );
  const quickApplications = quick.resolvedEvents.filter(
    (event) => event.type === "condition",
  );
  const quickAction = quick.events.find((event) => event.type === "action");

  assert.deepEqual(
    normalApplications.map((event) => ({
      atMs: Math.round(event.at * 1000),
      condition: event.condition,
      stacks: event.stacks,
      duration: event.duration,
    })),
    ticks,
  );
  assert.deepEqual(
    normalApplications.slice(-2).map((event) => [event.at, event.condition]),
    [
      [2, "Poisoned"],
      [2, "Burning"],
    ],
  );
  assert.ok(normal.conditionDamage > 0);
  assert.equal(Math.round((quickAction.endsAt - quickAction.at) * 1000), 1360);
  assert.deepEqual(
    quickApplications
      .slice(-2)
      .map((event) => [Math.round(event.at * 1000), event.condition]),
    [
      [1360, "Poisoned"],
      [1360, "Burning"],
    ],
  );
});

test("canonical strike timelines reject invalid or ambiguous hits", () => {
  const skillWithTicks = (ticks) => ({
    id: 930024,
    name: "Invalid Tick Fixture",
    effects: [
      {
        type: "strike",
        ticks,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  });

  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          skillWithTicks([
            { atMs: 100, coefficient: 0.2 },
            { atMs: 50, coefficient: 0.5 },
          ]),
        ],
      }),
    /chronological/,
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [skillWithTicks([{ atMs: 0, coefficient: -0.2 }])],
      }),
    /non-negative coefficient/,
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            ...skillWithTicks([{ atMs: 0, coefficient: 0.2 }]),
            effects: [
              {
                type: "strike",
                coefficient: 0.2,
                ticks: [{ atMs: 0, coefficient: 0.2 }],
                timingAnchor: "castStart",
                timingScale: "fixed",
              },
            ],
          },
        ],
      }),
    /cannot use aggregate/,
  );
});

test("canonical condition timelines reject invalid or ambiguous applications", () => {
  const skillWithTicks = (ticks) => ({
    id: 930026,
    name: "Invalid Condition Timeline Fixture",
    effects: [
      {
        type: "condition",
        ticks,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  });

  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          skillWithTicks([
            {
              atMs: 0,
              condition: "Burning",
              stacks: 0,
              duration: 2,
            },
          ]),
        ],
      }),
    /positive stacks/,
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            ...skillWithTicks([
              {
                atMs: 0,
                condition: "Burning",
                stacks: 1,
                duration: 2,
              },
            ]),
            effects: [
              {
                type: "condition",
                condition: "Burning",
                ticks: [
                  {
                    atMs: 0,
                    condition: "Burning",
                    stacks: 1,
                    duration: 2,
                  },
                ],
                timingAnchor: "castStart",
                timingScale: "fixed",
              },
            ],
          },
        ],
      }),
    /cannot use aggregate/,
  );
});

test("GW2 Quickness quantizes casts and scales explicit cast timing", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930020,
        name: "Fixture Timeline",
        castTimeMs: 2200,
        effects: [
          strikePackets(4, [550, 1100, 1650, 2200], {
            timingAnchor: "castStart",
            timingScale: "cast",
          }),
        ],
      },
      {
        id: 930021,
        name: "Fixture Channel",
        castTimeMs: 600,
        effects: [
          {
            type: "strike",
            coefficient: 3,
            hits: 3,
            atMs: 200,
            intervalMs: 200,
            timingAnchor: "castStart",
            timingScale: "cast",
          },
        ],
      },
      {
        id: 930022,
        name: "Fixture Field",
        castTimeMs: 600,
        effects: [
          {
            type: "strike",
            coefficient: 3,
            hits: 3,
            atMs: 1000,
            intervalMs: 1000,
            timingAnchor: "castEnd",
            timingScale: "fixed",
          },
        ],
      },
      {
        id: 930023,
        name: "Fixture Quickness Immune",
        castTimeMs: 600,
        unaffectedByQuickness: true,
        effects: [
          {
            type: "strike",
            coefficient: 1,
            atMs: 600,
            timingAnchor: "castStart",
            timingScale: "cast",
          },
        ],
      },
    ],
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
      "Fixture Quickness Immune",
      { type: "wait", durationMs: 4000 },
    ],
    config: { boons: { quickness: true } },
  });
  const profile = (skillName) => {
    const action = result.events.find(
      (event) => event.type === "action" && event.skillName === skillName,
    );
    return {
      cast: Math.round((action.endsAt - action.at) * 1000),
      ticks: result.resolvedEvents
        .filter(
          (event) => event.type === "damage" && event.skillName === skillName,
        )
        .map((event) => Math.round((event.at - action.at) * 1000)),
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
  assert.deepEqual(profile("Fixture Quickness Immune"), {
    cast: 600,
    ticks: [600],
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
    generated: [
      {
        id: 930013,
        name: "Fixture Burn",
        castTimeMs: 0,
        effects: [
          {
            type: "condition",
            condition: "Burning",
            stacks: 1,
            duration: 1,
          },
        ],
      },
    ],
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
    rotation: ["Fixture Burn", { type: "wait", durationMs: 2000 }],
    config: { stats: { expertise: 1500 } },
  });
  const burning = result.resolvedEvents.find(
    (event) => event.type === "condition",
  );

  assert.equal(burning.effectiveDuration, 2);
});

test("resolver modifiers receive stable trait, event, and runtime context", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930002,
        name: "Context Strike",
        castTimeMs: 0,
        effects: [{ type: "strike", coefficient: 1 }],
      },
    ],
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
          hasRuntimeProfession: Boolean(context.runtime?.profession),
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
    hasRuntimeProfession: true,
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
    events: [
      {
        type: "fixture.missing",
        at: 0,
        source: "fixture",
        sourceId: 1,
      },
    ],
    rotationEndTime: 1,
  });
  assert.throws(
    () =>
      resolveScheduledStream({
        stream,
        profession: testProfession,
        handlerRegistry: new HandlerRegistry(),
      }),
    /Missing required event handler/,
  );
});

test("canonical catalog validation rejects duplicate ids and missing handlers", () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          { id: 1, name: "One", effects: [] },
          { id: 1, name: "Two", effects: [] },
        ],
      }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
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
    () =>
      createCanonicalCatalog({
        traits: [
          { id: 1, name: "One" },
          { id: 1, name: "Two" },
        ],
      }),
    /Duplicate or missing trait/,
  );
});

test("canonical catalogs validate and freeze skill-group lockouts", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930030,
        name: "Lockout Fixture",
        lockouts: [{ group: "fixture.family", durationMs: 50 }],
        effects: [],
      },
    ],
  });
  const skill = catalog.skillsById.get(930030);
  assert.deepEqual(skill.lockouts, [
    {
      group: "fixture.family",
      durationMs: 50,
    },
  ]);
  assert.equal(Object.isFrozen(skill.lockouts), true);
  assert.equal(Object.isFrozen(skill.lockouts[0]), true);

  for (const lockouts of [
    {},
    [{}],
    [{ group: "", durationMs: 50 }],
    [{ group: "fixture.family", durationMs: 0 }],
    [
      { group: "fixture.family", durationMs: 50 },
      { group: "fixture.family", durationMs: 100 },
    ],
  ]) {
    assert.throws(
      () =>
        createCanonicalCatalog({
          generated: [
            {
              id: 930031,
              name: "Invalid Lockout Fixture",
              lockouts,
              effects: [],
            },
          ],
        }),
      /lockout/i,
    );
  }
});

test("catalog skill handlers receive calculated recharge timing", () => {
  let observedReadyAt = null;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930014,
        name: "Timed Handler",
        cooldown: 20,
        castTimeMs: 1000,
        handlerId: "fixture.timed",
        effects: [],
      },
    ],
    skillHandlers: {
      "fixture.timed": replaceSkillHandler((context) => {
        observedReadyAt = context.rechargeReadyAt;
      }),
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

test("summon-owned cooldowns require Alacrity applied to summons", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930041,
        name: "Summon Skill",
        cooldown: 20,
        castTimeMs: 0,
        rechargeBuffAudience: "summon",
        effects: [],
      },
      {
        id: 930042,
        name: "Grant Summon Alacrity",
        castTimeMs: 0,
        effects: [
          {
            type: "buff",
            kind: "alacrity",
            duration: 10,
            metadata: { affectsSummons: true },
          },
        ],
      },
    ],
  });
  const profession = defineProfession({
    id: "summon-alacrity-fixture",
    name: "Summon Alacrity Fixture",
    catalog,
  });
  const playerAlacrity = simulateGw2({
    profession,
    rotation: ["Summon Skill"],
    config: { boons: { alacrity: true } },
  });
  const summonAlacrity = simulateGw2({
    profession,
    rotation: ["Grant Summon Alacrity", "Summon Skill"],
    config: { boons: { alacrity: true } },
  });

  assert.equal(
    playerAlacrity.endState.cooldowns["Summon Skill"].readyAt,
    20000,
  );
  assert.equal(
    summonAlacrity.endState.cooldowns["Summon Skill"].readyAt,
    16000,
  );
});

test("canonical augmenting skill handlers observe declarative effects", () => {
  let handled = 0;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930003,
        name: "Handled Skill",
        handlerId: "fixture.handled",
        castTimeMs: 0,
        effects: [{ type: "strike", coefficient: 10 }],
      },
    ],
    skillHandlers: {
      "fixture.handled": augmentSkillHandler(null, {
        afterEffect: (_context, _skill, event) => {
          assert.equal(event.coefficient, 10);
          handled += 1;
        },
      }),
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
  assert.ok(result.totalDamage > 0);
});

test("replacing skill handlers require empty declarative effects", () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930032,
            name: "Invalid Replacing Skill",
            handlerId: "fixture.replacing",
            castTimeMs: 0,
            effects: [{ type: "strike", coefficient: 10 }],
          },
        ],
        skillHandlers: {
          "fixture.replacing": replaceSkillHandler(() => {}),
        },
      }),
    /empty effects list/,
  );
});

test("the shared handler contract rejects undeclared strategy fields", () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930036,
            name: "Drifting Handler",
            handlerId: "fixture.drifting-handler",
            castTimeMs: 0,
            effects: [],
          },
        ],
        skillHandlers: {
          "fixture.drifting-handler": {
            mode: "replace",
            beforeEffects: () => {},
            necromancerState: true,
          },
        },
      }),
    /unsupported field.*necromancerState/,
  );
});

test("the shared effect contract rejects undeclared simulation fields", () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930033,
            name: "Drifting Effect",
            effects: [
              {
                type: "strike",
                coefficient: 1,
                necromancerOnlyCoefficient: 2,
              },
            ],
          },
        ],
      }),
    /unsupported field.*necromancerOnlyCoefficient/,
  );
});

test("target-health coefficient modifiers are shared and resolve per hit", () => {
  const thresholdModifier = Object.freeze([
    {
      kind: "target-health-below",
      threshold: 0.5,
      multiplier: 2,
    },
  ]);
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930034,
        name: "Opening Strike",
        castTimeMs: 0,
        effects: [{ type: "strike", coefficient: 1 }],
      },
      {
        id: 930035,
        name: "Threshold Strike",
        castTimeMs: 0,
        effects: [
          {
            type: "strike",
            coefficient: 1,
            coefficientModifiers: thresholdModifier,
          },
        ],
      },
    ],
  });
  const profession = defineProfession({
    id: "threshold-fixture",
    name: "Threshold Fixture",
    catalog,
  });
  const opening = simulateGw2({
    profession,
    rotation: ["Opening Strike"],
  });
  const openingDamage = opening.resolvedEvents.find(
    (event) => event.type === "damage",
  )?.damage;
  const result = simulateGw2({
    profession,
    rotation: ["Opening Strike", "Threshold Strike"],
    config: {
      target: {
        health: openingDamage * 1.5,
        armor: 2597,
      },
    },
  });
  const thresholdDamage = result.resolvedEvents.find(
    (event) => event.skillId === 930035,
  )?.damage;

  assert.ok(Math.abs(thresholdDamage / openingDamage - 2) < 1e-12);
});

test("the handler strategy contract accepts canonical Mesmer skill data", () => {
  const source = mesmerCatalog.skillsByName.get("Mind Stab");
  let observed = 0;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        ...source,
        handlerId: "mesmer.fixture-augment",
      },
    ],
    skillHandlers: {
      "mesmer.fixture-augment": augmentSkillHandler(null, {
        afterEffect: () => {
          observed += 1;
        },
      }),
    },
  });
  const profession = defineProfession({
    id: "mesmer-handler-fixture",
    name: "Mesmer Handler Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: ["Mind Stab"],
  });

  assert.equal(observed, source.effects.length);
  assert.ok(result.totalDamage > 0);
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
    result.procSteps.some((step) => step.skill === "Relic of Fireworks"),
    true,
  );
});

test("resolver extensions create isolated state only for the selected relic", () => {
  const createRuntime = (relic) =>
    createGw2ResolverExtensions({ config: { relic } }).createEquipmentState({
      relic,
    });
  const thief = createRuntime("Thief");
  const anotherThief = createRuntime("Thief");
  const brawler = createRuntime("Brawler");
  const aristocracy = createRuntime("Aristocracy");

  assert.equal(thief.relic.name, "Thief");
  assert.deepEqual(thief.relic.state, { stacks: 0, expiresAt: 0 });
  assert.deepEqual(brawler.relic.state, { readyAt: 0, buffUntil: 0 });
  assert.deepEqual(aristocracy.relic.state, {
    readyAt: 0,
    stacks: 0,
    expiresAt: 0,
    activations: [],
  });
  assert.notEqual(thief.relic.state, anotherThief.relic.state);

  thief.relic.state.stacks = 3;
  assert.equal(anotherThief.relic.state.stacks, 0);
});

test("Severance critical contributions are data-driven and expire exactly", () => {
  assert.deepEqual(sigilCriticalContribution(null, 0), {
    chance: 0,
    damage: 0,
  });
  const runtime = { sigil: { severanceUntil: 4 } };
  assert.deepEqual(sigilCriticalContribution(runtime, 3.999), {
    chance: 250 / PRECISION_PER_CRITICAL_CHANCE_FRACTION,
    damage: 250 / FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
  });
  assert.deepEqual(sigilCriticalContribution(runtime, 4), {
    chance: 0,
    damage: 0,
  });
});

test("Aristocracy rule state owns strict ICD, stack cap, and expiry", () => {
  const relic = createRelicRuntime("Aristocracy");
  const context = { relic };
  const trigger = (at) =>
    handleWeaknessVulnerabilityRelic(context, {
      type: "weakness_vulnerability",
      at,
      skillName: `Trigger ${at}`,
    });

  trigger(0);
  assert.equal(relicConditionDurationBonus(context, 0), 0);
  assert.equal(relicConditionDurationBonus(context, 0.001), 0.03);
  trigger(1);
  assert.equal(relic.state.stacks, 1);
  for (const at of [1.001, 2.002, 3.003, 4.004, 5.005]) trigger(at);
  assert.equal(relic.state.stacks, 5);
  assert.equal(relicConditionDurationBonus(context, 5.006), 0.15);
  assert.equal(relicConditionDurationBonus(context, 13.005), 0);
});

test("Aristocracy historical queries preserve combat and timestamp boundaries", () => {
  const events = [
    { type: "weakness_vulnerability", at: 1.001, skillName: "Second" },
    { type: "weakness_vulnerability", at: -1, skillName: "Precombat" },
    { type: "combat_start", at: 0 },
    { type: "weakness_vulnerability", at: 0, skillName: "First" },
    { type: "weakness_vulnerability", at: 1, skillName: "Blocked" },
  ];
  const context = {
    relic: createRelicTimelineRuntime("Aristocracy", events),
  };

  assert.equal(relicConditionDurationBonus(context, 0), 0);
  assert.equal(relicConditionDurationBonus(context, 0.001), 0.03);
  assert.equal(relicConditionDurationBonus(context, 1.002), 0.06);
});

test("generic combat query modules contain no equipment-specific policy", async () => {
  const root = new URL("../../js/platform/gw2/", import.meta.url);
  for (const filename of ["query.ts", "timeline-index.ts"]) {
    const source = await readFile(new URL(filename, root), "utf8");
    assert.doesNotMatch(source, /Aristocracy|Severance/, filename);
  }
});

test("Relic of the Brawler grants four seconds of strike damage with a strict eight-second ICD", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930006,
        name: "Grant Protection",
        type: "Utility",
        castTimeMs: 0,
        effects: [boon("Protection", 2)],
      },
      {
        id: 930007,
        name: "Grant Resolution",
        type: "Utility",
        castTimeMs: 0,
        effects: [boon("Resolution", 2)],
      },
      {
        id: 930008,
        name: "Brawler Fixture Strike",
        type: "Weapon",
        castTimeMs: 0,
        effects: [strike(1)],
      },
    ],
  });
  const profession = defineProfession({
    id: "brawler-fixture",
    name: "Brawler Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Grant Protection",
      { type: "wait", durationMs: 1000 },
      "Brawler Fixture Strike",
      { type: "wait", durationMs: 3001 },
      "Brawler Fixture Strike",
      { type: "wait", durationMs: 3999 },
      "Grant Resolution",
      { type: "wait", durationMs: 1 },
      "Brawler Fixture Strike",
      { type: "wait", durationMs: 1 },
      "Grant Protection",
      { type: "wait", durationMs: 1 },
      "Brawler Fixture Strike",
    ],
    config: { relic: "Brawler" },
  });
  const procs = result.procSteps.filter(
    (step) => step.skill === "Relic of the Brawler",
  );
  const strikes = result.resolvedEvents.filter(
    (event) => event.skillName === "Brawler Fixture Strike",
  );

  assert.deepEqual(
    procs.map((step) => step.start),
    [0, 8002],
  );
  assert.deepEqual(
    procs.map((step) => step.sourceSkill),
    ["Grant Protection", "Grant Protection"],
  );
  assert.deepEqual(
    strikes.map((event) => Math.round(event.at * 1000)),
    [1000, 4001, 8001, 8003],
  );
  assert.ok(Math.abs(strikes[0].damage / strikes[1].damage - 1.1) < 1e-12);
  assert.equal(strikes[2].damage, strikes[1].damage);
  assert.ok(Math.abs(strikes[3].damage / strikes[1].damage - 1.1) < 1e-12);
});

test("Relic of Mistburn grants one Might for eight seconds and applies its critical chance at ten stacks", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930009,
        name: "Grant Might",
        type: "Utility",
        castTimeMs: 0,
        effects: [boon("Might", 20)],
      },
      {
        id: 930010,
        name: "Mistburn Fixture Strike",
        type: "Weapon",
        castTimeMs: 0,
        effects: [strike(1)],
      },
    ],
  });
  const profession = defineProfession({
    id: "mistburn-fixture",
    name: "Mistburn Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Grant Might",
      { type: "wait", durationMs: 7999 },
      "Mistburn Fixture Strike",
      { type: "wait", durationMs: 1 },
      "Mistburn Fixture Strike",
    ],
    config: {
      relic: "Mistburn",
      stats: { power: 1000, precision: 1000, ferocity: 0 },
      boons: { might: 8, fury: false },
    },
  });
  const bonusMight = result.events.filter(
    (event) => event.sourceId === "relic.mistburn",
  );
  const strikes = result.resolvedEvents.filter(
    (event) => event.skillName === "Mistburn Fixture Strike",
  );

  assert.deepEqual(
    bonusMight.map(({ at, duration, stacks }) => ({ at, duration, stacks })),
    [{ at: 0, duration: 8, stacks: 1 }],
  );
  assert.ok(Math.abs(strikes[0].criticalChance - 0.15) < 1e-12);
  assert.ok(Math.abs(strikes[1].criticalChance - 0.05) < 1e-12);
  assert.deepEqual(
    result.procSteps
      .filter((step) => step.skill === "Relic of Mistburn")
      .map((step) => ({ start: step.start, sourceSkill: step.sourceSkill })),
    [{ start: 0, sourceSkill: "Grant Might" }],
  );
});

test("Relic of Mistburn uses a strict one-second internal cooldown", () => {
  const relic = createRelicRuntime("Mistburn");
  const emitted = [];
  const context = {
    emitDerived(cause, event) {
      emitted.push({ ...event, triggeredBy: cause.skillName });
    },
  };
  const grantMight = (at, extra = {}) =>
    materializeBoonRelics(context, relic, {
      type: "buff",
      at,
      skillName: `Grant Might ${at}`,
      kind: "might",
      duration: 5,
      stacks: 1,
      source: "fixture",
      actorType: "player",
      ...extra,
    });

  grantMight(0, { recipients: "allies" });
  grantMight(0);
  grantMight(1);
  grantMight(1.001);
  grantMight(2.002, { source: "Relic", actorType: "effect" });

  assert.deepEqual(
    emitted.map((event) => ({ at: event.at, duration: event.duration })),
    [
      { at: 0, duration: 8 },
      { at: 1.001, duration: 8 },
    ],
  );
});

test("Relic of Bloodstone explodes on the fourth blast and grants Fervor", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930100,
        name: "Bloodstone Fixture Strike",
        type: "Weapon",
        castTimeMs: 0,
        effects: [strike(1)],
      },
      {
        id: 930101,
        name: "Bloodstone Fixture Blast",
        type: "Utility",
        castTimeMs: 0,
        effects: [custom("blast_combo")],
      },
    ],
  });
  const profession = defineProfession({
    id: "bloodstone-fixture",
    name: "Bloodstone Fixture",
    catalog,
  });
  const config = {
    relic: "Bloodstone",
    stats: { power: 2000, precision: 1000, ferocity: 0 },
    target: { armor: 2597, conditions: {} },
  };
  const threeBlasts = simulateGw2({
    profession,
    rotation: [
      "Bloodstone Fixture Blast",
      "Bloodstone Fixture Blast",
      "Bloodstone Fixture Blast",
      { type: "wait", durationMs: 1000 },
    ],
    config,
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Bloodstone Fixture Strike",
      "Bloodstone Fixture Blast",
      "Bloodstone Fixture Blast",
      "Bloodstone Fixture Blast",
      "Bloodstone Fixture Blast",
      "Bloodstone Fixture Blast",
      "Bloodstone Fixture Strike",
      { type: "wait", durationMs: 1000 },
    ],
    config,
  });
  const volatility = result.procSteps.filter(
    (step) => step.skill === "Bloodstone Volatility",
  );
  const fervor = result.procSteps.filter(
    (step) => step.skill === "Relic of Bloodstone",
  );
  const strikes = result.resolvedEvents.filter(
    (event) => event.skillName === "Bloodstone Fixture Strike",
  );
  const explosion = result.resolvedEvents.find(
    (event) =>
      event.type === "damage" && event.skillName === "Bloodstone Explosion",
  );
  const bleeding = result.resolvedEvents.find(
    (event) =>
      event.type === "condition" && event.skillName === "Bloodstone Explosion",
  );

  // Consecutive identical proc rows are intentionally grouped for display.
  assert.deepEqual(
    volatility.map((step) => step.detail),
    ["1/3 stacks"],
  );
  assert.equal(
    threeBlasts.procSteps.some((step) => step.skill === "Relic of Bloodstone"),
    false,
  );
  assert.equal(fervor.length, 1);
  assert.ok(Math.abs(strikes[1].damage / strikes[0].damage - 1.07) < 1e-12);
  assert.equal(explosion.coefficient, 3);
  assert.equal(explosion.at, 0.68);
  assert.equal(bleeding.stacks, 6);
  assert.equal(bleeding.duration, 6);
});

test("Relic of the Shackles strikes five seconds after immobilize with a strict ten-second ICD", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930009,
        name: "Fixture Immobilize",
        type: "Utility",
        castTimeMs: 0,
        effects: [condition("Immobilized", 1, 1)],
      },
    ],
  });
  const profession = defineProfession({
    id: "shackles-fixture",
    name: "Shackles Fixture",
    catalog,
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Fixture Immobilize",
      { type: "wait", durationMs: 10000 },
      "Fixture Immobilize",
      { type: "wait", durationMs: 1 },
      "Fixture Immobilize",
      { type: "wait", durationMs: 5000 },
    ],
    config: { relic: "Shackles" },
  });
  const procs = result.procSteps.filter(
    (step) => step.skill === "Relic of the Shackles",
  );
  const strikes = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" && event.skillName === "Relic of the Shackles",
  );
  const stuns = result.events.filter(
    (event) =>
      event.type === "control" && event.skillName === "Relic of the Shackles",
  );

  assert.deepEqual(
    procs.map((step) => ({
      start: step.start,
      detail: step.detail,
      sourceSkill: step.sourceSkill,
    })),
    [
      {
        start: 0,
        detail: "tethered",
        sourceSkill: "Fixture Immobilize",
      },
      {
        start: 5000,
        detail: "damage",
        sourceSkill: "Fixture Immobilize",
      },
      {
        start: 10001,
        detail: "tethered",
        sourceSkill: "Fixture Immobilize",
      },
      {
        start: 15001,
        detail: "damage",
        sourceSkill: "Fixture Immobilize",
      },
    ],
  );
  assert.deepEqual(
    strikes.map((event) => ({
      at: event.at,
      coefficient: event.coefficient,
      source: event.source,
      triggeredBy: event.triggeredBy,
    })),
    [
      {
        at: 5,
        coefficient: 3,
        source: "Relic",
        triggeredBy: "Fixture Immobilize",
      },
      {
        at: 15.001,
        coefficient: 3,
        source: "Relic",
        triggeredBy: "Fixture Immobilize",
      },
    ],
  );
  assert.deepEqual(
    stuns.map((event) => ({
      at: event.at,
      controlKind: event.controlKind,
      duration: event.duration,
      source: event.source,
      triggeredBy: event.triggeredBy,
    })),
    [
      {
        at: 5,
        controlKind: "stun",
        duration: 1,
        source: "Relic",
        triggeredBy: "Fixture Immobilize",
      },
      {
        at: 15.001,
        controlKind: "stun",
        duration: 1,
        source: "Relic",
        triggeredBy: "Fixture Immobilize",
      },
    ],
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
  const guardianWeapons = createProfessionWeaponData(guardianCatalog);
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
  const virtuosoRuntime = mesmerProfession.resolveRuntime({
    specialization: "Virtuoso",
  });
  const state = virtuosoRuntime.createProfessionState({
    specialization: "Virtuoso",
    infiniteForge: true,
  });
  state.specialization.state.numericResource = 3;
  state.core.clones.push({ id: 1 });
  const snapshot = snapshotMesmerState(state);
  assert.equal(state.specialization.state.nextForgeAt, 3);
  assert.equal(snapshot.numericResource, 3);
  assert.equal(snapshot.cloneCount, 1);
  assert.equal(mesmerProfession.id, "mesmer");
  assert.equal(
    Object.hasOwn(virtuosoRuntime.eventReactions, "damage.resolved"),
    false,
  );
  assert.equal(
    typeof virtuosoRuntime.eventReactions["control.resolved"],
    "function",
  );
  assert.equal(Object.hasOwn(virtuosoRuntime.eventHandlers, "damage"), false);
  assert.equal(Object.hasOwn(virtuosoRuntime.eventHandlers, "control"), false);
  assert.equal(
    Object.keys(virtuosoRuntime.eventHandlers).every((type) =>
      type.startsWith("mesmer."),
    ),
    true,
  );
  assert.equal(
    COMMON_EVENT_TYPES.some((type) =>
      Object.hasOwn(virtuosoRuntime.eventHandlers, type),
    ),
    false,
  );
});

async function javascriptFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(root, entry.name);
      return entry.isDirectory()
        ? javascriptFiles(target)
        : entry.name.endsWith(".js") ||
            (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
          ? [target]
          : [];
    }),
  );
  return nested.flat();
}

test("Mesmer conforms to native handler, identity, and state boundaries", async () => {
  for (const [handlerId, strategy] of mesmerCatalog.skillHandlers) {
    assert.ok(handlerId.startsWith("mesmer."));
    assert.ok(
      strategy.mode === SKILL_HANDLER_MODES.AUGMENT ||
        strategy.mode === SKILL_HANDLER_MODES.REPLACE,
    );
  }
  for (const skill of mesmerCatalog.skills) {
    if (!skill.handlerId) continue;
    const strategy = mesmerCatalog.skillHandlers.get(skill.handlerId);
    assert.ok(strategy, `${skill.name} has an unresolved handler`);
    if (strategy.mode === SKILL_HANDLER_MODES.REPLACE) {
      assert.deepEqual(skill.effects, [], skill.name);
    }
  }
  assert.ok(
    Object.values(MECHANIC_SKILLS)
      .flat()
      .every((skillId) => mesmerCatalog.skillsById.has(skillId)),
  );
  assert.equal(MESMER_TRAIT_COVERAGE.length, mesmerCatalog.traits.length);
  assert.ok(
    Object.keys(
      mesmerProfession.resolveRuntime({ specialization: "Chronomancer" })
        .taskHandlers,
    ).every((type) => type.startsWith("mesmer.")),
  );

  const projected = simulateMesmer(
    ["Mind Stab"],
    createDefaultConfig({ specialization: "Core" }),
  ).endState.profession;
  assert.deepEqual(JSON.parse(JSON.stringify(projected)), projected);

  const mesmerRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js/professions/mesmer",
  );
  await assert.rejects(
    readFile(path.join(mesmerRoot, "mechanics", "contract.ts"), "utf8"),
    (error) => error?.code === "ENOENT",
  );
  await assert.rejects(
    readFile(path.join(mesmerRoot, "mechanics", "runtime.js"), "utf8"),
    (error) => error?.code === "ENOENT",
  );

  const behavioralRoots = [
    path.join(mesmerRoot, "mechanics"),
    path.join(mesmerRoot, "core"),
    path.join(mesmerRoot, "specializations"),
  ];
  for (const root of behavioralRoots) {
    for (const file of await javascriptFiles(root)) {
      const source = await readFile(file, "utf8");
      assert.doesNotMatch(
        source,
        /skill\.name\s*(?:===|!==)|\.has\(skill\.name\)|\[skill\.name\]|skill\.description/,
        path.relative(mesmerRoot, file),
      );
    }
  }
});

test("platform import boundaries are profession neutral", async () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js/platform",
  );
  for (const file of await javascriptFiles(root)) {
    const source = await readFile(file, "utf8");
    const relative = path.relative(root, file).replaceAll("\\", "/");
    const modulePath = relative.replace(/\.(?:js|ts)$/, "");
    for (const entry of nativeProfessionRegistry) {
      for (const term of [entry.id, entry.name]) {
        if (
          entry.id === "thief" &&
          [
            "gw2/gear-data",
            "gw2/relic-rules",
            "gw2/resolver/runtime-state",
          ].includes(modulePath)
        )
          continue;
        if (
          entry.id === "ranger" &&
          ["gw2/gear-data", "gw2/relic-rules"].includes(modulePath)
        ) {
          continue;
        }
        if (entry.id === "elementalist" && modulePath === "gw2/gear-data") {
          continue;
        }
        assert.equal(
          source.toLowerCase().includes(term.toLowerCase()),
          false,
          `${relative} mentions ${term}`,
        );
      }
    }
    if (relative.startsWith("engine/")) {
      assert.doesNotMatch(
        source,
        /(?:\.\.\/)+gw2\//,
        `${relative} imports GW2`,
      );
      assert.doesNotMatch(source, /(?:\.\.\/)+ui\//, `${relative} imports UI`);
      assert.doesNotMatch(
        source,
        /professions\//,
        `${relative} imports a profession`,
      );
    }
    if (relative.startsWith("gw2/") || relative.startsWith("ui/")) {
      assert.doesNotMatch(
        source,
        /professions\//,
        `${relative} imports a profession`,
      );
    }
  }
});

test("test profession fixture has no native profession dependency", async () => {
  const source = await readFile(
    fileURLToPath(new URL("../fixtures/test-profession.js", import.meta.url)),
    "utf8",
  );
  for (const entry of nativeProfessionRegistry) {
    assert.equal(source.toLowerCase().includes(entry.id), false, entry.id);
  }
});

async function relativeModuleGraph(entryFiles) {
  const visited = new Set();
  const pending = [...entryFiles];
  while (pending.length) {
    const file = await sourceModulePath(path.resolve(pending.pop()));
    if (visited.has(file)) continue;
    visited.add(file);
    const source = await readFile(file, "utf8");
    const syntax = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const specifiers = [];
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        !(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) &&
        !(ts.isExportDeclaration(node) && node.isTypeOnly) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        specifiers.push(node.moduleSpecifier.text);
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        specifiers.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(syntax);
    for (const specifier of specifiers) {
      const dependency = path.resolve(path.dirname(file), specifier);
      if (dependency.endsWith(".js") || dependency.endsWith(".mjs")) {
        pending.push(dependency);
      }
    }
  }
  return visited;
}

async function sourceModulePath(file) {
  if (!file.endsWith(".js")) return file;
  const typeScript = file.replace(/\.js$/, ".ts");
  try {
    await access(typeScript);
    return typeScript;
  } catch {
    return file;
  }
}

async function readSourceModule(file) {
  return readFile(await sourceModulePath(file), "utf8");
}

test("native registry loaders do not pull another profession module graph", async () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js",
  );
  for (const entry of nativeProfessionRegistry) {
    const graph = await relativeModuleGraph([
      path.join(root, "professions", entry.id, "definition.js"),
      path.join(root, "professions", entry.id, "app", "app-definition.js"),
    ]);
    for (const file of graph) {
      const relative = path.relative(root, file).replaceAll("\\", "/");
      for (const other of professionRegistry) {
        if (other.id === entry.id) continue;
        assert.equal(
          relative.startsWith(`professions/${other.id}/`),
          false,
          `${entry.id} imports ${relative}`,
        );
      }
    }
  }
});

test("declarative professions use the standard mechanics module roles", async () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js/professions",
  );
  for (const profession of nativeProfessionRegistry.map((entry) => entry.id)) {
    const mechanicsRoot = path.join(root, profession, "mechanics");
    const prefix = profession.toUpperCase();
    const mechanics = await readSourceModule(
      path.join(mechanicsRoot, "skill-mechanics.js"),
    );
    assert.match(
      mechanics,
      new RegExp(`export const ${prefix}_SKILL_MECHANICS\\b`),
    );
    assert.doesNotMatch(mechanics, /apiDamage|apiConditions/);
    if (profession === "necromancer") {
      const localMechanics = await Promise.all(
        [
          path.join(root, profession, "core", "mechanics.js"),
          path.join(
            root,
            profession,
            "specializations",
            "reaper",
            "mechanics.js",
          ),
          path.join(
            root,
            profession,
            "specializations",
            "scourge",
            "mechanics.js",
          ),
          path.join(
            root,
            profession,
            "specializations",
            "harbinger",
            "mechanics.js",
          ),
          path.join(
            root,
            profession,
            "specializations",
            "ritualist",
            "mechanics.js",
          ),
        ].map(readSourceModule),
      );
      const handlers = (
        await Promise.all(
          [
            path.join(root, profession, "core", "handlers.js"),
            path.join(
              root,
              profession,
              "specializations",
              "reaper",
              "handlers.js",
            ),
            path.join(
              root,
              profession,
              "specializations",
              "scourge",
              "handlers.js",
            ),
            path.join(
              root,
              profession,
              "specializations",
              "harbinger",
              "handlers.js",
            ),
            path.join(
              root,
              profession,
              "specializations",
              "ritualist",
              "handlers.js",
            ),
          ].map(readSourceModule),
        )
      ).join("\n");
      for (const source of localMechanics) {
        assert.match(source, /export const \w+_MECHANICS\b/);
        assert.doesNotMatch(source, /HANDLER_MECHANICS/);
      }
      assert.doesNotMatch(mechanics, /HANDLER_MECHANICS/);
      assert.match(handlers, /\baugmentSkill(?:Handler)?\b/);
      assert.match(handlers, /\breplaceSkill(?:Handler)?\b/);
    } else if (profession === "guardian") {
      const localMechanics = await Promise.all(
        [
          path.join(root, profession, "core", "mechanics.js"),
          path.join(
            root,
            profession,
            "specializations",
            "firebrand",
            "mechanics.js",
          ),
          path.join(
            root,
            profession,
            "specializations",
            "luminary",
            "mechanics.js",
          ),
        ].map(readSourceModule),
      );
      const handlers = (
        await Promise.all(
          [
            path.join(root, profession, "core", "handlers.js"),
            path.join(
              root,
              profession,
              "specializations",
              "firebrand",
              "handlers.js",
            ),
            path.join(
              root,
              profession,
              "specializations",
              "luminary",
              "handlers.js",
            ),
          ].map(readSourceModule),
        )
      ).join("\n");
      for (const source of localMechanics) {
        assert.match(source, /export const \w+_MECHANICS\b/);
        assert.doesNotMatch(source, /HANDLER_MECHANICS/);
      }
      assert.doesNotMatch(mechanics, /HANDLER_MECHANICS/);
      assert.match(handlers, /\baugmentSkill(?:Handler)?\b/);
      assert.match(handlers, /\breplaceSkill(?:Handler)?\b/);
    } else if (profession === "mesmer") {
      const sliceDirectories = [
        "core",
        "specializations/chronomancer",
        "specializations/mirage",
        "specializations/virtuoso",
        "specializations/troubadour",
      ];
      const localMechanics = await Promise.all(
        sliceDirectories.map((directory) =>
          readSourceModule(
            path.join(root, profession, directory, "mechanics.js"),
          ),
        ),
      );
      const handlers = (
        await Promise.all(
          sliceDirectories.map((directory) =>
            readSourceModule(
              path.join(root, profession, directory, "handlers.js"),
            ),
          ),
        )
      ).join("\n");
      for (const source of localMechanics) {
        assert.match(source, /export const MESMER_\w+\b/);
        assert.doesNotMatch(source, /HANDLER_MECHANICS/);
      }
      assert.doesNotMatch(mechanics, /HANDLER_MECHANICS/);
      assert.match(handlers, /\baugmentSkill(?:Handler)?\b/);
      assert.match(handlers, /\breplaceSkill(?:Handler)?\b/);
    } else if (profession === "revenant") {
      const sliceDirectories = [
        "core",
        "specializations/herald",
        "specializations/renegade",
        "specializations/vindicator",
        "specializations/conduit",
      ];
      const localMechanics = await Promise.all(
        sliceDirectories.map((directory) =>
          readSourceModule(
            path.join(root, profession, directory, "mechanics.js"),
          ),
        ),
      );
      const handlers = (
        await Promise.all(
          sliceDirectories.map((directory) =>
            readSourceModule(
              path.join(root, profession, directory, "handlers.js"),
            ),
          ),
        )
      ).join("\n");
      for (const source of localMechanics) {
        assert.match(source, /export const \w+_MECHANICS\b/);
        assert.doesNotMatch(source, /HANDLER_MECHANICS/);
      }
      assert.doesNotMatch(mechanics, /HANDLER_MECHANICS/);
      assert.match(handlers, /\baugmentSkill(?:Handler)?\b/);
      assert.match(handlers, /\breplaceSkill(?:Handler)?\b/);
    }

    const catalog = await readSourceModule(
      path.join(root, profession, "catalog.js"),
    );
    const catalogData = await readSourceModule(
      path.join(root, profession, "catalog-data.js"),
    );
    const family = await readSourceModule(
      path.join(root, profession, "family.js"),
    );
    assert.match(catalog, /assembleNativeApplicationCatalog/);
    assert.doesNotMatch(catalog, /mechanics\/skill-mechanics\.js/);
    assert.match(catalogData, /createNativeModuleData/);
    assert.match(family, /defineNativeProfession/);
    assert.doesNotMatch(family, /from\s+["'][^"']*catalog\.js["']/);
    assert.doesNotMatch(catalog, /mechanics\/skill-(?:defaults|overrides)\.js/);

    const metadata = await readFile(
      path.join(root, profession, "data", `${profession}-api-metadata.js`),
      "utf8",
    );
    assert.doesNotMatch(
      metadata,
      /apiDamage|apiConditions|"facts"|"coefficient"|dmg_multiplier/,
    );
    if (profession !== "mesmer") {
      assert.doesNotMatch(metadata, /export const TRAITS\b/);
      assert.match(catalogData, /data\/traits-data\.js/);
    }
  }
});

test("obsolete compatibility trees are removed", async () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js",
  );
  for (const directory of ["core", "data", "sim"]) {
    await assert.rejects(
      readdir(path.join(root, directory)),
      (error) => error?.code === "ENOENT",
    );
  }
  await assert.rejects(
    readFile(
      path.join(root, "professions", "mesmer", "app", "app-rotation-ui.js"),
      "utf8",
    ),
    (error) => error?.code === "ENOENT",
  );
  for (const profession of [
    "engineer",
    "guardian",
    "mesmer",
    "necromancer",
    "revenant",
    "thief",
  ]) {
    const extension = "ts";
    for (const facade of ["attribute-rules", "resolver", "state", "ui"]) {
      await assert.rejects(
        readFile(
          path.join(root, "professions", profession, `${facade}.${extension}`),
          "utf8",
        ),
        (error) => error?.code === "ENOENT",
      );
    }
    const family = await readFile(
      path.join(root, "professions", profession, `family.${extension}`),
      "utf8",
    );
    assert.doesNotMatch(
      family,
      /(?:attribute-rules|handlers|mechanics\/contract|resolver|state|ui)\.js/,
    );
  }
});

test("profession family state composition has no flat runtime adapters", async () => {
  const jsRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js",
  );
  const engineSource = await readFile(
    path.join(jsRoot, "platform", "engine", "profession.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    engineSource,
    /\bnew Proxy\b|Object\.defineProperty|createComposedStateAdapter/,
  );

  for (const profession of [
    "engineer",
    "guardian",
    "mesmer",
    "necromancer",
    "revenant",
  ]) {
    const root = path.join(jsRoot, "professions", profession);
    for (const file of await javascriptFiles(root)) {
      if (path.basename(file) !== "module.ts") continue;
      const source = await readFile(file, "utf8");
      assert.doesNotMatch(
        source,
        /defineProfessionModule<SchedulerRecord>/,
        path.relative(jsRoot, file),
      );
    }
  }
});

test("specialization state factories and accessors stay owner-local", async () => {
  const professionRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js/professions",
  );
  for (const profession of [
    "engineer",
    "guardian",
    "mesmer",
    "necromancer",
    "revenant",
    "thief",
  ]) {
    const specializationsRoot = path.join(
      professionRoot,
      profession,
      "specializations",
    );
    const directories = await readdir(specializationsRoot, {
      withFileTypes: true,
    });
    for (const directory of directories.filter((entry) =>
      entry.isDirectory(),
    )) {
      const root = path.join(specializationsRoot, directory.name);
      const extension = "ts";
      const stateSource = await readFile(
        path.join(root, `state.${extension}`),
        "utf8",
      );
      const moduleSource = await readFile(
        path.join(root, `module.${extension}`),
        "utf8",
      );
      assert.match(
        stateSource,
        /defineProfessionSpecializationState\(/,
        `${profession}/${directory.name}/state`,
      );
      assert.match(
        moduleSource,
        /scheduler:\s*\w+State\.create/,
        `${profession}/${directory.name}/module`,
      );
      for (const file of await javascriptFiles(root)) {
        const source = await readFile(file, "utf8");
        assert.doesNotMatch(
          source,
          /\bprofessionSpecializationState\b/,
          path.relative(professionRoot, file),
        );
      }
    }
  }
});

test("application shell uses feature-owned modules without legacy facades", async () => {
  const appRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js/app",
  );
  const entries = await readdir(appRoot, { withFileTypes: true });
  const topLevelFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(topLevelFiles, [
    "app.ts",
    "bootstrap.ts",
    "profession-app.ts",
  ]);

  const directories = new Set(
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  );
  assert.deepEqual([...directories].sort(), [
    "build",
    "profession",
    "rotation",
    "simulation",
  ]);

  const appEntry = await readFile(path.join(appRoot, "app.ts"), "utf8");
  assert.match(appEntry, /bootstrapProfessionApp/);
  assert.doesNotMatch(appEntry, /class ProfessionApp|renderPalette|renderGear/);
});

test("profession sources persist terrestrial skill data only", async () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../js/professions",
  );
  const forbiddenPersistedMetadata = new RegExp(
    [
      JSON.stringify(GW2_SKILL_FLAGS.TERRESTRIAL_ONLY),
      '"weapon": "(?:Trident|Speargun)"',
      'weapon:\\s*"(?:Trident|Speargun)"',
      'environment:\\s*"Aquatic"',
      '"name": "Use Trident"',
    ].join("|"),
  );
  for (const file of await javascriptFiles(root)) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      forbiddenPersistedMetadata,
      path.relative(root, file),
    );
  }
});
