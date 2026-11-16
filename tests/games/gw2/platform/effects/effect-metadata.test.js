/** Metadata ownership covers authored and procedural packets, including deferred preparation. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import {
  combineMetadataFields,
  normalizeEffectMetadata,
  SHARED_METADATA_FIELDS
} from '#gw2/platform/events/metadata.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const declarations = { sample: 'number', flag: 'boolean', returnId: 'skillId', tag: 'string' };
const metadataFields = createCanonicalCatalog({ metadataFields: declarations }).metadataFields;
const strike = { type: 'strike', coefficient: 1 };
const packet = {
  type: 'damage',
  at: 0,
  source: 'Fixture',
  sourceId: 1,
  actorType: 'player',
  coefficient: 1,
  weaponStrength: 1000
};
const catalog = (effects = []) =>
  createCanonicalCatalog({
    metadataFields: declarations,
    skills: [{ id: 1, name: 'Fixture', effects }]
  });
const profession = (hooks = {}) =>
  defineTestProfession({ id: 'metadata-fixture', name: 'Metadata fixture', catalog: catalog(), hooks });

// Shared defaults cannot admit a private annotation or let a profession replace a shared kind.
test('catalog defaults include shared metadata and reject undeclared private annotations', () => {
  const defaults = createCanonicalCatalog();
  assert.deepEqual(defaults.metadataFields, SHARED_METADATA_FIELDS);
  const shared = { ...strike, metadata: { triggeredByAlly: 0, packetKind: 'fixture' } };
  assert.doesNotThrow(() => createCanonicalCatalog({ skills: [{ id: 1, name: 'Fixture', effects: [shared] }] }));
  assert.throws(
    () =>
      createCanonicalCatalog({
        skills: [{ id: 1, name: 'Fixture', effects: [{ ...strike, metadata: { sample: 0 } }] }]
      }),
    /unsupported field.*sample/
  );
  assert.throws(
    () => createCanonicalCatalog({ metadataFields: { triggeredByAlly: 'boolean' } }),
    /Duplicate.*triggeredByAlly/
  );
});

test('metadata declarations are detached, family scoped, and reject duplicate ownership', () => {
  const input = { sample: 'number' };
  const declared = combineMetadataFields([{ owner: 'Fixture', fields: input }]);
  input.sample = 'boolean';
  assert.equal(declared.sample, 'number');
  assert.ok(Object.isFrozen(declared));
  assert.throws(
    () =>
      combineMetadataFields([
        { owner: 'Core', fields: { sample: 'number' } },
        { owner: 'Elite', fields: { sample: 'number' } }
      ]),
    /Duplicate.*sample.*Core.*Elite/
  );
  assert.throws(
    () =>
      combineMetadataFields([
        { owner: 'platform', fields: SHARED_METADATA_FIELDS },
        { owner: 'Fixture', fields: { triggeredByAlly: 'number' } }
      ]),
    /Duplicate.*platform/
  );
  assert.throws(() => normalizeEffectMetadata({ sample: 0 }, SHARED_METADATA_FIELDS), /unsupported field.*sample/);
  const foreign = combineMetadataFields([{ owner: 'Foreign', fields: { foreignFlag: 'boolean' } }]);
  const foreignMetadata = normalizeEffectMetadata({ foreignFlag: false }, foreign);
  assert.throws(() => normalizeEffectMetadata(foreignMetadata, declared), /unsupported field/);
  assert.deepEqual(
    normalizeEffectMetadata(
      { trigger: 'fixture', packetKind: 'fixture' },
      createCanonicalCatalog({ metadataFields: declared }).metadataFields
    ),
    {
      trigger: 'fixture',
      packetKind: 'fixture'
    }
  );
});

test('metadata checks primitive types without discarding zero, false, or signed numbers', () => {
  const input = { sample: -1, flag: false, returnId: 0, tag: 'fixture', triggeredByAlly: 0 };
  const accepted = normalizeEffectMetadata(input, metadataFields);
  input.sample = 4;
  assert.deepEqual(accepted, { ...input, sample: -1 });
  assert.ok(Object.isFrozen(accepted));
  for (const returnId of [0, -1, 1, 'fixture.id'])
    assert.equal(normalizeEffectMetadata({ returnId }, metadataFields).returnId, returnId);
  for (const returnId of [{ id: 1 }, [], true, false, '', NaN, Infinity, null, undefined]) {
    assert.throws(() => normalizeEffectMetadata({ returnId }, metadataFields), /skill ID/);
  }

  for (const metadata of [{ sample: '1' }, { sample: Infinity }, { flag: 0 }, { tag: '' }, { tag: 1 }]) {
    assert.throws(() => normalizeEffectMetadata(metadata, metadataFields), /must be/);
  }
});

test('catalog checks effect, tick, custom event, and nested action annotations against its own schema', () => {
  const shapes = (metadata) => [
    { ...strike, metadata },
    { type: 'strike', ticks: [{ atMs: 0, coefficient: 1, metadata }] },
    { type: 'condition', ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 1, duration: 1, metadata }] },
    { type: 'custom', eventType: 'fixture.packet', event: { metadata } },
    {
      ...strike,
      reactions: [
        {
          on: 'damage.resolved',
          actor: 'player',
          packets: 'each',
          do: [{ type: 'fixture.emit', id: 'fixture-emission', effects: [{ ...strike, metadata }] }]
        }
      ]
    }
  ];
  for (const effect of shapes({ sample: 0, flag: false })) {
    const accepted = catalog([effect]);
    // Reusing canonical records in another catalog must not bypass that catalog's vocabulary.
    assert.throws(() => createCanonicalCatalog({ skills: accepted.skills }), /unsupported field/);
  }

  for (const metadata of [{ sample: 'bad' }, { foreignFlag: true }]) {
    for (const effect of shapes(metadata)) assert.throws(() => catalog([effect]), /metadata/);
  }
});

test('materialization retains private metadata and base, effect, tick precedence without sharing siblings', () => {
  const accepted = catalog([
    {
      type: 'strike',
      metadata: { sample: 2, flag: true },
      ticks: [
        { atMs: 0, coefficient: 1, metadata: { flag: false } },
        { atMs: 1, coefficient: 1 }
      ]
    }
  ]);
  const [first, second] = materializeSkillEffectApplications({
    skill: accepted.skills[0],
    effect: accepted.skills[0].effects[0],
    start: 0,
    fullEnd: 1,
    baseEvent: { source: 'Fixture', sourceId: 1, actorType: 'player', metadata: { sample: 1, tag: 'base' } }
  });
  assert.deepEqual(first.event.metadata, { sample: 2, tag: 'base', flag: false });
  assert.deepEqual(second.event.metadata, { sample: 2, tag: 'base', flag: true });
  assert.notEqual(first.event.metadata, second.event.metadata);
});

test('runtime rejects invalid metadata at final admission and after immediate or deferred preparation', () => {
  const selected = profession();
  for (const metadata of [{ sample: 'bad' }, { foreignFlag: true }]) {
    assert.throws(() => resolveTestGw2Events({ profession: selected, events: [{ ...packet, metadata }] }), /metadata/);
  }

  for (const deferred of [false, true]) {
    const selected = profession({ prepareEvent: (_runtime, event) => ({ ...event, metadata: { sample: 'bad' } }) });
    assert.throws(
      () =>
        resolveTestGw2Events({
          profession: selected,
          endTime: 1,
          engineInitialize(runtime) {
            runtime.effects.emit({
              kind: 'packet',
              event: { ...packet, at: deferred ? 1 : 0 },
              ...(deferred ? { owner: { id: 'fixture.owner', generation: 1 } } : {})
            });
          }
        }),
      /metadata.*sample/
    );
  }
});

test('preparation detaches annotations and preserves deferred causal identity', () => {
  const preparedMetadata = { sample: 2, flag: false };
  const receipts = [];
  const selected = profession({ prepareEvent: (_runtime, event) => ({ ...event, metadata: preparedMetadata }) });
  const result = resolveTestGw2Events({
    profession: selected,
    endTime: 1,
    engineInitialize(runtime) {
      const parent = runtime.effects.emit({ kind: 'packet', receipt: true, event: packet });
      receipts.push(parent);
      receipts.push(
        runtime.effects.emit({
          kind: 'packet',
          receipt: true,
          event: { ...packet, at: 1 },
          owner: { id: 'fixture.owner', generation: 1 },
          cause: parent
        })
      );
      preparedMetadata.sample = 3;
    }
  });
  assert.equal(receipts[0].metadata.sample, 2);
  assert.equal(result.resolvedEvents[0].metadata.sample, 2);
  assert.equal(result.resolvedEvents[1].metadata.sample, 3);
  assert.equal(result.resolvedEvents[1].eventOrder, receipts[1].eventOrder);
  assert.equal(result.resolvedEvents[1].causalOrder, receipts[1].causalOrder);
  preparedMetadata.sample = 4;
  assert.equal(result.resolvedEvents[1].metadata.sample, 3);
});

// Both condition entry points must reject invalid annotations before application, including live preparation.
test('condition metadata is admitted before immediate settlement or queued application', () => {
  for (const mode of ['reaction', 'queued', 'deferred']) {
    const run = (metadata, hooks = {}) =>
      resolveTestGw2Events({
        profession: profession(hooks),
        endTime: 2,
        engineInitialize(runtime) {
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'condition',
              at: mode === 'deferred' ? 1 : 0,
              source: 'Fixture',
              sourceId: 1,
              actorType: 'player',
              condition: 'Bleeding',
              stacks: 1,
              duration: 1,
              metadata
            },
            ...(mode === 'reaction' ? { settlement: 'reaction' } : {}),
            ...(mode === 'deferred' ? { owner: { id: 'fixture.condition', generation: 1 } } : {})
          });
        }
      });
    assert.doesNotThrow(() => run({ sample: 0, flag: false }), mode);
    assert.throws(() => run({ sample: NaN }), /metadata.*sample/, mode);
    assert.throws(
      () =>
        run(
          { sample: 0 },
          {
            prepareEvent: (_runtime, event) =>
              event.type === 'condition' ? { ...event, metadata: { sample: 'invalid' } } : event
          }
        ),
      /metadata.*sample/,
      mode
    );
  }
});
