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

// Attribution defaults must remain separate from the source that produced a condition packet.
test('condition options distinguish skill attribution, source identity, and packet labels', () => {
  const { context } = captureContext();
  const skill = { id: 101, name: 'Trigger Skill' };
  const options = { at: 0, condition: 'Burning', stacks: 1, duration: 2 };
  const event = emitSkillCondition(context, {
    ...options,
    skill,
    sourceId: 9001,
    fixedDuration: true,
    transferredCondition: true,
    metadata: { procCount: 1 }
  });

  assert.equal(event.source, 'fixture');
  assert.equal(event.actorType, 'player');
  assert.equal(event.sourceId, 9001);
  assert.equal(event.skillId, 101);
  assert.equal(event.skillName, 'Trigger Skill');
  assert.equal(event.name, 'Trigger Skill — Burning');
  assert.equal(event.fixedDuration, true);
  assert.equal(event.transferredCondition, true);
  assert.equal(event.metadata.procCount, 1);
  assert.equal(Object.hasOwn(event, 'skill'), false);

  const overridden = emitSkillCondition(context, {
    ...options,
    skill,
    sourceId: 9001,
    skillId: 9002,
    skillName: 'Triggered Effect',
    name: 'Second pulse'
  });
  assert.equal(overridden.sourceId, 9001);
  assert.equal(overridden.skillId, 9002);
  assert.equal(overridden.skillName, 'Triggered Effect');
  assert.equal(overridden.name, 'Second pulse');

  const procedural = emitSkillCondition(context, { ...options, sourceId: 9001, skillName: 'Trait' });
  assert.equal(procedural.skillId, 9001);
  assert.equal(procedural.name, 'Trait — Burning');
});

// Null is an omission request, including before createEvent removes undefined properties.
test('procedural emitters omit nullable identity fields without leaking helper controls', () => {
  const cause = { type: 'marker', at: 0, eventOrder: 1 };
  const context = {
    profession: { id: 'fixture' },
    emit: (event) => event,
    emitDerived(actualCause, event) {
      assert.equal(actualCause, cause);
      return event;
    }
  };
  const options = {
    skill: { id: 101, name: 'Trigger Skill' },
    cause,
    at: 0,
    skillId: null,
    skillName: null,
    name: null
  };
  const condition = emitSkillCondition(context, { ...options, condition: 'Burning', stacks: 1, duration: 2 });
  const [damage] = emitSkillDamage(context, { ...options, coefficient: 1, canCrit: null });
  for (const event of [condition, damage]) {
    assert.equal(event.sourceId, 101);
    for (const field of ['skill', 'cause', 'skillId', 'skillName', 'name']) {
      assert.equal(Object.hasOwn(event, field), false, field);
    }
  }

  assert.equal(Object.hasOwn(damage, 'canCrit'), false);
});

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
    metadata: { packetKind: 'profession' }
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
    assert.equal(event.metadata.packetKind, 'profession');
    assert.equal(event.packetKind, undefined);
    assert.equal(event.hits, 1);
    assert.equal(event.skillWeapon, 'Unequipped');
    assert.equal(event.canCrit, true);
  }
});

test('condition and control helpers retain explicit trait attribution and control metadata', () => {
  const { context, events } = captureContext();
  const skill = { id: 202, name: 'Trigger Skill' };

  emitSkillCondition(context, {
    skill,
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
    priority: -5,
    triggeredBy: skill.name
  });

  assert.equal(Object.hasOwn(events[1], 'duration'), false);
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
      ...(event.type === 'control' ? {} : { duration: event.duration }),
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
    audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 5 }
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
    events.map((event) => [
      event.kind,
      event.duration,
      event.stacks,
      event.audience?.recipients,
      event.audience?.affectsSelf,
      event.audience?.maximumRecipients
    ]),
    [
      ['might', 5, 2, 'party', false, 5],
      ['profession-mode', 4, 1, undefined, undefined, undefined],
      ['fury', 4, 1, undefined, undefined, undefined]
    ]
  );
  assert.deepEqual(durationCalls, [{ type: 'boon', boon: 'might', duration: 4, fixedDuration: false }]);
});

test('procedural helpers reject unknown metadata', () => {
  const { context } = captureContext();
  const options = { at: 0, kind: 'might', duration: 1 };

  assert.throws(
    () => emitSkillBuff(context, { ...options, metadata: { arbitraryFlag: true } }),
    /unsupported field: arbitraryFlag/
  );
});

test('condition metadata validates every migrated annotation and preserves explicit zero and false', () => {
  // These fields use the existing normalization boundary, including its unknown-key and finite-number checks.
  const { context } = captureContext();
  const options = { at: 0, condition: 'Bleeding', stacks: 1, duration: 2 };
  const metadata = {
    cloneId: 0,
    blade: false,
    shatter: false,
    shatterTraitEligible: false,
    instrument: 'Flute',
    triggeredByAlly: 0,
    venomProcEffectIndex: 0
  };
  const event = emitSkillCondition(context, { ...options, metadata });
  assert.deepEqual(event.metadata, metadata);
  assert.ok(Object.isFrozen(event.metadata));
  assert.notEqual(event.metadata, metadata);
  for (const [field, value] of Object.entries(metadata)) {
    assert.equal(Object.hasOwn(event, field), false);
    assert.throws(
      () =>
        emitSkillCondition(context, {
          ...options,
          metadata: { [field]: typeof value === 'number' ? NaN : 1 }
        }),
      TypeError
    );
  }

  assert.throws(() => emitSkillCondition(context, { ...options, metadata: { unknown: true } }), /unsupported field/);
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
        emitSkillCondition(context, {
          skill,
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
          actorType: 'environment',
          at: 1.5,
          source: 'fixture',
          sourceId: 'cause',
          skillName: 'Cause'
        });
        emitSkillCondition(context, {
          skill,
          cause,
          at: 1.5,
          condition: 'Burning',
          stacks: 1,
          duration: 1,
          metadata: { cloneId: 0, blade: false }
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
  assert.deepEqual(result.events.at(-1).metadata, { cloneId: 0, blade: false });
  assert.ok(result.events.at(-1).causalOrder > result.events.at(-2).eventOrder);
});
