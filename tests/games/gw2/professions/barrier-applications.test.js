import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { ENGINEER_TRAIT_IDS as E } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { NECROMANCER_TRAIT_IDS as N, NECROMANCER_SKILL_IDS as SKILL } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const wait = { type: 'wait', durationMs: 5000 };
const cases = [
  {
    family: engineerProfession,
    specialization: 'Mechanist',
    traits: [E.MECH_FRAME_CHANNELING_CONDUITS],
    kinds: ['alacrity']
  },
  {
    family: necromancerProfession,
    specialization: 'Scourge',
    traits: [N.ABRASIVE_GRIT, N.DESERT_EMPOWERMENT],
    kinds: ['might', 'alacrity']
  },
  { family: thiefProfession, specialization: 'Specter', traits: [], kinds: ['rot-wallow-venom'] }
];

// Recipient keys compare delivery identities independently of each profession's boon or charge balance values.
function recipients(event) {
  const audience = event.resolvedAudience;
  return [
    ...(audience.includesSelf ? ['self'] : []),
    ...Array.from({ length: audience.alliedPlayerCount }, (_, i) => `ally:${audience.alliedPlayerIndex ?? i + 1}`),
    ...audience.companionIds.map((id) => `companion:${id}`)
  ];
}

function barrier(audience, fields = {}) {
  return {
    type: 'buff',
    kind: 'barrier',
    source: 'Fixture',
    sourceId: 'fixture.barrier',
    skillName: 'External Barrier',
    activationId: 'fixture.grant',
    actorType: 'player',
    at: 1,
    stacks: 1,
    duration: 5,
    audience,
    ...fields
  };
}

for (const entry of cases) {
  const simulate = createProfessionSimulator(entry.family, () => ({
    specialization: entry.specialization,
    selectedTraitIds: entry.traits,
    allies: { count: 3, strikesPerSecond: 0 },
    boons: {}
  }));

  for (const sharePlayerBoonsWithSummons of [true, false])
    test(`${entry.specialization}: external barrier rewards respect recipients with summon boon sharing ${sharePlayerBoonsWithSummons}`, () => {
      for (const audience of [
        { recipients: 'self' },
        { recipients: 'party', affectsSelf: false, alliedPlayerIndex: 2, maximumRecipients: 1 },
        { recipients: 'party', maximumRecipients: 5, eligibleCompanionIds: ['fixture.companion'] },
        { recipients: 'summons', affectsSelf: false, maximumRecipients: 1, eligibleCompanionIds: ['fixture.companion'] }
      ]) {
        const result = simulate(
          [wait],
          { sharePlayerBoonsWithSummons },
          { initialize: (runtime) => runtime.effects.emit({ kind: 'packet', event: barrier(audience) }) }
        );
        assert.deepEqual(result.warnings, []);
        const accepted = result.resolvedEvents.find((event) => event.kind === 'barrier');

        // Disabling boon sharing must leave the barrier's own companion delivery intact.
        if (audience.eligibleCompanionIds)
          assert.deepEqual(accepted.resolvedAudience.companionIds, audience.eligibleCompanionIds);

        const expected = recipients(accepted).filter(
          (key) =>
            (entry.specialization !== 'Specter' || key.startsWith('ally:')) &&
            (sharePlayerBoonsWithSummons || !key.startsWith('companion:'))
        );
        for (const kind of entry.kinds) {
          const rewards = result.resolvedEvents.filter((event) => event.kind === kind);
          assert.deepEqual(rewards.flatMap(recipients).sort(), expected.toSorted());
          for (const reward of rewards) {
            assert.equal(reward.parentEventOrder, accepted.eventOrder);
            assert.equal(reward.resolvedAudience.recipientCount, recipients(reward).length);
            assert.equal(reward.resolvedAudience.includesSummons, reward.resolvedAudience.companionIds.length > 0);
            assert.ok(result.resolvedEvents.indexOf(reward) > result.resolvedEvents.indexOf(accepted));
          }
        }
      }
    });

  test(`${entry.specialization}: rejected, empty, and foreign barriers cannot generate rewards`, () => {
    for (const scenario of ['rejected', 'empty', 'foreign', 'zero-stacks', 'zero-duration']) {
      const event = barrier({
        recipients: 'party',
        affectsSelf: false,
        alliedPlayerIndex: 4,
        maximumRecipients: 1,
        eligibleCompanionIds: []
      });

      if (scenario !== 'empty') event.audience = { recipients: 'party' };

      if (scenario === 'foreign') Object.assign(event, { actorType: 'summon', summonOwner: 'unrelated.summon' });

      if (scenario === 'zero-stacks') event.stacks = 0;

      if (scenario === 'zero-duration') event.duration = 0;

      const result = simulate(
        [wait],
        {},
        {
          initialize: (runtime) => runtime.effects.emit({ kind: 'packet', event }),
          extend: (native) =>
            scenario === 'rejected'
              ? {
                  prepareEvent(runtime, packet) {
                    return packet.sourceId === 'fixture.barrier'
                      ? null
                      : (native.prepareEvent?.(runtime, packet) ?? packet);
                  }
                }
              : {}
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.resolvedEvents.some((event) => entry.kinds.includes(event.kind)),
        false,
        scenario
      );
    }
  });
}

const scourge = createProfessionSimulator(necromancerProfession, () => ({
  specialization: 'Scourge',
  initialResource: 100,
  selectedTraitIds: [N.ABRASIVE_GRIT, N.DESERT_EMPOWERMENT, N.HERALD_OF_SORROW],
  boons: {}
}));
const withoutBarrier = (owner) => owner.effects.filter((effect) => effect.kind !== 'barrier');

// Native shade barriers still reach live minions when only player-boon sharing is disabled.
test('Scourge: shade barriers keep minions while their boon rewards honor sharing', () => {
  for (const sharePlayerBoonsWithSummons of [true, false]) {
    const result = scourge([SKILL.SUMMON_BONE_MINIONS, SKILL.MANIFEST_SAND_SHADE, wait], {
      sharePlayerBoonsWithSummons
    });
    assert.deepEqual(result.warnings, []);
    const accepted = result.resolvedEvents.find((event) => event.kind === 'barrier');
    assert.ok(accepted.resolvedAudience.companionIds.length > 0);
    for (const kind of ['might', 'alacrity']) {
      const rewards = result.resolvedEvents.filter((event) => event.kind === kind);
      assert.deepEqual(
        rewards.flatMap((event) => event.resolvedAudience.companionIds).sort(),
        sharePlayerBoonsWithSummons ? accepted.resolvedAudience.companionIds.toSorted() : []
      );
      assert.ok(rewards.some((event) => event.resolvedAudience.includesSelf));
    }
  }
});

// Mech ownership admits the barrier, but Channeling Conduits' resulting Alacrity is player-owned.
test('Mechanist: mech barriers retain companions when player-owned Alacrity sharing is disabled', () => {
  const simulate = createProfessionSimulator(engineerProfession, () => ({
    specialization: 'Mechanist',
    selectedTraitIds: [E.MECH_FRAME_CHANNELING_CONDUITS],
    allies: { count: 3 },
    sharePlayerBoonsWithSummons: false,
    boons: {}
  }));
  const result = simulate(
    [wait],
    {},
    {
      initialize: (runtime) =>
        runtime.effects.emit({
          kind: 'packet',
          event: barrier({ recipients: 'party' }, { actorType: 'summon', summonOwner: 'engineer.mech' })
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  const accepted = result.resolvedEvents.find((event) => event.kind === 'barrier');
  assert.deepEqual(accepted.resolvedAudience.companionIds, ['engineer.mech']);
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.kind === 'alacrity')
      .flatMap(recipients)
      .sort(),
    recipients(accepted)
      .filter((key) => !key.startsWith('companion:'))
      .sort()
  );
});

// Removing a real application removes its rewards; other effects from the same cast must survive independently.
test('Scourge: removing intrinsic, shade, or pulsing barrier effects suppresses barrier traits', () => {
  for (const skillId of [
    SKILL.SERPENT_SIPHON,
    SKILL.SAND_FLARE,
    SKILL.SAND_CASCADE,
    SKILL.DESERT_SHROUD,
    SKILL.SANDSTORM_SHROUD,
    SKILL.MANIFEST_SAND_SHADE
  ]) {
    const config = skillId === SKILL.DESERT_SHROUD ? { selectedTraitIds: [N.ABRASIVE_GRIT, N.DESERT_EMPOWERMENT] } : {};
    const baseline = scourge([skillId, wait], config);
    assert.deepEqual(baseline.warnings, []);
    assert.ok(baseline.resolvedEvents.some((event) => event.kind === 'barrier'));
    const result = scourge([skillId, wait], config, {
      catalog(catalog) {
        if (skillId === SKILL.MANIFEST_SAND_SHADE) {
          const id = N.DESERT_EMPOWERMENT;
          return applyBalanceProfilePatch(catalog, {
            balanceProfiles: {
              [id]: {
                removeEffects: catalog.balanceProfilesById
                  .get(id)
                  .effects.filter((effect) => effect.kind === 'barrier')
                  .map(({ type, name }) => ({ type, name }))
              }
            }
          });
        }

        // Sandstorm's pulsing barrier belongs to its launch action; intrinsic barriers remain ordinary effects.
        if (skillId === SKILL.SANDSTORM_SHROUD)
          return applySkillPatch(catalog, {
            skills: {
              [skillId]: {
                sideEffects: {
                  sandstormShroud: {
                    removeEffects: [
                      { type: 'buff', name: 'barrier pulses' },
                      { type: 'buff', name: 'barrier detonation' }
                    ]
                  }
                }
              }
            }
          });

        return withSkill(catalog, skillId, { effects: withoutBarrier(catalog.skillsById.get(skillId)) });
      }
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.resolvedEvents.some((event) => ['barrier', 'might', 'alacrity'].includes(event.kind)),
      false
    );

    if (skillId === SKILL.SANDSTORM_SHROUD)
      assert.ok(result.resolvedEvents.some((event) => event.kind === 'protection'));
  }
});

test('Scourge: cancelled utility casts cannot apply barriers or their trait rewards', () => {
  for (const skillId of [SKILL.SERPENT_SIPHON, SKILL.SAND_FLARE]) {
    const result = scourge([{ type: 'cast', skillId, interruptAfterMs: 1 }, wait]);
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.resolvedEvents.some((event) => ['barrier', 'might', 'alacrity'].includes(event.kind)),
      false
    );
  }
});

test('Scourge: barrier admission precedes Might, Alacrity, and the paired Protection reward', () => {
  const result = scourge([SKILL.SANDSTORM_SHROUD, wait]);
  assert.deepEqual(result.warnings, []);
  for (const barrier of result.resolvedEvents.filter((event) => event.kind === 'barrier')) {
    const ordered = result.resolvedEvents.filter(
      (event) => event.at === barrier.at && ['barrier', 'might', 'alacrity', 'protection'].includes(event.kind)
    );
    assert.deepEqual(
      ordered.map((event) => event.kind),
      ['barrier', 'might', 'alacrity', 'protection']
    );
  }
});
