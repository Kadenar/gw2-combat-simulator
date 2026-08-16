import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { elementalistCoreModule } from "../../../js/professions/elementalist/core/module.js";
import { ELEMENTALIST_CORE_SKILL_MECHANICS } from "../../../js/professions/elementalist/core/skills.js";
import {
  ELEMENTALIST_SKILL_IDS,
  ELEMENTALIST_SPECIALIZATION_IDS,
  ELEMENTALIST_TRAIT_IDS,
} from "../../../js/professions/elementalist/data/ids.js";
import { SPECIALIZATIONS as API_SPECIALIZATIONS } from "../../../js/professions/elementalist/data/elementalist-api-metadata.js";
import { TRAITS } from "../../../js/professions/elementalist/data/traits-data.js";
import { ELEMENTALIST_SKILL_MECHANICS } from "../../../js/professions/elementalist/mechanics/skill-mechanics.js";
import { catalystModule } from "../../../js/professions/elementalist/specializations/catalyst/module.js";
import { CATALYST_JADE_SPHERE_EFFECTS } from "../../../js/professions/elementalist/specializations/catalyst/jade-sphere-effects.js";
import { CATALYST_SKILL_MECHANICS } from "../../../js/professions/elementalist/specializations/catalyst/skills.js";
import { evokerModule } from "../../../js/professions/elementalist/specializations/evoker/module.js";
import { EVOKER_SKILL_MECHANICS } from "../../../js/professions/elementalist/specializations/evoker/skills.js";
import { tempestModule } from "../../../js/professions/elementalist/specializations/tempest/module.js";
import { TEMPEST_OVERLOAD_EFFECTS } from "../../../js/professions/elementalist/specializations/tempest/overload-effects.js";
import { TEMPEST_SKILL_MECHANICS } from "../../../js/professions/elementalist/specializations/tempest/skills.js";
import { weaverModule } from "../../../js/professions/elementalist/specializations/weaver/module.js";
import { WEAVER_SKILL_MECHANICS } from "../../../js/professions/elementalist/specializations/weaver/skills.js";

const slices = [
  ["core", elementalistCoreModule, ELEMENTALIST_CORE_SKILL_MECHANICS],
  ["specializations/tempest", tempestModule, TEMPEST_SKILL_MECHANICS],
  ["specializations/weaver", weaverModule, WEAVER_SKILL_MECHANICS],
  ["specializations/catalyst", catalystModule, CATALYST_SKILL_MECHANICS],
  ["specializations/evoker", evokerModule, EVOKER_SKILL_MECHANICS],
];

test("Elementalist skill mechanics have disjoint module ownership", () => {
  assert.equal(
    existsSync(
      new URL(
        "../../../js/professions/elementalist/data/native-skill-data.ts",
        import.meta.url,
      ),
    ),
    false,
  );

  const owners = new Map();
  for (const [directory, module, mechanics] of slices) {
    const source = readFileSync(
      new URL(
        `../../../js/professions/elementalist/${directory}/skills.ts`,
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(source, /ELEMENTALIST_SKILL_IDS\s+as\s+ID/);
    assert.doesNotMatch(source, /^\s*["']?-?\d+["']?\s*:/m);
    assert.doesNotMatch(
      source,
      /\b(?:id|skillId|nextChainId|flipParentId|flipChildId)\s*:\s*-?\d+/,
    );

    assert.deepEqual(
      Object.keys(module.data.skillMechanics).sort(),
      Object.keys(mechanics).sort(),
      directory,
    );
    for (const skillId of Object.keys(mechanics)) {
      assert.equal(owners.has(skillId), false, skillId);
      owners.set(skillId, module.id);
    }
  }

  assert.deepEqual(
    [...owners.keys()].sort((left, right) => Number(left) - Number(right)),
    Object.keys(ELEMENTALIST_SKILL_MECHANICS).sort(
      (left, right) => Number(left) - Number(right),
    ),
  );
  assert.equal(owners.size, 285);
  const declaredIds = new Set(Object.values(ELEMENTALIST_SKILL_IDS));
  for (const skillId of owners.keys()) {
    assert.equal(declaredIds.has(Number(skillId)), true, skillId);
  }
});

test("Glyph of Elementals delegates all damage to the summoned actor", () => {
  for (const skillId of [
    ELEMENTALIST_SKILL_IDS.GLYPH_OF_ELEMENTALS,
    ELEMENTALIST_SKILL_IDS.GLYPH_OF_ELEMENTALS_EARTH,
  ]) {
    const glyph = ELEMENTALIST_CORE_SKILL_MECHANICS[skillId];
    assert.deepEqual(glyph.effects, []);
    assert.equal(Object.hasOwn(glyph, "referenceEffects"), false);
  }
});

test("Catalyst spheres and Tempest overloads delegate repeated packets to maps", () => {
  for (const skillId of [
    ELEMENTALIST_SKILL_IDS.DEPLOY_JADE_SPHERE_FIRE,
    ELEMENTALIST_SKILL_IDS.DEPLOY_JADE_SPHERE_WATER,
    ELEMENTALIST_SKILL_IDS.DEPLOY_JADE_SPHERE_AIR,
    ELEMENTALIST_SKILL_IDS.DEPLOY_JADE_SPHERE_EARTH,
  ]) {
    assert.equal(
      CATALYST_SKILL_MECHANICS[skillId].effects,
      CATALYST_JADE_SPHERE_EFFECTS[skillId],
    );
  }

  for (const skillId of [
    ELEMENTALIST_SKILL_IDS.OVERLOAD_FIRE,
    ELEMENTALIST_SKILL_IDS.OVERLOAD_WATER,
    ELEMENTALIST_SKILL_IDS.OVERLOAD_AIR,
    ELEMENTALIST_SKILL_IDS.OVERLOAD_EARTH,
  ]) {
    assert.equal(
      TEMPEST_SKILL_MECHANICS[skillId].effects,
      TEMPEST_OVERLOAD_EFFECTS[skillId],
    );
  }
});

test("Lightning Blitz uses a flat 0.28 coefficient", () => {
  const lightningBlitz =
    EVOKER_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.LIGHTNING_BLITZ];
  assert.deepEqual(
    lightningBlitz.effects[0].ticks.map((tick) => tick.coefficient),
    [0.28, 0.28, 0.28, 0.28, 0.28],
  );
});

test("Arc Lightning models its damage packets as one tick sequence", () => {
  const arcLightning =
    ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.ARC_LIGHTNING];

  assert.equal(arcLightning.effects.length, 1);
  assert.deepEqual(
    arcLightning.effects[0].ticks.map(({ atMs, coefficient }) => [
      atMs,
      coefficient,
    ]),
    [
      [660, 0.35],
      [1020, 0.35],
      [1440, 0.35],
      [1800, 0.4],
      [2160, 0.4],
      [2580, 0.4],
      [2940, 0.3375],
      [3300, 0.3375],
      [3720, 0.3375],
      [4080, 0.3375],
    ],
  );
});

test("Drake's Breath models strikes and burning as parallel tick sequences", () => {
  const drakesBreath =
    ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.DRAKES_BREATH];

  assert.equal(drakesBreath.effects.length, 2);
  assert.deepEqual(
    drakesBreath.effects.map((effect) => effect.ticks.map((tick) => tick.atMs)),
    [
      [780, 1140, 1500, 1860],
      [780, 1140, 1500, 1860],
    ],
  );
  assert.deepEqual(
    drakesBreath.effects[0].ticks.map((tick) => tick.coefficient),
    [1.05, 1.05, 1.05, 1.05],
  );
  assert.ok(
    drakesBreath.effects[1].ticks.every(
      (tick) =>
        tick.condition === "Burning" &&
        tick.stacks === 1 &&
        tick.duration === 4,
    ),
  );
});

test("Burning Speed shares its field tick timing across damage and burning", () => {
  const burningSpeed =
    ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.BURNING_SPEED];
  const fieldTicks = burningSpeed.effects.slice(2);

  assert.deepEqual(
    fieldTicks.map((effect) => effect.ticks.map((tick) => tick.atMs)),
    [
      [240, 1740, 3240, 4740, 6240],
      [240, 1740, 3240, 4740, 6240],
    ],
  );
  assert.ok(
    fieldTicks[0].ticks.every(
      (tick) =>
        tick.coefficient === 0.2 && tick.metadata.damageKind === "field-tick",
    ),
  );
  assert.ok(
    fieldTicks[1].ticks.every(
      (tick) =>
        tick.condition === "Burning" &&
        tick.stacks === 1 &&
        tick.duration === 2,
    ),
  );
});

test("Flamewall shares its tick timing across damage and burning", () => {
  const flamewall =
    ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.FLAMEWALL];
  const expectedOffsets = [
    840, 2340, 3840, 5340, 6840, 8340, 9840, 11340, 12840,
  ];

  assert.deepEqual(
    flamewall.effects.map((effect) => effect.ticks.map((tick) => tick.atMs)),
    [expectedOffsets, expectedOffsets],
  );
  assert.ok(
    flamewall.effects[0].ticks.every(
      (tick) =>
        tick.coefficient === 0.1 && tick.metadata.damageKind === "field-tick",
    ),
  );
  assert.ok(
    flamewall.effects[1].ticks.every(
      (tick) =>
        tick.condition === "Burning" &&
        tick.stacks === 1 &&
        tick.duration === 2.5,
    ),
  );
});

test("Core repeated packets use compact tick sequences", () => {
  const sharedOffsets = [
    [
      ELEMENTALIST_SKILL_IDS.WILDFIRE,
      [2340, 3840, 5340, 6840, 8340, 9840, 11340],
      2,
    ],
    [
      ELEMENTALIST_SKILL_IDS.DUST_STORM,
      [2340, 3960, 5340, 6960, 8340, 9960, 11340, 12960],
      2,
    ],
    [ELEMENTALIST_SKILL_IDS.FROST_VOLLEY, [540, 1020, 1500, 1980, 2460], 2],
    [
      ELEMENTALIST_SKILL_IDS.GLYPH_OF_STORMS_FIRE,
      [1320, 2820, 4320, 5820, 7320, 8820, 10320, 11820, 13320, 14820, 16320],
      2,
    ],
    [
      ELEMENTALIST_SKILL_IDS.GLYPH_OF_STORMS_EARTH,
      [1320, 2820, 4320, 5820, 7320, 8820, 10320, 11820, 13320, 14820, 16320],
      2,
    ],
    [
      ELEMENTALIST_SKILL_IDS.FIRESTORM,
      [780, 2280, 3780, 5280, 6780, 8280, 9780, 11280, 12780],
      1,
    ],
    [
      ELEMENTALIST_SKILL_IDS.VOLCANO,
      [2340, 2700, 3180, 3600, 3960, 4380, 4860, 5220, 5640, 6060, 6480, 6960],
      1,
    ],
  ];

  for (const [
    skillId,
    expectedOffsets,
    expectedSequenceCount,
  ] of sharedOffsets) {
    const skill = ELEMENTALIST_CORE_SKILL_MECHANICS[skillId];
    const sequences = skill.effects.filter((effect) =>
      Array.isArray(effect.ticks),
    );

    assert.equal(sequences.length, expectedSequenceCount, skill.name);
    for (const effect of sequences) {
      assert.deepEqual(
        effect.ticks.map((tick) => tick.atMs),
        expectedOffsets,
        skill.name,
      );
    }
  }

  const dustStorm =
    ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.DUST_STORM];
  assert.deepEqual(
    dustStorm.effects
      .filter((effect) => effect.type === "blind")
      .map((effect) => effect.atMs),
    [2340, 3960, 5340, 6960, 8340, 9960, 11340, 12960],
  );

  const frostVolley =
    ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.FROST_VOLLEY];
  assert.ok(
    frostVolley.effects[0].ticks.every(
      (tick) => tick.comboFinishers[0].finisherType === "Projectile",
    ),
  );

  const volcano =
    ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.VOLCANO];
  assert.deepEqual(
    volcano.effects[0].ticks.map((tick) => tick.coefficient),
    [
      1.21, 1.089, 0.968, 0.847, 0.726, 0.605, 0.484, 0.363, 0.242, 0.121, 0.05,
      0.05,
    ],
  );
});

test("Elementalist trait and specialization IDs follow the API snapshot", () => {
  const apiTraits = API_SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]);

  assert.deepEqual(
    TRAITS.map((trait) => trait.id),
    apiTraits.map((trait) => trait.id),
  );
  assert.deepEqual(
    new Set(Object.values(ELEMENTALIST_TRAIT_IDS)),
    new Set(apiTraits.map((trait) => trait.id)),
  );
  assert.deepEqual(
    new Set(Object.values(ELEMENTALIST_SPECIALIZATION_IDS)),
    new Set(API_SPECIALIZATIONS.map((specialization) => specialization.id)),
  );
  for (const trait of TRAITS) {
    assert.equal("stats" in trait, false, trait.name);
    assert.equal("durations" in trait, false, trait.name);
    assert.equal("criticalChance" in trait, false, trait.name);
  }
});
