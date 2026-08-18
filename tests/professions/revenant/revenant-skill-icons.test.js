import assert from 'node:assert/strict';
import test from 'node:test';

import { resultSkillIcon } from '../../../js/app/rotation/icons.js';
import { revenantCatalog } from '../../../js/professions/revenant/catalog.js';
import { REVENANT_SKILL_IDS as SKILL } from '../../../js/professions/revenant/data/ids.js';

const EXPECTED_CALL_ICONS = new Map([
  [SKILL.CALL_OF_THE_DEMON, 'https://render.guildwars2.com/file/1A1407F7D34E5ED41B59A25F39EBF728CC926423/961413.png'],
  [SKILL.CALL_OF_THE_DRAGON, 'https://render.guildwars2.com/file/27B5D1D4127A2EE73866E54F5A43E9102618B90B/1058605.png']
]);
const DEATH_DROP_ICON = 'https://render.guildwars2.com/file/2864D963D3FC9156E6F52FA95DD34C2DE30306BE/2491537.png';

test('Song of the Mists calls use valid catalog icons in damage results', () => {
  const app = {
    skillByName: revenantCatalog.skillsByName,
    skills: revenantCatalog.skills,
    results: { procSteps: [] }
  };

  for (const [skillId, expectedIcon] of EXPECTED_CALL_ICONS) {
    const skill = revenantCatalog.skillsById.get(skillId);
    assert.equal(skill.icon, expectedIcon);
    assert.equal(resultSkillIcon(app, { name: skill.name }), expectedIcon);
  }
});

test('Death Drop uses its valid catalog icon in damage results', () => {
  const app = {
    skillByName: revenantCatalog.skillsByName,
    skills: revenantCatalog.skills,
    results: { procSteps: [] }
  };
  const skill = revenantCatalog.skillsById.get(SKILL.DEATH_DROP);

  assert.equal(skill.icon, DEATH_DROP_ICON);
  assert.equal(resultSkillIcon(app, { name: skill.name }), DEATH_DROP_ICON);
});
