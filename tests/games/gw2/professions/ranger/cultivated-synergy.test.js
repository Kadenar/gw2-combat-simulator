// Resolve real combo attempts so only successful player water blasts produce the trait's delayed bloom.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

function resolveBlast({
  selectedTraitIds = [TRAIT.CULTIVATED_SYNERGY, TRAIT.GRACE_OF_THE_LAND],
  fieldType = 'Water',
  finisherType = 'Blast',
  actorType = 'player',
  ownerActorType,
  chance = 1,
  fieldId = 'water-field',
  offTarget = false,
  attempts = [0.25]
} = {}) {
  const origin = {
    source: 'ranger',
    sourceId: ID.CALL_OF_THE_WILD,
    skillId: ID.CALL_OF_THE_WILD,
    skillName: 'Call of the Wild',
    actorType,
    ownerActorType,
    offTarget
  };
  return resolveTestGw2Events({
    profession: rangerProfession,
    config: {
      specialization: 'Druid',
      selectedTraitIds,
      selectedPet: 'Jacaranda',
      attributeInputs: baseAttributeInputs({ concentration: 750, expertise: 0 })
    },
    endTime: 3,
    events: [
      {
        at: 0,
        type: 'combo_field',
        source: 'Fixture',
        sourceId: 'water-field',
        actorType: 'player',
        ownerActorType: 'player',
        ownerId: 'ranger',
        fieldId: 'water-field',
        fieldType,
        expiresAt: 0.5
      },
      ...attempts.map((at, index) => ({
        ...origin,
        at,
        type: 'combo_finisher',
        attemptId: `blast-${index}`,
        finisherType,
        fieldId,
        effectAt: at,
        chance,
        applications: 1,
        successfulCombos: 1
      }))
    ]
  });
}

const seeds = (result) =>
  result.events.filter((event) => event.type === 'condition' && event.sourceId === ID.LESSER_SEED_OF_LIFE);
const alacrity = (result) => result.events.filter((event) => event.type === 'buff' && event.kind === 'alacrity');

test('Cultivated Synergy blooms outside Avatar after the triggering field expires', () => {
  const result = resolveBlast({ attempts: [0.25, 0.3] });
  const combos = result.events.filter((event) => event.type === 'combo');
  const blooms = seeds(result);
  const boons = alacrity(result);
  assert.deepEqual(result.warnings, []);
  assert.equal(combos.length, 2);
  assert.equal(blooms.length, combos.length);
  assert.equal(boons.length, blooms.length);
  blooms.forEach((bloom, index) => {
    assert.ok(bloom.at > combos[index].at && bloom.at > 0.5);
    assert.equal(bloom.condition, 'Blindness');
    assert.equal(bloom.duration, 4);
    assert.equal(bloom.stacks, 1);
    assert.equal(bloom.ownerActorType, 'player');
    assert.equal(bloom.traitId, TRAIT.CULTIVATED_SYNERGY);
    assert.equal(boons[index].at, bloom.at);
    assert.equal(boons[index].duration, 1.5);
    assert.equal(boons[index].sourceId, TRAIT.GRACE_OF_THE_LAND);
    assert.equal(boons[index].skillId, ID.LESSER_SEED_OF_LIFE);
    assert.equal(boons[index].audience.recipients, 'party');
    assert.equal(boons[index].audience.maximumRecipients, 5);
    assert.equal(boons[index].resolvedAudience.includesSelf, true);
    assert.equal(boons[index].resolvedAudience.companionIds.length, 1);
  });
});

test('Lesser Seed blinds without Grace of the Land', () => {
  const result = resolveBlast({ selectedTraitIds: [TRAIT.CULTIVATED_SYNERGY] });
  assert.equal(seeds(result).length, 1);
  assert.deepEqual(alacrity(result), []);
});

test('Cultivated Synergy requires a successful player-owned water blast and trait selection', () => {
  for (const options of [
    { selectedTraitIds: [TRAIT.GRACE_OF_THE_LAND] },
    { fieldType: 'Light' },
    { finisherType: 'Leap' },
    { actorType: 'summon' },
    { actorType: 'effect', ownerActorType: 'summon' },
    { chance: 0 },
    { fieldId: null }
  ]) {
    const result = resolveBlast(options);
    assert.deepEqual(result.warnings, [], JSON.stringify(options));
    assert.deepEqual(seeds(result), [], JSON.stringify(options));
    assert.deepEqual(alacrity(result), [], JSON.stringify(options));
  }

  assert.equal(seeds(resolveBlast({ actorType: 'effect', ownerActorType: 'player' })).length, 1);
});

test('Lesser Seed grants allied alacrity even when its blind is off target', () => {
  const result = resolveBlast({ offTarget: true });
  assert.equal(alacrity(result).length, 1);
  assert.equal(alacrity(result)[0].resolvedAudience.includesSelf, true);
});
