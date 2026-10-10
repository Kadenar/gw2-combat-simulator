import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { mechanistCombatReady } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';

const cast = (name) => ({ type: 'cast', skillId: engineerCatalog.skillsByName.get(name).id });
const cause = (at, extra = {}) => ({
  at,
  source: 'Fixture',
  sourceId: 'fixture',
  skillName: 'Fixture',
  actorType: 'player',
  ...extra
});
const buff = (at, kind, stacks = 1, duration = 3) => cause(at, { type: 'buff', kind, stacks, duration });
const rewards = (result, id) => result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === id);

/** Exercise selected producers and admitted work through native services with independent trigger registration. */
function run(specialization, { traitTriggers = true, duration = 4, rotation, ...config } = {}, options = {}) {
  const result = runEngineer(
    rotation ?? [{ type: 'combat-start' }, { type: 'wait', durationMs: duration * 1000 }],
    { specialization, ...config },
    { ...options, profession: { runtimeFor: (config) => engineerProfession.runtimeFor(config, { traitTriggers }) } }
  );
  assert.deepEqual(result.warnings, []);
  return { result, runtime: observedRuntime(result) };
}

const emitAt = (event) => ({ at: event.at, run: (runtime) => runtime.effects.emit({ kind: 'packet', event }) });

test('Core accepted conditions isolate Firearms rewards and retain non-summon eligibility', () => {
  const traits = [TRAIT.THERMAL_VISION, TRAIT.SANGUINE_ARRAY, TRAIT.HEMATIC_FOCUS];
  for (const selected of [false, true])
    for (const traitTriggers of [false, true])
      for (const actorType of ['player', 'effect', 'summon']) {
        const { result, runtime } = run(
          'Core',
          { traitTriggers, selectedTraitIds: selected ? traits : [] },
          {
            timeline: ['Burning', 'Bleeding'].map((condition) =>
              emitAt(cause(1, { type: 'condition', condition, actorType, stacks: 3, duration: 1 }))
            )
          }
        );
        const active = selected && traitTriggers && actorType !== 'summon';
        // The resolver accepts individual condition stacks; Hematic Focus admits only one cooldown-gated reward.
        for (const id of traits)
          assert.equal(rewards(result, id).length, active ? (id === TRAIT.HEMATIC_FOCUS ? 1 : 3) : 0);
        assert.equal(runtime.procs.deadline('hematicFocus'), active ? 9 : 0);
        if (active)
          assert.equal(
            rewards(result, TRAIT.SANGUINE_ARRAY).reduce((total, event) => total + event.stacks, 0),
            3
          );
      }
});

test('Streamlined Kits isolates kit rewards while intrinsic entry and removed-payload claims remain valid', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true])
      for (const removed of [false, true]) {
        const { result, runtime } = run(
          'Core',
          {
            traitTriggers,
            selectedTraitIds: selected ? [TRAIT.STREAMLINED_KITS] : [],
            selectedSkillIds: [ID.GRENADE_KIT],
            rotation: [{ type: 'wait', durationMs: 1000 }, cast('Grenade Kit'), { type: 'wait', durationMs: 1000 }]
          },
          {
            catalog: (catalog) =>
              removed
                ? withProfile(catalog, TRAIT.STREAMLINED_KITS, {
                    effects: [],
                    removedEffectKeys: ['boon:swiftness', 'strike:Streamlined Kits']
                  })
                : catalog
          }
        );
        const active = selected && traitTriggers;
        assert.equal(runtime.profession.core.activeKit, ID.GRENADE_KIT);
        assert.equal(runtime.procs.deadline('streamlinedKits'), active ? 21 : 0);
        assert.equal(rewards(result, TRAIT.STREAMLINED_KITS).length, Number(active && !removed));
        assert.equal(
          result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Drop Mine'),
          active && !removed
        );
      }
});

test('HGH isolates extra Acid Bomb damage and boons while preserving its selected duration policy', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { result } = run(
        'Core',
        {
          traitTriggers,
          selectedTraitIds: selected ? [TRAIT.HGH] : [],
          selectedSkillIds: [ID.ELIXIR_GUN],
          rotation: [cast('Elixir Gun'), cast('Acid Bomb'), { type: 'wait', durationMs: 7000 }]
        },
        {
          // Remove the native damage to isolate the trait-owned strike, while retaining the skill's field.
          catalog: (catalog) => withSkill(catalog, ID.ACID_BOMB, { effects: [] })
        }
      );
      const active = selected && traitTriggers;
      assert.equal(
        result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.ACID_BOMB).length,
        Number(active)
      );
      assert.equal(rewards(result, TRAIT.HGH).length > 0, active);
      const field = result.events.find((event) => event.type === 'combo_field' && event.skillId === ID.ACID_BOMB);
      assert.ok(field);
      assert.equal(field.expiresAt - field.at, selected ? 6 : 5);
    }
});

test('Mercurial Tendencies admits only selected non-summon recharge reductions and claims no idle cooldown', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true])
      for (const actorType of ['player', 'effect', 'summon']) {
        const active = selected && traitTriggers && actorType !== 'summon';
        run(
          'Amalgam',
          { traitTriggers, selectedTraitIds: selected ? [TRAIT.MERCURIAL_TENDENCIES] : [] },
          {
            timeline: [
              {
                at: 1,
                run(runtime) {
                  const react = (at) =>
                    runtime.mechanics.combat.react('control.resolved', cause(at, { type: 'control', actorType }));
                  react(1);
                  assert.equal(
                    runtime.procs.deadline('mercurialTendencies'),
                    0,
                    'no-op reductions cannot consume the interval'
                  );
                  const evolve = runtime.helpers.skillsById.get(ID.EVOLVE_BASE);
                  runtime.cooldownController.startRecharge(evolve, 1, 10);
                  const before = runtime.cooldownController.readyAt(evolve.id);
                  const rate = runtime.cooldownController.rate(evolve, 1);
                  react(1);
                  assert.equal(runtime.cooldownController.readyAt(evolve.id), before - (active ? 2.5 / rate : 0));
                  assert.equal(runtime.procs.deadline('mercurialTendencies'), active ? 1.24 : 0);
                  react(1.24);
                  assert.equal(runtime.cooldownController.readyAt(evolve.id), before - (active ? 2.5 / rate : 0));
                }
              }
            ]
          }
        );
      }
});

test('Double Helix identity, ammo and Evolved lifetime remain available with trait producers disabled', () => {
  for (const traitTriggers of [false, true]) {
    const { result, runtime } = run(
      'Amalgam',
      {
        traitTriggers,
        selectedTraitIds: [TRAIT.DOUBLE_HELIX],
        selectedMorphSkillIds: [],
        rotation: [
          { type: 'cast', skillId: ID.EVOLVE_BASE },
          { type: 'wait', durationMs: 10000 }
        ]
      },
      { probes: [[1, (runtime) => assert.ok(amalgamState.from(runtime).evolvedUntil > runtime.time)]] }
    );
    assert.equal(result.steps.find((step) => step.skillId != null).skillId, ID.EVOLVE_DOUBLE_HELIX);
    assert.equal(runtime.cooldownController.readAmmo(ID.EVOLVE_DOUBLE_HELIX).maximum, 2);
    assert.ok(amalgamState.from(runtime).evolvedUntil < runtime.time);
  }
});

test('Barrier Engine admits one selected loop at implicit or deferred explicit combat entry', () => {
  for (const explicit of [false, true])
    for (const selected of [false, true])
      for (const traitTriggers of [false, true]) {
        const start = explicit ? 2 : 0;
        const { result, runtime } = run(
          'Mechanist',
          {
            traitTriggers,
            selectedTraitIds: selected ? [TRAIT.MECH_CORE_BARRIER_ENGINE] : [],
            allies: { count: 4 },
            rotation: [
              ...(explicit ? [{ type: 'wait', durationMs: 2000 }, { type: 'combat-start' }] : []),
              { type: 'wait', durationMs: 7000 }
            ]
          },
          { timeline: [{ at: start + 1, run: (runtime) => runtime.fireTrigger(mechanistCombatReady, {}) }] }
        );
        const active = selected && traitTriggers;
        const barriers = rewards(result, TRAIT.MECH_CORE_BARRIER_ENGINE);
        assert.equal(mechanistState.from(runtime).barrierEngineStarted, active);
        assert.equal(barriers.length > 0, active);
        if (active) {
          assert.equal(barriers[0].at, start + 3, 'startup owns the first grant relative to combat admission');
          assert.equal(
            new Set(barriers.map((event) => event.at)).size,
            barriers.length,
            'repeated startup must not duplicate a loop'
          );
          for (const event of barriers) {
            assert.equal(event.summonOwner, 'engineer.mech');
            assert.equal(event.resolvedAudience.recipientCount, 5);
          }
        }

        assert.ok(
          result.resolvedEvents.some((event) => event.type === 'damage' && event.summonOwner === 'engineer.mech'),
          'intrinsic mech attacks remain available without trait producers'
        );
      }
});

test('An admitted barrier task runs under isolation and stops when the mech becomes inactive', () => {
  const { result, runtime } = run(
    'Mechanist',
    {
      traitTriggers: false,
      duration: 8,
      selectedTraitIds: [TRAIT.MECH_CORE_BARRIER_ENGINE, TRAIT.MECH_FRAME_CHANNELING_CONDUITS]
    },
    {
      initialize: (runtime) => runtime.schedule('engineer.barrier-engine', 1),
      timeline: [
        {
          at: 3.5,
          run(runtime) {
            mechanistState.from(runtime).mech.active = false;
          }
        }
      ]
    }
  );
  assert.equal(mechanistState.from(runtime).barrierEngineStarted, false);
  assert.deepEqual(
    rewards(result, TRAIT.MECH_CORE_BARRIER_ENGINE).map((event) => event.at),
    [1]
  );
  assert.deepEqual(rewards(result, TRAIT.MECH_FRAME_CHANNELING_CONDUITS), []);
});

test('Channeling Conduits isolates recipient cooldown claims while explicit barrier still applies', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { result, runtime } = run(
        'Mechanist',
        {
          traitTriggers,
          selectedTraitIds: selected ? [TRAIT.MECH_FRAME_CHANNELING_CONDUITS] : []
        },
        { timeline: [emitAt(buff(1, 'barrier')), emitAt(buff(1.5, 'barrier')), emitAt(buff(2, 'barrier'))] }
      );
      assert.equal(
        result.resolvedEvents.filter((event) => event.kind === 'barrier' && event.sourceId === 'fixture').length,
        3
      );
      assert.deepEqual(
        rewards(result, TRAIT.MECH_FRAME_CHANNELING_CONDUITS).map((event) => event.at),
        selected && traitTriggers ? [1, 2] : []
      );
      assert.equal(
        runtime.procs.deadline(`${TRAIT.MECH_FRAME_CHANNELING_CONDUITS}:self`),
        selected && traitTriggers ? 3 : 0
      );
    }
});

test('Holosmith dodge admits Vigor and vent together while PBM preserves heat independently', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true])
      for (const pbm of [false, true]) {
        const { result } = run('Holosmith', {
          traitTriggers,
          initialHeat: 50,
          selectedTraitIds: [
            ...(selected ? [TRAIT.THERMAL_RELEASE_VALVE] : []),
            ...(pbm ? [TRAIT.PHOTONIC_BLASTING_MODULE] : [])
          ],
          rotation: [cast('Dodge')]
        });
        const active = selected && traitTriggers;
        assert.equal(rewards(result, TRAIT.THERMAL_RELEASE_VALVE).length, Number(active));
        assert.equal(
          result.events.some((event) => event.type === 'damage' && event.skillId === ID.VENT_EXHAUST),
          active && !pbm
        );
        assert.equal(result.planningState.profession.heat.value, active && !pbm ? 35 : 50);
      }
});

test('Forge stays intrinsic while new Lens grants and enhanced-capacity renewal obey isolation', () => {
  for (const traitTriggers of [false, true]) {
    const { result, runtime } = run('Holosmith', {
      traitTriggers,
      initialHeat: 110,
      selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
      rotation: [cast('Engage Photon Forge'), { type: 'wait', durationMs: 1000 }]
    });
    const state = holosmithState.from(runtime);
    assert.equal(state.photonForgeActive, true);
    assert.equal(state.heat.maximum, 150);
    assert.ok(state.heat.value > 110);
    assert.equal(
      result.events.some((event) => event.type === 'engineer.solar-focusing-lens'),
      traitTriggers
    );
    assert.equal(rewards(result, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT).length > 0, traitTriggers);
  }
});

test('Explicit Solar Focusing Lens charges resolve and expire while new trait producers are disabled', () => {
  const { result, runtime } = run(
    'Holosmith',
    {
      traitTriggers: false,
      selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS],
      duration: 4
    },
    {
      timeline: [
        emitAt(cause(1, { type: 'engineer.solar-focusing-lens', stacks: 2, duration: 1 })),
        ...[1.1, 1.2, 1.3].map((at) =>
          emitAt(cause(at, { type: 'damage', coefficient: 1, skillWeapon: 'Unequipped' }))
        ),
        emitAt(cause(2, { type: 'engineer.solar-focusing-lens', stacks: 1, duration: 1 })),
        emitAt(cause(3.1, { type: 'damage', coefficient: 1, skillWeapon: 'Unequipped' }))
      ]
    }
  );
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === 'fixture');
  assert.deepEqual(
    strikes.map((event) => Boolean(event.solarFocusingLens)),
    [true, true, false, false]
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.SOLAR_FOCUSING_LENS)
      .length,
    2
  );
  assert.ok(holosmithState.from(runtime).solarFocusingLens.expiresAt < runtime.time);
});

test('Scrapper threshold rewards and Stability renewal obey selection and isolation', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { result, runtime } = run(
        'Scrapper',
        {
          traitTriggers,
          selectedTraitIds: selected ? [TRAIT.APPLIED_FORCE, TRAIT.MASS_MOMENTUM] : []
        },
        { timeline: [emitAt(buff(1, 'might', 9)), emitAt(buff(2, 'might', 1))] }
      );
      const active = selected && traitTriggers;
      assert.equal(rewards(result, TRAIT.APPLIED_FORCE).length, Number(active));
      assert.equal(runtime.procs.deadline('appliedForce'), active ? 12 : 0);
      assert.equal(
        rewards(result, TRAIT.MASS_MOMENTUM).some((event) => event.kind === 'might'),
        active
      );
      if (active) {
        const stability = rewards(result, TRAIT.APPLIED_FORCE)[0];
        const might = rewards(result, TRAIT.MASS_MOMENTUM)[0];
        assert.ok(result.resolvedEvents.indexOf(stability) < result.resolvedEvents.indexOf(might));
        assert.equal(might.at, 2);
      }
    }
});

test('Scrapper admitted Mass Momentum survives isolation and stops when Stability expires', () => {
  const { result, runtime } = run(
    'Scrapper',
    {
      traitTriggers: false,
      selectedTraitIds: [TRAIT.MASS_MOMENTUM],
      duration: 5
    },
    {
      timeline: [
        emitAt(buff(1, 'stability', 1, 2)),
        {
          at: 1.5,
          run(runtime) {
            scrapperState.from(runtime).massMomentumAt = 2;
            runtime.schedule('engineer.mass-momentum', 2, cause(1, { type: 'buff', kind: 'stability' }));
          }
        }
      ]
    }
  );
  const might = rewards(result, TRAIT.MASS_MOMENTUM);
  assert.equal(might.length, 1);
  assert.equal(might[0].at, 2);
  assert.equal(scrapperState.from(runtime).massMomentumAt, Infinity);
});

test('Kinetic Accelerators isolates the selected Function Gyro finisher and accepted combo rewards', () => {
  for (const traitTriggers of [false, true]) {
    const { result } = run('Scrapper', {
      traitTriggers,
      selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
      selectedSkillIds: [engineerCatalog.skillsByName.get('Medic Gyro').id],
      rotation: [cast('Medic Gyro'), cast('Function Gyro'), { type: 'wait', durationMs: 1000 }]
    });
    assert.equal(
      result.events.some((event) => event.type === 'combo' && event.skillId === ID.FUNCTION_GYRO),
      traitTriggers
    );
    assert.equal(rewards(result, TRAIT.KINETIC_ACCELERATORS).length, traitTriggers ? 2 : 0);
  }

  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { result, runtime } = run(
        'Scrapper',
        {
          traitTriggers,
          selectedTraitIds: selected ? [TRAIT.KINETIC_ACCELERATORS] : []
        },
        {
          timeline: [
            {
              at: 1,
              run(runtime) {
                runtime.mechanics.combat.react('combo.resolved', cause(1, { type: 'combo', finisherType: 'Whirl' }));
              }
            }
          ]
        }
      );
      assert.equal(rewards(result, TRAIT.KINETIC_ACCELERATORS).length, selected && traitTriggers ? 2 : 0);
      assert.equal(
        runtime.procs.deadline('engineer.scrapper.kineticAcceleratorsWhirl'),
        selected && traitTriggers ? 4 : 0
      );
    }
});
