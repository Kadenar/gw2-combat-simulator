import { planningFixture } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { effectiveRevenantEnergyCost, revenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

// Cost policies consume explicit inputs regardless of where the state originated.
test('Conduit costs preserve follow-up charges, unmapped skills, and free active upkeep toggles', () => {
  const state = {
    beguilingHazeCharges: 2,
    activeUpkeeps: [],
    conduitForm: 'Mesmer',
    cosmicWisdomUntil: 10
  };
  const input = { specialization: 'Conduit', state, traits: new Set(), time: 0, catalog: revenantCatalog };
  const haze = { id: SKILL.BEGUILING_HAZE, energyCost: 20 };
  const vortex = { id: SKILL.HEX_EATER_VORTEX, energyCost: 15 };

  assert.equal(effectiveRevenantEnergyCost(input, haze), 0);
  assert.equal(effectiveRevenantEnergyCost(input, vortex), 15);
  state.beguilingHazeCharges = 0;
  assert.equal(effectiveRevenantEnergyCost(input, haze), 20);
  const upkeep = revenantCatalog.skillsById.get(SKILL.EMBRACE_THE_DARKNESS);
  assert.equal(effectiveRevenantEnergyCost(input, upkeep), 1);
  state.activeUpkeeps.push({ skillId: upkeep.id });
  assert.equal(effectiveRevenantEnergyCost(input, upkeep), 0);
});

// Form discounts come from the selected patch and stop at the exclusive deadline, even before expiry work runs.
test('Mesmer costs read each selected profile and preserve native costs outside the active form', () => {
  const skills = [
    [SKILL.EMPOWERING_MISERY, PROFILE.mesmerEmpoweringMisery],
    [SKILL.PAIN_ABSORPTION, PROFILE.mesmerPainAbsorption],
    [SKILL.BANISH_ENCHANTMENT, PROFILE.mesmerBanishEnchantment],
    [SKILL.CALL_TO_ANGUISH, PROFILE.mesmerCallToAnguish],
    [SKILL.UNYIELDING_IMPACT, PROFILE.mesmerUnyieldingImpact],
    [SKILL.EMBRACE_THE_DARKNESS, PROFILE.mesmerEmbraceTheDarkness]
  ];
  for (const cost of [0, 2, 27]) {
    const catalog = applyBalanceProfilePatch(revenantCatalog, {
      balanceProfiles: Object.fromEntries(skills.map(([, id]) => [id, { fields: { energyCost: cost } }]))
    });
    const state = { conduitForm: 'Mesmer', cosmicWisdomUntil: 10 };
    const input = { specialization: 'Conduit', state, traits: new Set(), time: 9, catalog };
    for (const [id] of skills) {
      const skill = catalog.skillsById.get(id);
      assert.equal(effectiveRevenantEnergyCost(input, skill), cost);
      for (const time of [10, 11]) {
        assert.equal(effectiveRevenantEnergyCost({ ...input, time }, skill), skill.energyCost);
      }

      assert.equal(effectiveRevenantEnergyCost({ ...input, specialization: 'Core' }, skill), skill.energyCost);
      assert.equal(
        effectiveRevenantEnergyCost({ ...input, state: { ...state, conduitForm: 'Dervish' } }, skill),
        skill.energyCost
      );
      assert.equal(effectiveRevenantEnergyCost(input, { ...skill, energyCost: 0 }), 0);
    }
  }
});

test('Runtime costs use the owned specialization and current Conduit state', () => {
  const state = { beguilingHazeCharges: 2 };
  const runtime = {
    helpers: revenantCatalog,
    time: 0,
    config: { selectedTraitIds: [] },
    profession: { core: { activeUpkeeps: [] }, specialization: { kind: 'Conduit', state } }
  };
  const skill = { id: SKILL.BEGUILING_HAZE, energyCost: 20 };
  assert.equal(revenantEnergyCost(runtime, skill), 0);
  state.beguilingHazeCharges = 0;
  assert.equal(revenantEnergyCost(runtime, skill), 20);
});

test('Beguiling Haze follow-ups remain available in the palette below their base Energy cost', () => {
  const state = planningFixture(
    revenantProfession,
    {
      specialization: 'Conduit',
      initialEnergy: 16,
      selectedLegends: ['LegendaryEntity', 'LegendaryAssassin'],
      startingLegend: 'LegendaryEntity'
    },
    (runtime) => {
      runtime.profession.specialization.state.beguilingHazeCharges = 2;
    }
  );
  assert.equal(state.availability[SKILL.BEGUILING_HAZE].ready, true);
});

test("Angsiyah's Trust waives only Energy Meld's energy cost", () => {
  const input = {
    specialization: 'Vindicator',
    state: {},
    traits: new Set([TRAIT.ANGSIYANS_TRUST]),
    time: 0,
    catalog: revenantCatalog
  };

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
  for (const selectedTraitIds of [[], [TRAIT.ANGSIYANS_TRUST]]) {
    const state = planningFixture(revenantProfession, {
      specialization: 'Vindicator',
      initialEnergy: 0,
      selectedTraitIds
    });
    assert.equal(state.availability[SKILL.ENERGY_MELD].ready, selectedTraitIds.length > 0);
  }
});

// A setup cast isolates spending from the combat-only trait refund; recovery is accounted for independently.
test('Energy Meld spending agrees with the composed cost for both variants and trait selections', () => {
  for (const selectedTraitIds of [[], [TRAIT.ANGSIYANS_TRUST]]) {
    const config = { specialization: 'Vindicator', selectedTraitIds, initialEnergy: 20 };
    const catalog = revenantProfession.runtimeFor(config).catalog;
    for (const skillId of [SKILL.ENERGY_MELD, SKILL.ENERGY_MELD_ID_72058]) {
      const cost = effectiveRevenantEnergyCost(
        { specialization: 'Vindicator', traits: new Set(selectedTraitIds), state: {}, time: 0, catalog },
        catalog.skillsById.get(skillId)
      );
      const result = runRevenant([{ skillId }, '__combat_start'], config);
      assert.deepEqual(result.warnings, []);
      assert.ok(
        Math.abs(
          result.planningState.profession.energy.value - (config.initialEnergy - cost + 5 * result.rotationEndTime)
        ) < 1e-9
      );
      const planning = planningFixture(revenantProfession, { ...config, initialEnergy: 0 });
      assert.equal(planning.availability[skillId].ready, cost === 0);
    }
  }
});
