import assert from 'node:assert/strict';
import test from 'node:test';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { WEAVER_SPEAR_FOLLOWUPS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/spear.js';

const skills = Object.keys(WEAVER_SPEAR_FOLLOWUPS).map((id) => elementalistCatalog.skillsById.get(Number(id)));
const wait = (durationMs) => ({ type: 'wait', durationMs });
const cast = (skillId, fields = {}) => ({ type: 'cast', skillId, ...fields });

// Minimal native scenarios isolate buff ownership and impact ordering without relying on a saved rotation.
function run(skill, rotation, options = {}) {
  const [startAttunement, secondaryAttunement] = skill.attunement.split('+');
  return runElementalist(
    rotation,
    {
      specialization: 'Weaver',
      primaryWeapon: 'Spear',
      startAttunement,
      secondaryAttunement,
      selectedTraitIds: [],
      selectedSkillIds: [ID.ARCANE_BLAST]
    },
    options
  );
}

const strikes = (result, id) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === id);
const liveBuffs = (result, kind, at) => observedRuntime(result).mechanics.combat.activeBuffStacks(kind, at);

test('all spear duals arm without damage and consume once on a non-spear strike', () => {
  for (const skill of skills) {
    const armed = run(skill, [cast(skill.id), wait(1000)]);
    assert.deepEqual(armed.warnings, [], skill.name);
    assert.deepEqual(strikes(armed, skill.id), [], skill.name);
    assert.equal(liveBuffs(armed, WEAVER_SPEAR_FOLLOWUPS[skill.id], 1), 1);

    const result = run(skill, [cast(skill.id), wait(1000), cast(ID.ARCANE_BLAST), wait(1000), cast(ID.ARCANE_BLAST)]);
    assert.deepEqual(result.warnings, [], skill.name);
    const [trigger] = strikes(result, ID.ARCANE_BLAST);
    const followups = strikes(result, skill.id);
    assert.equal(followups.length, 1, `${skill.name} consumes one charge`);
    assert.equal(followups[0].at, trigger.at, skill.name);
    assert.equal(followups[0].triggeredBy, 'Arcane Blast');
    assert.equal(followups[0].activationId, result.steps.find((step) => step.skillId === skill.id).activationId);
    assert.notEqual(followups[0].activationId, trigger.activationId);
    assert.equal(followups[0].skillWeapon, 'Spear');
    assert.ok(followups[0].damage > 0);
    assert.equal(liveBuffs(result, WEAVER_SPEAR_FOLLOWUPS[skill.id], trigger.at), 0);
  }
});

test('spear follow-ups expire at the buff boundary and refresh without stacking', () => {
  for (const skill of skills) {
    const expired = run(skill, [cast(skill.id), wait(5000), cast(ID.ARCANE_BLAST)]);
    assert.deepEqual(expired.warnings, [], skill.name);
    assert.deepEqual(strikes(expired, skill.id), [], skill.name);

    const refreshed = run(skill, [cast(skill.id), wait(4000), cast(skill.id), wait(2000), cast(ID.ARCANE_BLAST)], {
      catalog: (catalog) => withSkill(catalog, skill.id, { cooldown: 0 })
    });
    assert.deepEqual(refreshed.warnings, [], skill.name);
    const [followup] = strikes(refreshed, skill.id);
    assert.equal(strikes(refreshed, skill.id).length, 1, skill.name);
    assert.equal(
      followup.activationId,
      refreshed.steps.filter((step) => step.skillId === skill.id).at(-1).activationId
    );
  }
});

test('a strike already in flight consumes the buff; a missed strike leaves it armed', () => {
  const skill = elementalistCatalog.skillsById.get(ID.ELUTRIATE);
  for (const offTarget of [false, true]) {
    const result = run(skill, [
      cast(ID.LIGHTNING_JAVELIN, { offTarget }),
      cast(skill.id, { concurrentOffsetMs: 120 }),
      wait(100),
      cast(ID.ARCANE_BLAST)
    ]);
    assert.deepEqual(result.warnings, []);
    const trigger = strikes(result, offTarget ? ID.ARCANE_BLAST : ID.LIGHTNING_JAVELIN)[0];
    const [followup] = strikes(result, skill.id);
    assert.equal(followup.at, trigger.at);
    assert.equal(followup.triggeredBy, trigger.skillName);
    assert.equal(strikes(result, skill.id).length, 1);
    const conditions = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === skill.id
    );
    assert.deepEqual([...new Set(conditions.map((event) => event.condition))].sort(), ['Chilled', 'Vulnerability']);
    assert.ok(conditions.every((event) => event.at === trigger.at));
  }
});

test('condition damage, zero-damage packets, and companion strikes cannot consume a player follow-up', () => {
  const skill = elementalistCatalog.skillsById.get(ID.FROSTFIRE_WARD);
  const result = run(skill, [cast(skill.id), wait(2000), cast(ID.ARCANE_BLAST)], {
    timeline: [
      {
        at: 0.5,
        run(runtime) {
          for (const event of [
            { type: 'condition', condition: 'Burning', stacks: 1, duration: 1, actorType: 'player' },
            { type: 'damage', coefficient: 0, actorType: 'player', weaponStrength: 1000 },
            { type: 'damage', coefficient: 1, actorType: 'summon', summonOwner: 'fixture', weaponStrength: 1000 }
          ]) {
            runtime.mechanics.effects.emit({
              kind: 'packet',
              event: { ...event, at: 0.5, source: 'fixture', sourceId: 'fixture', skillName: 'Fixture' }
            });
          }
        }
      }
    ]
  });
  assert.deepEqual(result.warnings, []);
  const [followup] = strikes(result, skill.id);
  assert.equal(followup.at, strikes(result, ID.ARCANE_BLAST)[0].at);
  assert.equal(strikes(result, skill.id).length, 1);
});

test('different spear buffs share the next strike without consuming each other during activation', () => {
  const result = run(elementalistCatalog.skillsById.get(ID.FROSTFIRE_WARD), [
    'Frostfire Ward',
    'Air Attunement',
    'Galvanize',
    'Earth Attunement',
    'Shale Storm',
    'Water Attunement',
    'Soothing Burst',
    'Fire Attunement',
    'Earth Attunement',
    'Fiery Impact',
    'Water Attunement',
    'Air Attunement',
    'Elutriate',
    wait(1000),
    'Arcane Blast'
  ]);
  assert.deepEqual(result.warnings, []);
  const [trigger] = strikes(result, ID.ARCANE_BLAST);
  for (const skill of skills) {
    const followups = strikes(result, skill.id);
    assert.equal(followups.length, 1, skill.name);
    assert.equal(followups[0].at, trigger.at, skill.name);
    assert.equal(followups[0].triggeredBy, trigger.skillName, skill.name);
  }
});

test('spear buff grants and follow-up payloads remain independently patchable', () => {
  const skill = elementalistCatalog.skillsById.get(ID.GALVANIZE);
  for (const removed of ['grant', 'payload']) {
    const result = run(skill, [cast(skill.id), wait(1000), cast(ID.ARCANE_BLAST)], {
      catalog: (catalog) =>
        removed === 'grant'
          ? withSkill(catalog, skill.id, { effects: [] })
          : withProfile(catalog, WEAVER_SPEAR_FOLLOWUPS[skill.id], { effects: [] })
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(strikes(result, skill.id), []);
  }
});
