import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import {
  rangerAttackOfOpportunityModifier,
  reactToRangerGreatswordDamage
} from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

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

test('Ranger greatsword authors one strike per attack and the supplied recharge and effects', () => {
  for (const [id, coefficient] of [
    [ID.SLASH_ID_12474, 0.88],
    [ID.SLICE, 1.1],
    [ID.ENDURING_SWING, 1.76],
    [ID.SWOOP, 2.4],
    [ID.HILT_BASH, 2.5],
    [ID.MAUL, 2.2],
    [ID.MAUL_ID_46629, 2.2]
  ]) {
    const strikes = rangerCatalog.skillsById.get(id).effects.filter((effect) => effect.type === 'strike');
    assert.deepEqual(
      strikes.map((effect) => effect.coefficient),
      [coefficient]
    );
  }

  for (const [id, cooldown] of [
    [ID.MAUL, 4],
    [ID.MAUL_ID_46629, 4],
    [ID.HILT_BASH, 20],
    [ID.SWOOP, 10]
  ]) {
    assert.equal(rangerCatalog.skillsById.get(id).cooldown, cooldown);
  }

  const maul = rangerCatalog.skillsById.get(ID.MAUL);
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
    close(poison(enhanced).damage / poison(baseline).damage, 1.25);
  }
});

test('Hilt Bash refreshes either Maul ID only after completing its cast', () => {
  for (const maulId of [ID.MAUL, ID.MAUL_ID_46629]) {
    const normal = simulate('Core', [maulId, maulId]);
    assert.equal(normal.steps[1].start - normal.steps[0].end, 4000);
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
    close(result.endState.profession.endurance, 50 + action.endsAt * 5 + (interrupted ? 0 : 15));
  }

  const capped = simulate('Core', [ID.SLASH_ID_12474, ID.SLICE, ID.ENDURING_SWING]);
  assert.equal(capped.endState.profession.endurance, 100);
});

test('Maul grants the active pet 50% on its next strike without changing later strikes', () => {
  const petStrikes = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.source === 'ranger-pet');
  // Equal cast durations and fixed vulnerability keep pet timing and target modifiers identical.
  for (const [specialization, prefix] of [
    ['Core', []],
    ['Soulbeast', [ID.LEAVE_BEASTMODE]]
  ]) {
    const baseline = petStrikes(simulate(specialization, [...prefix, ID.SLASH_ID_12474, wait(3000)]));
    const enhanced = petStrikes(simulate(specialization, [...prefix, ID.MAUL, wait(3000)]));
    assert.ok(enhanced.length >= 2);
    close(enhanced[0].damage / baseline[0].damage, 1.5);
    close(enhanced[1].damage / baseline[1].damage, 1);
  }
});

test('Maul targets a swapped pet even when it has no autonomous attack profile', () => {
  const run = (opener) =>
    simulate('Core', [ID.PET_SWAP, opener, ID.RENDING_POUNCE], { selectedPet2: 'Lynx' }).resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.RENDING_POUNCE
    );
  const baseline = run(ID.SLASH_ID_12474);
  const enhanced = run(ID.MAUL);
  // Rending Pounce's two simultaneous packets must consume the replacement pet's bonus once.
  close(enhanced[0].damage / baseline[0].damage, 1.5);
  close(enhanced[1].damage / baseline[1].damage, 1);
});

test('Merged Maul grants 25% to the next player strike and expires after ten seconds', () => {
  for (const maulId of [ID.MAUL, ID.MAUL_ID_46629]) {
    for (const [specialization, delay, multiplier] of [
      ['Soulbeast', 0, 1.25],
      ['Soulbeast', 10000, 1],
      ['Core', 0, 1]
    ]) {
      const result = simulate(specialization, [maulId, wait(delay), ID.SLASH_ID_12474, ID.SLICE]);
      const maul = strike(result, maulId);
      const slash = strike(result, ID.SLASH_ID_12474);
      const slice = strike(result, ID.SLICE);
      close(slash.damage / slash.coefficient / (slice.damage / slice.coefficient), multiplier);
      close(maul.damage / maul.coefficient, slice.damage / slice.coefficient);
    }
  }

  const interrupted = simulate('Soulbeast', [
    { type: 'cast', skillId: ID.MAUL, interruptAfterMs: 50 },
    ID.SLASH_ID_12474,
    ID.SLICE
  ]);
  close(strike(interrupted, ID.SLASH_ID_12474).damage / 0.88, strike(interrupted, ID.SLICE).damage / 1.1);
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
