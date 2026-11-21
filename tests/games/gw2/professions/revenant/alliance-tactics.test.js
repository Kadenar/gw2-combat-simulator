/** Alliance switching preserves legend resources and exposes only the selected faction's independent skills. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { paletteSkillGroups } from '#gw2/app/rotation/palette/model.js';
import { controlOnSkillBar } from '#gw2/platform/skills/input-controls.js';
import { profession } from '#gw2/professions/revenant/build/context.js';
import { revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { allianceSlots } from '#gw2/professions/revenant/data/alliance.js';
import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { paletteInputFixture } from '#tests/helpers/palette.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const config = {
  specialization: 'Vindicator',
  selectedLegends: ['LegendaryAlliance', 'LegendaryAssassin'],
  startingLegend: 'LegendaryAlliance',
  initialEnergy: 80
};
const run = (rotation, overrides = {}, options = {}) => runRevenant(rotation, { ...config, ...overrides }, options);
const wait = (durationMs) => ({ type: 'wait', durationMs });

test('Alliance slot lookup rejects missing and duplicate Kurzick replacements', () => {
  const catalog = profession.resolvePatch({ id: 'current' }).catalog;
  for (const [loadoutSkillId, error] of [
    [undefined, new RegExp(`Alliance slot ${SKILL.NOMADS_ADVANCE} has no Kurzick replacement`)],
    [SKILL.SCAVENGER_BURST, new RegExp(`Alliance slot ${SKILL.SCAVENGER_BURST} has multiple Kurzick replacements`)]
  ]) {
    const changed = withSkill(catalog, SKILL.BATTLE_DANCE, { loadoutSkillId });
    assert.throws(() => allianceSlots(changed.skillsById), error);
  }
});

test('Alliance Tactics switches faction without resetting Energy or invoking a legend', () => {
  for (const combat of [false, true]) {
    for (const selected of [false, true]) {
      const result = run([...(combat ? ['__combat_start'] : []), 'Alliance Tactics'], {
        initialEnergy: 30,
        initialEndurance: 20,
        selectedTraitIds: selected ? [TRAIT.BALANCE_IN_DISCORD, TRAIT.CHARGED_MISTS] : []
      });
      assert.deepEqual(result.warnings, []);
      const state = result.planningState.profession;
      assert.equal(state[STATE.ALLIANCE_FACTION], 'Kurzick');
      assert.equal(state[STATE.ACTIVE_LEGEND_ID], 'LegendaryAlliance');
      assert.equal(state[STATE.ENERGY].value, 30);
      assert.equal(state[STATE.ENDURANCE].value, combat && selected ? 30 : 20);
      assert.equal(
        result.events.some((event) => event.type === 'sigil_swap'),
        false
      );
    }
  }

  const capped = run(['__combat_start', 'Alliance Tactics'], {
    initialEndurance: 95,
    selectedTraitIds: [TRAIT.BALANCE_IN_DISCORD]
  });
  assert.equal(capped.planningState.profession[STATE.ENDURANCE].value, 100);
});

test('faction gating rejects the other bar and an inactive legend rejects Alliance Tactics', () => {
  for (const [rotation, expected] of [
    [['Selfless Spirit'], 'Kurzick'],
    [['Alliance Tactics', 'Selfish Spirit'], 'Luxon'],
    [['Swap Legends', 'Alliance Tactics'], 'legend']
  ]) {
    const result = run(rotation);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0].message, new RegExp(expected, 'i'));
  }

  const result = run(['Alliance Tactics', 'Swap Legends', 'Swap Legends', 'Tree Song']);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.ALLIANCE_FACTION], 'Kurzick');
});

test('switching factions preserves independent skill cooldowns', () => {
  const result = run(['Selfish Spirit', 'Alliance Tactics', 'Selfless Spirit', wait(3200), 'Alliance Tactics']);
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.equal(result.planningState.profession[STATE.ALLIANCE_FACTION], 'Luxon');
  assert.ok(runtime.cooldownController.readyAt(SKILL.SELFISH_SPIRIT) > runtime.time);
  assert.ok(runtime.cooldownController.readyAt(SKILL.SELFLESS_SPIRIT) > runtime.time);
  assert.notEqual(
    runtime.cooldownController.readyAt(SKILL.SELFISH_SPIRIT),
    runtime.cooldownController.readyAt(SKILL.SELFLESS_SPIRIT)
  );
});

test('Kurzick boons apply and Tree Song restores endurance only on completion', () => {
  const rotation = ['Alliance Tactics', 'Battle Dance', 'Awakening', 'Tree Song'];
  const result = run(rotation, { initialEndurance: 0 });
  const baseline = run(
    rotation,
    { initialEndurance: 0 },
    { catalog: (catalog) => withSkill(catalog, SKILL.TREE_SONG, { resourceGain: 0 }) }
  );
  assert.deepEqual(result.warnings, []);
  for (const kind of ['resistance', 'regeneration', 'protection', 'stability'])
    assert.ok(result.events.some((event) => event.kind === kind));
  assert.ok(
    Math.abs(
      result.planningState.profession[STATE.ENDURANCE].value -
        baseline.planningState.profession[STATE.ENDURANCE].value -
        2
    ) < 1e-9
  );

  const cancelled = run(['Alliance Tactics', { name: 'Tree Song', interruptMs: 0 }], { initialEndurance: 0 });
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(cancelled.planningState.profession[STATE.ENDURANCE].value, 0);
});

test('Urn upkeep stops Energy regeneration and release or legend swap ends it', () => {
  const held = run(['__combat_start', 'Alliance Tactics', 'Urn of Saint Viktor', wait(3000)]);
  assert.deepEqual(held.warnings, []);
  assert.equal(held.planningState.profession[STATE.ENERGY].value, 80);
  assert.equal(held.planningState.profession[STATE.ACTIVE_UPKEEPS].length, 1);
  const catalog = profession.resolvePatch({ id: 'current' }).catalog;
  const context = {
    catalog,
    build: config,
    specialization: 'Vindicator',
    professionState: held.planningState.profession
  };
  const group = revenantLegendLoadout.paletteGroups(context).find((entry) => entry.active);
  const release = group.skillIds.at(-1);
  assert.equal(release, SKILL.DROP_URN_OF_SAINT_VIKTOR);
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.SPEAR_OF_ARCHEMORUS), [
    SKILL.URN_OF_SAINT_VIKTOR,
    release
  ]);
  assert.equal(
    controlOnSkillBar(catalog, catalog.skillsById.get(release), {
      id: 'LegendaryAlliance',
      slots: { 'slot-10': SKILL.SPEAR_OF_ARCHEMORUS }
    }),
    'slot-10'
  );

  for (const ending of ['Drop Urn of Saint Viktor', 'Swap Legends']) {
    const result = run(['Alliance Tactics', 'Urn of Saint Viktor', ending]);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(result.planningState.profession[STATE.ACTIVE_UPKEEPS], []);
    assert.equal(
      Boolean(result.planningState.profession[STATE.AVAILABLE_FLIPS][SKILL.DROP_URN_OF_SAINT_VIKTOR]),
      false
    );
    assert.equal(
      result.events.some((event) => event.type === 'boon' && event.skillId === SKILL.DROP_URN_OF_SAINT_VIKTOR),
      false
    );
  }

  const invalid = run(['Alliance Tactics', 'Drop Urn of Saint Viktor']);
  assert.equal(invalid.warnings.length, 1);
});

test('Urn starvation removes its upkeep and release', () => {
  const result = run(
    ['__combat_start', 'Alliance Tactics', 'Urn of Saint Viktor', wait(3000)],
    { initialEnergy: 2 },
    {
      catalog: (catalog) => withSkill(catalog, SKILL.URN_OF_SAINT_VIKTOR, { upkeepCost: 7 })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.planningState.profession[STATE.ACTIVE_UPKEEPS], []);
  assert.equal(Boolean(result.planningState.profession[STATE.AVAILABLE_FLIPS][SKILL.DROP_URN_OF_SAINT_VIKTOR]), false);
});

test('the palette, picker, and cast controls follow the selected catalog when Kurzick slots trade places', () => {
  const catalog = profession.resolvePatch({ id: 'current' }).catalog;
  const swapped = withSkill(
    withSkill(catalog, SKILL.BATTLE_DANCE, { loadoutSkillId: SKILL.SCAVENGER_BURST }),
    SKILL.TREE_SONG,
    { loadoutSkillId: SKILL.NOMADS_ADVANCE }
  );
  const bar = {
    id: 'LegendaryAlliance',
    slots: { 'slot-7': SKILL.NOMADS_ADVANCE, 'slot-8': SKILL.SCAVENGER_BURST }
  };
  for (const [selected, slot7, slot8] of [
    [catalog, SKILL.BATTLE_DANCE, SKILL.TREE_SONG],
    [swapped, SKILL.TREE_SONG, SKILL.BATTLE_DANCE]
  ]) {
    const context = {
      catalog: selected,
      build: config,
      specialization: 'Vindicator',
      professionState: { [STATE.ALLIANCE_FACTION]: 'Kurzick' }
    };
    const group = revenantLegendLoadout.paletteGroups(context).find((entry) => entry.active);
    assert.deepEqual(group.skillIds.slice(1, 3), [slot7, slot8]);
    assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.NOMADS_ADVANCE), [slot7]);
    assert.equal(controlOnSkillBar(selected, selected.skillsById.get(slot7), bar), 'slot-7');
    assert.equal(controlOnSkillBar(selected, selected.skillsById.get(slot8), bar), 'slot-8');
  }
});

test('equipped Alliance keeps F1 through F4 in order', () => {
  const catalog = profession.resolvePatch({ id: 'current' }).catalog;
  const context = {
    catalog,
    specialization: 'Vindicator',
    build: { ...config, specializations: [{ name: 'Vindicator', traits: '1-1-1' }] },
    professionState: { [STATE.ALLIANCE_FACTION]: 'Kurzick' }
  };
  for (const active of ['LegendaryAlliance', 'LegendaryAssassin']) {
    // Project the actual tiles so custom legend icons cannot move F1 behind the specialization skills.
    const input = paletteInputFixture({ catalog, ui: profession.ui, build: context.build });
    const { renderedProfessionGroups } = paletteSkillGroups(input, {
      ...context,
      professionState: { [STATE.ACTIVE_LEGEND_ID]: active }
    });
    const skills = renderedProfessionGroups.find((entry) => entry.id === 'revenant-profession').skills;
    assert.deepEqual(
      skills.map((skill) => skill.id),
      [SKILL.SWAP_LEGENDS, SKILL.ENERGY_MELD, SKILL.ALLIANCE_TACTICS, SKILL.ARCHEMORUS_STRIKE]
    );
    assert.deepEqual(
      skills.map((skill) => skill.slot),
      ['Profession_1', 'Profession_2', 'Profession_3', 'Profession_4']
    );
  }
});
