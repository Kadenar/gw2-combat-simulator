import assert from 'node:assert/strict';
import test from 'node:test';

import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
import { previewControlScopes } from '#gw2/platform/profession-presentation/attribute-preview.js';

function familyUi(core, elite, family = {}) {
  return normalizeProfessionUi(
    'fixture',
    createProfessionFamilyUi({
      catalog: { specializations: [{ name: 'Elite', elite: true }] },
      core,
      specializations: { Elite: elite },
      family
    })
  );
}

test('skill damage groups merge across active slices and reject duplicate ids', () => {
  const ui = familyUi(
    { skillDamageGroups: () => [{ id: 'core', title: 'Core', skillIds: [1] }] },
    { skillDamageGroups: () => [{ id: 'elite', title: 'Elite', skillIds: [2] }] }
  );
  assert.deepEqual(
    ui.skillDamageGroups({ specialization: 'Elite' }).map(({ id }) => id),
    ['core', 'elite']
  );
  assert.deepEqual(
    ui.skillDamageGroups({ specialization: 'Core' }).map(({ id }) => id),
    ['core']
  );
  const duplicate = familyUi(
    { skillDamageGroups: () => [{ id: 'same', title: 'Core', skillIds: [1] }] },
    { skillDamageGroups: () => [{ id: 'same', title: 'Elite', skillIds: [2] }] }
  );
  assert.throws(() => duplicate.skillDamageGroups({ specialization: 'Elite' }), /duplicate id same/);
});

test('the elite answers skill damage probes before Core, and preparation merges every active slice in order', () => {
  const ui = familyUi(
    {
      skillDamageProbe: () => ({ context: 'core' }),
      prepareSkillDamagePreview: () => ({ shared: 'core', core: true })
    },
    {
      skillDamageProbe: (_context, skill) => (skill.id === 2 ? { context: 'elite' } : null),
      prepareSkillDamagePreview: () => ({ shared: 'elite', elite: true })
    },
    { prepareSkillDamagePreview: () => ({ family: true }) }
  );
  const context = { specialization: 'Elite' };
  assert.deepEqual(ui.skillDamageProbe(context, { id: 2 }), { context: 'elite' });
  assert.deepEqual(ui.skillDamageProbe(context, { id: 1 }), { context: 'core' });
  assert.deepEqual(ui.prepareSkillDamagePreview({ ...context, values: {} }), {
    shared: 'elite',
    core: true,
    elite: true,
    family: true
  });
  assert.equal(ui.skillDamageProbe({ specialization: 'Core' }, { id: 2 }).context, 'core');
});

test('preview controls default to both panels, except special controls owned by their profession', () => {
  assert.deepEqual(previewControlScopes({ kind: 'buff' }), ['attributes', 'damage']);
  assert.deepEqual(previewControlScopes({ kind: 'special' }), ['attributes']);
  assert.deepEqual(previewControlScopes({ kind: 'special', scope: ['damage'] }), ['damage']);
});
