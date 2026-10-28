import assert from 'node:assert/strict';
import test from 'node:test';

import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';

// Role changes must affect both catalog selection and runtime equipment checks without modifying live skills.
test('preview swaps Disenchanter and Warden weapon and utility placement', () => {
  const profession = withActivePatchPreview(mesmerProfession);
  const live = profession.resolvePatch({ id: 'current' }).catalog;
  const preview = profession.resolvePatch({ id: activePatchPreview.id }).catalog;
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
