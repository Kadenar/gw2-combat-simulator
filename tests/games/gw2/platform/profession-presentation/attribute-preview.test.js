import assert from 'node:assert/strict';
import test from 'node:test';

import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';
import { professionUiFixture } from '#tests/helpers/presentation.js';

// All preview phases must select the same Core/elite/family owners, without initializing sibling state.
test('attribute preview controls, build adjustments, and preparation select the active owners', () => {
  const slice = (key) => ({
    previewControls: () => [{ key, kind: 'special' }],
    prepareAttributePreview: (context) => context.events.push(key)
  });
  const ui = createProfessionFamilyUi({
    professionId: 'fixture',
    catalog: {
      specializations: [
        { name: 'First', elite: true },
        { name: 'Second', elite: true }
      ]
    },
    core: slice('core'),
    specializations: { First: slice('first'), Second: slice('second') },
    family: slice('family')
  });
  for (const [specialization, owners] of [
    ['Core', ['core', 'family']],
    ['First', ['core', 'first', 'family']],
    ['Second', ['core', 'second', 'family']]
  ]) {
    const context = { specialization, events: [] };
    assert.deepEqual(
      ui.previewControls(context).map(({ key }) => key),
      owners
    );
    ui.prepareAttributePreview(context);
    assert.deepEqual(context.events, owners);
  }
});

// Each key represents one input; composition must reject duplicate owners rather than discard a value.
test('attribute preview composition rejects duplicate control keys', () => {
  const ui = createProfessionFamilyUi({
    professionId: 'fixture',
    catalog: { specializations: [] },
    core: { previewControls: () => [{ key: 'shared' }] },
    specializations: {},
    family: { previewControls: () => [{ key: 'shared' }] }
  });
  assert.throws(() => ui.previewControls({}), /duplicate key shared/);
});

// Professions without conditional previews retain empty projections and cannot accidentally mutate query inputs.
test('unowned attribute preview hooks default to no-ops', () => {
  const ui = professionUiFixture();
  const context = Object.freeze({});
  assert.deepEqual(ui.previewControls(context), []);
  assert.equal(ui.prepareAttributePreview(context), undefined);
});
