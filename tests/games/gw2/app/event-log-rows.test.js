import assert from 'node:assert/strict';
import test from 'node:test';

import { simulationEventLogRows } from '#gw2/app/results/event-log.js';

const player = { source: 'Player', actorType: 'player' };
const trait = { source: 'Trait', actorType: 'effect' };

// One cast exercises every ownership rule: a recorded parent behind a hidden event, a grouped damage field,
// a nested spawn, a name-matched trigger, an orphaned reaction, and an environment marker that needs no owner.
function ownershipRows() {
  return simulationEventLogRows({
    events: [
      { type: 'combat_start', at: 0, eventOrder: 0, source: 'Runtime', actorType: 'environment' },
      { type: 'action', at: 0, endsAt: 0.5, eventOrder: 1, activationId: 'cast:1', name: 'Strike', ...player },
      { type: 'combo_finisher', at: 0.5, eventOrder: 3, parentEventOrder: 2, activationId: 'cast:1', ...player },
      { type: 'buff', at: 0.5, eventOrder: 4, parentEventOrder: 3, kind: 'might', name: 'Mighty Trait', ...trait },
      { type: 'buff', at: 3, eventOrder: 9, kind: 'fury', name: 'Loose Trait', ...trait },
      { type: 'marker', at: 3, eventOrder: 10, name: 'Cooldown Reset', source: 'platform', actorType: 'environment' }
    ],
    resolvedEvents: [
      {
        type: 'damage',
        at: 0.5,
        eventOrder: 2,
        activationId: 'cast:1',
        name: 'Strike',
        skillName: 'Strike',
        damage: 10,
        ...player
      },
      {
        type: 'damage',
        at: 1,
        eventOrder: 5,
        activationId: 'cast:1:flames',
        name: 'Flames',
        skillName: 'Flames',
        damage: 3,
        ...player
      },
      {
        type: 'damage',
        at: 1.5,
        eventOrder: 7,
        activationId: 'guardian.symbol:9:cast:1:1.5',
        name: 'Symbol',
        skillName: 'Symbol',
        damage: 4,
        ...player
      },
      {
        type: 'damage',
        at: 2,
        eventOrder: 6,
        activationId: 'cast:1:flames:2',
        name: 'Flames',
        skillName: 'Flames',
        damage: 3,
        ...player
      },
      {
        type: 'condition',
        at: 2.5,
        eventOrder: 8,
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        skillName: 'Searing',
        triggeredBy: 'Flames',
        ...trait
      },
      {
        type: 'damage',
        at: 3,
        eventOrder: 11,
        name: 'Greatsword Clone',
        skillName: 'Greatsword Clone',
        damage: 2,
        source: 'Clone',
        actorType: 'summon',
        summonOwner: 'mesmer.clone:1'
      }
    ]
  });
}

const find = (rows, prefix, index = 0) => rows.filter((row) => row.description.startsWith(prefix))[index];

test('event-log rows link casts, recorded parents, and end markers', () => {
  const rows = ownershipRows();
  const cast = find(rows, 'CAST Strike');
  const hit = find(rows, 'HIT Strike');
  const buff = find(rows, 'BUFF Might');

  assert.equal(cast.id, 'activation:cast:1');
  assert.equal(cast.ordinal, 1);
  assert.equal(cast.span, 0.5);
  assert.deepEqual([hit.parentId, hit.parentLink.kind, hit.metric], [cast.id, 'recorded', 10]);
  // The trait buff's recorded parent is a combo finisher the log hides, so it resolves to the hit behind it.
  assert.deepEqual([buff.parentId, buff.parentLink.kind, buff.source.id], [hit.id, 'recorded', 'trait']);
  assert.deepEqual(buff.tag, { label: 'Might', className: 'trigger' });
  const end = find(rows, 'END Strike');
  assert.deepEqual([end.parentId, end.layout, end.id], [cast.id, 'flat', undefined]);
});

test('event-log rows group derived activations under synthetic entities', () => {
  const rows = ownershipRows();
  const cast = find(rows, 'CAST Strike');
  const flames = rows.filter((row) => row.description.startsWith('HIT Flames'));
  const entity = rows.find((row) => row.description === 'FLAMES Flames');
  const symbol = rows.find((row) => row.description === 'SYMBOL Symbol');

  // Every activation suffix of one cast and kind shares a single group.
  assert.deepEqual(
    flames.map((row) => row.parentId),
    [entity.id, entity.id]
  );
  assert.deepEqual([entity.type, entity.parentId, entity.layout], ['entity', cast.id, 'tree']);
  assert.equal(find(rows, 'HIT Symbol').parentId, symbol.id);
  assert.equal(symbol.parentId, cast.id);
});

test('event-log rows infer named triggers and flag unowned effects only', () => {
  const rows = ownershipRows();
  const burning = find(rows, 'CONDITION Burning');
  const fury = find(rows, 'BUFF Fury');
  const marker = find(rows, 'EVENT Cooldown Reset');

  // The latest Flames hit at or before the condition is its inferred trigger.
  assert.equal(burning.parentId, find(rows, 'HIT Flames', 1).id);
  assert.equal(burning.parentLink.kind, 'inferred');
  assert.deepEqual([fury.parentId, fury.orphan], [undefined, true]);
  assert.deepEqual([marker.parentId, marker.orphan], [undefined, undefined]);
  // Clones attack autonomously, so an unlinked clone hit is expected rather than a missing cause.
  const clone = find(rows, 'CLONE HIT Greatsword Clone');
  assert.deepEqual([clone.parentId, clone.orphan, clone.source.id], [undefined, undefined, 'clone']);
});

// An armed effect consumed by a later strike belongs to the cast that armed it; a reaction to a cast stays with it.
test('event-log rows place armed skill effects under the casting skill rather than the consuming strike', () => {
  const rows = simulationEventLogRows({
    events: [
      { type: 'action', at: 0, endsAt: 0, eventOrder: 1, activationId: 'cast:1', name: 'Arm', skillId: 10, ...player },
      {
        type: 'action',
        at: 1,
        endsAt: 1,
        eventOrder: 2,
        activationId: 'cast:2',
        name: 'Strike',
        skillId: 20,
        ...player
      },
      { type: 'buff', at: 1, eventOrder: 5, parentEventOrder: 2, kind: 'fury', skillId: 10, sourceId: 10, ...player }
    ],
    resolvedEvents: [
      {
        type: 'damage',
        at: 1,
        eventOrder: 3,
        activationId: 'cast:2',
        name: 'Strike',
        skillId: 20,
        damage: 5,
        ...player
      },
      {
        type: 'condition',
        at: 1,
        eventOrder: 4,
        parentEventOrder: 3,
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        skillName: 'Arm',
        skillId: 10,
        sourceId: 10,
        ...player
      }
    ]
  });

  const bleed = find(rows, 'CONDITION Bleeding');
  assert.equal(bleed.parentId, find(rows, 'CAST Arm').id);
  assert.match(bleed.parentLink.label, /triggered by Strike hit/);
  assert.equal(find(rows, 'BUFF Fury').parentId, find(rows, 'CAST Strike').id);
});
