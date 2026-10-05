import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { skillAuthoringReference } from '#gw2/integrations/patches/authoring/fields.js';
import { applySkillPatch, normalizeAuthoringSkillEdit } from '#gw2/integrations/patches/authoring/patches.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import { castResourceGrants, effectResourceGrants } from '#gw2/platform/effects/resource-grants.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS } from '#gw2/professions/thief/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS } from '#gw2/professions/warrior/data/ids.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';

// Real skill declarations must survive editor serialization and deliver the edited amount through their existing action.
for (const [profession, skillId, grantId, resource, from, to, effectIndex] of [
  [warriorProfession, WARRIOR_SKILL_IDS.TO_THE_LIMIT, 'endurance-restored', 'endurance', 100, 70, null],
  [thiefProfession, THIEF_SKILL_IDS.CUNNING_SALVO, 'initiative-refunded', 'initiative', 2, 3, 0],
  [thiefProfession, THIEF_SKILL_IDS.MALICIOUS_CUNNING_SALVO, 'initiative-refunded', 'initiative', 2, 4, 0]
]) {
  test(`${profession.catalog.skillsById.get(skillId).name} grant edits round-trip and reach dispatch`, () => {
    const skill = profession.catalog.skillsById.get(skillId);
    const resourceGrants = { [grantId]: { amount: { from, to } } };
    const edit = effectIndex == null ? { resourceGrants } : { effects: [{ effectIndex, resourceGrants }] };
    const reference = structuredClone(skillAuthoringReference(skill));
    assert.deepEqual(normalizeAuthoringSkillEdit(reference, edit), edit);
    const catalog = applySkillPatch(profession.catalog, { skills: { [skillId]: edit } });
    const patched = catalog.skillsById.get(skillId);
    const grants = (owner) =>
      effectIndex == null ? castResourceGrants(owner) : effectResourceGrants(owner.effects[effectIndex]);
    const action = grants(patched).find(({ id }) => id === grantId);
    assert.equal(grants(skill).find(({ id }) => id === grantId).amount, from);
    assert.equal(action.amount, to);
    assert.ok(action.label);
    const received = [];
    applySideEffect(
      {
        endurance: { grant: (amount) => received.push(['endurance', amount]) },
        resourceController: { grant: (key, amount) => received.push([key, amount]) }
      },
      { kind: effectIndex == null ? 'cast' : 'effect', skill: patched },
      action
    );
    assert.deepEqual(received, [[resource, to]]);
    assert.throws(() => applySkillPatch(catalog, { skills: { [skillId]: edit } }), /expected live value/);
    if (effectIndex == null) {
      const tooltip = describeSimulationSkill({ catalog }, patched, warriorTooltips);
      assert.equal(tooltip.facts.find(({ name }) => name === 'Endurance restored').detail, String(to));
    }
  });
}

// Routed facts explain Bladesworn conversion; fixed adrenaline grants retain their own label and live amount.
test('Warrior tooltip facts read current combat-resource actions and direct grants', () => {
  const catalog = warriorProfession.catalog;
  for (const [skillId, type, name] of [
    [WARRIOR_SKILL_IDS.TO_THE_LIMIT, 'warrior.grant-combat-resource', 'Adrenaline gained (Flow for Bladesworn)'],
    [WARRIOR_SKILL_IDS.HEAD_BUTT, 'resourceGrant', 'Adrenaline gained']
  ]) {
    const source = catalog.skillsById.get(skillId);
    const skill = {
      ...source,
      sideEffects: source.sideEffects.map((rule) =>
        rule.do.type === type ? { ...rule, do: { ...rule.do, amount: 17 } } : rule
      )
    };
    const tooltip = describeSimulationSkill({ catalog }, skill, warriorTooltips);
    assert.equal(tooltip.facts.find((fact) => fact.name === name).detail, '17');
  }
});
