import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

function fixtureProfession(initialize, catalog = createCanonicalCatalog()) {
  return defineProfession({
    id: 'combo-fixture',
    name: 'Combo Fixture',
    catalog,
    resources: { createState: () => ({}) },
    live: {
      initialize
    }
  });
}

// Minimal shared packets keep boundary checks independent of saved rotations and profession timing.
const boundaryOwner = { source: 'combo-fixture', sourceId: 'boundary', actorType: 'player' };
const boundaryField = {
  ...boundaryOwner,
  type: 'combo_field',
  at: 0,
  fieldId: 'boundary:fire',
  fieldType: 'Fire',
  expiresAt: 10,
  ownerId: 'combo-fixture',
  ownerActorType: 'player'
};
const boundaryHit = {
  ...boundaryOwner,
  type: 'damage',
  weaponStrength: 1000,
  at: 1,
  coefficient: 1,
  skillName: 'Boundary hit'
};
const boundaryConfig = {
  stats: { power: 1000, precision: 2785, conditionDamage: 1000 },
  target: { armor: 2597, conditions: {} }
};

test('combo boons and their relic grants settle before critical sampling in both phases', () => {
  for (const mode of ['deterministic', 'stochastic']) {
    const profession = fixtureProfession((context) => {
      context.emit(boundaryField);
      context.emit({ ...boundaryHit, comboFinishers: [{ ownerId: 'combo-fixture', finisherType: 'Blast' }] });
      context.emit({ ...boundaryHit, skillName: 'Next same-time hit' });
    });
    const options = {
      profession,
      rotation: [{ type: 'wait', durationMs: 2000 }],
      config: {
        ...boundaryConfig,
        randomness: { mode, seed: 7 },
        boons: { might: 6 },
        relic: 'Mistburn',
        sigilSets: [{ names: ['Earth'] }]
      }
    };
    // Three combo Might plus the relic's fourth stack must all precede the two hits.
    const result = simulateGw2({ ...options, damageDiagnostics: true });
    assert.equal(result.criticalSigilDiagnostics[0]?.claimed, true);
    assert.equal(result.criticalSigilDiagnostics[0]?.chance, 1);
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage');
    assert.deepEqual(
      hits.map((event) => event.criticalChance),
      [1, 1]
    );
    assert.equal(
      result.resolvedEvents.filter((event) => event.sourceId === 'relic.mistburn' && event.type === 'buff').length,
      1
    );
    assert.equal(
      result.events.some((event) => event.schedulerBoonPrediction || event.schedulerPrediction),
      false
    );
    assert.equal(simulateGw2(options).totalDamage, result.totalDamage);
    assert.equal(simulateGw2({ ...options, output: 'score' }).totalDamage, result.totalDamage);
    if (mode === 'stochastic')
      assert.deepEqual(
        hits.map((event) => event.didCrit),
        [true, true]
      );
  }
});

test('precombat combo boons carry into combat without counting precombat hits', () => {
  const profession = fixtureProfession((context) => {
    context.emit(boundaryField);
    context.emit({ ...boundaryHit, comboFinishers: [{ ownerId: 'combo-fixture', finisherType: 'Blast' }] });
    context.emit({ ...boundaryHit, at: 2.5 });
  });
  const result = simulateGw2({
    profession,
    damageDiagnostics: true,
    rotation: [{ type: 'wait', durationMs: 2000 }, '__combat_start', { type: 'wait', durationMs: 1000 }],
    config: { ...boundaryConfig, relic: 'Mistburn', boons: { might: 6 }, sigilSets: [{ names: ['Earth'] }] }
  });
  // Both phases must see the setup Might, but the precombat strike cannot advance critical sigils.
  assert.ok(result.resolvedEvents.some((event) => event.type === 'combo' && event.at === 1));
  assert.ok(result.resolvedEvents.some((event) => event.sourceId === 'relic.mistburn' && event.at === 1));
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage');
  assert.deepEqual(
    hits.map((event) => event.at),
    [2.5]
  );
  assert.equal(hits[0].criticalChance, 1);
  assert.equal(result.criticalSigilDiagnostics[0].suppression, 'precombat');
  assert.equal(result.criticalSigilDiagnostics[1].claimed, true);
});

test('precombat light finishers grant their aura even when aimed off target', () => {
  const profession = fixtureProfession((context) => {
    context.emit({ ...boundaryField, fieldType: 'Light' });
    context.emit({
      ...boundaryHit,
      offTarget: true,
      comboFinishers: [{ ownerId: 'combo-fixture', finisherType: 'Leap' }]
    });
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 2000 }, '__combat_start'],
    config: boundaryConfig
  });
  const aura = result.resolvedEvents.find((event) => event.type === 'aura' && event.aura === 'Light Aura');
  assert.ok(aura.at < result.combatStartTime);
  assert.ok(aura.at + aura.duration > result.combatStartTime);
  assert.equal(result.totalDamage, 0);
});

test('precombat combo conditions and siphons cannot affect the target', () => {
  // Finishers still succeed, but their enemy-facing outcomes cannot persist across Combat Start.
  for (const fieldType of ['Fire', 'Dark']) {
    const profession = fixtureProfession((context) => {
      context.emit({ ...boundaryField, fieldType });
      context.emit({ ...boundaryHit, comboFinishers: [{ ownerId: 'combo-fixture', finisherType: 'Projectile' }] });
    });
    const result = simulateGw2({
      profession,
      rotation: [{ type: 'wait', durationMs: 2000 }, '__combat_start', { type: 'wait', durationMs: 3000 }],
      config: boundaryConfig
    });
    assert.ok(result.resolvedEvents.some((event) => event.type === 'combo'));
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'condition' || event.type === 'damage'),
      false
    );
    assert.equal(result.totalDamage, 0);
  }
});

test('off-target combo packets suppress hostile outcomes while retaining beneficial Blast effects', () => {
  for (const finisherType of ['Projectile', 'Blast']) {
    const profession = fixtureProfession((context) => {
      context.emit(boundaryField);
      context.emit({ ...boundaryHit, offTarget: true, comboFinishers: [{ ownerId: 'combo-fixture', finisherType }] });
    });
    const result = simulateGw2({ profession, rotation: [{ type: 'wait', durationMs: 3000 }], config: boundaryConfig });
    assert.equal(result.totalDamage, 0);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'condition'),
      false
    );
    assert.equal(
      result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'might').length,
      finisherType === 'Blast' ? 1 : 0
    );
  }
});

test('combo outcomes settle before their originating damage packet', () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: 'combo_field',
      at: 0,
      source: 'Fire Field',
      sourceId: 'fixture.fire-field',
      actorType: 'effect',
      fieldId: 'fixture:fire',
      fieldType: 'Fire',
      expiresAt: 2,
      ownerId: 'combo-fixture',
      ownerActorType: 'player'
    });
    context.emit({
      type: 'damage',
      weaponStrength: 1000,
      at: 1,
      source: 'Fixture Blast',
      sourceId: 'fixture.blast',
      actorType: 'player',
      skillName: 'Fixture Blast',
      coefficient: 1,
      comboFinishers: [{ ownerId: 'combo-fixture', finisherType: 'Blast' }]
    });
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 2000 }],
    damageDiagnostics: true,
    config: {
      stats: { power: 1000, precision: 0, ferocity: 0 },
      target: { armor: 2597, conditions: {} }
    }
  });
  const mightIndex = result.resolvedEvents.findIndex((event) => event.type === 'buff' && event.kind === 'might');
  const damageIndex = result.resolvedEvents.findIndex(
    (event) => event.type === 'damage' && event.skillName === 'Fixture Blast'
  );

  // The blast receives the three Might stacks produced by its own successful Fire combo.
  assert.ok(mightIndex >= 0 && mightIndex < damageIndex);
  assert.equal(result.resolvedEvents[damageIndex].damageCalculation.power, 1090);
});

test('combo boons use profession duration modifiers at the combo time with finisher ownership', () => {
  const profession = defineProfession({
    id: 'combo-duration-fixture',
    name: 'Combo Duration Fixture',
    catalog: createCanonicalCatalog(),
    attributeRules: {
      // Distinct live bonuses make a wrong timestamp or player-forced actor observable.
      modifyAttributes(context, stats) {
        const bonus = context.time < 2 ? 0 : context.actorType === 'summon' ? 150 : 300;
        if (context.actorType === 'summon') assert.equal(context.event.summonOwner, 'fixture-pet');
        return { ...stats, concentration: Number(stats.concentration || 0) + bonus };
      }
    },
    live: {
      initialize(context) {
        for (const fieldType of ['Fire', 'Smoke']) {
          context.emit({
            type: 'combo_field',
            at: 0,
            expiresAt: 5,
            source: 'Fixture Field',
            sourceId: 'fixture.field',
            actorType: 'effect',
            fieldId: fieldType,
            fieldType,
            ownerId: 'fixture',
            ownerActorType: 'environment'
          });
        }

        for (const [attemptId, effectAt, actorType, fieldId] of [
          ['early', 1, 'player', 'Fire'],
          ['late', 3, 'player', 'Fire'],
          ['pet', 3, 'summon', 'Fire'],
          ['fixed', 3, 'player', 'Smoke']
        ]) {
          context.emit({
            type: 'combo_finisher',
            at: 1,
            effectAt,
            source: 'Fixture Blast',
            sourceId: 'fixture.blast',
            actorType,
            ...(actorType === 'summon' ? { summonOwner: 'fixture-pet' } : {}),
            attemptId,
            finisherType: 'Blast',
            fieldBinding: { kind: 'field-id', fieldId },
            chance: 1,
            applications: 1,
            successfulCombos: 1
          });
        }
      }
    }
  });
  const rotation = [{ type: 'wait', durationMs: 4000 }];
  for (const [startingWeaponSet, expectedDurations] of [
    [1, [20, 24, 22, 3]],
    [2, [26, 30, 28, 3]]
  ]) {
    const config = {
      startingWeaponSet,
      weaponSetStats: [{ concentration: 0 }, { concentration: 300 }],
      sigilSets: [{}, { boonDurationBonus: 10 }]
    };
    const predicted = simulateGw2({ profession, config, rotation: rotation });
    const resolved = simulateGw2({ profession, config, rotation });
    assert.deepEqual(resolved.warnings, []);
    for (const [events, prediction] of [
      [predicted.events, false],
      [resolved.resolvedEvents, false]
    ]) {
      const boons = events.filter((event) => event.type === 'buff' && event.comboId);
      assert.equal(boons.length, 4); // Predictions must not become duplicate authoritative applications.
      for (const [index, attemptId] of ['early', 'late', 'pet', 'fixed'].entries()) {
        const boon = boons.find((event) => event.attemptId === attemptId);
        assert.ok(Math.abs(boon.duration - expectedDurations[index]) < 1e-9, `${attemptId}, set ${startingWeaponSet}`);
        assert.equal(boon.schedulerPrediction === 'combo-result', prediction);
        assert.equal(boon.actorType, attemptId === 'pet' ? 'summon' : 'player');
      }
    }
  }
});

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
          weaponStrength: 1000,
          coefficient: 1,
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
    const predicted = simulateGw2({ profession, rotation: rotation });
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
        weaponStrength: 1000,
        at: 1,
        source: 'Fixture Leap',
        sourceId: 'fixture.leap',
        actorType: 'player',
        activationId: 'cast:current',
        coefficient: 1,
        comboFinishers: [{ ownerId: 'combo-fixture', finisherType: 'Leap', excludeOwnField }]
      });
      // Author a higher-priority own field last to exercise rebinding as well as initial selection.
      context.emit({ ...field, fieldId: 'field:own', activationId: 'cast:current', comboBindingPriority: 1 });
    });
    const rotation = [{ type: 'wait', durationMs: 2000 }];
    const predicted = simulateGw2({ profession, rotation: rotation });
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
            weaponStrength: 1000,
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
  const result = simulateGw2({ profession, rotation: ['Canonical Fire Field', 'Canonical Blast'] });

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

test('pet fields retain their caster while combo conditions retain the finisher owner', () => {
  // A player's projectile through a pet field remains player-owned; the pet's projectile stays independent.
  const pet = {
    source: 'fixture-pet',
    actorType: 'summon',
    summonOwner: 'fixture-pet:1',
    independentSummonStrike: true,
    independentConditionOwner: true,
    summonBasePower: 1000,
    summonBaseConditionDamage: 500
  };
  const profession = fixtureProfession((context) => {
    context.emit({
      ...pet,
      type: 'action',
      at: 0,
      endsAt: 0,
      sourceId: 'pet-field',
      comboFields: [{ ownerId: 'combo-fixture', fieldType: 'Fire', duration: 5 }]
    });
    for (const [at, actor] of [
      [1, pet],
      [2, { source: 'Player', actorType: 'player' }]
    ]) {
      context.emit({
        ...actor,
        type: 'damage',
        weaponStrength: 1000,
        at,
        sourceId: `projectile:${at}`,
        coefficient: 1,
        comboFinishers: [{ ownerId: 'combo-fixture', finisherType: 'Projectile' }]
      });
    }
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 5000 }],
    config: { stats: { conditionDamage: 2000 }, target: { armor: 2597, conditions: {} } }
  });
  const field = result.events.find((event) => event.type === 'combo_field');
  assert.equal(field.ownerActorType, 'summon');
  assert.equal(field.summonOwner, pet.summonOwner);
  assert.equal(field.independentConditionOwner, true);
  for (const event of [
    ...result.events.filter((event) => event.type === 'combo_finisher'),
    ...result.resolvedEvents.filter((event) => event.type === 'combo' || event.type === 'condition')
  ]) {
    const isPet = event.sourceId === 'projectile:1';
    assert.equal(event.actorType, isPet ? 'summon' : 'player');
    assert.equal(event.summonOwner, isPet ? pet.summonOwner : undefined);
    assert.equal(event.independentConditionOwner, isPet ? true : undefined);
  }

  const conditions = result.resolvedEvents.filter((event) => event.type === 'condition');
  assert.equal(conditions.length, 2);
  assert.ok(conditions[1].damage > conditions[0].damage, 'player condition stats must not replace pet stats');
  assert.deepEqual(result.warnings, []);
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
      weaponStrength: 1000,
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
  const result = simulateGw2({ profession, rotation: [{ type: 'wait', durationMs: 2000 }] });
  const finisher = result.events.find((event) => event.type === 'combo_finisher');
  const combo = result.events.find((event) => event.type === 'combo');

  assert.deepEqual(finisher.fieldBinding, {
    kind: 'field-id',
    fieldId: 'field:authoritative-ice'
  });
  assert.equal(combo.fieldId, 'field:authoritative-ice');
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
      weaponStrength: 1000,
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

test('canonically equal fields register before finishers by default', () => {
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
  const result = simulateGw2({ profession, rotation: [{ type: 'wait', durationMs: 400 }] });

  assert.equal(result.events.filter((event) => event.type === 'combo').length, 1);
  assert.equal(result.events.find((event) => event.type === 'aura')?.aura, 'Frost Aura');
});
