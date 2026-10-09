import assert from 'node:assert/strict';
import test from 'node:test';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { RANGER_TRAIT_IDS, RANGER_SKILL_IDS } from '#gw2/professions/ranger/data/ids.js';
import { NECROMANCER_TRAIT_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { REVENANT_LEGEND_IDS } from '#gw2/professions/revenant/data/ids.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { canonicalTime } from '#kernel/core/clock.js';

const cases = [
  [guardianProfession, { specialization: 'Firebrand' }, 'Epilogue: Ashes of the Just'],
  [
    revenantProfession,
    {
      specialization: 'Renegade',
      initialEnergy: 100,
      startingLegend: REVENANT_LEGEND_IDS.RENEGADE,
      selectedLegends: [REVENANT_LEGEND_IDS.RENEGADE]
    },
    "Razorclaw's Rage"
  ],
  [
    revenantProfession,
    {
      specialization: 'Renegade',
      initialEnergy: 100,
      startingLegend: REVENANT_LEGEND_IDS.RENEGADE,
      selectedLegends: [REVENANT_LEGEND_IDS.RENEGADE]
    },
    "Soulcleave's Summit"
  ],
  [
    rangerProfession,
    { specialization: 'Soulbeast', selectedTraitIds: [RANGER_TRAIT_IDS.LEADER_OF_THE_PACK] },
    'One Wolf Pack'
  ],
  [
    rangerProfession,
    { specialization: 'Soulbeast', selectedTraitIds: [RANGER_TRAIT_IDS.LEADER_OF_THE_PACK] },
    'Vulture Stance'
  ],
  [thiefProfession, { specialization: 'Core' }, 'Spider Venom'],
  [necromancerProfession, { specialization: 'Ritualist' }, 'Nightmare Weapon'],
  [necromancerProfession, { specialization: 'Ritualist' }, 'Splinter Weapon']
];

// Finite grants complete their payout; sustained grants sample one opportunity without inventing an upkeep duration.
for (const [profession, baseConfig, name] of cases) {
  test(`${name} previews finish their allied grant payout`, () => {
    const config = { ...baseConfig, allies: { count: 4, strikesPerSecond: 2 } };
    const skill = profession.runtimeFor(config).catalog.skills.find((skill) => skill.name === name);
    assert.ok(skill, name);
    const occurrence = {
      id: String(skill.id),
      effect: { kind: 'skill', id: skill.id },
      name,
      source: 'Skill',
      icon: '',
      unit: 'activation'
    };
    const preview = executeDamageOccurrence(profession, config, occurrence);
    const solo = executeDamageOccurrence(profession, { ...config, allies: { count: 0 } }, occurrence);
    assert.ok(preview.events.length > solo.events.length, 'allied grants contribute owned preview damage');
    assert.ok(
      preview.events.reduce((sum, event) => sum + (event.damage ?? 0), 0) >
        solo.events.reduce((sum, event) => sum + (event.damage ?? 0), 0)
    );
  });
}

// Personal Vulture procs retain trait grouping, while allied output uses the stance skill's preview ownership.
test('Vulture Stance retains personal trait attribution with and without allies', () => {
  for (const count of [0, 4]) {
    const config = {
      specialization: 'Soulbeast',
      selectedTraitIds: [RANGER_TRAIT_IDS.LEADER_OF_THE_PACK],
      allies: { count, strikesPerSecond: 2 }
    };
    const native = rangerProfession.runtimeFor(config);
    const result = observeGw2Runtime({
      config,
      rotation: ['Vulture Stance', { type: 'wait', durationMs: 2000 }],
      profession: {
        ...native,
        initialize(runtime) {
          native.initialize?.(runtime);
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at: 1,
              coefficient: 1,
              weaponStrength: 1000,
              source: 'fixture',
              sourceId: 'player-hit',
              actorType: 'player'
            }
          });
        }
      }
    });
    const personal = result.events.filter(
      (event) =>
        event.sourceId === RANGER_SKILL_IDS.VULTURE_STANCE &&
        event.actorType === 'effect' &&
        !event.metadata?.triggeredByAlly
    );
    assert.ok(personal.some((event) => event.type === 'condition'));
    assert.ok(personal.every((event) => event.source === 'Trait'));
    const allied = result.events.filter(
      (event) => event.sourceId === RANGER_SKILL_IDS.VULTURE_STANCE && event.metadata?.triggeredByAlly
    );
    if (count) assert.ok(allied.some((event) => event.type === 'condition' && event.source === 'ranger'));
    else assert.deepEqual(allied, []);
  }
});

// In-game logs show Vampiric Presence procs on a strike exactly at its 0.5 s deadline; both rates land one there.
for (const rate of [2, 4]) {
  test(`allied Vampiric Presence honors its cooldown at ${rate} strikes per second`, () => {
    const config = {
      specialization: 'Core',
      selectedTraitIds: [NECROMANCER_TRAIT_IDS.VAMPIRIC_PRESENCE],
      allies: { count: 1, strikesPerSecond: rate }
    };
    const native = necromancerProfession.runtimeFor(config);
    const profile = native.catalog.balanceProfilesById.get(NECROMANCER_TRAIT_IDS.VAMPIRIC_PRESENCE);
    const cooldown = balanceProfileNumber(profile, 'cooldown');
    const firstPulse = balanceProfileNumber(profile, 'auraPulseInterval') / 2;
    const run = (end) =>
      observeGw2Runtime({
        profession: native,
        config,
        rotation: [{ type: 'wait', durationMs: end * 1000 }]
      });
    const procs = (result) =>
      result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.sourceId === NECROMANCER_TRAIT_IDS.VAMPIRIC_PRESENCE
      );
    // Allied strikes before the first Vampiric Aura pulse cannot siphon.
    const firstAt = canonicalTime(Math.ceil(firstPulse * rate) / rate);
    const deadline = canonicalTime(firstAt + cooldown);
    const before = procs(run(deadline - 0.000001));
    const atDeadline = procs(run(deadline));
    assert.equal(before[0]?.at, firstAt, 'the first strike under the aura siphons');
    assert.ok(
      before.every((event) => event.at <= firstAt),
      'intermediate opportunities cannot bypass the cooldown'
    );
    assert.equal(atDeadline.at(-1).at, deadline, 'the opportunity on the cooldown deadline is eligible');
  });
}

// Explicit and implicit engagement preserve the granting cast as the parent and keep procs off its impact track.
for (const [profession, baseConfig, name] of cases.slice(0, 3)) {
  test(`${name} allied damage belongs to its grant in either combat-entry mode`, () => {
    const config = { ...baseConfig, allies: { count: 2, strikesPerSecond: 2 } };
    const rotation = [
      ...(profession === guardianProfession ? ['Tome of Justice'] : []),
      name,
      { type: 'wait', durationMs: 5000 }
    ];
    const results = [null, 0].map((combatStartTime) =>
      observeGw2Runtime({ profession: profession.runtimeFor(config), config, rotation, combatStartTime })
    );
    const signatures = [];
    for (const result of results) {
      assert.deepEqual(result.warnings, []);
      const action = result.events.find((event) => event.type === 'action' && event.skillName === name);
      assert.ok(action, name);
      const allied = result.events.filter(
        (event) => event.metadata?.triggeredByAlly != null && ['damage', 'condition'].includes(event.type)
      );
      assert.ok(allied.length > 0);
      for (const event of allied) {
        assert.equal(event.parentEventOrder, action.eventOrder);
        assert.notEqual(event.activationId, action.activationId);
        assert.equal(event.causalOrder, event.eventOrder, 'each opportunity has fresh ordering');
      }

      signatures.push(allied.map((event) => [event.at, event.metadata.triggeredByAlly, event.condition]));
    }

    assert.deepEqual(signatures[0], signatures[1]);
  });
}

// Persistent listeners have no granting cast; a marker cannot become their permanent ordering root.
test('ambient Vampiric Presence gets fresh ordering in both combat-entry modes', () => {
  const config = {
    specialization: 'Core',
    selectedTraitIds: [NECROMANCER_TRAIT_IDS.VAMPIRIC_PRESENCE],
    allies: { count: 1, strikesPerSecond: 2 }
  };
  for (const combatStartTime of [null, 0]) {
    const result = observeGw2Runtime({
      profession: necromancerProfession.runtimeFor(config),
      config,
      combatStartTime,
      rotation: [{ type: 'wait', durationMs: 4000 }]
    });
    const procs = result.events.filter(
      (event) => event.type === 'damage' && event.sourceId === NECROMANCER_TRAIT_IDS.VAMPIRIC_PRESENCE
    );
    assert.ok(procs.length > 0);
    for (const event of procs) {
      assert.equal(event.parentEventOrder, undefined);
      assert.equal(event.causalOrder, event.eventOrder);
    }
  }
});

// A late opportunity retains grant ancestry without overtaking a later cast's already scheduled same-time hit.
test('long allied grants do not reuse their activation order ahead of later casts', () => {
  const source = defineTestProfession({
    id: 'allied-order-fixture',
    name: 'Allied order fixture',
    catalog: createCanonicalCatalog({
      generated: [
        { id: 991601, name: 'Grant', effects: [] },
        { id: 991602, name: 'Later attack', effects: [] }
      ]
    }),
    hooks: {
      onCastCommit(runtime, cast) {
        const emit = (at, sourceId, actorType) =>
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at,
              source: 'fixture',
              sourceId,
              actorType,
              coefficient: 1,
              weaponStrength: 1000
            }
          });
        if (cast.skill.id === 991601)
          runtime.alliedStrikes.registerRecipients((allyIndex) => ({
            id: `grant:${allyIndex}`,
            trigger: ({ at }) => {
              emit(at, 'allied', 'effect');
            }
          }));
        else emit(runtime.time + 0.5, 'later-player', 'player');
      }
    }
  });
  for (const combatStartTime of [null, 0]) {
    const result = observeGw2Runtime({
      profession: source.runtimeFor(),
      config: { allies: { count: 1, strikesPerSecond: 2 } },
      combatStartTime,
      rotation: [
        { type: 'cast', skillId: 991601 },
        { type: 'wait', durationMs: 30000 },
        { type: 'cast', skillId: 991602 },
        { type: 'wait', durationMs: 1000 }
      ]
    });
    const action = result.events.find((event) => event.type === 'action' && event.skillId === 991601);
    const player = result.resolvedEvents.find((event) => event.sourceId === 'later-player');
    assert.ok(player);
    const cohort = result.resolvedEvents.filter((event) => event.type === 'damage' && event.at === player.at);
    assert.deepEqual(
      cohort.map((event) => event.sourceId),
      ['later-player', 'allied']
    );
    assert.equal(cohort[1].parentEventOrder, action.eventOrder);
    assert.ok(cohort[1].causalOrder > player.causalOrder);
  }
});

// Sharing a source ID alone does not make a personal profession reaction part of the selected payload.
test('skill previews exclude unrelated profession procs with the selected source ID', () => {
  const source = defineTestProfession({
    id: 'preview-owner-fixture',
    name: 'Preview owner fixture',
    catalog: createCanonicalCatalog({ generated: [{ id: 991603, name: 'Preview skill', effects: [] }] }),
    hooks: {
      onCastCommit(runtime) {
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'damage',
            at: runtime.time,
            source: 'fixture',
            sourceId: 991603,
            actorType: 'player',
            coefficient: 1,
            weaponStrength: 1000
          }
        });
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'damage',
            at: runtime.time + 121,
            source: 'fixture',
            sourceId: 991603,
            actorType: 'effect',
            procType: 'profession',
            coefficient: 1,
            weaponStrength: 1000
          }
        });
      }
    }
  });
  const preview = executeDamageOccurrence(
    source,
    {},
    {
      id: 'preview-owner',
      effect: { kind: 'skill', id: 991603 },
      name: 'Preview skill',
      source: 'Skill',
      icon: '',
      unit: 'activation'
    }
  );
  assert.ok(preview.events.some((event) => event.type === 'damage' && event.actorType === 'player'));
  assert.ok(preview.events.every((event) => event.procType !== 'profession'));
});
