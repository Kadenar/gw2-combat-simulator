import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { rangerPetCombatMetadata, rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const config = {
  primaryWeapon: 'Greatsword',
  selectedPet: 'Tiger',
  selectedTraitIds: [],
  boons: {},
  initialAstralForce: 100,
  stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000, expertise: 0, concentration: 0 },
  target: { armor: 2597, defiant: true, conditions: {} }
};
const simulate = createObservedProfessionSimulator(rangerProfession, config);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const copied = (result) =>
  result.events.filter((event) => event.type === 'buff' && event.skillId === ID.WE_HEAL_AS_ONE);

test('Splitblade shares an impact without merging hit or condition application indices', () => {
  // Five simultaneous projectiles retain separate hit identities before the single Bleeding application.
  const result = simulate('Core', [ID.SPLITBLADE], { primaryWeapon: 'Axe' });
  assert.deepEqual(result.warnings, []);
  const packets = result.events.filter(
    (event) => event.skillId === ID.SPLITBLADE && ['damage', 'condition'].includes(event.type)
  );
  assert.deepEqual(
    packets.map(({ type, hitIndex, totalHits, applicationIndex, totalApplications }) => [
      type,
      hitIndex ?? applicationIndex,
      totalHits ?? totalApplications
    ]),
    [
      ['damage', 1, 5],
      ['damage', 2, 5],
      ['damage', 3, 5],
      ['damage', 4, 5],
      ['damage', 5, 5],
      ['condition', 1, 1]
    ]
  );
  assert.ok(packets.every((event) => event.at === packets[0].at));
  assert.equal(packets.at(-1).condition, 'Bleeding');
  assert.equal(packets.at(-1).stacks, 5);
});

test('Whirling Defense pairs Vulnerability and whirl attempts with surviving channel ticks', () => {
  // Full and interrupted channels keep one application/finisher per landed tick, never a final stack dump.
  for (const interruptAfterMs of [undefined, 900]) {
    const result = simulate(
      'Core',
      [ID.FROST_TRAP, { type: 'cast', skillId: ID.WHIRLING_DEFENSE, interruptAfterMs }, wait(6000)],
      { primaryWeapon: 'Axe', secondaryWeapon: 'Axe' }
    );
    assert.deepEqual(result.warnings, []);
    const packets = result.events.filter((event) => event.skillId === ID.WHIRLING_DEFENSE);
    const hits = packets.filter((event) => event.type === 'damage');
    const vulnerability = packets.filter((event) => event.type === 'condition' && event.condition === 'Vulnerability');
    const finishers = packets.filter((event) => event.type === 'combo_finisher' && event.finisherType === 'Whirl');
    assert.ok(hits.length > 0);
    assert.deepEqual(
      vulnerability.map((event) => event.at),
      hits.map((event) => event.at)
    );
    assert.deepEqual(
      finishers.map((event) => event.at),
      hits.map((event) => event.at)
    );
    assert.ok(vulnerability.every((event) => event.stacks === 1));
    assert.ok(finishers.some((event) => event.successfulCombos > 0));
    for (let index = 0; index < hits.length; index += 1) {
      assert.equal(vulnerability[index].applicationIndex, hits[index].hitIndex);
      assert.ok(hits[index].eventOrder < vulnerability[index].eventOrder);
    }

    if (interruptAfterMs != null) {
      const action = packets.find((event) => event.type === 'action');
      assert.ok(hits.every((event) => event.at <= action.endsAt));
      assert.ok(hits.length < hits[0].totalHits);
    }
  }
});

test('autonomous pet impacts retain summon attribution and strike-before-condition order', () => {
  // Tiger's opening Bite exercises the autonomous materializer independently of player cast scheduling.
  const result = simulate('Core', ['__combat_start', wait(1500)], { selectedPet: 'Tiger' });
  assert.deepEqual(result.warnings, []);
  const packets = result.events.filter(
    (event) => event.skillId === ID.FELINE_BITE && ['damage', 'condition'].includes(event.type)
  );
  assert.deepEqual(
    packets.map(({ type }) => type),
    ['damage', 'condition']
  );
  assert.ok(
    packets.every(
      (event) =>
        event.at === packets[0].at &&
        event.activationId === packets[0].activationId &&
        event.sourceId === ID.FELINE_BITE &&
        event.source === 'ranger-pet' &&
        event.actorType === 'summon' &&
        event.autonomousPetSkill
    )
  );
  assert.equal(packets[1].condition, 'Vulnerability');
});

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
  let petId;
  const result = runRanger([ID.WE_HEAL_AS_ONE], boonConfig, {
    initialize(runtime) {
      petId = rangerPetCompanionId(runtime);
      const seed = (kind, duration, stacks, companionId = petId, at = 0) =>
        runtime.emit({
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
    }
  });
  const applications = copied(result);
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

test('Lead the Wind reduces longbow recharge and grants Point-Blank Shot boons', () => {
  // Cover the trait's two supported contracts without modeling its piercing behavior.
  const baseline = simulate('Core', [ID.RAPID_FIRE], { primaryWeapon: 'Longbow' });
  const traited = simulate('Core', [ID.RAPID_FIRE, ID.POINT_BLANK_SHOT], {
    primaryWeapon: 'Longbow',
    selectedTraitIds: [TRAIT.LEAD_THE_WIND]
  });
  const recharge = (result) => {
    return observedRuntime(result).rechargeProgress.get(ID.RAPID_FIRE).work;
  };

  assert.ok(Math.abs(recharge(traited) - recharge(baseline) * 0.8) < 1e-9);
  assert.deepEqual(
    traited.events
      .filter((event) => event.type === 'buff' && event.sourceId === TRAIT.LEAD_THE_WIND)
      .map((event) => [event.kind, event.duration]),
    [
      ['swiftness', 10],
      ['quickness', 5]
    ]
  );
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
        observedRuntime(runRanger([], { ...config, specialization: 'Core', selectedPet, selectedTraitIds }))
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
