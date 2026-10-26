import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';

function contextFor(patch) {
  return withPatchPreview(warriorProfession, {
    id: 'warrior-tooltip-ownership',
    label: 'Warrior tooltip ownership',
    professions: { warrior: patch }
  }).resolvePatch({ id: 'warrior-tooltip-ownership' }).balanceContext;
}

function facts(context, id) {
  return describeSimulationSkill(context, context.catalog.skillsById.get(id), warriorTooltips).facts;
}

// Removing a lower tier must not relabel the surviving higher-tier payload.
test('Warrior burst tooltips retain named tier ownership after packet removal', () => {
  for (const [id, type] of [
    [ID.EVISCERATE, 'strike'],
    [ID.BLOODTHIRSTER, 'condition']
  ]) {
    const context = contextFor({ skills: { [id]: { removeEffects: [{ type, name: 'Tier 2' }] } } });
    const selected = facts(context, id);
    assert.ok(selected.some((fact) => fact.detail.includes('burst tier 1')));
    assert.ok(selected.some((fact) => fact.detail.includes('burst tier 3')));
    assert.ok(!selected.some((fact) => fact.detail.includes('burst tier 2')));
  }
});

// Presentation resolves the same action effects as combat instead of retaining removed profile payloads.
test('Warrior command and chant tooltips read selected lifecycle action effects', () => {
  const context = contextFor({
    skills: {
      [ID.FIND_THEIR_WEAKNESS]: { sideEffects: { echo: { effects: [{ type: 'boon', name: 'might', stacks: 9 }] } } },
      [ID.CHANT_OF_ACTION]: { sideEffects: { chant: { removeEffects: [{ type: 'boon', name: 'Entry Might' }] } } }
    }
  });
  assert.ok(
    facts(context, ID.FIND_THEIR_WEAKNESS).some(
      (fact) => fact.name === 'Might' && fact.stacks === 9 && fact.detail.includes('on echo')
    )
  );
  const chant = facts(context, ID.CHANT_OF_ACTION);
  assert.ok(!chant.some((fact) => fact.name === 'Might' && fact.detail.includes('on activation')));
  assert.ok(chant.some((fact) => fact.name === 'Might' && fact.detail.includes('on eligible refrain tier')));
});

// Resource policy belongs to intrinsic traits while stance duration and charge cost belong to the selected skill.
test('Warrior stance tooltips separate intrinsic trait caps from skill tuning', () => {
  const context = contextFor({
    skills: { [ID.DRAGON_TRIGGER]: { fields: { maximumCharges: 8, resourceCost: 7 } } },
    balanceProfiles: { [TRAIT.DARING_DRAGON]: { fields: { maximumStacks: 3 } } }
  });
  const selected = facts(context, ID.DRAGON_TRIGGER);
  assert.equal(selected.find((fact) => fact.name === 'Maximum Dragon charges').detail, '8');
  assert.equal(selected.find((fact) => fact.name === 'Maximum charges with Daring Dragon').detail, '3');
  assert.equal(selected.find((fact) => fact.name === 'Base Flow cost per charge opportunity').detail, '7');
});
