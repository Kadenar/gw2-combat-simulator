import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import {
  createGw2ComboRuntimeState,
  registerComboField,
  resolveComboAttempt
} from '#gw2/platform/combos/resolution.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';

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
  activeWeaponSetAt: () => 1
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

function finisher(attemptId, fieldId, overrides = {}) {
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
    fieldId,
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

// Shared finishers must retain their named owners through combo materialization and damage aggregation.
test('combo conditions keep same-named attacks separated by entity', () => {
  const pets = ['Carrion Devourer', 'Whiptail Devourer'];
  const result = resolve([
    field('fire:pets', 'Fire'),
    ...pets.map((entityName, index) =>
      finisher(`pet:${index}`, 'fire:pets', {
        actorType: 'summon',
        entityName,
        summonOwner: `pet:${index}`,
        skillName: 'Twin Darts'
      })
    )
  ]);
  const conditions = result.resolvedEvents.filter((event) => event.type === 'condition');
  assert.deepEqual(new Set(conditions.map((event) => event.entityName)), new Set(pets));
  const rows = skillBreakdownRows(result);
  assert.deepEqual(new Set(rows.map((row) => row.entityName)), new Set(pets));
  assert.ok(rows.every((row) => row.name === 'Twin Darts' && row.group === 'Entities'));
  assert.equal(new Set(rows.map((row) => row.key)).size, pets.length);
});

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
      finisher(`duration:${at}`, 'fire:duration', {
        at,
        effectAt: at,
        finisherType: 'Blast'
      })
    )
  ];
  const result = resolveTestGw2Events({
    ...{ events, endTime: 4 },
    buffPolicies: [{ kind: 'concentration-fixture', maximumStacks: 1 }],
    config: { target: {}, attributeInputs: baseAttributeInputs({ concentration: 0 }) },
    traits: new Set(),
    helpers,
    query: {
      ...query,
      // A runtime-only buff changes the sampled stat until expiry; configured concentration stays zero.
      statsAt(at, _event, runtime) {
        const boosted = (runtime.buffs.get('concentration-fixture') || []).some(
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
      finisher('dark-finisher', 'dark:1', { finisherType })
    ]);
    const siphon = result.resolvedEvents.find((event) => event.type === 'damage' && event.damageKind === 'life-steal');
    assert.equal(siphon.name, siphonName);
    assert.equal(siphon.skillName, siphonName);
    assert.equal(siphon.parentSkillName, 'Fixture Finisher');
    assert.equal(siphon.flatStrikeBase, flatStrikeBase);
    assert.equal(siphon.canCrit, false);
    const rows = skillBreakdownRows(result);
    assert.equal(rows.find((row) => row.name === 'Fixture Finisher').hits, 1);
    assert.equal(rows.find((row) => row.name === siphonName).hits, 1);
    assert.equal(rows.find((row) => row.name === siphonName).casts, 0);
  }
});

test('explicit bindings resolve one authoritative combo at effectAt', () => {
  const result = resolve([
    field('fire:1', 'Fire'),
    finisher('projectile:1', 'fire:1', {
      effectAt: 3
    })
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
    finisher('delayed-outcome', 'fire:delayed', { at: 1, effectAt: 3 })
  ]);
  const combo = result.resolvedEvents.find((event) => event.type === 'combo');

  assert.equal(combo.at, 3);
  assert.equal(combo.fieldId, 'fire:delayed');
});

test('expired explicit bindings warn while unbound finishers quietly skip combos', () => {
  const expired = resolve([
    field('fire:expired', 'Fire', 0, 1),
    finisher('expired', 'fire:expired', { activationId: 'expired-cast' })
  ]);

  assert.equal(
    expired.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
  // The failed binding names its finisher activation and selection time instead of embedding them in the wording.
  assert.deepEqual(expired.warnings, [
    {
      message: 'Combo field fire:expired is not active for Fixture Finisher; no combo resolved.',
      at: 1,
      activationId: 'expired-cast'
    }
  ]);

  // An explicit absence of binding stays silent even when fields are available.
  const unbound = resolve([
    field('dark:1', 'Dark'),
    field('ice:1', 'Ice'),
    finisher('unbound', null),
    finisher('unbound:second', null)
  ]);

  assert.equal(
    unbound.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
  assert.deepEqual(unbound.warnings, []);
});

test('explicit field IDs preserve the selected field even when older fields exist', () => {
  const result = resolve([
    field('dark:1', 'Dark', 0, 5),
    field('ice:oldest', 'Ice', 0.25, 5),
    field('ice:newer', 'Ice', 0.5, 5),
    finisher('ice-projectile', 'ice:newer')
  ]);
  const combos = result.resolvedEvents.filter((event) => event.type === 'combo');

  assert.equal(combos.length, 1);
  assert.equal(combos[0].fieldId, 'ice:newer');
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
    const attempt = finisher(attemptId, 'fire:1', { chance: 0.2 });
    assert.equal(resolveComboAttempt(state, attempt, options).length, count);
    assert.equal(resolveComboAttempt(state, attempt, options).length, 0);
  }

  assert.deepEqual(
    rolls.map(([chance]) => chance),
    [0.2, 0.2]
  );
  assert.equal(rolls[0][1], rolls[1][1], 'Attempt IDs must not select the RNG stream.');
});

test('Whirl applications do not multiply combos and authored double Blasts do', () => {
  const result = resolve([
    field('fire:packets', 'Fire'),
    finisher('whirl:packets', 'fire:packets', { finisherType: 'Whirl', applications: 4 }),
    finisher('blast:double', 'fire:packets', { at: 2, effectAt: 2, finisherType: 'Blast', successfulCombos: 2 })
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
    finisher('water:blast', 'water:relic', { finisherType: 'Blast' }),
    finisher('water:leap', 'water:relic', { at: 2, effectAt: 2, finisherType: 'Leap' })
  ];
  const steamshrieker = resolve(comboEvents, { relic: 'Steamshrieker' });

  // The relic is equipment-owned, so both supported finisher types work for every profession through the shared resolver.
  assert.equal(
    steamshrieker.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.sourceId === `relic.${RELIC_IDS.STEAMSHRIEKER}`
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
      finisher('after-death', 'fire:death')
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
        finisher(`post-death-blast:${index + 1}`, 'fire:same-time-death', {
          at: 0.5,
          effectAt: 0.5,
          activationId: `post-death:${index + 1}`,
          priority: 1,
          finisherType: 'Blast'
        })
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
        finisher(`stochastic:${index}`, 'fire:stochastic', {
          at: 1 + index * 0.1,
          effectAt: 1 + index * 0.1,
          chance: 0.5
        }),
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
      ...[0, 0.5, 0.5, 0.5, 1].map((chance, index) => finisher(`seeded:${index}`, 'fire:seeded', { chance }))
    ];
    const result = resolve(events, { randomness: { mode, seed: 7 } });
    const combos = result.resolvedEvents.filter((event) => event.type === 'combo');
    assert.equal(
      combos.some((event) => event.attemptId === 'seeded:0'),
      false
    );
    assert.equal(
      combos.some((event) => event.attemptId === 'seeded:4'),
      true
    );
  }
});
