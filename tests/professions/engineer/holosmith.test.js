import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  automaticPhotonForgeExitTimelineMarkers,
  timelineWeaponLineExitMarkerRowIndex,
  timelineWeaponRows
} from '#gw2/app/rotation/timeline/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { effectFirstAtMs } from '#gw2/platform/engine/effects/timelines.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { engineerCoreCastAvailability } from '#gw2/professions/engineer/core/mechanics/availability.js';
import { createEngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { holosmithProfileStrikeFactor } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { holosmithCastAvailability } from '#gw2/professions/engineer/specializations/holosmith/mechanics/availability.js';
import { engineerPhotonForgeSkillHandlers } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import { holosmithModifierRules } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-rules.js';
import { createHolosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { createMechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { mechanistCastAvailability } from '#gw2/professions/engineer/specializations/mechanist/mechanics/availability.js';

const baseConfig = Object.freeze({
  selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
  selectedMorphSkillIds: [77103, 77203, 76954],
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 }
  }
});

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    observationPolicy
  });
}

test('Photon Forge heat generation and cooling use current piecewise rates', () => {
  const beforeFirstTick = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 99 }]);
  const firstTick = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 100 }]);

  // Forge heat is discrete: no passive gain occurs before 100 ms, then the base rate contributes 0.2%.
  assert.equal(beforeFirstTick.endState.profession.heat, 0);
  assert.equal(firstTick.endState.profession.heat, 0.2);

  const preheatedGrace = simulate('Holosmith', [{ type: 'wait', durationMs: 3000 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(preheatedGrace.endState.profession.heat, 100);

  const firstCoolingTick = simulate('Holosmith', [{ type: 'wait', durationMs: 3100 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  // The first cooling tick after the three-second delay loses 0.5 heat.
  assert.equal(firstCoolingTick.endState.profession.heat, 99.5);

  const preheatedCooling = simulate('Holosmith', [{ type: 'wait', durationMs: 5200 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(preheatedCooling.endState.profession.heat, 89);

  const beforeFastCooling = simulate('Holosmith', [{ type: 'wait', durationMs: 8000 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(beforeFastCooling.endState.profession.heat, 75);

  const firstFastCoolingTick = simulate('Holosmith', [{ type: 'wait', durationMs: 8100 }], {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  // After eight seconds, the fast phase loses 1 heat on each 100 ms tick.
  assert.equal(firstFastCoolingTick.endState.profession.heat, 74);

  const hot = simulate('Holosmith', [
    'Engage Photon Forge',
    { type: 'wait', durationMs: 5000 },
    'Deactivate Photon Forge',
    { type: 'wait', durationMs: 3100 }
  ]);

  assert.equal(hot.endState.profession.heat, 9.5);
  assert.equal(hot.endState.profession.photonForgeActive, false);

  const cooled = simulate('Holosmith', [
    'Engage Photon Forge',
    { type: 'wait', durationMs: 5000 },
    'Deactivate Photon Forge',
    { type: 'wait', durationMs: 11500 }
  ]);

  assert.equal(cooled.endState.profession.heat, 0);

  const amplified = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 100 }], {
    selectedTraitIds: [TRAIT.LIGHT_DENSITY_AMPLIFIER]
  });

  assert.equal(amplified.endState.profession.heat, 0.3);
});

test('Holosmith Forge behavior follows skill IDs after display labels change', () => {
  const state = createHolosmithState();
  state.photonForgeActive = true;
  const profession = { specialization: { kind: 'Holosmith', state } };
  const engage = { ...engineerCatalog.skillsById.get(ID.ENGAGE_PHOTON_FORGE), name: 'Renamed forge entry' };

  assert.equal(
    holosmithCastAvailability(
      { config: { specialization: 'Holosmith' }, state: { profession }, start: 0, epsilon: 1e-9 },
      engage
    ).code,
    'engineer.forge-active'
  );

  const scheduled = [];
  const corona = { ...engineerCatalog.skillsById.get(ID.CORONA_BURST), name: 'Renamed heat skill' };
  engineerPhotonForgeSkillHandlers['engineer.heat'](
    {
      state: { profession },
      start: 0,
      effectiveEnd: 1.8,
      fullEnd: 1.8,
      epsilon: 1e-9,
      tasks: { schedule: (task) => scheduled.push(task) }
    },
    corona
  );
  assert.equal(scheduled.length, 5);
});

test('Engineer availability follows skill IDs after display labels change', () => {
  const core = createEngineerCoreState();
  const coreContext = {
    config: { specialization: 'Core' },
    state: { profession: { core, specialization: { kind: 'Core', state: {} } } },
    start: 0,
    epsilon: 1e-9
  };

  const artillery = { ...engineerCatalog.skillsById.get(ID.ELECTRIC_ARTILLERY), name: 'Renamed artillery' };
  assert.equal(engineerCoreCastAvailability(coreContext, artillery).code, 'engineer.electric-artillery-inactive');

  core.electricArtilleryAvailable = true;
  const lightningRod = { ...engineerCatalog.skillsById.get(ID.LIGHTNING_ROD), name: 'Renamed rod' };
  assert.equal(engineerCoreCastAvailability(coreContext, lightningRod).code, 'engineer.lightning-rod-active');

  const mechanist = createMechanistState();
  const mechanistContext = {
    config: { specialization: 'Mechanist' },
    state: { profession: { core: createEngineerCoreState(), specialization: { kind: 'Mechanist', state: mechanist } } }
  };
  const crashDown = { ...engineerCatalog.skillsById.get(ID.CRASH_DOWN), name: 'Renamed summon' };
  assert.equal(mechanistCastAvailability(mechanistContext, crashDown).code, 'engineer.mech-active');

  mechanist.mech.active = false;
  const recall = { ...engineerCatalog.skillsById.get(ID.RECALL_MECH_ID_63300), name: 'Renamed recall' };
  assert.equal(mechanistCastAvailability(mechanistContext, recall).code, 'engineer.mech-inactive');
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

  assert.ok(
    outside.events.some((event) => event.type === 'engineer.state' && Number(event.state?.heat || 0) >= 150 - 1e-9)
  );
  assert.ok(outside.endState.profession.heat <= 150);
  assert.equal(outside.endState.profession.overheated, false);
  assert.equal(outside.endState.profession.photonForgeActive, false);

  const inside = simulate('Holosmith', ['Engage Photon Forge', 'Corona Burst', { type: 'wait', durationMs: 2000 }], {
    initialHeat: 145,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(inside.endState.profession.heat, 150);
  assert.equal(inside.endState.profession.overheated, true);
  assert.equal(inside.endState.profession.photonForgeActive, false);
});

test('Photon Blitz gains two heat for each completed projectile', () => {
  const partial = simulate('Holosmith', ['Engage Photon Forge', { name: 'Photon Blitz', interruptMs: 600 }]);

  // Three projectile pulses add 6 heat while six passive ticks add another 1.2.
  assert.equal(partial.endState.profession.heat, 7.2);

  const full = simulate('Holosmith', ['Engage Photon Forge', 'Photon Blitz']);

  // The full cast adds 16 projectile heat and 3.8 passive heat over its 1.98-second duration.
  assert.equal(full.endState.profession.heat, 19.8);
});

test('cancelled Light Strike leaves the Photon Forge chain ready for the next Light Strike', () => {
  const result = simulate('Holosmith', [
    'Engage Photon Forge',
    { name: 'Light Strike', skillId: ID.LIGHT_STRIKE, interruptMs: 80 },
    'Light Strike'
  ]);
  const lightStrikeSteps = result.steps.filter((step) => step.skill === 'Light Strike');
  const lightStrikePackets = result.events.filter((event) => event.type === 'damage' && event.name === 'Light Strike');

  assert.equal(result.warnings.length, 0);
  assert.equal(lightStrikeSteps.length, 2);
  assert.equal(lightStrikeSteps[0].interrupted, true);
  assert.ok(lightStrikeSteps.every((step) => step.invalid !== true));
  assert.equal(lightStrikePackets.length, 1);
  assert.equal(result.endState.profession.autoattackChains[ID.LIGHT_STRIKE], ID.BRIGHT_SLASH);
});

test('Photon Forge overheats at its trait-adjusted maximum', () => {
  const core = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 6000 }], {
    initialHeat: 90
  });

  assert.equal(core.endState.profession.heat, 100);
  assert.equal(core.endState.profession.overheated, true);
  assert.equal(core.endState.profession.photonForgeActive, false);

  const enhanced = simulate('Holosmith', [], {
    initialHeat: 149,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });

  assert.equal(enhanced.endState.profession.maximumHeat, 150);
  assert.equal(enhanced.endState.profession.heat, 149);

  const fullyCooled = simulate(
    'Holosmith',
    ['Engage Photon Forge', { type: 'wait', durationMs: 6000 }, { type: 'wait', durationMs: 15520 }],
    {
      initialHeat: 90
    }
  );

  assert.equal(fullyCooled.endState.profession.heat, 0);
  assert.equal(fullyCooled.endState.profession.overheated, false);
});

test('Photon Forge waits for its resource tick before ejecting at maximum heat', () => {
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
  const barrage = result.steps.find((step) => step.skill === 'Grenade Barrage');
  const overheat = result.events.find((event) => event.type === 'engineer.state' && event.reason === 'overheat');

  assert.equal(result.warnings.length, 0);
  assert.equal(barrage.start, 750);
  assert.equal(overheat.at, 0.8);
  assert.equal(result.endState.profession.photonForgeActive, false);
});

test('Photon Forge starts a fresh Overheat cadence on each entry', () => {
  // The second entry reaches maximum heat at 2.20s and ejects on that entry's
  // next 100 ms resource tick at 2.25s instead of a simulation-global boundary.
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
  const barrage = result.steps.find((step) => step.skill === 'Grenade Barrage');
  const overheat = result.events.find((event) => event.type === 'engineer.state' && event.reason === 'overheat');

  assert.equal(result.warnings.length, 0);
  assert.equal(barrage.start, 2200);
  assert.equal(overheat.at, 2.25);
  assert.equal(result.endState.profession.photonForgeActive, false);
});

test('Photon Forge waits one more resource tick when passive heat fills the bar', () => {
  // Ten ticks raise heat from 98 to 100; the following 100 ms tick observes the cap and ejects.
  const result = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 2000 }], {
    initialHeat: 98
  });
  const passiveHeat = result.events.find(
    (event) => event.type === 'engineer.state' && event.reason === 'passive-heat' && event.state.heat === 100
  );
  const overheat = result.events.find((event) => event.type === 'engineer.state' && event.reason === 'overheat');

  assert.equal(passiveHeat.at, 1);
  assert.equal(passiveHeat.state.heat, 100);
  assert.equal(overheat.at, 1.1);
  assert.equal(result.endState.profession.photonForgeActive, false);
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
    .filter((event) => event.type === 'engineer.state' && event.reason === 'passive-heat')
    .map((event) => event.at);

  // Each Forge entry owns a fresh 100 ms passive timer; manual exit invalidates the old timer.
  assert.deepEqual(passiveHeatTimes, [0.35, 1.35]);
});

test('Overheat exits Forge before weapon actions at the same resource boundary', () => {
  // Scheduled resource work resolves before the next authored action, so a
  // weapon cast at the Overheat boundary sees the normal weapon bar again.
  const result = simulate(
    'Holosmith',
    ['Engage Photon Forge', 'Holographic Shockwave', { type: 'wait', durationMs: 50 }, 'Glue Shot'],
    { initialHeat: 90 }
  );
  const glueShot = result.steps.find((step) => step.skill === 'Glue Shot');
  const overheat = result.events.find((event) => event.type === 'engineer.state' && event.reason === 'overheat');

  assert.equal(result.warnings.length, 0);
  assert.equal(overheat.at, 0.8);
  assert.equal(glueShot.start, 800);
  assert.equal(glueShot.invalid, undefined);
});

test('Overheat injects an automatic Photon Forge timeline exit and closes its lane', () => {
  const rotation = ['Engage Photon Forge', { type: 'wait', durationMs: 6000 }, 'Blunderbuss'];
  const result = simulate('Holosmith', rotation, { initialHeat: 90 });
  const exits = automaticPhotonForgeExitTimelineMarkers(result, rotation.length);
  const transition = engineerProfession.ui.timelineWeaponLineTransition;
  const rows = timelineWeaponRows(rotation, {
    weaponSwapChangesSet: false,
    weaponLineEndIndexes: new Set(exits.map((marker) => marker.insertionIndex)),
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: engineerCatalog.skillsByName.get(name),
        specialization: 'Holosmith',
        ...current
      });
    }
  });

  assert.deepEqual(exits, [
    {
      insertionIndex: 2,
      skill: 'Overheat',
      start: 5100,
      detail: 'automatic forge exit'
    }
  ]);
  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Photon Forge', null]
  );
  assert.equal(timelineWeaponLineExitMarkerRowIndex(rows, exits[0].insertionIndex, 'Photon Forge'), 1);

  const manual = simulate('Holosmith', ['Engage Photon Forge', 'Deactivate Photon Forge']);

  assert.deepEqual(automaticPhotonForgeExitTimelineMarkers(manual, 2), []);
});

test('Overheat delays its tool-belt minimum cooldown until the damage effect', () => {
  // Passive heat fills the bar at 5.00s, Overheat starts at 5.10s, and its measured effect applies at 6.66s.
  const timing = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 6700 }], {
    initialHeat: 90,
    selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE]
  });
  const overheat = timing.events.find((event) => event.type === 'engineer.state' && event.reason === 'overheat');
  const damageEffect = timing.events.find(
    (event) => event.type === 'damage' && event.name === 'Photonic Blasting Module'
  );

  assert.equal(overheat.at, 5.1);
  assert.equal(Math.round(damageEffect.at * 1000), 6660);

  const grenadeBarrageStarts = (rotation, selectedTraitIds = []) => {
    const result = simulate('Holosmith', rotation, {
      initialHeat: 90,
      selectedTraitIds
    });

    assert.equal(result.warnings.length, 0);
    return result.steps.filter((step) => step.skill === 'Grenade Barrage').map((step) => step.start);
  };

  assert.deepEqual(
    grenadeBarrageStarts(['Engage Photon Forge', { type: 'wait', durationMs: 6650 }, 'Grenade Barrage']),
    [6650]
  );
  assert.deepEqual(
    grenadeBarrageStarts(['Engage Photon Forge', { type: 'wait', durationMs: 6660 }, 'Grenade Barrage']),
    [21660]
  );
  assert.deepEqual(
    grenadeBarrageStarts(
      ['Engage Photon Forge', { type: 'wait', durationMs: 6660 }, 'Grenade Barrage'],
      [TRAIT.PHOTONIC_BLASTING_MODULE]
    ),
    [11660]
  );
  assert.deepEqual(
    grenadeBarrageStarts([
      'Grenade Barrage',
      'Engage Photon Forge',
      { type: 'wait', durationMs: 5000 },
      'Grenade Barrage'
    ]),
    [0, 26020]
  );
});

test('Holosmith offensive traits consume forge heat and attack charges', () => {
  const laserBase = simulate('Holosmith', ['Engage Photon Forge', 'Light Strike'], {
    initialHeat: 50,
    stats: { precision: 1000, ferocity: 0 }
  });
  const laser = simulate('Holosmith', ['Engage Photon Forge', 'Light Strike'], {
    initialHeat: 50,
    stats: { precision: 1000, ferocity: 0 },
    selectedTraitIds: [TRAIT.LASERS_EDGE]
  });

  // The 200 ms hit sees the completed 100 ms tick but resolves before the same-time second tick.
  const laserEdgeFactor = 1 + 50.2 * 0.0015;
  assert.ok(Math.abs(laser.strikeDamage / laserBase.strikeDamage - laserEdgeFactor) < 1e-12);
  const glassLaser = simulate('Holosmith', ['Engage Photon Forge', 'Light Strike'], {
    initialHeat: 50,
    stats: { precision: 1000, ferocity: 0 },
    selectedTraitIds: [TRAIT.GLASS_CANNON, TRAIT.LASERS_EDGE]
  });

  assert.ok(Math.abs(glassLaser.strikeDamage / laserBase.strikeDamage - 1.07 * laserEdgeFactor) < 1e-12);

  const solar = simulate('Holosmith', ['Engage Photon Forge', 'Light Strike', 'Bright Slash'], {
    stats: { precision: 1000, ferocity: 0 },
    selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS]
  });
  const solarStrikes = solar.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.solarFocusingLens === true
  );
  const solarBurns = solar.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name === 'Solar Focusing Lens — Burning'
  );

  assert.equal(solarStrikes.length, 2);
  assert.equal(solarBurns.length, 2);
  assert.ok(solarBurns.every((event) => event.stacks === 1 && event.duration === 3));
  assert.equal(solar.endState.profession.solarFocusingLensStacks, 0);

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

test('Holosmith benchmark attacks retain packets only after their observed commit cutoffs', () => {
  const lightStrike = engineerCatalog.skillsById.get(ID.LIGHT_STRIKE);

  assert.equal(lightStrike.interruptCommitMs, 200);
  assert.equal(effectFirstAtMs(lightStrike.effects[0]), 200);
  assert.equal(lightStrike.effects[0].persistsAfterInterrupt, true);

  const interruptedLightStrike = (interruptMs) =>
    simulate('Holosmith', ['Engage Photon Forge', { name: 'Light Strike', skillId: ID.LIGHT_STRIKE, interruptMs }]);
  const beforeLightStrike = interruptedLightStrike(199);
  const committedLightStrike = interruptedLightStrike(200);

  assert.equal(
    beforeLightStrike.events.filter((event) => event.type === 'damage' && event.name === 'Light Strike').length,
    0
  );
  assert.equal(
    committedLightStrike.events.filter((event) => event.type === 'damage' && event.name === 'Light Strike').length,
    1
  );
  const committedHeat = committedLightStrike.events.find(
    (event) => event.type === 'engineer.state' && event.reason === 'heat'
  );

  // The skill heat commits at 200 ms independently of the passive tick at that boundary.
  assert.equal(
    beforeLightStrike.events.some((event) => event.type === 'engineer.state' && event.reason === 'heat'),
    false
  );
  assert.equal(committedHeat.at, 0.2);
  assert.equal(committedHeat.state.heat, 2.2);

  const brightSlash = engineerCatalog.skillsById.get(ID.BRIGHT_SLASH_STORM);

  assert.equal(brightSlash.interruptCommitMs, 280);
  assert.equal(effectFirstAtMs(brightSlash.effects[0]), 320);
  assert.equal(brightSlash.effects[0].persistsAfterInterrupt, true);

  const interruptedBrightSlash = (interruptMs) =>
    simulate(
      'Holosmith',
      [
        'Engage Photon Forge',
        ID.LIGHT_STRIKE_STORM,
        { name: 'Bright Slash—Storm', skillId: ID.BRIGHT_SLASH_STORM, interruptMs },
        { type: 'wait', durationMs: 1000 }
      ],
      { selectedTraitIds: [TRAIT.CRYSTAL_CONFIGURATION_STORM] }
    ).events.filter((event) => event.type === 'damage' && event.name === 'Bright Slash—Storm');

  assert.equal(interruptedBrightSlash(279).length, 0);
  assert.equal(interruptedBrightSlash(280).length, 1);

  const heatAfterBrightSlash = (interruptMs) =>
    simulate(
      'Holosmith',
      [
        'Engage Photon Forge',
        ID.LIGHT_STRIKE_STORM,
        { name: 'Bright Slash—Storm', skillId: ID.BRIGHT_SLASH_STORM, interruptMs },
        { type: 'wait', durationMs: 1000 }
      ],
      { selectedTraitIds: [TRAIT.CRYSTAL_CONFIGURATION_STORM] }
    ).endState.profession.heat;

  // Heat commits with the launched projectile even when the remaining animation is cancelled.
  assert.equal(heatAfterBrightSlash(280) - heatAfterBrightSlash(279), 3);

  const staticShock = engineerCatalog.skillsById.get(ID.STATIC_SHOCK);

  assert.equal(staticShock.interruptCommitMs, 480);
  assert.ok(staticShock.effects.every((effect) => effectFirstAtMs(effect) === 480));

  const interruptedStaticShock = (interruptMs) =>
    simulate(
      'Holosmith',
      [
        { name: 'Static Shock', skillId: ID.STATIC_SHOCK, interruptMs },
        { type: 'wait', durationMs: 1000 }
      ],
      { selectedSkills: ['A.E.D.', 'Grenade Kit', 'Photon Wall', 'Laser Disk', 'Prime Light Beam'] }
    ).events.filter((event) => event.type === 'damage' && event.name === 'Static Shock');

  assert.equal(interruptedStaticShock(479).length, 0);
  assert.equal(interruptedStaticShock(480).length, 1);
});

test('Thermal Release Valve, ECSU, and PBM materialize their heat effects', () => {
  const vented = simulate('Holosmith', ['Dodge'], {
    initialHeat: 50,
    selectedTraitIds: [TRAIT.THERMAL_RELEASE_VALVE]
  });

  assert.equal(vented.endState.profession.heat, 35);
  const vent = vented.events.find((event) => event.type === 'damage' && event.name === 'Vent Exhaust');

  assert.equal(vent.coefficient, 1.1);
  assert.equal(vent.noCrit, true);
  assert.equal(vent.canCrit, false);
  assert.equal(vent.sourceId, ID.VENT_EXHAUST);
  assert.equal(vent.triggeredBy, 'Dodge');
  const ventProc = vented.procSteps.find((step) => step.skill === 'Vent Exhaust');

  assert.equal(ventProc.type, 'skill_proc');
  assert.equal(ventProc.sourceSkill, 'Dodge');
  assert.equal(ventProc.icon, engineerCatalog.skillsById.get(ID.VENT_EXHAUST).icon);
  assert.ok(vented.events.some((event) => event.type === 'buff' && event.kind === 'vigor' && event.duration === 3));
  assert.ok(
    vented.events.some(
      (event) =>
        event.type === 'condition' &&
        event.name === 'Vent Exhaust — Burning' &&
        event.stacks === 2 &&
        event.duration === 6
    )
  );

  const enhanced = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 3000 }], {
    initialHeat: 99,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
  });
  const mightPulses = enhanced.events.filter(
    (event) => event.type === 'buff' && event.name === 'Enhanced Capacity Storage Unit — might'
  );

  assert.equal(mightPulses.length, 3);
  assert.ok(mightPulses.every((event) => event.stacks === 2 && event.duration === 6));

  const swordChain = ['Sun Edge', 'Sun Ripper', 'Gleam Saber'];
  const tierBase = simulate('Holosmith', swordChain, {
    initialHeat: 50,
    stats: { precision: 1000, ferocity: 0 }
  });
  const tiered = simulate('Holosmith', swordChain, {
    initialHeat: 51,
    stats: { precision: 1000, ferocity: 0 }
  });
  const cappedSword = simulate('Holosmith', swordChain, {
    initialHeat: 101,
    stats: { precision: 1000, ferocity: 0 }
  });
  const enhancedSword = simulate('Holosmith', swordChain, {
    initialHeat: 101,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    stats: { precision: 1000, ferocity: 0 }
  });
  const swordDamage = (result, name) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === name).damage;

  for (const name of swordChain) {
    assert.ok(Math.abs(swordDamage(tiered, name) / swordDamage(tierBase, name) - 1.2) < 1e-12, name);
  }

  assert.ok(Math.abs(swordDamage(cappedSword, 'Sun Edge') / swordDamage(tiered, 'Sun Edge') - 1) < 1e-12);
  assert.ok(swordDamage(enhancedSword, 'Sun Edge') > swordDamage(tiered, 'Sun Edge'));

  const swordTierRule = holosmithModifierRules.find((rule) => rule.id === 'engineer.enhanced-capacity-damage-tier');
  const swordTierFactor = (heat, selectedTraitIds = []) =>
    holosmithProfileStrikeFactor(
      {
        config: { selectedTraitIds },
        catalog: engineerCatalog
      },
      HOLOSMITH_BALANCE_PROFILE_IDS.swordHeatTier,
      { heat, enhancedCapacitySelected: selectedTraitIds.includes(TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT) }
    );

  assert.deepEqual(
    [
      swordTierFactor(50),
      swordTierFactor(51),
      swordTierFactor(101),
      swordTierFactor(100, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]),
      swordTierFactor(101, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT])
    ],
    [1, 1.2, 1.2, 1.2, 1.3]
  );
  assert.equal(
    swordTierRule.factor({ event: { holosmithStrikeFactor: 1.3 } }, 'strikeDamage', swordTierRule.parameters),
    1.3
  );

  const blasting = simulate('Holosmith', ['Engage Photon Forge', { type: 'wait', durationMs: 7600 }], {
    initialHeat: 90,
    selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE]
  });
  const blast = blasting.events.find((event) => event.type === 'damage' && event.name === 'Photonic Blasting Module');

  assert.equal(blast.coefficient, 5);
  assert.equal(blast.explosion, true);
  assert.equal(blast.comboFinishers[0].finisherType, 'Blast');
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

  assert.equal(heatLocked.endState.profession.heat, 2);
});

test('Prime Light Beam creates its damaging field only above 50 heat', () => {
  const selectedSkills = ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Prime Light Beam'];
  const cast = (initialHeat) =>
    simulate('Holosmith', ['Engage Photon Forge', 'Prime Light Beam', { type: 'wait', durationMs: 9000 }], {
      initialHeat,
      selectedSkills
    });
  const beamDamage = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Prime Light Beam');
  const beamBurning = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Prime Light Beam' && event.condition === 'Burning'
    );

  assert.equal(beamDamage(cast(0)).length, 1);
  // Passive forge heat crosses 50 during this cast, but the activation was cold.
  assert.equal(beamDamage(cast(49)).length, 1);
  assert.equal(beamBurning(cast(49)).length, 0);
  const hot = cast(60);

  assert.equal(beamDamage(hot).length, 11);
  assert.equal(beamBurning(hot).length, 10);
  assert.ok(beamDamage(hot).every((event) => event.damageKind === 'explosion'));
});

test('Holosmith exceed packets use their heat tiers and conditions', () => {
  const selectedSkills = ['A.E.D.', 'Grenade Kit', 'Photon Wall', 'Laser Disk', 'Prime Light Beam'];
  const run = (rotation, initialHeat, selectedTraitIds = []) =>
    simulate('Holosmith', rotation, {
      initialHeat,
      selectedSkills,
      selectedTraitIds,
      stats: { precision: 1000, ferocity: 0 },
      target: { conditions: {} }
    });
  const skillEvents = (result, type, skillName) =>
    result.resolvedEvents.filter((event) => event.type === type && event.skillName === skillName);

  const coldDisk = run(['Laser Disk', { type: 'wait', durationMs: 7000 }], 0);
  const hotDisk = run(['Laser Disk', { type: 'wait', durationMs: 10000 }], 60);
  const enhancedDisk = run(['Laser Disk', { type: 'wait', durationMs: 10000 }], 101, [
    TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT
  ]);
  const hotDiskDamage = skillEvents(hotDisk, 'damage', 'Laser Disk');
  const enhancedDiskDamage = skillEvents(enhancedDisk, 'damage', 'Laser Disk');

  assert.equal(skillEvents(coldDisk, 'damage', 'Laser Disk').length, 12);
  assert.equal(hotDiskDamage.length, 18);
  assert.equal(enhancedDiskDamage.length, 18);
  assert.equal(skillEvents(hotDisk, 'condition', 'Laser Disk').length, 18);
  assert.ok(hotDiskDamage.every((event) => event.coefficient === 0.5));
  assert.ok(
    skillEvents(hotDisk, 'condition', 'Laser Disk').every(
      (event) => event.condition === 'Bleeding' && event.duration === 2
    )
  );
  assert.ok(
    enhancedDiskDamage.every((event) => event.enhancedCapacityTier === true && event.holosmithStrikeFactor === 1.35)
  );

  const coldWall = run(['Photon Wall', 'Launch Wall', { type: 'wait', durationMs: 1000 }], 0);
  const hotWall = run(['Photon Wall', 'Launch Wall', { type: 'wait', durationMs: 1000 }], 60);
  const enhancedWall = run(['Photon Wall', 'Launch Wall', { type: 'wait', durationMs: 1000 }], 101, [
    TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT
  ]);

  assert.equal(skillEvents(coldWall, 'damage', 'Launch Wall').length, 1);
  assert.equal(skillEvents(hotWall, 'damage', 'Launch Wall').length, 3);
  assert.ok(
    skillEvents(hotWall, 'damage', 'Launch Wall').every(
      (event) => event.coefficient === 1.5 && event.damageKind === 'explosion'
    )
  );
  assert.ok(
    skillEvents(hotWall, 'condition', 'Launch Wall').every(
      (event) => event.condition === 'Vulnerability' && event.stacks === 3 && event.duration === 5
    )
  );
  assert.ok(
    skillEvents(enhancedWall, 'damage', 'Launch Wall').every(
      (event) => event.enhancedCapacityTier === true && event.holosmithStrikeFactor === 1.35
    )
  );

  const blades = (initialHeat, selectedTraitIds = []) =>
    run(['Refraction Cutter', { type: 'wait', durationMs: 1000 }], initialHeat, selectedTraitIds);

  for (const [label, heat, selectedTraitIds, expectedBlades] of [
    ['cold', 0, [], 1],
    ['hot', 60, [], 3],
    ['capped-without-ecsu', 101, [], 3],
    ['at-100-with-ecsu', 100, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT], 3],
    ['above-100-with-ecsu', 101, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT], 5]
  ]) {
    const result = blades(heat, selectedTraitIds);
    const bladeDamage = skillEvents(result, 'damage', 'Refraction Cutter').filter(
      (event) => event.name === 'Refraction Cutter Blade'
    );
    const bladeBleeding = skillEvents(result, 'condition', 'Refraction Cutter').filter(
      (event) => event.condition === 'Bleeding'
    );

    assert.equal(bladeDamage.length, expectedBlades, `${label}:blades`);
    assert.equal(bladeBleeding.length, expectedBlades, `${label}:bleeding`);
    assert.ok(
      bladeDamage.every((event) => event.coefficient === 0.4 && event.comboFinishers?.[0]?.chance === 1),
      `${label}:blade-facts`
    );
    assert.ok(
      bladeBleeding.every((event) => event.stacks === 1 && event.duration === 4),
      `${label}:bleeding-facts`
    );
  }

  const beam = run(['Prime Light Beam', { type: 'wait', durationMs: 11000 }], 101, [
    TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT
  ]);
  const field = skillEvents(beam, 'damage', 'Prime Light Beam').filter((event) => event.name === 'Field Damage');
  const burning = skillEvents(beam, 'condition', 'Prime Light Beam');

  assert.equal(field.length, 10);
  assert.ok(field.every((event) => event.coefficient === 0.5 && event.damageKind === 'explosion'));
  assert.ok(field.every((event) => event.holosmithStrikeFactor === 1.2));
  assert.equal(burning.length, 10);
  assert.ok(
    burning.every((event) => event.condition === 'Burning' && event.duration === 3 && event.effectiveDuration === 4.5)
  );

  const cappedBeam = simulate('Holosmith', ['Prime Light Beam', { type: 'wait', durationMs: 11000 }], {
    initialHeat: 101,
    selectedSkills,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    stats: { expertise: 1500, precision: 1000, ferocity: 0 },
    target: { conditions: {} }
  });
  const cappedBurning = skillEvents(cappedBeam, 'condition', 'Prime Light Beam');

  // The ECSU-specific 50% is part of PLB's base duration, then the normal +100% cap applies.
  assert.ok(cappedBurning.every((event) => event.effectiveDuration === 9));
});

test('Holosmith direct heat variants apply profile factors to their eligible packets', () => {
  const packetFor = (skillName, initialHeat, selectedTraitIds, selectedSkills) => {
    const result = simulate('Holosmith', [skillName, { type: 'wait', durationMs: 1000 }], {
      initialHeat,
      selectedTraitIds,
      selectedSkills,
      stats: { precision: 1000, ferocity: 0 }
    });

    return result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillName === skillName && event.name === skillName
    );
  };

  const utilitySkills = ['A.E.D.', 'Grenade Kit', 'Photon Wall', 'Laser Disk', 'Prime Light Beam'];
  const ratio = (variant, base) => variant.damage / base.damage;

  const baseBladeBurst = packetFor('Blade Burst', 0, [], utilitySkills);
  const baseParticleAccelerator = packetFor('Particle Accelerator', 0, [], utilitySkills);

  assert.ok(Math.abs(ratio(packetFor('Blade Burst', 60, [], utilitySkills), baseBladeBurst) - 1.25) < 1e-12);
  assert.ok(
    Math.abs(
      ratio(packetFor('Blade Burst', 100, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT], utilitySkills), baseBladeBurst) - 1.25
    ) < 1e-12
  );
  assert.ok(
    Math.abs(
      ratio(packetFor('Blade Burst', 101, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT], utilitySkills), baseBladeBurst) - 1.35
    ) < 1e-12
  );
  assert.ok(
    Math.abs(ratio(packetFor('Particle Accelerator', 60, [], utilitySkills), baseParticleAccelerator) - 1.1) < 1e-12
  );
  assert.ok(
    Math.abs(
      ratio(
        packetFor('Particle Accelerator', 100, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT], utilitySkills),
        baseParticleAccelerator
      ) - 1.1
    ) < 1e-12
  );
  assert.ok(
    Math.abs(
      ratio(
        packetFor('Particle Accelerator', 101, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT], utilitySkills),
        baseParticleAccelerator
      ) - 1.35
    ) < 1e-12
  );
});

test('Holosmith heat-profile patches tune tier effects without changing heat topology', () => {
  const runtime = engineerProfession.resolveRuntime({ specialization: 'Holosmith' });
  const catalog = applyBalanceProfilePatch(runtime.catalog, {
    balanceProfiles: {
      [HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier]: {
        fields: { enhancedStrikeFactor: { from: 1.35, to: 1.5 } }
      },
      [HOLOSMITH_BALANCE_PROFILE_IDS.primeLightBeamHeatTier]: {
        fields: {
          enhancedStrikeFactor: { from: 1.2, to: 1.4 },
          enhancedConditionBaseDurationFactor: { from: 1.5, to: 2 }
        }
      }
    }
  });
  const profession = Object.freeze({ ...runtime, catalog });
  const patchedSimulation = (rotation) =>
    simulateGw2({
      profession,
      rotation,
      config: {
        ...baseConfig,
        specialization: 'Holosmith',
        initialHeat: 101,
        selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
        selectedSkills: ['A.E.D.', 'Grenade Kit', 'Photon Wall', 'Laser Disk', 'Prime Light Beam']
      }
    });
  const disk = patchedSimulation(['Laser Disk', { type: 'wait', durationMs: 10000 }]);
  const diskPackets = disk.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Laser Disk'
  );

  assert.equal(disk.endState.profession.maximumHeat, 150);
  assert.equal(diskPackets.length, 18);
  assert.ok(diskPackets.every((event) => event.enhancedCapacityTier === true && event.holosmithStrikeFactor === 1.5));

  const beam = patchedSimulation(['Prime Light Beam', { type: 'wait', durationMs: 11000 }]);
  const field = beam.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Prime Light Beam' && event.name === 'Field Damage'
  );
  const burning = beam.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Prime Light Beam'
  );

  assert.ok(field.every((event) => event.holosmithStrikeFactor === 1.4));
  assert.ok(
    burning.every((event) => event.holosmithConditionBaseDurationFactor === 2 && event.effectiveDuration === 6)
  );
});

test('Relic of Fireworks accepts weapon-strength profession mechanics', () => {
  const selectedSkills = ['A.E.D.', 'Grenade Kit', 'Photon Wall', 'Laser Disk', 'Prime Light Beam'];
  const result = simulate(
    'Holosmith',
    ['Blade Burst', 'Grenade Barrage', 'Static Shock', { type: 'wait', durationMs: 1000 }],
    {
      selectedSkills,
      relic: 'Fireworks'
    }
  );
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');

  assert.deepEqual(
    new Set(procs.map((step) => step.sourceSkill)),
    new Set(['Blade Burst', 'Grenade Barrage', 'Static Shock'])
  );
  assert.equal(procs.length, 8);

  const utility = simulate('Holosmith', ['Laser Disk', { type: 'wait', durationMs: 1000 }], {
    selectedSkills,
    relic: 'Fireworks'
  });

  assert.equal(
    utility.procSteps.some((step) => step.skill === 'Relic of Fireworks'),
    false
  );
});

test('Relic of Thorns adds +30 Condition Damage per stack to condition ticks', () => {
  const rotation = ['Grenade Kit', 'Poison Grenade', 'Shrapnel Grenade', { type: 'wait', durationMs: 60000 }];
  const withThorns = simulate('Amalgam', rotation, { relic: 'Thorns' });
  const withoutRelic = simulate('Amalgam', rotation, { relic: '' });

  // Thorns is a condition-damage attribute buff: strike output must be identical
  // while condition ticks scale up with the ramping stacks.
  assert.equal(withThorns.strikeDamage, withoutRelic.strikeDamage);
  assert.ok(
    withThorns.conditionDamage > withoutRelic.conditionDamage,
    `expected Thorns to raise condition damage (${withThorns.conditionDamage} vs ${withoutRelic.conditionDamage})`
  );

  // Stacks ramp on the display timeline: first at 3s, one more every 5s, capped at 10.
  const stackDetails = withThorns.procSteps
    .filter((step) => step.skill === 'Relic of Thorns')
    .map((step) => step.detail);

  assert.equal(stackDetails[0], '1/10 stacks');
  assert.equal(stackDetails.at(-1), '10/10 stacks');
});

test('Relic of Fireworks ignores Grenade Kit bundle skills', () => {
  const result = simulate(
    'Holosmith',
    ['Grenade Kit', 'Poison Grenade', 'Freeze Grenade', { type: 'wait', durationMs: 2000 }],
    {
      selectedSkills: ['Grenade Kit'],
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
