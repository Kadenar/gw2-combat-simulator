import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { resolvedWeaponStrength } from '#gw2/platform/resolver/weapon-strength-resolution.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { WEAPON_DATA } from '#gw2/platform/equipment/weapons/data.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { normalizeEffect } from '#gw2/platform/effects/validation.js';
import { assertSimulationEvent } from '#gw2/platform/events/events.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import {
  WEAPON_STRENGTH_PROFILES,
  sampleWeaponStrength,
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
  'summon.storm-spirit': [2426, 2681, 2553.5],
  'summon.weapon-type-2': [2706, 3050, 2878],
  'summon.weapon-type-3': [2448, 3050, 2749],
  'bundle.exotic': [876, 969, 922.5],
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
    assert.equal(Object.isFrozen(profile), true);
  }

  assert.equal(WEAPON_DATA.Longbow.weaponStrength, 1050);
  assert.equal(WEAPON_DATA.Longbow.weaponStrengthProfileId, 'weapon.longbow');
});

test('profile lookup and continuous sampling validate their inputs', () => {
  assert.equal(weaponStrengthProfileForName('Dagger')?.id, 'weapon.dagger');
  assert.equal(weaponStrengthProfileForName('Profession mechanic')?.id, 'nonweapon.profession-mechanic');
  assert.equal(weaponStrengthProfileForName('Gunsaber'), null);
  assert.equal(weaponStrengthProfileForName('unknown'), null);
  assert.throws(() => weaponStrengthProfile('weapon.unknown'), /Unknown/);
  const rifle = weaponStrengthProfile('weapon.rifle');

  assert.equal(sampleWeaponStrength(rifle, 0), rifle.min);
  assert.ok(sampleWeaponStrength(rifle, 0.999999) < rifle.max);
  assert.throws(() => sampleWeaponStrength(rifle, 1), /\[0, 1\)/);
});

// Explicit effect profiles retain transform ownership independently of skill flags, labels, and later weapon sets.
test('explicit profiles select transforms while ordinary weapons use equipment metadata', () => {
  const event = { type: 'damage', at: 0, source: 'renamed', sourceId: 1, actorType: 'player', coefficient: 1 };
  for (const profile of Object.keys(WEAPON_STRENGTH_PROFILES).filter((id) => /^(transform|bundle)\./.test(id))) {
    assert.equal(
      weaponStrengthProfileIdForEvent(
        { ...event, weaponStrengthProfileId: profile },
        {
          skill: { id: 1, name: 'renamed', weapon: 'Axe' },
          activeWeaponSet: 2,
          config: { weaponSet2Primary: 'Rifle' }
        }
      ),
      profile
    );
  }

  assert.equal(
    weaponStrengthProfileIdForEvent(event, { skill: { id: 1, name: 'Action', type: 'Action' } }),
    'nonweapon.unequipped'
  );
  assert.equal(
    weaponStrengthProfileIdForEvent(
      { ...event, weaponStrengthSource: 'equipped' },
      {
        activeWeaponSet: 2,
        config: { primaryWeapon: 'Axe', weaponSet2Primary: 'Rifle' }
      }
    ),
    'weapon.rifle'
  );
  assert.equal(weaponStrengthProfileIdForEvent({ ...event, actorType: 'effect' }), 'nonweapon.unequipped');
});

// Both authored declarations and procedural packets must reference a registered profile.
test('unknown explicit profiles fail at effect and event boundaries', () => {
  assert.throws(
    () => normalizeEffect({ type: 'strike', coefficient: 1, weaponStrengthProfileId: 'transform.misspelled' }),
    /Unknown weapon-strength profile/
  );
  assert.throws(
    () =>
      assertSimulationEvent({
        type: 'damage',
        at: 0,
        source: 'player',
        sourceId: 1,
        actorType: 'player',
        coefficient: 1,
        weaponStrengthProfileId: 'transform.misspelled'
      }),
    /Unknown weapon-strength profile/
  );
});

// Delayed strikes retain their authored range when the owning skill's bar has changed.
test('materialized transform strikes retain their profile across equipment changes', () => {
  const skill = { id: 1, name: 'Transform attack', weapon: 'Sword' };
  const [application] = materializeSkillEffectApplications({
    skill,
    effect: normalizeEffect({
      type: 'strike',
      coefficient: 1,
      atMs: 1000,
      weaponStrengthProfileId: 'transform.photon-forge'
    }),
    start: 0,
    fullEnd: 1,
    baseEvent: { source: 'player', sourceId: 1, actorType: 'player' }
  });
  assert.equal(application.event.weaponStrengthProfileId, 'transform.photon-forge');
  skill.weapon = 'Rifle';
  assert.equal(
    weaponStrengthProfileIdForEvent(application.event, {
      skill,
      activeWeaponSet: 2,
      config: { weaponSet2Primary: 'Rifle' }
    }),
    'transform.photon-forge'
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
            ticks: [
              { atMs: 100, coefficient: 1 },
              { atMs: 200, coefficient: 1 },
              { atMs: 300, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ],
    weapons: ['Dagger'],
    weaponHands: { Dagger: 'mh+oh' }
  });

  return defineTestProfession({
    id: 'weapon-strength-fixture',
    name: 'Weapon Strength Fixture',
    catalog
  });
}

test('derived proc activations own their strength roll independently of the triggering weapon cast', () => {
  // One multi-packet weapon activation may trigger a different profile without sharing its cached roll.
  const base = fixtureProfession();
  const source = {
    ...base,
    runtimeFor(config) {
      return {
        ...base.runtimeFor(config),
        reactions: {
          'damage.resolved'(runtime, cause) {
            if (cause.actorType !== 'player') return;
            runtime.effects.emit({
              kind: 'packet',
              cause: cause,
              event: {
                type: 'damage',
                at: runtime.time,
                source: 'fixture',
                sourceId: 'trait.proc',
                actorType: 'effect',
                coefficient: 1,
                weaponStrengthProfileId: 'nonweapon.unequipped'
              }
            });
          }
        }
      };
    }
  };
  const options = {
    profession: source,
    rotation: ['Dagger Flurry'],
    config: { randomness: { mode: 'stochastic', seed: 7 } }
  };
  const result = simulateGw2(options);
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage');
  const weapon = hits.filter((event) => event.actorType === 'player');
  const procs = hits.filter((event) => event.actorType === 'effect');
  assert.equal(new Set(weapon.map((event) => event.activationId)).size, 1);
  assert.ok(procs.length > 0);
  assert.ok(procs.every((event) => event.activationId !== weapon[0].activationId));
  assert.equal(result.totalDamage, simulateGw2(options).totalDamage);
  assert.equal(result.totalDamage, simulateGw2({ ...options, output: 'score' }).totalDamage);
});

function simulateFixture(mode, seed = 1, casts = 1, precision = 0, criticalDamageMode) {
  return simulateGw2({
    profession: fixtureProfession(),
    rotation: Array.from({ length: casts }, () => 'Dagger Flurry'),
    config: {
      primaryWeapon: 'Dagger',
      stats: {
        power: 1000,
        precision,
        ferocity: 0,
        conditionDamage: 0
      },
      target: { armor: 2597 },
      criticalDamageMode,
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
    profession: defineTestProfession({
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

test('unprofiled coefficient packets are rejected instead of receiving legacy fixed strength', () => {
  assert.throws(
    () =>
      resolvedWeaponStrength(
        { helpers: {} },
        {
          type: 'damage',
          at: 0,
          source: 'player',
          sourceId: 990003,
          actorType: 'player',
          coefficient: 1
        }
      ),
    /requires a resolvable weapon-strength profile or explicit weaponStrength/
  );
});

// A packet must not acquire another skill's weapon profile through a matching label or producer ID.
test('weapon resolution uses the canonical skill ID when names and sources conflict', () => {
  const sword = { id: 1, name: 'Shared name', weapon: 'Sword' };
  const rifle = { id: 2, name: 'Shared name', weapon: 'Rifle' };
  const context = {
    helpers: {
      skillsById: new Map([
        [1, sword],
        [2, rifle]
      ]),
      skillsByName: new Map([['Shared name', rifle]])
    },
    random: { stochastic: false }
  };
  const event = {
    type: 'damage',
    at: 0,
    actorType: 'player',
    source: 'fixture',
    sourceId: 2,
    skillId: 1,
    skillName: 'Shared name',
    coefficient: 1
  };
  assert.equal(resolvedWeaponStrength(context, event).profileId, 'weapon.sword');
  for (const skillId of [undefined, 99])
    assert.throws(
      () => resolvedWeaponStrength(context, { ...event, skillId }),
      /requires a resolvable weapon-strength profile or explicit weaponStrength/
    );
});

// The reported crit outcome scales damage in both modes without changing weapon-strength sampling.
test('both modes share seeded crit damage outcomes while deterministic strength stays midpoint', () => {
  const run = (mode, seed) =>
    simulateFixture(mode, seed, 10, 1945, 'rolled').resolvedEvents.filter((event) => event.type === 'damage');
  const deterministic = run('deterministic', 42),
    repeat = run('deterministic', 42),
    stochastic = run('stochastic', 42);
  const flags = (hits) => hits.map((hit) => hit.didCrit);
  assert.deepEqual(flags(deterministic), flags(repeat));
  assert.deepEqual(flags(deterministic), flags(stochastic));
  assert.notDeepEqual(flags(deterministic), flags(run('deterministic', 43)));
  assert.equal(new Set(flags(deterministic)).size, 2);
  assert.ok(deterministic.every((hit) => hit.resolvedWeaponStrength === 1000 && !hit.weaponStrengthSampled));
  for (const hit of [...deterministic, ...stochastic]) {
    assert.equal(hit.criticalChance, 0.5);
    assert.equal(hit.damage, Math.floor(((hit.resolvedWeaponStrength * 1000) / 2597) * (hit.didCrit ? 1.5 : 1)));
  }

  assert.deepEqual(
    deterministic.map((hit) => hit.damage),
    repeat.map((hit) => hit.damage)
  );
  assert.equal(new Set(deterministic.map((hit) => hit.damage)).size, 2);
  assert.ok(stochastic.every((hit) => hit.weaponStrengthSampled));
});

// Choosing averaged baseline damage leaves RNG/proc outcomes alone, and cannot disable real crit damage in trials.
test('averaged damage is the deterministic default while stochastic trials always use rolled critical damage', () => {
  const run = (mode, criticalDamageMode) => simulateFixture(mode, 42, 10, 1945, criticalDamageMode);
  const baseline = run('deterministic');
  const averaged = run('deterministic', 'averaged');
  const rolled = run('deterministic', 'rolled');
  assert.equal(baseline.totalDamage, averaged.totalDamage);
  const hits = (result) => result.resolvedEvents.filter((event) => event.type === 'damage');
  assert.deepEqual(
    hits(averaged).map((hit) => hit.didCrit),
    hits(rolled).map((hit) => hit.didCrit)
  );
  assert.equal(new Set(hits(averaged).map((hit) => hit.damage)).size, 1);
  assert.ok(
    hits(averaged).every(
      (hit) => hit.averagedCriticalDamage && hit.damage === Math.floor(((1000 * 1000) / 2597) * 1.25)
    )
  );
  assert.ok(hits(rolled).every((hit) => !hit.averagedCriticalDamage));
  const stochastic = run('stochastic', 'averaged');
  assert.deepEqual(hits(stochastic), hits(run('stochastic', 'rolled')));
  assert.ok(
    hits(stochastic).every(
      (hit) =>
        !hit.averagedCriticalDamage &&
        hit.damage === Math.floor(((hit.resolvedWeaponStrength * 1000) / 2597) * (hit.didCrit ? 1.5 : 1))
    )
  );
  assert.throws(() => run('deterministic', 'invalid'), /Invalid critical damage mode/);
});
