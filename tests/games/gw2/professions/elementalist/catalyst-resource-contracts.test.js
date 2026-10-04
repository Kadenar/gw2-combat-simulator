import assert from 'node:assert/strict';
import test from 'node:test';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { catalystHooks } from '#gw2/professions/elementalist/specializations/catalyst/hooks.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const sphere = elementalistCatalog.skillsByName.get('Deploy Jade Sphere (Fire)');
const cast = (skill) => ({ type: 'cast', skillId: skill.id });

// Policy tuning must come from this invocation's catalog before profession initialization, without passive recovery.
test('Catalyst initializes one detached clock with the selected cap and seed', () => {
  for (const maximumStacks of [0, 12.5, 40]) {
    for (const initialCatalystEnergy of [undefined, 0, 5.5, 100]) {
      const result = runElementalist(
        [{ type: 'wait', durationMs: 5000 }],
        { specialization: 'Catalyst', initialCatalystEnergy },
        { catalog: (catalog) => withProfile(catalog, PROFILE.resources, { maximumStacks }) }
      );
      const runtime = observedRuntime(result);
      const live = catalystState.from(runtime);
      const projected = result.planningState.profession;
      const expected = Math.min(maximumStacks, initialCatalystEnergy ?? maximumStacks);
      assert.deepEqual(result.warnings, []);
      assert.equal(runtime.resourceController.value('catalystEnergy'), expected);
      assert.equal(live.catalystEnergy.maximum, maximumStacks);
      assert.equal(live.catalystEnergy.rate, 0);
      assert.deepEqual(projected.catalystEnergy, live.catalystEnergy);
      assert.notEqual(projected.catalystEnergy, live.catalystEnergy);
      for (const state of [live, projected]) {
        assert.equal(Object.hasOwn(state, 'energy'), false);
        assert.equal(Object.hasOwn(state, 'maximumEnergy'), false);
      }
    }
  }

  assert.equal(runElementalist([], { specialization: 'Catalyst' }).planningState.profession.catalystEnergy.maximum, 30);
});

// Denial must leave energy, cooldowns, and sphere windows untouched; exact funding spends once at deployment.
test('Catalyst deployment requires matching attunement and the selected fractional cost', () => {
  for (const [initialCatalystEnergy, startAttunement, accepted] of [
    [0, 'Fire', false],
    [6, 'Fire', false],
    [6.25, 'Water', false],
    [6.25, 'Fire', true]
  ]) {
    const result = runElementalist(
      [cast(sphere)],
      { specialization: 'Catalyst', initialCatalystEnergy, startAttunement },
      { catalog: (catalog) => withProfile(catalog, PROFILE.resources, { maximumStacks: 12.5, resourceCost: 6.25 }) }
    );
    const runtime = observedRuntime(result);
    const state = catalystState.from(runtime);
    assert.equal(state.catalystEnergy.value, accepted ? 0 : initialCatalystEnergy);
    assert.equal(state.sphereActiveUntil > 0, accepted);
    assert.equal(runtime.cooldownController.hasCooldown(sphere.id), accepted);
    const spends = result.events.filter((event) => event.kind === 'catalyst-energy' && event.change < 0);
    assert.equal(spends.length, accepted ? 1 : 0);
    if (accepted) {
      assert.deepEqual(result.warnings, []);
      assert.equal(spends[0].change, -6.25);
    } else {
      assert.equal(result.warnings.length, 1);
      assert.match(
        result.warnings[0],
        startAttunement === 'Water' ? /requires Fire attunement/ : /requires 6.25 energy/
      );
    }
  }
});

// Exercise the accepted callback directly so an aggregate hits field cannot accidentally multiply the grant.
test('Catalyst hit rewards preserve eligibility, sphere suppression, and actual capped gains', () => {
  for (const [actorType, coefficient, sphereActive, specialist, expected] of [
    ['player', 1, false, false, 1.5],
    ['effect', 1, false, false, 1.5],
    ['summon', 1, false, true, 0],
    ['player', 0, false, false, 0],
    ['player', 1, true, false, 0],
    ['player', 1, true, true, 1.5]
  ]) {
    const result = runElementalist(
      [],
      {
        specialization: 'Catalyst',
        initialCatalystEnergy: 0,
        selectedTraitIds: specialist ? [TRAIT.SPHERE_SPECIALIST] : []
      },
      {
        catalog: (catalog) => withProfile(catalog, PROFILE.resources, { resourceGain: 1.5 }),
        initialize(runtime) {
          catalystState.from(runtime).sphereActiveUntil = sphereActive ? 10 : 0;
          catalystHooks.reactions['damage.resolved'](runtime.mechanics, {
            type: 'damage',
            at: 0,
            actorType,
            coefficient,
            hits: 7,
            sourceId: 42,
            skillName: 'Accepted fixture'
          });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.catalystEnergy.value, expected);
  }

  const result = runElementalist(
    [],
    { specialization: 'Catalyst', initialCatalystEnergy: 29.5 },
    {
      initialize(runtime) {
        for (let index = 0; index < 2; index++)
          catalystHooks.reactions['damage.resolved'](runtime.mechanics, {
            type: 'damage',
            at: 0,
            actorType: 'player',
            coefficient: 1,
            sourceId: 42,
            skillName: 'Overflow fixture'
          });
      }
    }
  );
  assert.equal(result.planningState.profession.catalystEnergy.value, 30);
  assert.deepEqual(
    result.events.filter((event) => event.kind === 'catalyst-energy').map((event) => event.change),
    [0.5]
  );
});

// Attunement notifications grant before the next command, with Fury retained even when energy overflows.
test('Energized Elements immediately funds deployment and reports only actual energy gained', () => {
  const fire = elementalistCatalog.skillsByName.get('Fire Attunement');
  const result = runElementalist(
    [cast(fire), cast(sphere)],
    {
      specialization: 'Catalyst',
      startAttunement: 'Water',
      initialCatalystEnergy: 0,
      selectedTraitIds: [TRAIT.ENERGIZED_ELEMENTS]
    },
    {
      catalog: (catalog) =>
        withProfile(
          withProfile(catalog, PROFILE.resources, { maximumStacks: 8, resourceCost: 8 }),
          TRAIT.ENERGIZED_ELEMENTS,
          { resourceGain: 12 }
        )
    }
  );
  assert.deepEqual(result.warnings, []);
  const changes = result.events.filter((event) => event.kind === 'catalyst-energy');
  assert.deepEqual(
    changes.map((event) => event.change),
    [8, -8]
  );
  assert.equal(changes[0].at, changes[1].at);
  assert.equal(result.planningState.profession.catalystEnergy.value, 0);
  assert.ok(result.resolvedEvents.some((event) => event.kind === 'fury' && event.source === 'Energized Elements'));
});

// Palette readiness and resource controls must agree with the same patched policy used by execution.
test('Catalyst palette and build-only controls use the selected energy cap and cost', () => {
  for (const initialCatalystEnergy of [7.5, 8]) {
    let catalog;
    const result = runElementalist(
      [],
      { specialization: 'Catalyst', startAttunement: 'Fire', initialCatalystEnergy },
      {
        catalog: (base) => (catalog = withProfile(base, PROFILE.resources, { maximumStacks: 12.5, resourceCost: 8 }))
      }
    );
    const [view] = elementalistProfession.ui.resourceViews({
      catalog,
      specialization: 'Catalyst',
      professionState: result.planningState.profession
    });
    assert.equal(view.value, initialCatalystEnergy);
    assert.equal(view.maximum, 12.5);
    assert.equal(result.planningState.availability[sphere.id].ready, initialCatalystEnergy === 8);
    const [initial] = elementalistProfession.ui.resourceViews({
      catalog,
      specialization: 'Catalyst',
      build: { initialCatalystEnergy: 30 }
    });
    assert.equal(initial.value, 12.5);
    assert.equal(initial.maximum, 12.5);
  }
});
