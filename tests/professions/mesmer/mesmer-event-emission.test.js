import assert from 'node:assert/strict';
import test from 'node:test';

import { createMesmerEventEmitters } from '#gw2/professions/mesmer/core/mechanics/illusions/event-emission.js';
import { EPSILON } from '#kernel/core/clock.js';
import { scheduleMesmerPhantasmEffects } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { troubadourSchedulerHooks } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.js';

test('phantasm packet and Harmonize commitment preserve their interruption tolerances', () => {
  // Synthetic summon progress checks the commitment contract without pinning authored skill timings.
  const harmonize = troubadourSchedulerHooks.onCastComplete.find(({ id }) => id.endsWith('.harmonize')).handler;
  for (const progress of [0.5, undefined, NaN, Infinity, -Infinity]) {
    for (const effectiveEnd of [3 - 5 * EPSILON, 3 - 3 * EPSILON, 3 - EPSILON / 2, 3, 4]) {
      const packets = [];
      const resources = [];
      const context = {
        start: 2,
        fullEnd: 4,
        effectiveEnd,
        epsilon: 4 * EPSILON,
        reservationId: 'phantasm',
        mesmerRuntime: {
          castDetails: new Map(),
          activeEmission: null,
          activePrimaryWeapon: () => 'Sword',
          resources: { queueResources: (...args) => resources.push(args) },
          skillEffects: {
            schedule: (_skill, _end, _start, options) =>
              packets.push({ ...options, emissionEnd: context.mesmerRuntime.activeEmission.effectiveEnd })
          }
        }
      };
      const skill = { resource: { mode: 'phantasm' }, phantasmSummonProgress: progress };
      scheduleMesmerPhantasmEffects(context, skill);
      harmonize(context, skill);
      const packetCommitted = progress === 0.5 && effectiveEnd >= 3 - EPSILON && effectiveEnd < 4;
      assert.equal(packets[0].phantasmSummonAt, packetCommitted ? effectiveEnd : undefined);
      assert.equal(packets[0].emissionEnd, packetCommitted || effectiveEnd === 4 ? Infinity : effectiveEnd);
      assert.equal(
        resources.length,
        (progress === 0.5 && effectiveEnd >= 3 - context.epsilon) || effectiveEnd === 4 ? 1 : 0
      );
      if (resources.length) assert.equal(resources[0][0], context.fullEnd + context.epsilon);
      assert.equal(context.mesmerRuntime.activeEmission, null);
    }
  }
});

function createFixture() {
  const events = [];
  const context = {
    profession: { id: 'mesmer' },
    catalog: { skillsById: new Map(), skillsByName: new Map() }
  };
  const emitters = createMesmerEventEmitters({
    context,
    emit(event) {
      events.push(event);
      return event;
    },
    activePrimaryWeapon: () => 'Sword',
    weaponStrength: {}
  });

  return { events, emitters };
}

test('Mesmer procedural emitters attach canonical skill and summon identity', () => {
  const { events, emitters } = createFixture();

  emitters.addEvent({ type: 'marker', at: 1, skillId: 123 });
  emitters.addCondition('Condition Skill', 2, { name: 'Bleeding', duration: 3 }, 'Clone', '', {
    actorType: 'summon',
    summonKind: 'clone'
  });
  emitters.addDamage({ id: 456, name: 'Damage Skill' }, 3, { coefficient: 1 });

  assert.deepEqual(
    events.map(({ source, sourceId, actorType, summonKind, skillId }) => ({
      source,
      sourceId,
      actorType,
      summonKind,
      skillId
    })),
    [
      { source: 'mesmer', sourceId: 123, actorType: 'player', summonKind: undefined, skillId: 123 },
      {
        source: 'Clone',
        sourceId: 'mesmer.effect:Condition Skill',
        actorType: 'summon',
        summonKind: 'clone',
        skillId: 'mesmer.effect:Condition Skill'
      },
      { source: 'Player', sourceId: 456, actorType: 'player', summonKind: undefined, skillId: 456 }
    ]
  );
});

test('Mesmer procedural emitters preserve explicit derived-effect identity', () => {
  const { events, emitters } = createFixture();

  emitters.addCondition('Condition Skill', 2, { name: 'Bleeding', duration: 3 }, 'Player', '', {
    source: 'Phantasm',
    sourceId: 'explicit-condition',
    actorType: 'summon',
    summonKind: 'phantasm'
  });
  emitters.addDamage(
    { id: 456, name: 'Damage Skill' },
    3,
    { coefficient: 1 },
    { source: 'Clone', sourceId: 'explicit-damage', actorType: 'summon', summonKind: 'clone' }
  );

  assert.deepEqual(
    events.map(({ source, sourceId, actorType, summonKind }) => ({ source, sourceId, actorType, summonKind })),
    [
      { source: 'Phantasm', sourceId: 'explicit-condition', actorType: 'summon', summonKind: 'phantasm' },
      { source: 'Clone', sourceId: 'explicit-damage', actorType: 'summon', summonKind: 'clone' }
    ]
  );
});

// Renaming display sources cannot change actor ownership or summon classification.
test('Mesmer emitter ownership is independent of source labels', () => {
  const { events, emitters } = createFixture();
  for (const source of ['Player', 'Clone', 'Phantasm', 'Trait', 'Renamed source']) {
    emitters.addEvent({ type: 'marker', at: 0, source });
    assert.equal(events.at(-1).actorType, 'player');
    assert.equal(events.at(-1).summonKind, undefined);

    emitters.addEvent({ type: 'mesmer.phantasm-summoned', at: 0, source, actorType: 'summon', summonKind: 'phantasm' });
    assert.equal(events.at(-1).actorType, 'summon');
    assert.equal(events.at(-1).summonKind, 'phantasm');

    emitters.addCondition('Condition Skill', 0, { name: 'Bleeding', duration: 3 }, source, '', {
      summonKind: 'phantasm'
    });
    assert.equal(events.at(-1).actorType, 'summon');
    assert.equal(events.at(-1).summonKind, 'phantasm');

    emitters.addDamage(
      { id: 456, name: 'Damage Skill' },
      0,
      { coefficient: 1 },
      {
        source,
        actorType: 'effect',
        ownerActorType: 'player'
      }
    );
    assert.equal(events.at(-1).actorType, 'effect');
    assert.equal(events.at(-1).ownerActorType, 'player');
  }
});
