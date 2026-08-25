import assert from 'node:assert/strict';
import test from 'node:test';

import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '../../../js/professions/revenant/data/ids.js';
import { applyConduitEnergyCostRules } from '../../../js/professions/revenant/specializations/conduit/energy.js';
import { applyVindicatorEnergyCostRules } from '../../../js/professions/revenant/specializations/vindicator/energy.js';

test('Beguiling Haze follow-up charges waive only Beguiling Haze energy costs', () => {
  const context = {
    professionState: {
      beguilingHazeCharges: 2,
      energyCostOverrides: {}
    }
  };

  assert.equal(
    applyConduitEnergyCostRules(context, { id: SKILL.BEGUILING_HAZE, handlerId: 'revenant.beguiling-haze' }, 20),
    0
  );
  assert.equal(
    applyConduitEnergyCostRules(context, { id: SKILL.HEX_EATER_VORTEX, handlerId: 'revenant.hex-eater-vortex' }, 15),
    15
  );
  assert.equal(
    applyConduitEnergyCostRules(
      { professionState: { beguilingHazeCharges: 0, energyCostOverrides: {} } },
      { id: SKILL.BEGUILING_HAZE, handlerId: 'revenant.beguiling-haze' },
      20
    ),
    20
  );
});

test("Angsiyah's Trust waives only Energy Meld's energy cost", () => {
  const context = { config: { selectedTraitIds: [TRAIT.ANGSIYANS_TRUST] } };

  assert.equal(
    applyVindicatorEnergyCostRules(context, { id: SKILL.ENERGY_MELD, handlerId: 'revenant.energy-meld' }, 10),
    0
  );
  assert.equal(applyVindicatorEnergyCostRules(context, { id: SKILL.CALL_OF_THE_ALLIANCE }, 10), 10);
  assert.equal(
    applyVindicatorEnergyCostRules(
      { config: { selectedTraitIds: [] } },
      { id: SKILL.ENERGY_MELD, handlerId: 'revenant.energy-meld' },
      10
    ),
    10
  );
});
