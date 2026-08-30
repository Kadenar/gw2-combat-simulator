import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { composeSkillMechanics } from '../../helpers/skill-mechanics.js';
import { elementalistCoreModule } from '../../../js/games/gw2/content/professions/elementalist/core/module.js';
import { ELEMENTALIST_CORE_SKILL_MECHANICS } from '../../../js/games/gw2/content/professions/elementalist/core/skills/index.js';
import {
  ELEMENTALIST_SKILL_IDS,
  ELEMENTALIST_SPECIALIZATION_IDS,
  ELEMENTALIST_TRAIT_IDS
} from '../../../js/games/gw2/content/professions/elementalist/data/ids.js';
import { SPECIALIZATIONS as API_SPECIALIZATIONS } from '../../../js/games/gw2/content/professions/elementalist/data/elementalist-api-metadata.js';
import { TRAITS } from '../../../js/games/gw2/content/professions/elementalist/data/traits-data.js';
import { catalystModule } from '../../../js/games/gw2/content/professions/elementalist/specializations/catalyst/module.js';
import { CATALYST_JADE_SPHERE_EFFECTS } from '../../../js/games/gw2/content/professions/elementalist/specializations/catalyst/mechanics/jade-sphere-effects.js';
import { CATALYST_SKILL_MECHANICS } from '../../../js/games/gw2/content/professions/elementalist/specializations/catalyst/skills/index.js';
import { evokerModule } from '../../../js/games/gw2/content/professions/elementalist/specializations/evoker/module.js';
import {
  EVOKER_BALANCE_PROFILE_IDS,
  EVOKER_BALANCE_PROFILES
} from '../../../js/games/gw2/content/professions/elementalist/specializations/evoker/profiles.js';
import { EVOKER_SKILL_MECHANICS } from '../../../js/games/gw2/content/professions/elementalist/specializations/evoker/skills/index.js';
import { tempestModule } from '../../../js/games/gw2/content/professions/elementalist/specializations/tempest/module.js';
import { TEMPEST_OVERLOAD_EFFECTS } from '../../../js/games/gw2/content/professions/elementalist/specializations/tempest/mechanics/overload-effects.js';
import { TEMPEST_SKILL_MECHANICS } from '../../../js/games/gw2/content/professions/elementalist/specializations/tempest/skills/index.js';
import { weaverModule } from '../../../js/games/gw2/content/professions/elementalist/specializations/weaver/module.js';
import { WEAVER_SKILL_MECHANICS } from '../../../js/games/gw2/content/professions/elementalist/specializations/weaver/skills/index.js';

const slices = [
  ['core', elementalistCoreModule, ELEMENTALIST_CORE_SKILL_MECHANICS],
  ['specializations/tempest', tempestModule, TEMPEST_SKILL_MECHANICS],
  ['specializations/weaver', weaverModule, WEAVER_SKILL_MECHANICS],
  ['specializations/catalyst', catalystModule, CATALYST_SKILL_MECHANICS],
  ['specializations/evoker', evokerModule, EVOKER_SKILL_MECHANICS]
];

const ELEMENTALIST_SKILL_MECHANICS = composeSkillMechanics(
  'Elementalist',
  slices.map(([, , mechanics]) => mechanics)
);

const weaponFragmentOwners = [
  ['core', ELEMENTALIST_CORE_SKILL_MECHANICS],
  ['specializations/weaver', WEAVER_SKILL_MECHANICS]
];

function weaponSlug(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Loads every owner-local weapon fragment so the aggregate contract proves a disjoint, no-loss composition.
async function weaponFragments(directory) {
  const sourceDirectory = new URL(
    `../../../js/games/gw2/content/professions/elementalist/${directory}/skills/weapons/`,
    import.meta.url
  );
  return Promise.all(
    readdirSync(sourceDirectory)
      .filter((filename) => filename.endsWith('.ts'))
      .sort()
      .map(async (filename) => {
        const source = readFileSync(new URL(filename, sourceDirectory), 'utf8');
        assert.match(source, /ELEMENTALIST_SKILL_IDS\s+as\s+ID/);
        assert.doesNotMatch(source, /^\s*["']?-?\d+["']?\s*:/m);
        const module = await import(new URL(filename.replace(/\.ts$/, '.js'), sourceDirectory));
        const exports = Object.entries(module).filter(([name]) => name.endsWith('_SKILL_MECHANICS'));
        assert.equal(exports.length, 1, `${directory}/${filename}`);
        return [filename.replace(/\.ts$/, ''), exports[0][1]];
      })
  );
}

test('Elementalist skill mechanics have disjoint module ownership', () => {
  assert.equal(
    existsSync(
      new URL('../../../js/games/gw2/content/professions/elementalist/data/native-skill-data.ts', import.meta.url)
    ),
    false
  );

  const owners = new Map();

  for (const [directory, module, mechanics] of slices) {
    const source = readFileSync(
      new URL(`../../../js/games/gw2/content/professions/elementalist/${directory}/skills/index.ts`, import.meta.url),
      'utf8'
    );

    assert.match(source, /ELEMENTALIST_SKILL_IDS\s+as\s+ID/);
    assert.doesNotMatch(source, /^\s*["']?-?\d+["']?\s*:/m);
    assert.doesNotMatch(source, /\b(?:id|skillId|nextChainId|flipParentId|flipChildId)\s*:\s*-?\d+/);

    assert.deepEqual(Object.keys(module.data.skillMechanics).sort(), Object.keys(mechanics).sort(), directory);
    for (const skillId of Object.keys(mechanics)) {
      assert.equal(owners.has(skillId), false, skillId);
      owners.set(skillId, module.id);
    }
  }

  assert.deepEqual(
    [...owners.keys()].sort((left, right) => Number(left) - Number(right)),
    Object.keys(ELEMENTALIST_SKILL_MECHANICS).sort((left, right) => Number(left) - Number(right))
  );
  assert.equal(owners.size, 285);
  const declaredIds = new Set(Object.values(ELEMENTALIST_SKILL_IDS));

  for (const skillId of owners.keys()) {
    assert.equal(declaredIds.has(Number(skillId)), true, skillId);
  }
});

test('Elementalist weapon skill fragments compose without duplicates or omissions', async () => {
  for (const [directory, aggregate] of weaponFragmentOwners) {
    const owners = new Map();
    for (const [filename, mechanics] of await weaponFragments(directory)) {
      for (const [skillId, skill] of Object.entries(mechanics)) {
        assert.equal(skill.type, 'Weapon', `${directory}/${filename}:${skillId}`);
        assert.equal(weaponSlug(skill.weapon), filename, `${directory}/${filename}:${skillId}`);
        assert.equal(owners.has(skillId), false, `${directory}:${skillId}`);
        assert.equal(aggregate[skillId], skill, `${directory}:${skillId}`);
        owners.set(skillId, filename);
      }
    }

    const aggregateWeaponIds = Object.entries(aggregate)
      .filter(([, skill]) => skill.type === 'Weapon' && skill.weapon)
      .map(([skillId]) => skillId)
      .sort((left, right) => Number(left) - Number(right));
    assert.deepEqual(
      [...owners.keys()].sort((left, right) => Number(left) - Number(right)),
      aggregateWeaponIds
    );
  }
});

test('Glyph of Elementals delegates all damage to the summoned actor', () => {
  for (const skillId of [
    ELEMENTALIST_SKILL_IDS.GLYPH_OF_ELEMENTALS,
    ELEMENTALIST_SKILL_IDS.GLYPH_OF_ELEMENTALS_EARTH
  ]) {
    const glyph = ELEMENTALIST_CORE_SKILL_MECHANICS[skillId];

    assert.deepEqual(glyph.effects, []);
    assert.equal(Object.hasOwn(glyph, 'referenceEffects'), false);
  }
});

test('Catalyst spheres and Tempest overloads delegate repeated packets to maps', () => {
  for (const skillId of [
    ELEMENTALIST_SKILL_IDS.DEPLOY_JADE_SPHERE_FIRE,
    ELEMENTALIST_SKILL_IDS.DEPLOY_JADE_SPHERE_WATER,
    ELEMENTALIST_SKILL_IDS.DEPLOY_JADE_SPHERE_AIR,
    ELEMENTALIST_SKILL_IDS.DEPLOY_JADE_SPHERE_EARTH
  ]) {
    assert.equal(CATALYST_SKILL_MECHANICS[skillId].effects, CATALYST_JADE_SPHERE_EFFECTS[skillId]);
  }

  for (const skillId of [
    ELEMENTALIST_SKILL_IDS.OVERLOAD_FIRE,
    ELEMENTALIST_SKILL_IDS.OVERLOAD_WATER,
    ELEMENTALIST_SKILL_IDS.OVERLOAD_AIR,
    ELEMENTALIST_SKILL_IDS.OVERLOAD_EARTH
  ]) {
    assert.equal(TEMPEST_SKILL_MECHANICS[skillId].effects, TEMPEST_OVERLOAD_EFFECTS[skillId]);
  }
});

test('Lightning Blitz uses a flat 0.28 coefficient', () => {
  const lightningBlitz = EVOKER_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.LIGHTNING_BLITZ];

  assert.deepEqual(
    lightningBlitz.effects[0].ticks.map((tick) => tick.coefficient),
    [0.28, 0.28, 0.28, 0.28, 0.28]
  );
});

test('Specialized Elements models percentage recharge changes as multipliers', () => {
  const profiles = new Map(EVOKER_BALANCE_PROFILES.map((profile) => [profile.id, profile]));
  const trait = profiles.get(EVOKER_BALANCE_PROFILE_IDS.specializedElements);
  const basic = profiles.get(EVOKER_BALANCE_PROFILE_IDS.specializedElementsBasicRecharge);
  const empowered = profiles.get(EVOKER_BALANCE_PROFILE_IDS.specializedElementsEmpoweredRecharge);

  assert.equal(Object.hasOwn(trait, 'rechargeReduction'), false);
  assert.equal(basic.rechargeMultiplier, 0.9);
  assert.equal(empowered.rechargeMultiplier, 0.67);
});

// Declaration-level timing assertions use the authored Quickness timeline; scheduler tests cover runtime projection.
test('Arc Lightning models its three coefficient stages across ten attacks', () => {
  const arcLightning = ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.ARC_LIGHTNING];

  assert.equal(arcLightning.effects.length, 1);
  assert.deepEqual(
    arcLightning.effects[0].ticks.map(({ atMs, coefficient }) => [atMs, coefficient]),
    [
      [440, 0.35],
      [680, 0.35],
      [960, 0.35],
      [1200, 0.4],
      [1440, 0.4],
      [1720, 0.4],
      [1960, 0.45],
      [2200, 0.45],
      [2480, 0.45],
      [2720, 0.45]
    ]
  );
});

test("Drake's Breath models strikes and burning as parallel tick sequences", () => {
  const drakesBreath = ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.DRAKES_BREATH];

  assert.equal(drakesBreath.effects.length, 2);
  assert.deepEqual(
    drakesBreath.effects.map((effect) => effect.ticks.map((tick) => tick.atMs)),
    [
      [520, 760, 1000, 1240],
      [520, 760, 1000, 1240]
    ]
  );
  assert.deepEqual(
    drakesBreath.effects[0].ticks.map((tick) => tick.coefficient),
    [1.05, 1.05, 1.05, 1.05]
  );
  assert.ok(
    drakesBreath.effects[1].ticks.every(
      (tick) => tick.condition === 'Burning' && tick.stacks === 1 && tick.duration === 4
    )
  );
});

test('Burning Speed shares its field tick timing across damage and burning', () => {
  const burningSpeed = ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.BURNING_SPEED];
  const fieldTicks = burningSpeed.effects.slice(2);

  assert.deepEqual(
    fieldTicks.map((effect) => effect.ticks.map((tick) => tick.atMs)),
    [
      [160, 1160, 2160, 3160, 4160],
      [160, 1160, 2160, 3160, 4160]
    ]
  );
  assert.ok(fieldTicks[0].ticks.every((tick) => tick.coefficient === 0.2 && tick.metadata.damageKind === 'field-tick'));
  assert.ok(
    fieldTicks[1].ticks.every((tick) => tick.condition === 'Burning' && tick.stacks === 1 && tick.duration === 2)
  );
});

test('Flamewall shares its tick timing across damage and burning', () => {
  const flamewall = ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.FLAMEWALL];
  const expectedOffsets = [560, 1560, 2560, 3560, 4560, 5560, 6560, 7560, 8560];

  assert.deepEqual(
    flamewall.effects.map((effect) => effect.ticks.map((tick) => tick.atMs)),
    [expectedOffsets, expectedOffsets]
  );
  assert.ok(
    flamewall.effects[0].ticks.every((tick) => tick.coefficient === 0.1 && tick.metadata.damageKind === 'field-tick')
  );
  assert.ok(
    flamewall.effects[1].ticks.every(
      (tick) => tick.condition === 'Burning' && tick.stacks === 1 && tick.duration === 2.5
    )
  );
});

test('Core repeated packets use compact tick sequences', () => {
  const sharedOffsets = [
    [ELEMENTALIST_SKILL_IDS.WILDFIRE, [1560, 2560, 3560, 4560, 5560, 6560, 7560], 2],
    [ELEMENTALIST_SKILL_IDS.DUST_STORM, [1560, 2640, 3560, 4640, 5560, 6640, 7560, 8640], 2],
    [ELEMENTALIST_SKILL_IDS.FROST_VOLLEY, [360, 680, 1000, 1320, 1640], 2],
    [
      ELEMENTALIST_SKILL_IDS.GLYPH_OF_STORMS_FIRE,
      [880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880],
      2
    ],
    [
      ELEMENTALIST_SKILL_IDS.GLYPH_OF_STORMS_EARTH,
      [880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880],
      2
    ],
    [ELEMENTALIST_SKILL_IDS.FIRESTORM, [520, 1520, 2520, 3520, 4520, 5520, 6520, 7520, 8520], 1],
    [ELEMENTALIST_SKILL_IDS.VOLCANO, [1560, 1800, 2120, 2400, 2640, 2920, 3240, 3480, 3760, 4040, 4320, 4640], 1]
  ];

  for (const [skillId, expectedOffsets, expectedSequenceCount] of sharedOffsets) {
    const skill = ELEMENTALIST_CORE_SKILL_MECHANICS[skillId];
    const sequences = skill.effects.filter((effect) => Array.isArray(effect.ticks));

    assert.equal(sequences.length, expectedSequenceCount, skill.name);
    for (const effect of sequences) {
      assert.deepEqual(
        effect.ticks.map((tick) => tick.atMs),
        expectedOffsets,
        skill.name
      );
    }
  }

  const dustStorm = ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.DUST_STORM];

  assert.deepEqual(
    dustStorm.effects.filter((effect) => effect.type === 'blind').map((effect) => effect.atMs),
    [1560, 2640, 3560, 4640, 5560, 6640, 7560, 8640]
  );

  const frostVolley = ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.FROST_VOLLEY];

  assert.ok(frostVolley.effects[0].ticks.every((tick) => tick.comboFinishers[0].finisherType === 'Projectile'));

  const volcano = ELEMENTALIST_CORE_SKILL_MECHANICS[ELEMENTALIST_SKILL_IDS.VOLCANO];

  assert.deepEqual(
    volcano.effects[0].ticks.map((tick) => tick.coefficient),
    [1.21, 1.089, 0.968, 0.847, 0.726, 0.605, 0.484, 0.363, 0.242, 0.121, 0.05, 0.05]
  );
});

test('Elementalist trait and specialization IDs follow the API snapshot', () => {
  const apiTraits = API_SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat()
  ]);

  assert.deepEqual(
    TRAITS.map((trait) => trait.id),
    apiTraits.map((trait) => trait.id)
  );
  assert.deepEqual(new Set(Object.values(ELEMENTALIST_TRAIT_IDS)), new Set(apiTraits.map((trait) => trait.id)));
  assert.deepEqual(
    new Set(Object.values(ELEMENTALIST_SPECIALIZATION_IDS)),
    new Set(API_SPECIALIZATIONS.map((specialization) => specialization.id))
  );
  for (const trait of TRAITS) {
    assert.equal('stats' in trait, false, trait.name);
    assert.equal('durations' in trait, false, trait.name);
    assert.equal('criticalChance' in trait, false, trait.name);
  }
});
