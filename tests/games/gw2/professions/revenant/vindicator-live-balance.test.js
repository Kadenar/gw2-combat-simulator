import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { revenantTooltips } from '#gw2/professions/revenant/app/tooltips.js';
import { createBuildContext, profession, toApplicationBuild } from '#gw2/professions/revenant/build/context.js';
import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { effectiveRevenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const patchId = 'current';
const live = profession.resolvePatch({ id: 'current' });
const config = { specialization: 'Vindicator', patchId };
const run = (rotation, overrides = {}) => runRevenant(rotation, { ...config, ...overrides }, { profession });
const line = (catalog) => catalog.specializations.find(({ name }) => name === 'Vindicator');

// Live choices use the final tiers and exclude the retired attribute and damage grants.
test('Vindicator live layout owns moved traits and the new grandmasters', () => {
  assert.deepEqual(
    line(live.catalog).majorTraits.map((tier) => tier.map((trait) => trait.id)),
    [
      [TRAIT.REAVERS_CURSE, TRAIT.ANGSIYANS_TRUST, TRAIT.SONG_OF_ARBOREUM],
      [TRAIT.FORERUNNER_OF_DEATH, TRAIT.VASSALS_OF_THE_EMPIRE, TRAIT.SAINT_OF_ZU_HELTZER],
      [TRAIT.FRIEND_OF_THE_LUXONS, TRAIT.HEATED_RIVALRY, TRAIT.FRIEND_OF_THE_KURZICKS]
    ]
  );
  for (const id of [2258, 2248, 2228])
    assert.equal(
      live.catalog.traits.some((trait) => trait.id === id),
      false
    );
  assert.equal(line(live.catalog).minorTraits[2].name, 'Rise to the Occasion');
  assert.equal(live.catalog.balanceProfilesById.get(TRAIT.RISE_TO_THE_OCCASION).attributeBonuses, undefined);
  const build = toApplicationBuild(profession.createBuildDefaults());
  build.specializations = [{ name: 'Vindicator', traits: '1-1-1' }];
  const context = createBuildContext({ build, transitionDelays: normalizeTransitionDelays(), patch: live });
  assert.ok(context.simulationConfig().selectedTraitIds.includes(TRAIT.RISE_TO_THE_OCCASION));
});

// Starting endurance is a fixture-only input; a non-damaging swap keeps the precombat case out of combat.
test('Balance in Discord grants selected endurance once per swap and respects the cap', () => {
  for (const combat of [false, true]) {
    const rotation = [...(combat ? ['__combat_start'] : []), 'Swap Legends'];
    const baseline = run(rotation, { initialEndurance: 30 });
    for (const amount of [0, 10, 25, 100]) {
      const result = runRevenant(
        rotation,
        { ...config, initialEndurance: 30, selectedTraitIds: [TRAIT.BALANCE_IN_DISCORD] },
        { catalog: (catalog) => withProfile(catalog, TRAIT.BALANCE_IN_DISCORD, { resourceGain: amount }) }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(result.planningState.profession[STATE.COMBAT_BEGAN_AT] !== null, combat);
      assert.equal(
        result.planningState.profession[STATE.ENDURANCE].value,
        Math.min(100, baseline.planningState.profession[STATE.ENDURANCE].value + amount)
      );
    }

    const liveResult = run(rotation, {
      patchId: 'current',
      initialEndurance: 30,
      selectedTraitIds: [TRAIT.BALANCE_IN_DISCORD]
    });
    assert.equal(
      liveResult.planningState.profession[STATE.ENDURANCE].value,
      baseline.planningState.profession[STATE.ENDURANCE].value
    );
  }

  const full = run(['Swap Legends'], { selectedTraitIds: [TRAIT.BALANCE_IN_DISCORD] });
  assert.deepEqual(full.warnings, []);
  assert.equal(full.planningState.profession[STATE.ENDURANCE].value, 100);
  const noSwap = run(['Dodge', { type: 'cast', skillId: 62757 }], { selectedTraitIds: [TRAIT.BALANCE_IN_DISCORD] });
  assert.equal(
    noSwap.planningState.profession[STATE.ENDURANCE].value,
    run(['Dodge', { type: 'cast', skillId: 62757 }]).planningState.profession[STATE.ENDURANCE].value
  );
});

test('Rise to the Occasion follows endurance, ownership and its selected profile', () => {
  for (const bonus of [0, 0.1, 0.25]) {
    const catalog = withProfile(live.catalog, TRAIT.RISE_TO_THE_OCCASION, { damageIncrease: bonus });
    for (const [endurance, actorType, selectedTraitIds, expected] of [
      [99, 'player', [TRAIT.RISE_TO_THE_OCCASION], 1 + bonus],
      [100, 'player', [TRAIT.RISE_TO_THE_OCCASION], 1],
      [0, 'summon', [TRAIT.RISE_TO_THE_OCCASION], 1],
      [0, 'player', [], 1]
    ]) {
      const selected = { ...config, selectedTraitIds };
      const native = profession.resolveProfession(selected);
      const context = {
        catalog,
        config: selected,
        time: 0,
        event: { actorType },
        runtime: {
          profession: { core: { endurance: { value: endurance, maximum: 100, updatedAt: 0, unitsPerSecond: 0 } } }
        }
      };
      assert.equal(native.calculations.modifyStrikeDamage(context, 1), expected);
      assert.equal(native.calculations.modifyConditionDamage({ ...context, condition: 'Burning' }, 1), 1);
    }
  }
});

// Master-row choices still select the native landing and its boons; no grandmaster skill is synthesized.
test('moved dodge traits and adept Energy Meld traits remain functional in live data', () => {
  for (const [choices, landing] of [
    ['1-1-1', 'Death Drop'],
    ['2-2-2', 'Imperial Impact'],
    ['3-3-3', "Saint's Shield"]
  ]) {
    const build = { specializations: [{ name: 'Vindicator', traits: choices }] };
    const ids = selectedTraits(live.catalog, build.specializations).map(({ id }) => id);
    const result = run(['Dodge', { type: 'cast', skillId: 62757 }, 'Dodge'], {
      selectedTraitIds: ids,
      initialEnergy: 100
    });
    assert.deepEqual(result.warnings, []);
    const tooltip = revenantAppAdapter.skillTooltip(live.catalog.skillsById.get(SHARED_SKILL_IDS.DODGE), live, build);
    assert.ok(tooltip.description.includes(landing));

    if (choices.startsWith('1')) assert.equal(result.planningState.profession[STATE.REAVERS_CURSE_UNTIL], 0);

    if (choices.startsWith('2'))
      assert.equal(
        effectiveRevenantEnergyCost(
          {
            catalog: live.catalog,
            specialization: 'Vindicator',
            time: 0,
            state: {},
            traits: new Set(ids)
          },
          live.catalog.skillsById.get(SKILL.ENERGY_MELD)
        ),
        0
      );

    if (choices.startsWith('3')) assert.ok(result.events.some((event) => event.kind === 'vigor'));
  }
});

test('unknown Vindicator values stay neutral and deferred effects are disclosed', () => {
  const describe = (id) =>
    describeSimulationTrait(
      live.balanceContext,
      live.catalog.traits.find((trait) => trait.id === id),
      revenantTooltips,
      'Vindicator'
    );
  assert.equal(live.catalog.balanceProfilesById.get(TRAIT.BALANCE_IN_DISCORD).resourceGain, 0);
  assert.equal(live.catalog.balanceProfilesById.get(TRAIT.RISE_TO_THE_OCCASION).damageIncrease, 0);
  assert.equal(live.catalog.balanceProfilesById.get(TRAIT.HEATED_RIVALRY).minimumStacks, 2);
  for (const id of [TRAIT.FRIEND_OF_THE_LUXONS, TRAIT.HEATED_RIVALRY, TRAIT.FRIEND_OF_THE_KURZICKS])
    assert.match(describe(id).description, /Pending|Deferred/);
});
