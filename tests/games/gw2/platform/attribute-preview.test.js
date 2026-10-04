import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';

// All preview phases must select the same Core/elite/family owners, without initializing sibling state.
test('attribute preview controls, build adjustments, and preparation select the active owners', () => {
  const slice = (key, disabledTrait = null) => ({
    previewControls: () => [{ key, kind: 'special' }],
    attributePreviewDisabledTrait: () => disabledTrait,
    prepareAttributePreview: (context) => context.events.push(key)
  });
  const ui = normalizeProfessionUi(
    'fixture',
    createProfessionFamilyUi({
      catalog: {
        specializations: [
          { name: 'First', elite: true },
          { name: 'Second', elite: true }
        ]
      },
      core: slice('core'),
      specializations: { First: slice('first', 'First Trait'), Second: slice('second', 'Second Trait') },
      family: slice('family')
    })
  );
  for (const [specialization, owners, disabledTrait] of [
    ['Core', ['core', 'family'], null],
    ['First', ['core', 'first', 'family'], 'First Trait'],
    ['Second', ['core', 'second', 'family'], 'Second Trait']
  ]) {
    const context = { specialization, events: [] };
    assert.deepEqual(
      ui.previewControls(context).map(({ key }) => key),
      owners
    );
    assert.equal(ui.attributePreviewDisabledTrait(context), disabledTrait);
    ui.prepareAttributePreview(context);
    assert.deepEqual(context.events, owners);
  }
});

// Each key represents one input; duplicate owners must fail before normalization discards either value.
test('attribute preview composition rejects duplicate control keys', () => {
  const ui = createProfessionFamilyUi({
    catalog: { specializations: [] },
    core: { previewControls: () => [{ key: 'shared' }] },
    specializations: {},
    family: { previewControls: () => [{ key: 'shared' }] }
  });
  assert.throws(() => ui.previewControls({}), /duplicate key shared/);
});

// Professions without conditional previews retain empty projections and cannot accidentally mutate query inputs.
test('attribute preview hooks normalize to no-ops and validate callback declarations', () => {
  const ui = normalizeProfessionUi('fixture');
  const context = Object.freeze({});
  assert.deepEqual(ui.previewControls(context), []);
  assert.equal(ui.attributePreviewDisabledTrait(context), null);
  assert.equal(ui.prepareAttributePreview(context), undefined);
  for (const name of ['previewControls', 'attributePreviewDisabledTrait', 'prepareAttributePreview'])
    assert.throws(() => normalizeProfessionUi('fixture', { [name]: [] }), /must be a function/);
});
