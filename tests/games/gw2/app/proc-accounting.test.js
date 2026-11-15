import assert from 'node:assert/strict';
import test from 'node:test';

import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { rotationObservations } from '#gw2/app/rotation/insights/rotation-observations.js';

const packet = {
  type: 'condition',
  at: 1,
  actorType: 'player',
  source: 'Trait',
  sourceId: 10,
  traitId: 10,
  skillId: 20,
  skillName: 'Trigger',
  name: 'Trait - Burning',
  condition: 'Burning',
  damage: 10,
  procActivation: { id: 'proc:1', count: 3 }
};

const source = { context: { catalog: { traits: [{ id: 10, name: 'Fixture trait' }] } } };

// Both projections receive the same accepted packets; only their row ownership differs.
function result(resolvedEvents, events = []) {
  return {
    resolvedEvents,
    events,
    steps: [],
    dpsStartTime: 0,
    dpsWindow: 3,
    breakdown: resolvedEvents
      .filter((event) => event.damage > 0)
      .map((event) => ({
        ...event,
        sourceSkill: event.skillName,
        conditionDamage: event.damage
      }))
  };
}

test('breakdown and rotation comparisons deduplicate sibling packets with the same batched proc identity', () => {
  const run = result([packet, { ...packet }, { ...packet, procActivation: { id: 'proc:2', count: 1 } }]);
  assert.equal(skillBreakdownRows(run)[0].procCount, 4);
  assert.equal(skillBreakdownRows(run)[0].hits, 4);
  assert.equal([...rotationObservations(run, 3, source).procs.values()][0].count, 4);
});

test('rotation proc ownership stays with the trait across skill ids and includes utility conditions', () => {
  const run = result([
    packet,
    { ...packet, skillId: 21, sourceId: 21, damage: 0, condition: 'Slow', procActivation: { id: 'proc:2', count: 1 } },
    { ...packet, cancelled: true, procActivation: { id: 'cancelled', count: 1 } },
    { ...packet, at: 4, procActivation: { id: 'outside', count: 1 } }
  ]);
  const { procs } = rotationObservations(run, 3, source);
  assert.equal(procs.size, 1);
  assert.equal([...procs.values()][0].count, 4);
  assert.equal([...procs.values()][0].label, 'Fixture trait');
});

// Support rewards remain visible, and actor attribution cannot split a trait activation into duplicate rows.
test('comparison labels support-only trait activations from the catalog across actor types', () => {
  const reward = { ...packet, type: 'buff', damage: 0, kind: 'might', procActivation: { id: 'support', count: 1 } };
  const run = result([reward, { ...reward, actorType: 'effect', name: 'Different packet label' }]);
  assert.deepEqual([...rotationObservations(run, 3, source).procs.values()], [{ label: 'Fixture trait', count: 1 }]);
});

// A proc attached to its parent's damage row contributes damage without adding another row activation.
for (const parentIsProc of [false, true]) {
  test(`same-row child procs do not inflate ${parentIsProc ? 'proc' : 'native'} rows without casts`, () => {
    const parent = {
      ...packet,
      type: 'damage',
      condition: undefined,
      eventOrder: 1,
      procActivation: parentIsProc ? { id: 'parent', count: 2 } : undefined
    };
    const child = { ...packet, eventOrder: 2, parentEventOrder: 1 };
    const sibling = { ...child, eventOrder: 3, parentEventOrder: undefined };
    const otherRow = { ...child, eventOrder: 4, name: 'Separate trait', skillName: 'Separate trait' };
    const rows = skillBreakdownRows(result([parent, child, sibling, otherRow]));
    assert.equal(rows.find((row) => row.name === 'Trigger').procCount, parentIsProc ? 2 : 0);
    assert.equal(rows.find((row) => row.name === 'Separate trait').procCount, 3);
  });
}

test('native condition skill rows retain casts and do not show attached trait activations as Hits', () => {
  const native = {
    ...packet,
    source: 'Skill',
    sourceId: 20,
    traitId: undefined,
    procActivation: undefined,
    name: 'Trigger - Burning'
  };
  const action = { type: 'action', actorType: 'player', skillId: 20, skillName: 'Trigger', at: 0, endsAt: 1 };
  const [row] = skillBreakdownRows(result([native, packet], [action]));
  assert.equal(row.casts, 1);
  assert.equal(row.procCount, 0);
  assert.equal(row.hits, 0);
  assert.equal(row.average, 20);
});

test('proc-only child rows cannot borrow their triggering skill casts', () => {
  const child = { ...packet, skillName: 'Child trait' };
  const action = { type: 'action', actorType: 'player', skillId: 20, skillName: 'Trigger', at: 0, endsAt: 1 };
  const [row] = skillBreakdownRows(result([child], [action]));
  assert.equal(row.casts, 0);
  assert.equal(row.hits, 3);
});

test('an unmarked utility sibling cannot erase a proc row without real casts', () => {
  const utility = { ...packet, damage: 0, condition: 'Weakness', name: 'Area Weakness', procActivation: undefined };
  const run = result([packet, utility]);
  // Non-damaging conditions still have breakdown identities, as combo weakness does beside Orbital Command Strike.
  run.breakdown.push({ ...utility, sourceSkill: packet.skillName, conditionDamage: 0 });
  const [row] = skillBreakdownRows(run);
  assert.equal(row.procCount, 3);
  assert.equal(row.casts, 0);
  assert.equal(row.average, 10 / 3);
});
