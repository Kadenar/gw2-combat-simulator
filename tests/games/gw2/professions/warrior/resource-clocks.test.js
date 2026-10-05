import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/warrior/core/profiles.js';
import { BERSERKER_BALANCE_PROFILE_IDS as BERSERKER } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as SPELLBREAKER } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as BLADESWORN } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT, WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

/** Patch invocation catalogs directly so simultaneous runs exercise the selected policy before initialization hooks. */
function run(config, rotation = [], profiles = {}) {
  const native = warriorProfession.runtimeFor(config);
  const catalog = Object.entries(profiles).reduce(
    (current, [id, fields]) => withProfile(current, id, fields),
    native.catalog
  );
  const result = observeGw2Runtime({ profession: { ...native, catalog }, config, rotation });
  assert.deepEqual(result.warnings, []);
  return result;
}

test('selected Warrior clocks seed against patched caps without an earlier factory or Core clamp', () => {
  for (const [specialization, key, profile, maximum] of [
    ['Core', 'adrenaline', CORE.resources, 60],
    ['Spellbreaker', 'adrenaline', SPELLBREAKER.resources, 45],
    ['Bladesworn', 'flow', BLADESWORN.resources, 125]
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
    assert.equal(
      unpatched.planningState.profession[key].maximum,
      specialization === 'Core' ? 30 : specialization === 'Spellbreaker' ? 20 : 100
    );
  }
});

test('Berserk refresh clamps its patched mode cap and expiry restores capacity without refilling', () => {
  const config = { specialization: 'Berserker', initialResource: 60 };
  const profiles = { [CORE.resources]: { maximumStacks: 60 }, [BERSERKER.resources]: { maximumStacks: 7.5 } };
  const entered = run(config, ['Berserk'], profiles);
  assert.equal(entered.planningState.profession.adrenaline.maximum, 7.5);
  assert.equal(entered.planningState.profession.adrenaline.value, 7.5);
  const expired = run(config, ['Berserk', { type: 'wait', durationMs: 20000 }], profiles);
  assert.equal(expired.planningState.profession.adrenaline.maximum, 60);
  assert.equal(expired.planningState.profession.adrenaline.value, 7.5);
});

test('adrenaline readiness offers only finite future signet pulses within the selected capacity', () => {
  const result = run({ specialization: 'Spellbreaker', initialResource: 0 });
  const runtime = observedRuntime(result);
  const resource = runtime.mechanics.resourceController;
  for (const boundary of [0, -1, Infinity, NaN]) {
    runtime.profession.core.nextSignetPulseAt = boundary;
    assert.equal(resource.readyAt('adrenaline', 10), null);
  }

  runtime.profession.core.nextSignetPulseAt = 3;
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
  assert.match(denied.warnings[0], /requires at least 15 flow/);
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

test('doubled Dragon Trigger gains cap at selected charges and release retains facts after clearing the clock', () => {
  const profiles = { [BLADESWORN.dragonTrigger]: { maximumStacks: 3, minimumStacks: 2 } };
  for (const selectedTraitIds of [[], [TRAIT.DARING_DRAGON]]) {
    const maximum = selectedTraitIds.length ? 2 : 3;
    const config = { specialization: 'Bladesworn', initialResource: 100, selectedSkillIds: [62901], selectedTraitIds };
    const result = run(
      config,
      ['Tactical Reload', 'Dragon Trigger', { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: 10 }],
      profiles
    );
    const state = observedRuntime(result).profession.specialization.state;
    const release = [...state.dragonSlashReleases.values()].at(-1);
    assert.equal(release.charges, maximum);
    assert.equal(release.maximum, maximum);
    assert.equal(state.dragonCharges.value, 0);
    assert.equal(state.dragonCharges.maximum, maximum);
    assert.equal(state.dragonCharges.rate, 0);
    assert.equal(Object.isFrozen(release), true);
    observedRuntime(result).mechanics.resourceController.grant('dragonCharges', 1);
    assert.equal(release.charges, maximum);
    assert.equal(result.planningState.profession.dragonCharges.value, 0);
  }
});
