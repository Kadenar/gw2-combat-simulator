import { registerMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMesmerPacket,
  buildMesmerConditions,
  buildMesmerStrikes
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { EPSILON } from '#kernel/core/clock.js';
import { scheduleMesmerPhantasmEffects } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { completeTroubadourPhantasm } from '#gw2/professions/mesmer/specializations/troubadour/traits/performance.js';

test('phantasm packet and Harmonize commitment preserve their interruption tolerances', () => {
  // Synthetic summon progress checks the commitment contract without pinning authored skill timings.

  for (const progress of [0.5, undefined, NaN, Infinity, -Infinity]) {
    for (const effectiveEnd of [3 - 5 * EPSILON, 3 - 3 * EPSILON, 3 - EPSILON / 2, 3, 4]) {
      const packets = [];
      const resources = [];
      const context = {
        helpers: mesmerCatalog,
        start: 2,
        fullEnd: 4,
        effectiveEnd,
        reservationId: 'phantasm',
        mesmerRuntime: {
          castDetails: new Map(),
          activePrimaryWeapon: () => 'Sword',
          resources: { queueResources: (...args) => resources.push(args) },
          skillEffects: {
            schedule: (_skill, _end, _start, options) =>
              packets.push({ ...options, emissionEnd: options.delivery.cast.effectiveEnd })
          }
        }
      };
      const skill = { resource: { mode: 'phantasm' }, phantasmSummonProgress: progress };
      const cast = { ...context, skill, id: 'phantasm', command: {} };
      context.time = context.fullEnd;
      registerMesmerMechanics(context, context.mesmerRuntime);
      scheduleMesmerPhantasmEffects(context, cast, skill);
      completeTroubadourPhantasm(context, cast);
      const packetCommitted = progress === 0.5 && effectiveEnd >= 3 - EPSILON && effectiveEnd < 4;
      assert.equal(packets[0].phantasmSummonAt, packetCommitted ? effectiveEnd : undefined);
      assert.equal(packets[0].emissionEnd, packetCommitted || effectiveEnd === 4 ? Infinity : effectiveEnd);
      assert.equal(resources.length, (progress === 0.5 && effectiveEnd >= 3 - EPSILON) || effectiveEnd === 4 ? 1 : 0);
      if (resources.length) assert.equal(resources[0][0], context.fullEnd);
    }
  }
});

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
  const extra = { metadata: { cloneId: 0, shatterTraitEligible: false } };
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

  const [untimed] = buildMesmerConditions(context, 'Fixture', 0, { name: 'Bleeding', duration: 2, metadata });
  assert.deepEqual(untimed.metadata, metadata);
  assert.throws(
    () =>
      buildMesmerConditions(context, 'Fixture', 0, {
        name: 'Bleeding',
        duration: 2,
        metadata: { cloneId: 'invalid' }
      }),
    /cloneId must be a finite number/
  );
});

test('Mesmer packet builders attach canonical skill and summon identity', () => {
  const { events, context } = createFixture();

  events.push(buildMesmerPacket({ type: 'marker', at: 1, skillId: 123 }));
  events.push(
    ...buildMesmerConditions(context, 'Condition Skill', 2, { name: 'Bleeding', duration: 3 }, 'Clone', '', {
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
        sourceId: 'mesmer.effect:Condition Skill',
        actorType: 'summon',
        summonKind: 'clone',
        skillId: 'mesmer.effect:Condition Skill'
      },
      { source: 'Player', sourceId: 456, actorType: 'player', summonKind: undefined, skillId: 456 }
    ]
  );
});

test('Mesmer packet builders preserve explicit derived-effect identity', () => {
  const { events, context } = createFixture();

  events.push(
    ...buildMesmerConditions(context, 'Condition Skill', 2, { name: 'Bleeding', duration: 3 }, 'Player', '', {
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
