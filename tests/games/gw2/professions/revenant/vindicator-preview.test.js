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
import { VINDICATOR_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/revenant/specializations/vindicator/rework/ids.js';
import { missingPatchTraits, selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const patchId = profession.preview.id;
const preview = profession.resolvePatch({ id: patchId });
const live = profession.resolvePatch({ id: 'current' });
const config = { specialization: 'Vindicator', patchId };
const run = (rotation, overrides = {}) => runRevenant(rotation, { ...config, ...overrides }, { profession });
const line = (catalog) => catalog.specializations.find(({ name }) => name === 'Vindicator');

// The rework changes legal choices without reinterpreting saved Live positions or retaining removed traits.
test('Vindicator preview owns the moved layout and separate saved trait choices', () => {
  assert.deepEqual(
    line(preview.catalog).majorTraits.map((tier) => tier.map(({ id }) => id)),
    [
      [TRAIT.REAVERS_CURSE, TRAIT.ANGSIYANS_TRUST, TRAIT.SONG_OF_ARBOREUM],
      [TRAIT.FORERUNNER_OF_DEATH, TRAIT.VASSALS_OF_THE_EMPIRE, TRAIT.SAINT_OF_ZU_HELTZER],
      [REWORK.FRIEND_OF_THE_LUXONS, REWORK.HEATED_RIVALRY, REWORK.FRIEND_OF_THE_KURZICKS]
    ]
  );
  for (const [tier, traits] of line(preview.catalog).majorTraits.entries()) {
    assert.ok(traits.every((trait) => trait.tier === tier + 1));
  }

  const saved = { name: 'Vindicator', traits: '1-1-1' };
  assert.deepEqual(missingPatchTraits(preview.catalog, [saved]), ['Vindicator']);
  assert.equal(selectedTraits(preview.catalog, [saved]).length, 3);
  saved.patchTraits = { [patchId]: '2-3-1' };
  assert.deepEqual(
    selectedTraits(preview.catalog, [saved])
      .slice(3)
      .map(({ id }) => id),
    [TRAIT.ANGSIYANS_TRUST, TRAIT.SAINT_OF_ZU_HELTZER, REWORK.FRIEND_OF_THE_LUXONS]
  );
  assert.deepEqual(
    selectedTraits(live.catalog, [saved])
      .slice(3)
      .map(({ id }) => id),
    [TRAIT.LEVIATHAN_STRENGTH, TRAIT.REAVERS_CURSE, TRAIT.FORERUNNER_OF_DEATH]
  );
  for (const id of [TRAIT.LEVIATHAN_STRENGTH, TRAIT.AMNESTY_OF_SHING_JEA, TRAIT.REDEMPTORS_SERMON]) {
    assert.ok(!preview.catalog.traits.some((trait) => trait.id === id));
  }

  assert.equal(preview.catalog.balanceProfilesById.has(TRAIT.LEVIATHAN_STRENGTH), false);
  assert.equal(preview.catalog.balanceProfilesById.get(REWORK.RISE_TO_THE_OCCASION).attributeBonus, undefined);
  assert.equal(line(live.catalog).minorTraits[2].name, 'Empire Divided');
});

test('build attributes lose Empire Divided Power only in Preview', () => {
  const build = toApplicationBuild(profession.createBuildDefaults());
  build.specializations = [{ name: 'Vindicator', traits: '1-1-1', patchTraits: { [patchId]: '1-1-1' } }];
  const context = (patch) => createBuildContext({ build, transitionDelays: normalizeTransitionDelays(), patch });
  assert.ok(context(preview).simulationConfig().selectedTraitIds.includes(REWORK.RISE_TO_THE_OCCASION));
  // The isolated formula verifies the removed grant without folding equipment conversion changes into the assertion.
  for (const [patch, power] of [
    [live, 1240],
    [preview, 1000]
  ]) {
    const selected = { ...config, patchId: patch.id, selectedTraitIds: [REWORK.RISE_TO_THE_OCCASION] };
    assert.equal(
      profession.resolveProfession(selected).modifyAttributes(
        {
          catalog: patch.catalog,
          config: selected,
          time: 0
        },
        { power: 1000 }
      ).power,
      power
    );
  }

  assert.ok(context(live).attributes(1).attributes.Power.final > context(preview).attributes(1).attributes.Power.final);
});

// Starting endurance is a fixture-only input; a non-damaging swap keeps the precombat case out of combat.
test('Balance in Discord grants selected endurance once per swap and respects the cap', () => {
  for (const combat of [false, true]) {
    const rotation = [...(combat ? ['__combat_start'] : []), 'Swap Legends'];
    const baseline = run(rotation, { initialEndurance: 30 });
    for (const amount of [0, 10, 25, 100]) {
      const result = run(rotation, {
        initialEndurance: 30,
        selectedTraitIds: [TRAIT.BALANCE_IN_DISCORD],
        previewValues: { balanceInDiscordEndurance: amount }
      });
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

test('Rise to the Occasion follows endurance, ownership and provisional tuning without doubling Leviathan', () => {
  for (const bonus of [0, 0.1, 0.25]) {
    const patch = profession.resolvePatch({ id: patchId, values: { riseToTheOccasionDamage: bonus } });
    for (const [endurance, actorType, selectedTraitIds, expected] of [
      [99, 'player', [REWORK.RISE_TO_THE_OCCASION], 1 + bonus],
      [100, 'player', [REWORK.RISE_TO_THE_OCCASION], 1],
      [0, 'summon', [REWORK.RISE_TO_THE_OCCASION], 1],
      [0, 'player', [], 1],
      [0, 'player', [REWORK.RISE_TO_THE_OCCASION, TRAIT.LEVIATHAN_STRENGTH], 1 + bonus]
    ]) {
      const selected = { ...config, selectedTraitIds, previewValues: { riseToTheOccasionDamage: bonus } };
      const native = profession.resolveProfession(selected);
      const context = {
        catalog: patch.catalog,
        config: selected,
        time: 0,
        event: { actorType },
        runtime: { profession: { core: { endurance: { value: endurance, maximum: 100, updatedAt: 0, rate: 0 } } } }
      };
      assert.equal(native.modifyStrikeDamage(context, 1), expected);
      assert.equal(native.modifyConditionDamage({ ...context, condition: 'Burning' }, 1), 1);
    }
  }
});

// Master-row choices still select the native landing and its boons; no grandmaster skill is synthesized.
test('moved dodge traits and adept Energy Meld traits remain functional in Preview', () => {
  for (const [choices, landing] of [
    ['1-1-1', 'Death Drop'],
    ['2-2-2', 'Imperial Impact'],
    ['3-3-3', "Saint's Shield"]
  ]) {
    const build = { specializations: [{ name: 'Vindicator', traits: '1-1-1', patchTraits: { [patchId]: choices } }] };
    const ids = selectedTraits(preview.catalog, build.specializations).map(({ id }) => id);
    const result = run(['Dodge', { type: 'cast', skillId: 62757 }, 'Dodge'], {
      selectedTraitIds: ids,
      initialEnergy: 100
    });
    assert.deepEqual(result.warnings, []);
    const tooltip = revenantAppAdapter.skillTooltip(
      preview.catalog.skillsById.get(SHARED_SKILL_IDS.DODGE),
      preview,
      build
    );
    assert.ok(tooltip.description.includes(landing));

    if (choices.startsWith('1')) assert.equal(result.planningState.profession[STATE.REAVERS_CURSE_UNTIL], 0);

    if (choices.startsWith('2'))
      assert.equal(
        effectiveRevenantEnergyCost(
          {
            catalog: preview.catalog,
            specialization: 'Vindicator',
            time: 0,
            state: {},
            traits: new Set(ids)
          },
          preview.catalog.skillsById.get(SKILL.ENERGY_MELD)
        ),
        0
      );

    if (choices.startsWith('3')) assert.ok(result.events.some((event) => event.kind === 'vigor'));
  }

  assert.deepEqual([...preview.catalog.skillsById.keys()], [...live.catalog.skillsById.keys()]);
});

test('preview tooltips and authoring describe provisional and deferred behavior', () => {
  const patch = profession.resolvePatch({
    id: patchId,
    values: { balanceInDiscordEndurance: 23, riseToTheOccasionDamage: 0.2 }
  });
  const describe = (id) =>
    describeSimulationTrait(
      patch.balanceContext,
      patch.catalog.traits.find((trait) => trait.id === id),
      revenantTooltips,
      'Vindicator'
    );
  assert.match(describe(TRAIT.BALANCE_IN_DISCORD).facts[0].detail, /23/);
  assert.match(describe(REWORK.RISE_TO_THE_OCCASION).facts[0].detail, /20%/);
  for (const id of [REWORK.FRIEND_OF_THE_LUXONS, REWORK.HEATED_RIVALRY, REWORK.FRIEND_OF_THE_KURZICKS]) {
    assert.match(describe(id).description, /Pending|Deferred/);
  }

  const metadata = profession.patchAuthoring.modules.find(({ id }) => id === 'Vindicator');
  assert.ok(metadata.traits.some(({ name }) => name === 'Rise to the Occasion'));
  assert.ok(!metadata.traits.some(({ name }) => name === 'Empire Divided'));
  assert.equal(preview.catalog.balanceProfilesById.get(TRAIT.BALANCE_IN_DISCORD).resourceGain, 10);
  assert.equal(preview.catalog.balanceProfilesById.get(REWORK.RISE_TO_THE_OCCASION).damageIncrease, 0.1);
});
