import assert from 'node:assert/strict';
import test from 'node:test';

import { createMesmerEventEmitters } from '#gw2/professions/mesmer/core/mechanics/illusions/event-emission.js';

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
  emitters.addCondition('Condition Skill', 2, { name: 'Bleeding', duration: 3 }, 'Clone');
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
      { source: 'mesmer', sourceId: 123, actorType: undefined, summonKind: undefined, skillId: 123 },
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
    sourceId: 'explicit-condition'
  });
  emitters.addDamage(
    { id: 456, name: 'Damage Skill' },
    3,
    { coefficient: 1 },
    { source: 'Clone', sourceId: 'explicit-damage' }
  );

  assert.deepEqual(
    events.map(({ source, sourceId, actorType, summonKind }) => ({ source, sourceId, actorType, summonKind })),
    [
      { source: 'Phantasm', sourceId: 'explicit-condition', actorType: 'summon', summonKind: 'phantasm' },
      { source: 'Clone', sourceId: 'explicit-damage', actorType: 'summon', summonKind: 'clone' }
    ]
  );
});
