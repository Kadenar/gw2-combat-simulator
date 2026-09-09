import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

function fixtureProfession(initialize, catalog = createCanonicalCatalog()) {
  return defineProfession({
    id: 'combo-fixture',
    name: 'Combo Fixture',
    catalog,
    resources: { createProfessionState: () => ({}) },
    schedulerHooks: { initialize }
  });
}

test('cast-start field selection survives expiration but still requires a committed impact', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 20,
        name: 'Delayed Finishers',
        castTimeMs: 1000,
        interruptCommitMs: 300,
        effects: [undefined, 'castStart'].map((fieldSelectionAnchor, index) => ({
          type: 'strike',
          coefficient: 1,
          weaponStrength: 1000,
          atMs: 600 + index * 200,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          persistsAfterInterrupt: true,
          comboFinishers: [
            { ownerId: 'combo-fixture', finisherType: 'Blast', fieldSelectionAnchor, attemptGroup: `effect:${index}` }
          ]
        }))
      },
      {
        id: 21,
        name: 'Later Field',
        castTimeMs: 0,
        comboFields: [{ ownerId: 'combo-fixture', fieldType: 'Fire', duration: 2 }],
        effects: []
      }
    ]
  });

  // The earlier default finisher also exercises history retention before the anchored finisher resolves.
  for (const { label, startsAt = 0, expiresAt, castDelayMs = 0, interruptMs, laterField, expected } of [
    { label: 'expired field', expiresAt: 0.5, expected: [0.8] },
    { label: 'active field', expiresAt: 2, expected: [0.6, 0.8] },
    { label: 'cancelled before commitment', expiresAt: 0.5, interruptMs: 100, expected: [] },
    { label: 'committed impact', expiresAt: 0.5, interruptMs: 400, expected: [0.8] },
    { label: 'field created after cast start', interruptMs: 400, laterField: true, expected: [0.6, 0.8] },
    { label: 'field entirely within cast', startsAt: 0.2, expiresAt: 0.5, expected: [0.8] },
    { label: 'field expired before cast', expiresAt: 0.5, castDelayMs: 1000, expected: [] },
    { label: 'field created after impact', startsAt: 0.9, expiresAt: 2, expected: [] }
  ]) {
    const profession = fixtureProfession((context) => {
      if (expiresAt != null) {
        context.emit({
          type: 'combo_field',
          at: startsAt,
          source: 'Initial Field',
          sourceId: 'initial-field',
          actorType: 'effect',
          fieldId: 'field:initial',
          fieldType: 'Fire',
          expiresAt,
          ownerId: 'combo-fixture',
          ownerActorType: 'player'
        });
      }
    }, catalog);
    const rotation = [
      ...(castDelayMs ? [{ type: 'wait', durationMs: castDelayMs }] : []),
      { name: 'Delayed Finishers', ...(interruptMs == null ? {} : { interruptMs }) },
      ...(laterField ? ['Later Field'] : []),
      { type: 'wait', durationMs: 1000 }
    ];
    const predicted = createScheduler({ profession, schedulerPolicy: createGw2SchedulerPolicy() }).run(rotation);
    const result = simulateGw2({
      profession,
      rotation,
      config: { target: { armor: 2597, conditions: {} } }
    });

    for (const events of [predicted.events, result.resolvedEvents]) {
      assert.deepEqual(
        events.filter((event) => event.type === 'combo').map((event) => event.at),
        expected,
        label
      );
      assert.deepEqual(
        events
          .filter((event) => event.type === 'buff' && event.comboId && event.kind === 'might')
          .map((event) => event.at),
        expected,
        `${label}: outcomes stay at impact`
      );
    }
  }
});

test('own-field exclusion survives rebinding and still allows fields from earlier activations', () => {
  for (const [excludeOwnField, earlierField, expectedFieldId] of [
    [true, false, undefined],
    [true, true, 'field:earlier'],
    [false, false, 'field:own']
  ]) {
    const profession = fixtureProfession((context) => {
      const field = {
        type: 'combo_field',
        at: 0,
        expiresAt: 2,
        source: 'Fixture Field',
        sourceId: 'fixture.field',
        actorType: 'effect',
        fieldType: 'Light',
        ownerId: 'combo-fixture',
        ownerActorType: 'player'
      };
      if (earlierField) context.emit({ ...field, fieldId: 'field:earlier', activationId: 'cast:earlier' });
      context.emit({
        type: 'damage',
        at: 1,
        source: 'Fixture Leap',
        sourceId: 'fixture.leap',
        actorType: 'player',
        activationId: 'cast:current',
        coefficient: 1,
        weaponStrength: 1000,
        comboFinishers: [{ ownerId: 'combo-fixture', finisherType: 'Leap', excludeOwnField }]
      });
      // Author a higher-priority own field last to exercise rebinding as well as initial selection.
      context.emit({ ...field, fieldId: 'field:own', activationId: 'cast:current', comboBindingPriority: 1 });
    });
    const rotation = [{ type: 'wait', durationMs: 2000 }];
    const predicted = createScheduler({ profession, schedulerPolicy: createGw2SchedulerPolicy() }).run(rotation);
    const resolved = simulateGw2({ profession, rotation, config: { target: { armor: 2597 } } });
    for (const events of [predicted.events, resolved.resolvedEvents]) {
      assert.deepEqual(
        events.filter((event) => event.type === 'combo').map((event) => event.fieldId),
        expectedFieldId ? [expectedFieldId] : []
      );
    }
  }
});

test('owned canonical descriptors produce shared combo events without a profession adapter', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 1,
        name: 'Canonical Fire Field',
        castTimeMs: 0,
        comboFields: [
          {
            ownerId: 'combo-fixture',
            fieldType: 'Fire',
            duration: 5,
            startAnchor: 'castEnd'
          }
        ],
        effects: []
      },
      {
        id: 2,
        name: 'Canonical Blast',
        castTimeMs: 0,
        effects: [
          {
            type: 'strike',
            coefficient: 1,
            comboFinishers: [
              {
                ownerId: 'combo-fixture',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ]
          }
        ]
      }
    ]
  });
  const profession = fixtureProfession(() => {}, catalog);
  const result = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy()
  }).run(['Canonical Fire Field', 'Canonical Blast']);

  const field = result.events.find((event) => event.type === 'combo_field');
  const finisher = result.events.find((event) => event.type === 'combo_finisher');
  const combo = result.events.find((event) => event.type === 'combo');

  assert.equal(field.ownerId, 'combo-fixture');
  assert.deepEqual(finisher.fieldBinding, {
    kind: 'field-id',
    fieldId: field.fieldId
  });
  assert.equal(combo.fieldId, field.fieldId);
  assert.equal(combo.finisherType, 'Blast');
});

test('a later-authored owned field rebinds an already scheduled finisher', () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: 'damage',
      at: 1,
      source: 'combo-fixture',
      sourceId: 2,
      actorType: 'player',
      skillId: 2,
      skillName: 'Scheduled Projectile',
      coefficient: 1,
      comboFinishers: [
        {
          ownerId: 'combo-fixture',
          finisherType: 'Projectile',
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
    context.emit({
      type: 'action',
      at: 0,
      endsAt: 0,
      source: 'combo-fixture',
      sourceId: 1,
      actorType: 'player',
      skillId: 1,
      skillName: 'Later Authored Ice Field',
      comboFields: [
        {
          ownerId: 'combo-fixture',
          fieldType: 'Ice',
          duration: 2,
          startAnchor: 'castEnd'
        }
      ]
    });
  });
  const result = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy()
  }).run([{ type: 'wait', durationMs: 2000 }]);
  const field = result.events.find((event) => event.type === 'combo_field');
  const finisher = result.events.find((event) => event.type === 'combo_finisher');

  assert.deepEqual(finisher.fieldBinding, {
    kind: 'field-id',
    fieldId: field.fieldId
  });
  assert.equal(result.events.find((event) => event.type === 'combo')?.fieldId, field.fieldId);
});

test("an authoritative owned field overrides a finisher's field preference", () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: 'combo_field',
      at: 0,
      source: 'Dark Field',
      sourceId: 'dark.field',
      actorType: 'effect',
      fieldId: 'field:dark',
      fieldType: 'Dark',
      expiresAt: 5,
      ownerId: 'combo-fixture',
      ownerActorType: 'player'
    });
    context.emit({
      type: 'combo_field',
      at: 0,
      source: 'Authoritative Ice Field',
      sourceId: 'ice.field',
      actorType: 'effect',
      fieldId: 'field:authoritative-ice',
      fieldType: 'Ice',
      expiresAt: 5,
      ownerId: 'combo-fixture',
      ownerActorType: 'player',
      comboBindingPriority: 1
    });
    context.emit({
      type: 'damage',
      at: 1,
      source: 'Preferred Dark Projectile',
      sourceId: 'preferred-dark-projectile',
      actorType: 'player',
      skillName: 'Preferred Dark Projectile',
      coefficient: 1,
      comboFinishers: [
        {
          ownerId: 'combo-fixture',
          finisherType: 'Projectile',
          preferredFieldTypes: ['Dark'],
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
  });
  const result = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy()
  }).run([{ type: 'wait', durationMs: 2000 }]);
  const finisher = result.events.find((event) => event.type === 'combo_finisher');
  const combo = result.events.find((event) => event.type === 'combo');

  assert.deepEqual(finisher.fieldBinding, {
    kind: 'field-id',
    fieldId: 'field:authoritative-ice'
  });
  assert.equal(combo.fieldId, 'field:authoritative-ice');
  assert.equal(combo.fieldType, 'Ice');
});

test('a later-authored authoritative field rebinds a previously bound finisher', () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: 'combo_field',
      at: 0,
      source: 'Dark Field',
      sourceId: 'dark.field',
      actorType: 'effect',
      fieldId: 'field:dark-first',
      fieldType: 'Dark',
      expiresAt: 5,
      ownerId: 'combo-fixture',
      ownerActorType: 'player'
    });
    context.emit({
      type: 'damage',
      at: 1,
      source: 'Scheduled Projectile',
      sourceId: 'scheduled-projectile',
      actorType: 'player',
      coefficient: 1,
      comboFinishers: [
        {
          ownerId: 'combo-fixture',
          finisherType: 'Projectile',
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
    context.emit({
      type: 'combo_field',
      at: 0,
      source: 'Authoritative Ice Field',
      sourceId: 'ice.field',
      actorType: 'effect',
      fieldId: 'field:authoritative-later',
      fieldType: 'Ice',
      expiresAt: 5,
      ownerId: 'combo-fixture',
      ownerActorType: 'player',
      comboBindingPriority: 1
    });
  });
  const result = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy()
  }).run([{ type: 'wait', durationMs: 2000 }]);
  const finisher = result.events.find((event) => event.type === 'combo_finisher');
  const combo = result.events.find((event) => event.type === 'combo');

  assert.deepEqual(finisher.fieldBinding, {
    kind: 'field-id',
    fieldId: 'field:authoritative-later'
  });
  assert.equal(combo.fieldId, 'field:authoritative-later');
  assert.equal(combo.fieldType, 'Ice');
});

test('pure movement skills resolve skill-level finishers end to end', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 10,
        name: 'Movement Ice Field',
        castTimeMs: 0,
        comboFields: [
          {
            ownerId: 'combo-fixture',
            fieldType: 'Ice',
            duration: 5
          }
        ],
        effects: []
      },
      {
        id: 11,
        name: 'Pure Movement Leap',
        castTimeMs: 0,
        comboFinishers: [
          {
            ownerId: 'combo-fixture',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        effects: []
      }
    ]
  });
  const result = simulateGw2({
    profession: fixtureProfession(() => {}, catalog),
    rotation: ['Movement Ice Field', 'Pure Movement Leap', { type: 'wait', durationMs: 1000 }],
    config: { target: { armor: 2597, conditions: {} } }
  });
  const combo = result.resolvedEvents.find((event) => event.type === 'combo');

  assert.equal(combo.finisherType, 'Leap');
  assert.equal(combo.fieldType, 'Ice');
});

test('cancelled summon attacks do not create resolver combo outcomes', () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: 'combo_field',
      at: 0,
      source: 'Summon Fire Field',
      sourceId: 'summon.fire-field',
      actorType: 'effect',
      fieldId: 'field:summon-fire',
      fieldType: 'Fire',
      expiresAt: 5,
      ownerId: 'combo-fixture',
      ownerActorType: 'player'
    });
    context.emit({
      type: 'damage',
      at: 1,
      source: 'Replaced Summon Attack',
      sourceId: 'summon.replaced-attack',
      actorType: 'summon',
      activationId: 'summon:replaced',
      coefficient: 1,
      weaponStrengthProfileId: 'summon.weapon-type-1',
      cancelled: true,
      comboFinishers: [
        {
          ownerId: 'combo-fixture',
          finisherType: 'Projectile',
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 2000 }],
    config: { target: { armor: 2597, conditions: {} } }
  });

  assert.equal(
    result.events.some((event) => event.type === 'combo_finisher'),
    false
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
});

test('the scheduler predicts a delayed combo result for later facts', () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: 'combo_field',
      at: 0,
      source: 'Flame Field',
      sourceId: 'field.skill',
      actorType: 'effect',
      fieldId: 'field:1',
      fieldType: 'Fire',
      expiresAt: 5,
      ownerId: 'combo-fixture',
      ownerActorType: 'player'
    });
    context.emit({
      type: 'combo_finisher',
      at: 1,
      effectAt: 2,
      source: 'Blast',
      sourceId: 'blast.skill',
      actorType: 'player',
      skillName: 'Blast',
      attemptId: 'blast:1',
      finisherType: 'Blast',
      fieldBinding: { kind: 'field-id', fieldId: 'field:1' },
      chance: 1,
      applications: 1,
      successfulCombos: 1
    });
  });
  const scheduler = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy()
  });
  const result = scheduler.run([{ type: 'wait', durationMs: 3000 }]);
  const combo = result.events.find((event) => event.type === 'combo');
  const might = result.events.find(
    (event) => event.type === 'buff' && event.kind === 'might' && event.schedulerPrediction === 'combo-result'
  );

  assert.equal(combo.at, 2);
  assert.equal(combo.schedulerPrediction, 'combo-result');
  assert.equal(might.at, 2);
  assert.equal(might.stacks, 3);
  assert.equal(scheduler.context.hasBuff('might', 2), true);
});

test('epsilon-equal fields register before finishers by default', () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: 'combo_finisher',
      at: 0.3,
      effectAt: 0.3,
      source: 'Leap',
      sourceId: 'leap.skill',
      actorType: 'player',
      attemptId: 'leap:1',
      finisherType: 'Leap',
      fieldBinding: { kind: 'field-id', fieldId: 'field:same-time' },
      chance: 1,
      applications: 1,
      successfulCombos: 1
    });
    context.emit({
      type: 'combo_field',
      at: 0.1 + 0.2,
      source: 'Ice Field',
      sourceId: 'ice.field',
      actorType: 'effect',
      fieldId: 'field:same-time',
      fieldType: 'Ice',
      expiresAt: 1.3,
      ownerId: 'combo-fixture',
      ownerActorType: 'player'
    });
  });
  const result = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy()
  }).run([{ type: 'wait', durationMs: 400 }]);

  assert.equal(result.events.filter((event) => event.type === 'combo').length, 1);
  assert.equal(result.events.find((event) => event.type === 'aura')?.aura, 'Frost Aura');
});
