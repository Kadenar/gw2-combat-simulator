import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild
} from '#gw2/professions/revenant/build/build.js';
import { revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { observedRuntime, projectObservedState } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

test('each legend retains its utility slots when the build is saved and the active legend changes', () => {
  const build = createRevenantBuildDefaults();
  const context = { build, catalog: revenantProfession.catalog, specialization: 'Herald' };
  const [assassin, dragon] = revenantLegendLoadout.resolve(context).bars;
  const [heal, first, second, third, elite] = dragon.skillIds;
  assert.equal(revenantLegendLoadout.setUtilitySkill(build, dragon.id, 0, third, context), true);
  assert.equal(revenantLegendLoadout.setUtilitySkill(build, dragon.id, 0, third, context), false);
  assert.equal(revenantLegendLoadout.setUtilitySkill(build, dragon.id, 1, heal, context), false);
  assert.equal(revenantLegendLoadout.setUtilitySkill(build, dragon.id, 1, assassin.skillIds[1], context), false);
  const restored = migrateRevenantBuild(JSON.parse(JSON.stringify(build)));
  assert.equal(validateRevenantBuild(restored).valid, true);
  const swapped = { ...context, build: restored, professionState: { [STATE.ACTIVE_LOADOUT_ID]: dragon.id } };
  assert.deepEqual(revenantLegendLoadout.resolve(swapped).bars[0], assassin);
  assert.deepEqual(revenantLegendLoadout.view(swapped).activeBar.skillIds, [heal, third, second, first, elite]);
  assert.deepEqual(revenantLegendLoadout.paletteGroups(swapped).find((bar) => bar.active).skillIds, [
    heal,
    third,
    second,
    first,
    elite
  ]);
  assert.equal(revenantLegendLoadout.setUtilitySkill(restored, dragon.id, 0, first, swapped), true);
  assert.deepEqual(revenantLegendLoadout.resolve(swapped).bars[1], dragon);
  restored.legendUtilityOrder = { [dragon.id]: [first, first, third] };
  assert.equal(validateRevenantBuild(restored).valid, false);
  assert.deepEqual(
    revenantLegendLoadout.resolve({ ...context, build: migrateRevenantBuild(restored) }).bars[1],
    dragon
  );
});

// Initial selection, swaps, and preview preparation must expose the live legend through the shared loadout contract.
function assertLoadout(config, profession, projected) {
  const legend = profession.core.activeLegendId;
  assert.equal(Object.hasOwn(profession.core, 'activeLoadoutId'), false);
  assert.equal(projected[STATE.ACTIVE_LEGEND_ID], legend);
  assert.equal(projected[STATE.ACTIVE_LOADOUT_ID], legend);
  const context = { build: config, specialization: 'Core', professionState: projected };
  assert.equal(revenantLegendLoadout.view(context).activeBar.id, legend);
  const palette = revenantProfession.ui.paletteGroups({ ...context, catalog: revenantProfession.catalog });
  const swap = palette.find((group) => group.id === 'revenant-profession');
  assert.deepEqual(
    swap.skillEntries.map((entry) => entry.paletteLegendId),
    config.selectedLegends.filter((id) => id !== legend)
  );
}

test('Revenant projects its selected legend through initial selection and both swap directions', () => {
  for (const startingLegend of [LEGEND.ASSASSIN, LEGEND.DEMON]) {
    const config = { specialization: 'Core', selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON], startingLegend };
    for (const rotation of [[], ['Swap Legends'], ['Swap Legends', 'Swap Legends']]) {
      const result = runRevenant(rotation, config);
      assert.deepEqual(result.warnings, []);
      const profession = observedRuntime(result).profession;
      assert.equal(
        profession.core.activeLegendId,
        rotation.length === 1 ? config.selectedLegends.find((id) => id !== startingLegend) : startingLegend
      );
      assertLoadout(config, profession, result.planningState.profession);
    }
  }
});

test('damage preparation projects the assumed legend without adding a stored loadout identifier', () => {
  const config = {
    specialization: 'Core',
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN
  };
  const native = revenantProfession.runtimeFor(config);
  const result = runRevenant([], config);
  const runtime = observedRuntime(result);
  native.prepareDamageState(runtime.mechanics, native.catalog.skillsById.get(ID.EMBRACE_THE_DARKNESS), {});
  assert.equal(runtime.profession.core.activeLegendId, LEGEND.DEMON);
  assertLoadout(
    config,
    runtime.profession,
    projectObservedState(revenantProfession, { config, profession: runtime.profession })
  );
  assert.equal(result.planningState.profession[STATE.ACTIVE_LOADOUT_ID], LEGEND.ASSASSIN);
});
