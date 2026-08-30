import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { WEAPON_DATA } from '#gw2/platform/equipment/weapons/data.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import {
  WEAPON_STRENGTH_PROFILES,
  sampleWeaponStrength,
  weaponStrengthHalfRange,
  weaponStrengthMidpoint,
  weaponStrengthProfile,
  weaponStrengthProfileForName,
  weaponStrengthProfileIdForEvent
} from '#gw2/platform/equipment/weapons/strength.js';

const EXPECTED_PROFILES = Object.freeze({
  'weapon.axe': [900, 1100, 1000],
  'weapon.dagger': [970, 1030, 1000],
  'weapon.mace': [940, 1060, 1000],
  'weapon.pistol': [920, 1080, 1000],
  'weapon.scepter': [940, 1060, 1000],
  'weapon.sword': [950, 1050, 1000],
  'weapon.focus': [873, 927, 900],
  'weapon.shield': [846, 954, 900],
  'weapon.torch': [828, 972, 900],
  'weapon.warhorn': [855, 945, 900],
  'weapon.greatsword': [1045, 1155, 1100],
  'weapon.hammer': [1034, 1166, 1100],
  'weapon.longbow': [966, 1134, 1050],
  'weapon.rifle': [1035, 1265, 1150],
  'weapon.shortbow': [950, 1050, 1000],
  'weapon.spear': [950, 1050, 1000],
  'weapon.staff': [1034, 1166, 1100],
  'nonweapon.unequipped': [656, 725, 690.5],
  'nonweapon.profession-mechanic': [1034, 1166, 1100],
  'summon.weapon-type-1': [2427, 2680, 2553.5],
  'summon.weapon-type-2': [2706, 3050, 2878],
  'summon.weapon-type-3': [2448, 3050, 2749],
  'bundle.ascended': [920, 1017, 968.5],
  'transform.radiant-forge': [954, 1076, 1015],
  'transform.rampage': [726, 819, 772.5],
  'transform.photon-forge': [954, 1076, 1015],
  'transform.celestial-avatar': [580, 654, 617],
  'transform.cyclone-bow': [954, 1076, 1015],
  'transform.shadow-shroud': [1002, 1129, 1065.5],
  'transform.lich-form': [726, 819, 772.5],
  'transform.death-shroud': [1034, 1166, 1100],
  'transform.reaper-shroud': [1002, 1129, 1065.5],
  'transform.harbinger-shroud': [1034, 1166, 1100],
  'transform.ritualist-shroud': [1034, 1166, 1100]
});

test('canonical weapon-strength bounds derive every documented midpoint', () => {
  assert.deepEqual(Object.keys(WEAPON_STRENGTH_PROFILES).sort(), Object.keys(EXPECTED_PROFILES).sort());
  for (const [id, [min, max, midpoint]] of Object.entries(EXPECTED_PROFILES)) {
    const profile = weaponStrengthProfile(id);

    assert.deepEqual(profile, { id, min, max });
    assert.equal(weaponStrengthMidpoint(profile), midpoint);
    assert.equal(weaponStrengthHalfRange(profile), (max - min) / 2);
    assert.equal(Object.isFrozen(profile), true);
  }

  assert.equal(weaponStrengthHalfRange(weaponStrengthProfile('bundle.ascended')), 48.5);
  assert.equal(WEAPON_DATA.Longbow.weaponStrength, 1050);
  assert.equal(WEAPON_DATA.Longbow.weaponStrengthProfileId, 'weapon.longbow');
});

test('profile lookup and continuous sampling validate their inputs', () => {
  assert.equal(weaponStrengthProfileForName('Dagger')?.id, 'weapon.dagger');
  assert.equal(weaponStrengthProfileForName('Profession mechanic')?.id, 'nonweapon.profession-mechanic');
  assert.equal(weaponStrengthProfileForName('Gunsaber')?.id, 'bundle.ascended');
  assert.equal(weaponStrengthProfileForName('unknown'), null);
  assert.throws(() => weaponStrengthProfile('weapon.unknown'), /Unknown/);
  const rifle = weaponStrengthProfile('weapon.rifle');

  assert.equal(sampleWeaponStrength(rifle, 0), rifle.min);
  assert.ok(sampleWeaponStrength(rifle, 0.999999) < rifle.max);
  assert.throws(() => sampleWeaponStrength(rifle, 1), /\[0, 1\)/);
});

test('skill metadata classifies transforms, kits, shrouds, and effects', () => {
  const event = {
    type: 'damage',
    at: 0,
    source: 'player',
    sourceId: 1,
    actorType: 'player',
    coefficient: 1
  };

  assert.equal(
    weaponStrengthProfileIdForEvent(event, {
      skill: { id: 1, name: 'Kit', kit: 'Grenade Kit' }
    }),
    'bundle.ascended'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent(event, {
      skill: { id: 1, name: 'Forge', forgeSkill: true }
    }),
    'transform.photon-forge'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent(event, {
      skill: {
        id: 1,
        name: 'Radiant Hammer',
        radiantForgeSkill: true,
        radiantWeapon: 'hammer'
      }
    }),
    'transform.radiant-forge'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent(
      { ...event, radiantWeapon: 'blade' },
      {
        skill: { id: 1, name: 'Glaring Burst', radiantForgeSkill: true }
      }
    ),
    'transform.radiant-forge'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent(event, {
      skill: {
        id: 1,
        name: 'Radiant Shield',
        radiantForgeSkill: true,
        radiantWeapon: 'bulwark'
      }
    }),
    'transform.radiant-forge'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent(event, {
      skill: { id: 1, name: 'Cyclone Bow', cycloneBowSkill: true }
    }),
    'transform.cyclone-bow'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent(event, {
      skill: { id: 1, name: 'Shroud', shroud: 'reaper' }
    }),
    'transform.reaper-shroud'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent(
      { ...event, weaponStrengthSource: 'equipped' },
      {
        skill: { id: 1, name: 'Stolen Skill', type: 'Profession' },
        state: { activeWeaponSet: 2 },
        config: {
          primaryWeapon: 'Dagger',
          weaponSet2Primary: 'Rifle'
        }
      }
    ),
    'weapon.rifle'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent({
      ...event,
      source: 'Trait',
      actorType: 'effect'
    }),
    'nonweapon.unequipped'
  );
});

function fixtureProfession() {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 990001,
        name: 'Dagger Flurry',
        type: 'Weapon',
        weapon: 'Dagger',
        castTimeMs: 300,
        cooldown: 0,
        effects: [
          {
            type: 'strike',
            coefficient: 3,
            hits: 3,
            atMs: 100,
            intervalMs: 100,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ],
    weapons: ['Dagger'],
    weaponHands: { Dagger: 'mh+oh' }
  });

  return defineProfession({
    id: 'weapon-strength-fixture',
    name: 'Weapon Strength Fixture',
    catalog
  });
}

function simulateFixture(mode, seed = 1, casts = 1) {
  return simulateGw2({
    profession: fixtureProfession(),
    rotation: Array.from({ length: casts }, () => 'Dagger Flurry'),
    config: {
      primaryWeapon: 'Dagger',
      stats: {
        power: 1000,
        precision: 0,
        ferocity: 0,
        conditionDamage: 0
      },
      target: { armor: 2597 },
      randomness: { mode, seed }
    }
  });
}

test('deterministic strikes expose the exact profile midpoint', () => {
  const result = simulateFixture('deterministic');
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage');

  assert.equal(hits.length, 3);
  assert.equal(new Set(hits.map((event) => event.activationId)).size, 1);
  assert.deepEqual([...new Set(hits.map((event) => event.resolvedWeaponStrength))], [1000]);
  assert.ok(
    hits.every((event) => event.weaponStrengthProfileId === 'weapon.dagger' && event.weaponStrengthSampled === false)
  );
});

test('stochastic casts share one roll per activation and reroll per cast', () => {
  const seed = 2468;
  const result = simulateFixture('stochastic', seed, 2);
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage');
  const byActivation = new Map();

  for (const hit of hits) {
    const activationHits = byActivation.get(hit.activationId) || [];

    activationHits.push(hit);
    byActivation.set(hit.activationId, activationHits);
  }

  assert.equal(byActivation.size, 2);

  const expectedRandom = createSimulationRandom({
    mode: 'stochastic',
    seed
  });
  const dagger = weaponStrengthProfile('weapon.dagger');
  const expected = [
    sampleWeaponStrength(dagger, expectedRandom.next('weapon-strength:player')),
    sampleWeaponStrength(dagger, expectedRandom.next('weapon-strength:player'))
  ];

  assert.deepEqual(
    [...byActivation.values()].map((activationHits) => {
      assert.equal(activationHits.length, 3);
      assert.equal(new Set(activationHits.map((event) => event.resolvedWeaponStrength)).size, 1);
      assert.ok(activationHits.every((event) => event.weaponStrengthSampled === true));

      return activationHits[0].resolvedWeaponStrength;
    }),
    expected
  );
});

test('weapon-strength draws do not advance critical or trait streams', () => {
  const seed = 42;
  const withStrength = createSimulationRandom({ mode: 'stochastic', seed });

  withStrength.next('weapon-strength:player');
  withStrength.next('weapon-strength:effect');
  const criticalAfterStrength = withStrength.next('critical:player');

  const isolated = createSimulationRandom({ mode: 'stochastic', seed });

  assert.equal(criticalAfterStrength, isolated.next('critical:player'));

  const withTrait = createSimulationRandom({ mode: 'stochastic', seed });

  withTrait.next('engineer.shrapnel');
  assert.equal(
    withTrait.next('weapon-strength:player'),
    createSimulationRandom({ mode: 'stochastic', seed }).next('weapon-strength:player')
  );
});

test('explicit fixed strength remains exempt from stochastic sampling', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 990002,
        name: 'Fixed Strike',
        type: 'Utility',
        castTimeMs: 0,
        effects: [
          {
            type: 'strike',
            coefficient: 1,
            weaponStrength: 777
          }
        ]
      }
    ]
  });
  const result = simulateGw2({
    profession: defineProfession({
      id: 'fixed-strength-fixture',
      name: 'Fixed Strength Fixture',
      catalog
    }),
    rotation: ['Fixed Strike'],
    config: { randomness: { mode: 'stochastic', seed: 9 } }
  });
  const hit = result.resolvedEvents.find((event) => event.type === 'damage');

  assert.equal(hit.weaponStrengthProfileId, 'fixed');
  assert.equal(hit.resolvedWeaponStrength, 777);
  assert.equal(hit.weaponStrengthSampled, false);
});
