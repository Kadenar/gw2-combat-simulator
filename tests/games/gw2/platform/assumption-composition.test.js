import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assumptionControlsForSpecialization,
  createProfessionAssumptionControls,
  normalizeProfessionAssumptions,
  validateProfessionAssumptions
} from '#gw2/platform/builds/assumptions.js';
import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';

const catalog = { specializations: [{ name: 'Elite', elite: true }] };
const control = (key, extra = {}) =>
  createProfessionAssumptionControls([{ key, label: key, type: 'boolean', defaultValue: false, ...extra }]);

// Separate module declarations must not claim the same saved assumption key.
test('assumption composition rejects duplicate keys from core, elite, and family owners', () => {
  for (const duplicateOwner of ['core', 'elite', 'family']) {
    const definition = {
      catalog,
      core: { assumptionControls: control('sharedFlag') },
      specializations: { Elite: { assumptionControls: control('eliteFlag', { specializations: ['Elite'] }) } },
      family: { assumptionControls: control('familyFlag') }
    };
    const owner = duplicateOwner === 'elite' ? definition.specializations.Elite : definition[duplicateOwner];
    owner.assumptionControls = [...owner.assumptionControls, ...control('sharedFlag', { defaultValue: true })];
    assert.throws(
      () => createProfessionFamilyUi(definition),
      /ui\.assumptionControls returned duplicate key sharedFlag/
    );
  }
});

// Valid composed controls retain defaults and specialization visibility for their existing consumers.
test('unique composed assumption controls preserve normalization and specialization scope', () => {
  const { assumptionControls } = createProfessionFamilyUi({
    catalog,
    core: { assumptionControls: control('coreFlag') },
    specializations: {
      Elite: { assumptionControls: control('eliteFlag', { defaultValue: true, specializations: ['Elite'] }) }
    },
    family: { assumptionControls: control('familyFlag') }
  });
  const core = assumptionControlsForSpecialization(assumptionControls, 'Core');
  const elite = assumptionControlsForSpecialization(assumptionControls, 'Elite');
  assert.deepEqual(new Set(core.map(({ key }) => key)), new Set(['coreFlag', 'familyFlag']));
  assert.deepEqual(new Set(elite.map(({ key }) => key)), new Set(['coreFlag', 'eliteFlag', 'familyFlag']));
  const values = normalizeProfessionAssumptions({ coreFlag: true }, elite);
  assert.deepEqual(values, { coreFlag: true, eliteFlag: true, familyFlag: false });
  assert.deepEqual(validateProfessionAssumptions(values, elite), []);
});
