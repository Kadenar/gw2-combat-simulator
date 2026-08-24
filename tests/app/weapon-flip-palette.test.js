import assert from 'node:assert/strict';
import test from 'node:test';

import { displayedFlipSkills } from '../../js/app/rotation/palette/model.js';
import { engineerCatalog } from '../../js/professions/engineer/catalog.js';
import { guardianCatalog } from '../../js/professions/guardian/catalog.js';
import { necromancerCatalog } from '../../js/professions/necromancer/catalog.js';
import { rangerCatalog } from '../../js/professions/ranger/catalog.js';
import { revenantCatalog } from '../../js/professions/revenant/catalog.js';
import { thiefCatalog } from '../../js/professions/thief/catalog.js';

const AUDITED_WEAPON_FLIPS = Object.freeze([
  [thiefCatalog, "Infiltrator's Strike", "Infiltrator's Return"],
  [thiefCatalog, 'Cluster Bomb', 'Detonate Cluster'],
  [thiefCatalog, 'Debilitating Arc', 'Helmet Breaker'],
  [thiefCatalog, "Sniper's Cover", "Death's Advance"],
  [engineerCatalog, 'Lightning Rod', 'Electric Artillery'],
  [necromancerCatalog, 'Ravenous Wave', 'Satiate'],
  [necromancerCatalog, 'Path of Gluttony', 'Gorge'],
  [necromancerCatalog, 'Hungering Maelstrom', 'Gormandize'],
  [necromancerCatalog, 'Devouring Visage', 'Consume'],
  [necromancerCatalog, 'Isolate', 'Distress'],
  [rangerCatalog, 'Counterattack', 'Counterattack Kick'],
  [rangerCatalog, "Mongoose's Frenzy", "Wolf's Onslaught"],
  [rangerCatalog, "Falcon's Stoop", "Owl's Flight"],
  [rangerCatalog, "Warclaw's Engage", "Predator's Ambush"],
  [rangerCatalog, "Panther's Prowl", "Spider's Web"],
  [guardianCatalog, "Zealot's Flame", "Zealot's Fire"],
  [guardianCatalog, 'Shield of Absorption', 9224],
  [guardianCatalog, 'Dazzling Hammer', 'Shining Spin'],
  [guardianCatalog, 'Luminous Staff', 'Restorative Glow'],
  [guardianCatalog, 'Gleaming Blade', 'Lucent Thrust'],
  [guardianCatalog, 'Radiant Bulwark', 'Brilliant Slam'],
  [revenantCatalog, 'Blossoming Aura', 'Detonate Blossoming Aura'],
  [revenantCatalog, 'Otherworldly Bond', 'Deactivate Otherworldly Bond']
]);

function catalogSkill(catalog, identity) {
  return typeof identity === 'number' ? catalog.skillsById.get(identity) : catalog.skillsByName.get(identity);
}

test('audited weapon flip families project one live palette identity', () => {
  for (const [catalog, parentIdentity, childIdentity] of AUDITED_WEAPON_FLIPS) {
    const parent = catalogSkill(catalog, parentIdentity);
    const child = catalogSkill(catalog, childIdentity);
    const app = {
      skills: catalog.skills,
      skillById: catalog.skillsById,
      profession: { catalog },
      results: {
        endState: {
          time: 0,
          profession: { availableFlips: {} }
        }
      }
    };

    assert.ok(parent, `missing audited parent ${parentIdentity}`);
    assert.ok(child, `missing audited child ${childIdentity}`);
    assert.deepEqual(
      displayedFlipSkills(app, [parent]).map((skill) => skill.id),
      [parent.id],
      `${parent.name} should display before its follow-up is armed`
    );

    app.results.endState.profession.availableFlips[child.id] = true;
    assert.deepEqual(
      displayedFlipSkills(app, [parent]).map((skill) => skill.id),
      [child.id],
      `${child.name} should replace ${parent.name} while armed`
    );
  }
});
