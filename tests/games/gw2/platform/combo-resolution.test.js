import assert from 'node:assert/strict';
import test from 'node:test';

import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { createGw2ComboRuntimeState, registerComboField, resolveComboAttempt } from '#gw2/platform/combos/events.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';

const query = {
  statsAt: () => ({
    power: 1000,
    precision: 1000,
    toughness: 1000,
    vitality: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    concentration: 0,
    healingPower: 0
  }),
  critical: () => ({ chance: 0.05, damage: 1.5 }),
  strikeMultiplier: () => 1,
  conditionMultiplier: () => 1,
  conditionDurationMultiplier: () => 1,
  activeWeaponSetAt: () => 1,
  activeSigilSetAt: () => ({ names: [] })
};

const helpers = {
  conditionName: (name) => name,
  skillsByName: new Map(),
  skillsById: new Map(),
  weaponStrength: () => 1000
};

function field(fieldId, fieldType, at = 0, expiresAt = 5) {
  return {
    type: 'combo_field',
    at,
    source: `${fieldType} Field`,
    sourceId: `${fieldType.toLowerCase()}.field`,
    actorType: 'effect',
    fieldId,
    fieldType,
    expiresAt,
    ownerId: 'fixture',
    ownerActorType: 'player'
  };
}

function finisher(attemptId, fieldBinding, overrides = {}) {
  return {
    type: 'combo_finisher',
    at: 1,
    effectAt: 1,
    source: 'Fixture Finisher',
    sourceId: 'fixture.finisher',
    actorType: 'player',
    skillName: 'Fixture Finisher',
    attemptId,
    finisherType: 'Projectile',
    fieldBinding,
    chance: 1,
    applications: 1,
    successfulCombos: 1,
    ...overrides
  };
}

function resolve(events, config = {}) {
  return resolveTestGw2Events({
    ...{ events, endTime: 10 },
    config: { target: {}, sigilSets: [{ names: [] }], ...config },
    traits: new Set(),
    query,
    helpers
  });
}

test('combo boon resolution samples changing live concentration instead of configured stats', () => {
  const events = [
    field('fire:duration', 'Fire'),
    {
      type: 'buff',
      at: 0.5,
      source: 'Concentration Fixture',
      sourceId: 'fixture.concentration',
      actorType: 'player',
      kind: 'concentration-fixture',
      duration: 2,
      stacks: 1
    },
    ...[0.25, 1, 3].map((at) =>
      finisher(
        `duration:${at}`,
        { kind: 'field-id', fieldId: 'fire:duration' },
        {
          at,
          effectAt: at,
          finisherType: 'Blast'
        }
      )
    )
  ];
  const result = resolveTestGw2Events({
    ...{ events, endTime: 4 },
    config: { target: {}, stats: { concentration: 0 } },
    traits: new Set(),
    helpers,
    query: {
      ...query,
      // A runtime-only buff changes the sampled stat until expiry; configured concentration stays zero.
      statsAt(at, _event, runtime) {
        const boosted = (runtime.boons.get('concentration-fixture') || []).some(
          (application) => application.at <= at && application.expiresAt > at
        );
        return { ...query.statsAt(), concentration: boosted ? 750 : 0 };
      }
    }
  });
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.type === 'buff' && event.kind === 'might')
      .map((event) => event.duration),
    [20, 30, 20]
  );
});

test('Dark projectile and whirl siphons own their hits without inflating the finisher', () => {
  for (const [finisherType, flatStrikeBase, siphonName] of [
    ['Projectile', 202, 'Life Siphon Damage'],
    ['Whirl', 170, 'Leeching Bolts']
  ]) {
    // One weapon hit plus one combo proc must remain two distinct damage identities.
    const result = resolve([
      field('dark:1', 'Dark'),
      {
        type: 'damage',
        at: 1,
        source: 'Fixture Finisher',
        sourceId: 'fixture.finisher',
        skillName: 'Fixture Finisher',
        name: 'Fixture Finisher',
        actorType: 'player',
        coefficient: 1,
        weaponStrength: 1000
      },
      finisher('dark-finisher', { kind: 'field-id', fieldId: 'dark:1' }, { finisherType })
    ]);
    const siphon = result.resolvedEvents.find((event) => event.type === 'damage' && event.lifeSiphon);
    assert.equal(siphon.name, siphonName);
    assert.equal(siphon.skillName, siphonName);
    assert.equal(siphon.parentSkillName, 'Fixture Finisher');
    assert.equal(siphon.flatStrikeBase, flatStrikeBase);
    assert.equal(siphon.noCrit, true);
    const rows = skillBreakdownRows(result);
    assert.equal(rows.find((row) => row.name === 'Fixture Finisher').hits, 1);
    assert.equal(rows.find((row) => row.name === siphonName).hits, 1);
    assert.equal(rows.find((row) => row.name === siphonName).casts, 0);
  }
});

// Combo artwork must survive resolution and win over the finisher's inherited skill identity.
test('Leeching Bolts carries its own icon into the damage breakdown', () => {
  const result = resolve([
    field('dark:icon', 'Dark'),
    finisher('whirl:icon', { kind: 'field-id', fieldId: 'dark:icon' }, { finisherType: 'Whirl' })
  ]);
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Leeching Bolts');
  const icon = 'https://render.guildwars2.com/file/D4347C52157B040943051D7E09DEAD7AF63D4378/156662.png';
  assert.equal(row.icon, icon);
  assert.equal(
    resultSkillIcon({ results: result, skillById: new Map([['fixture.finisher', { icon: 'finisher.png' }]]) }, row),
    icon
  );
});

test('explicit bindings resolve one authoritative combo at effectAt', () => {
  const result = resolve([
    field('fire:1', 'Fire'),
    finisher(
      'projectile:1',
      { kind: 'field-id', fieldId: 'fire:1' },
      {
        effectAt: 3
      }
    )
  ]);
  const combo = result.resolvedEvents.find((event) => event.type === 'combo');
  const burning = result.resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Burning');

  assert.equal(combo.at, 3);
  assert.equal(combo.fieldId, 'fire:1');
  assert.equal(combo.fieldSourceId, 'fire.field');
  assert.equal(burning.at, 3);
  assert.ok(burning.damage > 0);
});

test('field interaction is inclusive and remains valid after later expiry', () => {
  const result = resolve([
    field('fire:delayed', 'Fire', 1, 2),
    finisher('delayed-outcome', { kind: 'field-id', fieldId: 'fire:delayed' }, { at: 1, effectAt: 3 })
  ]);
  const combo = result.resolvedEvents.find((event) => event.type === 'combo');

  assert.equal(combo.at, 3);
  assert.equal(combo.fieldId, 'fire:delayed');
});

test('expiry is exclusive and an unbound ambiguous finisher does nothing', () => {
  const expired = resolve([
    field('fire:expired', 'Fire', 0, 1),
    finisher('expired', { kind: 'field-id', fieldId: 'fire:expired' })
  ]);

  assert.equal(
    expired.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );

  const ambiguous = resolve([
    field('dark:1', 'Dark'),
    field('ice:1', 'Ice'),
    finisher('ambiguous', { kind: 'none' }),
    finisher('ambiguous:duplicate-warning', { kind: 'none' })
  ]);

  assert.equal(
    ambiguous.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
  assert.equal(ambiguous.warnings.length, 1);
});

test('type bindings ignore other fields and use one oldest same-type field', () => {
  const result = resolve([
    field('dark:1', 'Dark', 0, 5),
    field('ice:oldest', 'Ice', 0.25, 5),
    field('ice:newer', 'Ice', 0.5, 5),
    finisher('ice-projectile', { kind: 'field-type', fieldType: 'Ice' })
  ]);
  const combos = result.resolvedEvents.filter((event) => event.type === 'combo');

  assert.equal(combos.length, 1);
  assert.equal(combos[0].fieldId, 'ice:oldest');
  assert.equal(combos[0].fieldType, 'Ice');
});

test('attempt IDs deduplicate successful and failed rolls', () => {
  // A repeated packet must neither reroll a failure nor materialize a second success.
  const state = createGw2ComboRuntimeState();
  registerComboField(state, field('fire:1', 'Fire'));
  const rolls = [];
  const options = {
    roll(chance, stream) {
      rolls.push([chance, stream]);
      return rolls.length === 2;
    },
    warn() {}
  };
  for (const [attemptId, count] of [
    ['failed', 0],
    ['succeeded', 1]
  ]) {
    const attempt = finisher(attemptId, { kind: 'field-id', fieldId: 'fire:1' }, { chance: 0.2 });
    assert.equal(resolveComboAttempt(state, attempt, options).length, count);
    assert.equal(resolveComboAttempt(state, attempt, options).length, 0);
  }

  assert.deepEqual(rolls, [
    [0.2, 'gw2.combo:failed'],
    [0.2, 'gw2.combo:succeeded']
  ]);
});

test('Whirl applications do not multiply combos and authored double Blasts do', () => {
  const result = resolve([
    field('fire:packets', 'Fire'),
    finisher(
      'whirl:packets',
      { kind: 'field-id', fieldId: 'fire:packets' },
      { finisherType: 'Whirl', applications: 4 }
    ),
    finisher(
      'blast:double',
      { kind: 'field-id', fieldId: 'fire:packets' },
      { at: 2, effectAt: 2, finisherType: 'Blast', successfulCombos: 2 }
    )
  ]);
  const combos = result.resolvedEvents.filter((event) => event.type === 'combo');
  const burning = result.resolvedEvents.filter((event) => event.type === 'condition' && event.condition === 'Burning');

  assert.equal(combos.filter((event) => event.finisherType === 'Whirl').length, 1);
  assert.equal(combos.filter((event) => event.finisherType === 'Blast').length, 2);
  assert.equal(burning.length, 4);
});

test('Steamshrieker burns from water blasts and leaps without broadening Bloodstone triggers', () => {
  const comboEvents = [
    field('water:relic', 'Water'),
    finisher('water:blast', { kind: 'field-id', fieldId: 'water:relic' }, { finisherType: 'Blast' }),
    finisher('water:leap', { kind: 'field-id', fieldId: 'water:relic' }, { at: 2, effectAt: 2, finisherType: 'Leap' })
  ];
  const steamshrieker = resolve(comboEvents, { relic: 'Steamshrieker' });

  // The relic is equipment-owned, so both supported finisher types work for every profession through the shared resolver.
  assert.equal(
    steamshrieker.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.sourceId === 'relic.steamshrieker'
    ).length,
    2
  );
  assert.equal(steamshrieker.procSteps.filter((step) => step.skill === 'Relic of Steamshrieker').length, 2);

  const bloodstone = resolve(comboEvents.slice(0, 1).concat(comboEvents[2]), { relic: 'Bloodstone' });
  assert.equal(
    bloodstone.procSteps.some((step) => step.skill === 'Bloodstone Volatility' || step.skill === 'Relic of Bloodstone'),
    false
  );
});

test('target death prevents later authoritative combo outcomes', () => {
  const result = resolve(
    [
      field('fire:death', 'Fire'),
      {
        type: 'damage',
        at: 0.5,
        source: 'Lethal Strike',
        sourceId: 'lethal.strike',
        actorType: 'player',
        skillName: 'Lethal Strike',
        coefficient: 100,
        skillWeapon: 'Unequipped'
      },
      finisher('after-death', {
        kind: 'field-id',
        fieldId: 'fire:death'
      })
    ],
    { target: { armor: 2597, health: 1 } }
  );

  assert.equal(result.deathTime, 0.5);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
});

test('target death rejects distinct same-time combo finishers and reactions', () => {
  const result = resolve(
    [
      field('fire:same-time-death', 'Fire'),
      {
        type: 'damage',
        at: 0.5,
        source: 'Lethal Strike',
        sourceId: 'lethal.strike',
        actorType: 'player',
        activationId: 'lethal:1',
        skillName: 'Lethal Strike',
        coefficient: 100,
        skillWeapon: 'Unequipped'
      },
      ...Array.from({ length: 3 }, (_, index) =>
        finisher(
          `post-death-blast:${index + 1}`,
          { kind: 'field-id', fieldId: 'fire:same-time-death' },
          {
            at: 0.5,
            effectAt: 0.5,
            activationId: `post-death:${index + 1}`,
            priority: 1,
            finisherType: 'Blast'
          }
        )
      )
    ],
    {
      relic: 'Bloodstone',
      target: { armor: 2597, health: 1 }
    }
  );

  assert.equal(result.deathTime, 0.5);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Bloodstone Volatility' || step.skill === 'Relic of Bloodstone'),
    false
  );
});

function seededSignature(mode, seed, consumeUnrelated = false) {
  const state = createGw2ComboRuntimeState();

  registerComboField(state, field('fire:stochastic', 'Fire', 0, 10));
  const random = createSimulationRandom({ mode, seed });

  if (consumeUnrelated) random.roll(0.5, 'unrelated-mechanic');

  return Array.from(
    { length: 12 },
    (_, index) =>
      resolveComboAttempt(
        state,
        finisher(
          `stochastic:${index}`,
          { kind: 'field-id', fieldId: 'fire:stochastic' },
          { at: 1 + index * 0.1, effectAt: 1 + index * 0.1, chance: 0.5 }
        ),
        {
          roll: random.roll,
          warn() {}
        }
      ).length
  ).join('');
}

test('combo streams are seeded and isolated from unrelated rolls in both modes', () => {
  const first = seededSignature('deterministic', 7);
  for (const mode of ['deterministic', 'stochastic']) {
    assert.equal(seededSignature(mode, 7), first);
    assert.equal(seededSignature(mode, 7, true), first);
    assert.notEqual(seededSignature(mode, 8), first);
    // Exercise resolver wiring as well as the shared attempt contract, including guaranteed outcomes.
    const events = [
      field('fire:seeded', 'Fire'),
      ...[0, 0.5, 0.5, 0.5, 1].map((chance, index) =>
        finisher(`seeded:${index}`, { kind: 'field-id', fieldId: 'fire:seeded' }, { chance })
      )
    ];
    const random = createSimulationRandom({ mode, seed: 7 });
    const expected = events.slice(1).filter((event) => random.roll(event.chance, `gw2.combo:${event.attemptId}`));
    const result = resolve(events, { randomness: { mode, seed: 7 } });
    assert.deepEqual(
      result.resolvedEvents.filter((event) => event.type === 'combo').map((event) => event.attemptId),
      expected.map((event) => event.attemptId)
    );
  }
});
