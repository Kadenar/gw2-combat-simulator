import assert from 'node:assert/strict';
import test from 'node:test';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const cases = [
  { name: 'mech', family: engineerProfession, config: { specialization: 'Mechanist' }, task: 'engineer.mech-attack' },
  { name: 'pet', family: rangerProfession, config: { selectedPet: 'Tiger' }, task: 'ranger.pet-autonomous-skill' },
  {
    name: 'elemental',
    family: elementalistProfession,
    casts: ['Glyph of Elementals'],
    task: 'elementalist.elemental-decision'
  },
  { name: 'minion', family: necromancerProfession, casts: ['Summon Shadow Fiend'], task: 'necromancer.minion-attack' },
  {
    name: 'spirit',
    family: necromancerProfession,
    config: { specialization: 'Ritualist' },
    casts: ["Ritualist's Shroud", 'Anguish'],
    task: 'ritualist.spirit-auto'
  },
  { name: 'guild', family: thiefProfession, casts: ['Thieves Guild'], task: 'thief.thieves-guild-attack' }
];

// Observe producer decisions directly: discarded hostile packets must not conceal precombat AI activity.
function run(entry, { boundary = 6, marker = false, commands = [], output, repeatedStart = false } = {}) {
  const names = [...(entry.casts ?? []), ...commands];
  const config = {
    specialization: 'Core',
    initialResource: 100,
    selectedSkillIds: names.map((name) => {
      const skill = entry.family.catalog.skillsByName.get(name);
      assert.ok(skill, name);
      return skill.id;
    }),
    ...entry.config
  };
  const native = entry.family.runtimeFor(config);
  const decisions = [];
  let beforeStart;
  const result = observeGw2Runtime({
    config,
    output,
    combatStartTime: marker || boundary == null ? undefined : boundary,
    rotation: [
      ...names.map((name) => ({ type: 'cast', skillId: entry.family.catalog.skillsByName.get(name).id })),
      ...(marker ? [wait(boundary * 1000), { type: 'combat-start' }] : []),
      wait(Math.max(16000, (boundary ?? 0) * 1000 + 8000))
    ],
    profession: {
      ...native,
      onCombatStart(runtime) {
        beforeStart = structuredClone(runtime.profession);
        native.onCombatStart?.(runtime);
        if (repeatedStart) native.onCombatStart?.(runtime);
      },
      tasks: {
        ...native.tasks,
        [entry.task](runtime, data) {
          decisions.push({ at: runtime.time, data: structuredClone(data) });
          native.tasks[entry.task](runtime, data);
        }
      }
    }
  });
  assert.deepEqual(result.warnings, [], entry.name);
  return { result, decisions, beforeStart };
}

for (const entry of cases) {
  test(`${entry.name} stays idle during explicit preparation and starts once from live state`, () => {
    const normal = run(entry);
    const repeated = run(entry, { repeatedStart: true });
    assert.ok(normal.decisions.length > 0);
    assert.ok(normal.decisions.every(({ at }) => at >= 6));
    assert.deepEqual(repeated.decisions, normal.decisions);
    const longer = run(entry, { boundary: 8 });
    assert.equal(Math.round((normal.decisions[0].at - 6) * 1e6), Math.round((longer.decisions[0].at - 8) * 1e6));
    assert.equal(run(entry, { output: 'score' }).result.totalDamage, normal.result.totalDamage);
  });

  test(`${entry.name} can initiate implicit combat and respects numeric zero and rotation markers`, () => {
    for (const options of [
      { boundary: null },
      { boundary: 0 },
      { boundary: 0, marker: true },
      { boundary: 6, marker: true }
    ]) {
      const { decisions, result } = run(entry, options);
      assert.ok(decisions.length > 0);
      if (options.marker) assert.ok(decisions.every(({ at }) => at >= result.combatStartTime));
      assert.ok(result.totalDamage > 0);
    }
  });
}

for (const [name, command] of [
  ['pet', 'Furious Pounce'],
  ['elemental', 'Flame Barrage'],
  ['minion', 'Haunt']
]) {
  test(`${name} precast command preserves recovery without starting autonomous decisions`, () => {
    const entry = cases.find((entry) => entry.name === name);
    const { decisions, beforeStart } = run(entry, { commands: [command] });
    assert.ok(decisions.length > 0);
    assert.ok(decisions.every(({ at }) => at >= 6));
    if (name === 'pet') {
      assert.equal(beforeStart.core.petAutoStarted, false);
      assert.deepEqual(beforeStart.core.petAutoRecharges, {});
    } else if (name === 'elemental') {
      assert.equal(beforeStart.core.summonedElemental.started, false);
    } else {
      const cursor = Object.values(beforeStart.core.minionAttackCursors)[0];
      assert.equal(cursor.started, false);
      assert.equal(cursor.cycleIndex, 1);
      assert.equal(cursor.attackIndex, 0);
    }
  });
}

test('an expired guild cannot wake at engagement', () => {
  const { decisions, result } = run(
    cases.find(({ name }) => name === 'guild'),
    { boundary: 40 }
  );
  assert.deepEqual(decisions, []);
  assert.equal(observedRuntime(result).profession.core.activeThievesGuild, null);
});

test('Horror engagement delays its ordinary attack without moving expiry or its terminal explosion', () => {
  // One finite creature makes lifetime ownership observable without calibrating a packet schedule.
  const runHorror = (combatStartTime) => {
    const config = { specialization: 'Core', selectedSkillIds: [ID.LICH_FORM] };
    const native = necromancerProfession.runtimeFor(config);
    let expiresAt;
    let idleAtEngagement;
    const result = observeGw2Runtime({
      config,
      combatStartTime,
      rotation: [
        { type: 'cast', skillId: ID.LICH_FORM },
        { type: 'cast', skillId: ID.SUMMON_MADNESS },
        { type: 'cast', skillId: ID.EXIT_LICH_FORM },
        wait(22000)
      ],
      profession: {
        ...native,
        catalog: withSkill(native.catalog, ID.SUMMON_MADNESS, { summons: 1 }),
        onCombatStart(runtime) {
          idleAtEngagement = Object.values(runtime.profession.core.minionAttackCursors).every(
            (cursor) => !cursor.started
          );
          native.onCombatStart(runtime);
        },
        tasks: {
          ...native.tasks,
          'necromancer.horror-spawn'(runtime, data) {
            native.tasks['necromancer.horror-spawn'](runtime, data);
            expiresAt = Object.values(runtime.profession.core.minionAttackCursors)[0].expiresAt;
          }
        }
      }
    });
    assert.deepEqual(result.warnings, []);
    return { result, expiresAt, idleAtEngagement };
  };

  const immediate = runHorror(0);
  const delayed = runHorror(4);
  assert.equal(delayed.idleAtEngagement, true);
  assert.equal(delayed.expiresAt, immediate.expiresAt);
  const attacks = delayed.result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Unstable Horror - Attack'
  );
  assert.ok(attacks.length > 0);
  assert.ok(attacks.every((event) => event.at > 4 && event.at <= delayed.expiresAt));
  const explosion = delayed.result.resolvedEvents.find((event) => event.name === 'Unstable Horror - Explosion');
  assert.equal(explosion.at, delayed.expiresAt);
  assert.deepEqual(observedRuntime(delayed.result).profession.core.activeMinions, {});
  const expired = runHorror(20);
  assert.equal(expired.result.totalDamage, 0);
  assert.deepEqual(observedRuntime(expired.result).profession.core.minionAttackCursors, {});
});
