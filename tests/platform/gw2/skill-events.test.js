import assert from 'node:assert/strict';
import test from 'node:test';

import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createEvent } from '#gw2/platform/engine/events/events.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';

function captureContext(effectDuration) {
  const events = [];
  return {
    context: {
      profession: { id: 'fixture' },
      schedulerPolicy: effectDuration ? { effectDuration } : {},
      emit(event) {
        const emitted = createEvent(event);
        events.push(emitted);
        return emitted;
      }
    },
    events
  };
}

test('procedural damage packets share attribution, ownership, and timing defaults', () => {
  const { context, events } = captureContext();
  const skill = { id: 101, name: 'Summoned Volley', type: 'Utility' };

  const emitted = emitSkillDamage(context, skill, {
    at: 1,
    coefficient: 1.2,
    hits: 3,
    interval: 0.25,
    actorType: 'summon',
    ownerActorType: 'player',
    summonKind: 'minion',
    activationId: 'summon-attack:1',
    triggeredBy: 'Summon Minion',
    metadata: { type: 'condition', source: 'wrong-source', at: 99, professionFlag: true }
  });

  assert.deepEqual(
    emitted.map((event) => [event.at, event.coefficient, event.hitIndex, event.totalHits]),
    [
      [1, 0.39999999999999997, 1, 3],
      [1.25, 0.39999999999999997, 2, 3],
      [1.5, 0.39999999999999997, 3, 3]
    ]
  );
  assert.equal(events.length, 3);
  for (const event of events) {
    assert.equal(event.source, 'fixture');
    assert.equal(event.sourceId, 101);
    assert.equal(event.skillId, 101);
    assert.equal(event.skillName, 'Summoned Volley');
    assert.equal(event.actorType, 'summon');
    assert.equal(event.ownerActorType, 'player');
    assert.equal(event.summonKind, 'minion');
    assert.equal(event.activationId, 'summon-attack:1');
    assert.equal(event.triggeredBy, 'Summon Minion');
    assert.equal(event.professionFlag, true);
    assert.equal(event.hits, 1);
    assert.equal(event.skillWeapon, 'Unequipped');
    assert.equal(event.canCrit, true);
  }
});

test('condition and control helpers retain explicit trait attribution and control metadata', () => {
  const { context, events } = captureContext();
  const skill = { id: 202, name: 'Trigger Skill' };

  emitSkillCondition(context, skill, {
    at: 2,
    source: 'Trait',
    sourceId: 9001,
    actorType: 'effect',
    ownerActorType: 'player',
    skillId: 9001,
    skillName: 'Condition Trait',
    condition: 'Burning',
    stacks: 2,
    duration: 4,
    triggeredBy: skill.name
  });
  emitSkillControl(context, skill, {
    at: 2,
    source: 'Trait',
    sourceId: 9002,
    actorType: 'effect',
    skillId: 9002,
    skillName: 'Control Trait',
    controlKind: 'daze',
    duration: 0.5,
    priority: -5,
    triggeredBy: skill.name
  });

  assert.deepEqual(
    events.map((event) => ({
      type: event.type,
      sourceId: event.sourceId,
      actorType: event.actorType,
      ownerActorType: event.ownerActorType,
      skillId: event.skillId,
      skillName: event.skillName,
      name: event.name,
      condition: event.condition,
      stacks: event.stacks,
      duration: event.duration,
      controlKind: event.controlKind,
      priority: event.priority,
      triggeredBy: event.triggeredBy
    })),
    [
      {
        type: 'condition',
        sourceId: 9001,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: 9001,
        skillName: 'Condition Trait',
        name: 'Condition Trait — Burning',
        condition: 'Burning',
        stacks: 2,
        duration: 4,
        controlKind: undefined,
        priority: undefined,
        triggeredBy: 'Trigger Skill'
      },
      {
        type: 'control',
        sourceId: 9002,
        actorType: 'effect',
        ownerActorType: undefined,
        skillId: 9002,
        skillName: 'Control Trait',
        name: undefined,
        condition: undefined,
        stacks: undefined,
        duration: 0.5,
        controlKind: 'daze',
        priority: -5,
        triggeredBy: 'Trigger Skill'
      }
    ]
  );
});

test('buff helper applies boon duration and preserves fixed or non-boon durations', () => {
  const durationCalls = [];
  const { context, events } = captureContext((_context, _skill, effect, duration) => {
    durationCalls.push(effect);
    return duration * 1.5;
  });
  const skill = { id: 303, name: 'Shared Boon' };

  emitSkillBuff(context, skill, {
    at: 3,
    kind: 'might',
    duration: 4,
    stacks: 2,
    maximumDuration: 5,
    recipients: 'party',
    maximumRecipients: 5
  });
  emitSkillBuff(context, skill, {
    at: 3,
    kind: 'profession-mode',
    duration: 4
  });
  emitSkillBuff(context, skill, {
    at: 3,
    kind: 'fury',
    duration: 4,
    fixedDuration: true
  });

  assert.deepEqual(
    events.map((event) => [event.kind, event.duration, event.stacks, event.recipients, event.maximumRecipients]),
    [
      ['might', 5, 2, 'party', 5],
      ['profession-mode', 4, 1, undefined, undefined],
      ['fury', 4, 1, undefined, undefined]
    ]
  );
  assert.deepEqual(durationCalls, [{ type: 'boon', boon: 'might', duration: 4, fixedDuration: false }]);
});

test('event-record migration preserves finalized boon duration and canonical weapon identity', () => {
  const durationCalls = [];
  const { context, events } = captureContext((_context, _skill, _effect, duration) => {
    durationCalls.push(duration);
    return duration * 2;
  });

  emitSkillBuff(context, {
    at: 1,
    sourceId: 505,
    skillName: 'Finalized Boon',
    kind: 'might',
    duration: 4
  });
  emitSkillDamage(context, {
    skill: { id: 506, name: 'Shroud Strike', weapon: 'Pistol', skillWeapon: 'Hammer' },
    at: 2,
    coefficient: 1
  });

  assert.equal(events[0].duration, 4);
  assert.equal(events[1].skillWeapon, 'Hammer');
  assert.deepEqual(durationCalls, []);
});

test('procedural helpers retain scheduler timestamp, priority, and insertion ordering', () => {
  const skill = { id: 404, name: 'Ordered Packets' };
  const catalog = createCanonicalCatalog({ generated: [{ ...skill, effects: [] }] });
  const profession = defineProfession({
    id: 'fixture',
    name: 'Fixture',
    catalog,
    resources: { createProfessionState: () => ({}) },
    schedulerHooks: {
      initialize(context) {
        emitSkillControl(context, skill, {
          at: 1,
          controlKind: 'daze',
          priority: 5
        });
        emitSkillCondition(context, skill, {
          at: 1,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 1,
          priority: -5
        });
        emitSkillDamage(context, skill, {
          at: 0.5,
          coefficient: 0.9,
          hits: 3,
          interval: 0.25
        });
        const cause = context.emit({
          type: 'marker',
          at: 1.5,
          source: 'fixture',
          sourceId: 'cause',
          skillName: 'Cause'
        });
        emitSkillCondition(context, skill, {
          cause,
          at: 1.5,
          condition: 'Burning',
          stacks: 1,
          duration: 1
        });
      }
    }
  });

  const result = createScheduler({ profession }).run([{ type: 'wait', durationMs: 2000 }]);

  assert.deepEqual(
    result.events.map((event) => [event.at, event.type, event.priority ?? 0, event.hitIndex ?? 0]),
    [
      [0.5, 'damage', 0, 1],
      [0.75, 'damage', 0, 2],
      [1, 'condition', -5, 0],
      [1, 'damage', 0, 3],
      [1, 'control', 5, 0],
      [1.5, 'marker', 0, 0],
      [1.5, 'condition', 0, 0]
    ]
  );
  assert.equal(result.events.at(-1).triggeredBy, 'Cause');
  assert.ok(result.events.at(-1).causalOrder > result.events.at(-2).__order);
});
