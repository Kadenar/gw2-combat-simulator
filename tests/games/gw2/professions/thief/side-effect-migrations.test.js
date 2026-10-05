import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill, withProfile } from '#tests/helpers/catalog-overrides.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS as DEADEYE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

// Variant selection snapshots the chain before completion, but transforms the live, independently editable packets.
test('Falling Spider empowers only the accepted predecessor and preserves effect and tick edits', () => {
  for (const ticks of [false, true]) {
    for (const empowered of [false, true]) {
      const result = runThief(
        [ID.FALLING_SPIDER],
        { primaryWeapon: 'Spear', secondaryWeapon: '' },
        {
          initialize(runtime) {
            runtime.profession.core.spearChainStage = 2;
            runtime.profession.core.spearPreviousSkillId = empowered ? ID.ENTANGLING_ASP : ID.VAMPIRIC_SLASH;
          },
          probes: [
            [
              0.1,
              (runtime) => {
                runtime.profession.core.spearPreviousSkillId = ID.MANTIS_STING;
              }
            ]
          ],
          catalog(catalog) {
            const patched = withProfile(catalog, PROFILE.fallingSpiderEmpowered, {
              damageMultiplier: 1.5,
              resourceGain: 2
            });
            const packet = (effect) =>
              ticks
                ? { type: effect.type, timingAnchor: 'castEnd', ticks: [{ ...effect, atMs: 0 }] }
                : { ...effect, timingAnchor: 'castEnd', atMs: 0 };
            return withSkill(patched, ID.FALLING_SPIDER, {
              effects: [
                packet({ type: 'strike', coefficient: 2 }),
                packet({ type: 'condition', condition: 'Bleeding', stacks: 3, duration: 5 }),
                packet({ type: 'condition', condition: 'Vulnerability', stacks: 4, duration: 6 })
              ]
            });
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const packets = result.resolvedEvents.filter((event) => event.skillId === ID.FALLING_SPIDER);
      assert.equal(packets.find((event) => event.type === 'damage').coefficient, empowered ? 3 : 2);
      assert.equal(
        packets.filter((event) => event.condition === 'Bleeding').reduce((sum, event) => sum + event.stacks, 0),
        empowered ? 5 : 3
      );
      assert.equal(
        packets.filter((event) => event.condition === 'Vulnerability').reduce((sum, event) => sum + event.stacks, 0),
        4
      );
      assert.equal(
        packets.some((event) => event.condition === 'Poisoned'),
        false
      );
      assert.equal(observedRuntime(result).profession.core.spearChainStage, 0);
    }
  }
});

// Patch consumers edit effect timelines directly; removed siblings cannot alter a surviving pulse's observation boundary.
test('Uncatchable honors independent authored pulse timing and component removal', () => {
  for (const removed of ['Bleeding', 'Crippled']) {
    const surviving = removed === 'Bleeding' ? 'Crippled' : 'Bleeding';
    for (const endTimeMs of [1299, 1300]) {
      const result = runThief(
        [SHARED_SKILL_IDS.DODGE],
        { selectedTraitIds: [TRAIT.UNCATCHABLE] },
        {
          observation: { kind: 'absolute', endTimeMs },
          catalog: (catalog) =>
            applyBalanceProfilePatch(catalog, {
              balanceProfiles: {
                [TRAIT.UNCATCHABLE]: {
                  removeEffects: [{ type: 'condition', name: removed }],
                  effects: [{ type: 'condition', name: surviving, intervalMs: { from: 1000, to: 500 } }]
                }
              }
            })
        }
      );
      assert.deepEqual(result.warnings, []);
      const pulses = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.UNCATCHABLE);
      assert.deepEqual(
        pulses.map((event) => event.at),
        endTimeMs === 1299 ? [0.8] : [0.8, 1.3]
      );
      assert.ok(pulses.every((event) => event.condition === surviving && event.actorType === 'player'));
      assert.ok(pulses.every((event) => event.skillId === ID.LESSER_CALTROPS && event.triggeredBy === 'Dodge'));
      assert.ok(pulses.every((event) => event.activationId === result.steps[0].activationId));
    }
  }
});

// Mark's declared commitment owns its ordered rewards before the residual profession completion observers.
test('Deadeye mark rewards commit before profession completion and retain attribution', () => {
  const before = [];
  const result = runThief(
    [ID.DEADEYES_MARK],
    { specialization: 'Deadeye', selectedTraitIds: [TRAIT.BE_QUICK_OR_BE_KILLED] },
    {
      extend: (native) => ({
        onCastCommit(runtime, cast) {
          native.onCastCommit(runtime, cast);
          runtime.schedule('test.before-completion', runtime.time, undefined, undefined, 10);
        },
        tasks: {
          ...native.tasks,
          'test.before-completion': (runtime) =>
            before.push(runtime.facts.read().some((event) => event.sourceId === 'thief.deadeye.be-quick-or-be-killed'))
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(before, [true]);
  const boon = result.resolvedEvents.find((event) => event.sourceId === 'thief.deadeye.be-quick-or-be-killed');
  assert.ok(boon);
  assert.equal(boon.kind, 'quickness');
  assert.equal(boon.actorType, 'player');
  assert.equal(boon.activationId, result.steps[0].activationId);
  assert.equal(boon.skillId, ID.DEADEYES_MARK);
  assert.equal(boon.resolvedAudience.includesSelf, true);
  assert.equal(boon.resolvedAudience.alliedPlayerCount, 0);
});

// Dodge's declaration owns its base payload; the profession must not silently discard an authored addition.
test('Core Dodge emits its authored effects without a skill-id suppression hook', () => {
  const result = runThief(
    [SHARED_SKILL_IDS.DODGE],
    {},
    {
      catalog: (catalog) =>
        withSkill(catalog, SHARED_SKILL_IDS.DODGE, {
          effects: [{ type: 'boon', boon: 'vigor', duration: 3, stacks: 1 }]
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  const buffs = result.resolvedEvents.filter(
    (event) => event.kind === 'vigor' && event.skillId === SHARED_SKILL_IDS.DODGE
  );
  assert.equal(buffs.length, 1);
  assert.equal(buffs[0].duration, 3);
});

// Removing a declaration must remove its intrinsic transition instead of falling back to an ID dispatcher.
test('Thief activation declarations are the sole owners of their state transitions', () => {
  const scenarios = [
    {
      id: ID.SIGNET_OF_AGILITY,
      config: { selectedSkillIds: [13062], initialEndurance: 0 },
      active: (runtime) => runtime.profession.core.endurance.value > 50
    },
    {
      id: ID.CHANNELED_VIGOR,
      config: { specialization: 'Daredevil', selectedSkillIds: [30400], initialEndurance: 0 },
      active: (runtime) => runtime.profession.core.endurance.value > 100
    },
    {
      id: ID.PREPARE_PITFALL,
      config: { selectedSkillIds: [13057] },
      active: (runtime) => Boolean(runtime.profession.core.availableFlips[ID.PITFALL])
    },
    {
      id: ID.SPIDER_VENOM,
      config: { selectedSkillIds: [13037] },
      active: (runtime) =>
        Object.values(runtime.profession.core.venomChargeBatches).some((batches) => batches.length > 0)
    },
    {
      id: ID.ASSASSINS_SIGNET,
      config: { selectedSkillIds: [13046] },
      active: (runtime) => runtime.combat.activeBuffStacks('assassins-signet', runtime.time, 1) > 0
    },
    { id: ID.STEAL, active: (runtime) => runtime.profession.core.storedStolenSkillCount > 0 },
    {
      id: ID.DEADEYES_MARK,
      config: { specialization: 'Deadeye' },
      active: (runtime) => Boolean(runtime.profession.specialization.state.markedTargetId)
    },
    {
      id: ID.KNEEL,
      config: { specialization: 'Deadeye', primaryWeapon: 'Rifle', secondaryWeapon: '' },
      active: (runtime) => runtime.profession.core.kneeling
    },
    {
      id: ID.SIPHON,
      config: { specialization: 'Specter' },
      active: (runtime) => runtime.resourceController.value('shadowForce') > 0
    },
    {
      id: ID.ENTER_SHADOW_SHROUD,
      config: { specialization: 'Specter', initialShadowForce: 50 },
      active: (runtime) => runtime.profession.specialization.state.shadowShroudActive
    },
    {
      id: ID.SKRITT_SWIPE,
      config: { specialization: 'Antiquary' },
      active: (runtime) => runtime.profession.specialization.state.artifactUsesRemaining > 0
    },
    {
      id: ID.MISTBURN_MORTAR,
      before: [ID.SKRITT_SWIPE],
      config: { specialization: 'Antiquary' },
      active: (runtime) => runtime.profession.specialization.state.mistburn.charges > 0
    },
    {
      id: ID.FORGED_SURFER_DASH,
      before: [ID.SKRITT_SWIPE],
      config: { specialization: 'Antiquary' },
      active: (runtime) => runtime.profession.specialization.state.forgedSurferBombDropUntil > 0
    },
    {
      id: ID.SKRITT_SCUFFLE,
      config: { specialization: 'Antiquary', selectedSkillIds: [77255] },
      active: (runtime) => runtime.profession.specialization.state.artifactUsesRemaining > 0
    },
    {
      id: ID.THIEVES_GUILD,
      config: { selectedSkillIds: [13082] },
      active: (runtime) => Boolean(runtime.profession.core.activeThievesGuild)
    }
  ];
  for (const scenario of scenarios) {
    for (const removed of [false, true]) {
      const result = runThief([...(scenario.before ?? []), scenario.id], scenario.config, {
        catalog: (catalog) => (removed ? withSkill(catalog, scenario.id, { sideEffects: [] }) : catalog)
      });
      assert.deepEqual(result.warnings, [], String(scenario.id));
      assert.equal(scenario.active(observedRuntime(result)), !removed, `${scenario.id}: removed=${removed}`);
    }
  }
});

// Selection, commitment and display share one accepted stealth payload, including variant and predicate edits.
test('selected stealth respects acceptance predicates, Revealed, extension and cancellation', () => {
  for (const accepted of [false, true]) {
    for (const revealed of [false, true]) {
      const result = runThief(
        [ID.HIDE_IN_SHADOWS],
        { selectedSkillIds: [13027] },
        {
          initialize(runtime) {
            runtime.profession.core.spearChainStage = Number(accepted);
            runtime.profession.core.revealedUntil = revealed ? 10 : 0;
          },
          probes: [
            [
              0.1,
              (runtime) => {
                runtime.profession.core.spearChainStage = Number(!accepted);
              }
            ]
          ],
          catalog: (catalog) =>
            withSkill(catalog, ID.HIDE_IN_SHADOWS, {
              castTimeMs: 1000,
              effects: [{ type: 'buff', kind: 'stealth', duration: 9 }],
              effectVariants: [
                {
                  when: () => true,
                  transform: () => [
                    {
                      type: 'buff',
                      kind: 'stealth',
                      duration: 4,
                      when: (runtime) => runtime.profession.core.spearChainStage === 1
                    }
                  ]
                }
              ]
            })
        }
      );
      assert.deepEqual(result.warnings, []);
      const buff = result.events.find((event) => event.type === 'buff' && event.kind === 'stealth');
      assert.equal(Boolean(buff), accepted && !revealed);
      assert.equal(observedRuntime(result).profession.core.stealthUntil, buff ? buff.at + 4 : 0);
    }
  }

  const result = runThief(
    [ID.HIDE_IN_SHADOWS],
    { selectedSkillIds: [13027], selectedTraitIds: [TRAIT.SHADOWS_REJUVENATION], initialInitiative: 0 },
    {
      initialize(runtime) {
        runtime.profession.core.stealthUntil = 14;
      },
      catalog: (catalog) =>
        withSkill(withProfile(catalog, PROFILE.resources, { resourceGain: 0 }), ID.HIDE_IN_SHADOWS, {
          effects: [{ type: 'buff', kind: 'stealth', duration: 10 }]
        })
    }
  );
  const runtime = observedRuntime(result);
  const buff = result.events.find((event) => event.kind === 'stealth');
  assert.equal(runtime.profession.core.stealthUntil, buff.at + 15);
  assert.equal(buff.duration, 15);
  assert.equal(runtime.resourceController.value('initiative'), 0, 'extension does not repeat entry traits');
  const cancelled = runThief([{ skillId: ID.HIDE_IN_SHADOWS, interruptMs: 0 }], {
    selectedSkillIds: [13027]
  });
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(observedRuntime(cancelled).profession.core.stealthUntil, 0);
  assert.equal(
    cancelled.events.some((event) => event.kind === 'stealth'),
    false
  );
});

// Accepted malice must survive live changes and the first-hit spend, while only the authored final strike scales.
test('Malicious Ashen declarations retain accepted malice and own their commitment refund', () => {
  const result = runThief(
    [ID.MALICIOUS_ASHEN_ASSAULT],
    { specialization: 'Deadeye', primaryWeapon: 'Spear', secondaryWeapon: '', initialInitiative: 0 },
    {
      initialize(runtime) {
        runtime.profession.core.stealthUntil = 10;
        runtime.resourceController.replace('malice', 5);
        Object.assign(runtime.profession.specialization.state, {
          markedTargetId: 'primary-target',
          markExpiresAt: 10
        });
      },
      probes: [
        [
          0.1,
          (runtime) => {
            runtime.resourceController.replace('malice', 1);
          }
        ]
      ],
      catalog: (catalog) =>
        withSkill(
          withProfile(withProfile(catalog, PROFILE.resources, { resourceGain: 0 }), DEADEYE.maliciousAshenAssault, {
            coefficientMultiplier: 0.3,
            resourceGain: 7
          }),
          ID.MALICIOUS_ASHEN_ASSAULT,
          {
            castTimeMs: 1000,
            effects: [
              { type: 'strike', name: 'Ordinary packet', coefficient: 1, atMs: 500, timingAnchor: 'castStart' },
              {
                type: 'strike',
                name: 'Malicious Ashen Assault — Final Strike',
                coefficient: 2,
                atMs: 0,
                timingAnchor: 'castEnd'
              }
            ]
          }
        )
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.resolvedEvents.find((event) => event.name === 'Ordinary packet').coefficient, 1);
  assert.equal(
    result.resolvedEvents.find((event) => event.name === 'Malicious Ashen Assault — Final Strike').coefficient,
    5
  );
  assert.equal(observedRuntime(result).resourceController.value('initiative'), 7);
  assert.equal(observedRuntime(result).profession.specialization.state.malice.value, 0);
});

// The finisher window begins at commitment after the throw's own packet; later attacks see its modifier.
test('Distracting Throw does not apply its new damage window to its granting strike', () => {
  const windows = [];
  const result = runThief(
    [ID.DISTRACTING_THROW, ID.BARBED_SPEAR],
    { primaryWeapon: 'Spear', secondaryWeapon: '' },
    {
      initialize(runtime) {
        runtime.profession.core.spearLastWasFinisher = true;
      },
      extend: (native) => ({
        reactions: {
          ...native.reactions,
          'damage.resolved'(runtime, event, details) {
            native.reactions['damage.resolved']?.(runtime, event, details);
            if ([ID.DISTRACTING_THROW, ID.BARBED_SPEAR].includes(event.skillId))
              windows.push(runtime.combat.activeBuffStacks('distracting-throw', runtime.time, 1) > 0);
          }
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(windows, [false, true]);
});
