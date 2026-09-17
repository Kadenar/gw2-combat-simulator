import assert from 'node:assert/strict';
import test from 'node:test';

import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';
import { revenantCatalog } from '#gw2/professions/revenant/profession.js';
import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';

// Results inherit catalog artwork so asset updates do not require a second list of URLs.
test('Revenant proc and skill results inherit their catalog icons', () => {
  const app = {
    skillByName: revenantCatalog.skillsByName,
    skills: revenantCatalog.skills,
    results: { procSteps: [] }
  };

  for (const skillId of [SKILL.CALL_OF_THE_DEMON, SKILL.CALL_OF_THE_DRAGON, SKILL.DEATH_DROP]) {
    const skill = revenantCatalog.skillsById.get(skillId);

    assert.ok(skill.icon, skill.name);
    assert.equal(resultSkillIcon(app, { name: skill.name }), skill.icon);
  }
});
