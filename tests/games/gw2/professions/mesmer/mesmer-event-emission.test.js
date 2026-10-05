import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMesmerPacket,
  buildMesmerConditions,
  buildMesmerStrikes
} from '#gw2/professions/mesmer/core/mechanics/packets.js';

function createFixture() {
  return {
    events: [],
    context: {
      config: { primaryWeapon: 'Sword' },
      activeWeaponSet: 1,
      helpers: { skillsById: new Map(), skillsByName: new Map() }
    }
  };
}

test('Mesmer packet builders merge application, tick, and explicit metadata without losing false or zero', () => {
  // Both procedural paths use packet overrides and keep unrelated annotations through validation.
  const { context } = createFixture();
  const metadata = { cloneId: 1, blade: true };
  const tickMetadata = { cloneId: 2, blade: false, shatterTraitEligible: true };
  const extra = { skillId: 123, metadata: { cloneId: 0, shatterTraitEligible: false } };
  const [condition] = buildMesmerConditions(
    context,
    'Fixture',
    1,
    {
      name: 'Bleeding',
      duration: 2,
      metadata,
      ticks: [{ atMs: 250, condition: 'Bleeding', duration: 2, stacks: 1, metadata: tickMetadata }]
    },
    'Clone',
    '',
    extra
  );
  const [damage] = buildMesmerStrikes(
    context,
    { id: 1, name: 'Fixture', blade: true },
    1,
    {
      metadata,
      ticks: [{ atMs: 250, coefficient: 1, metadata: tickMetadata }]
    },
    extra
  );
  for (const event of [condition, damage]) {
    assert.equal(event.at, 1.25);
    assert.deepEqual(event.metadata, { cloneId: 0, blade: false, shatterTraitEligible: false });
    for (const key of Object.keys(event.metadata)) assert.equal(Object.hasOwn(event, key), false);
  }

  const [untimed] = buildMesmerConditions(
    context,
    'Fixture',
    0,
    { name: 'Bleeding', duration: 2, metadata },
    'Player',
    '',
    { skillId: 123 }
  );
  assert.deepEqual(untimed.metadata, metadata);
  assert.throws(
    () =>
      buildMesmerConditions(
        context,
        'Fixture',
        0,
        {
          name: 'Bleeding',
          duration: 2,
          metadata: { cloneId: 'invalid' }
        },
        'Player',
        '',
        { skillId: 123 }
      ),
    /cloneId must be a finite number/
  );
});

test('Mesmer packet builders attach canonical skill and summon identity', () => {
  const { events, context } = createFixture();

  events.push(buildMesmerPacket({ type: 'marker', at: 1, skillId: 123 }));
  events.push(
    ...buildMesmerConditions(context, 'Condition Skill', 2, { name: 'Bleeding', duration: 3 }, 'Clone', '', {
      skillId: 123,
      actorType: 'summon',
      summonKind: 'clone'
    })
  );
  events.push(...buildMesmerStrikes(context, { id: 456, name: 'Damage Skill' }, 3, { coefficient: 1 }));

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
        sourceId: 123,
        actorType: 'summon',
        summonKind: 'clone',
        skillId: 123
      },
      { source: 'Player', sourceId: 456, actorType: 'player', summonKind: undefined, skillId: 456 }
    ]
  );
});

test('Mesmer packet builders preserve explicit derived-effect identity', () => {
  const { events, context } = createFixture();

  events.push(
    ...buildMesmerConditions(context, 'Condition Skill', 2, { name: 'Bleeding', duration: 3 }, 'Player', '', {
      skillId: 123,
      source: 'Phantasm',
      sourceId: 'explicit-condition',
      actorType: 'summon',
      summonKind: 'phantasm'
    })
  );
  events.push(
    ...buildMesmerStrikes(
      context,
      { id: 456, name: 'Damage Skill' },
      3,
      { coefficient: 1 },
      { source: 'Clone', sourceId: 'explicit-damage', actorType: 'summon', summonKind: 'clone' }
    )
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
test('Mesmer packet ownership is independent of source labels', () => {
  const { events, context } = createFixture();
  for (const source of ['Player', 'Clone', 'Phantasm', 'Trait', 'Renamed source']) {
    events.push(buildMesmerPacket({ type: 'marker', at: 0, source }));
    assert.equal(events.at(-1).actorType, 'player');
    assert.equal(events.at(-1).summonKind, undefined);

    events.push(
      buildMesmerPacket({
        type: 'mesmer.phantasm-summoned',
        at: 0,
        source,
        actorType: 'summon',
        summonKind: 'phantasm'
      })
    );
    assert.equal(events.at(-1).actorType, 'summon');
    assert.equal(events.at(-1).summonKind, 'phantasm');

    events.push(
      ...buildMesmerConditions(context, 'Condition Skill', 0, { name: 'Bleeding', duration: 3 }, source, '', {
        skillId: 123,
        summonKind: 'phantasm'
      })
    );
    assert.equal(events.at(-1).actorType, 'summon');
    assert.equal(events.at(-1).summonKind, 'phantasm');

    events.push(
      ...buildMesmerStrikes(
        context,
        { id: 456, name: 'Damage Skill' },
        0,
        { coefficient: 1 },
        {
          source,
          actorType: 'effect',
          ownerActorType: 'player'
        }
      )
    );
    assert.equal(events.at(-1).actorType, 'effect');
    assert.equal(events.at(-1).ownerActorType, 'player');
  }
});
