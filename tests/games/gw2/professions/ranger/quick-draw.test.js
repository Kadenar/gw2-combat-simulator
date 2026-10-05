import assert from 'node:assert/strict';
import test from 'node:test';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const config = { selectedTraitIds: [TRAIT.QUICK_DRAW], primaryWeapon: 'Greatsword' };

// Queries never reserve the discount; accepted recharge work survives the one-time spend.
test('Quick Draw reserves only one same-time weapon recharge and ignores ineligible skills', () => {
  const runtime = observedRuntime(runRanger([], config));
  const native = rangerProfession.runtimeFor(config);
  const skill = runtime.catalog.skillsByName.get('Maul');
  runtime.time = 4;
  const grant = runtime.profession.core.quickDraw = grantCharges(1, 5);
  for (const ineligible of [{ ...skill, slot: 'Weapon_1' }, { ...skill, type: 'Utility' }]) {
    assert.equal(native.rechargeWork(runtime, ineligible, 10), 10);
    assert.equal(native.reserveRecharge(runtime, ineligible, 10), 10);
    assert.equal(grant.charges, 1);
  }
  const first = native.rechargeWork(runtime, skill, 10);
  assert.ok(Math.abs(first - 3.4) < 1e-9);
  assert.equal(native.rechargeWork(runtime, skill, 10), first);
  assert.equal(grant.charges, 1);
  assert.equal(native.reserveRecharge(runtime, skill, first), first);
  assert.equal(grant.charges, 0);
  assert.equal(native.rechargeWork(runtime, skill, 10), 10);
  assert.equal(native.reserveRecharge(runtime, skill, 10), 10);

  runtime.profession.core.quickDraw = grantCharges(1, 5);
  runtime.time = 5;
  assert.equal(native.rechargeWork(runtime, skill, 10), 10);
  native.reserveRecharge(runtime, skill, 10);
  assert.equal(runtime.profession.core.quickDraw.charges, 1, 'expiry queries do not spend');
});

// Cancellation does not refund a recharge entitlement already reserved at acceptance.
test('a cancelled accepted weapon skill retains its Quick Draw spend', () => {
  let acceptedWork;
  const result = runRanger([{ name: 'Maul', interruptMs: 1 }], config, {
    initialize(runtime) {
      runtime.profession.core.quickDraw = grantCharges(1, 5);
    },
    extend(native) {
      return {
        onCastStart(runtime, cast) {
          native.onCastStart?.(runtime, cast);
          acceptedWork = cast.rechargeWork;
          assert.equal(runtime.profession.core.quickDraw.charges, 0);
        }
      };
    }
  });
  const runtime = observedRuntime(result);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.events.some((event) => event.type === 'action' && event.cancelled));
  assert.equal(acceptedWork, runtime.catalog.skillsByName.get('Maul').cooldown * 0.34);
  assert.equal(runtime.profession.core.quickDraw.charges, 0);
  assert.equal(result.planningState.profession.quickDraw.charges, 0);
  result.planningState.profession.quickDraw.charges = 1;
  assert.equal(runtime.profession.core.quickDraw.charges, 0, 'planning state is detached');
});
