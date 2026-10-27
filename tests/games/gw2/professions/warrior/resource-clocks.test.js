import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { warriorBurstTier } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_TRAIT_IDS as TRAIT, WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

/** Patch invocation catalogs directly so simultaneous runs exercise the selected policy before initialization hooks. */
function run(config, rotation = [], profiles = {}, skills = {}) {
  const native = warriorProfession.runtimeFor(config);
  const profileCatalog = Object.entries(profiles).reduce(
    (current, [id, fields]) => withProfile(current, Number.isNaN(Number(id)) ? id : Number(id), fields),
    native.catalog
  );
  // Intrinsic stance tuning is patched on the selected skill independently of trait-owned resource policy.
  const catalog = Object.entries(skills).reduce(
    (current, [id, fields]) => withSkill(current, Number(id), fields),
    profileCatalog
  );
  const result = observeGw2Runtime({ profession: { ...native, catalog }, config, rotation });
  assert.deepEqual(result.warnings, []);
  return result;
}

// Fixed Core bars determine capacity and burst tiers independently of selected balance data.
test('Core adrenaline retains its fixed capacity and burst thresholds without profile patch targets', () => {
  const result = run({ specialization: 'Core', initialResource: 60 });
  assert.equal(result.planningState.profession.adrenaline.maximum, 30);
  assert.equal(result.planningState.profession.adrenaline.value, 30);
  for (const [spent, tier] of [
    [10, 1],
    [19.5, 1],
    [20, 2],
    [29.5, 2],
    [30, 3]
  ])
    assert.equal(warriorBurstTier(spent), tier);
  for (const id of ['warrior.core.resources', 'warrior.core.burst-tiers'])
    assert.throws(
      () =>
        applyBalanceProfilePatch(warriorCatalog, {
          balanceProfiles: { [id]: { fields: { maximumStacks: 50 } } }
        }),
      /unknown balance profile/
    );
});

// The equipped signet grants its active resource and suspends its passive until recharge, while retaining trait procs.
test('Signet of Stamina restores endurance, triggers Signet Mastery, and gates passive regeneration on recharge', () => {
  const config = {
    specialization: 'Core',
    selectedSkillIds: [ID.SIGNET_OF_STAMINA],
    selectedTraitIds: [TRAIT.SIGNET_MASTERY],
    initialEndurance: 0
  };
  const passive = run(config, [{ type: 'wait', durationMs: 4000 }]);
  assert.equal(passive.planningState.profession.endurance.value, 30);
  const vigor = run({ ...config, boons: { vigor: true } }, [{ type: 'wait', durationMs: 4000 }]);
  assert.equal(vigor.planningState.profession.endurance.value, 40);
  const active = run(config, ['Signet of Stamina', { type: 'wait', durationMs: 4000 }]);
  assert.equal(active.planningState.profession.endurance.value, 70);
  assert.ok(active.resolvedEvents.some((event) => event.kind === 'signet-mastery' && event.stacks === 1));
  const runtime = observedRuntime(active);
  runtime.endurance.spend(70);
  runtime.cooldownController.setReadyAt(ID.SIGNET_OF_STAMINA, runtime.time + 2);
  assert.equal(runtime.endurance.readyAt(50), runtime.time + 7.36);
});

test('selected Warrior clocks seed against patched caps without an earlier factory or Core clamp', () => {
  for (const [specialization, key, profile, maximum] of [
    ['Spellbreaker', 'adrenaline', TRAIT.SPELLBREAKERS_CONVICTION, 45],
    ['Bladesworn', 'flow', TRAIT.GUN_X_SWORD, 125]
  ]) {
    for (const cap of [0, 7.5, maximum]) {
      const result = run({ specialization, initialResource: 150 }, [], { [profile]: { maximumStacks: cap } });
      const runtime = observedRuntime(result);
      const clock = result.planningState.profession[key];
      assert.equal(clock.maximum, cap);
      assert.equal(clock.value, cap);
      assert.equal(clock.rate, 0);
      runtime.mechanics.resourceController.replace(key, 0);
      runtime.mechanics.resourceController.grant(key, 0.25);
      assert.equal(runtime.mechanics.resourceController.value(key), Math.min(cap, 0.25));
      assert.equal(clock.value, cap, 'projected clocks remain detached after live mutations');
    }

    const unpatched = run({ specialization, initialResource: 150 });
    assert.equal(unpatched.planningState.profession[key].maximum, specialization === 'Spellbreaker' ? 20 : 100);
  }
});

test('Berserk refresh clamps its patched mode cap and expiry restores capacity without refilling', () => {
  const config = { specialization: 'Berserker', initialResource: 60 };
  const profiles = { [TRAIT.PRIMAL_RAGE]: { maximumStacks: 7.5 } };
  const entered = run(config, ['Berserk'], profiles);
  assert.equal(entered.planningState.profession.adrenaline.maximum, 7.5);
  assert.equal(entered.planningState.profession.adrenaline.value, 7.5);
  const expired = run(config, ['Berserk', { type: 'wait', durationMs: 20000 }], profiles);
  assert.equal(expired.planningState.profession.adrenaline.maximum, 30);
  assert.equal(expired.planningState.profession.adrenaline.value, 7.5);
});

test('adrenaline readiness offers only finite future signet pulses within the selected capacity', () => {
  const result = run({ specialization: 'Spellbreaker', initialResource: 0 });
  const runtime = observedRuntime(result);
  const resource = runtime.mechanics.resourceController;
  for (const boundary of [0, -1, Infinity, NaN]) {
    runtime.profession.core.signetOfRagePassive.nextAt = boundary;
    assert.equal(resource.readyAt('adrenaline', 10), null);
  }

  runtime.profession.core.signetOfRagePassive.nextAt = 3;
  assert.equal(resource.readyAt('adrenaline', 10), 3);
  assert.equal(resource.readyAt('adrenaline', 21), null);
  assert.equal(resource.value('adrenaline'), 0, 'a retry boundary does not credit future rewards');
});

// Near-threshold fractions must have the same acceptance result as the shared controller's strict spending.
test('Warrior resource gates share pool tolerance and a short Flow interval stalls until funded', () => {
  const burst = run({ specialization: 'Core', primaryWeapon: 'Axe', initialResource: 10 - 1e-10 }, ['Eviscerate']);
  assert.notEqual(burst.steps[0].invalid, true);
  const config = { specialization: 'Bladesworn', initialResource: 15 - 0.00005 };
  const denied = observeGw2Runtime({
    profession: warriorProfession.runtimeFor(config),
    config,
    rotation: ['Dragon Trigger']
  });
  assert.equal(denied.steps[0].invalid, true);
  assert.match(denied.warnings[0].message, /requires at least 15 flow/);
  assert.equal(denied.planningState.profession.flow.value, config.initialResource);

  const charged = run({ specialization: 'Bladesworn', initialResource: 20 - 0.00005 }, [
    'Dragon Trigger',
    { type: 'wait', durationMs: 480 },
    { type: 'combat-start' },
    { type: 'wait', durationMs: 240 }
  ]);
  const ticks = charged.events.filter((event) => event.reason === 'dragon trigger charge');
  assert.deepEqual(
    ticks.map((event) => event.flowSpent),
    [0, 0, 5]
  );
  assert.equal(charged.planningState.profession.dragonCharges.value, 2);
});

test('doubled Dragon Trigger gains cap at selected charges and release reports the spend after clearing the clock', () => {
  const profiles = { [TRAIT.DARING_DRAGON]: { maximumStacks: 2 } };
  const skills = { [ID.DRAGON_TRIGGER]: { maximumCharges: 3 } };
  for (const selectedTraitIds of [[], [TRAIT.DARING_DRAGON]]) {
    const maximum = selectedTraitIds.length ? 2 : 3;
    const config = { specialization: 'Bladesworn', initialResource: 100, selectedSkillIds: [62901], selectedTraitIds };
    const result = run(
      config,
      ['Tactical Reload', 'Dragon Trigger', { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: 10 }],
      profiles,
      skills
    );
    const state = observedRuntime(result).profession.specialization.state;
    const release = result.events.find(
      (event) => event.resource === 'dragon charges' && event.reason === 'profession mechanic'
    );
    assert.equal(release.chargesReached, maximum);
    assert.equal(release.maximumCharges, maximum);
    assert.equal(state.dragonCharges.value, 0);
    assert.equal(state.dragonCharges.maximum, maximum);
    assert.equal(state.dragonCharges.rate, 0);
    observedRuntime(result).mechanics.resourceController.grant('dragonCharges', 1);
    assert.equal(release.chargesReached, maximum);
    assert.equal(result.planningState.profession.dragonCharges.value, 0);
  }
});
