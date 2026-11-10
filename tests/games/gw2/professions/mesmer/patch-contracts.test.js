import assert from 'node:assert/strict';
import test from 'node:test';

import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createDefaultConfig, runMesmer, simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

// Role changes must affect both catalog selection and runtime equipment checks in the released catalog.
test('live Disenchanter and Warden enforce their new weapon and utility placement', () => {
  const profession = withActivePatchPreview(mesmerProfession);
  const live = profession.resolvePatch({ id: 'current' }).catalog;
  // The patch reused the slots' game IDs; log imports and saved builds must resolve their current names.
  assert.equal(live.skillsById.get(10267).name, 'Phantasmal Warden');
  assert.equal(live.skillsById.get(10282).name, 'Phantasmal Disenchanter');
  for (const [id, type, weapon, slot] of [
    [ID.PHANTASMAL_DISENCHANTER, 'Weapon', 'Focus', 'Weapon_5'],
    [ID.PHANTASMAL_WARDEN, 'Utility', '', 'Utility']
  ]) {
    const skill = live.skillsById.get(id);
    assert.deepEqual([skill.type, skill.weapon || '', skill.slot], [type, weapon, slot]);
    const run = (secondaryWeapon, selectedSkillIds) =>
      runMesmer(
        [skill.name],
        {
          ...createDefaultConfig(),
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

// Repeat penalties apply below the expertise cap and retain player ownership for Sharper Images.
test('Chronophantasma halves native conditions and player-owned Sharper Images only on repeat attacks', () => {
  for (const [name, primaryWeapon, secondaryWeapon] of [
    ['Phantasmal Mage', 'Sword', 'Torch'],
    ['Phantasmal Warlock', 'Staff', ''],
    ['Phantasmal Warden', 'Sword', 'Focus']
  ]) {
    for (const expertise of [0, 3000]) {
      for (const factor of [0.5, 0.25]) {
        const profession = withPatchPreview(mesmerProfession, {
          id: 'repeat-duration',
          label: 'Repeat duration',
          professions: {
            mesmer: {
              balanceProfiles: {
                [TRAIT.CHRONOPHANTASMA]: { fields: { conditionDurationMultiplier: factor } }
              }
            }
          }
        });
        const result = runMesmer(
          [name, { type: 'wait', durationMs: 20000 }],
          {
            ...createDefaultConfig(),
            patchId: 'repeat-duration',
            specialization: 'Chronomancer',
            primaryWeapon,
            secondaryWeapon,
            initialResource: 0,
            selectedTraitIds: [TRAIT.CHRONOPHANTASMA, TRAIT.SHARPER_IMAGES],
            attributeInputs: baseAttributeInputs({ precision: 3000, expertise })
          },
          { profession }
        );
        assert.deepEqual(result.warnings, []);
        const conditions = result.resolvedEvents.filter((event) => event.type === 'condition');
        const native = conditions.filter((event) => event.summonKind === 'phantasm');

        if (name !== 'Phantasmal Warden') assert.ok(native.length > 0);

        for (const repeated of native.filter((event) => event.name.includes('Chronophantasma'))) {
          const initial = native.find(
            (event) => event.condition === repeated.condition && !event.name.includes('Chronophantasma')
          );
          assert.ok(initial);
          assert.equal(repeated.duration, initial.duration * factor);
          assert.equal(repeated.effectiveDuration, initial.effectiveDuration * factor);
          assert.equal(repeated.stacks, initial.stacks);
        }

        const bleeds = conditions.filter((event) => event.traitId === TRAIT.SHARPER_IMAGES);
        assert.ok(bleeds.some((event) => event.name.includes('Chronophantasma')));
        assert.ok(bleeds.some((event) => !event.name.includes('Chronophantasma')));
        for (const bleed of bleeds) {
          const expected = 5 * (bleed.name.includes('Chronophantasma') ? factor : 1);
          assert.equal(bleed.duration, expected);
          assert.equal(bleed.effectiveDuration, expected * (expertise === 0 ? 1 : 2));
          assert.equal(bleed.actorType, 'player');
          assert.equal(bleed.sourceId, TRAIT.SHARPER_IMAGES);
          assert.equal(bleed.summonKind, undefined);
        }
      }
    }
  }
});

// The third sword action requires Swap, consumes its own window, and expires independently of the leap.
test('Disenchant requires the complete sword sequence and consumes its five-second window', () => {
  const config = {
    specialization: 'Chronomancer',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Focus',
    initialResource: 0
  };
  const result = simulateMesmer(
    ['Disenchant', 'Illusionary Leap', 'Disenchant', 'Swap', 'Disenchant', 'Disenchant'],
    config
  );
  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skillName),
    ['Illusionary Leap', 'Swap', 'Disenchant']
  );
  const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.DISENCHANT);
  assert.equal(strike.coefficient, 2.17 * 1.2);
  assert.equal(strike.actorType, 'player');
  const expired = simulateMesmer(
    ['Illusionary Leap', 'Swap', { type: 'wait', durationMs: 5000 }, 'Disenchant'],
    config
  );
  assert.ok(expired.steps.find((step) => step.skillName === 'Disenchant').invalid);
  const immobilize = expired.resolvedEvents.find(
    (event) => event.type === 'condition' && event.condition === 'Immobilized'
  );
  assert.equal(immobilize.skillId, ID.ILLUSIONARY_LEAP);
  assert.equal(immobilize.duration, 1.5);
});

// Only the summoned attack repeats; its player's projectile keeps player scaling and attribution.
test('Disenchanter separates its initial projectile from Chronophantasma attacks', () => {
  const result = simulateMesmer(['Phantasmal Disenchanter', { type: 'wait', durationMs: 8000 }], {
    specialization: 'Chronomancer',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Focus',
    initialResource: 0,
    selectedTraitIds: [TRAIT.CHRONOPHANTASMA]
  });
  assert.deepEqual(result.warnings, []);
  const attacks = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.PHANTASMAL_DISENCHANTER
  );
  const projectile = attacks.find((event) => event.actorType === 'player');
  assert.equal(projectile.coefficient, 0.8);
  assert.equal(projectile.chronophantasmaDamageFactor, undefined);
  assert.ok(attacks.some((event) => event.summonKind === 'phantasm' && event.chronophantasmaDamageFactor === 1));
  assert.ok(attacks.every((event) => event.chronophantasmaDamageFactor == null || event.actorType === 'summon'));
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
