import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_SKILL_IDS as MESMER } from '#gw2/professions/mesmer/data/ids.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS as GUARDIAN, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST } from '#gw2/professions/elementalist/data/ids.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { DEADEYE_BALANCE_PROFILE_IDS as DEADEYE_PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as MESMER_PROFILE } from '#gw2/professions/mesmer/core/profiles.js';

// Apply fixture tuning and state through the real profession lifecycle, retaining native task/reaction dispatch.
function migratedSkillRun(profession, config, rotation, { catalog = (value) => value, initialize = () => {} } = {}) {
  const native = profession.runtimeFor(config);
  return observeGw2Runtime({
    profession: {
      ...native,
      catalog: catalog(native.catalog),
      initialize(runtime) {
        native.initialize(runtime);
        initialize(runtime);
      }
    },
    config,
    rotation
  });
}

// The shared emitter must retain the trait's identity and cast lineage alongside the independent page refund.
test('Weighty Terms side effects preserve Slow attribution and page restoration', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    specialization: 'Firebrand',
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.WEIGHTY_TERMS],
    initialTomePages: 0,
    boons: {},
    target: { armor: 2597 }
  })(undefined, ['Flame Rush', 'Flame Rush', { type: 'wait', durationMs: 1000 }, 'Flame Surge']);
  assert.deepEqual(result.warnings, []);
  const slow = result.events.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.WEIGHTY_TERMS);
  const cast = result.events.find((event) => event.type === 'action' && event.skillId === GUARDIAN.FLAME_SURGE);
  assert.equal(slow.length, 1);
  assert.equal(slow[0].name, 'Weighty Terms — Slow');
  assert.equal(slow[0].activationId, cast.activationId);
  assert.equal(slow[0].at, cast.endsAt);
  assert.equal(result.planningState.profession.tomePages.value, 2);
});

// Outcome selection must spend Luck once and preserve the selected profile's schedule even on cancelled uses.
test('Cannon variants retain accepted outcomes, live profile timing, and cancelled-use packets', () => {
  for (const [recharging, luck, cancelled] of [
    [false, 0, false],
    [true, 0, false],
    [true, 1, false],
    [true, 0, true],
    [false, 0, true]
  ]) {
    const backfire = recharging && !luck;
    const result = runThief(
      [
        {
          skillId: THIEF.STONE_SUMMIT_CANNON,
          type: 'cast',
          doubleEdgeOutcome: 'backfire',
          ...(cancelled ? { interruptAfterMs: 100 } : {})
        },
        { type: 'wait', durationMs: 3500 }
      ],
      { specialization: 'Antiquary', selectedSkillIds: [76725] },
      {
        initialize(runtime) {
          if (recharging) runtime.cooldownController.setReadyAt(THIEF.STONE_SUMMIT_CANNON, 15);
          runtime.profession.specialization.state.scoundrelsLuck = luck;
        },
        catalog: (catalog) =>
          withProfile(
            withProfile(catalog, PROFILE.cannonSuccess, {
              effects: [{ type: 'strike', coefficient: 1, atMs: 130 }]
            }),
            PROFILE.cannonBackfire,
            {
              initialDelay: 0.7,
              effects: [{ type: 'strike', coefficient: 2, atMs: 130 }]
            }
          )
      }
    );
    assert.deepEqual(result.warnings, []);
    const action = result.events.find(
      (event) => event.type === 'action' && event.skillId === THIEF.STONE_SUMMIT_CANNON
    );
    const strikes = result.events.filter(
      (event) => event.type === 'damage' && event.skillId === THIEF.STONE_SUMMIT_CANNON
    );
    assert.equal(strikes.length, 1);
    assert.equal(strikes[0].coefficient, backfire ? 2 : 1);
    assert.ok(Math.abs(strikes[0].at - (action.endsAt + 0.13 + (backfire ? 0.7 : 0))) < 1e-6);
    assert.equal(strikes[0].activationId, action.activationId);
    assert.equal(observedRuntime(result).profession.specialization.state.scoundrelsLuck, 0);
  }
});

// Commitment clears both recharge stores once; deferred completion cannot reset a newly started recharge.
test('Mental Collapse resets recharge at commitment and never repeats the reset at the reserved end', () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Spear',
    selectedTraitIds: [],
    boons: {},
    target: { armor: 2597 }
  };
  const native = mesmerProfession.runtimeFor(config);
  const pending = [];
  const result = observeGw2Runtime({
    profession: {
      ...native,
      catalog: withSkill(native.catalog, MESMER.MENTAL_COLLAPSE, { castTimeMs: 1000, interruptCommitMs: 400 }),
      initialize(runtime) {
        native.initialize(runtime);
        runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(MESMER.MIND_THE_GAP), 0, 50);
        runtime.schedule('test.reset-probe', 0.25);
        runtime.schedule('test.reset-probe', 0.75);
        runtime.schedule('test.restart-recharge', 0.8);
        runtime.schedule('test.reset-probe', 1.05);
      },
      tasks: {
        ...native.tasks,
        'test.reset-probe'(runtime) {
          const recharging = runtime.cooldowns.has(MESMER.MIND_THE_GAP);
          assert.equal(runtime.rechargeProgress.has(MESMER.MIND_THE_GAP), recharging);
          pending.push(recharging);
        },
        'test.restart-recharge': (runtime) =>
          runtime.cooldownController.startRecharge(
            runtime.helpers.skillsById.get(MESMER.MIND_THE_GAP),
            runtime.time,
            50
          )
      }
    },
    config,
    rotation: [
      { type: 'cast', skillId: MESMER.MENTAL_COLLAPSE, interruptAfterMs: 500 },
      { type: 'wait', durationMs: 1000 }
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(pending, [true, false, true]);
});

// Removing the authored control must remove the empowered stun without removing consumption or the recharge reset.
test('Mental Collapse uses its normal effect list for the Clarity-gated stun', () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Spear',
    selectedTraitIds: [],
    boons: {},
    target: { armor: 2597 }
  };
  const native = mesmerProfession.runtimeFor(config);
  const result = observeGw2Runtime({
    profession: {
      ...native,
      catalog: withSkill(native.catalog, MESMER.MENTAL_COLLAPSE, {
        effects: native.catalog.skillsById
          .get(MESMER.MENTAL_COLLAPSE)
          .effects.filter((effect) => effect.type !== 'control')
      })
    },
    config,
    rotation: ['Mind the Gap', 'Mental Collapse', { type: 'wait', durationMs: 1000 }]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'control' && event.skillId === MESMER.MENTAL_COLLAPSE),
    false
  );
  assert.equal(result.planningState.profession.clarityRemaining, 0);
  assert.equal(observedRuntime(result).cooldowns.has(MESMER.MIND_THE_GAP), false);
});

// Clarity's live skill effect is the sole source of its window and proc; removal or cancellation grants neither.
test('Mind the Gap applies its authored Clarity duration and respects effect removal and cancellation', () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Spear',
    selectedTraitIds: [],
    boons: {},
    target: { armor: 2597 }
  };
  const native = mesmerProfession.runtimeFor(config);
  for (const [removed, cancelled] of [
    [false, false],
    [true, false],
    [false, true]
  ]) {
    const result = observeGw2Runtime({
      profession: {
        ...native,
        catalog: withSkill(native.catalog, MESMER.MIND_THE_GAP, {
          effects: native.catalog.skillsById
            .get(MESMER.MIND_THE_GAP)
            .effects.flatMap((effect) =>
              effect.kind === 'clarity' ? (removed ? [] : [{ ...effect, duration: 2 }]) : [effect]
            )
        })
      },
      config,
      rotation: [
        { type: 'cast', skillId: MESMER.MIND_THE_GAP, ...(cancelled ? { interruptAfterMs: 100 } : {}) },
        { type: 'wait', durationMs: 1000 }
      ]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.clarityRemaining, removed || cancelled ? 0 : 1000);
    const proc = result.events.find((event) => event.type === 'proc' && event.name === 'Clarity');
    assert.equal(Boolean(proc), !removed && !cancelled);
    if (proc) assert.equal(proc.detail, 'Spear skills 3-5 empowered for 2s');
  }
});
// Signet rewards follow commitment and authored removal, independently of deferred Mesmer completion.
test('signet declarations reset only committed activations', () => {
  for (const [id, target] of [
    [MESMER.SIGNET_OF_THE_ETHER, MESMER.PHANTASMAL_WARLOCK],
    [MESMER.SIGNET_OF_ILLUSIONS, MESMER.MIND_WRACK]
  ]) {
    for (const [cancelled, removed] of [
      [false, false],
      [true, false],
      [false, true]
    ]) {
      const result = migratedSkillRun(
        mesmerProfession,
        { specialization: 'Core', selectedTraitIds: [], boons: {}, target: { armor: 2597 } },
        [
          { type: 'cast', skillId: id, interruptAfterMs: cancelled ? 100 : 500 },
          { type: 'wait', durationMs: 250 }
        ],
        {
          catalog: (catalog) =>
            withSkill(catalog, id, {
              castTimeMs: 1000,
              interruptCommitMs: 400,
              ...(removed ? { sideEffects: [] } : {})
            }),
          initialize(runtime) {
            runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(target), 0, 50);
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(runtime.cooldowns.has(target), cancelled || removed);
      assert.equal(runtime.rechargeProgress.has(target), cancelled || removed);
    }
  }
});

// Mercy's removable reset must not own or suppress the independent Malice refund.
test('Mercy declares its Mark reset independently of the Malice refund', () => {
  const refunds = [];
  for (const removed of [false, true]) {
    const result = runThief(
      ['Mercy'],
      { specialization: 'Deadeye', selectedSkillIds: [41372], initialInitiative: 0 },
      {
        // Remove only the reset declaration so the independently declared refund still executes.
        catalog: (catalog) =>
          removed
            ? withSkill(catalog, THIEF.MERCY, {
                sideEffects: catalog.skillsById
                  .get(THIEF.MERCY)
                  .sideEffects.filter((effect) => effect.do.type !== 'rechargeReset')
              })
            : catalog,
        initialize(runtime) {
          runtime.profession.specialization.state.malice = 3;
          runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(THIEF.DEADEYES_MARK), 0, 50);
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.cooldowns.has(THIEF.DEADEYES_MARK), removed);
    assert.equal(runtime.profession.specialization.state.malice, 0);
    refunds.push(runtime.profession.core.initiative.value);
  }

  assert.ok(refunds[0] > 0);
  assert.equal(refunds[0], refunds[1]);
});

// The shared flip observes live profile duration, exclusive expiry, consumption, and cancellation.
test('Shadow Flare uses the shared follow-up window', () => {
  for (const cancelled of [false, true]) {
    const windows = [];
    const result = runThief(
      [
        { type: 'cast', skillId: THIEF.SHADOW_FLARE, ...(cancelled ? { interruptAfterMs: 100 } : {}) },
        { type: 'wait', durationMs: 1500 }
      ],
      { specialization: 'Deadeye', selectedSkillIds: [41158] },
      {
        catalog: (catalog) =>
          withProfile(
            withSkill(catalog, THIEF.SHADOW_FLARE, {
              castTimeMs: 400,
              interruptCommitMs: 400
            }),
            DEADEYE_PROFILE.shadowFlare,
            { durationMultiplier: 0.5 }
          ),
        probes: [
          [0.7, (runtime) => windows.push(Boolean(runtime.profession.core.availableFlips[THIEF.SHADOW_SWAP]))],
          [1.2, (runtime) => windows.push(Boolean(runtime.profession.core.availableFlips[THIEF.SHADOW_SWAP]))]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(windows, [!cancelled, false]);
  }

  const used = runThief(['Shadow Flare', 'Shadow Swap'], {
    specialization: 'Deadeye',
    selectedSkillIds: [41158]
  });
  assert.deepEqual(used.warnings, []);
  assert.equal(observedRuntime(used).profession.core.availableFlips[THIEF.SHADOW_SWAP], undefined);
});

// Augments sample spheres at commitment, including deployments during the cast and exclusive expiry boundaries.
test('Catalyst augments select their authored buff windows at cast commitment', () => {
  for (const [id, element, kind, sphereId] of [
    [ELEMENTALIST.RELENTLESS_FIRE, 'Fire', 'relentless fire', ELEMENTALIST.DEPLOY_JADE_SPHERE_FIRE],
    [ELEMENTALIST.SHATTERING_ICE, 'Water', 'shattering ice', ELEMENTALIST.DEPLOY_JADE_SPHERE_WATER]
  ]) {
    for (const [expiry, removed, cancelled, deployDuringCast] of [
      [0, false, false],
      [0.2, false, false],
      [1, false, false],
      [10, false, false],
      [10, true, false],
      [10, false, true],
      [0, false, false, true]
    ]) {
      const result = migratedSkillRun(
        elementalistProfession,
        {
          specialization: 'Catalyst',
          selectedSkillIds: [62965, 62698, 62725],
          startAttunement: element,
          selectedTraitIds: [],
          boons: {},
          target: { armor: 2597 }
        },
        [
          { type: 'cast', skillId: id, ...(cancelled ? { interruptAfterMs: 100 } : {}) },
          ...(deployDuringCast ? [{ type: 'cast', skillId: sphereId, concurrentOffsetMs: 200 }] : []),
          { type: 'wait', durationMs: 1000 }
        ],
        {
          catalog: (catalog) =>
            withSkill(catalog, id, {
              castTimeMs: 1000,
              interruptCommitMs: 1000,
              effects: removed
                ? []
                : catalog.skillsById.get(id).effects.map((effect) => ({ ...effect, duration: effect.duration + 1 }))
            }),
          initialize(runtime) {
            catalystState.from(runtime).sphereExpiry[element] = expiry;
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const buffs = result.events.filter((event) => event.type === 'buff' && event.kind === kind);
      assert.equal(buffs.length, removed || cancelled ? 0 : 1);
      if (buffs.length) {
        assert.equal(buffs[0].duration, expiry > 1 || deployDuringCast ? 9 : 6, `${kind}: sphere at commitment`);
        const activation = result.events.find((event) => event.type === 'action' && event.skillId === id);
        assert.equal(buffs[0].at, activation.endsAt);
        assert.equal(buffs[0].activationId, activation.activationId);
      }

      if (kind === 'shattering ice')
        assert.equal(catalystState.from(observedRuntime(result)).shatteringIceUntil > 0, !removed && !cancelled);
    }
  }
});

// Celerity restores ammo and ordinary cooldowns in the selected attunement; boon removal never changes that reset.
test('Elemental Celerity selects weapon targets and independently owns its sphere boons', () => {
  for (const removed of [false, true]) {
    let targets;
    const result = migratedSkillRun(
      elementalistProfession,
      {
        specialization: 'Catalyst',
        startAttunement: 'Fire',
        selectedSkillIds: [62725],
        selectedTraitIds: [],
        boons: {},
        target: { armor: 2597 }
      },
      ['Elemental Celerity'],
      {
        catalog: (catalog) =>
          removed ? withSkill(catalog, ELEMENTALIST.ELEMENTAL_CELERITY, { effects: [] }) : catalog,
        initialize(runtime) {
          targets = runtime.helpers.skills.filter((skill) => skill.type === 'Weapon' && skill.cooldown > 0);
          for (const skill of targets) {
            runtime.cooldownController.startRecharge(skill, 0, 50);
            if (skill.ammo > 0) {
              runtime.cooldownController.ensureAmmo(skill);
              runtime.ammo.get(skill.id).charges = 0;
            }
          }

          Object.assign(catalystState.from(runtime).sphereExpiry, { Fire: 10, Water: 10, Air: 0.1, Earth: 0 });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    for (const skill of targets) {
      if (skill.ammo > 0) {
        assert.equal(runtime.ammo.get(skill.id).charges, skill.attunement === 'Fire' ? skill.ammo : 0);
      } else assert.equal(runtime.cooldowns.has(skill.id), skill.attunement !== 'Fire');
    }

    const boons = result.events.filter(
      (event) => event.type === 'buff' && event.skillId === ELEMENTALIST.ELEMENTAL_CELERITY
    );
    assert.deepEqual(boons.map((event) => event.kind).sort(), removed ? [] : ['might', 'vigor']);
  }
});

// The replacement profile resolves only after a landed strike and remains removable independently of clone gains.
test('Ether Clone uses a live condition profile at the clone cap and grants nothing on a missed hit', () => {
  for (const [initialResource, offTarget, removed] of [
    [3, false, false],
    [3, false, true],
    [3, true, false],
    [2, true, false]
  ]) {
    const result = migratedSkillRun(
      mesmerProfession,
      {
        specialization: 'Core',
        primaryWeapon: 'Scepter',
        initialResource,
        selectedTraitIds: [],
        boons: {},
        target: { armor: 2597 }
      },
      ['Ether Bolt', 'Ether Blast', { type: 'cast', skillId: MESMER.ETHER_CLONE, offTarget }],
      {
        catalog: (catalog) =>
          withProfile(catalog, MESMER_PROFILE.etherClone, {
            effects: removed ? [] : [{ type: 'condition', condition: 'Torment', duration: 2, stacks: 2 }]
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.resource, initialResource);
    const conditions = result.events.filter(
      (event) => event.type === 'condition' && event.skillId === MESMER.ETHER_CLONE
    );
    assert.equal(conditions.length, removed || offTarget ? 0 : 1);
    if (conditions.length) {
      assert.equal(conditions[0].duration, 2);
      assert.equal(conditions[0].stacks, 2);
      assert.equal(conditions[0].sourceId, MESMER.ETHER_CLONE);
    }
  }
});
