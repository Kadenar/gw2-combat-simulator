import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';

const hits = (result, skillId) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);

// Projectile traits follow impacts even when no field exists to complete the projectile's combo attempt.
test('shortbow projectiles trigger Mistral and Shrike independently of combo success', () => {
  const result = runRanger(['Mistral', 'Crossfire'], {
    specialization: 'Galeshot',
    primaryWeapon: 'Shortbow',
    selectedTraitIds: [TRAIT.SHRIKE]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(hits(result, ID.CROSSFIRE)[0].projectile, true);
  assert.equal(hits(result, ID.MISTRAL).length, 1);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
  assert.equal(galeshotState.from(observedRuntime(result)).missileHits, 1);
});

// Sigil missiles retain effect ownership while participating in projectile reactions; other sigil strikes do not.
test('Mischief snowballs trigger Mistral and advance Shrike', () => {
  for (const sigil of ['Mischief', 'Hydromancy']) {
    const result = runRanger(['__combat_start', 'Mistral', 'Swap Weapons', { type: 'wait', durationMs: 100 }], {
      specialization: 'Galeshot',
      primaryWeapon: 'Shortbow',
      weaponSet2Primary: 'Longbow',
      selectedTraitIds: [TRAIT.SHRIKE],
      sigilSets: [{ names: [] }, { names: [sigil] }]
    });
    assert.deepEqual(result.warnings, []);
    const strike = result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillName === `Sigil of ${sigil}`
    );
    assert.ok(strike);
    assert.equal(strike.actorType, 'effect');
    assert.equal(strike.ownerActorType, 'player');
    assert.equal(strike.projectile, sigil === 'Mischief');
    const mistral = hits(result, ID.MISTRAL);
    assert.equal(mistral.length, sigil === 'Mischief' ? 1 : 0);
    assert.equal(galeshotState.from(observedRuntime(result)).missileHits, sigil === 'Mischief' ? 1 : 0);
    if (sigil === 'Mischief') {
      assert.equal(mistral[0].triggeredBy, strike.skillName);
      assert.equal(mistral[0].at, strike.at);
    }
  }
});

// Effect eligibility must not admit summoned projectiles or effects without explicit player ownership.
test('Galeshot projectile reactions reject pets and unowned effects', () => {
  const result = runRanger(
    ['Mistral', { type: 'wait', durationMs: 1500 }],
    { specialization: 'Galeshot', selectedTraitIds: [TRAIT.SHRIKE] },
    {
      initialize(runtime) {
        for (const ownership of [{ actorType: 'summon', ownerActorType: 'player' }, { actorType: 'effect' }]) {
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at: 1,
              source: 'Test',
              sourceId: 'test.non-player-projectile',
              skillName: 'Non-player projectile',
              coefficient: 0.15,
              // Synthetic projectiles have no catalog skill from which to resolve weapon strength.
              weaponStrength: 1000,
              projectile: true,
              ...ownership
            }
          });
        }
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.resolvedEvents.filter((event) => event.skillName === 'Non-player projectile').length, 2);
  assert.equal(hits(result, ID.MISTRAL).length, 0);
  assert.equal(galeshotState.from(observedRuntime(result)).missileHits, 0);
});

// Expiry between contacts must retain only this axe's enhancement, including across a weapon swap.
test('both Path of Scars variants retain Mistral on return without enhancing later projectiles', () => {
  for (const skillId of [ID.PATH_OF_SCARS, ID.PATH_OF_SCARS_MAX_RANGE]) {
    const result = runRanger(
      [
        skillId,
        'Swap Weapons',
        { type: 'wait', durationMs: 2000 },
        'Crossfire',
        { type: 'wait', durationMs: 15000 },
        'Swap Weapons',
        skillId,
        { type: 'wait', durationMs: 2000 }
      ],
      {
        specialization: 'Galeshot',
        primaryWeapon: 'Axe',
        secondaryWeapon: 'Axe',
        weaponSet2Primary: 'Shortbow',
        weaponSet2Secondary: '',
        selectedTraitIds: [TRAIT.SHRIKE]
      },
      {
        initialize(runtime) {
          galeshotState.from(runtime).mistralUntil = 0.44;
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const contacts = hits(result, skillId);
    const procs = hits(result, ID.MISTRAL);
    assert.equal(contacts.length, 4);
    assert.equal(procs.length, 2);
    assert.equal(procs[0].at, contacts[0].at);
    assert.equal(procs[1].at, contacts[1].at);
    assert.equal(hits(result, ID.CROSSFIRE).length, 1);
    const state = galeshotState.from(observedRuntime(result));
    assert.deepEqual(state.mistralPathOfScars, {});
    assert.equal(state.missileHits, 5);
  }
});
