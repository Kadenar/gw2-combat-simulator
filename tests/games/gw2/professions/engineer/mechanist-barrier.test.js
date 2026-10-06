import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

const simulate = createObservedProfessionSimulator(engineerProfession, {
  selectedSkillIds: [],
  boons: { alacrity: false, quickness: false, might: 0, fury: false },
  allies: { count: 4 },
  selectedTraitIds: [TRAIT.MECH_CORE_BARRIER_ENGINE, TRAIT.MECH_FRAME_CHANNELING_CONDUITS]
});

// The passive must wait for combat, continue while commands occupy the mech, and stop at the observation boundary.
test('Barrier Engine starts in combat and grants barrier independently of mech commands', () => {
  const result = simulate('Mechanist', [
    { type: 'wait', durationMs: 5000 },
    '__combat_start',
    'Barrier Burst',
    { type: 'wait', durationMs: 7000 }
  ]);
  const barriers = result.events.filter(
    (event) => event.kind === 'barrier' && event.sourceId === TRAIT.MECH_CORE_BARRIER_ENGINE
  );
  assert.ok(barriers.length > 0);
  assert.equal(barriers[0].at, result.combatStartTime + 3);
  for (const [index, barrier] of barriers.entries()) {
    if (index) assert.equal(barrier.at - barriers[index - 1].at, 3);
    assert.equal(barrier.summonOwner, 'engineer.mech');
    assert.equal(barrier.resolvedAudience.alliedPlayerCount, 4);
    assert.equal(barrier.resolvedAudience.includesSelf, true);
    assert.equal(barrier.audience.maximumRecipients, 5);
    assert.equal(barrier.resolvedAudience.recipientCount, 5);
    assert.deepEqual(barrier.resolvedAudience.companionIds, []);
  }

  const unselected = simulate('Mechanist', [{ type: 'wait', durationMs: 7000 }], { selectedTraitIds: [] });
  assert.equal(
    unselected.events.some((event) => event.kind === 'barrier'),
    false
  );
});

// A command's party payload keeps mech ownership and its base recharge without borrowing the player's lane.
test('Barrier Burst grants its barrier and boons to the party and retains a 30-second cooldown', () => {
  const result = simulate('Mechanist', ['Barrier Burst', { type: 'wait', durationMs: 5000 }], {
    selectedTraitIds: [TRAIT.MECH_CORE_BARRIER_ENGINE],
    stats: { concentration: 0 }
  });
  assert.equal(engineerCatalog.skillsByName.get('Barrier Burst').cooldown, 30);
  const packets = result.events.filter((event) => event.skillName === 'Barrier Burst' && event.type === 'buff');
  for (const [kind, duration, stacks] of [
    ['barrier', 5, 1],
    ['might', 20, 2],
    ['fury', 3, 1]
  ]) {
    const applications = packets.filter((event) => event.kind === kind);
    assert.ok(applications.length > 0);
    assert.ok(applications.every((event) => event.duration === duration && event.stacks === stacks));
    assert.ok(
      applications.every(
        (event) =>
          event.summonOwner === 'engineer.mech' &&
          event.resolvedAudience.alliedPlayerCount === 4 &&
          event.resolvedAudience.includesSelf
      )
    );
  }
});

// Party players consume target slots before the mech, including the alacrity derived from those grants.
test('barrier support reserves its five recipient slots for players before the mech', () => {
  for (const count of [0, 2, 4]) {
    const result = simulate('Mechanist', ['Barrier Burst', { type: 'wait', durationMs: 4000 }], { allies: { count } });
    const grants = result.events.filter((event) => event.kind === 'barrier');
    assert.ok(grants.length > 0);
    assert.ok(grants.every((event) => event.resolvedAudience.alliedPlayerCount === count));
    assert.ok(grants.every((event) => event.resolvedAudience.includesSummons === count < 4));
    const alacrity = result.events.filter((event) => event.kind === 'alacrity');
    assert.ok(alacrity.some((event) => event.resolvedAudience.includesSelf));
    assert.equal(
      alacrity.some((event) => event.resolvedAudience.companionIds.includes('engineer.mech')),
      count < 4
    );
  }
});

function barrier(at, actorType, audience, extras = {}) {
  return {
    type: 'buff',
    kind: 'barrier',
    name: 'Test barrier',
    source: 'engineer',
    sourceId: 'test.barrier',
    actorType,
    at,
    stacks: 1,
    duration: 5,
    audience,
    ...extras
  };
}

// Minimal competing grants protect recipient ownership, the shared ICD, and reopening at its expiry.
test('Channeling Conduits shares the one-second ICD between player and mech for each barrier recipient', () => {
  const events = [
    barrier(0, 'player', { recipients: 'self' }),
    barrier(0.5, 'summon', { recipients: 'party', maximumRecipients: 6 }, { summonOwner: 'engineer.mech' }),
    barrier(1, 'player', { recipients: 'party', maximumRecipients: 5, eligibleCompanionIds: [] }),
    barrier(1.5, 'player', {
      recipients: 'party',
      affectsSelf: false,
      alliedPlayerIndex: 2,
      maximumRecipients: 1,
      eligibleCompanionIds: []
    }),
    barrier(2, 'summon', { recipients: 'party', maximumRecipients: 6 }, { summonOwner: 'unrelated.summon' })
  ];
  const config = {
    specialization: 'Mechanist',
    selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS],
    selectedSkillIds: [],
    allies: { count: 4 },
    stats: { concentration: 0 },
    boons: {}
  };
  const result = resolveTestGw2Events({ profession: engineerProfession, config, events, endTime: 2 });
  const alacrity = result.events.filter((event) => event.kind === 'alacrity');
  assert.ok(alacrity.every((event) => event.duration === 1 && event.sourceId === TRAIT.MECH_FRAME_CHANNELING_CONDUITS));
  const self = alacrity.filter((event) => event.resolvedAudience.includesSelf);
  assert.deepEqual(
    self.map((event) => event.at),
    [0, 1]
  );
  const allyTwo = alacrity.filter((event) => event.resolvedAudience.alliedPlayerIndex === 2);
  assert.deepEqual(
    allyTwo.map((event) => event.at),
    [0.5, 1.5]
  );
  assert.ok(
    alacrity.some((event) => event.at === 0.5 && event.resolvedAudience.companionIds.includes('engineer.mech'))
  );
  assert.equal(
    alacrity.some((event) => event.at === 2),
    false
  );
  const unselected = resolveTestGw2Events({
    profession: engineerProfession,
    config: { ...config, selectedTraitIds: [] },
    events,
    endTime: 2
  });
  assert.equal(
    unselected.events.some((event) => event.kind === 'alacrity'),
    false
  );
});

// Barrier-triggered boons use the player's boon duration even when the mech supplied the barrier.
test('Channeling Conduits alacrity scales with player concentration', () => {
  const result = resolveTestGw2Events({
    profession: engineerProfession,
    config: {
      specialization: 'Mechanist',
      selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS],
      stats: { concentration: 1500 },
      boons: {}
    },
    events: [barrier(0, 'summon', { recipients: 'party', maximumRecipients: 6 }, { summonOwner: 'engineer.mech' })],
    endTime: 1
  });
  const self = result.events.find((event) => event.kind === 'alacrity' && event.resolvedAudience.includesSelf);
  assert.equal(self.duration, 2);
});
