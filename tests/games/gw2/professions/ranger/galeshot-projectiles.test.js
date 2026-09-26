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
    assert.ok(procs[1].at > 0.44);
    assert.equal(hits(result, ID.CROSSFIRE).length, 1);
    const state = galeshotState.from(observedRuntime(result));
    assert.deepEqual(state.mistralPathOfScars, {});
    assert.equal(state.missileHits, 5);
  }
});
