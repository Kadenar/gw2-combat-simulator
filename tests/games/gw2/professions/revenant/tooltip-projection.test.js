import assert from 'node:assert/strict';
import test from 'node:test';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';

// Reuse and mutate one build to catch stale cached landings after a trait selection changes.
test('Vindicator dodge tooltips show only the selected landing and trait descriptions', () => {
  const build = { specializations: [{ name: 'Vindicator', traits: '1-1-1' }] };
  for (const skillId of [VINDICATOR_JUMP_SKILL.id, SHARED_SKILL_IDS.DODGE]) {
    const skill = revenantProfession.catalog.skillsById.get(skillId);
    for (const [choice, landing, names] of [
      [1, 'Death Drop', ['Strike damage', 'Vulnerability']],
      [2, 'Imperial Impact', ['Strike damage', 'Might', 'Protection']],
      [3, "Saint's Shield", ['Alacrity']],
      [1, 'Death Drop', ['Strike damage', 'Vulnerability']]
    ]) {
      build.specializations[0].traits = `1-1-${choice}`;
      const model = revenantAppAdapter.skillTooltip(skill, 'current', build);
      assert.ok(!model.incomplete);
      assert.deepEqual(
        model.facts.map(({ name }) => name),
        [...names, 'Endurance spent']
      );
      assert.match(model.description, new RegExp(landing));
      assert.match(model.description, /Reaver's Curse/);
      assert.equal(model.description.includes('Forerunner of Death'), choice === 1);
      assert.equal(revenantAppAdapter.skillTooltip(skill, 'current', build), model);
    }

    build.specializations[0].traits = '1-2-3';
    assert.doesNotMatch(revenantAppAdapter.skillTooltip(skill, 'current', build).description, /Reaver's Curse/);
  }
});
