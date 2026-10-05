import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Delivered grants exercise the native recipient owner without a player strike consuming its charges.
function run({ grants = [], end = 2, combatStartTime = 0, rate = 2, health = 0, removed = false, output } = {}) {
  const config = {
    specialization: 'Core',
    selectedTraitIds: [TRAIT.OVERFLOWING_THIRST],
    allies: { count: 2, strikesPerSecond: rate },
    stats: { power: 1000, precision: 1000, vitality: 1000 },
    target: { armor: 2597, health, conditions: {} }
  };
  const native = necromancerProfession.runtimeFor(config);
  return observeGw2Runtime({
    config,
    combatStartTime,
    output,
    rotation: [{ type: 'wait', durationMs: end * 1000 }],
    observation: { kind: 'absolute', endTimeMs: end * 1000 },
    profession: {
      ...native,
      catalog: removed
        ? applyBalanceProfilePatch(native.catalog, {
            balanceProfiles: {
              [TRAIT.OVERFLOWING_THIRST]: { removeEffects: [{ type: 'strike', name: 'Strike' }] }
            }
          })
        : native.catalog,
      initialize(runtime) {
        native.initialize(runtime);
        for (const { at, duration = 10, stacks = 1 } of grants)
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              at,
              source: 'Trait',
              sourceId: TRAIT.OVERFLOWING_THIRST,
              actorType: 'player',
              skillName: 'Taste for Blood grant',
              kind: 'taste-for-blood',
              duration,
              stacks,
              audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 2 }
            }
          });
      }
    }
  });
}

const siphons = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === TRAIT.OVERFLOWING_THIRST);
const grantsOf = (result) => observedRuntime(result).profession.core.tasteForBloodGrants;

// A grant at a pulse boundary arrives after that pulse; exhaustion and empty intervals never restart the clock.
test('Taste for Blood retains its phase across grants and settles same-time opportunities before grants', () => {
  const options = { grants: [{ at: 0.1 }, { at: 1 }], end: 1.5 };
  const result = run(options);
  assert.deepEqual(
    siphons(result).map((event) => event.at),
    [0.5, 0.5, 1.5, 1.5]
  );
  assert.deepEqual(grantsOf(result), { 'ally:1': [], 'ally:2': [] });
  assert.deepEqual(result.warnings, []);
  assert.equal(run({ ...options, output: 'score' }).totalDamage, result.totalDamage);
});

// Exact expiry and removed damage cannot spend a recipient's batch even while the ambient clock keeps running.
test('Taste for Blood allied opportunities preserve charges at expiry and with removed output', () => {
  const expired = run({ grants: [{ at: 0, duration: 0.5 }], end: 1 });
  const removed = run({ grants: [{ at: 0 }], removed: true, end: 1 });
  for (const result of [expired, removed]) {
    assert.equal(siphons(result).length, 0);
    assert.equal(grantsOf(result)['ally:1'][0].charges, 1);
    assert.equal(grantsOf(result)['ally:2'][0].charges, 1);
  }
});

// Explicit combat delays the first opportunity; the implicit path must still allow an allied siphon to open combat.
test('Taste for Blood preserves explicit and implicit combat-start behavior', () => {
  const grants = [{ at: 0, stacks: 3 }];
  const setup = run({ grants, combatStartTime: 2, end: 2 });
  assert.equal(siphons(setup).length, 0);
  assert.equal(grantsOf(setup)['ally:1'][0].charges, 3);
  const started = run({ grants, combatStartTime: 2, end: 2.5 });
  assert.deepEqual(
    siphons(started).map((event) => event.at),
    [2.5, 2.5]
  );
  const implicit = run({ grants, combatStartTime: null, end: 0.5 });
  assert.deepEqual(
    siphons(implicit).map((event) => event.at),
    [0.5, 0.5]
  );
});

// The first lethal cohort can spend at its opportunity, but no later wake may consume surviving batches.
test('Taste for Blood stops allied spending after target death', () => {
  const result = run({ grants: [{ at: 0, stacks: 3 }], health: 1 });
  assert.equal(result.deathTime, 0.5);
  assert.equal(grantsOf(result)['ally:1'][0].charges, 2);
  assert.equal(grantsOf(result)['ally:2'][0].charges, 2);
});

// A fractional stepped cadence includes its last in-window hit and leaves future charges untouched at the horizon.
test('ambient Taste for Blood wakes retain rounding and cannot extend the observation window', () => {
  const result = run({ grants: [{ at: 0, stacks: 5 }], rate: 3, end: 1 });
  assert.deepEqual(
    siphons(result).map((event) => event.at),
    [0.333333, 0.333333, 0.666666, 0.666666, 0.999999, 0.999999]
  );
  assert.equal(observedRuntime(result).time, 1);
  assert.equal(grantsOf(result)['ally:1'][0].charges, 2);
  assert.ok(
    necromancerProfession
      .runtimeFor({ specialization: 'Core' })
      .backgroundTasks.includes('necromancer.allied-opportunity')
  );
});
