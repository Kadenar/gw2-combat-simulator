import assert from 'node:assert/strict';
import test from 'node:test';

import { activeRangerUiPet } from '#gw2/professions/ranger/core/presentation.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { rangerCatalog, rangerProfession } from '#gw2/professions/ranger/profession.js';
import { bindDruidUi } from '#gw2/professions/ranger/specializations/druid/presentation.js';
import { galeshotCastAvailability } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { bindGaleshotUi } from '#gw2/professions/ranger/specializations/galeshot/presentation.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { soulbeastCastAvailability } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { bindSoulbeastUi } from '#gw2/professions/ranger/specializations/soulbeast/presentation.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

// A swap changes merged ownership in runtime and its UI projection, but not the detached build selection.
test('Soulbeast remerges with the live pet and keeps detached previews on the configured pet', () => {
  const config = { specialization: 'Soulbeast', selectedPet: 'Pig', selectedPet2: 'Smokescale' };
  const result = runRanger([ID.LEAVE_BEASTMODE, ID.PET_SWAP, ID.BEASTMODE, ID.SMOKE_ASSAULT], config);
  assert.deepEqual(result.warnings, []);
  assert.equal(activeRangerUiPet({ professionState: result.planningState.profession }).name, 'Smokescale');
  assert.equal(result.planningState.profession[STATE.BEASTMODE_ACTIVE], true);
  assert.equal(result.planningState.profession[STATE.PET], null);
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
  const context = { config, professionState: result.planningState.profession };
  const palette = ui.paletteGroups(context)[0].skillIds;
  assert.ok(palette.includes(smoke.id));
  assert.ok(!palette.includes(pigSkill.id));
  assert.equal(result.planningState.availability[smoke.id].ready, true);
  assert.equal(result.planningState.availability[pigSkill.id].ready, false);

  assert.ok(ui.paletteGroups({ config })[0].skillIds.includes(pigSkill.id));
});

// Patched limits must agree across the live clock, projected palette, and catalog-only resource preview.
test('Druid palette uses the live Astral Force maximum and the detached catalog limit', () => {
  for (const maximum of [40, 120]) {
    const catalog = withProfile(rangerCatalog, TRAIT.CELESTIAL_BEING, { maximumStacks: maximum });
    const ui = bindDruidUi(catalog);
    const config = { specialization: 'Druid', initialAstralForce: maximum };
    const options = {
      extend: (native) => ({ catalog: withProfile(native.catalog, TRAIT.CELESTIAL_BEING, { maximumStacks: maximum }) })
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
    const below = runRanger([], { ...config, initialAstralForce: maximum - 1 }, options);
    assert.equal(below.planningState.availability[skill.id].ready, false);
    assert.deepEqual(runRanger([ID.CELESTIAL_AVATAR], config, options).warnings, []);
  }
});

// Hawkeye and Keen Shot share the runtime threshold, including catalog overrides on a detached UI.
test('Galeshot palette and Wind Force display use the patched threshold', () => {
  for (const maximum of [3, 7]) {
    const catalog = withProfile(rangerCatalog, TRAIT.TEACHINGS_OF_THE_TENGU, { minimumStacks: maximum });
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
            catalog: withProfile(native.catalog, TRAIT.TEACHINGS_OF_THE_TENGU, { minimumStacks: maximum })
          }),
          initialize(runtime) {
            const state = galeshotState.from(runtime);
            state.cycloneBowActive = true;
            runtime.resourceController.replace('windForce', value);
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

// Live slot selection drives both command admission and the projected bar despite the original build selection.
for (const specialization of ['Core', 'Untamed']) {
  test(`${specialization} pet swap projects the incoming commands from the selected slot`, () => {
    const config = {
      specialization,
      selectedPet: 'Lynx',
      selectedPet2: 'Carrion Devourer',
      // Natural commands are available while the ranger, rather than the pet, holds unleash.
      initialUntamedState: 'Ranger'
    };
    const result = runRanger([ID.PET_SWAP], config);
    assert.deepEqual(result.warnings, []);
    const state = result.planningState.profession;
    assert.equal(state[STATE.ACTIVE_PET_SLOT], 2);
    const palette = rangerProfession.ui
      .paletteGroups({ config, professionState: state })
      .find((group) => group.id === 'ranger-pet');
    assert.equal(palette.statusIcon.label, 'Carrion Devourer');
    assert.ok(palette.skillIds.includes(ID.POISONOUS_CLOUD));
    assert.ok(!palette.skillIds.includes(ID.RENDING_POUNCE));
    assert.equal(result.planningState.availability[ID.POISONOUS_CLOUD].ready, true);
    assert.equal(result.planningState.availability[ID.RENDING_POUNCE].ready, false);
  });
}
