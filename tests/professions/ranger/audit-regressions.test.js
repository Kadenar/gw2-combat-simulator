import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { rangerPetCombatMetadata, rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const config = {
  primaryWeapon: 'Greatsword',
  selectedPet: 'Tiger',
  selectedTraitIds: [],
  boons: {},
  initialAstralForce: 100,
  stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000, expertise: 0, concentration: 0 },
  target: { armor: 2597, defiant: true, conditions: {} }
};
const simulate = createProfessionSimulator(rangerProfession, config);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const copied = (result) =>
  result.events.filter((event) => event.type === 'buff' && event.skillId === ID.WE_HEAL_AS_ONE);

test('Natural Convergence cancellation retains only landed trait pulses and their condition ticks', () => {
  // Probe both sides of a pulse and the exact boundary without making cast-speed assertions.
  for (const [interruptAfterMs, expected] of [
    [100, 0],
    [520, 1],
    [800, 1],
    [1300, 2]
  ]) {
    const result = simulate(
      'Druid',
      [ID.CELESTIAL_AVATAR, { type: 'cast', skillId: ID.NATURAL_CONVERGENCE, interruptAfterMs }, wait(7000)],
      { selectedTraitIds: [TRAIT.ECLIPSE, TRAIT.GRACE_OF_THE_LAND] }
    );
    assert.deepEqual(result.warnings, []);
    const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.NATURAL_CONVERGENCE);
    for (const [type, sourceId] of [
      ['condition', TRAIT.ECLIPSE],
      ['buff', TRAIT.GRACE_OF_THE_LAND]
    ]) {
      const pulses = result.events.filter((event) => event.type === type && event.sourceId === sourceId);
      assert.equal(pulses.length, expected);
      assert.ok(pulses.every((event) => event.at <= action.endsAt + 1e-9));
      if (type === 'condition') assert.ok(pulses.every((event) => event.stacks === 1));
    }

    assert.equal(
      result.resolvedEvents.some(
        (event) =>
          event.type === 'condition' &&
          event.sourceId === TRAIT.ECLIPSE &&
          event.damageTicks.some((tick) => tick.at > action.endsAt)
      ),
      expected > 0
    );
  }
});

test('We Heal As One does not invent boons or copy from interrupted casts', () => {
  for (const specialization of ['Core', 'Soulbeast']) {
    assert.deepEqual(copied(simulate(specialization, [ID.WE_HEAL_AS_ONE])), []);
    const cancelled = simulate(specialization, [{ type: 'cast', skillId: ID.WE_HEAL_AS_ONE, interruptAfterMs: 100 }], {
      boons: { might: 7, quickness: true }
    });
    assert.deepEqual(copied(cancelled), []);
  }
});

test('We Heal As One snapshots distinct audiences, intensity stacks, and boon lifetime at completion', () => {
  const boonConfig = { ...config, specialization: 'Core', boons: { might: 7 } };
  const scheduler = createScheduler({
    profession: rangerProfession,
    config: boonConfig,
    schedulerPolicy: createGw2SchedulerPolicy(boonConfig)
  });
  const petId = rangerPetCompanionId(scheduler.context);
  const seed = (kind, duration, stacks, companionId = petId, at = 0) =>
    scheduler.context.emit({
      type: 'buff',
      at,
      kind,
      duration,
      stacks,
      source: 'test',
      sourceId: 'test-boon',
      actorType: 'effect',
      audience: {
        recipients: 'summons',
        affectsSelf: false,
        maximumRecipients: 1,
        eligibleCompanionIds: [companionId]
      },
      companionCandidates: [companionId]
    });
  seed('stability', 10, 4);
  seed('protection', 0.1, 1);
  seed('fury', 10, 1, 'retired-pet');
  seed('vigor', 10, 1, petId, 10);
  // The pooled Alacrity remains active after either original packet's standalone expiry.
  seed('alacrity', 0.7, 1);
  seed('alacrity', 0.7, 1);
  scheduler.run([ID.WE_HEAL_AS_ONE]);
  const applications = copied(scheduler);
  const self = applications.filter((event) => event.resolvedAudience.includesSelf);
  const pet = applications.filter((event) => event.resolvedAudience.includesSummons);
  assert.deepEqual(self.map((event) => [event.kind, event.stacks]).sort(), [
    ['alacrity', 1],
    ['stability', 4]
  ]);
  assert.deepEqual(
    pet.map((event) => [event.kind, event.stacks]),
    [['might', 7]]
  );
  assert.equal(pet[0].duration, 10);
  assert.deepEqual(pet[0].resolvedAudience.companionIds, [petId]);
});

test('merged We Heal As One copies only the player boons and applies concentration once', () => {
  const result = simulate('Soulbeast', [ID.WE_HEAL_AS_ONE], {
    boons: { might: 7, alacrity: true },
    stats: { concentration: 750 }
  });
  const applications = copied(result);
  assert.deepEqual(
    applications.map((event) => [event.kind, event.stacks, event.duration]),
    [
      ['alacrity', 1, 4.5],
      ['might', 7, 15]
    ]
  );
  assert.ok(
    applications.every((event) => event.resolvedAudience.includesSelf && !event.resolvedAudience.includesSummons)
  );
});

test('Counterattack Kick lands once and its knockback triggers control traits', () => {
  const result = simulate('Untamed', [ID.COUNTERATTACK, ID.COUNTERATTACK_KICK, wait(1000)], {
    selectedTraitIds: [TRAIT.DEBILITATING_BLOWS]
  });
  assert.deepEqual(result.warnings, []);
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.COUNTERATTACK_KICK);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].coefficient, 2.5);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'control').map((event) => event.controlKind),
    ['Knockback']
  );
  assert.ok(result.resolvedEvents.some((event) => event.sourceId === TRAIT.DEBILITATING_BLOWS));
});

test('Flame Trap retains its double initial strike, later burning pulses, and a bounded Fire field', () => {
  const result = simulate('Core', [ID.FLAME_TRAP, wait(6000)]);
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.FLAME_TRAP);
  const burns = result.events.filter((event) => event.type === 'condition' && event.skillId === ID.FLAME_TRAP);
  const field = result.events.find((event) => event.type === 'combo_field');
  assert.equal(hits.length, 6);
  assert.equal(hits[0].at, hits[1].at);
  assert.equal(new Set(hits.map((event) => event.at)).size, 5);
  assert.ok(hits.every((event) => event.coefficient === 0.3 && event.at >= field.at && event.at < field.expiresAt));
  assert.deepEqual(
    burns.map((event) => event.at),
    hits.map((event) => event.at)
  );
  assert.ok(burns.every((event) => event.duration === 2.5));
  for (const [delay, expected] of [
    [600, true],
    [4000, false]
  ]) {
    const combo = simulate('Core', [ID.FLAME_TRAP, wait(delay), ID.SWOOP]);
    assert.deepEqual(combo.warnings, []);
    assert.equal(
      combo.events.some(
        (event) =>
          event.type === 'combo_finisher' && event.successfulCombos > 0 && event.fieldBinding.kind === 'field-id'
      ),
      expected
    );
  }

  const cancelled = simulate('Core', [{ type: 'cast', skillId: ID.FLAME_TRAP, interruptAfterMs: 100 }, wait(6000)]);
  assert.equal(
    cancelled.events.some(
      (event) => ['damage', 'condition', 'combo_field'].includes(event.type) && event.skillId === ID.FLAME_TRAP
    ),
    false
  );
});

test('Fang and Claw changes independent critical stats only for eligible pets', () => {
  for (const [selectedPet, eligible] of [
    ['Tiger', true],
    ['Eagle', true],
    ['River Drake', true],
    ['Pig', false]
  ]) {
    const metadata = (selectedTraitIds) =>
      rangerPetCombatMetadata(
        createScheduler({
          profession: rangerProfession,
          config: { ...config, specialization: 'Core', selectedPet, selectedTraitIds }
        }).context
      );
    const baseline = metadata([]),
      enhanced = metadata([TRAIT.FANG_AND_CLAW]);
    assert.equal(enhanced.summonBasePrecision - baseline.summonBasePrecision, eligible ? 420 : 0);
    assert.equal(enhanced.summonBaseFerocity - baseline.summonBaseFerocity, eligible ? 450 : 0);
    assert.ok(Math.abs(enhanced.summonCriticalChance - baseline.summonCriticalChance - (eligible ? 0.2 : 0)) < 1e-9);
    assert.ok(Math.abs(enhanced.summonCriticalDamage - baseline.summonCriticalDamage - (eligible ? 0.3 : 0)) < 1e-9);
  }

  const firstHit = (specialization, selectedTraitIds) =>
    simulate(specialization, [ID.SLASH_ID_12474, wait(2000)], { selectedTraitIds }).resolvedEvents.find(
      (event) =>
        event.type === 'damage' &&
        (specialization === 'Core' ? event.source === 'ranger-pet' : event.actorType === 'player')
    );
  assert.ok(firstHit('Core', [TRAIT.FANG_AND_CLAW]).damage > firstHit('Core', []).damage);
  assert.equal(firstHit('Soulbeast', [TRAIT.FANG_AND_CLAW]).damage, firstHit('Soulbeast', []).damage);
});
