import assert from 'node:assert/strict';
import { test } from 'node:test';

import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { createEngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { createHolosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { holosmithTraits } from '#gw2/professions/engineer/specializations/holosmith/traits/index.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const baseConfig = Object.freeze({
  selectedSkillIds: [5857, 5805, 6161, 5933, 5868],
  selectedMorphSkillIds: [77103, 77203, 76954],
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createObservedProfessionSimulator(engineerProfession, baseConfig);

// Heat-scaled Quickness must retain a repeatable source without changing ordinary generation totals.
test('Radiant Arc supplies attributed sustained Quickness from repeated impacts', () => {
  const result = simulate(
    'Holosmith',
    [
      { type: 'combat-start' },
      ...[0, 1, 2].flatMap(() => [
        { type: 'cast', skillId: ID.RADIANT_ARC },
        { type: 'wait', durationMs: 20000 }
      ])
    ],
    { primaryWeapon: 'Sword', selectedTraitIds: [], boons: {} }
  );
  assert.deepEqual(result.warnings, []);
  const grants = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === ID.RADIANT_ARC && event.kind === 'quickness'
  );
  const estimate = result.boonGeneration.sustained.quickness.self;
  const priorYield = grants.slice(0, -1).reduce((sum, event) => sum + event.duration, 0);
  assert.equal(estimate.status, 'available');
  assert.ok(Math.abs(estimate.percent - (priorYield / (grants.at(-1).at - grants[0].at)) * 100) < 1e-9);
  assert.ok(grants.every((event) => event.boonGeneration));
  assert.equal(
    result.boonGeneration.boons.quickness.self.generatedStackSeconds,
    grants.reduce((sum, event) => sum + event.duration, 0)
  );
  assert.equal(result.boonGeneration.sustained.quickness.ally.percent, 0);
});

// Photon Projector owns intrinsic heat scaling even when an isolated run supplies no selected trait IDs.
test('Photon Projector scales condition base duration independently of ordinary duration bonuses', () => {
  const native = engineerProfession.runtimeFor({ specialization: 'Holosmith', selectedTraitIds: [] });
  for (const [factor, expected] of [
    [undefined, 1],
    [0.5, 0.5],
    [1.5, 1.5],
    [0, 0],
    [-1, 0]
  ]) {
    const context = {
      time: 0,
      config: { selectedTraitIds: [] },
      event: { metadata: factor === undefined ? undefined : { holosmithConditionBaseDurationFactor: factor } }
    };
    assert.equal(
      native.calculations.modifyConditionBaseDuration({ ...context, catalog: native.catalog }, 2),
      2 * expected
    );
    assert.equal(native.calculations.modifyConditionDuration({ ...context, catalog: native.catalog }, 2), 2);
  }
});

// Defensive self-burning must never enter the outgoing condition pipeline.
test('Cauterize deals no outgoing damage on a clean target', () => {
  const result = simulate('Holosmith', ['Cauterize', { type: 'wait', durationMs: 3000 }], {
    selectedSkillIds: [40507],
    target: { conditions: {} }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.totalDamage, 0);
});

// Exercise the guaranteed-critical contract below the crit cap and the finisher in a live field.
test('Holographic Shockwave guarantees a critical hit and blasts a fire field', () => {
  const result = simulate(
    'Holosmith',
    ['Bomb Kit', 'Fire Bomb', 'Engage Photon Forge', { type: 'wait', durationMs: 1000 }, 'Holographic Shockwave'],
    { selectedSkillIds: [5812], attributeInputs: baseAttributeInputs({ precision: 1000, ferocity: 0 }) }
  );
  assert.deepEqual(result.warnings, []);
  const strike = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Holographic Shockwave'
  );
  assert.equal(strike.criticalChance, 1);
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.type === 'combo' &&
        event.skillName === 'Holographic Shockwave' &&
        event.finisherType === 'Blast' &&
        event.fieldType === 'Fire'
    )
  );
});

// Delayed packets cannot reserve charges ahead of earlier impacts or refill them through heat snapshots.
test('Solar Focusing Lens enhances the earliest two interleaved impacts', () => {
  const result = simulate(
    'Holosmith',
    ['Engage Photon Forge', 'Corona Burst', 'Light Strike', { type: 'wait', durationMs: 2000 }],
    { selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS] }
  );
  assert.deepEqual(result.warnings, []);
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage');
  assert.deepEqual(
    strikes.map((event) => [event.skillName, Boolean(event.solarFocusingLens)]),
    [
      ['Corona Burst', true],
      ['Light Strike', true],
      ['Corona Burst', false]
    ]
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.name === 'Solar Focusing Lens - Burning' && event.type === 'condition')
      .map((event) => event.at),
    strikes.slice(0, 2).map((event) => event.at)
  );
  assert.equal(observedRuntime(result).profession.specialization.state.solarFocusingLens.count, 0);
});

// Resolver-created strikes share the same charge budget as ordinary scheduled attacks.
test('Solar Focusing Lens consumes charges on Laser Disk impacts', () => {
  const result = simulate('Holosmith', ['Engage Photon Forge', 'Laser Disk', { type: 'wait', durationMs: 2000 }], {
    selectedSkillIds: [42842],
    selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS]
  });
  assert.deepEqual(result.warnings, []);
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage');
  assert.ok(strikes.length > 2);
  assert.ok(strikes.slice(0, 2).every((event) => event.solarFocusingLens));
  assert.ok(strikes.slice(2).every((event) => !event.solarFocusingLens));
  assert.equal(observedRuntime(result).profession.specialization.state.solarFocusingLens.count, 0);
});

// Expired grants cannot enhance hits, while leaving Forge starts a fresh charge window.
test('Solar Focusing Lens respects expiry and refreshes on Forge exit', () => {
  const config = { selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS] };
  const expired = simulate(
    'Holosmith',
    ['Engage Photon Forge', { type: 'wait', durationMs: 5000 }, 'Light Strike'],
    config
  );
  assert.deepEqual(expired.warnings, []);
  assert.ok(
    expired.resolvedEvents.filter((event) => event.type === 'damage').every((event) => !event.solarFocusingLens)
  );
  const refreshed = simulate(
    'Holosmith',
    [
      'Engage Photon Forge',
      'Light Strike',
      'Bright Slash',
      'Deactivate Photon Forge',
      { type: 'cast', skillId: 43476 }
    ],
    config
  );
  assert.deepEqual(refreshed.warnings, []);
  assert.ok(
    refreshed.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Sun Edge')
      .solarFocusingLens
  );
  assert.equal(observedRuntime(refreshed).profession.specialization.state.solarFocusingLens.count, 1);
});

test('ECSU carries pulse readiness, resets at the threshold, and restarts on a discrete crossing', () => {
  const result = runEngineer(
    [{ type: 'wait', durationMs: 3200 }],
    {
      specialization: 'Holosmith',
      initialHeat: 101,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
    },
    {
      initialize(runtime) {
        runtime.schedule('test.threshold', 1.5);
        runtime.schedule('test.cross', 2.1);
      },
      extend(native) {
        return {
          tasks: {
            ...native.tasks,
            'test.threshold'(runtime) {
              runtime.resourceController.replace('heat', 100);
            },
            'test.cross'(runtime) {
              runtime.profession.specialization.state.photonForgeActive = true;
              runtime.schedule('engineer.photon-forge-heat', runtime.time, { amount: 1 });
            }
          }
        };
      }
    }
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'buff' && event.sourceId === TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
      .map((event) => event.at),
    [0, 1, 2.12, 3.12]
  );
});

test('ECSU emits a due boundary pulse before same-time cooling drops heat to the threshold', () => {
  // Cooling reaches 100 at four seconds; that boundary still belongs to the preceding high-heat interval.
  const result = simulate('Holosmith', [{ type: 'wait', durationMs: 5000 }], {
    initialHeat: 105,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });
  const pulses = result.events.filter(
    (event) => event.type === 'buff' && event.sourceId === TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT
  );
  assert.ok(pulses.some((event) => event.at === 4));
  assert.ok(pulses.every((event) => event.at <= 4));
});

test('Photon Forge heat generation and cooling use current piecewise rates', () => {
  const beforeFirstTick = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 80 }]);
  const firstTick = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 100 }]);

  // Forge heat is discrete: no passive gain occurs before the 120 ms delivery, then the base rate contributes 0.2%.
  assert.equal(beforeFirstTick.planningState.profession[STATE.HEAT].value, 0);
  assert.equal(firstTick.planningState.profession[STATE.HEAT].value, 0.2);

  const preheatedGrace = simulate('Holosmith', [{ type: 'wait', durationMs: 3000 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(preheatedGrace.planningState.profession[STATE.HEAT].value, 100);

  const firstCoolingTick = simulate('Holosmith', [{ type: 'wait', durationMs: 3100 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  // The first cooling tick after the three-second delay loses 0.5 heat.
  assert.equal(firstCoolingTick.planningState.profession[STATE.HEAT].value, 99.5);

  const preheatedCooling = simulate('Holosmith', [{ type: 'wait', durationMs: 5200 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(preheatedCooling.planningState.profession[STATE.HEAT].value, 89);

  const beforeFastCooling = simulate('Holosmith', [{ type: 'wait', durationMs: 8000 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(beforeFastCooling.planningState.profession[STATE.HEAT].value, 75);

  const firstFastCoolingTick = simulate('Holosmith', [{ type: 'wait', durationMs: 8100 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  // After eight seconds, the fast phase loses 1 heat on each 100 ms tick.
  assert.equal(firstFastCoolingTick.planningState.profession[STATE.HEAT].value, 74);

  const hot = simulate('Holosmith', [
    'Engage Photon Forge',
    { type: 'wait', durationMs: 5000 },
    'Deactivate Photon Forge',
    { type: 'wait', durationMs: 3100 }
  ]);

  assert.equal(hot.planningState.profession[STATE.HEAT].value, 9.5);
  assert.equal(hot.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], false);

  const cooled = simulate('Holosmith', [
    'Engage Photon Forge',
    { type: 'wait', durationMs: 5000 },
    'Deactivate Photon Forge',
    { type: 'wait', durationMs: 11500 }
  ]);

  assert.equal(cooled.planningState.profession[STATE.HEAT].value, 0);

  const amplified = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 100 }], {
    selectedTraitIds: [TRAIT.LIGHT_DENSITY_AMPLIFIER]
  });

  assert.equal(amplified.planningState.profession[STATE.HEAT].value, 0.3);
});

test('Corona Burst heat persists outside Forge without causing Overheat', () => {
  const outside = simulate(
    'Holosmith',
    [
      'Engage Photon Forge',
      { type: 'wait', durationMs: 5500 },
      'Corona Burst',
      'Deactivate Photon Forge',
      { type: 'wait', durationMs: 3000 }
    ],
    {
      initialHeat: 135,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
    }
  );

  assert.ok(outside.events.some((event) => event.type === 'engineer.heat' && Number(event.heat || 0) >= 150 - 1e-9));
  assert.ok(outside.planningState.profession[STATE.HEAT].value <= 150);
  assert.equal(outside.planningState.profession[STATE.OVERHEATED], false);
  assert.equal(outside.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], false);

  const inside = simulate('Holosmith', ['Engage Photon Forge', 'Corona Burst', { type: 'wait', durationMs: 2000 }], {
    initialHeat: 145,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(inside.planningState.profession[STATE.HEAT].value, 150);
  assert.equal(inside.planningState.profession[STATE.OVERHEATED], true);
  assert.equal(inside.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], true);
});

test('cancelled Light Strike leaves the Photon Forge chain ready for the next Light Strike', () => {
  const result = simulate('Holosmith', [
    'Engage Photon Forge',
    { name: 'Light Strike', skillId: ID.LIGHT_STRIKE, interruptMs: 80 },
    'Light Strike'
  ]);
  const lightStrikeSteps = result.steps.filter((step) => step.skillName === 'Light Strike');
  const lightStrikePackets = result.events.filter((event) => event.type === 'damage' && event.name === 'Light Strike');

  assert.equal(result.warnings.length, 0);
  assert.equal(lightStrikeSteps.length, 2);
  assert.equal(lightStrikeSteps[0].interrupted, true);
  assert.ok(lightStrikeSteps.every((step) => step.invalid !== true));
  assert.equal(lightStrikePackets.length, 1);
  assert.equal(result.planningState.profession[STATE.AUTOATTACK_CHAINS][ID.LIGHT_STRIKE], ID.BRIGHT_SLASH);
});

test('Photon Forge overheats at its trait-adjusted maximum', () => {
  const core = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 6000 }], {
    initialHeat: 90
  });

  assert.equal(core.planningState.profession[STATE.HEAT].value, 100);
  assert.equal(core.planningState.profession[STATE.OVERHEATED], true);
  assert.equal(core.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], true);

  const enhanced = simulate('Holosmith', [], {
    initialHeat: 149,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(enhanced.planningState.profession[STATE.HEAT].maximum, 150);
  assert.equal(enhanced.planningState.profession[STATE.HEAT].value, 149);

  const fullyCooled = simulate(
    'Holosmith',
    [
      'Engage Photon Forge',
      { type: 'wait', durationMs: 6000 },
      'Deactivate Photon Forge',
      { type: 'wait', durationMs: 15520 }
    ],
    {
      initialHeat: 90
    }
  );

  assert.equal(fullyCooled.planningState.profession[STATE.HEAT].value, 0);
  assert.equal(fullyCooled.planningState.profession[STATE.OVERHEATED], false);
});

test('ordinary Forge exits preserve one bar swap and their trait event ordering', () => {
  // Kit swaps and Core reactions precede Forge exit; explicit exits grant Lens before their swap.
  for (const exit of ['Deactivate Photon Forge', 'Grenade Kit']) {
    const result = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 6000 }, exit], {
      selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS, TRAIT.STREAMLINED_KITS]
    });
    assert.deepEqual(result.warnings, []);
    const exitEvent = result.events.find((event) => event.type === 'engineer.heat' && event.reason === 'exit-forge');
    assert.ok(exitEvent);
    const state = result.planningState.profession;
    assert.equal(state[STATE.PHOTON_FORGE_ACTIVE], false);
    assert.equal(state[STATE.FORGE_EXITED_AT], exitEvent.at);
    assert.equal(state[STATE.OVERHEATED], false);
    assert.equal(state[STATE.ACTIVE_KIT], exit === 'Grenade Kit' ? ID.GRENADE_KIT : null);
    const exitEvents = result.events.filter(
      (event) =>
        event.at === exitEvent.at &&
        (event.type === 'engineer.solar-focusing-lens' ||
          event.type === 'sigil_swap' ||
          (event.type === 'buff' && event.sourceId === TRAIT.STREAMLINED_KITS) ||
          event === exitEvent)
    );
    assert.deepEqual(
      exitEvents.map((event) => event.type),
      exit === 'Grenade Kit'
        ? ['sigil_swap', 'buff', 'engineer.solar-focusing-lens', 'engineer.heat']
        : ['engineer.solar-focusing-lens', 'sigil_swap', 'engineer.heat']
    );
  }
});

test('explicit Overheat exits preserve cooling cadence and the pending Lens grant', () => {
  // Both exits acknowledge the existing resource transition without restarting cooling or granting Lens twice.
  const config = { initialHeat: 90, selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE, TRAIT.SOLAR_FOCUSING_LENS] };
  const opener = ['Engage Photon Forge', { type: 'wait', durationMs: 6000 }];
  const locked = simulate('Holosmith', [...opener, { type: 'wait', durationMs: 4000 }], config);
  for (const exit of ['Deactivate Photon Forge', 'Grenade Kit']) {
    const exited = simulate('Holosmith', [...opener, exit, { type: 'wait', durationMs: 4000 }], config);
    assert.deepEqual(exited.warnings, []);
    assert.equal(exited.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], false);
    assert.equal(
      exited.planningState.profession[STATE.FORGE_EXITED_AT],
      locked.planningState.profession[STATE.FORGE_EXITED_AT]
    );
    assert.equal(exited.planningState.profession[STATE.HEAT].value, locked.planningState.profession[STATE.HEAT].value);
    assert.deepEqual(
      exited.events
        .filter((event) => event.type === 'engineer.solar-focusing-lens')
        .map((event) => [event.at, event.stacks]),
      locked.events
        .filter((event) => event.type === 'engineer.solar-focusing-lens')
        .map((event) => [event.at, event.stacks])
    );
  }

  const cooled = simulate('Holosmith', [...opener, { type: 'wait', durationMs: 20000 }, 'Photon Blitz'], config);
  assert.equal(cooled.planningState.profession[STATE.HEAT].value, 0);
  assert.ok(cooled.steps.find((step) => step.skillName === 'Photon Blitz').invalid);
});

test('Photon Forge waits for its resource tick before overheating at maximum heat', () => {
  // A skill can fill the heat bar between resource ticks, leaving a short window
  // for an already-authored tool-belt action before Overheat applies its cooldown.
  const result = simulate(
    'Holosmith',
    ['Engage Photon Forge', 'Holographic Shockwave', 'Grenade Barrage', { type: 'wait', durationMs: 1000 }],
    {
      initialHeat: 88.6,
      selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE]
    }
  );
  const barrage = result.steps.find((step) => step.skillName === 'Grenade Barrage');
  const overheat = result.events.find((event) => event.type === 'engineer.heat' && event.reason === 'overheat');

  assert.equal(result.warnings.length, 0);
  assert.equal(barrage.start, 520);
  assert.equal(overheat.at, 0.52);
  assert.equal(result.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], true);
});

test('Photon Forge starts a fresh Overheat cadence on each entry', () => {
  // Re-entry owns the heat cadence; reaching capacity leaves the current tick available for a toolbelt action.
  const result = simulate(
    'Holosmith',
    [
      { type: 'wait', durationMs: 250 },
      'Engage Photon Forge',
      'Deactivate Photon Forge',
      { type: 'wait', durationMs: 1200 },
      'Engage Photon Forge',
      'Holographic Shockwave',
      'Grenade Barrage'
    ],
    {
      initialHeat: 90,
      selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE]
    }
  );
  const barrage = result.steps.find((step) => step.skillName === 'Grenade Barrage');
  const overheat = result.events.find((event) => event.type === 'engineer.heat' && event.reason === 'overheat');

  assert.equal(result.warnings.length, 0);
  assert.ok(barrage.start / 1000 <= overheat.at);
  const entry = result.events
    .filter((event) => event.type === 'action' && event.skillName === 'Engage Photon Forge')
    .at(-1);
  assert.equal(Number((overheat.at - entry.at).toFixed(6)), 0.52);
  assert.equal(result.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], true);
});

test('Photon Forge waits one more resource tick when passive heat fills the bar', () => {
  // Ten ticks raise heat from 98 to 100; the following 100 ms tick observes the cap and overheats.
  const result = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 2000 }], {
    initialHeat: 98
  });
  const passiveHeat = result.events.find(
    (event) => event.type === 'engineer.heat' && event.reason === 'passive-heat' && event.heat === 100
  );
  const overheat = result.events.find((event) => event.type === 'engineer.heat' && event.reason === 'overheat');

  assert.equal(passiveHeat.at, 1);
  assert.equal(passiveHeat.heat, 100);
  assert.equal(overheat.at, 1.12);
  assert.equal(result.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], true);
});

test('Photon Forge passive heat restarts its cadence on each entry', () => {
  const result = simulate('Holosmith', [
    { type: 'wait', durationMs: 250 },
    'Engage Photon Forge',
    { type: 'wait', durationMs: 150 },
    'Deactivate Photon Forge',
    { type: 'wait', durationMs: 250 },
    'Engage Photon Forge',
    { type: 'wait', durationMs: 100 }
  ]);
  const passiveHeatTimes = result.events
    .filter((event) => event.type === 'engineer.heat' && event.reason === 'passive-heat')
    .map((event) => event.at);

  // Each Forge entry owns a fresh 100 ms passive timer; manual exit invalidates the old timer.
  const entries = result.events.filter((event) => event.type === 'action' && event.skillName === 'Engage Photon Forge');
  assert.deepEqual(
    passiveHeatTimes,
    entries.map((entry) => gw2Time(entry.at + 0.1))
  );
});

test('Overheat blocks Forge and weapon inputs until the rotation exits', () => {
  // Exhaustion is a resource transition; the explicit exit restores weapons without restarting cooling.
  const result = simulate(
    'Holosmith',
    [
      'Engage Photon Forge',
      'Holographic Shockwave',
      { type: 'wait', durationMs: 120 },
      'Photon Blitz',
      'Light Strike',
      'Glue Shot',
      'Deactivate Photon Forge',
      'Glue Shot'
    ],
    { initialHeat: 90 }
  );
  assert.equal(
    result.events.filter((event) => event.type === 'engineer.heat' && event.reason === 'overheat').length,
    1
  );
  for (const name of ['Photon Blitz', 'Light Strike']) {
    assert.ok(result.steps.find((step) => step.skillName === name).invalid);
  }

  const [blocked, ready] = result.steps.filter((step) => step.skillName === 'Glue Shot');
  assert.ok(blocked.invalid);
  assert.equal(ready.invalid, undefined);
  assert.equal(result.steps.find((step) => step.skillName === 'Deactivate Photon Forge').invalid, undefined);
  assert.equal(result.planningState.profession[STATE.PHOTON_FORGE_ACTIVE], false);
});

test('an overheated Forge lane stays open until its authored exit', () => {
  const rotation = [
    'Engage Photon Forge',
    { type: 'wait', durationMs: 6000 },
    'Deactivate Photon Forge',
    'Blunderbuss'
  ];
  const result = simulate('Holosmith', rotation, { initialHeat: 90 });
  const transition = engineerProfession.ui.timelineWeaponLineTransition;
  const rows = timelineWeaponRows(rotation, {
    isWeaponSwap: () => false,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;
      return transition({
        entry: { name },
        skill: engineerCatalog.skills.find((candidate) => candidate.name === name),
        specialization: 'Holosmith',
        ...current
      });
    }
  });
  assert.deepEqual(result.warnings, []);
  // Row boundaries follow actual transformations while command order stays intact.
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0], [1, 2], [3]]
  );
});

test('Overheat delays its tool-belt minimum cooldown until the damage effect', () => {
  // The delayed damage applies the minimum cooldown after the resource transition starts Overheat.
  const timing = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 6700 }], {
    initialHeat: 90,
    selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE]
  });
  const overheat = timing.events.find((event) => event.type === 'engineer.heat' && event.reason === 'overheat');
  const damageEffect = timing.events.find(
    (event) => event.type === 'damage' && event.name === 'Photonic Blasting Module'
  );

  assert.equal(overheat.at, 5.12);
  assert.ok(damageEffect.at > overheat.at);

  const grenadeBarrageStarts = (rotation, selectedTraitIds = []) => {
    const result = simulate('Holosmith', rotation, {
      initialHeat: 90,
      selectedTraitIds
    });

    assert.equal(result.warnings.length, 0);
    return result.steps.filter((step) => step.skillName === 'Grenade Barrage').map((step) => step.start);
  };

  assert.deepEqual(
    grenadeBarrageStarts(['Engage Photon Forge', { type: 'wait', durationMs: 6640 }, 'Grenade Barrage']),
    [6640]
  );
  assert.deepEqual(
    grenadeBarrageStarts(['Engage Photon Forge', { type: 'wait', durationMs: 6660 }, 'Grenade Barrage']),
    [21680]
  );
  assert.deepEqual(
    grenadeBarrageStarts(
      ['Engage Photon Forge', { type: 'wait', durationMs: 6660 }, 'Grenade Barrage'],
      [TRAIT.PHOTONIC_BLASTING_MODULE]
    ),
    [11680]
  );
  assert.deepEqual(
    grenadeBarrageStarts([
      'Grenade Barrage',
      'Engage Photon Forge',
      { type: 'wait', durationMs: 5000 },
      'Grenade Barrage'
    ]),
    [0, 22360]
  );
});

test('Holosmith offensive traits consume forge heat and attack charges', () => {
  const laserBase = simulate('Holosmith', ['Engage Photon Forge', 'Light Strike'], {
    initialHeat: 50,
    attributeInputs: baseAttributeInputs({ precision: 1000, ferocity: 0 })
  });
  const laser = simulate('Holosmith', ['Engage Photon Forge', 'Light Strike'], {
    initialHeat: 50,
    attributeInputs: baseAttributeInputs({ precision: 1000, ferocity: 0 }),
    selectedTraitIds: [TRAIT.LASERS_EDGE]
  });

  // The 200 ms hit sees the completed 100 ms tick but resolves before the same-time second tick.
  const laserEdgeFactor = 1 + 50.2 * 0.0015;
  assertFlooredDamageMultiplier(laser.strikeDamage, laserBase.strikeDamage, laserEdgeFactor);
  const glassLaser = simulate('Holosmith', ['Engage Photon Forge', 'Light Strike'], {
    initialHeat: 50,
    attributeInputs: baseAttributeInputs({ precision: 1000, ferocity: 0 }),
    selectedTraitIds: [TRAIT.GLASS_CANNON, TRAIT.LASERS_EDGE]
  });

  assertFlooredDamageMultiplier(glassLaser.strikeDamage, laserBase.strikeDamage, 1.07 * laserEdgeFactor);

  const solar = simulate('Holosmith', ['Engage Photon Forge', 'Light Strike', 'Bright Slash'], {
    attributeInputs: baseAttributeInputs({ precision: 1000, ferocity: 0 }),
    selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS]
  });
  const solarStrikes = solar.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.solarFocusingLens === true
  );
  const solarBurns = solar.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name === 'Solar Focusing Lens - Burning'
  );

  assert.equal(solarStrikes.length, 2);
  assert.equal(solarBurns.length, 2);
  assert.ok(solarBurns.every((event) => event.stacks === 1 && event.duration === 3));
  assert.equal(observedRuntime(solar).profession.specialization.state.solarFocusingLens.count, 0);

  const storm = simulate(
    'Holosmith',
    ['Engage Photon Forge', ID.LIGHT_STRIKE_STORM, ID.BRIGHT_SLASH_STORM, ID.FLASH_CUTTER_STORM],
    {
      selectedTraitIds: [TRAIT.CRYSTAL_CONFIGURATION_STORM]
    }
  );

  assert.equal(storm.warnings.length, 0);
  const stormPackets = storm.events.filter((event) => event.type === 'damage' && event.projectile === true);

  assert.deepEqual(
    stormPackets.map((event) => event.coefficient),
    [1, 1, 0.8, 0.8]
  );
  assert.ok(stormPackets.every((event) => event.damageKind === 'explosion'));
});

test('Heat loss triggers Vent Exhaust on dodge and a blast on overheat', () => {
  const vented = simulate('Holosmith', ['Dodge'], {
    initialHeat: 50,
    selectedTraitIds: [TRAIT.THERMAL_RELEASE_VALVE]
  });

  assert.equal(vented.planningState.profession[STATE.HEAT].value, 35);
  // Render the real resource observation through the composed UI so a stale reason cannot hide it.
  const heatEvent = vented.events.find((event) => event.type === 'engineer.heat' && event.reason === 'vent-exhaust');
  assert.ok(heatEvent);
  const heatRow = engineerProfession.ui.eventLogRow({ specialization: 'Holosmith' }, heatEvent);
  assert.equal(heatRow?.className, 'resource');
  assert.equal(heatRow?.description, 'vent-exhaust - Heat 35.0');
  const vent = vented.events.find((event) => event.type === 'damage' && event.name === 'Vent Exhaust');

  assert.equal(vent.sourceId, ID.VENT_EXHAUST);
  assert.equal(vent.triggeredBy, 'Dodge');
  const ventProc = vented.procSteps.find((step) => step.skill === 'Vent Exhaust');

  assert.equal(ventProc.type, 'skill_proc');
  assert.equal(ventProc.sourceSkill, 'Dodge');
  assert.equal(ventProc.icon, engineerCatalog.skillsById.get(ID.VENT_EXHAUST).icon);

  const blasting = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 7600 }], {
    initialHeat: 90,
    selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE]
  });
  const blast = blasting.events.find((event) => event.type === 'damage' && event.name === 'Photonic Blasting Module');

  const blastBurns = blasting.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.PHOTONIC_BLASTING_MODULE
  );
  assert.ok(blastBurns.length > 0);
  assert.ok(blastBurns.every((event) => event.at === blast.at));
  assert.equal(
    blasting.events.some((event) => event.type === 'proc' && event.name === 'Overheat'),
    false
  );

  const heatLocked = simulate(
    'Holosmith',
    [
      'Engage Photon Forge',
      { type: 'wait', durationMs: 1000 },
      'Deactivate Photon Forge',
      { type: 'wait', durationMs: 10000 }
    ],
    {
      selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE]
    }
  );

  assert.equal(heatLocked.planningState.profession[STATE.HEAT].value, 2);
});

test('Prime Light Beam creates its damaging field only above 50 heat', () => {
  const selectedSkillIds = [5857, 5805, 6161, 5933, 42009];
  const cast = (initialHeat) =>
    simulate('Holosmith', ['Engage Photon Forge', 'Prime Light Beam', { type: 'wait', durationMs: 9000 }], {
      initialHeat,
      selectedSkillIds
    });
  const beamDamage = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Prime Light Beam');
  const beamBurning = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Prime Light Beam' && event.condition === 'Burning'
    );

  assert.equal(
    beamDamage(cast(0)).some((event) => event.name === 'Field Damage'),
    false
  );
  // Passive forge heat crosses 50 during this cast, but the activation was cold.
  assert.equal(
    beamDamage(cast(49)).some((event) => event.name === 'Field Damage'),
    false
  );
  assert.equal(beamBurning(cast(49)).length, 0);
  const hot = cast(60);

  assert.ok(beamDamage(hot).some((event) => event.name === 'Field Damage'));
  assert.ok(beamBurning(hot).length > 0);
  assert.ok(beamDamage(hot).every((event) => event.damageKind === 'explosion'));
});

test('Holosmith skill patches tune tier effects without changing heat topology', () => {
  const config = {
    ...baseConfig,
    specialization: 'Holosmith',
    initialHeat: 101,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    selectedSkillIds: [21659, 5805, 43739, 42842, 42009]
  };
  const runtime = engineerProfession.runtimeFor(config);
  const catalog = applySkillPatch(runtime.catalog, {
    skills: {
      [ID.LASER_DISK]: {
        fields: { enhancedStrikeFactor: { from: 1.35, to: 1.5 } }
      },
      [ID.PRIME_LIGHT_BEAM]: {
        fields: {
          enhancedStrikeFactor: { from: 1.2, to: 1.4 },
          enhancedConditionBaseDurationFactor: { from: 1.5, to: 2 }
        }
      }
    }
  });
  const profession = { ...runtime, catalog };
  const patchedSimulation = (rotation) => runGw2Runtime({ profession, rotation, config });
  const disk = patchedSimulation(['Laser Disk', { type: 'wait', durationMs: 10000 }]);
  const diskPackets = disk.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Laser Disk'
  );

  assert.equal(disk.planningState.profession[STATE.HEAT].maximum, 150);
  assert.ok(diskPackets.length > 0);
  assert.ok(diskPackets.every((event) => event.metadata?.holosmithStrikeFactor === 1.5));

  const beam = patchedSimulation(['Prime Light Beam', { type: 'wait', durationMs: 11000 }]);
  const field = beam.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Prime Light Beam' && event.name === 'Field Damage'
  );
  const burning = beam.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Prime Light Beam'
  );

  assert.ok(field.every((event) => event.metadata?.holosmithStrikeFactor === 1.4));
  assert.ok(
    burning.every(
      (event) => event.metadata?.holosmithConditionBaseDurationFactor === 2 && event.effectiveDuration === 6
    )
  );
});

test('Relic of Fireworks accepts weapon-strength profession mechanics', () => {
  const selectedSkillIds = [21659, 5805, 43739, 42842, 42009];
  const result = simulate(
    'Holosmith',
    ['Blade Burst', 'Grenade Barrage', 'Static Shock', { type: 'wait', durationMs: 1000 }],
    {
      selectedSkillIds,
      relic: 'Fireworks'
    }
  );
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');

  // Eligibility is per skill; packet timestamps can coalesce multiple qualifying strikes into one proc.
  assert.deepEqual(
    new Set(procs.map((step) => step.sourceSkill)),
    new Set(['Blade Burst', 'Grenade Barrage', 'Static Shock'])
  );

  const utility = simulate('Holosmith', ['Laser Disk', { type: 'wait', durationMs: 1000 }], {
    selectedSkillIds,
    relic: 'Fireworks'
  });

  assert.equal(
    utility.procSteps.some((step) => step.skill === 'Relic of Fireworks'),
    false
  );
});

test('Relic of Fireworks ignores Grenade Kit bundle skills', () => {
  const result = simulate(
    'Holosmith',
    ['Grenade Kit', 'Poison Grenade', 'Freeze Grenade', { type: 'wait', durationMs: 2000 }],
    {
      selectedSkillIds: [5805],
      relic: 'Fireworks'
    }
  );

  // Poison Grenade and Freeze Grenade both recharge in 20s but strike at bundle
  // strength, so the kit must not trigger Fireworks.
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Relic of Fireworks'),
    false
  );
});

// Restoring scheduler resources must not rewind trait clocks already advanced by the resolver.

// Positive heat-factor reductions preserve player ownership and captured heat.
test('Holosmith positive strike factors below one apply and retain delayed captures', () => {
  const rule = holosmithTraits
    .find((trait) => trait.id === TRAIT.PHOTON_PROJECTOR)
    .modifierRules.find((candidate) => candidate.id === 'engineer.enhanced-capacity-damage-tier');
  const native = engineerProfession.runtimeFor({ specialization: 'Holosmith', selectedTraitIds: [] });
  for (const factor of [0.5, 1, 1.3]) {
    const context = {
      time: 0,
      config: { selectedTraitIds: [] },
      catalog: engineerCatalog,
      runtime: {
        profession: {
          core: createEngineerCoreState(),
          specialization: { kind: 'Holosmith', state: createHolosmithState() }
        }
      },
      event: { actorType: 'player', metadata: { holosmithStrikeFactor: factor } }
    };
    assert.equal(rule.when(context), true);
    assert.equal(native.calculations.modifyStrikeDamage(context, 1), factor);
    assert.equal(rule.when({ ...context, event: { ...context.event, actorType: 'summon' } }), false);
  }

  const catalog = applySkillPatch(engineerCatalog, {
    skills: {
      [ID.SUN_EDGE]: { fields: { highStrikeFactor: 0.4 } }
    }
  });
  const context = {
    catalog,
    config: { selectedTraitIds: [] },
    runtime: {
      profession: {
        specialization: {
          kind: 'Holosmith',
          state: { heat: { value: 75 } }
        }
      }
    },
    event: { actorType: 'player', metadata: { holosmithStrikeSkillId: ID.SUN_EDGE } }
  };
  assert.equal(rule.factor(context, 'strikeDamage', rule.parameters), 0.4);
  assert.equal(
    rule.factor(
      { ...context, event: { ...context.event, metadata: { ...context.event.metadata, holosmithStrikeFactor: 0.25 } } },
      'strikeDamage',
      rule.parameters
    ),
    0.25
  );
});
