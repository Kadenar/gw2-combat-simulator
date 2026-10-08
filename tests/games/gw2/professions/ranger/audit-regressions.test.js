import { remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import {
  rangerPetCombatMetadata,
  rangerPetCompanionId
} from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

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

// The repeat halves the coefficient while retaining spirit Power and the Ranger's live critical stats and modifiers.
test('Storm Spirit uses spirit power and weapon strength with Ranger critical stats and modifiers', () => {
  for (const [power, precision, ferocity, might, vow] of [
    [1000, 1000, 0, 0, false],
    [4000, 1000, 0, 25, false],
    [1000, 2050, 0, 0, false],
    [1000, 2050, 750, 0, false],
    [1000, 2050, 750, 0, true]
  ]) {
    const result = simulate('Untamed', [ID.STORM_SPIRIT, wait(6500)], {
      initialUntamedState: 'Ranger',
      selectedTraitIds: [TRAIT.NATURES_VENGEANCE, ...(vow ? [TRAIT.VOW_OF_THE_UNTAMED] : [])],
      stats: { power, precision, ferocity },
      boons: { might, fury: true },
      target: { conditions: { Vulnerability: 25 } }
    });
    assert.deepEqual(result.warnings, []);
    const strikes = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.CALL_LIGHTNING
    );
    const chance = 0.3 + (precision - 1000) / 2100;
    const criticalMultiplier = 1 + chance * (0.5 + ferocity / 1500);
    const expected = [2, 1].map((coefficient) =>
      Math.floor(((coefficient * 1580 * 2553.5) / 2597) * criticalMultiplier * 1.25 * (vow ? 1.25 : 1))
    );
    assert.deepEqual(
      strikes.map((event) => event.damage),
      expected
    );
  }

  // Spirit Power must also replace merged Soulbeast bonuses without changing the player's attribute preview.
  for (const specialization of ['Core', 'Soulbeast']) {
    const result = simulate(specialization, [ID.STORM_SPIRIT, wait(1500)], {
      selectedTraitIds: [TRAIT.PACK_ALPHA, TRAIT.PETS_PROWESS],
      stats: { power: 3000, precision: 2050, ferocity: 750 },
      boons: { might: 25, fury: true }
    });
    assert.deepEqual(result.warnings, []);
    const strike = result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillId === ID.CALL_LIGHTNING
    );
    const runtime = observedRuntime(result);
    const spirit = runtime.query.statsAt(runtime.time, strike, runtime);
    const player = runtime.query.statsAt(runtime.time, null, runtime);
    assert.equal(spirit.power, 1580);
    assert.ok(player.power >= 3750);
    assert.equal(spirit.precision, player.precision);
    assert.equal(spirit.ferocity, player.ferocity);
  }
});

// Commands copy the executed self pool, including duration stacking and permanent assumptions, to the active pet.
test('Resounding Timbre copies live boon pools and rejects other recipients and expired grants', () => {
  let petId;
  const result = runRanger(
    [wait(3000), ID.SIC_EM],
    {
      ...config,
      selectedTraitIds: [TRAIT.RESOUNDING_TIMBRE],
      stats: { ...config.stats, concentration: 1500 },
      boons: { protection: true }
    },
    {
      extend: (native) => ({
        catalog: withSkill(native.catalog, ID.SIC_EM, { description: 'Renamed command description.' })
      }),
      initialize(runtime) {
        petId = rangerPetCompanionId(runtime);
        for (const [kind, duration, stacks, audience] of [
          ['fury', 2, 1],
          ['fury', 2, 1],
          ['might', 6, 2],
          ['might', 8, 3],
          ['vigor', 1, 1],
          ['regeneration', 10, 1, { recipients: 'party', affectsSelf: false }]
        ])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              at: 0,
              source: 'test',
              sourceId: 'test-boon',
              actorType: 'effect',
              fixedDuration: true,
              kind,
              duration,
              stacks,
              audience
            }
          });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const boons = result.events.filter((event) => event.sourceId === TRAIT.RESOUNDING_TIMBRE);
  assert.deepEqual(
    boons.map((event) => [event.kind, event.stacks]),
    [
      ['fury', 1],
      ['might', 5],
      ['protection', 1]
    ]
  );
  assert.equal(boons[0].duration, 1);
  assert.equal(boons[1].duration, 5);
  assert.equal(boons[2].duration, 27);
  for (const event of boons) {
    assert.equal(event.resolvedAudience.includesSelf, false);
    assert.deepEqual(event.resolvedAudience.companionIds, [petId]);
  }
});

test('Resounding Timbre combines configured and generated duration boons without copying other recipients', () => {
  // A configured source must not replace the live self pool, and the combined copy still obeys the duration cap.
  for (const [grants, expected] of [
    [[0.4, 0.4], 27.8],
    [[40], 29.4]
  ]) {
    const result = runRanger(
      [wait(3000), ID.SIC_EM],
      {
        ...config,
        selectedTraitIds: [TRAIT.RESOUNDING_TIMBRE],
        boons: { quickness: true }
      },
      {
        initialize(runtime) {
          for (const [duration, audience] of [
            ...grants.map((duration) => [duration, { recipients: 'self' }]),
            [20, { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: [rangerPetCompanionId(runtime)] }]
          ])
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'buff',
                at: 2.4,
                source: 'test',
                sourceId: 'test-boon',
                actorType: 'effect',
                kind: 'quickness',
                duration,
                stacks: 1,
                audience
              }
            });
        }
      }
    );
    const quickness = result.events.find(
      (event) => event.sourceId === TRAIT.RESOUNDING_TIMBRE && event.kind === 'quickness'
    );

    assert.deepEqual(result.warnings, []);
    assert.equal(quickness.duration, expected);
  }
});

// A copied grant expires independently of the next external refresh; the source's uptime stays configured.
test('configured golem boons copy finite duration across refresh boundaries for every pet', () => {
  for (const selectedPet of ['Tiger', 'Lynx', 'Jacaranda']) {
    for (const [atMs, remaining] of [
      [9960, 0.04],
      [10000, 10],
      [10040, 9.96],
      [20000, 10]
    ]) {
      const result = runRanger([wait(atMs), ID.SIC_EM, wait(65000)], {
        ...config,
        selectedPet,
        selectedTraitIds: [TRAIT.RESOUNDING_TIMBRE],
        boons: { might: 25, quickness: true, alacrity: true, swiftness: true }
      });
      assert.deepEqual(result.warnings, []);
      const copied = result.events.filter((event) => event.sourceId === TRAIT.RESOUNDING_TIMBRE);
      assert.equal(copied.find((event) => event.kind === 'might').duration, remaining);
      assert.equal(copied.find((event) => event.kind === 'quickness').duration, 20 + remaining);
      assert.equal(copied.find((event) => event.kind === 'alacrity').duration, 20 + remaining);
      assert.equal(copied.find((event) => event.kind === 'swiftness').duration, 50 + remaining);
      const runtime = observedRuntime(result);
      assert.equal(
        remainingDurationStackSeconds(runtime.boons.get('quickness'), runtime.time, {
          includes: (application) => application.resolvedAudience.companionIds.includes(rangerPetCompanionId(runtime))
        }),
        0
      );
      assert.equal(runtime.config.boons.quickness, true);
    }
  }
});

// Trait-triggered commands must share command traits across species without proccing once per strike.
test('Lesser Sic Em copies player boons once after the qualifying beast hit', () => {
  for (const [selectedPet, skillId] of [
    ['Tiger', ID.FURIOUS_POUNCE],
    ['Lynx', ID.RENDING_POUNCE]
  ]) {
    for (const selectedTraitIds of [
      [TRAIT.GO_FOR_THE_THROAT, TRAIT.RESOUNDING_TIMBRE],
      [TRAIT.GO_FOR_THE_THROAT],
      [TRAIT.RESOUNDING_TIMBRE]
    ]) {
      const result = runRanger([skillId, wait(4000)], {
        ...config,
        selectedPet,
        selectedTraitIds,
        boons: { might: 25 }
      });
      assert.deepEqual(result.warnings, []);
      const copies = result.events.filter((event) => event.sourceId === TRAIT.RESOUNDING_TIMBRE);
      if (selectedTraitIds.length === 1) {
        assert.equal(copies.length, 0);
        continue;
      }

      const might = copies.filter((event) => event.kind === 'might');
      const hit = result.events.find((event) => event.type === 'damage' && event.skillId === skillId);
      assert.equal(might.length, 1);
      assert.equal(might[0].at, hit.at);
      assert.ok(result.events.indexOf(might[0]) > result.events.indexOf(hit));
      assert.equal(might[0].stacks, 25);
      assert.equal(might[0].triggeredBy, 'Lesser "Sic \'Em!"');
      assert.equal(might[0].resolvedAudience.includesSelf, false);
      assert.deepEqual(might[0].resolvedAudience.companionIds, [hit.summonOwner]);
    }
  }
});

// The same proc extends existing player boons while merged instead of copying to an inactive pet.
test('merged Lesser Sic Em extends player boons through Resounding Timbre', () => {
  const result = runRanger(
    ['Worldly Impact', wait(2000)],
    {
      ...config,
      specialization: 'Soulbeast',
      selectedPet: 'Pig',
      selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT, TRAIT.RESOUNDING_TIMBRE]
    },
    {
      initialize(runtime) {
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'buff',
            at: 0,
            source: 'test',
            sourceId: 'test-boon',
            actorType: 'effect',
            kind: 'vigor',
            duration: 10,
            stacks: 1,
            audience: { recipients: 'self' }
          }
        });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const effects = result.events.filter((event) => event.sourceId === TRAIT.RESOUNDING_TIMBRE);
  assert.equal(effects.length, 1);
  assert.equal(effects[0].type, 'boon_extension');
  assert.equal(effects[0].duration, 2);
  assert.equal(remainingDurationStackSeconds(observedRuntime(result).boons.get('vigor'), 3), 9);
});

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
        event.source === 'ranger-pet'
    )
  );
  assert.equal(packets[1].condition, 'Vulnerability');
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

// Completion declarations queue their rewards; the heal copies only boons already delivered before completion.
test('Wellspring does not enter the same healing cast boon-copy snapshot', () => {
  const result = simulate('Core', [ID.WE_HEAL_AS_ONE], { selectedTraitIds: [TRAIT.WELLSPRING] });
  assert.deepEqual(copied(result), []);
  const reward = result.events.find((event) => event.sourceId === TRAIT.WELLSPRING);
  assert.equal(reward.kind, 'regeneration');
  assert.equal(reward.triggeredBy, '"We Heal As One!"');
  assert.equal(reward.resolvedAudience.includesSelf, true);
  assert.deepEqual(result.warnings, []);
});

// Dynamic recipient attribution must keep a shared control reward on its originating ally.
test('Soulbeast control declarations preserve ally recipients across both boons and their shared cooldown', () => {
  const result = runRanger(
    [wait(1500)],
    {
      ...config,
      specialization: 'Soulbeast',
      allies: { count: 1 },
      selectedTraitIds: [TRAIT.BESTIAL_RAGE]
    },
    {
      initialize(runtime) {
        for (const at of [1, 1.25, 1.251])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'control',
              at,
              source: 'fixture',
              sourceId: 'control',
              actorType: 'effect',
              skillName: 'Ally Control',
              controlKind: 'daze',
              duration: 1,
              metadata: { triggeredByAlly: 1 }
            }
          });
      }
    }
  );
  const rewards = result.events.filter((event) => event.sourceId === TRAIT.BESTIAL_RAGE);
  assert.deepEqual(
    rewards.map((event) => [event.at, event.kind]),
    [
      [1, 'might'],
      [1, 'fury'],
      [1.251, 'might'],
      [1.251, 'fury']
    ]
  );
  for (const event of rewards) {
    assert.equal(event.resolvedAudience.includesSelf, false);
    assert.equal(event.audience.alliedPlayerIndex, 1);
    assert.equal(event.triggeredBy, 'Ally Control');
  }

  assert.deepEqual(result.warnings, []);
});

test('We Heal As One snapshots distinct audiences, intensity stacks, and boon lifetime at completion', () => {
  const boonConfig = { ...config, specialization: 'Core', boons: { might: 7 } };
  let petId;
  const result = runRanger([ID.WE_HEAL_AS_ONE], boonConfig, {
    initialize(runtime) {
      petId = rangerPetCompanionId(runtime);
      const seed = (kind, duration, stacks, companionId = petId, at = 0) =>
        runtime.effects.emit({
          kind: 'packet',
          event: {
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
          }
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
    return observedRuntime(result).cooldownController.rechargeFor(ID.RAPID_FIRE).work;
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
  assert.ok(hits.every((event) => event.coefficient === 0.3 && event.at >= field.at && event.at < field.expiresAt));
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
