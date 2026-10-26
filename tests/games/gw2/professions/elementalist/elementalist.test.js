import { enteredCombat } from '#tests/helpers/engagement.js';
import { createCombatEngagement } from '#gw2/platform/combat/engagement.js';
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  validateElementalistBuild
} from '#gw2/professions/elementalist/build/build.js';
import { elementalistAttunementRechargeDuration } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { elementalistRechargeWork } from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { ELEMENTALIST_CORE_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/index.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { flowStateAttunementReduction } from '#gw2/professions/elementalist/specializations/weaver/traits/attunements.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Training reductions must recognize numeric trait IDs without depending on catalog-name aliases.
test('elemental training reduces only matching weapon recharge with ID-only trait sets', () => {
  for (const [attunement, traitId] of [
    ['Fire', TRAIT.PYROMANCERS_TRAINING],
    ['Air', TRAIT.AEROMANCERS_TRAINING],
    ['Earth', TRAIT.GEOMANCERS_TRAINING],
    ['Water', TRAIT.AQUAMANCERS_TRAINING]
  ]) {
    const context = { helpers: elementalistCatalog, traits: new Set([traitId]) };
    const skill = { id: 'fixture.weapon', type: 'Weapon', attunement };
    assert.equal(elementalistRechargeWork(context, skill, 10), 8, attunement);
    assert.equal(elementalistRechargeWork(context, { ...skill, attunement: 'None' }, 10), 10);
    assert.equal(elementalistRechargeWork(context, { ...skill, type: 'Utility' }, 10), 10);
    // An unselected build is its own fixture; selection never changes on a context already in use.
    const unselected = { helpers: elementalistCatalog, traits: new Set() };
    assert.equal(elementalistRechargeWork(unselected, skill, 10), 10);
  }
});

// Flat Flow State reduction follows Elemental Enchantment's multiplier and precedes Alacrity's recharge rate.
test('attunement recharge applies trait reductions in order and stays free before combat', () => {
  const context = {
    helpers: elementalistCatalog,
    config: { selectedTraitIds: [TRAIT.ELEMENTAL_ENCHANTMENT, TRAIT.FLOW_STATE] },
    engagement: enteredCombat(),
    traits: new Set([TRAIT.ELEMENTAL_ENCHANTMENT, TRAIT.FLOW_STATE]),
    cooldownController: { rate: () => 1.25 }
  };
  const skill = elementalistCatalog.skillsById.get(ID.FIRE_ATTUNEMENT);
  assert.equal(elementalistAttunementRechargeDuration(context, skill, 4, flowStateAttunementReduction(context)), 1.92);
  // Weave Self's two-second base still receives both selected traits: (2 * 0.85 - 1) / 1.25.
  assert.ok(
    Math.abs(elementalistAttunementRechargeDuration(context, skill, 2, flowStateAttunementReduction(context)) - 0.56) <
      1e-12
  );
  context.engagement = createCombatEngagement().query;
  assert.equal(elementalistAttunementRechargeDuration(context, skill, 4, flowStateAttunementReduction(context)), 0);
  assert.equal(elementalistAttunementRechargeDuration(context, skill, 2, flowStateAttunementReduction(context)), 0);
});

test('Elementalist build defaults and canonical builds normalize explicitly', () => {
  const defaults = createElementalistBuildDefaults();

  assert.equal(defaults.profession, 'elementalist');
  assert.equal(defaults.weapons[0], 'Sword');
  assert.deepEqual(defaults.alternateWeapons, ['', '']);
  assert.equal(defaults.startingWeaponSet, 1);
  assert.equal(defaults.assumptions.hitboxSize, 'small');
  assert.equal(validateElementalistBuild(defaults).valid, true);
  assert.equal(elementalistCatalog.skillsById.has(-3), true);

  const migrated = migrateElementalistBuild({
    weapons: ['Scepter', 'Warhorn'],
    specializations: defaults.specializations
  });

  assert.equal(migrated.profession, 'elementalist');
  assert.deepEqual(migrated.weapons, ['Scepter', 'Warhorn']);
  assert.equal(validateElementalistBuild(migrated).valid, true);

  const migratedHitbox = migrateElementalistBuild({ assumptions: { hitboxSize: 'large' } });

  assert.equal(migratedHitbox.assumptions.hitboxSize, 'large');

  const twoSets = migrateElementalistBuild({
    ...defaults,
    alternateWeapons: ['Staff', ''],
    startingWeaponSet: 2
  });

  assert.deepEqual(twoSets.alternateWeapons, ['Staff', '']);
  assert.equal(twoSets.startingWeaponSet, 2);
  assert.equal(validateElementalistBuild(twoSets).valid, true);
  assert.equal(
    validateElementalistBuild({
      ...defaults,
      alternateWeapons: ['Staff', '']
    }).valid,
    true
  );
});

test('Elementalist canonical condition timelines preserve their packet start and applications', () => {
  const frostStorm = ELEMENTALIST_CORE_SKILL_MECHANICS[ID.FROST_STORM];
  const [strike, bleeding] = frostStorm.effects;

  assert.equal(strike.type, 'strike');
  assert.equal(bleeding.type, 'condition');

  // Bleeding skips the opening strike and inherits the hitbox identity of its matching packet.
  assert.equal(bleeding.ticks[0].atMs, strike.ticks[1].atMs);
  assert.deepEqual(bleeding.ticks[0].metadata, strike.ticks[1].metadata);
  assert.deepEqual(
    bleeding.ticks.map(({ atMs }) => atMs),
    strike.ticks.slice(1).map(({ atMs }) => atMs)
  );

  const [hurlStrike, hurlBleeding] = ELEMENTALIST_CORE_SKILL_MECHANICS[ID.HURL].effects;
  assert.equal(ELEMENTALIST_CORE_SKILL_MECHANICS[ID.HURL].effects.length, 2);
  assert.equal(hurlStrike.type, 'strike');
  assert.equal(hurlBleeding.type, 'condition');

  assert.deepEqual(
    hurlStrike.ticks.map(({ atMs }) => atMs),
    hurlBleeding.ticks.map(({ atMs }) => atMs)
  );
  assert.equal(
    hurlStrike.ticks.every(({ comboFinishers }) => comboFinishers?.[0]?.finisherType === 'Projectile'),
    true
  );
});

test('Elementalist canonical strike timelines retain per-packet combat metadata', () => {
  const fieryWhirl = ELEMENTALIST_CORE_SKILL_MECHANICS[ID.FIERY_WHIRL];
  const strike = fieryWhirl.effects[0];

  assert.equal(strike.type, 'strike');
  assert.deepEqual(strike.comboFinishers, [
    {
      ownerId: 'elementalist',
      finisherType: 'Whirl'
    }
  ]);

  assert.deepEqual(
    strike.ticks.map(({ atMs }) => atMs),
    fieryWhirl.effects[1].ticks.map(({ atMs }) => atMs)
  );
});

// Every hitbox's strike must precede its companion condition, even when all impacts share a timestamp.
test('Elementalist canonical timelines pair strikes and conditions in hitbox order', () => {
  const skill = elementalistCatalog.skillsById.get(ID.GLYPH_OF_STORMS_AIR);
  const firstStrike = skill.effects.find((effect) => effect.type === 'strike');
  const atMs = firstStrike.ticks[0].atMs;
  const packets = skill.effects.flatMap((effect) =>
    (effect.ticks ?? [effect])
      .filter((tick) => tick.atMs === atMs)
      .map((tick) => [effect.type, tick.metadata.hitboxIndex, tick.condition ?? null])
  );
  const hitboxes = packets.filter(([type]) => type === 'strike').map(([, index]) => index);
  assert.ok(hitboxes.length > 0);
  assert.deepEqual(
    hitboxes,
    [...hitboxes].sort((left, right) => left - right)
  );
  assert.deepEqual(
    packets,
    hitboxes.flatMap((index) => [
      ['strike', index, null],
      ['condition', index, 'Vulnerability']
    ])
  );
});
