import assert from 'node:assert/strict';
import test from 'node:test';
import { availability } from '#gw2/professions/elementalist/specializations/evoker/mechanics/availability.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerUi } from '#gw2/professions/elementalist/specializations/evoker/presentation.js';
import { evokerHooks } from '#gw2/professions/elementalist/specializations/evoker/hooks.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

/** Each invocation owns its patched catalog so policies must select capacity before any familiar initialization. */
function run(rotation = [], overrides = {}, profiles = {}, skills = {}) {
  const config = { specialization: 'Evoker', evokerElement: 'Fire', selectedTraitIds: [], ...overrides };
  const native = elementalistProfession.runtimeFor(config);
  let catalog = native.catalog;
  for (const [id, fields] of Object.entries(profiles)) catalog = withProfile(catalog, Number(id) || id, fields);
  for (const [id, fields] of Object.entries(skills)) catalog = withSkill(catalog, Number(id), fields);
  const result = observeGw2Runtime({ profession: { ...native, catalog }, config, rotation });
  return { result, runtime: observedRuntime(result), catalog };
}

// Pending grants remain retryable until their actual instant; querying readiness cannot spend or grant charges.
test('Evoker waits for a future charge grant even one microsecond before delivery', () => {
  const state = evokerState.create();
  state.familiarCharges.value = 2;
  state.familiarCharges.maximum = 3;
  state.empoweredCharges.maximum = 3;
  state.pendingWeaponCompletions = [{ activationId: 'pending', at: 1.000001, gain: 1 }];
  const context = { time: 1, profession: { core: {}, specialization: { kind: 'Evoker', state } } };
  const result = availability(context, { id: ID.IGNITE, name: 'Ignite' });
  assert.equal(result.ready, false);
  assert.equal(result.retryAt, 1.000001);
  assert.equal(state.familiarCharges.value, 2);
});

test('Evoker policies seed both clocks from isolated caps and project detached values', () => {
  for (const [maximumStacks, minimumStacks] of [
    [0, 0],
    [7.5, 2.5],
    [12, 5]
  ]) {
    const { result, runtime, catalog } = run(
      [],
      { initialEvokerCharges: 99, initialEvokerEmpowered: 99 },
      {
        [PROFILE.resources]: { maximumStacks, minimumStacks }
      }
    );
    assert.deepEqual(result.warnings, []);
    const state = result.planningState.profession;
    const views = evokerUi.resourceViews({ professionState: state, catalog });
    for (const [key, maximum, view] of [
      ['familiarCharges', maximumStacks, views[0]],
      ['empoweredCharges', minimumStacks, views[1]]
    ]) {
      assert.equal(state[key].value, maximum);
      assert.equal(state[key].maximum, maximum);
      assert.equal(state[key].rate, 0);
      assert.equal(view.value, maximum);
      assert.equal(view.maximum, maximum);
      runtime.mechanics.resourceController.replace(key, 0);
      runtime.mechanics.resourceController.grant(key, 0.25);
      assert.equal(runtime.mechanics.resourceController.value(key), Math.min(maximum, 0.25));
      assert.equal(state[key].value, maximum);
    }

    for (const key of ['charges', 'maximumCharges', 'empowered']) assert.equal(Object.hasOwn(state, key), false);
  }

  const ordinary = run().result.planningState.profession;
  assert.equal(ordinary.familiarCharges.value, 6);
  assert.equal(ordinary.empoweredCharges.maximum, 3);
});

test('Specialized Elements selects the charge policy before locking attunement', () => {
  const { result, runtime } = run(
    [],
    {
      evokerElement: 'Earth',
      startAttunement: 'Fire',
      selectedTraitIds: [TRAIT.SPECIALIZED_ELEMENTS]
    },
    { [PROFILE.resources]: { maximumStacks: 7 }, [TRAIT.SPECIALIZED_ELEMENTS]: { maximumStacks: 9.5 } }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.familiarCharges.value, 9.5);
  assert.equal(result.planningState.profession.familiarCharges.maximum, 9.5);
  assert.equal(runtime.profession.core.primaryAttunement, 'Earth');
});

test('basic conversion publishes both final pools together and cancellation earns no empowered progress', () => {
  const profiles = { [PROFILE.resources]: { maximumStacks: 7.5, minimumStacks: 2.5 } };
  const config = { initialEvokerEmpowered: 2 };
  const completed = run([ID.IGNITE], config, profiles).result;
  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.planningState.profession.familiarCharges.value, 0);
  assert.equal(completed.planningState.profession.empoweredCharges.value, 2.5);
  const readings = completed.events.filter((event) => event.kind === 'evoker-charges');
  assert.deepEqual(
    readings.map((event) => [event.value, event.empowered]),
    [[0, 2.5]]
  );
  const canceled = run([{ skillId: ID.IGNITE, interruptAfterMs: 1 }], config, profiles, {
    [ID.IGNITE]: { castTimeMs: 1000 }
  }).result;
  assert.deepEqual(canceled.warnings, []);
  assert.equal(canceled.planningState.profession.familiarCharges.value, 7.5);
  assert.equal(canceled.planningState.profession.empoweredCharges.value, 2);
});

test('basic familiar completion gates its empowered flip using the patched profile delay', () => {
  // A profile override must reach the cooldown controller after the basic charge conversion commits.
  for (const [basic, empowered, element, profile] of [
    [ID.IGNITE, ID.CONFLAGRATION, 'Fire', PROFILE.ignite],
    [ID.SPLASH, ID.BUOYANT_DELUGE, 'Water', PROFILE.splash],
    [ID.ZAP, ID.LIGHTNING_BLITZ, 'Air', PROFILE.zap],
    [ID.CALCIFY, ID.SEISMIC_IMPACT, 'Earth', PROFILE.calcify]
  ]) {
    const delay = 5;
    const { result, runtime } = run(
      [basic],
      { evokerElement: element, startAttunement: element, initialEvokerEmpowered: 2 },
      { [profile]: { initialDelay: delay } }
    );
    assert.deepEqual(result.warnings, []);
    const conversion = result.events.find((event) => event.kind === 'evoker-charges');
    assert.equal(conversion.empowered, 3);
    assert.equal(runtime.mechanics.cooldownController.readyAt(empowered), conversion.at + delay);
  }
});

test('overlapping weapon completion flushes its fractional reward after the familiar reset exactly once', () => {
  const { result, runtime } = run(
    [ID.SAND_SQUALL, { skillId: ID.CALCIFY, concurrentOffsetMs: 100 }],
    { evokerElement: 'Earth', startAttunement: 'Earth', primaryWeapon: 'Pistol', secondaryWeapon: 'Warhorn' },
    {
      [PROFILE.resources]: { maximumStacks: 7.5, playerStacks: 2.75 }
    },
    { [ID.CALCIFY]: { castTimeMs: 1000 } }
  );
  assert.deepEqual(result.warnings, []);
  const readings = result.events.filter((event) => event.kind === 'evoker-charges');
  assert.deepEqual(
    readings.map((event) => [event.value, event.empowered]),
    [
      [0, 1],
      [2.75, 1]
    ]
  );
  assert.equal(readings[0].at, readings[1].at);
  assert.equal(readings[1].sourceId, ID.SAND_SQUALL);
  assert.equal(readings[1].change, 2.75);
  assert.equal(result.planningState.profession.familiarCharges.value, 2.75);
  assert.deepEqual(runtime.profession.specialization.state.pendingWeaponChargeGains, []);
  assert.deepEqual(runtime.profession.specialization.state.pendingWeaponCompletions, []);
});

test('Elemental Dynamo grants at attunement and caps the reported pool without a cast reward', () => {
  const { result } = run(
    [ID.AIR_ATTUNEMENT],
    {
      evokerElement: 'Air',
      startAttunement: 'Fire',
      initialEvokerCharges: 5,
      selectedTraitIds: [TRAIT.ELEMENTAL_DYNAMO]
    },
    {
      [PROFILE.resources]: { maximumStacks: 5.5 },
      [TRAIT.ELEMENTAL_DYNAMO]: { resourceGain: 1.25 }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.familiarCharges.value, 5.5);
  const reading = result.events.find((event) => event.kind === 'evoker-charges');
  assert.equal(reading.value, 5.5);
  assert.equal(reading.maximum, 5.5);
  assert.equal(reading.source, 'Elemental Dynamo');
  assert.equal(reading.at, result.events.find((event) => event.type === 'elementalist.attunement').at);
});

// A pending provider is a retry opportunity, while its charges remain absent until successful completion.
test('pending familiar readiness never credits a speculative grant and cancellation removes its retry', () => {
  const { runtime, catalog } = run([], { initialEvokerCharges: 4 }, { [PROFILE.resources]: { maximumStacks: 7.5 } });
  const state = runtime.profession.specialization.state;
  state.pendingWeaponCompletions = [{ activationId: 'weapon', at: 2, gain: 3.5 }];
  const skill = catalog.skillsById.get(ID.IGNITE);
  assert.equal(evokerHooks.availability(runtime.mechanics.queries, skill).retryAt, 2);
  assert.equal(runtime.mechanics.resourceController.value('familiarCharges'), 4);
  evokerHooks.onCastCancel(runtime.mechanics, { id: 'weapon' });
  assert.equal(evokerHooks.availability(runtime.mechanics.queries, skill).retryAt, null);
  assert.equal(runtime.mechanics.resourceController.value('familiarCharges'), 4);
});

test('Rejuvenate refills the patched familiar capacity without changing empowered progress', () => {
  const config = { selectedSkillIds: [ID.REJUVENATE], initialEvokerCharges: 0.25, initialEvokerEmpowered: 1.5 };
  const profiles = { [PROFILE.resources]: { maximumStacks: 7.5 } };
  for (const canceled of [false, true]) {
    const { result } = run(
      [{ skillId: ID.REJUVENATE, ...(canceled ? { interruptAfterMs: 1 } : {}) }],
      config,
      profiles,
      { [ID.REJUVENATE]: { castTimeMs: 1000 } }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.familiarCharges.value, canceled ? 0.25 : 7.5);
    assert.equal(result.planningState.profession.empoweredCharges.value, 1.5);
  }
});
