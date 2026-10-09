import assert from 'node:assert/strict';
import test from 'node:test';
import { runMesmer, createDefaultConfig } from '#tests/helpers/mesmer-simulation.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_TRAIT_IDS as TRAIT, MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { applySkillPatch, applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';

// Role changes must affect both catalog selection and runtime equipment checks without modifying live skills.
test('preview swaps Disenchanter and Warden weapon and utility placement', () => {
  const profession = withActivePatchPreview(mesmerProfession);
  const live = profession.catalogFor('current');
  const preview = profession.catalogFor(activePatchPreview.id);
  for (const [id, type, weapon, slot] of [
    [ID.PHANTASMAL_DISENCHANTER, 'Weapon', 'Focus', 'Weapon_5'],
    [ID.PHANTASMAL_WARDEN, 'Utility', '', 'Utility']
  ]) {
    const skill = preview.skillsById.get(id);
    assert.deepEqual([skill.type, skill.weapon, skill.slot], [type, weapon, slot]);
    assert.notEqual(live.skillsById.get(id).type, type);
    const run = (secondaryWeapon, selectedSkillIds) =>
      runMesmer(
        [skill.name],
        {
          ...createDefaultConfig(),
          patchId: activePatchPreview.id,
          specialization: 'Core',
          primaryWeapon: 'Sword',
          secondaryWeapon,
          selectedSkillIds
        },
        { profession }
      );
    assert.deepEqual(run('Focus', [ID.PHANTASMAL_WARDEN]).warnings, []);
    assert.ok(run('Sword', []).warnings.length > 0);
  }
});

// Invalid placements must fail at patch validation instead of creating unselectable preview skills.
test('skill placement rejects inconsistent slots and balance-profile edits', () => {
  const catalog = mesmerProfession.catalog;
  for (const placement of [
    { type: 'Weapon', weapon: '', slot: 'Weapon_5' },
    { type: 'Weapon', weapon: 'Focus', slot: 'Utility' },
    { type: 'Utility', weapon: 'Focus', slot: 'Utility' },
    { type: 'Utility', weapon: '', slot: 'Utility', name: 'Unexpected' }
  ])
    assert.throws(
      () => applySkillPatch(catalog, { skills: { [ID.PHANTASMAL_WARDEN]: { placement } } }),
      /invalid skill placement/
    );
  assert.throws(
    () =>
      applyBalanceProfilePatch(catalog, {
        balanceProfiles: { [TRAIT.CHRONOPHANTASMA]: { placement: { type: 'Utility', weapon: '', slot: 'Utility' } } }
      }),
    /cannot change skill placement/
  );
});

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
