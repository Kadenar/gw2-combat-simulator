import assert from 'node:assert/strict';
import test from 'node:test';

import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantCorePaletteSkillAvailability } from '#gw2/professions/revenant/core/presentation.js';
import { applyConduitEnergyCostRules } from '#gw2/professions/revenant/specializations/conduit/mechanics/energy-cost.js';
import { applyVindicatorEnergyCostRules } from '#gw2/professions/revenant/specializations/vindicator/mechanics/energy-cost.js';

// Runtime ownership and the current palette projection must produce the same follow-up discount.
for (const source of ['runtime', 'palette']) {
  test(`Beguiling Haze follow-up charges waive only Beguiling Haze energy costs in ${source}`, () => {
    const state = { beguilingHazeCharges: 2, energyCostOverrides: {} };
    const context =
      source === 'runtime'
        ? { state: { profession: { core: {}, specialization: { kind: 'Conduit', state } } } }
        : { professionState: state };

    assert.equal(
      applyConduitEnergyCostRules(context, { id: SKILL.BEGUILING_HAZE, handlerId: 'revenant.beguiling-haze' }, 20),
      0
    );
    assert.equal(
      applyConduitEnergyCostRules(context, { id: SKILL.HEX_EATER_VORTEX, handlerId: 'revenant.hex-eater-vortex' }, 15),
      15
    );
    state.beguilingHazeCharges = 0;
    assert.equal(
      applyConduitEnergyCostRules(context, { id: SKILL.BEGUILING_HAZE, handlerId: 'revenant.beguiling-haze' }, 20),
      20
    );
  });
}

test('Beguiling Haze follow-ups remain available in the palette below their base Energy cost', () => {
  const availability = revenantCorePaletteSkillAvailability(
    {
      specialization: 'Conduit',
      professionState: { energy: 16, beguilingHazeCharges: 2 }
    },
    { id: SKILL.BEGUILING_HAZE, name: 'Beguiling Haze', handlerId: 'revenant.beguiling-haze', energyCost: 20 }
  );

  assert.equal(availability.available, true);
});

test("Angsiyah's Trust waives only Energy Meld's energy cost", () => {
  const context = { config: { selectedTraitIds: [TRAIT.ANGSIYANS_TRUST] } };

  // Both catalog variants keep the trait discount without a phase-handler registration.
  for (const id of [SKILL.ENERGY_MELD, SKILL.ENERGY_MELD_ID_72058]) {
    assert.equal(applyVindicatorEnergyCostRules(context, { id }, 10), 0);
    assert.equal(applyVindicatorEnergyCostRules({ config: { selectedTraitIds: [] } }, { id }, 10), 10);
  }

  assert.equal(applyVindicatorEnergyCostRules(context, { id: SKILL.CALL_OF_THE_ALLIANCE }, 10), 10);
});
