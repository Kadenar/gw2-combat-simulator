import assert from 'node:assert/strict';
import test from 'node:test';

import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantCorePaletteSkillAvailability } from '#gw2/professions/revenant/core/presentation.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { effectiveRevenantEnergyCost, runtimeRevenantEnergyCost } from '#gw2/professions/revenant/family-state.js';

// Cost policies consume explicit inputs regardless of where the state originated.
test('Conduit costs respect follow-up charges, form overrides, and free active upkeep toggles', () => {
  const state = { beguilingHazeCharges: 2, energyCostOverrides: {}, activeUpkeeps: [] };
  const input = { specialization: 'Conduit', state, traits: new Set() };
  const haze = { id: SKILL.BEGUILING_HAZE, handlerId: 'revenant.beguiling-haze', energyCost: 20 };
  const vortex = { id: SKILL.HEX_EATER_VORTEX, energyCost: 15 };

  assert.equal(effectiveRevenantEnergyCost(input, haze), 0);
  assert.equal(effectiveRevenantEnergyCost(input, vortex), 15);
  state.beguilingHazeCharges = 0;
  assert.equal(effectiveRevenantEnergyCost(input, haze), 20);
  state.energyCostOverrides[haze.id] = 5;
  assert.equal(effectiveRevenantEnergyCost(input, haze), 5);
  assert.equal(effectiveRevenantEnergyCost({ ...input, specialization: 'Core' }, haze), 20);
  const upkeep = { id: SKILL.IMPOSSIBLE_ODDS, energyCost: 5 };
  state.energyCostOverrides[upkeep.id] = 10;
  state.activeUpkeeps.push({ skillId: upkeep.id });
  assert.equal(effectiveRevenantEnergyCost(input, upkeep), 0);
});

test('Runtime costs use the owned specialization and current Conduit state', () => {
  const state = { beguilingHazeCharges: 2, energyCostOverrides: {} };
  const context = {
    config: { selectedTraitIds: [] },
    state: { profession: { core: { activeUpkeeps: [] }, specialization: { kind: 'Conduit', state } } }
  };
  const skill = { id: SKILL.BEGUILING_HAZE, handlerId: 'revenant.beguiling-haze', energyCost: 20 };
  assert.equal(runtimeRevenantEnergyCost(context, skill), 0);
  state.beguilingHazeCharges = 0;
  assert.equal(runtimeRevenantEnergyCost(context, skill), 20);
});

test('Beguiling Haze follow-ups remain available in the palette below their base Energy cost', () => {
  const availability = revenantCorePaletteSkillAvailability(
    {
      specialization: 'Conduit',
      professionState: { energy: { value: 16, maximum: 100, updatedAt: 0, rate: 5 }, beguilingHazeCharges: 2 }
    },
    { id: SKILL.BEGUILING_HAZE, name: 'Beguiling Haze', handlerId: 'revenant.beguiling-haze', energyCost: 20 }
  );

  assert.equal(availability.available, true);
});

test("Angsiyah's Trust waives only Energy Meld's energy cost", () => {
  const input = { specialization: 'Vindicator', state: {}, traits: new Set([TRAIT.ANGSIYANS_TRUST]) };

  // Both catalog variants keep the trait discount without a phase-handler registration.
  for (const id of [SKILL.ENERGY_MELD, SKILL.ENERGY_MELD_ID_72058]) {
    const skill = { id, energyCost: 10 };
    assert.equal(effectiveRevenantEnergyCost(input, skill), 0);
    assert.equal(effectiveRevenantEnergyCost({ ...input, traits: new Set() }, skill), 10);
    assert.equal(effectiveRevenantEnergyCost({ ...input, specialization: 'Core' }, skill), 10);
  }

  assert.equal(effectiveRevenantEnergyCost(input, { id: SKILL.CALL_OF_THE_ALLIANCE, energyCost: 10 }), 10);
});

test('Vindicator palette uses resolved traits for Energy Meld affordability', () => {
  const context = {
    specialization: 'Vindicator',
    professionState: { energy: { value: 0, maximum: 100, updatedAt: 0, rate: 5 } },
    traits: new Set([TRAIT.ANGSIYANS_TRUST])
  };
  const skill = { id: SKILL.ENERGY_MELD, name: 'Energy Meld', energyCost: 10 };
  assert.equal(revenantCorePaletteSkillAvailability(context, skill).available, true);
  assert.equal(revenantCorePaletteSkillAvailability({ ...context, traits: new Set() }, skill).available, false);
});

test('Configured UI queries resolve selection before calculating Energy costs', () => {
  const context = {
    config: { specialization: 'Vindicator', selectedTraitIds: [TRAIT.ANGSIYANS_TRUST] },
    professionState: { energy: { value: 0, maximum: 100, updatedAt: 0, rate: 5 } }
  };
  const skill = { id: SKILL.ENERGY_MELD, name: 'Energy Meld', specialization: 'Vindicator', energyCost: 10 };
  assert.equal(revenantProfession.ui.paletteSkillAvailability(context, skill).available, true);
  assert.equal(
    revenantProfession.ui.paletteSkillAvailability(
      { ...context, config: { ...context.config, selectedTraitIds: [] } },
      skill
    ).available,
    false
  );
});
