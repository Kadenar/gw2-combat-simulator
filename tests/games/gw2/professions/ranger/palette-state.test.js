import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { bindSoulbeastUi } from '#gw2/professions/ranger/specializations/soulbeast/presentation.js';
import { soulbeastCastAvailability } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { bindDruidUi } from '#gw2/professions/ranger/specializations/druid/presentation.js';
import { DRUID_BALANCE_PROFILE_IDS as DRUID } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { bindGaleshotUi } from '#gw2/professions/ranger/specializations/galeshot/presentation.js';
import { GALESHOT_BALANCE_PROFILE_IDS as GALESHOT } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { galeshotCastAvailability } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';

// A swap changes merged ownership in runtime and both UI state shapes, but not the detached build selection.
test('Soulbeast remerges with the live pet and keeps detached previews on the configured pet', () => {
  const config = { specialization: 'Soulbeast', selectedPet: 'Pig', selectedPet2: 'Smokescale' };
  const result = runRanger([ID.LEAVE_BEASTMODE, ID.PET_SWAP, ID.BEASTMODE, ID.SMOKE_ASSAULT], config);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.activePet, 'Smokescale');
  assert.equal(result.planningState.profession.beastmodeActive, true);
  assert.ok(result.totalDamage > 0);

  const runtime = observedRuntime(result);
  const ui = bindSoulbeastUi(rangerCatalog);
  const smoke = rangerCatalog.skillsById.get(ID.SMOKE_ASSAULT);
  const pig = RANGER_PETS.find((pet) => pet.name === 'Pig');
  const smokescale = RANGER_PETS.find((pet) => pet.name === 'Smokescale');
  const pigSkill = rangerCatalog.skillsById.get(
    pig.beastmodeSkillIds.find((id) => !smokescale.beastmodeSkillIds.includes(id))
  );
  assert.equal(soulbeastCastAvailability(runtime, smoke).ready, true);
  assert.equal(soulbeastCastAvailability(runtime, pigSkill).ready, false);
  for (const state of [
    { state: { profession: runtime.profession } },
    { professionState: result.planningState.profession }
  ]) {
    const context = { config, ...state };
    const palette = ui.paletteGroups(context)[0].skillIds;
    assert.ok(palette.includes(smoke.id));
    assert.ok(!palette.includes(pigSkill.id));
    assert.equal(result.planningState.availability[smoke.id].ready, true);
    assert.equal(result.planningState.availability[pigSkill.id].ready, false);
  }

  assert.ok(ui.paletteGroups({ config })[0].skillIds.includes(pigSkill.id));
});

// Patched limits must agree across the live clock, projected palette, and catalog-only resource preview.
test('Druid palette uses the live Astral Force maximum and the detached catalog limit', () => {
  for (const maximum of [40, 120]) {
    const catalog = withProfile(rangerCatalog, DRUID.resources, { maximumStacks: maximum });
    const ui = bindDruidUi(catalog);
    const config = { specialization: 'Druid', initialAstralForce: maximum };
    const options = {
      extend: (native) => ({ catalog: withProfile(native.catalog, DRUID.resources, { maximumStacks: maximum }) })
    };
    const ready = runRanger([], config, options);
    const context = { professionState: ready.planningState.profession };
    const skill = catalog.skillsById.get(ID.CELESTIAL_AVATAR);
    assert.equal(ready.planningState.availability[skill.id].ready, true);
    assert.equal(ui.resourceViews(context)[0].maximum, maximum);
    const detached = ui.resourceViews({})[0];
    assert.equal(detached.maximum, maximum);
    assert.equal(detached.startMaximum, maximum);
    assert.equal(detached.value, maximum);
    // Live clocks are authoritative even when the UI was bound to the unpatched catalog.
    assert.equal(ready.planningState.availability[skill.id].ready, true);
    const below = runRanger([], { ...config, initialAstralForce: maximum - 1 }, options);
    assert.equal(below.planningState.availability[skill.id].ready, false);
    assert.deepEqual(runRanger([ID.CELESTIAL_AVATAR], config, options).warnings, []);
  }
});

// Hawkeye and Keen Shot share the runtime threshold, including catalog overrides on a detached UI.
test('Galeshot palette and Wind Force display use the patched threshold', () => {
  for (const maximum of [3, 7]) {
    const catalog = withProfile(rangerCatalog, GALESHOT.resources, { minimumStacks: maximum });
    const ui = bindGaleshotUi(catalog);
    const wind = ui.resourceViews({}).find((view) => view.id === 'wind-force');
    assert.equal(wind.maximum, maximum);
    assert.equal(wind.startMaximum, maximum);
    for (const value of [maximum - 1, maximum]) {
      const result = runRanger(
        [],
        { specialization: 'Galeshot' },
        {
          extend: (native) => ({
            catalog: withProfile(native.catalog, GALESHOT.resources, { minimumStacks: maximum })
          }),
          initialize(runtime) {
            const state = galeshotState.from(runtime);
            state.cycloneBowActive = true;
            state.windForce = value;
          }
        }
      );
      const runtime = observedRuntime(result);
      const context = { professionState: result.planningState.profession };
      for (const [id, available] of [
        [ID.HAWKEYE, value === maximum],
        [ID.KEEN_SHOT, value < maximum]
      ]) {
        const skill = catalog.skillsById.get(id);
        assert.equal(galeshotCastAvailability(runtime, skill).ready, available);
        assert.equal(result.planningState.availability[skill.id].ready, available);
        assert.equal(
          bindGaleshotUi(rangerCatalog).paletteOverride({ ...context, catalog }, skill).tileActive,
          available
        );
      }

      if (value < maximum)
        assert.equal(
          result.planningState.availability[ID.HAWKEYE].reason,
          `Hawkeye is unavailable — requires ${maximum} Wind Force.`
        );
    }
  }
});
