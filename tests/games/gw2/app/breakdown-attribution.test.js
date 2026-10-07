import assert from 'node:assert/strict';
import test from 'node:test';
import {
  skillBreakdownRows,
  skillDamageIdentityKey,
  skillDamageKeyByIdentity
} from '#gw2/app/results/skill-breakdown.js';
import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { ENGINEER_SKILL_IDS as SKILL, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

// One trait can apply the same condition from different triggers; a trigger without a skill ID must stay independent.
test('same-named trait applications do not lend a skill ID or icon to another trigger', () => {
  const triggers = [{ skillName: 'Fire Bomb', skillId: SKILL.FIRE_BOMB }, { skillName: 'Photonic Blasting Module' }];
  for (const ordered of [triggers, [...triggers].reverse()]) {
    const result = runEngineer(
      [{ type: 'combat-start' }, { type: 'wait', durationMs: 4000 }],
      {},
      {
        timeline: ordered.map((trigger, at) => ({
          at,
          run(runtime) {
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'condition',
                at,
                name: 'Solar Focusing Lens — Burning',
                sourceId: TRAIT.SOLAR_FOCUSING_LENS,
                source: 'Trait',
                actorType: 'player',
                condition: 'Burning',
                stacks: 1,
                duration: 2,
                ...trigger
              }
            });
          }
        }))
      }
    );
    assert.deepEqual(result.warnings, []);
    const rows = skillBreakdownRows(result);
    const fire = rows.find((row) => row.name === 'Fire Bomb');
    const blast = rows.find((row) => row.name === 'Photonic Blasting Module');
    assert.equal(fire.skillId, SKILL.FIRE_BOMB);
    assert.equal(blast.skillId, null);
    assert.equal(blast.sourceId, TRAIT.SOLAR_FOCUSING_LENS);
    const rawBlast = result.breakdown.find((entry) => entry.sourceSkill === blast.name);
    assert.equal(rawBlast.skillId, null);

    const icons = {
      results: result,
      skills: [],
      skillById: new Map([[SKILL.FIRE_BOMB, { icon: 'fire-bomb.png' }]]),
      skillByName: new Map(),
      attributeData: { activeTraits: [{ name: 'Photonic Blasting Module', icon: 'photonic-blasting-module.png' }] }
    };
    assert.equal(resultSkillIcon(icons, fire), 'fire-bomb.png');
    assert.equal(resultSkillIcon(icons, blast), 'photonic-blasting-module.png');
    const keys = skillDamageKeyByIdentity(result);
    for (const application of result.resolvedEvents.filter((event) => event.type === 'condition')) {
      assert.equal(
        keys.get(skillDamageIdentityKey({ ...application, parentSkill: application.parentSkillName })),
        `Player|${application.skillName}`
      );
    }
  }
});

// Display grouping may combine contributions, but chart attribution must retain each actor, summon subtype, and parent.
test('same-named contributions retain their own parent, actor, display label, and explicit icon', () => {
  const identities = [
    { actorType: 'player', parentSkill: '', damageBreakdownName: 'Player effect', icon: '' },
    {
      actorType: 'summon',
      summonKind: 'clone',
      parentSkill: 'Summon A',
      damageBreakdownName: 'Clone effect',
      icon: 'clone.png'
    },
    {
      actorType: 'summon',
      summonKind: 'phantasm',
      parentSkill: 'Summon A',
      damageBreakdownName: 'Phantasm effect',
      icon: 'phantasm.png'
    },
    {
      actorType: 'summon',
      summonKind: 'phantasm',
      parentSkill: 'Summon B',
      damageBreakdownName: 'Other parent',
      icon: 'other.png'
    },
    { actorType: 'environment', parentSkill: '', damageBreakdownName: 'Environment effect', icon: '' }
  ];
  const breakdown = identities.map((identity) => ({
    name: 'Shared effect',
    sourceSkill: 'Shared effect',
    skillId: 1,
    sourceId: 1,
    damage: 10,
    strikeDamage: 10,
    conditionDamage: 0,
    hits: 1,
    ...identity
  }));
  const result = {
    breakdown,
    // A same-named observation must not fill a deliberate empty parent or icon in any contribution.
    resolvedEvents: [
      {
        type: 'damage',
        name: 'Shared effect',
        skillId: 1,
        actorType: 'summon',
        parentSkillName: 'Unrelated',
        icon: 'unrelated.png'
      }
    ],
    dpsWindow: 1
  };
  const rows = skillBreakdownRows(result);
  const keys = skillDamageKeyByIdentity(result);
  assert.equal(keys.size, identities.length);
  for (const entry of breakdown) {
    const row = rows.find((candidate) => candidate.name === entry.damageBreakdownName);
    assert.equal(row.parentSkill, entry.parentSkill);
    assert.equal(row.actorType, entry.actorType);
    assert.equal(row.icon, entry.icon);
    assert.equal(
      row.group,
      entry.actorType === 'summon' ? 'Entities' : entry.actorType === 'environment' ? 'Environment' : 'Player'
    );
    assert.equal(keys.get(skillDamageIdentityKey(entry)), row.key);
    if (entry.icon) assert.equal(resultSkillIcon({}, row), entry.icon);
  }
});
