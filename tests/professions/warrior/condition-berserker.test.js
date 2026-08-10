import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  recalculate,
  runSimulation,
} from "../../../js/professions/warrior/app/app-definition.js";
import {
  migrateWarriorBuild,
  validateWarriorBuild,
} from "../../../js/professions/warrior/build.js";
import { warriorCatalog } from "../../../js/professions/warrior/catalog.js";
import { getActiveTraits } from "../../../js/professions/warrior/data/traits-data.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../../js/professions/warrior/data/ids.js";

const buildUrl = new URL(
  "../../../Builds/warrior/b-condi-berserker-longbow-sword-torch.json",
  import.meta.url,
);
const rotationUrl = new URL(
  "../../../Rotations/warrior/r-condi-berserker-longbow-sword-torch-bench.json",
  import.meta.url,
);
const manifestUrl = new URL(
  "../../../Builds/warrior/manifest.json",
  import.meta.url,
);

async function loadPreset() {
  const [raw, savedRotation, manifest] = await Promise.all(
    [buildUrl, rotationUrl, manifestUrl].map((url) =>
      readFile(url, "utf8").then(JSON.parse),
    ),
  );
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
  return { raw, savedRotation, manifest, result: runSimulation(app) };
}

function rotationName(command) {
  return typeof command === "string" ? command : command.name;
}

function skill(id) {
  return warriorCatalog.skillsById.get(id);
}

test("Condition Berserker preset preserves the supplied build and EVTC order", async () => {
  const { raw, savedRotation, manifest, result } = await loadPreset();

  assert.deepEqual(validateWarriorBuild(raw), { valid: true, errors: [] });
  assert.equal(raw.gear.Helm, "Grieving");
  assert.equal(
    Object.entries(raw.gear).every(
      ([slot, stat]) => slot === "Helm" || stat === "Viper's",
    ),
    true,
  );
  assert.deepEqual(raw.weapons, ["Longbow", ""]);
  assert.deepEqual(raw.alternateWeapons, ["Sword", "Torch"]);
  assert.deepEqual(raw.weaponSigils, [
    ["Doom", "Earth"],
    ["Geomancy", "Torment"],
  ]);
  assert.equal(raw.rune, "Trapper");
  assert.equal(raw.relic, "Fractal");
  assert.equal(raw.food, "Cilantro and Cured Meat Flatbread");
  assert.equal(raw.utility, "Toxic Tuning Crystal");
  assert.deepEqual(raw.infusions, [{ stat: "Condition Damage", count: 18 }]);
  assert.deepEqual(
    raw.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Arms", "1-1-2"],
      ["Strength", "3-3-1"],
      ["Berserker", "2-1-2"],
    ],
  );
  assert.deepEqual(
    getActiveTraits(raw.specializations)
      .filter((trait) => trait.slot === "Major")
      .map((trait) => trait.name),
    [
      "Wounding Precision",
      "Unsuspecting Foe",
      "Furious",
      "Peak Performance",
      "Great Fortitude",
      "Berserker's Power",
      "Last Blaze",
      "Blood Reaction",
      "King of Fires",
    ],
  );
  assert.deepEqual(Object.values(raw.selectedSkills), [
    "Blood Reckoning",
    "Shattering Blow",
    "Outrage",
    "Sundering Leap",
    "Head Butt",
  ]);

  const preset = manifest
    .find((section) => section.section === "Berserker")
    .presets.find(({ label }) => label === "Condition (Longbow + Sword/Torch)");
  assert.equal(preset.benchmarkDps, 43275);
  assert.equal(
    preset.build,
    "Builds/warrior/b-condi-berserker-longbow-sword-torch.json",
  );
  assert.equal(
    preset.rotation,
    "Rotations/warrior/r-condi-berserker-longbow-sword-torch-bench.json",
  );

  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 92.236);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3991492);
  assert.equal(savedRotation.metadata.benchmarkDps, 43274.77340192593);
  assert.equal(savedRotation.metadata.castTimeQuantizationMs, 40);
  assert.equal(savedRotation.rotation.length, 173);
  assert.equal(
    savedRotation.rotation.some(
      (command) => rotationName(command) === "__wait",
    ),
    false,
  );
  assert.deepEqual(savedRotation.rotation.slice(0, 12).map(rotationName), [
    "Flames of War",
    "Swap Weapons",
    "Head Butt",
    "__combat_start",
    "Outrage",
    "Pin Down",
    "Berserk",
    "Scorched Earth",
    "Blood Reckoning",
    "Scorched Earth",
    "Fan of Fire",
    "Swap Weapons",
  ]);

  assert.deepEqual(result.warnings, []);
  assert.ok(
    Math.abs(
      result.duration - savedRotation.metadata.benchmarkDurationSeconds,
    ) < 1,
  );
  assert.ok(
    Math.abs(result.totalDamage / savedRotation.metadata.benchmarkDamage - 1) <
      0.01,
  );
  const conditionDamage = new Map(
    result.conditionBreakdown.map(({ name, damage }) => [name, damage]),
  );
  for (const [name, evtcDamage] of [
    ["Burning", 1840738],
    ["Bleeding", 997579],
    ["Torment", 202407],
    ["Poisoned", 93159],
  ]) {
    assert.ok(
      Math.abs(conditionDamage.get(name) / evtcDamage - 1) < 0.07,
      `${name} damage ${conditionDamage.get(name)} drifted from EVTC ${evtcDamage}.`,
    );
  }
  assert.ok(Math.abs(conditionDamage.get("Torment") / 202407 - 1) < 0.02);
  assert.equal(
    result.events.filter(
      (event) => event.sourceId === "warrior.combo.fire-leap",
    ).length,
    13,
  );
  const kingProcs = result.procSteps.filter(
    (proc) => proc.type === "trait_proc" && proc.skill === "King of Fires",
  );
  const kingStrikes = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" && event.sourceId === TRAIT.KING_OF_FIRES,
  );
  const kingBurning = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.sourceId === TRAIT.KING_OF_FIRES,
  );
  assert.ok(kingProcs.length > 0);
  assert.equal(kingStrikes.length, kingProcs.length);
  assert.equal(kingBurning.length, kingProcs.length);
  assert.equal(
    kingBurning.reduce((total, event) => total + event.stacks, 0),
    kingProcs.length * 3,
  );
  assert.equal(
    kingBurning.every(
      (event) =>
        event.stacks === 3 &&
        event.duration === 3 &&
        event.effectiveDuration === 6,
    ),
    true,
  );
  assert.equal(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "condition" &&
          event.sourceId === "warrior.combo.fire-projectile",
      )
      .every(
        (event) =>
          event.stacks === 1 &&
          event.duration === 1 &&
          event.effectiveDuration === 2,
      ),
    true,
  );
  assert.equal(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" &&
          event.skillName === "Scorched Earth" &&
          event.actorType === "player",
      )
      .every(
        (event) =>
          event.weaponStrengthProfileId === "weapon.longbow" &&
          event.resolvedWeaponStrength === 1050,
      ),
    true,
  );
  const castCounts = savedRotation.rotation.reduce((counts, command) => {
    const name = rotationName(command);
    counts.set(name, (counts.get(name) || 0) + 1);
    return counts;
  }, new Map());
  assert.deepEqual(
    Object.fromEntries(
      [
        "Scorched Earth",
        "Fan of Fire",
        "Arcing Arrow",
        "Outrage",
        "Savage Leap",
        "Blaze Breaker",
        "Rend",
        "Flaming Flurry",
        "Sever Artery",
        "Gash",
        "Dual Shot",
        "Blood Reckoning",
        "Hamstring",
        "Shattering Blow",
        "Flames of War",
        "Pin Down",
        "Sundering Leap",
        "Head Butt",
        "Berserk",
      ].map((name) => [name, castCounts.get(name)]),
    ),
    {
      "Scorched Earth": 22,
      "Fan of Fire": 16,
      "Arcing Arrow": 13,
      Outrage: 11,
      "Savage Leap": 8,
      "Blaze Breaker": 8,
      Rend: 8,
      "Flaming Flurry": 8,
      "Sever Artery": 8,
      Gash: 8,
      "Dual Shot": 7,
      "Blood Reckoning": 6,
      Hamstring: 6,
      "Shattering Blow": 6,
      "Flames of War": 5,
      "Pin Down": 5,
      "Sundering Leap": 5,
      "Head Butt": 4,
      Berserk: 1,
    },
  );
});

test("Condition Berserker skill data matches the supplied values and log timing", () => {
  const quicknessCastTimes = {
    [ID.DUAL_SHOT]: 840,
    [ID.FAN_OF_FIRE]: 560,
    [ID.ARCING_ARROW]: 560,
    [ID.PIN_DOWN]: 680,
    [ID.SMOLDERING_ARROW]: 160,
    [ID.COMBUSTIVE_SHOT]: 520,
    [ID.SCORCHED_EARTH]: 360,
    [ID.SAVAGE_LEAP]: 1000,
    [ID.BLAZE_BREAKER]: 480,
    [ID.FLAMES_OF_WAR]: 520,
    [ID.REND]: 960,
    [ID.FLAMING_FLURRY]: 1600,
    [ID.SEVER_ARTERY]: 360,
    [ID.GASH]: 520,
    [ID.HAMSTRING]: 280,
    [ID.BLOOD_RECKONING]: 280,
    [ID.SHATTERING_BLOW]: 520,
    [ID.SUNDERING_LEAP]: 920,
    [ID.HEAD_BUTT]: 800,
  };
  for (const [id, castTime] of Object.entries(quicknessCastTimes)) {
    assert.equal(skill(Number(id)).quicknessCastTimeMs, castTime);
    assert.equal(castTime % 40, 0);
  }

  const dualShot = skill(ID.DUAL_SHOT);
  assert.deepEqual(
    dualShot.effects[0].ticks.map(({ atMs, coefficient }) => [
      atMs,
      coefficient,
    ]),
    [
      [560, 0.525],
      [600, 0.525],
    ],
  );
  assert.equal(dualShot.finisherType, "Projectile");
  assert.equal(dualShot.finisherValue, 0.2);

  const fan = skill(ID.FAN_OF_FIRE);
  assert.equal(fan.cooldown, 5);
  assert.deepEqual(
    fan.effects.map(({ type, coefficient, hits, stacks, duration, atMs }) => ({
      type,
      coefficient,
      hits,
      stacks,
      duration,
      atMs,
    })),
    [
      {
        type: "strike",
        coefficient: 1.32,
        hits: 3,
        stacks: undefined,
        duration: undefined,
        atMs: 240,
      },
      {
        type: "condition",
        coefficient: undefined,
        hits: undefined,
        stacks: 3,
        duration: 3,
        atMs: 240,
      },
    ],
  );

  const arcingArrow = skill(ID.ARCING_ARROW);
  assert.equal(arcingArrow.ammo, 2);
  assert.equal(arcingArrow.ammoRecharge, 8);
  assert.equal(arcingArrow.ammoCastLockout, 1);
  assert.equal(arcingArrow.finisherType, "Blast");
  assert.deepEqual(
    arcingArrow.effects.map(
      ({ type, coefficient, hits, condition, stacks, duration, atMs }) => ({
        type,
        coefficient,
        hits,
        condition,
        stacks,
        duration,
        atMs,
      }),
    ),
    [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
        condition: undefined,
        stacks: undefined,
        duration: undefined,
        atMs: 600,
      },
      {
        type: "condition",
        coefficient: undefined,
        hits: undefined,
        condition: "Burning",
        stacks: 1,
        duration: 5,
        atMs: 600,
      },
    ],
  );

  const smolderingArrow = skill(ID.SMOLDERING_ARROW);
  assert.equal(smolderingArrow.ammo, 3);
  assert.equal(smolderingArrow.ammoRecharge, 16);
  assert.equal(smolderingArrow.ammoCastLockout, 0.5);
  assert.equal(smolderingArrow.effects[0].coefficient, 0.2);
  assert.equal(
    smolderingArrow.effects.some(
      (effect) => effect.type === "blind" && effect.metadata.duration === 5,
    ),
    true,
  );
  assert.equal(smolderingArrow.finisherType, "Projectile");
  assert.equal(smolderingArrow.finisherValue, 1);

  const pinDown = skill(ID.PIN_DOWN);
  assert.equal(pinDown.cooldown, 20);
  assert.equal(pinDown.effects[0].coefficient, 0.44);
  assert.equal(pinDown.effects[1].stacks, 6);
  assert.equal(pinDown.effects[1].duration, 12);
  assert.equal(pinDown.effects[2].condition, "Immobilized");
  assert.equal(pinDown.effects[2].duration, 3);
  assert.equal(pinDown.finisherType, "Projectile");

  const combustiveShot = skill(ID.COMBUSTIVE_SHOT);
  assert.equal(combustiveShot.cooldown, 8);
  assert.equal(combustiveShot.comboField, "Fire");
  assert.equal(combustiveShot.duration, 3);
  assert.deepEqual(combustiveShot.burstFieldDurations, [3, 6, 9]);
  assert.deepEqual(combustiveShot.effects, []);

  const scorchedEarth = skill(ID.SCORCHED_EARTH);
  assert.equal(scorchedEarth.cooldown, 5);
  assert.equal(scorchedEarth.skillWeapon, "Longbow");
  assert.equal(scorchedEarth.comboField, "Fire");
  assert.equal(scorchedEarth.duration, 4);
  assert.deepEqual(
    scorchedEarth.effects[0].ticks.map(({ atMs, coefficient }) => [
      atMs,
      coefficient,
    ]),
    [
      [320, 0.5],
      [2320, 0.5],
      [4320, 0.5],
    ],
  );

  const savageLeap = skill(ID.SAVAGE_LEAP);
  const savageBleeding = savageLeap.effects.find(
    (effect) => effect.type === "condition" && effect.condition === "Bleeding",
  );
  assert.equal(savageBleeding.stacks, 3);
  assert.equal(savageBleeding.duration, 5);
  assert.deepEqual(
    scorchedEarth.effects[1].ticks.map(({ atMs, stacks, duration }) => [
      atMs,
      stacks,
      duration,
    ]),
    [
      [320, 1, 3],
      [2320, 1, 3],
      [4320, 1, 3],
    ],
  );

  const blazeBreaker = skill(ID.BLAZE_BREAKER);
  assert.equal(blazeBreaker.cooldown, 12);
  assert.equal(blazeBreaker.finisherType, "Blast");
  assert.equal(blazeBreaker.finisherValue, 1);
  assert.equal(blazeBreaker.waves, 5);
  assert.equal(blazeBreaker.totalCoefficient, 2);
  assert.equal(blazeBreaker.maximumHitsPerTarget, 1);
  assert.deepEqual(
    blazeBreaker.effects.map(
      ({ type, coefficient, hits, condition, stacks, duration, atMs }) => ({
        type,
        coefficient,
        hits,
        condition,
        stacks,
        duration,
        atMs,
      }),
    ),
    [
      {
        type: "strike",
        coefficient: 0.4,
        hits: 1,
        condition: undefined,
        stacks: undefined,
        duration: undefined,
        atMs: 400,
      },
      {
        type: "condition",
        coefficient: undefined,
        hits: undefined,
        condition: "Burning",
        stacks: 1,
        duration: 6,
        atMs: 400,
      },
      {
        type: "condition",
        coefficient: undefined,
        hits: undefined,
        condition: "Crippled",
        stacks: 1,
        duration: 3,
        atMs: 400,
      },
    ],
  );

  const flamesOfWar = skill(ID.FLAMES_OF_WAR);
  assert.equal(flamesOfWar.cooldown, 20);
  assert.equal(flamesOfWar.comboField, "Fire");
  assert.equal(flamesOfWar.duration, 5);
  assert.deepEqual(flamesOfWar.effects[0], {
    type: "strike",
    coefficient: 1,
    hits: 1,
    atMs: 5480,
    timingAnchor: "castStart",
    timingScale: "fixed",
    persistsAfterInterrupt: true,
    metadata: {
      extendsProfessionTaskHorizon: true,
    },
  });
  assert.deepEqual(
    flamesOfWar.effects[1].ticks.map(({ atMs, stacks, duration }) => [
      atMs,
      stacks,
      duration,
    ]),
    [
      [480, 1, 2],
      [1480, 1, 2],
      [2480, 1, 2],
      [3480, 1, 2],
      [4480, 1, 2],
      [5480, 2, 6],
    ],
  );

  const flamingFlurry = skill(ID.FLAMING_FLURRY);
  assert.equal(flamingFlurry.skillWeapon, "Sword");
  assert.deepEqual(
    flamingFlurry.effects[1].ticks.map(({ duration }) => duration),
    [3.5, 3.5, 3.5, 3.5, 3.5, 3.5],
  );
});

test("Combustive Shot scales its pulses and field with adrenaline", async () => {
  const raw = JSON.parse(await readFile(buildUrl, "utf8"));
  for (const [tier, expectedOffsets] of [
    [1, [520, 3520]],
    [2, [520, 3520, 6520]],
    [3, [520, 3520, 6520, 9520]],
  ]) {
    const build = migrateWarriorBuild({
      ...raw,
      initialResource: tier * 10,
      startingWeaponSet: 1,
      rotation: ["Combustive Shot"],
    });
    const app = {
      build,
      skillByName: warriorCatalog.skillsByName,
      attributeWeaponSet: 1,
    };
    recalculate(app);
    const result = runSimulation(app);
    assert.deepEqual(result.warnings, []);
    const action = result.events.find(
      (event) =>
        event.type === "action" && event.skillId === ID.COMBUSTIVE_SHOT,
    );
    assert.equal(action.burstTier, tier);
    assert.equal(action.comboFieldDuration, tier * 3);
    assert.deepEqual(
      result.events
        .filter(
          (event) =>
            event.type === "damage" &&
            event.activationId === action.activationId,
        )
        .map((event) => [
          Math.round((event.at - action.at) * 1000),
          event.coefficient,
        ]),
      expectedOffsets.map((offset) => [offset, 0.5]),
    );
    assert.deepEqual(
      result.events
        .filter(
          (event) =>
            event.type === "condition" &&
            event.activationId === action.activationId,
        )
        .map((event) => [
          Math.round((event.at - action.at) * 1000),
          event.stacks,
          event.duration,
        ]),
      expectedOffsets.map((offset) => [offset, 1, 5]),
    );
  }
});

test("a delayed primal-burst critical hit immediately detonates its new fire aura", async () => {
  const raw = JSON.parse(await readFile(buildUrl, "utf8"));
  const build = migrateWarriorBuild({
    ...raw,
    targetHealth: 100_000_000,
    startingWeaponSet: 1,
    specializations: [
      { name: "Strength", traits: "1-1-1" },
      { name: "Discipline", traits: "2-3-3" },
      { name: "Berserker", traits: "2-1-2" },
    ],
    assumptions: {
      ...raw.assumptions,
      fury: false,
      targetConditions: {},
    },
    rotation: [
      "__combat_start",
      "Berserk",
      "Scorched Earth",
      { name: "__wait", durationMs: 2500 },
    ],
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const scorchedAction = result.events.find(
    (event) => event.type === "action" && event.skillId === ID.SCORCHED_EARTH,
  );
  const kingProc = result.procSteps.find(
    (proc) => proc.type === "trait_proc" && proc.skill === "King of Fires",
  );

  assert.equal(kingProc.start, Math.round(scorchedAction.at * 1000) + 2320);
  assert.equal(kingProc.sourceSkill, "Scorched Earth");
});

test("a final persistent Berserker packet still resolves King of Fires", async () => {
  const raw = JSON.parse(await readFile(buildUrl, "utf8"));
  const build = migrateWarriorBuild({
    ...raw,
    targetHealth: 100_000_000,
    startingWeaponSet: 2,
    rotation: ["__combat_start", "Flames of War"],
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const kingProc = result.procSteps.find(
    (proc) => proc.type === "trait_proc" && proc.skill === "King of Fires",
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(kingProc.start, 5480);
  assert.equal(kingProc.sourceSkill, "Flames of War");
});

test("Condition Berserker damage packets retain their EVTC cast offsets", async () => {
  const { result } = await loadPreset();
  const packetOffsets = (name) => {
    const action = result.events.find(
      (event) =>
        event.type === "action" &&
        event.skillName === name &&
        event.cancelled !== true,
    );
    return result.events
      .filter(
        (event) =>
          event.type === "damage" &&
          event.activationId === action.activationId &&
          Number(event.coefficient) > 0,
      )
      .map((event) => Math.round((event.at - action.at) * 1000));
  };

  assert.deepEqual(packetOffsets("Head Butt"), [760]);
  assert.deepEqual(packetOffsets("Pin Down"), [560]);
  assert.deepEqual(packetOffsets("Scorched Earth"), [320, 2320, 4320]);
  assert.deepEqual(packetOffsets("Fan of Fire"), [240, 240, 240]);
  assert.deepEqual(packetOffsets("Savage Leap"), [800]);
  assert.deepEqual(packetOffsets("Blaze Breaker"), [400]);
  assert.deepEqual(packetOffsets("Rend"), [440, 880]);
  assert.deepEqual(
    packetOffsets("Flaming Flurry"),
    [400, 640, 880, 1120, 1320, 1560],
  );
  assert.deepEqual(packetOffsets("Sever Artery"), [200]);
  assert.deepEqual(packetOffsets("Gash"), [280]);
  assert.deepEqual(packetOffsets("Hamstring"), [240]);
  assert.deepEqual(packetOffsets("Shattering Blow"), [320]);
  assert.deepEqual(packetOffsets("Sundering Leap"), [840]);
  assert.deepEqual(packetOffsets("Arcing Arrow"), [600]);
  assert.deepEqual(packetOffsets("Dual Shot"), [560, 600]);
  assert.deepEqual(packetOffsets("Flames of War"), [5480]);
});
