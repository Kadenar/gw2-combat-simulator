import assert from 'node:assert/strict';
import test from 'node:test';

import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { SHARED_STATE_IDS as STATE } from '#gw2/platform/results/state-ids.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import { guardianCatalog } from '#gw2/professions/guardian/profession.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { revenantCatalog } from '#gw2/professions/revenant/profession.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { paletteInputFixture } from '#tests/helpers/palette.js';

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
  return typeof identity === 'number'
    ? catalog.skillsById.get(identity)
    : catalog.skills.find((candidate) => candidate.name === identity);
}

test('audited weapon flip families project one live palette identity', () => {
  for (const [catalog, parentIdentity, childIdentity] of AUDITED_WEAPON_FLIPS) {
    const parent = catalogSkill(catalog, parentIdentity);
    const child = catalogSkill(catalog, childIdentity);
    const input = paletteInputFixture({
      catalog: catalog,
      planning: {
        atSeconds: 0,

        profession: { ...{}, [STATE.AVAILABLE_FLIPS]: {} }
      }
    });

    assert.ok(parent, `missing audited parent ${parentIdentity}`);
    assert.ok(child, `missing audited child ${childIdentity}`);
    assert.deepEqual(
      displayedSkillTiles(input, [parent]).map((skill) => skill.id),
      [parent.id],
      `${parent.name} should display before its follow-up is armed`
    );

    input.planning.profession[STATE.AVAILABLE_FLIPS][child.id] = armSkillFlip({}, 0, 0, Infinity);
    assert.deepEqual(
      displayedSkillTiles(input, [parent]).map((skill) => skill.id),
      [child.id],
      `${child.name} should replace ${parent.name} while armed`
    );
  }
});
