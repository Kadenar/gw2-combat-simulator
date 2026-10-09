import assert from 'node:assert/strict';
import test from 'node:test';
import { runMesmer, createDefaultConfig } from '#tests/helpers/mesmer-simulation.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';

// A single summon isolates the repeat's strike multiplier from the original attack and trait selection.
test('Chronophantasma preview reduces only resummoned phantasm strikes from 105% to 100%', () => {
  const profession = withActivePatchPreview(mesmerProfession);
  const config = {
    ...createDefaultConfig(),
    specialization: 'Chronomancer',
    initialResource: 0,
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    selectedTraitIds: [TRAIT.CHRONOPHANTASMA]
  };
  const rotation = ['Phantasmal Lancer', { type: 'wait', durationMs: 6000 }];
  const run = (patchId, selectedTraitIds = config.selectedTraitIds) =>
    runMesmer(rotation, { ...config, patchId, selectedTraitIds }, { profession });
  const live = run('current');
  const preview = run(activePatchPreview.id);
  const strike = (result, repeated) =>
    result.resolvedEvents.find(
      (event) =>
        event.type === 'damage' && event.source === 'Phantasm' && event.name.includes('Chronophantasma') === repeated
    );
  assert.deepEqual(live.warnings, []);
  assert.deepEqual(preview.warnings, []);
  assert.ok(strike(live, true)?.damage > 0);
  assert.ok(strike(preview, true)?.damage > 0);
  assert.equal(strike(preview, false).damage, strike(live, false).damage);
  assert.equal(strike(live, true).multiplier, 1.05);
  assert.equal(strike(preview, true).multiplier, 1);
  // Resolved strikes round to whole damage; compare the multiplier without requiring fractional damage output.
  assert.ok(Math.abs(strike(preview, true).damage - strike(live, true).damage / 1.05) < 1);
  const untraited = run(activePatchPreview.id, []);
  assert.equal(strike(untraited, true), undefined);
  assert.equal(strike(untraited, false).damage, strike(preview, false).damage);
});
