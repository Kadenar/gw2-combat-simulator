import assert from 'node:assert/strict';
import test from 'node:test';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { revenantFacetParents, revenantUpkeepConsumeId } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { revenantHit, runRevenant } from '#tests/helpers/revenant-simulation.js';

const heraldConfig = {
  specialization: 'Herald',
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 100
};
const wait = (durationMs) => ({ type: 'wait', durationMs });

/** Read the composed observer so these contracts cover registration as well as owner-local projection. */
function effects(result) {
  const runtime = observedRuntime(result);
  return revenantProfession.runtimeFor(runtime.config).observeEffects(runtime.mechanics.queries);
}

test('only the selected Revenant elite contributes effect policies and observations, exactly once', () => {
  const eliteKinds = {
    Herald: ['burst-of-strength'],
    Conduit: ['cosmic-wisdom', 'cosmic-wisdom-extension'],
    Vindicator: ['reavers-curse', 'forerunner-of-death'],
    Renegade: ['band-together', 'razorclaws-rage', 'kallas-fervor']
  };
  for (const specialization of ['Core', ...Object.keys(eliteKinds)]) {
    const result = runRevenant([], { specialization });
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    const profession = revenantProfession.runtimeFor(runtime.config);
    const policies = profession.buffPolicies(runtime.mechanics).map(({ kind }) => kind);
    const observations = effects(result).map(({ kind }) => kind);
    assert.equal(new Set(policies).size, policies.length);
    assert.equal(new Set(observations).size, observations.length);
    for (const [owner, kinds] of Object.entries(eliteKinds)) {
      for (const kind of kinds) {
        assert.equal(policies.includes(kind), owner === specialization, `${specialization}: ${kind}`);
        if (owner === 'Renegade') assert.equal(observations.includes(kind), owner === specialization);
      }
    }

    for (const kind of ['battle-scars', 'enchanted-daggers', 'crushing-abyss']) assert.ok(observations.includes(kind));
    for (const kind of ['blocking', 'unblockable', 'rite-of-the-great-dwarf']) assert.ok(policies.includes(kind));
  }
});

test('Renegade observations retain live charge consumption and strict Fervor expiry', () => {
  const result = runRevenant(
    [wait(1000)],
    { specialization: 'Renegade' },
    {
      initialize(runtime) {
        const state = runtime.profession.specialization.state;
        state.kallasFervor = [{ at: 0, expiresAt: 2 }];
        state.razorclawsRage = { charges: 2, expiresAt: 2, readyAt: 0 };
        runtime.effects.emit({ kind: 'packet', event: revenantHit(0.5) });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const observed = effects(result);
  const razorclaw = observed.find(({ kind }) => kind === 'razorclaws-rage');
  assert.equal(effectStateValue(razorclaw, 1).count, 1);
  assert.equal(effectStateValue(razorclaw, 2).count, 0);
  const fervor = observed.find(({ kind }) => kind === 'kallas-fervor');
  assert.equal(effectStateValue(fervor, 1).count, 1);
  assert.equal(effectStateValue(fervor, 2).count, 0);
});

test('Band Together observation disappears when its enhancement is consumed or expires', () => {
  const options = {
    initialize(runtime) {
      runtime.profession.specialization.state.bandTogether = { charges: 1, expiresAt: 2 };
    }
  };
  const config = {
    specialization: 'Renegade',
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE
  };
  const idle = runRevenant([], config, options);
  const band = effects(idle).find(({ kind }) => kind === 'band-together');
  assert.equal(effectStateValue(band, 1).count, 1);
  assert.equal(effectStateValue(band, 2).count, 0);
  const consumed = runRevenant(["Icerazor's Ire"], config, options);
  assert.deepEqual(consumed.warnings, []);
  assert.equal(
    effectStateValue(
      effects(consumed).find(({ kind }) => kind === 'band-together'),
      consumed.rotationEndTime
    ).count,
    0
  );
});

test('Nature activation arms the declared consume for each supported legend', () => {
  const catalog = revenantProfession.runtimeFor(heraldConfig).catalog;
  const relationships = catalog.skillsById.get(ID.FACET_OF_NATURE).upkeepConsumeByLegendId;
  for (const [legend, consumeId] of Object.entries(relationships)) {
    const result = runRevenant(['Facet of Nature'], {
      ...heraldConfig,
      selectedLegends: [legend, legend === LEGEND.DRAGON ? LEGEND.ASSASSIN : LEGEND.DRAGON],
      startingLegend: legend
    });
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.ok(skillFlipReady(runtime.profession.core.availableFlips[consumeId], runtime.time));
    for (const other of Object.values(relationships).filter((id) => id !== consumeId))
      assert.ok(!skillFlipReady(runtime.profession.core.availableFlips[other], runtime.time));
  }
});

test('selected Nature relationships drive activation, swaps, teardown, and presentation without stale caches', () => {
  const base = revenantProfession.runtimeFor(heraldConfig).catalog;
  const nature = base.skillsById.get(ID.FACET_OF_NATURE);
  const changed = withSkill(base, nature.id, {
    upkeepConsumeByLegendId: {
      ...nature.upkeepConsumeByLegendId,
      [LEGEND.ASSASSIN]: ID.TRUE_NATURE_DRAGON,
      [LEGEND.DRAGON]: ID.TRUE_NATURE_ASSASSIN
    }
  });
  for (const catalog of [base, changed, base]) {
    const selected = catalog.skillsById.get(nature.id).upkeepConsumeByLegendId;
    const options = { catalog: () => catalog };
    const active = runRevenant(['Facet of Nature'], heraldConfig, options);
    const swapped = runRevenant(['Facet of Nature', 'Swap Legends'], heraldConfig, options);
    const consumed = runRevenant(['Facet of Nature', { skillId: selected[LEGEND.ASSASSIN] }], heraldConfig, options);
    for (const result of [active, swapped, consumed]) assert.deepEqual(result.warnings, []);
    const first = observedRuntime(active);
    const second = observedRuntime(swapped);
    assert.ok(skillFlipReady(first.profession.core.availableFlips[selected[LEGEND.ASSASSIN]], first.time));
    assert.ok(skillFlipReady(second.profession.core.availableFlips[selected[LEGEND.DRAGON]], second.time));
    assert.ok(!skillFlipReady(second.profession.core.availableFlips[selected[LEGEND.ASSASSIN]], second.time));
    assert.ok(second.profession.core.activeUpkeeps.some(({ skillId }) => skillId === nature.id));
    const finished = observedRuntime(consumed);
    assert.ok(!finished.profession.core.activeUpkeeps.some(({ skillId }) => skillId === nature.id));
    assert.ok(finished.cooldownController.readyAt(nature.id) > finished.time);
    const context = {
      specialization: 'Herald',
      catalog,
      build: heraldConfig,
      professionState: active.planningState.profession,
      time: first.time
    };
    const skill = catalog.skillsById.get(selected[LEGEND.ASSASSIN]);
    assert.equal(revenantProfession.ui.paletteOverride(context, skill).tileActive, true);
    assert.equal(
      revenantProfession.ui.paletteOverride(context, catalog.skillsById.get(selected[LEGEND.DRAGON])).tileActive,
      false
    );
    assert.deepEqual(revenantProfession.ui.skillDamageState(context, skill), {
      config: { startingLegend: LEGEND.ASSASSIN }
    });
  }
});

test('ordinary facet children, palette replacement, and cooldown parent follow the selected declaration', () => {
  const change = (catalog) =>
    withSkill(withSkill(catalog, ID.FACET_OF_STRENGTH, { flipSkillId: ID.ELEMENTAL_BLAST }), ID.FACET_OF_ELEMENTS, {
      flipSkillId: ID.BURST_OF_STRENGTH
    });
  const config = { ...heraldConfig, startingLegend: LEGEND.DRAGON };
  const options = { catalog: change };
  const active = runRevenant(['Facet of Strength'], config, options);
  const catalog = change(revenantProfession.runtimeFor(config).catalog);
  const context = {
    specialization: 'Herald',
    catalog,
    build: config,
    professionState: active.planningState.profession
  };
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, ID.FACET_OF_STRENGTH), [ID.ELEMENTAL_BLAST]);
  const group = revenantLegendLoadout.paletteGroups(context).find(({ label }) => label === 'Dragon');
  assert.ok(group.skillIds.includes(ID.ELEMENTAL_BLAST));
  assert.ok(!group.skillIds.includes(ID.FACET_OF_STRENGTH));
  const consumed = runRevenant(['Facet of Strength', 'Elemental Blast'], config, options);
  assert.deepEqual(consumed.warnings, []);
  const runtime = observedRuntime(consumed);
  assert.deepEqual(runtime.profession.core.activeUpkeeps, []);
  assert.ok(runtime.cooldownController.readyAt(ID.FACET_OF_STRENGTH) > runtime.time);
  assert.equal(runtime.cooldownController.readyAt(ID.FACET_OF_ELEMENTS), undefined);
  const swapped = runRevenant(['Facet of Strength', 'Swap Legends'], config, options);
  assert.deepEqual(swapped.warnings, []);
  assert.deepEqual(observedRuntime(swapped).profession.core.activeUpkeeps, []);
});

test('missing destination mappings end Nature on swap and never use its ordinary flip metadata', () => {
  const catalog = revenantProfession.runtimeFor(heraldConfig).catalog;
  const selected = withSkill(catalog, ID.FACET_OF_NATURE, {
    upkeepConsumeByLegendId: { [LEGEND.ASSASSIN]: ID.TRUE_NATURE_ASSASSIN },
    flipSkillId: ID.TRUE_NATURE_DRAGON
  });
  assert.equal(revenantUpkeepConsumeId(selected.skillsById.get(ID.FACET_OF_NATURE), LEGEND.DRAGON), undefined);
  const result = runRevenant(['Facet of Nature', 'Swap Legends'], heraldConfig, { catalog: () => selected });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.deepEqual(runtime.profession.core.activeUpkeeps, []);
  assert.ok(!skillFlipReady(runtime.profession.core.availableFlips[ID.TRUE_NATURE_DRAGON], runtime.time));
  const group = revenantProfession.ui
    .paletteGroups({ specialization: 'Herald', catalog: selected, build: heraldConfig })
    .find(({ skillIds }) => skillIds.includes(ID.FACET_OF_NATURE));
  assert.ok(!group.skillIds.includes(ID.TRUE_NATURE_DRAGON));
});

test('selected facet relationships reject missing consumes and ambiguous parents before activation', () => {
  const catalog = revenantProfession.runtimeFor(heraldConfig).catalog;
  for (const [change, message] of [
    [{ flipSkillId: -999999 }, /missing or invalid consume/],
    [{ flipSkillId: null }, /missing or invalid consume/],
    [{ flipSkillId: ID.TRUE_NATURE_DRAGON }, /ambiguous facet parents/]
  ]) {
    const selected = withSkill(catalog, ID.FACET_OF_ELEMENTS, change);
    assert.throws(() => revenantFacetParents(selected.skillsById), message);
    assert.throws(() => runRevenant([], heraldConfig, { catalog: () => selected }), message);
  }
});
