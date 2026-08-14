import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { timelineWeaponRows } from "../../../js/app/rotation/timeline-model.js";
import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import { migrateRangerBuild } from "../../../js/professions/ranger/build.js";
import { rangerCatalog } from "../../../js/professions/ranger/catalog.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../../js/professions/ranger/data/ids.js";
import { RANGER_PETS } from "../../../js/professions/ranger/data/ranger-pet-data.js";
import { rangerProfession } from "../../../js/professions/ranger/definition.js";
import {
  rangerAppAdapter,
  recalculate,
  runSimulation,
} from "../../../js/professions/ranger/app/app-definition.js";

const baseConfig = Object.freeze({
  initialAstralForce: 100,
  selectedPet: "Jacaranda",
  selectedPet2: "Carrion Devourer",
  primaryWeapon: "Dagger",
  offHandWeapon: "Torch",
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1800,
    expertise: 1200,
    concentration: 750,
  },
  target: {
    armor: 2597,
    defiant: true,
    conditions: { Vulnerability: 25 },
  },
});

function simulate(rotation, config = {}) {
  return simulateGw2({
    profession: rangerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization: "Druid",
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
    },
    mode: "sequence",
  });
}

test("condition Druid weapon timings and packets match the supplied EVTC", () => {
  for (const [id, castTime] of [
    [ID.GROUNDWORK_GOUGE, 280],
    [ID.LEADING_SWIPE, 320],
    [ID.SERPENT_STAB, 280],
    [ID.DEADLY_DELIVERY, 440],
    [ID.DOUBLE_ARC, 600],
    [ID.INSTINCTIVE_ENGAGE, 840],
    [ID.CRIPPLING_TALON, 360],
    [ID.STALKERS_STRIKE, 760],
  ]) {
    assert.equal(
      rangerCatalog.skillsById.get(id).quicknessCastTimeMs,
      castTime,
    );
  }

  const doubleArc = rangerCatalog.skillsById.get(ID.DOUBLE_ARC);
  assert.equal(doubleArc.recharge, 6);
  assert.equal(
    doubleArc.effects.find(({ type }) => type === "strike").coefficient,
    1.6,
  );
  assert.equal(
    doubleArc.effects
      .filter(({ type }) => type === "condition")
      .find(({ condition }) => condition === "Bleeding").stacks,
    6,
  );

  const throwTorch = rangerCatalog.skillsById.get(ID.THROW_TORCH);
  assert.equal(throwTorch.ammo, 2);
  assert.equal(throwTorch.ammoRecharge, 15);
  assert.equal(throwTorch.ammoCastLockout, 1);

  const bonfire = rangerCatalog.skillsById.get(ID.BONFIRE);
  assert.equal(bonfire.recharge, 25);
  assert.equal(bonfire.comboFields[0].fieldType, "Fire");
  assert.equal(
    bonfire.effects.find(({ type }) => type === "strike").ticks.length,
    9,
  );
});

test("Jacaranda AI and Beast command expose the requested pulses", () => {
  const jacaranda = RANGER_PETS.find(({ name }) => name === "Jacaranda");
  assert.deepEqual(jacaranda.skillIds, [
    ID.JACARANDA_ROOT_SLAP,
    ID.JACARANDA_CALL_LIGHTNING,
    ID.PHOTOSYNTHESIZE,
    ID.JACARANDAS_EMBRACE,
  ]);

  const callLightning = rangerCatalog.skillsById.get(
    ID.JACARANDA_CALL_LIGHTNING,
  );
  assert.equal(callLightning.recharge, 10);
  assert.equal(callLightning.effects[0].ticks.length, 5);
  assert.equal(
    callLightning.effects[0].ticks.reduce(
      (total, tick) => total + tick.coefficient,
      0,
    ),
    2.5,
  );

  const embrace = rangerCatalog.skillsById.get(ID.JACARANDAS_EMBRACE);
  assert.equal(embrace.effects[0].ticks.length, 5);
  assert.deepEqual(
    embrace.effects
      .find(
        ({ type, ticks }) =>
          type === "condition" &&
          ticks?.some(({ condition }) => condition === "Immobilized"),
      )
      .ticks.filter(({ condition }) => condition === "Immobilized")
      .map(({ duration }) => duration),
    [1, 2, 2, 2, 2],
  );
});

test("Poison Master and Double Arc use player-scaled poison procs", () => {
  const poisonMaster = simulate(
    ["Jacaranda's Embrace", { type: "wait", durationMs: 4000 }],
    { selectedTraitIds: [TRAIT.POISON_MASTER] },
  );
  const poisonMasterProc = poisonMaster.resolvedEvents.find(
    (event) =>
      event.type === "condition" && event.sourceId === TRAIT.POISON_MASTER,
  );
  assert.equal(poisonMasterProc.stacks, 2);
  assert.equal(poisonMasterProc.duration, 8);
  assert.equal(poisonMasterProc.actorType, "effect");
  assert.equal(
    Object.hasOwn(poisonMasterProc, "summonBaseConditionDamage"),
    false,
  );

  const poisonousStrikes = simulate([
    { name: "__combat_start" },
    "Double Arc",
    { type: "wait", durationMs: 8000 },
  ]);
  assert.equal(
    poisonousStrikes.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.sourceId === ID.DOUBLE_ARC &&
        event.skillName === "Poisonous Strikes",
    ).length,
    2,
  );
});

test("Druid Avatar traits grant alacrity, Eclipse conditions, and Blood Moon", () => {
  const selectedTraitIds = [
    TRAIT.CELESTIAL_BEING,
    TRAIT.NATURAL_MENDER,
    TRAIT.BLOOD_MOON,
    TRAIT.GRACE_OF_THE_LAND,
    TRAIT.ECLIPSE,
  ];
  const result = simulate(
    [
      "Celestial Avatar",
      "Natural Convergence",
      "Lunar Impact",
      "Rejuvenating Tides",
      "Release Celestial Avatar",
    ],
    { selectedTraitIds },
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.filter(
      (event) => event.type === "buff" && event.kind === "alacrity",
    ).length,
    6,
  );
  assert.equal(
    result.events.filter(
      (event) =>
        event.type === "condition" &&
        event.sourceId === TRAIT.ECLIPSE &&
        event.condition === "Burning",
    ).length,
    4,
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" && event.sourceId === TRAIT.BLOOD_MOON,
    ).length >= 3,
    true,
  );
  assert.equal(result.endState.profession.celestialAvatarActive, false);
  assert.equal(result.endState.profession.astralForce > 0, true);

  const naturalMender = simulate([{ type: "wait", durationMs: 6000 }], {
    initialAstralForce: 0,
    selectedTraitIds: [TRAIT.NATURAL_MENDER],
  });
  assert.equal(naturalMender.endState.profession.astralForce, 16);
});

test("Druid healing-event assumptions generate Astral Force outside Avatar", () => {
  const result = simulate([{ type: "wait", durationMs: 6000 }], {
    initialAstralForce: 0,
    selectedTraitIds: [TRAIT.NATURAL_MENDER],
    professionAssumptions: { astralForceHealingEventsPerSecond: 2 },
  });

  assert.equal(result.endState.profession.astralForce, 34);
});

test("Celestial Avatar transitions trigger swap mechanics and weapon lines", () => {
  const result = simulate(
    [
      "__combat_start",
      "Celestial Avatar",
      { type: "wait", durationMs: 10000 },
      "Release Celestial Avatar",
    ],
    {
      sigilSets: [
        { names: ["Hydromancy"], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === "sigil_swap")
      .map((event) => event.skillName),
    ["Celestial Avatar", "Release Celestial Avatar"],
  );
  assert.deepEqual(
    result.procSteps
      .filter((step) => step.skill === "Sigil of Hydromancy")
      .map((step) => step.sourceSkill),
    ["Celestial Avatar", "Release Celestial Avatar"],
  );

  const transition = rangerProfession.ui.timelineWeaponLineTransition;
  const rotation = [
    "Splitblade",
    "Celestial Avatar",
    "Natural Convergence",
    "Release Celestial Avatar",
    "Splitblade",
  ];
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponLineTransition(entry, current) {
      const name = typeof entry === "string" ? entry : entry.name;
      return transition({
        entry: { name },
        skill: rangerCatalog.skillsByName.get(name),
        specialization: "Druid",
        ...current,
      });
    },
  });
  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, "Celestial Avatar", null],
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]],
  );
});

test("condition-alacrity Druid preset preserves the requested loadout", async () => {
  const [savedBuild, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/ranger/b-condi-alac-druid-dagger-torch-axe-dagger.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/ranger/r-condi-alac-druid-dagger-torch-axe-dagger-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/ranger/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.equal(
    Object.values(savedBuild.gear).every((stat) => stat === "Viper's"),
    true,
  );
  assert.deepEqual(savedBuild.weapons, ["Dagger", "Torch"]);
  assert.deepEqual(savedBuild.alternateWeapons, ["Axe", "Dagger"]);
  assert.deepEqual(savedBuild.weaponSigils, [
    ["Bursting", "Doom"],
    ["Bursting", "Geomancy"],
  ]);
  assert.equal(savedBuild.infusions[0].stat, "Expertise");
  assert.equal(savedBuild.infusions[0].count, 18);
  assert.deepEqual(savedBuild.specializations, [
    { name: "Skirmishing", traits: "1-3-2" },
    { name: "Wilderness Survival", traits: "3-1-3" },
    { name: "Druid", traits: "3-2-3" },
  ]);
  assert.equal(savedBuild.assumptions.astralForceHealingEventsPerSecond, 2);
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 101.757);
  assert.equal(savedRotation.metadata.benchmarkDamage, 4007796);

  const build = migrateRangerBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);

  assert.deepEqual(result.warnings, []);
  const preset = manifest
    .find(({ section }) => section === "Druid")
    .presets.find(({ label }) => label.startsWith("Condition Alacrity"));
  assert.equal(preset.benchmarkDps, Math.round(result.dps));
  assert.equal(
    result.breakdown.some(({ name }) => name === "Call Lightning"),
    true,
  );
  assert.equal(
    result.breakdown.some(({ name }) => name === "Blood Moon - Bleeding"),
    true,
  );
});
