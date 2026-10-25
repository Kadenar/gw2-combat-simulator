import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { guardianTooltips } from '#gw2/professions/guardian/app/tooltips.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

const justices = [
  ['Core', ID.JUSTICE],
  ['Dragonhunter', ID.SPEAR_OF_JUSTICE],
  ['Willbender', ID.RUSHING_JUSTICE],
  ['Firebrand', ID.TOME_OF_JUSTICE],
  ['Luminary', ID.RADIANT_JUSTICE]
];

// Core and elite Justice activations share trait admission, while their native virtue mechanics remain independent.
test('Justice Is Blind grants Light Aura and Blind for every Guardian specialization only when selected', () => {
  for (const [specialization, skillId] of justices) {
    for (const selected of [false, true]) {
      const result = runGuardian([skillId], {
        specialization,
        selectedTraitIds: selected ? [TRAIT.JUSTICE_IS_BLIND] : []
      });
      assert.deepEqual(result.warnings, []);
      const aura = result.events.find((event) => event.type === 'aura' && event.aura === 'Light Aura');
      const blind = result.events.find(
        (event) => event.type === 'condition' && event.skillId === TRAIT.JUSTICE_IS_BLIND
      );
      assert.equal(Boolean(aura), selected, specialization);
      assert.equal(Boolean(blind), selected, specialization);

      if (selected) {
        assert.equal(aura.skillId, skillId);
        assert.equal(aura.duration, 4);
        assert.equal(blind.condition, 'Blindness');
      }
    }
  }
});

test('Justice aura and Blind remain independently patchable across specializations', () => {
  for (const removed of ['aura', 'condition']) {
    const profession = withPatchPreview(guardianProfession, {
      id: 'justice-component',
      label: 'Justice component ownership',
      professions: {
        guardian: {
          balanceProfiles: {
            [TRAIT.JUSTICE_IS_BLIND]: {
              removeEffects: [{ type: removed, name: removed === 'aura' ? 'Light Aura' : 'Blind' }],
              ...(removed === 'condition' ? { effects: [{ type: 'aura', name: 'Light Aura', duration: 7 }] } : {})
            }
          }
        }
      }
    });
    for (const [specialization, id] of justices) {
      const result = runGuardian(
        [id],
        { specialization, selectedTraitIds: [TRAIT.JUSTICE_IS_BLIND], patchId: 'justice-component' },
        { profession }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.events.some((event) => event.type === 'condition' && event.skillId === TRAIT.JUSTICE_IS_BLIND),
        removed !== 'condition'
      );
      assert.equal(
        result.events.find((event) => event.type === 'aura')?.duration,
        removed === 'condition' ? 7 : undefined
      );
    }
  }
});

test('reopening dormant Tome of Justice does not repeat its trait aura', () => {
  const result = runGuardian(['Tome of Justice', 'Stow Tome', 'Tome of Justice'], {
    specialization: 'Firebrand',
    selectedTraitIds: [TRAIT.JUSTICE_IS_BLIND]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.filter((event) => event.type === 'aura').length, 1);
});

test('Justice Is Blind describes its aura without a specialization restriction', () => {
  const context = withPatchPreview(guardianProfession, null).resolvePatch().balanceContext;
  const tooltip = guardianTooltips.traits[TRAIT.JUSTICE_IS_BLIND](context, { id: TRAIT.JUSTICE_IS_BLIND });
  assert.match(tooltip.description, /blinds the target for 3 seconds/);
  assert.match(tooltip.description, /grants you a light aura for 4 seconds/);
  assert.doesNotMatch(tooltip.description, /Luminary/);
  const aura = tooltip.facts.find((fact) => fact.name === 'Light Aura');
  assert.ok(aura);
  assert.doesNotMatch(aura.detail, /Luminary/);

  const patched = withPatchPreview(guardianProfession, {
    id: 'justice-tooltip',
    label: 'Justice tooltip durations',
    professions: {
      guardian: {
        balanceProfiles: {
          [TRAIT.JUSTICE_IS_BLIND]: {
            effects: [
              { type: 'condition', name: 'Blind', duration: 5 },
              { type: 'aura', name: 'Light Aura', duration: 7 }
            ]
          }
        }
      }
    }
  }).resolvePatch({ id: 'justice-tooltip' }).balanceContext;
  const selected = guardianTooltips.traits[TRAIT.JUSTICE_IS_BLIND](patched, { id: TRAIT.JUSTICE_IS_BLIND });
  assert.match(selected.description, /blinds the target for 5 seconds/);
  assert.match(selected.description, /light aura for 7 seconds/);
});
