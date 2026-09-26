import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { GUARDIAN_TRAIT_IDS as GUARDIAN_TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { MESMER_TRAIT_IDS as MESMER_TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { NECROMANCER_TRAIT_IDS as NECROMANCER_TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { THIEF_SKILL_IDS as THIEF_ID, THIEF_TRAIT_IDS as THIEF_TRAIT } from '#gw2/professions/thief/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as GUARDIAN_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as NECROMANCER_PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { HARBINGER_BALANCE_PROFILE_IDS as HARBINGER_PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as REVENANT_PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as THIEF_PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as WARRIOR_PROFILE } from '#gw2/professions/warrior/core/profiles.js';

// Exercise authored edits through catalog composition and actual scheduling/resolution.
function run(profession, balanceProfiles, specialization, rotation, config = {}, simulate = simulateGw2) {
  return simulate({
    profession: withPatchPreview(profession, {
      id: 'zero-values',
      label: 'Zero values',
      professions: { [profession.id]: { balanceProfiles } }
    }),
    rotation,
    config: {
      patchId: 'zero-values',
      specialization,
      selectedTraitIds: [],
      stats: { power: 2000, precision: 1000, conditionDamage: 1000, expertise: 0 },
      target: { armor: 2597, defiant: true, conditions: {} },
      ...config
    }
  });
}

// Resolve the patched catalog before live execution so zero-valued profile fields reach their owner.
const runRuntime = ({ profession, config, rotation }) =>
  runGw2Runtime({ profession: profession.runtimeFor(config), config, rotation });
// Observed variant for contracts that read the live owner's state after the run.
const runRuntimeObserved = ({ profession, config, rotation }) =>
  observeGw2Runtime({ profession: profession.runtimeFor(config), config, rotation });

test('Warrior zero Dodge cost does not spend endurance', () => {
  const result = run(
    warriorProfession,
    {
      [WARRIOR_PROFILE.resources]: { fields: { resourceCost: 0 } }
    },
    'Core',
    ['Dodge', 'Dodge', 'Dodge']
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.endurance, 100);
});

test('Guardian zero recharge multiplier makes the trait-adjusted skill immediately reusable', () => {
  const result = run(
    guardianProfession,
    {
      [GUARDIAN_PROFILE.zealousBlade]: { fields: { rechargeMultiplier: 0 } }
    },
    'Core',
    ['Whirling Wrath', 'Whirling Wrath'],
    {
      primaryWeapon: 'Greatsword',
      selectedTraitIds: [GUARDIAN_TRAIT.ZEALOUS_BLADE]
    },
    runRuntime
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[1].start, result.steps[0].end);
});

test('Mesmer rejects zero status duration at the patch boundary', () => {
  // Statuses retain their positive-duration contract; removing a packet uses removeEffects instead.
  assert.throws(
    () =>
      run(
        mesmerProfession,
        {
          [MESMER_TRAIT.ILLUSIONARY_MEMBRANE]: { effects: [{ type: 'buff', duration: 0 }] }
        },
        'Core',
        ['Cry of Frustration', { type: 'wait', durationMs: 1 }],
        {
          initialResource: 1,
          selectedTraitIds: [MESMER_TRAIT.ILLUSIONARY_MEMBRANE]
        }
      ),
    /positive duration/
  );
});

test('Harbinger zero Meltdown coefficient emits no strike damage', () => {
  const result = run(
    necromancerProfession,
    {
      [HARBINGER_PROFILE.cascadingCorruption]: { effects: [{ type: 'strike', coefficient: 0 }] }
    },
    'Harbinger',
    // Keep the observation open for Meltdown's delayed explosion, even when its coefficient is zero.
    ['Elixir of Promise', { type: 'wait', durationMs: 1000 }],
    {
      initialBlight: 5,
      initialCascadingCorruptionStacks: 15,
      selectedSkills: ['Elixir of Promise'],
      selectedTraitIds: [NECROMANCER_TRAIT.CASCADING_CORRUPTION]
    },
    runRuntime
  );
  assert.deepEqual(result.warnings, []);
  const meltdown = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.sourceId === NECROMANCER_TRAIT.CASCADING_CORRUPTION
  );
  assert.ok(meltdown);
  assert.equal(meltdown.coefficient, 0);
  assert.equal(meltdown.damage, 0);
});

test('Revenant zero Vigor regeneration multiplier stops endurance regeneration', () => {
  const result = run(
    revenantProfession,
    {
      [REVENANT_PROFILE.resources]: { fields: { vigorRegenerationMultiplier: 0 } }
    },
    'Core',
    ['Dodge', { type: 'wait', durationMs: 1000 }],
    { boons: { vigor: true } },
    runRuntime
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.endurance, 50);
});

test('Thief zero Quick Pockets gain matches a swap without the trait', () => {
  const rotation = ['Heartseeker', THIEF_ID.SWAP_WEAPONS];
  const config = {
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    alternatePrimaryWeapon: 'Sword',
    alternateSecondaryWeapon: 'Pistol',
    initialInitiative: 6
  };
  const baseline = run(thiefProfession, {}, 'Core', rotation, config, runRuntimeObserved);
  const zero = run(
    thiefProfession,
    {
      [THIEF_PROFILE.quickPockets]: { fields: { resourceGain: 0 } }
    },
    'Core',
    rotation,
    { ...config, selectedTraitIds: [THIEF_TRAIT.QUICK_POCKETS] },
    runRuntimeObserved
  );
  assert.deepEqual(zero.warnings, []);
  // The swap still claims Quick Pockets' cooldown; its zero grant leaves the pool unchanged.
  assert.ok(observedRuntime(zero).profession.core.quickPocketsReadyAt > 0);
  assert.equal(
    observedRuntime(zero).resourceController.value('initiative'),
    observedRuntime(baseline).resourceController.value('initiative')
  );
});

test('Zero periodic intervals disable signet pulses without stalling resource advancement', () => {
  const result = run(
    necromancerProfession,
    {
      [NECROMANCER_PROFILE.signetOfUndeathPassive]: { fields: { pulseInterval: 0 } },
      [NECROMANCER_PROFILE.signetOfVampirismPassive]: { fields: { pulseInterval: 0 } }
    },
    'Core',
    [{ type: 'wait', durationMs: 4000 }],
    {
      initialResource: 0,
      selectedSkills: ['Signet of Undeath', 'Signet of Vampirism']
    },
    runRuntime
  );
  assert.equal(result.planningState.profession.lifeForce.value, 0);
  assert.equal(result.strikeDamage, 0);
});
