import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import { assertRoundedDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import test from 'node:test';
import { rangerCatalog, rangerProfession } from '#gw2/professions/ranger/profession.js';
import { rangerAppAdapter } from '#gw2/professions/ranger/app/app-definition.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import {
  rangerAttackOfOpportunityModifier,
  reactToRangerGreatswordDamage
} from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const simulate = createProfessionSimulator(rangerProfession, {
  primaryWeapon: 'Greatsword',
  selectedPet: 'Tiger',
  selectedTraitIds: [],
  stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000, expertise: 0 },
  target: { armor: 2597, defiant: true, conditions: { Vulnerability: 25 } }
});
const wait = (durationMs) => ({ type: 'wait', durationMs });
const strike = (result, id) => result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === id);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('Maul palette selects the player variant only while Soulbeast is merged', () => {
  for (const [specialization, beastmodeActive, expectedId] of [
    ['Core', undefined, ID.MAUL_BASE],
    ['Soulbeast', undefined, ID.MAUL_SOULBEAST],
    ['Soulbeast', true, ID.MAUL_SOULBEAST],
    ['Soulbeast', false, ID.MAUL_BASE]
  ]) {
    for (const id of [ID.MAUL_SOULBEAST, ID.MAUL_BASE]) {
      assert.equal(
        rangerAppAdapter.isSkillAvailable(rangerCatalog.skillsById.get(id), {
          specialization,
          professionState: { beastmodeActive }
        }),
        id === expectedId
      );
    }
  }
});

test('Ranger greatsword authors one strike per attack and the supplied recharge and effects', () => {
  for (const [id, coefficient] of [
    [ID.SLASH_ID_12474, 0.88],
    [ID.SLICE, 1.1],
    [ID.ENDURING_SWING, 1.76],
    [ID.SWOOP, 2.4],
    [ID.HILT_BASH, 2.5],
    [ID.MAUL_SOULBEAST, 2.2],
    [ID.MAUL_BASE, 2.2]
  ]) {
    const strikes = rangerCatalog.skillsById.get(id).effects.filter((effect) => effect.type === 'strike');
    assert.deepEqual(
      strikes.map((effect) => effect.coefficient),
      [coefficient]
    );
  }

  for (const [id, cooldown] of [
    [ID.MAUL_SOULBEAST, 4],
    [ID.MAUL_BASE, 4],
    [ID.HILT_BASH, 20],
    [ID.SWOOP, 10]
  ]) {
    assert.equal(rangerCatalog.skillsById.get(id).cooldown, cooldown);
  }

  const maul = rangerCatalog.skillsById.get(ID.MAUL_SOULBEAST);
  const vulnerability = maul.effects.find((effect) => effect.type === 'condition');
  assert.equal(vulnerability.condition, 'Vulnerability');
  assert.equal(vulnerability.stacks, 5);
  assert.equal(vulnerability.duration, 8);
  assert.equal(rangerCatalog.skillsById.get(ID.SWOOP).effects[0].comboFinishers[0].finisherType, 'Leap');
});

test('Hilt Bash dazes normal targets, stuns defiant targets, and triggers player-owned Untamed poison', () => {
  for (const defiant of [false, true]) {
    const run = (poisonMaster) =>
      simulate('Untamed', [ID.HILT_BASH, wait(5000)], {
        selectedPet: 'Lynx',
        initialUntamedState: 'Ranger',
        selectedTraitIds: [TRAIT.DEBILITATING_BLOWS, ...(poisonMaster ? [TRAIT.POISON_MASTER] : [])],
        target: { defiant, conditions: {} }
      });
    const baseline = run(false);
    const enhanced = run(true);
    assert.equal(enhanced.events.find((event) => event.type === 'control').controlKind, defiant ? 'Stun' : 'Daze');
    const poison = (result) =>
      result.resolvedEvents.find((event) => event.type === 'condition' && event.sourceId === TRAIT.DEBILITATING_BLOWS);
    assert.equal(poison(enhanced).actorType, 'effect');
    assert.equal(poison(enhanced).ownerActorType, 'player');
    assertRoundedDamageMultiplier(
      poison(enhanced).damageTicks.find((tick) => tick.fraction === 1).damage,
      poison(baseline).damageTicks.find((tick) => tick.fraction === 1).damage,
      1.25
    );
  }
});

test('Hilt Bash refreshes either Maul ID only after completing its cast', () => {
  for (const maulId of [ID.MAUL_SOULBEAST, ID.MAUL_BASE]) {
    const normal = simulate('Core', [maulId, maulId]);
    assert.equal(normal.steps[1].start, Math.ceil((normal.steps[0].end + 4000) / 40) * 40);
    const refreshed = simulate('Core', [maulId, ID.HILT_BASH, maulId]);
    assert.equal(refreshed.steps[2].start, refreshed.steps[1].end);
    const interrupted = simulate('Core', [
      maulId,
      { type: 'cast', skillId: ID.HILT_BASH, interruptAfterMs: 50 },
      maulId
    ]);
    assert.equal(interrupted.steps[2].start, normal.steps[1].start);
    assert.equal(
      interrupted.events.some((event) => event.type === 'control'),
      false
    );
  }
});

test('Enduring Swing grants 15 capped endurance on completion and none when interrupted', () => {
  for (const interrupted of [false, true]) {
    const result = simulate('Core', [
      ID.DODGE,
      ID.SLASH_ID_12474,
      ID.SLICE,
      { type: 'cast', skillId: ID.ENDURING_SWING, ...(interrupted ? { interruptAfterMs: 50 } : {}) }
    ]);
    const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.ENDURING_SWING);
    close(result.planningState.profession.endurance, 50 + action.endsAt * 5 + (interrupted ? 0 : 15));
  }

  const capped = simulate('Core', [ID.SLASH_ID_12474, ID.SLICE, ID.ENDURING_SWING]);
  assert.equal(capped.planningState.profession.endurance, 100);
});

test('Maul grants the active pet 50% on its next strike without changing later strikes', () => {
  const petStrikes = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.source === 'ranger-pet' && event.at >= result.steps.at(-2).end / 1000
    );
  // The player variant grants no pet bonus; equal timing and vulnerability isolate the pet variant's charge.
  for (const [specialization, prefix] of [
    ['Core', []],
    ['Soulbeast', [ID.LEAVE_BEASTMODE]]
  ]) {
    const baseline = petStrikes(simulate(specialization, [...prefix, ID.MAUL_SOULBEAST, wait(3000)]));
    const enhanced = petStrikes(simulate(specialization, [...prefix, ID.MAUL_BASE, wait(3000)]));
    assert.ok(enhanced.length >= 2);
    assertFlooredDamageMultiplier(enhanced[0].damage, baseline[0].damage, 1.5);
    close(enhanced[1].damage / baseline[1].damage, 1);
  }
});

test('Maul targets a swapped pet even when it has no autonomous attack profile', () => {
  const run = (opener) =>
    simulate('Core', [ID.PET_SWAP, opener, ID.RENDING_POUNCE], { selectedPet2: 'Lynx' }).resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.RENDING_POUNCE
    );
  const baseline = run(ID.SLASH_ID_12474);
  const enhanced = run(ID.MAUL_BASE);
  // Rending Pounce's two simultaneous packets must consume the replacement pet's bonus once.
  assertFlooredDamageMultiplier(enhanced[0].damage, baseline[0].damage, 1.5);
  close(enhanced[1].damage / baseline[1].damage, 1);
});

test('Only Soulbeast Maul grants 25% to the next player strike and expires after ten seconds', () => {
  for (const maulId of [ID.MAUL_SOULBEAST, ID.MAUL_BASE]) {
    for (const [specialization, delay, multiplier] of [
      ['Soulbeast', 0, maulId === ID.MAUL_SOULBEAST ? 1.25 : 1],
      ['Soulbeast', 10000, 1],
      ['Core', 0, 1]
    ]) {
      // Concentration must not extend this unique buff beyond its ten-second window.
      const result = simulate(specialization, [maulId, wait(delay), ID.SLASH_ID_12474, ID.SLICE], {
        stats: { concentration: 1500 }
      });
      const maul = strike(result, maulId);
      const slash = strike(result, ID.SLASH_ID_12474);
      const slice = strike(result, ID.SLICE);
      assertFlooredDamageMultiplier(slash.damage, slice.damage, (multiplier * slash.coefficient) / slice.coefficient);
      assertFlooredDamageMultiplier(maul.damage, slice.damage, maul.coefficient / slice.coefficient);
    }
  }

  const interrupted = simulate('Soulbeast', [
    { type: 'cast', skillId: ID.MAUL_SOULBEAST, interruptAfterMs: 50 },
    ID.SLASH_ID_12474,
    ID.SLICE
  ]);
  assertFlooredDamageMultiplier(
    strike(interrupted, ID.SLASH_ID_12474).damage,
    strike(interrupted, ID.SLICE).damage,
    0.88 / 1.1
  );
});

test('Attack of Opportunity ignores effect damage and consumes only its recipient at the same timestamp', () => {
  const boons = new Map(
    ['pet', 'player'].map((recipient) => [
      `attack-of-opportunity-${recipient}`,
      [
        {
          at: 0,
          expiresAt: 10,
          stacks: 1,
          resolvedAudience: {
            includesSelf: recipient === 'player',
            includesSummons: recipient === 'pet',
            companionIds: ['pet-1']
          }
        }
      ]
    ])
  );
  const context = { boons, profession: { core: { petActive: false } } };
  const event = {
    type: 'damage',
    at: 1,
    actorType: 'effect',
    source: 'Trait',
    ownerActorType: 'player',
    coefficient: 1
  };
  const active = (packet) =>
    rangerAttackOfOpportunityModifier.when({ runtime: { boons }, event: packet, time: packet.at });
  reactToRangerGreatswordDamage(context, event);
  assert.equal(active(event), false);
  const player = { ...event, actorType: 'player', source: 'ranger' };
  const pet = { ...event, actorType: 'summon', source: 'ranger-pet', summonOwner: 'pet-1' };
  assert.equal(active(player), true);
  assert.equal(active(pet), true);
  assert.equal(active({ ...pet, summonOwner: 'pet-2' }), false);
  assert.equal(active({ ...pet, at: 10 }), false);
  reactToRangerGreatswordDamage(context, player);
  assert.equal(active(player), false);
  assert.equal(active(pet), true);
  reactToRangerGreatswordDamage(context, pet);
  assert.equal(active(pet), false);
});
