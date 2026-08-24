import assert from 'node:assert/strict';
import test from 'node:test';

import { resultSkillIcon } from '../../js/app/rotation/shared/icons.js';
import { FOOD_DATA, NOURISHMENT_ICON, SIGIL_DATA } from '../../js/platform/gw2/gear-data.js';

const app = {
  attributeData: { activeTraits: [] },
  results: { procSteps: [] },
  skillByName: new Map(),
  skills: []
};

test('common modifier contributions use their canonical icons', () => {
  assert.equal(
    resultSkillIcon(app, { id: 'Boon:Might', name: 'Might' }),
    'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Might.png'
  );
  assert.equal(
    resultSkillIcon(app, { id: 'Boon:Fury', name: 'Fury' }),
    'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fury.png'
  );
  assert.equal(
    resultSkillIcon(app, {
      id: 'Target:Vulnerability',
      name: 'Vulnerability'
    }),
    'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Vulnerability.png'
  );
  assert.equal(resultSkillIcon(app, { id: 'Sigil:Force', name: 'Sigil of Force' }), SIGIL_DATA.Force.icon);
  assert.equal(
    resultSkillIcon(app, {
      id: 'Sigil:Accuracy',
      name: 'Sigil of Accuracy'
    }),
    SIGIL_DATA.Accuracy.icon
  );
  assert.equal(
    resultSkillIcon(app, {
      id: 'Food:Salsa Eggs Benedict',
      name: 'Food: Nourishment'
    }),
    NOURISHMENT_ICON
  );
  assert.equal(
    resultSkillIcon(app, {
      id: 'Food:Ghost Pepper Popper',
      name: 'Food: Ghost Pepper Popper'
    }),
    FOOD_DATA['Ghost Pepper Popper'].icon
  );
});
