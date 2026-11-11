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
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
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
        Math.min(100, baseline.planningState.profession[STATE.ENDURANCE].value + (combat ? amount : 0))
      );
    }

    const liveResult = run(rotation, {
      patchId: 'current',
      initialEndurance: 30,
      selectedTraitIds: [TRAIT.BALANCE_IN_DISCORD]
    });
    assert.equal(
      liveResult.planningState.profession[STATE.ENDURANCE].value,
      Math.min(100, baseline.planningState.profession[STATE.ENDURANCE].value + (combat ? 50 : 0))
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

// Master-row choices still select the native landing and its boons independently of the new grandmasters.
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

test('confirmed Vindicator tuning replaces neutral values and deferred effects are disclosed', () => {
  const describe = (id) =>
    describeSimulationTrait(
      live.balanceContext,
      live.catalog.traits.find((trait) => trait.id === id),
      revenantTooltips,
      'Vindicator'
    );
  assert.equal(live.catalog.balanceProfilesById.get(TRAIT.BALANCE_IN_DISCORD).resourceGain, 50);
  assert.equal(live.catalog.balanceProfilesById.get(TRAIT.RISE_TO_THE_OCCASION).damageIncrease, 0.1);
  assert.equal(live.catalog.balanceProfilesById.get(TRAIT.HEATED_RIVALRY).minimumStacks, 2);
  assert.match(describe(TRAIT.HEATED_RIVALRY).description, /Deferred/);
  assert.match(describe(TRAIT.FRIEND_OF_THE_KURZICKS).description, /outside simulation scope/);
});

// The grandmaster unlock is independent of Alliance, including with no energy, and cancellation grants no bonus.
test("Archemorus's Strike requires Friend of the Luxons and works outside Alliance", () => {
  for (const selected of [false, true]) {
    const groups = profession.ui.paletteGroups({
      specialization: 'Vindicator',
      catalog: live.catalog,
      build: { specializations: [{ name: 'Vindicator', traits: selected ? '1-1-1' : '1-1-2' }] }
    });
    assert.equal(
      groups.some((group) => group.skillIds.includes(SKILL.ARCHEMORUS_STRIKE)),
      selected
    );
    const result = run(["Archemorus's Strike"], {
      initialEnergy: 0,
      selectedTraitIds: selected ? [TRAIT.FRIEND_OF_THE_LUXONS] : []
    });
    assert.equal(result.warnings.length, selected ? 0 : 1);
    assert.equal(
      result.events.some((event) => event.controlKind === 'knockdown'),
      selected
    );
    assert.equal(
      result.events.some((event) => event.kind === 'friend-of-the-luxons'),
      selected
    );

    if (!selected) assert.match(result.warnings[0].message, /Friend of the Luxons/);
  }

  const cancelled = run([{ name: "Archemorus's Strike", interruptMs: 0 }], {
    selectedTraitIds: [TRAIT.FRIEND_OF_THE_LUXONS]
  });
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(
    cancelled.events.some((event) => event.kind === 'friend-of-the-luxons'),
    false
  );
});

// Short fixture casts isolate bonus refresh and expiry from native animation and recharge tuning.
test('Luxon activations refresh one bonus and unrelated skills leave its expiry unchanged', () => {
  const readings = [];
  const selected = { ...config, selectedTraitIds: [TRAIT.FRIEND_OF_THE_LUXONS] };
  const native = profession.resolveProfession(selected);
  const result = runRevenant(
    [
      "Archemorus's Strike",
      { type: 'wait', durationMs: 5000 },
      "Archemorus's Strike",
      { skillId: SKILL.ENERGY_MELD },
      { type: 'wait', durationMs: 11000 }
    ],
    selected,
    {
      catalog: (catalog) => withSkill(catalog, SKILL.ARCHEMORUS_STRIKE, { cooldown: 0, castTimeMs: 0 }),
      probes: [1, 6, 11, 15].map((at) => [
        at,
        (runtime) => {
          for (const actorType of ['player', 'summon']) {
            const context = {
              catalog: live.catalog,
              config: selected,
              time: runtime.time,
              runtime,
              event: { actorType }
            };
            readings.push(native.calculations.modifyStrikeDamage(context, 1));
            assert.equal(native.calculations.modifyConditionDamage({ ...context, condition: 'Burning' }, 1), 1);
          }
        }
      ])
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(readings, [1.1, 1, 1.1, 1, 1.1, 1, 1, 1]);
  assert.equal(observedRuntime(result).combat.activeBuffStacks('friend-of-the-luxons', 16), 0);
});
