import assert from 'node:assert/strict';
import test from 'node:test';
import { spendAntiquaryInitiative } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Exercise the real shield grant, then isolate spending from regeneration to check finite refund entitlement.
test('Chak Shield refunds three paid weapon uses and preserves charges for free or nonweapon inputs', () => {
  const result = runThief(['Skritt Swipe', 'Chak Shield'], { specialization: 'Antiquary' });
  assert.deepEqual(result.warnings, []);
  const owner = observedRuntime(result);
  const refunds = [];
  const runtime = {
    helpers: owner.mechanics.helpers,
    traits: owner.mechanics.traits,
    profession: owner.mechanics.profession,
    time: owner.time,
    combatStartedAt: owner.combatStartedAt,
    resourceController: { grant: (resource, amount) => refunds.push([resource, amount]) }
  };
  const state = runtime.profession.specialization.state;
  assert.equal(state.chakInitiativeRefunds[0].charges, 3);
  spendAntiquaryInitiative(runtime, { skill: { type: 'Weapon', initiativeCost: 0 } });
  spendAntiquaryInitiative(runtime, { skill: { type: 'Profession', initiativeCost: 2 } });
  assert.equal(state.chakInitiativeRefunds[0].charges, 3);
  for (let use = 0; use < 4; use++) {
    spendAntiquaryInitiative(runtime, { skill: { type: 'Weapon', initiativeCost: 4 } });
  }

  assert.deepEqual(refunds, [
    ['initiative', 4],
    ['initiative', 4],
    ['initiative', 4]
  ]);
  assert.deepEqual(state.chakInitiativeRefunds, []);
});

// Recasts add up to four total charges; independent expiry prevents repeated shielding from refreshing old refunds.
test('Chak Shield caps stacked refunds at four and expired grants cannot fund weapon skills', () => {
  const result = runThief(
    ['Skritt Swipe', 'Chak Shield', 'Chak Shield', 'Chak Shield'],
    {
      specialization: 'Antiquary',
      selectedTraitIds: [TRAIT.METICULOUS_CUSTODIAN]
    },
    {
      extend(native) {
        return {
          onCastCommit(runtime, cast) {
            native.onCastCommit?.(runtime, cast);
            // Supply a fresh independently pilfered pool for the second shield without advancing the clock.
            if (cast.skill.id === 76816) {
              const state = runtime.profession.specialization.state;
              state.artifactSlots.push({ kind: 'defensive', skillId: 76816 });
              state.artifactUsesRemaining = 1;
            }
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const owner = observedRuntime(result);
  const refunds = [];
  const runtime = {
    helpers: owner.mechanics.helpers,
    traits: owner.mechanics.traits,
    profession: owner.mechanics.profession,
    time: owner.time,
    combatStartedAt: owner.combatStartedAt,
    resourceController: { grant: (...args) => refunds.push(args) }
  };
  const state = runtime.profession.specialization.state;
  assert.equal(
    state.chakInitiativeRefunds.reduce((sum, grant) => sum + grant.charges, 0),
    4
  );
  for (const grant of state.chakInitiativeRefunds) grant.expiresAt = runtime.time;
  spendAntiquaryInitiative(runtime, { skill: { type: 'Weapon', initiativeCost: 4 } });
  assert.deepEqual(refunds, []);
});
