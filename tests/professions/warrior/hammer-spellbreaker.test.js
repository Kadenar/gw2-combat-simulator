import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import {
  migrateWarriorBuild,
  validateWarriorBuild,
} from "../../../js/professions/warrior/build.js";
import { warriorCatalog } from "../../../js/professions/warrior/catalog.js";
import {
  recalculate,
  runSimulation,
} from "../../../js/professions/warrior/app/app-definition.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../../js/professions/warrior/data/ids.js";
import { warriorProfession } from "../../../js/professions/warrior/definition.js";

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 0,
    ferocity: 500,
    conditionDamage: 0,
    expertise: 0,
    vitality: 1000,
  },
  target: {
    armor: 2597,
    health: 4_000_000,
    defiant: false,
    controlled: false,
    conditions: {},
  },
  boons: { quickness: true },
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: warriorProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
      boons: { ...baseConfig.boons, ...(config.boons || {}) },
    },
    mode: "sequence",
  });
}

function strike(skillId) {
  return warriorCatalog.skillsById
    .get(skillId)
    .effects.find((effect) => effect.type === "strike");
}

test("hammer and dagger/mace timings preserve the 40 ms EVTC measurements", () => {
  for (const [skillId, castMs, packetMs] of [
    [ID.HAMMER_SWING, 480, 360],
    [ID.HAMMER_BASH, 640, 320],
    [ID.HAMMER_SMASH, 440, 320],
    [ID.FIERCE_BLOW, 880, 600],
    [ID.HAMMER_SHOCK, 600, 320],
    [ID.STAGGERING_BLOW, 480, 400],
    [ID.BACKBREAKER, 880, 680],
    [ID.EARTHSHAKER, 1000, 840],
    [ID.CRUSHING_BLOW, 560, 440],
    [ID.TREMOR, 560, 440],
    [ID.PRECISE_CUT, 320, 280],
    [ID.FOCUSED_SLASH, 360, 280],
    [ID.KEEN_STRIKE, 440, 280],
    [ID.DISRUPTING_STAB, 440, 160],
    [ID.BREACHING_STRIKE_ID_69297, 840, 760],
  ]) {
    const skill = warriorCatalog.skillsById.get(skillId);
    if (skillId === ID.BREACHING_STRIKE_ID_69297) {
      assert.equal(skill.castTimeMs, castMs, skill.name);
      assert.equal(skill.unaffectedByQuickness, true, skill.name);
      assert.equal(skill.quicknessCastTimeMs, undefined, skill.name);
    } else {
      assert.equal(skill.quicknessCastTimeMs, castMs, skill.name);
    }
    const usesHammer = [
      ID.HAMMER_SWING,
      ID.HAMMER_BASH,
      ID.HAMMER_SMASH,
      ID.FIERCE_BLOW,
      ID.HAMMER_SHOCK,
      ID.STAGGERING_BLOW,
      ID.BACKBREAKER,
      ID.EARTHSHAKER,
    ].includes(skillId);
    const rotation =
      skillId === ID.HAMMER_BASH
        ? [ID.HAMMER_SWING, skill.id]
        : skillId === ID.HAMMER_SMASH
          ? [ID.HAMMER_SWING, ID.HAMMER_BASH, skill.id]
          : skillId === ID.FOCUSED_SLASH
            ? [ID.PRECISE_CUT, skill.id]
            : skillId === ID.KEEN_STRIKE
              ? [ID.PRECISE_CUT, ID.FOCUSED_SLASH, skill.id]
              : [skill.id];
    const result = simulate("Spellbreaker", rotation, {
      primaryWeapon: usesHammer ? "Hammer" : "Dagger",
      secondaryWeapon: usesHammer ? "" : "Mace",
      initialResource: skill.burst ? 10 : 0,
    });
    const action = result.events.find(
      (event) => event.type === "action" && event.skillId === skillId,
    );
    const damage = result.events.find(
      (event) =>
        event.type === "damage" && event.activationId === action.activationId,
    );
    assert.equal(
      Math.round((damage.at - action.at) * 1000),
      packetMs,
      skill.name,
    );
  }

  const tremor = simulate("Spellbreaker", [ID.TREMOR], {
    primaryWeapon: "Dagger",
    secondaryWeapon: "Mace",
  });
  const tremorAction = tremor.events.find((event) => event.type === "action");
  assert.deepEqual(
    tremor.events
      .filter((event) => event.type === "damage")
      .map((event) => Math.round((event.at - tremorAction.at) * 1000)),
    [440, 480],
  );
  assert.equal(strike(ID.STAGGERING_BLOW).metadata.finisherType, "whirl");
  assert.equal(strike(ID.EARTHSHAKER).metadata.finisherType, "blast");
  assert.equal(strike(ID.RUPTURING_SMASH).metadata.finisherType, "blast");
});

test("hammer cooldowns, conditional damage, recharge, and Defense traits work", () => {
  for (const [skillId, cooldown] of [
    [ID.FIERCE_BLOW, 6],
    [ID.HAMMER_SHOCK, 8],
    [ID.STAGGERING_BLOW, 18],
    [ID.BACKBREAKER, 25],
    [ID.EARTHSHAKER, 8],
    [ID.RUPTURING_SMASH, 5],
    [ID.TO_THE_LIMIT, 24],
  ]) {
    const skill = warriorCatalog.skillsById.get(skillId);
    assert.equal(skill.cooldown, cooldown);
    assert.equal(Object.hasOwn(skill, "recharge"), false);
  }

  const fierceCoefficient = (defiant) =>
    simulate("Core", ["Fierce Blow"], {
      primaryWeapon: "Hammer",
      target: { defiant },
    }).events.find((event) => event.type === "damage").coefficient;
  assert.equal(fierceCoefficient(false), 1.8);
  assert.equal(fierceCoefficient(true), 2.7);

  const reset = simulate(
    "Core",
    ["Fierce Blow", "Backbreaker", "Fierce Blow"],
    { primaryWeapon: "Hammer" },
  );
  assert.deepEqual(
    reset.steps
      .filter(({ skill }) => skill === "Fierce Blow")
      .map(({ start }) => start),
    [0, 1760],
  );

  const defense = simulate(
    "Spellbreaker",
    ["Earthshaker", "__cooldown_reset", "Earthshaker"],
    {
      primaryWeapon: "Hammer",
      initialResource: 20,
      selectedTraitIds: [TRAIT.CULL_THE_WEAK, TRAIT.MERCILESS_HAMMER],
      target: { defiant: true },
    },
  );
  const weaknesses = defense.events.filter(
    (event) => event.sourceId === TRAIT.CULL_THE_WEAK,
  );
  assert.equal(weaknesses.length, 1);
  assert.deepEqual(
    {
      condition: weaknesses[0].condition,
      duration: weaknesses[0].duration,
    },
    { condition: "Weakness", duration: 3.5 },
  );
  assert.equal(defense.endState.profession.adrenaline, 16);
});

test("Spellbreaker boon removal and lightning leap combos drive Attacker's Insight", () => {
  const insightConfig = {
    selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT],
  };
  const insightStacks = (result) =>
    result.endState.profession.attackerInsightExpiries.length;
  const removals = (result, skillId) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === "warrior.boon-removal" && event.skillId === skillId,
    );

  const breaching = simulate("Spellbreaker", [ID.BREACHING_STRIKE_ID_69297], {
    ...insightConfig,
    primaryWeapon: "Dagger",
    initialResource: 10,
    target: { boonless: true },
  });
  assert.deepEqual(
    removals(breaching, ID.BREACHING_STRIKE_ID_69297).map(
      ({ attemptedBoonRemovals, boonsRemoved }) => ({
        attemptedBoonRemovals,
        boonsRemoved,
      }),
    ),
    [{ attemptedBoonRemovals: 2, boonsRemoved: 0 }],
  );
  assert.equal(insightStacks(breaching), 0);

  const breachingCombo = simulate(
    "Spellbreaker",
    [ID.WINDS_OF_DISENCHANTMENT, ID.BREACHING_STRIKE_ID_69297],
    {
      ...insightConfig,
      primaryWeapon: "Dagger",
      initialResource: 10,
      target: { boonless: true },
    },
  );
  assert.equal(insightStacks(breachingCombo), 1);
  assert.equal(
    breachingCombo.resolvedEvents.filter(
      (event) =>
        event.type === "combo" &&
        event.skillName === "Breaching Strike" &&
        event.fieldType === "Lightning" &&
        event.finisherType === "Leap" &&
        event.outcome.name === "Dazing Strike",
    ).length,
    1,
  );

  const boonlessWinds = simulate("Spellbreaker", [ID.WINDS_OF_DISENCHANTMENT], {
    ...insightConfig,
    target: { boonless: true },
  });
  const windsRemovals = removals(boonlessWinds, ID.WINDS_OF_DISENCHANTMENT);
  assert.equal(windsRemovals.length, 5);
  assert.deepEqual(
    windsRemovals
      .slice(1)
      .map((event, index) =>
        Number((event.at - windsRemovals[index].at).toFixed(3)),
      ),
    [1, 1, 1, 1],
  );
  assert.equal(insightStacks(boonlessWinds), 0);

  const boonfulWinds = simulate("Spellbreaker", [ID.WINDS_OF_DISENCHANTMENT], {
    ...insightConfig,
    target: { boonless: false },
  });
  assert.equal(insightStacks(boonfulWinds), 5);

  const breakEnchantments = simulate("Spellbreaker", [ID.BREAK_ENCHANTMENTS], {
    ...insightConfig,
    target: { boonCount: 4 },
  });
  assert.deepEqual(
    removals(breakEnchantments, ID.BREAK_ENCHANTMENTS).map(
      ({ attemptedBoonRemovals, boonsRemoved }) => ({
        attemptedBoonRemovals,
        boonsRemoved,
      }),
    ),
    [{ attemptedBoonRemovals: 4, boonsRemoved: 4 }],
  );
  assert.equal(insightStacks(breakEnchantments), 4);

  const bullsCharge = simulate("Spellbreaker", [ID.BULLS_CHARGE], {
    ...insightConfig,
    target: { defiant: true },
  });
  assert.equal(insightStacks(bullsCharge), 1);

  const bullsChargeCombo = simulate(
    "Spellbreaker",
    [ID.WINDS_OF_DISENCHANTMENT, ID.BULLS_CHARGE],
    {
      ...insightConfig,
      target: { boonless: true, defiant: true },
    },
  );
  assert.equal(insightStacks(bullsChargeCombo), 2);
  assert.equal(
    bullsChargeCombo.events.filter(
      (event) =>
        event.type === "control" &&
        event.skillName === "Dazing Strike" &&
        event.parentSkillName === "Bull's Charge",
    ).length,
    1,
  );

  assert.deepEqual(
    [
      warriorCatalog.skillsById.get(ID.WINDS_OF_DISENCHANTMENT).comboField,
      warriorCatalog.skillsById.get(ID.WINDS_OF_DISENCHANTMENT).duration,
      warriorCatalog.skillsById.get(ID.BREACHING_STRIKE_ID_69297).finisherType,
      warriorCatalog.skillsById.get(ID.BULLS_CHARGE).finisherType,
    ],
    ["Lightning", 5, "Leap", "Leap"],
  );
});

test("Peak Performance and Magebane Tether use their logged recharge timing", () => {
  const peak = simulate("Spellbreaker", ["Bull's Charge"], {
    selectedTraitIds: [TRAIT.PEAK_PERFORMANCE],
  });
  const bull = peak.steps.find(({ skill }) => skill === "Bull's Charge");
  const peakBuff = peak.events.find(
    (event) => event.type === "buff" && event.kind === "peak-performance",
  );
  assert.equal(peakBuff.at * 1000, bull.end);
  const peakState = warriorProfession.ui
    .rotationStateSnapshot({
      specialization: "Spellbreaker",
      result: peak,
      atSeconds: peakBuff.at + 2,
    })
    .find(({ id }) => id === "peak-performance");
  assert.deepEqual(peakState, {
    id: "peak-performance",
    label: "Peak Performance",
    value: "4.0s",
    title: "Peak Performance: +10% strike damage (+15% total from trait)",
  });

  const magebaneProcs = (alacrity) =>
    simulate(
      "Spellbreaker",
      [
        "Breaching Strike",
        { type: "wait", durationMs: 9000 },
        "Breaching Strike",
      ],
      {
        initialResource: 20,
        primaryWeapon: "Dagger",
        secondaryWeapon: "Mace",
        selectedTraitIds: [TRAIT.MAGEBANE_TETHER],
        boons: { alacrity },
      },
    ).procSteps.filter(({ skill }) => skill === "Magebane Tether").length;

  assert.equal(magebaneProcs(false), 1);
  assert.equal(magebaneProcs(true), 2);
});

test('"To the Limit!" restores endurance, grants flow, and triggers Thick Skin', () => {
  const core = simulate("Core", ["Dodge", '"To the Limit!"'], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.THICK_SKIN],
  });
  assert.equal(core.endState.profession.adrenaline, 30);
  assert.equal(core.endState.profession.endurance, 100);
  const protection = core.events.find(
    (event) => event.sourceId === TRAIT.THICK_SKIN,
  );
  assert.deepEqual(
    { boon: protection.boon, duration: protection.duration },
    { boon: "protection", duration: 3 },
  );

  const bladesworn = simulate("Bladesworn", ['"To the Limit!"'], {
    initialResource: 0,
  });
  assert.ok(bladesworn.endState.profession.flow >= 30);
});

test("Power (Hammer + Dagger/Mace) preset uses the supplied updated rotation", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/warrior/b-power-spellbreaker-hammer-dagger-mace.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/warrior/r-power-spellbreaker-hammer-dagger-mace-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/warrior/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(validateWarriorBuild(raw), { valid: true, errors: [] });
  assert.deepEqual(raw.weapons, ["Hammer", ""]);
  assert.deepEqual(raw.alternateWeapons, ["Dagger", "Mace"]);
  assert.deepEqual(raw.weaponSigils, [
    ["Force", "Hydromancy"],
    ["Force", "Air"],
  ]);
  assert.deepEqual(
    raw.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Strength", "3-3-1"],
      ["Defense", "3-3-3"],
      ["Spellbreaker", "1-3-3"],
    ],
  );
  assert.deepEqual(Object.values(raw.selectedSkills), [
    '"To the Limit!"',
    "Bull's Charge",
    "Signet of Fury",
    "Signet of Might",
    "Winds of Disenchantment",
  ]);
  assert.equal(raw.startingWeaponSet, 2);
  assert.equal(raw.targetHealth, 4000000);

  const preset = manifest
    .find(({ section }) => section === "Spellbreaker")
    .presets.find(({ label }) => label === "Power (Hammer + Dagger/Mace)");
  assert.equal(preset.benchmarkDps, 43077);
  assert.equal(
    preset.dpsReportUrl,
    "https://dps.report/dzrB-20260721-123458_golem",
  );
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 94.803);
  assert.equal(savedRotation.metadata.benchmarkDamage, 4032199);
  assert.deepEqual(
    savedRotation.metadata.attackerInsightLog.firstApplicationsSeconds,
    [0, 0.562, 1.321, 1.321, 2.162],
  );
  assert.deepEqual(savedRotation.rotation.slice(0, 4), [
    '"To the Limit!"',
    "Winds of Disenchantment",
    { name: "Breaching Strike", skillId: 69297, interruptMs: 800 },
    { name: "__combat_start", offset: 760 },
  ]);
  assert.equal(savedRotation.rotation.length, 196);

  const build = migrateWarriorBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.slice(0, 5).map(({ skill }) => skill),
    [
      '"To the Limit!"',
      "Winds of Disenchantment",
      "Breaching Strike",
      "Combat Start",
      "Swap Weapons",
    ],
  );

  const hitCounts = new Map(
    result.breakdown.map(({ name, hits }) => [name, hits]),
  );
  for (const [name, hits] of [
    ["Fierce Blow — Damage to Controlled or Defiant Foes", 14],
    ["Crushing Blow", 14],
    ["Breaching Strike", 10],
    ["Earthshaker", 9],
    ["Hammer Shock", 9],
    ["Tremor", 10],
    ["Backbreaker", 5],
    ["Staggering Blow", 6],
    ["Disrupting Stab", 8],
    ["Hammer Swing", 8],
    ["Hammer Bash", 8],
    ["Hammer Smash", 8],
  ]) {
    assert.equal(hitCounts.get(name), hits, name);
  }

  const damageTotals = new Map(
    result.breakdown.map(({ name, strikeDamage }) => [name, strikeDamage]),
  );
  for (const [name, benchmarkDamage] of [
    ["Fierce Blow — Damage to Controlled or Defiant Foes", 629539],
    ["Crushing Blow", 525052],
    ["Breaching Strike", 455762],
  ]) {
    const simulatedDamage = damageTotals.get(name);
    const relativeError = Math.abs(simulatedDamage / benchmarkDamage - 1);
    assert.ok(
      relativeError < 0.02,
      `${name}: simulated ${Math.round(simulatedDamage)}, benchmark ${benchmarkDamage}`,
    );
  }

  const combatStart = result.steps.find(
    ({ skill }) => skill === "Combat Start",
  );
  const rotationEnd = Math.max(...result.steps.map(({ end }) => end));
  assert.ok(Math.abs(rotationEnd - combatStart.start - 93240) <= 40);
  assert.ok(Math.abs(result.dps - 42532) < 3000);
});
