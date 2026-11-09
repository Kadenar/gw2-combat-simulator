import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { consumeMesmerClones, createMesmerClones } from '#gw2/professions/mesmer/core/mechanics/illusions/clones.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';

test('retired clone packets cannot grant accepted critical conditions', () => {
  // Cancellation happens before impact; the surviving owner's sampled hit alone can trigger Sharper Images.
  const result = runMesmer(
    [{ type: 'wait', durationMs: 1200 }],
    {
      specialization: 'Core',
      selectedTraitIds: [TRAIT.SHARPER_IMAGES],
      attributeInputs: baseAttributeInputs({ precision: 4000 }),
      target: { armor: 2597 }
    },
    {
      initialize(runtime) {
        for (const id of [0, 1])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at: 1,
              source: 'Clone',
              sourceId: 'clone-test',
              actorType: 'summon',
              summonKind: 'clone',
              summonOwner: `mesmer.clone:${id}`,
              metadata: { cloneId: id },
              coefficient: 1,
              weaponStrength: 1000
            }
          });
        runtime.cancelOwner({ id: 'mesmer.clone:0', generation: 0 });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 1);
  assert.equal(result.events.filter((event) => event.type === 'condition' && event.condition === 'Bleeding').length, 1);
});

for (const identityField of ['summonOwner', 'metadata']) {
  test(`clone ${identityField} owns all pending effect kinds before preparation`, () => {
    // Cancellation must discard preparation as well as the effect, regardless of its translated display label.
    const prepared = [];
    const effects = [
      { type: 'damage', coefficient: 1, weaponStrength: 1000 },
      { type: 'condition', condition: 'Torment', duration: 4, stacks: 1 },
      { type: 'control', controlKind: 'daze', duration: 1 },
      { type: 'buff', kind: 'might', duration: 4, stacks: 1 }
    ];
    const result = runMesmer(
      [{ type: 'wait', durationMs: 1200 }],
      { specialization: 'Core', selectedTraitIds: [] },
      {
        extend(native) {
          return {
            prepareEvent(runtime, event) {
              if (String(event.sourceId).startsWith('ownership:')) prepared.push([event.sourceId, runtime.time]);

              return native.prepareEvent(runtime, event);
            }
          };
        },
        initialize(runtime) {
          for (const id of [0, 1])
            for (const effect of effects)
              runtime.effects.emit({
                kind: 'packet',
                event: {
                  ...effect,
                  at: 1,
                  source: 'Illusion sans nom',
                  sourceId: `ownership:${id}:${effect.type}`,
                  actorType: 'summon',
                  summonKind: 'clone',
                  ...(identityField === 'summonOwner'
                    ? { summonOwner: `mesmer.clone:${id}` }
                    : { metadata: { cloneId: id } })
                }
              });
          assert.deepEqual(prepared, []);
        },
        timeline: [
          {
            at: 0.5,
            run(runtime) {
              assert.deepEqual(prepared, []);
              runtime.cancelOwner({ id: 'mesmer.clone:0', generation: 0 });
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const expected = effects.map(({ type }) => `ownership:1:${type}`).sort();
    assert.deepEqual(prepared.map(([id]) => id).sort(), expected);
    assert.ok(
      prepared.every(([, at]) => at === 1),
      'preparation waits until the owned effect is delivered'
    );
    const delivered = result.events.filter((event) => String(event.sourceId).startsWith('ownership:'));
    assert.deepEqual(delivered.map(({ sourceId }) => sourceId).sort(), expected);
    assert.ok(delivered.every((event) => event.actorType === 'summon' && event.source === 'Illusion sans nom'));
  });
}

test('accepted clone finishers retain delayed combo conditions after clone retirement', () => {
  // A retired clone loses its pending attacks while a finisher already accepted by the combo system keeps its outcome.
  const result = runMesmer(
    [{ type: 'wait', durationMs: 1500 }],
    { specialization: 'Core', initialResource: 0 },
    {
      initialize(runtime) {
        createMesmerClones(runtime.mechanics, { at: 0, count: 1, weapon: 'Sword', maximum: 3 });
        const strike = {
          type: 'damage',
          source: 'Clone',
          sourceId: 999,
          actorType: 'summon',
          summonKind: 'clone',
          summonOwner: 'mesmer.clone:1',
          metadata: { cloneId: 1 },
          coefficient: 1,
          weaponStrength: 1000
        };
        runtime.effects.emit({
          kind: 'packet',
          event: {
            ...strike,
            at: 0.1,
            comboFields: [{ ownerId: 'mesmer', fieldType: 'Fire', duration: 3 }],
            comboFinishers: [{ ownerId: 'mesmer', finisherType: 'Projectile', effectDelay: 1 }]
          }
        });
        runtime.effects.emit({ kind: 'packet', event: { ...strike, at: 1 } });
      },
      timeline: [{ at: 0.5, run: (runtime) => consumeMesmerClones(runtime.mechanics) }]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 1);
  const burning = result.resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Burning');
  assert.ok(burning?.comboId, 'the delayed finisher still applies its condition');
  assert.equal(burning.summonOwner, 'mesmer.clone:1');
  assert.equal(burning.sourceId, 999);
});

test('explicit packet owners take precedence and display labels do not assign clone lifetimes', () => {
  // Separate lifetimes survive clone retirement, while retiring an explicit owner cancels even a live clone's packet.
  const result = runMesmer(
    [{ type: 'wait', durationMs: 1200 }],
    { specialization: 'Core', selectedTraitIds: [] },
    {
      initialize(runtime) {
        const packets = [
          { sourceId: 'player', actorType: 'player' },
          { sourceId: 'phantasm', actorType: 'summon', summonKind: 'phantasm', summonOwner: 'mesmer.phantasm:0' },
          { sourceId: 'independent', actorType: 'summon', summonKind: 'clone', metadata: { cloneId: 0 } },
          { sourceId: 'retired-owner', actorType: 'summon', summonKind: 'clone', metadata: { cloneId: 1 } }
        ];
        for (const packet of packets)
          runtime.effects.emit({
            kind: 'packet',
            event: { ...packet, type: 'damage', at: 1, source: 'Clone', coefficient: 1, weaponStrength: 1000 },
            ...(packet.metadata ? { owner: { id: `fixture:${packet.sourceId}`, generation: 0 } } : {})
          });
      },
      timeline: [
        {
          at: 0.5,
          run(runtime) {
            runtime.cancelOwner({ id: 'mesmer.clone:0', generation: 0 });
            runtime.cancelOwner({ id: 'fixture:retired-owner', generation: 0 });
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.type === 'damage')
      .map(({ sourceId }) => sourceId)
      .sort(),
    ['independent', 'phantasm', 'player']
  );
});
