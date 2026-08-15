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
  assert.equal(owners.size, 284);
  const declaredIds = new Set(Object.values(ELEMENTALIST_SKILL_IDS));
  for (const skillId of owners.keys()) {
    assert.equal(declaredIds.has(Number(skillId)), true, skillId);
  }
});

test("Glyph of Elementals delegates all damage to the summoned actor", () => {
  const glyph =
    ELEMENTALIST_CORE_SKILL_MECHANICS[
      ELEMENTALIST_SKILL_IDS.GLYPH_OF_ELEMENTALS
    ];
  assert.deepEqual(glyph.effects, []);
  assert.equal(Object.hasOwn(glyph, "referenceEffects"), false);
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
