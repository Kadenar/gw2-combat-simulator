import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfession, loadProfessionAppAdapter, professionOptions } from '../../../js/app/profession/registry.js';
import { professionRoute } from '../../../js/app/profession/selector.js';
import { simulateGw2 } from '../../../js/platform/gw2/simulate.js';
import { applyBalanceProfilePatch, applySkillPatch } from '../../../js/platform/gw2/skill-patch.js';
import { skillBreakdownRows } from '../../../js/platform/ui/result-tables.js';
import { buildChartSeries } from '../../../js/app/rotation/result/model.js';
import { formatResourceValue } from '../../../js/app/rotation/palette/resource-view.js';
import { simulationEventLogRows } from '../../../js/app/rotation/result/event-log.js';
import { weaponSkills } from '../../../js/app/rotation/palette/model.js';
import { renderPalette } from '../../../js/app/rotation/palette/view.js';
import {
  createNecromancerBuildDefaults,
  migrateNecromancerBuild,
  validateNecromancerBuild
} from '../../../js/professions/necromancer/build.js';
import { necromancerCatalog, NECROMANCER_NON_DPS_SKILL_NAMES } from '../../../js/professions/necromancer/catalog.js';
import { DATA_SNAPSHOT } from '../../../js/professions/necromancer/data/necromancer-api-metadata.js';
import { necromancerProfession } from '../../../js/professions/necromancer/definition.js';
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '../../../js/professions/necromancer/data/ids.js';
import {
  actualNecromancerLifeForceCost,
  normalizedNecromancerLifeForceCost
} from '../../../js/professions/necromancer/core/state.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS } from '../../../js/professions/necromancer/core/profiles.js';
import { REAPER_BALANCE_PROFILE_IDS } from '../../../js/professions/necromancer/specializations/reaper/profiles.js';
import { SCOURGE_BALANCE_PROFILE_IDS } from '../../../js/professions/necromancer/specializations/scourge/profiles.js';
import { HARBINGER_BALANCE_PROFILE_IDS } from '../../../js/professions/necromancer/specializations/harbinger/profiles.js';
import { RITUALIST_BALANCE_PROFILE_IDS } from '../../../js/professions/necromancer/specializations/ritualist/profiles.js';
import {
  calculateModifierContributions,
  modifierCandidates,
  modifierContributionRequest,
  necromancerAppAdapter,
  recalculate,
  runSimulation,
  simulationConfig
} from '../../../js/professions/necromancer/app/app-definition.js';

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 2000,
    ferocity: 500,
    conditionDamage: 1200,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    conditions: {
      Chilled: true,
      Vulnerability: 25
    }
  }
});

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: necromancerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    mode: 'sequence',
    observationPolicy
  });
}

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

const applyNecromancerPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(necromancerCatalog, patch), patch);

test('Necromancer uses the current API catalog and all nine trait lines', () => {
  assert.equal(DATA_SNAPSHOT, '2026-07-25');
  assert.equal(necromancerCatalog.specializations.length, 9);
  assert.equal(necromancerCatalog.traits.length, 108);
  assert.ok(necromancerCatalog.skills.length >= 160);
  assert.equal(necromancerCatalog.skillsById.get(ID.LIFE_BLAST).name, 'Life Blast');
  for (const name of ['Corrupt Boon', 'Spectral Ring', 'Epidemic', 'Summon Flesh Wurm', 'Necrotic Traversal']) {
    assert.equal(necromancerCatalog.skillsByName.has(name), false, name);
  }

  assert.deepEqual(
    necromancerCatalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name),
    ['Reaper', 'Scourge', 'Harbinger', 'Ritualist']
  );
});

test('Necromancer modules expose isolated balance-profile authoring', () => {
  const modules = new Map(necromancerProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) =>
    modules.get(moduleId).balanceProfiles.find((entry) => entry.id === profileId);
  const bloodFiend = profile('Core', NECROMANCER_CORE_BALANCE_PROFILE_IDS.bloodFiendAttack);
  const shade = profile('Scourge', SCOURGE_BALANCE_PROFILE_IDS.shade);
  const blight = profile('Harbinger', HARBINGER_BALANCE_PROFILE_IDS.resources);
  const spirit = profile('Ritualist', RITUALIST_BALANCE_PROFILE_IDS.anguish);
  const reaper = profile('Reaper', REAPER_BALANCE_PROFILE_IDS.resources);

  assert.equal(bloodFiend.profile.profileKind, 'skill-variant');
  assert.equal(bloodFiend.patchableFields.damagePerCoefficient, 4338);
  assert.equal(shade.profile.effects[0].coefficient, 0.666);
  assert.equal(blight.patchableFields.maximumStacks, 25);
  assert.equal(spirit.profile.effects[1].ticks.length, 7);
  assert.equal(reaper.patchableFields.lifeForceDrain, 4);
  assert.deepEqual(
    modules.get('Core').modifierRules.find((rule) => rule.id === 'necromancer.target-the-weak-critical-chance')
      .parameters,
    { criticalChancePerCondition: 0.02 }
  );
  assert.deepEqual(
    modules.get('Ritualist').modifierRules.find((rule) => rule.id === 'necromancer.anguish-conditional-damage')
      .parameters,
    { damagePerCondition: 0.02, controlledBonus: 0.2 }
  );

  const preview = applyNecromancerPatch({
    skills: {
      [ID.NIGHTMARE_WEAPON]: {
        effects: [
          {
            effectIndex: 0,
            allyStacks: { from: 3, to: 4 },
            maximumRecipients: { from: 5, to: 6 }
          }
        ]
      },
      [ID.RIGOR_MORTIS]: {
        effects: [
          {
            effectIndex: 0,
            tickIndex: 0,
            coefficient: { from: 0.25, to: 0.3 }
          }
        ]
      }
    },
    balanceProfiles: {
      [SCOURGE_BALANCE_PROFILE_IDS.shade]: {
        effects: [
          {
            effectIndex: 0,
            coefficient: { from: 0.666, to: 0.7 }
          }
        ]
      },
      [HARBINGER_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 25, to: 30 } }
      },
      [RITUALIST_BALANCE_PROFILE_IDS.resources]: {
        fields: { pulseInterval: { from: 4, to: 3 } }
      }
    }
  });

  assert.equal(preview.skillsById.get(ID.NIGHTMARE_WEAPON).effects[0].allyStacks, 4);
  assert.equal(preview.skillsById.get(ID.NIGHTMARE_WEAPON).effects[0].maximumRecipients, 6);
  assert.equal(preview.skillsById.get(ID.RIGOR_MORTIS).effects[0].ticks[0].coefficient, 0.3);
  assert.equal(preview.balanceProfilesById.get(SCOURGE_BALANCE_PROFILE_IDS.shade).effects[0].coefficient, 0.7);
  assert.equal(preview.balanceProfilesById.get(HARBINGER_BALANCE_PROFILE_IDS.resources).maximumStacks, 30);
  assert.equal(preview.balanceProfilesById.get(RITUALIST_BALANCE_PROFILE_IDS.resources).pulseInterval, 3);

  assert.equal(necromancerCatalog.skillsById.get(ID.NIGHTMARE_WEAPON).effects[0].allyStacks, 3);
  assert.equal(
    necromancerCatalog.balanceProfilesById.get(SCOURGE_BALANCE_PROFILE_IDS.shade).effects[0].coefficient,
    0.666
  );
  assert.equal(necromancerCatalog.balanceProfilesById.get(HARBINGER_BALANCE_PROFILE_IDS.resources).maximumStacks, 25);
});

test('measured Quickness cast times remain exact', () => {
  const expected = new Map([
    [ID.LIFE_SIPHON, 560],
    [ID.DARK_PACT, 680],
    [ID.NECROTIC_STAB, 400],
    [ID.NECROTIC_BITE, 640],
    [ID.NECROTIC_SLASH, 360],
    [ID.LIFE_BLAST, 920],
    [ID.DARK_PATH, 880],
    [ID.LIFE_TRANSFER, 2920],
    [ID.DHUUMFIRE_BLAST, 920],
    [ID.DOOM, 600],
    [ID.CORROSIVE_POISON_CLOUD, 600],
    [ID.DEVOURING_DARKNESS, 600],
    [ID.GRASPING_DEAD, 880],
    [ID.BLOOD_CURSE, 440],
    [ID.RENDING_CURSE, 600],
    [ID.BLOOD_IS_POWER, 880],
    [ID.PLAGUELANDS, 920],
    [ID.PUTRID_CURSE, 600],
    [ID.DEATHLY_SWARM, 480],
    [ID.ENFEEBLING_BLOOD, 840],
    [ID.DEATH_SPIRAL, 720],
    [ID.ELIXIR_OF_PROMISE, 680],
    [ID.ELIXIR_OF_ANGUISH, 680],
    [ID.WEEPING_SHOTS, 840],
    [ID.VICIOUS_SHOT, 600],
    [ID.DARK_BARRAGE, 920],
    [ID.VORACIOUS_ARC, 840],
    [ID.DEVOURING_CUT, 480],
    [ID.TAINTED_BOLTS, 600],
    [ID.VILE_BLAST, 600],
    [ID.ADDLE, 360],
    [ID.EXTIRPATE, 840],
    [ID.DARK_SLASH, 600],
    [ID.ISOLATE, 480],
    [ID.PERFORATE, 840],
    [ID.HUNGERING_MAELSTROM, 640],
    [ID.GORMANDIZE, 440],
    [ID.DEVOURING_VISAGE, 680],
    [ID.CONSUME, 520],
    [ID.DEADLY_SLICE, 520],
    [ID.SINISTER_STAB, 560],
    [ID.ELIXIR_OF_RISK, 680],
    [ID.LOCUST_SWARM, 440],
    [ID.VITAL_DRAW, 800],
    [ID.WAIL_OF_DOOM, 1000],
    [ID.ELIXIR_OF_AMBITION, 680],
    [ID.WELL_OF_DARKNESS, 480],
    [ID.WELL_OF_SUFFERING, 480],
    [ID.NIGHTFALL, 480],
    [ID.GRASPING_DARKNESS, 520],
    [ID.LIFE_REND, 400],
    [ID.SOUL_SPIRAL, 2160],
    [ID.LIFE_SLASH, 600],
    [ID.LIFE_REAP, 560],
    [ID.GRAVEDIGGER, 1080],
    [ID.DUSK_STRIKE, 480],
    [ID.FADING_TWILIGHT, 640],
    [ID.CHILLING_SCYTHE, 920],
    [ID.DEATHS_CHARGE, 1200],
    [ID.GHASTLY_CLAWS, 1440],
    [ID.RENDING_CLAWS, 620],
    [ID.REAPERS_MARK, 520],
    [ID.CHILLBLAINS, 480],
    [ID.MARK_OF_BLOOD, 480],
    [ID.EXECUTIONERS_SCYTHE, 1320],
    [ID.NECROTIC_GRASP, 880],
    [ID.PUTRID_MARK, 480],
    [ID.TERRIFY, 320],
    [ID.SIGNET_OF_SPITE, 880],
    [ID.SPINAL_SHIVERS, 800],
    [ID.MANIFEST_SAND_SHADE, 480],
    [ID.HARROWING_WAVE, 440],
    [ID.OPPRESSIVE_COLLAPSE, 600],
    [ID.SOUL_GRASP, 520],
    [ID.SIGNET_OF_VAMPIRISM, 880],
    [ID.SPECTRAL_GRASP, 600],
    [ID.FEAST_OF_CORRUPTION, 600],
    [ID.PRESERVATION, 480],
    [ID.NIGHTMARE_WEAPON, 240],
    [ID.ANGUISH, 560],
    [ID.WANDERLUST, 760],
    [ID.SPLINTER_WEAPON, 240],
    [ID.ESSENCE_BLAST, 600]
  ]);

  assert.deepEqual(
    new Map(
      necromancerCatalog.skills.flatMap((skill) =>
        skill.quicknessCastTimeMs == null ? [] : [[Number(skill.id), Number(skill.quicknessCastTimeMs)]]
      )
    ),
    expected
  );
  for (const [skillId, quicknessCastTimeMs] of expected) {
    const skill = necromancerCatalog.skillsById.get(skillId);

    assert.equal(skill.quicknessCastTimeMs, quicknessCastTimeMs, skill.name);
    assert.equal(skill.castTimeMs, quicknessCastTimeMs * 1.5, skill.name);
  }

  assert.equal(necromancerCatalog.skillsById.get(ID.SUFFER).castTimeMs, 0);
  assert.equal(necromancerCatalog.skillsById.get(ID.SUFFER).quicknessCastTimeMs, undefined);
});

test('Necromancer multi-hit skills use their configured packet timings', () => {
  const packetTail = observationTail(6000);
  const weepingShots = simulate(
    'Harbinger',
    ['Weeping Shots'],
    {
      boons: { quickness: true },
      primaryWeapon: 'Pistol'
    },
    packetTail
  );
  const vitalDraw = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Vital Draw'],
    { boons: { quickness: true } },
    packetTail
  );
  const taintedBolts = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Tainted Bolts'],
    { boons: { quickness: true } },
    packetTail
  );
  const darkBarrage = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Dark Barrage'],
    { boons: { quickness: true } },
    packetTail
  );
  const deathsCharge = simulate(
    'Reaper',
    ["Reaper's Shroud", "Death's Charge"],
    { boons: { quickness: true } },
    packetTail
  );
  const soulSpiral = simulate('Reaper', ["Reaper's Shroud", 'Soul Spiral'], { boons: { quickness: true } }, packetTail);
  const anguish = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish'], { boons: { quickness: true } }, packetTail);
  const wanderlust = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Wanderlust'],
    { boons: { quickness: true } },
    packetTail
  );
  const offsets = (result, skillName, skillId, type = 'damage') => {
    const start = result.steps.find((step) => step.skill === skillName)?.start;

    assert.notEqual(start, undefined, skillName);

    return result.events
      .filter((event) => event.type === type && event.skillId === skillId)
      .map((event) => Math.round(event.at * 1000 - start));
  };

  assert.deepEqual(offsets(weepingShots, 'Weeping Shots', ID.WEEPING_SHOTS), [240, 360, 520, 640, 760, 880]);
  assert.deepEqual(
    offsets(weepingShots, 'Weeping Shots', ID.WEEPING_SHOTS, 'condition'),
    [240, 360, 520, 640, 760, 840, 880]
  );
  assert.deepEqual(offsets(vitalDraw, 'Vital Draw', ID.VITAL_DRAW), [760, 1760, 2760]);
  assert.deepEqual(offsets(taintedBolts, 'Tainted Bolts', ID.TAINTED_BOLTS), [320, 600]);
  assert.deepEqual(offsets(taintedBolts, 'Tainted Bolts', ID.TAINTED_BOLTS, 'condition'), [320, 600]);
  assert.deepEqual(offsets(darkBarrage, 'Dark Barrage', ID.DARK_BARRAGE), [600, 680, 680, 800, 800, 800]);
  assert.deepEqual(offsets(darkBarrage, 'Dark Barrage', ID.DARK_BARRAGE, 'condition'), [600, 680, 680, 800, 800, 800]);
  assert.deepEqual(
    offsets(deathsCharge, "Death's Charge", ID.DEATHS_CHARGE),
    [40, 160, 280, 400, 520, 640, 760, 880, 960, 1160]
  );
  assert.deepEqual(
    offsets(soulSpiral, 'Soul Spiral', ID.SOUL_SPIRAL),
    [240, 440, 560, 760, 880, 1080, 1200, 1400, 1520, 1720, 1840, 2040]
  );
  assert.deepEqual(
    offsets(soulSpiral, 'Soul Spiral', ID.SOUL_SPIRAL, 'condition'),
    [240, 440, 560, 760, 880, 1080, 1200, 1400, 1520, 1720, 1840, 2040]
  );
  assert.deepEqual(offsets(anguish, 'Anguish', ID.ANGUISH), [1360, 1520, 1560, 1640, 1680, 1720, 1760]);
  assert.deepEqual(offsets(wanderlust, 'Wanderlust', ID.WANDERLUST), [720, 2760, 3760, 4760, 5760]);
});

test('Relic of Fireworks refreshes from qualifying Reaper Shroud skills', () => {
  const result = simulate('Reaper', ["Reaper's Shroud", 'Soul Spiral'], {
    initialResource: 100,
    relic: 'Fireworks'
  });
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.SOUL_SPIRAL && event.name === 'Soul Spiral'
  );

  assert.equal(procs.length, 12);
  assert.ok(procs.every((proc) => proc.sourceSkill === 'Soul Spiral'));
  assert.equal(procs[0].detail, 'activated');
  assert.ok(procs.slice(1).every((proc) => proc.detail === 'refreshed'));
  assert.equal(hits.length, 12);
  assert.ok(Math.abs(hits[1].damage / hits[0].damage - 1.07) < 1e-12);
});

test('Necromancer single-hit skills use their configured offsets', () => {
  const declarativeOffsets = new Map([
    [ID.DARK_PACT, 640],
    [ID.GRASPING_DEAD, 560],
    [ID.BLOOD_IS_POWER, 560],
    [ID.PUTRID_CURSE, 360],
    [ID.SIGNET_OF_SPITE, 560],
    [ID.BLOOD_CURSE, 360],
    [ID.RENDING_CURSE, 440],
    [ID.NECROTIC_STAB, 160],
    [ID.ENFEEBLING_BLOOD, 1200],
    [ID.CHILLING_SCYTHE, 720],
    [ID.GRAVEDIGGER, 840],
    [ID.FADING_TWILIGHT, 520],
    [ID.OPPRESSIVE_COLLAPSE, 560],
    [ID.HARROWING_WAVE, 320],
    [ID.VILE_BLAST, 560],
    [ID.VICIOUS_SHOT, 360],
    [ID.DEVOURING_VISAGE, 480],
    [ID.DARK_SLASH, 480],
    [ID.ADDLE, 240],
    [ID.DEADLY_SLICE, 400],
    [ID.SINISTER_STAB, 520],
    [ID.ISOLATE, 440],
    [ID.LIFE_SLASH, 400]
  ]);

  for (const [skillId, expectedOffset] of declarativeOffsets) {
    const skill = necromancerCatalog.skillsById.get(skillId);
    const strike = skill.effects.find((effect) => effect.type === 'strike');

    assert.equal(strike?.timingAnchor, 'castStart', skill.name);
    assert.equal(strike?.timingScale, 'cast', skill.name);
    assert.equal(Math.round(strike.atMs), expectedOffset, skill.name);
  }

  const devouringDarkness = simulate('Core', ['Devouring Darkness'], {
    boons: { quickness: true },
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.LINGERING_CURSE]
  });
  const essenceBlast = simulate('Ritualist', ["Ritualist's Shroud", 'Essence Blast'], { boons: { quickness: true } });
  const elixirs = simulate('Harbinger', ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition'], {
    boons: { quickness: true },
    initialBlight: 25,
    selectedSkills: ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition']
  });
  const blightSkills = simulate('Harbinger', ['Harbinger Shroud', 'Devouring Cut', 'Voracious Arc'], {
    boons: { quickness: true },
    initialBlight: 25
  });
  const manifestShade = simulate('Scourge', ['Manifest Sand Shade'], {
    boons: { quickness: true }
  });
  const customOffset = (result, skillName, skillId) => {
    const start = result.steps.find((step) => step.skill === skillName)?.start;
    const hit = result.events.find((event) => event.type === 'damage' && event.skillId === skillId);

    assert.notEqual(start, undefined, skillName);
    assert.ok(hit, skillName);

    return Math.round(hit.at * 1000 - start);
  };

  assert.equal(customOffset(devouringDarkness, 'Devouring Darkness', ID.DEVOURING_DARKNESS), 480);
  assert.equal(customOffset(essenceBlast, 'Essence Blast', ID.ESSENCE_BLAST), 560);
  assert.equal(customOffset(elixirs, 'Elixir of Promise', ID.ELIXIR_OF_PROMISE), 400);
  assert.equal(customOffset(elixirs, 'Elixir of Risk', ID.ELIXIR_OF_RISK), 504);
  assert.equal(customOffset(elixirs, 'Elixir of Ambition', ID.ELIXIR_OF_AMBITION), 400);
  assert.equal(customOffset(blightSkills, 'Devouring Cut', ID.DEVOURING_CUT), 360);
  assert.equal(customOffset(blightSkills, 'Voracious Arc', ID.VORACIOUS_ARC), 800);
  assert.equal(customOffset(manifestShade, 'Manifest Sand Shade', ID.MANIFEST_SAND_SHADE), 440);
});

test('Elixir of Anguish applies Cripple and Swiftness for their exact durations', () => {
  const base = simulate('Harbinger', ['Elixir of Anguish'], {
    initialBlight: 0,
    selectedSkills: ['Elixir of Anguish']
  });
  const empowered = simulate('Harbinger', ['Elixir of Anguish'], {
    initialBlight: 5,
    selectedSkills: ['Elixir of Anguish']
  });
  const durations = (result) => ({
    cripple: result.resolvedEvents.find(
      (event) => event.skillId === ID.ELIXIR_OF_ANGUISH && event.condition === 'Crippled'
    )?.duration,
    swiftness: result.events.find((event) => event.skillId === ID.ELIXIR_OF_ANGUISH && event.kind === 'swiftness')
      ?.duration
  });

  assert.deepEqual(durations(base), { cripple: 5, swiftness: 10 });
  assert.deepEqual(durations(empowered), { cripple: 10, swiftness: 20 });
});

test('Signet of Spite follows its live passive and active profile', () => {
  const withSignet = simulate('Core', ['Rending Claws', 'Death Shroud', 'Life Blast'], {
    initialResource: 100,
    primaryWeapon: 'Axe',
    selectedSkills: ['Signet of Spite']
  });
  const withoutSignet = simulate('Core', ['Rending Claws', 'Death Shroud', 'Life Blast'], {
    initialResource: 100,
    primaryWeapon: 'Axe',
    selectedSkills: ['Blood Is Power']
  });
  const active = simulate('Core', ['Signet of Spite', 'Rending Claws'], {
    boons: { quickness: true },
    primaryWeapon: 'Axe',
    selectedSkills: ['Signet of Spite']
  });
  const damage = (result, name) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === name)?.damage;
  const signetEvents = active.events.filter((event) => event.skillId === ID.SIGNET_OF_SPITE);
  const conditions = signetEvents
    .filter((event) => event.type === 'condition')
    .map((event) => [event.condition, event.stacks, event.duration]);

  assert.ok(damage(withSignet, 'Rending Claws') > damage(withoutSignet, 'Rending Claws'));
  assert.equal(damage(withSignet, 'Life Blast'), damage(withoutSignet, 'Life Blast'));
  assert.equal(damage(active, 'Rending Claws'), damage(withoutSignet, 'Rending Claws'));
  assert.equal(active.steps[0].fullCastMs, 880);
  assert.equal(necromancerCatalog.skillsById.get(ID.SIGNET_OF_SPITE).cooldown, 40);
  assert.equal(signetEvents.find((event) => event.type === 'damage')?.coefficient, 1);
  assert.deepEqual(conditions, [
    ['Bleeding', 2, 10],
    ['Poisoned', 2, 10],
    ['Torment', 2, 6],
    ['Crippled', 1, 10],
    ['Vulnerability', 5, 10],
    ['Weakness', 1, 10]
  ]);
  assert.equal(signetEvents.find((event) => event.type === 'blind')?.duration, 5);
  assert.deepEqual(
    signetEvents
      .filter((event) => event.type === 'condition' && event.condition === 'Vulnerability')
      .map((event) => [event.stacks, event.duration]),
    [[5, 10]]
  );
});

test('interrupt-safe Necromancer attacks retain their committed packets', () => {
  const soulSpiral = simulate(
    'Reaper',
    ["Reaper's Shroud", { name: 'Soul Spiral', interruptAfterMs: 120 }, { type: 'wait', durationMs: 2100 }],
    {
      boons: { quickness: true }
    }
  );
  const graspingDarkness = simulate(
    'Reaper',
    [
      { name: 'Grasping Darkness', interruptAfterMs: 120 },
      { type: 'wait', durationMs: 2000 }
    ],
    {
      boons: { quickness: true },
      primaryWeapon: 'Greatsword'
    }
  );
  const ghastlyClaws = simulate('Core', ['Ghastly Claws'], {
    boons: { quickness: true },
    primaryWeapon: 'Axe'
  });
  const executionersScythe = simulate(
    'Reaper',
    ["Reaper's Shroud", { name: "Executioner's Scythe", interruptAfterMs: 920 }],
    {
      boons: { quickness: true }
    }
  );
  const lifeReap = simulate(
    'Reaper',
    ["Reaper's Shroud", 'Life Rend', 'Life Slash', { name: 'Life Reap', interruptAfterMs: 360 }],
    {
      boons: { quickness: true }
    }
  );

  assert.equal(soulSpiral.steps[1].fullCastMs, 2160);
  assert.equal(
    soulSpiral.events.filter((event) => event.type === 'damage' && event.skillId === ID.SOUL_SPIRAL).length,
    12
  );
  assert.equal(
    soulSpiral.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === ID.SOUL_SPIRAL && event.condition === 'Poisoned'
    ).length,
    12
  );
  assert.equal(graspingDarkness.steps[0].fullCastMs, 520);
  const graspingDarknessHit = graspingDarkness.events.find(
    (event) => event.type === 'damage' && event.skillId === ID.GRASPING_DARKNESS
  );

  assert.equal(Math.round(graspingDarknessHit.at * 1000 - graspingDarkness.steps[0].start), 1440);
  assert.equal(
    graspingDarkness.events.filter((event) => event.type === 'damage' && event.skillId === ID.GRASPING_DARKNESS).length,
    1
  );
  const ghastlyPackets = ghastlyClaws.events.filter(
    (event) => event.type === 'damage' && event.skillId === ID.GHASTLY_CLAWS
  );

  assert.equal(ghastlyClaws.steps[0].fullCastMs, 1440);
  assert.equal(ghastlyPackets.length, 8);
  assert.equal(new Set(ghastlyPackets.map((event) => event.at)).size, 8);
  assert.equal(
    executionersScythe.events.filter((event) => event.type === 'damage' && event.skillId === ID.EXECUTIONERS_SCYTHE)
      .length,
    1
  );
  assert.equal(lifeReap.events.filter((event) => event.type === 'damage' && event.skillId === ID.LIFE_REAP).length, 0);
});

test('Dark Barrage retains every packet when interrupted at its 800 ms commit', () => {
  const run = (interruptMs) =>
    simulate('Harbinger', ['Harbinger Shroud', { name: 'Dark Barrage', interruptMs }], {
      boons: { quickness: true }
    });
  const beforeCommit = run(799);
  const committed = run(800);
  const skill = necromancerCatalog.skillsById.get(ID.DARK_BARRAGE);
  const packets = (result, type) =>
    result.events.filter((event) => event.type === type && event.skillId === ID.DARK_BARRAGE);

  assert.equal(skill.interruptCommitMs, 800);
  assert.equal(committed.steps[1].end, 800);
  assert.equal(committed.steps[1].fullCastMs, 920);
  assert.equal(committed.steps[1].interrupted, true);
  assert.equal(packets(beforeCommit, 'damage').length, 0);
  assert.equal(packets(beforeCommit, 'condition').length, 0);
  assert.equal(packets(committed, 'damage').length, 6);
  assert.equal(packets(committed, 'condition').length, 6);
});

test('Grasping Darkness commits at 120 ms and lands after combat starts', () => {
  const beforeCommit = simulate(
    'Reaper',
    [
      { name: 'Grasping Darkness', interruptAfterMs: 119 },
      { type: 'wait', durationMs: 2000 }
    ],
    {
      boons: { quickness: true },
      initialResource: 0,
      primaryWeapon: 'Greatsword'
    }
  );
  const committed = simulate(
    'Reaper',
    [
      { name: 'Grasping Darkness', interruptAfterMs: 120 },
      { type: 'wait', durationMs: 2000 }
    ],
    {
      boons: { quickness: true },
      initialResource: 0,
      primaryWeapon: 'Greatsword'
    }
  );
  const opener = simulate(
    'Reaper',
    [
      { name: 'Grasping Darkness', interruptAfterMs: 120 },
      'Nightfall',
      { name: '__combat_start', offset: 400 },
      { type: 'wait', durationMs: 2000 }
    ],
    {
      boons: { quickness: true },
      initialResource: 0,
      primaryWeapon: 'Greatsword'
    }
  );
  const graspingEvents = (result) =>
    result.events.filter(
      (event) =>
        event.skillId === ID.GRASPING_DARKNESS && ['damage', 'necromancer.chill', 'control'].includes(event.type)
    );
  const openerHit = opener.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.GRASPING_DARKNESS
  );
  const combatStart = opener.events.find((event) => event.type === 'combat_start');

  assert.deepEqual(graspingEvents(beforeCommit), []);
  assert.deepEqual(
    graspingEvents(committed).map((event) => Math.round(event.at * 1000)),
    [1440, 1440, 1440]
  );
  assert.equal(committed.endState.profession.lifeForce, 10);
  assert.equal(Math.round(combatStart.at * 1000), 520);
  assert.equal(Math.round(openerHit.at * 1000), 1440);
  assert.ok(openerHit.at > combatStart.at);
});

test('every catalog skill has mechanics and API aliases are excluded', () => {
  assert.equal(
    necromancerCatalog.skills.every((skill) => skill.implemented),
    true
  );
  assert.equal(
    necromancerCatalog.skills
      .filter((skill) => skill.simulatorAliasOfId != null)
      .every((skill) => skill.simulatorExcluded),
    true
  );
  for (const name of NECROMANCER_NON_DPS_SKILL_NAMES) {
    assert.equal(necromancerCatalog.skillsByName.get(name)?.simulatorExcluded, true, name);
  }

  for (const skill of necromancerCatalog.skills) {
    if (skill.simulatorExcluded) continue;
    assert.equal(
      Boolean(
        skill.handlerId ||
        skill.effects.length ||
        skill.lifeForceGain ||
        skill.flipParentId != null ||
        skill.type === 'Action'
      ),
      true,
      `${skill.id} ${skill.name}`
    );
  }
});

test('Core Death Shroud drains life force and gates transformed skills', () => {
  const result = simulate(
    'Core',
    ['Death Shroud', 'Life Blast', { type: 'wait', durationMs: 1000 }, 'End Death Shroud'],
    { initialResource: 100 }
  );
  const invalid = simulate('Core', ['Life Blast', 'Death Shroud', 'Rending Claws'], {
    initialResource: 100,
    primaryWeapon: 'Axe'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeShroud, '');
  assert.ok(result.endState.profession.lifeForce < 97);
  assert.ok(result.strikeDamage > 0);
  assert.equal(invalid.warnings.length, 2);
  assert.match(invalid.warnings.join(' '), /Life Blast is unavailable/);
  assert.match(invalid.warnings.join(' '), /Rending Claws is unavailable/);
});

test('Reaper Shroud enforces its chain and four-percent drain', () => {
  const result = simulate(
    'Reaper',
    [
      "Reaper's Shroud",
      'Life Rend',
      'Life Slash',
      'Life Reap',
      { type: 'wait', durationMs: 1000 },
      "Exit Reaper's Shroud"
    ],
    { initialResource: 100 }
  );
  const skipped = simulate('Reaper', ["Reaper's Shroud", 'Life Reap'], {
    initialResource: 100
  });

  assert.deepEqual(result.warnings, []);
  assert.ok(result.endState.profession.lifeForce < 93);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Life Reap'));
  assert.match(skipped.warnings.join(' '), /Life Reap is unavailable/);
});

test('Death and Reaper shrouds drain a percentage of the maximum life-force pool', () => {
  const drainAfterOneSecond = (specialization, enter, exit) =>
    simulate(specialization, [enter, { type: 'wait', durationMs: 1000 }, exit], {
      initialResource: 100,
      selectedTraitIds: [TRAIT.SOUL_BATTERY]
    }).endState.profession.lifeForce;

  assert.equal(drainAfterOneSecond('Core', 'Death Shroud', 'End Death Shroud'), 116.4);
  assert.equal(drainAfterOneSecond('Reaper', "Reaper's Shroud", "Exit Reaper's Shroud"), 115.2);
});

test('life-force capacity is 69% of health and Soul Battery increases it by 20%', () => {
  const base = simulate('Core', [], {
    initialResource: 100,
    stats: { vitality: 1000 }
  }).endState.profession;
  const battery = simulate('Core', [], {
    initialResource: 100,
    stats: { vitality: 1000 },
    selectedTraitIds: [TRAIT.SOUL_BATTERY]
  }).endState.profession;

  assert.equal(base.maximumHealth, 19212);
  assert.equal(base.lifeForcePoolCapacity, 19212 * 0.69);
  assert.equal(battery.lifeForcePoolCapacity, base.lifeForcePoolCapacity * 1.2);
});

test('Alchemic Vigor increases Harbinger health and its physical life-force pool', () => {
  const core = simulate('Core', [], { stats: { vitality: 1000 } }).endState.profession;
  const harbinger = simulate('Harbinger', [], { stats: { vitality: 1000 } }).endState.profession;

  assert.equal(harbinger.maximumHealth, core.maximumHealth + 2400);
  assert.equal(harbinger.lifeForcePoolCapacity, harbinger.maximumHealth * 0.69);
});

test('Reaper greatsword chain is ordered and Chilling Scythe recharges Gravedigger', async () => {
  const adapter = await loadProfessionAppAdapter('necromancer');
  const skills = weaponSkills({
    adapter,
    skills: necromancerCatalog.skills,
    build: {
      specialization: 'Reaper',
      weapons: ['Greatsword', ''],
      alternateWeapons: ['Axe', 'Focus'],
      specializations: [{ name: 'Reaper', traits: '1-1-1' }]
    },
    weaponData: {
      Greatsword: { wielding: '2h' },
      Axe: { wielding: '1h' },
      Focus: { wielding: '1h' }
    }
  });
  const result = simulate(
    'Reaper',
    ['Gravedigger', 'Dusk Strike', 'Fading Twilight', 'Chilling Scythe', 'Gravedigger'],
    {
      primaryWeapon: 'Greatsword',
      target: { conditions: {} }
    }
  );

  assert.deepEqual(
    skills.filter((skill) => skill.chainRoot === ID.DUSK_STRIKE).map((skill) => skill.name),
    ['Dusk Strike', 'Fading Twilight', 'Chilling Scythe']
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps.filter((step) => step.skill === 'Gravedigger').length, 2);
  assert.equal(
    result.events.some(
      (event) => event.type === 'necromancer.chill' && event.skillName === 'Chilling Scythe' && event.duration === 2
    ),
    true
  );
});

test("interrupted weapon skills and shroud entry reset Reaper's greatsword chain", () => {
  const config = {
    initialResource: 100,
    primaryWeapon: 'Greatsword',
    target: { conditions: {} }
  };
  const interrupted = simulate(
    'Reaper',
    ['Dusk Strike', { name: 'Grasping Darkness', interruptMs: 120 }, 'Dusk Strike'],
    config
  );
  const enteredShroud = simulate('Reaper', ['Dusk Strike', "Reaper's Shroud"], config);
  const shrouded = simulate(
    'Reaper',
    ['Dusk Strike', "Reaper's Shroud", "Exit Reaper's Shroud", 'Dusk Strike'],
    config
  );

  assert.deepEqual(interrupted.warnings, []);
  assert.deepEqual(
    interrupted.steps.map((step) => step.skill),
    ['Dusk Strike', 'Grasping Darkness', 'Dusk Strike']
  );
  assert.equal(interrupted.steps[1].interrupted, true);
  assert.equal(enteredShroud.endState.profession.autoattackChains[ID.DUSK_STRIKE], undefined);
  assert.deepEqual(shrouded.warnings, []);
  assert.deepEqual(
    shrouded.steps.map((step) => step.skill),
    ['Dusk Strike', "Reaper's Shroud", "Exit Reaper's Shroud", 'Dusk Strike']
  );
});

test('non-chain skills reset greatsword and spear autoattacks', () => {
  const greatsword = simulate('Reaper', ['Dusk Strike', 'Well of Suffering', 'Dusk Strike'], {
    primaryWeapon: 'Greatsword',
    target: { conditions: {} }
  });
  const spear = simulate('Harbinger', ['Dark Slash', 'Well of Suffering', 'Dark Slash'], {
    primaryWeapon: 'Spear',
    target: { conditions: {} }
  });

  assert.deepEqual(greatsword.warnings, []);
  assert.deepEqual(
    greatsword.steps.map((step) => step.skill),
    ['Dusk Strike', 'Well of Suffering', 'Dusk Strike']
  );
  assert.deepEqual(spear.warnings, []);
  assert.deepEqual(
    spear.steps.map((step) => step.skill),
    ['Dark Slash', 'Well of Suffering', 'Dark Slash']
  );
});

test('Gravedigger fully recharges when it hits below 50% target health', () => {
  const setup = simulate('Reaper', ['Dusk Strike'], {
    primaryWeapon: 'Greatsword',
    target: { health: 0, conditions: {} }
  });
  const result = simulate('Reaper', ['Dusk Strike', 'Gravedigger', 'Gravedigger'], {
    primaryWeapon: 'Greatsword',
    target: {
      health: setup.totalDamage * 1.5,
      conditions: {}
    }
  });
  const gravediggers = result.steps.filter((step) => step.skill === 'Gravedigger');

  assert.deepEqual(result.warnings, []);
  assert.equal(gravediggers.length, 2);
  assert.equal(gravediggers[1].start, gravediggers[0].end);
});

test('Reaper and Harbinger shroud transitions emit the current weapon set', () => {
  for (const [specialization, enter, exit] of [
    ['Reaper', "Reaper's Shroud", "Exit Reaper's Shroud"],
    ['Harbinger', 'Harbinger Shroud', 'Exit Harbinger Shroud']
  ]) {
    const result = simulate(specialization, [enter, exit], {
      initialResource: 100,
      weaponSet2Primary: 'Scepter',
      startingWeaponSet: 2
    });

    assert.deepEqual(
      result.events.filter((event) => event.type === 'weapon_set').map((event) => event.weaponSet),
      [2, 2],
      specialization
    );
  }
});

test('Scourge shades use ammo and shade skills spend life force', () => {
  const ammo = simulate(
    'Scourge',
    ['Manifest Sand Shade', 'Manifest Sand Shade', 'Manifest Sand Shade', 'Manifest Sand Shade'],
    { initialResource: 100 }
  );
  const cost = simulate('Scourge', ['Manifest Sand Shade', 'Nefarious Favor', { type: 'wait', durationMs: 1000 }], {
    initialResource: 30
  });

  assert.equal(ammo.endState.profession.shades.length, 2);
  assert.equal(ammo.endState.profession.lifeForce, 100);
  assert.equal(ammo.steps[3].start, 15720);
  assert.deepEqual(ammo.warnings, []);
  assert.ok(
    Math.abs(
      cost.endState.profession.lifeForce - (30 - normalizedNecromancerLifeForceCost(cost.endState.profession, 21))
    ) < 1e-12
  );
  assert.ok(cost.conditionDamage > 0);
});

test('Scourge shade costs and packets use their fixed PvE values', () => {
  const shade = simulate('Scourge', ['Manifest Sand Shade', 'Desert Shroud', { type: 'wait', durationMs: 6100 }], {
    initialResource: 100
  });
  const manifest = necromancerCatalog.skillsById.get(ID.MANIFEST_SAND_SHADE);
  const strikes = shade.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.DESERT_SHROUD && event.name === 'Desert Shroud'
  );
  const torment = shade.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.DESERT_SHROUD && event.duration === 5
  );

  assert.deepEqual(
    [ID.NEFARIOUS_FAVOR, ID.SAND_CASCADE, ID.GARISH_PILLAR, ID.DESERT_SHROUD, ID.SANDSTORM_SHROUD].map((skillId) =>
      Math.round(actualNecromancerLifeForceCost(necromancerCatalog.skillsById.get(skillId).lifeForceCost))
    ),
    [1935, 2487, 3685, 4606, 3224]
  );
  assert.equal(manifest.ammo, 3);
  assert.equal(manifest.ammoRecharge, 15);
  assert.ok(Math.abs(strikes.reduce((sum, event) => sum + event.coefficient, 0) - 3.15) < 1e-12);
  assert.equal(strikes.length, 7);
  assert.equal(torment.length, 7);
  assert.equal(
    torment.every((event) => event.stacks === 1 && event.duration === 5),
    true
  );
  const shadeProfile = necromancerCatalog.balanceProfilesById.get(SCOURGE_BALANCE_PROFILE_IDS.shade);

  assert.equal(shadeProfile.effects[0].coefficient, 0.666);
  assert.deepEqual(
    [shadeProfile.effects[1].condition, shadeProfile.effects[1].stacks, shadeProfile.effects[1].duration],
    ['Torment', 1, 2]
  );
});

test('Scourge barrier, shroud, and greater-shade traits trigger precisely', () => {
  const barrier = simulate('Scourge', ['Manifest Sand Shade', 'Sand Cascade', 'Sand Flare'], {
    initialResource: 100,
    selectedSkills: ['Sand Flare'],
    selectedTraitIds: [TRAIT.ABRASIVE_GRIT, TRAIT.DESERT_EMPOWERMENT],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const greaterShade = simulate(
    'Scourge',
    ['Manifest Sand Shade', 'Manifest Sand Shade', { type: 'wait', durationMs: 8100 }],
    {
      selectedTraitIds: [TRAIT.SAND_SAVANT]
    }
  );
  const sandstorm = simulate('Scourge', ['Sandstorm Shroud', { type: 'wait', durationMs: 4100 }], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.HERALD_OF_SORROW, TRAIT.SOUL_BARBS],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const buffs = (result, kind) => result.events.filter((event) => event.type === 'buff' && event.kind === kind);
  const sandstormTorment = sandstorm.resolvedEvents.find(
    (event) =>
      event.type === 'condition' &&
      event.skillId === ID.SANDSTORM_SHROUD &&
      event.condition === 'Torment' &&
      event.stacks === 6
  );

  assert.equal(buffs(barrier, 'might').length, 3);
  assert.equal(
    buffs(barrier, 'might').every(
      (event) =>
        event.stacks === 2 && event.duration === 6 && event.recipients === 'party' && event.affectsSummons === false
    ),
    true
  );
  assert.equal(buffs(barrier, 'alacrity').length, 3);
  assert.equal(
    buffs(barrier, 'alacrity').every(
      (event) => event.duration === 1.5 && event.recipients === 'party' && event.affectsSummons === false
    ),
    true
  );
  assert.equal(greaterShade.endState.profession.shades.length, 0);
  assert.equal(greaterShade.steps[1].start, 19_470);
  assert.equal(sandstormTorment?.duration, 5);
  assert.equal(sandstormTorment?.at, 3.5);
  assert.equal(
    sandstorm.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillId === ID.SANDSTORM_SHROUD && event.name === 'Sandstorm Shroud'
    )?.coefficient,
    3
  );
  assert.deepEqual(
    buffs(sandstorm, 'protection').map((event) => [event.at, event.duration]),
    [
      [0, 1.5],
      [1, 1.5],
      [2, 1.5],
      [3.5, 3]
    ]
  );
  assert.ok(buffs(sandstorm, 'protection').every((event) => event.recipients === 'party' && !event.affectsSummons));
  assert.deepEqual(
    buffs(sandstorm, 'necromancer-soul-barbs').map((event) => event.duration),
    [15]
  );
});

test('Sand Sage extends boons only while a Scourge shade is active', () => {
  const run = (selectedTraitIds) =>
    simulate('Scourge', ['Manifest Sand Shade', 'Blood Is Power'], {
      selectedSkills: ['Blood Is Power'],
      selectedTraitIds
    });
  const mightDuration = (result) =>
    result.events.find((event) => event.type === 'buff' && event.kind === 'might')?.duration;

  assert.equal(mightDuration(run([])), 20);
  assert.equal(mightDuration(run([TRAIT.SAND_SAGE])), 23);
});

test('Lingering Curse increases scepter base duration beyond the stat cap', () => {
  const config = {
    primaryWeapon: 'Scepter',
    stats: { expertise: 1500 }
  };
  const base = simulate('Core', ['Blood Curse'], config);
  const lingering = simulate('Core', ['Blood Curse'], {
    ...config,
    selectedTraitIds: [TRAIT.LINGERING_CURSE]
  });
  const bleedingDuration = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === ID.BLOOD_CURSE && event.condition === 'Bleeding'
    )?.effectiveDuration;

  assert.equal(bleedingDuration(base), 9);
  assert.equal(bleedingDuration(lingering), 13.5);
});

test('Harbinger Shroud generates and consumes expiring blight', () => {
  const generated = simulate(
    'Harbinger',
    ['Harbinger Shroud', { type: 'wait', durationMs: 3100 }, 'Exit Harbinger Shroud'],
    { initialResource: 100 }
  );
  const consumed = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Devouring Cut', 'Exit Harbinger Shroud', { type: 'wait', durationMs: 1000 }],
    {
      initialResource: 100,
      initialBlight: 5
    }
  );
  const expired = simulate('Harbinger', [{ type: 'wait', durationMs: 25_100 }], { initialBlight: 10 });
  const lateExit = simulate(
    'Harbinger',
    ['Harbinger Shroud', { type: 'wait', durationMs: 11_000 }, 'Exit Harbinger Shroud'],
    { initialResource: 100 }
  );

  assert.equal(generated.endState.profession.blight, 6);
  assert.equal(consumed.endState.profession.blight, 0);
  assert.ok(consumed.resolvedEvents.some((event) => event.condition === 'Torment' && event.stacks === 5));
  assert.equal(expired.endState.profession.blight, 0);
  assert.deepEqual(lateExit.warnings, []);
  assert.equal(lateExit.endState.profession.activeShroud, '');
});

test('shroud strikes use their fixed or equipped weapon strengths', () => {
  const core = simulate('Core', ['Death Shroud', 'Life Blast'], {
    initialResource: 100,
    primaryWeapon: 'Pistol'
  });
  const reaper = simulate('Reaper', ["Reaper's Shroud", 'Life Rend'], {
    initialResource: 100,
    primaryWeapon: 'Pistol'
  });
  const harbinger = simulate('Harbinger', ['Harbinger Shroud', 'Devouring Cut'], {
    initialResource: 100,
    primaryWeapon: 'Pistol'
  });
  const scourge = simulate('Scourge', ['Manifest Sand Shade'], {
    initialResource: 100,
    primaryWeapon: 'Pistol'
  });
  const ritualist = simulate(
    'Ritualist',
    [
      "Ritualist's Shroud",
      'Essence Blast',
      'Anguish',
      { type: 'wait', durationMs: 1200 },
      'Summon Spirits',
      { type: 'wait', durationMs: 2000 }
    ],
    {
      initialResource: 100,
      primaryWeapon: 'Pistol',
      weaponSet2Primary: 'Scepter',
      startingWeaponSet: 2
    }
  );
  const damage = (result, name) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === name);

  assert.equal(damage(core, 'Life Blast').skillWeapon, 'Hammer');
  assert.equal(damage(reaper, 'Life Rend').skillWeapon, 'Hammer');
  assert.equal(damage(harbinger, 'Devouring Cut').skillWeapon, 'Hammer');
  assert.equal(
    scourge.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.MANIFEST_SAND_SHADE)
      ?.skillWeapon,
    'Unequipped'
  );
  assert.equal(damage(ritualist, 'Essence Blast').skillWeapon, 'Scepter');
  assert.equal(damage(ritualist, 'Anguish').skillWeapon, 'Unequipped');
  assert.equal(damage(ritualist, 'Summon Spirits').skillWeapon, 'Unequipped');
});

test('Harbinger shroud attacks use their Blight thresholds and coefficients', () => {
  const run = (skill, initialBlight) =>
    simulate('Harbinger', ['Harbinger Shroud', skill, 'Exit Harbinger Shroud', { type: 'wait', durationMs: 7100 }], {
      initialResource: 100,
      initialBlight
    });
  const baseCut = run('Devouring Cut', 0);
  const empoweredCut = run('Devouring Cut', 5);
  const baseArc = run('Voracious Arc', 0);
  const empoweredArc = run('Voracious Arc', 5);
  const vitalDraw = run('Vital Draw', 0);
  const darkBarrage = run('Dark Barrage', 0);
  const strikeCoefficients = (result, skillId) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === skillId)
      .map((event) => event.coefficient);

  assert.deepEqual(strikeCoefficients(baseCut, ID.DEVOURING_CUT), [1]);
  assert.deepEqual(strikeCoefficients(empoweredCut, ID.DEVOURING_CUT), [2]);
  assert.deepEqual(strikeCoefficients(baseArc, ID.VORACIOUS_ARC), [1.4]);
  assert.deepEqual(strikeCoefficients(empoweredArc, ID.VORACIOUS_ARC), [2.8]);
  const vitalDrawCoefficients = strikeCoefficients(vitalDraw, ID.VITAL_DRAW);
  const darkBarrageCoefficients = strikeCoefficients(darkBarrage, ID.DARK_BARRAGE);

  assert.equal(vitalDrawCoefficients.length, 3);
  assert.ok(Math.abs(vitalDrawCoefficients.reduce((sum, value) => sum + value, 0) - 1.2) < 1e-12);
  assert.equal(darkBarrageCoefficients.length, 6);
  assert.ok(Math.abs(darkBarrageCoefficients.reduce((sum, value) => sum + value, 0) - 3.6) < 1e-12);
  assert.equal(empoweredCut.endState.profession.blight, 0);
  assert.equal(
    empoweredArc.events.some(
      (event) => event.type === 'necromancer.state' && event.reason === 'blight-skill' && event.state.blight === 0
    ),
    true
  );
  // The 1.26-second Arc cast generates two new Blight before shroud exit.
  assert.equal(empoweredArc.endState.profession.blight, 2);
  assert.equal(
    empoweredCut.resolvedEvents.some(
      (event) => event.condition === 'Torment' && event.stacks === 5 && event.duration === 5
    ),
    true
  );
  assert.equal(
    empoweredArc.resolvedEvents.some(
      (event) => event.condition === 'Torment' && event.stacks === 5 && event.duration === 7
    ),
    true
  );
  assert.equal(
    empoweredArc.events.some(
      (event) => event.type === 'control' && event.controlKind === 'daze' && event.duration === 0.5
    ),
    true
  );
});

test('Blight skills pay their cost before Wicked Corruption and elixirs', () => {
  const run = (skill, selectedTraitIds = []) =>
    simulate('Harbinger', ['Harbinger Shroud', skill, 'Exit Harbinger Shroud', 'Elixir of Risk'], {
      initialBlight: 25,
      selectedSkills: ['Elixir of Risk'],
      selectedTraitIds,
      stats: { precision: 4000 },
      target: {
        ...baseConfig.target,
        health: 1_000_000_000,
        conditions: { Vulnerability: 25 }
      }
    });

  for (const [skill, skillId, elixirConsumption] of [
    ['Devouring Cut', ID.DEVOURING_CUT, 15],
    ['Voracious Arc', ID.VORACIOUS_ARC, 17]
  ]) {
    const baseline = run(skill);
    const wicked = run(skill, [TRAIT.WICKED_CORRUPTION]);
    const skillDamage = (result) =>
      result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === skillId);
    const wickedStrike = skillDamage(wicked);

    assert.equal(wickedStrike.necromancerBlight, 20, skill);
    assert.ok(Math.abs(wickedStrike.damage / skillDamage(baseline).damage - 1.2) < 1e-12, skill);
    assert.equal(
      wicked.events.find((event) => event.type === 'necromancer.state' && event.reason === 'blight-skill')?.state
        .blight,
      20,
      skill
    );
    assert.equal(
      wicked.events.find((event) => event.type === 'necromancer.state' && event.reason === 'blight-consumed')?.state
        .blight,
      elixirConsumption,
      skill
    );
    assert.equal(wicked.endState.profession.blight, 25, skill);
  }
});

test('Spear skills generate, refresh, consume, and damage with Soul Shards', () => {
  const chain = simulate('Harbinger', ['Dark Slash', 'Deadly Slice', 'Sinister Stab'], {
    initialResource: 0,
    primaryWeapon: 'Spear'
  });
  const utility = simulate('Harbinger', ['Extirpate', 'Addle', 'Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    target: {
      ...baseConfig.target,
      health: 1_000_000_000
    }
  });
  const belowHalf = simulate('Harbinger', ['Extirpate', 'Addle', 'Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    target: {
      ...baseConfig.target,
      health: 20_000
    }
  });
  const expired = simulate('Harbinger', ['Dark Slash', 'Deadly Slice', { type: 'wait', durationMs: 10_100 }], {
    primaryWeapon: 'Spear'
  });
  const damageEvents = (result, skillId) =>
    result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);

  assert.deepEqual(
    damageEvents(chain, ID.DARK_SLASH).map((event) => event.coefficient),
    [1.2]
  );
  assert.deepEqual(
    damageEvents(chain, ID.DEADLY_SLICE).map((event) => event.coefficient),
    [1.4]
  );
  assert.deepEqual(
    damageEvents(chain, ID.SINISTER_STAB).map((event) => event.coefficient),
    [1.8]
  );
  assert.equal(chain.endState.profession.soulShards, 2);
  assert.equal(chain.endState.profession.lifeForce, 5);
  assert.equal(
    chain.events.some((event) => event.type === 'necromancer.chill' && event.skillId === ID.SINISTER_STAB),
    true
  );
  assert.equal(expired.endState.profession.soulShards, 0);

  assert.equal(utility.endState.profession.lifeForce, 22);
  assert.equal(utility.endState.profession.soulShards, 0);
  assert.equal(
    utility.events.some(
      (event) => event.type === 'buff' && event.skillId === ID.EXTIRPATE && event.kind === 'might' && event.stacks === 5
    ),
    true
  );
  assert.equal(
    utility.events.some(
      (event) => event.type === 'condition' && event.skillId === ID.EXTIRPATE && event.condition === 'Weakness'
    ),
    true
  );
  assert.equal(
    utility.events.some(
      (event) => event.type === 'control' && event.skillId === ID.ADDLE && event.controlKind === 'daze'
    ),
    true
  );
  assert.equal(
    utility.events.some(
      (event) => event.type === 'condition' && event.skillId === ID.ADDLE && event.condition === 'Immobilized'
    ),
    false
  );

  const perforate = damageEvents(utility, ID.PERFORATE).filter((event) => event.name === 'Perforate');
  const shards = damageEvents(utility, ID.SOUL_SHARDS).filter((event) => event.name === 'Soul Shards');
  const lowShards = damageEvents(belowHalf, ID.SOUL_SHARDS).filter((event) => event.name === 'Soul Shards');

  assert.equal(perforate.length, 7);
  assert.deepEqual(
    perforate.map((event) => event.coefficient),
    Array(7).fill(0.5)
  );
  assert.deepEqual(
    perforate.map((event) => event.coefficientModifiers),
    Array(7)
      .fill(null)
      .map(() => [
        {
          kind: 'target-health-below',
          threshold: 0.5,
          multiplier: 1.2
        }
      ])
  );
  assert.equal(shards.length, 4);
  assert.equal(
    shards.every((event) => event.parentSkillName === 'Perforate'),
    true
  );
  assert.equal(
    shards.every((event) => event.flatStrikePowerCoeff === 0.1),
    true
  );
  const normalShardDamage = utility.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Soul Shards'
  )?.damage;
  const lowShardDamage = Math.max(
    ...belowHalf.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Soul Shards')
      .map((event) => event.damage)
  );

  assert.ok(Math.abs(lowShardDamage / normalShardDamage - 1.5) < 1e-12);
  const normalPerforateDamage = utility.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Perforate'
  )?.damage;
  const lowPerforateDamage = Math.max(
    ...belowHalf.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Perforate')
      .map((event) => event.damage)
  );

  assert.ok(Math.abs(lowPerforateDamage / normalPerforateDamage - 1.2) < 1e-12);
});

test('Isolate and Distress expose the follow-up and reset Perforate', () => {
  const result = simulate('Harbinger', ['Perforate', 'Isolate', 'Distress', 'Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear'
  });
  const expiredFollowUp = simulate('Harbinger', ['Isolate', { type: 'wait', durationMs: 3100 }, 'Distress'], {
    primaryWeapon: 'Spear'
  });
  const delayedHitWindow = simulate('Harbinger', ['Isolate', { type: 'wait', durationMs: 2800 }, 'Distress'], {
    boons: { quickness: true },
    primaryWeapon: 'Spear'
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(delayedHitWindow.warnings, []);
  assert.equal(
    Math.round(
      delayedHitWindow.events.find((event) => event.type === 'damage' && event.skillId === ID.ISOLATE).at * 1000
    ),
    440
  );
  assert.equal(
    delayedHitWindow.events.find((event) => event.type === 'action' && event.skillId === ID.ISOLATE).rechargeReadyAt,
    18.44
  );
  assert.equal(result.steps[3].start < 8000, true);
  assert.equal(
    result.events.filter(
      (event) => event.type === 'damage' && event.skillId === ID.PERFORATE && event.name === 'Perforate'
    ).length,
    14
  );
  assert.equal(result.events.filter((event) => event.type === 'damage' && event.name === 'Soul Shards').length, 6);
  assert.equal(
    result.events.some(
      (event) => event.type === 'necromancer.state' && event.reason === 'distress' && event.state.soulShards === 6
    ),
    true
  );
  const rows = skillBreakdownRows(result);

  assert.equal(rows.find((row) => row.name === 'Perforate')?.hits, 14);
  assert.equal(rows.find((row) => row.name === 'Soul Shards')?.hits, 6);
  assert.equal(
    rows.find((row) => row.name === 'Soul Shards')?.icon,
    'https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png'
  );
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.chill' && event.skillId === ID.ISOLATE),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillId === ID.ISOLATE &&
        event.condition === 'Vulnerability' &&
        event.stacks === 8
    ),
    true
  );
  assert.match(expiredFollowUp.warnings.join(' '), /Distress is unavailable/);
});

test('Addle grants four shards to defiant foes and checks activation shards', () => {
  const normal = simulate('Harbinger', ['Addle'], {
    initialResource: 0,
    primaryWeapon: 'Spear'
  });
  const defiant = simulate('Harbinger', ['Addle'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    target: {
      ...baseConfig.target,
      defiant: true,
      activatingSkills: false
    }
  });
  const threshold = simulate('Harbinger', ['Dark Slash', 'Deadly Slice', 'Extirpate', 'Addle'], {
    initialResource: 0,
    primaryWeapon: 'Spear'
  });
  const immobilizes = (result) =>
    result.events.filter(
      (event) => event.type === 'condition' && event.skillId === ID.ADDLE && event.condition === 'Immobilized'
    );

  assert.equal(normal.endState.profession.soulShards, 2);
  assert.equal(normal.endState.profession.lifeForce, 10);
  assert.equal(immobilizes(normal).length, 0);
  assert.equal(normal.events.find((event) => event.type === 'control' && event.skillId === ID.ADDLE)?.duration, 0.25);
  assert.equal(defiant.endState.profession.soulShards, 4);
  assert.equal(defiant.endState.profession.lifeForce, 20);
  assert.equal(immobilizes(defiant).length, 0);
  assert.equal(defiant.events.find((event) => event.type === 'control' && event.skillId === ID.ADDLE)?.duration, 1.5);
  assert.equal(threshold.endState.profession.soulShards, 5);
  assert.equal(immobilizes(threshold).length, 1);
});

test('necromancer wells finish their pulses after the final rotation action', () => {
  for (const skill of ['Well of Darkness', 'Well of Suffering']) {
    const result = simulate(
      'Harbinger',
      [skill],
      {
        target: {
          ...baseConfig.target,
          health: 1_000_000_000
        }
      },
      observationTail(6000)
    );

    assert.equal(
      result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === skill).length,
      6,
      skill
    );
  }
});

test('dagger skills use their current PvE strike and bleeding mechanics', () => {
  const darkPact = simulate('Core', ['Dark Pact'], {
    initialResource: 0,
    primaryWeapon: 'Dagger'
  });
  const lifeSiphon = (targetBleeding) =>
    simulate(
      'Core',
      ['Life Siphon'],
      {
        primaryWeapon: 'Dagger',
        target: {
          ...baseConfig.target,
          conditions: {
            ...baseConfig.target.conditions,
            Bleeding: targetBleeding
          }
        }
      },
      observationTail(5000)
    );
  const plain = lifeSiphon(false);
  const bleeding = lifeSiphon(true);
  const siphonDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === ID.LIFE_SIPHON)
      .reduce((sum, event) => sum + event.damage, 0);

  assert.equal(
    darkPact.events.find((event) => event.type === 'damage' && event.skillId === ID.DARK_PACT)?.coefficient,
    2.4
  );
  assert.equal(
    darkPact.events.find(
      (event) => event.type === 'condition' && event.skillId === ID.DARK_PACT && event.condition === 'Bleeding'
    )?.stacks,
    2
  );
  assert.equal(
    darkPact.events.find(
      (event) => event.type === 'condition' && event.skillId === ID.DARK_PACT && event.condition === 'Immobilized'
    )?.duration,
    6
  );
  assert.deepEqual(
    darkPact.events
      .filter((event) => event.type === 'self_condition')
      .map((event) => [event.condition, event.stacks, event.duration]),
    [['Bleeding', 2, 10]]
  );
  assert.equal(plain.events.filter((event) => event.type === 'damage' && event.skillId === ID.LIFE_SIPHON).length, 9);
  assert.ok(Math.abs(siphonDamage(bleeding) / siphonDamage(plain) - 1.5) < 1e-12);
});

test('Overflowing Thirst grants the documented Taste for Blood stacks to five party members', () => {
  const cases = [
    ['Life Siphon', ID.LIFE_SIPHON, 3],
    ['Dark Pact', ID.DARK_PACT, 3],
    ['Deathly Swarm', ID.DEATHLY_SWARM, 3],
    ['Enfeebling Blood', ID.ENFEEBLING_BLOOD, 3]
  ];

  for (const [name, skillId, stacks] of cases) {
    const result = simulate(
      'Core',
      [name],
      {
        primaryWeapon: 'Dagger',
        secondaryWeapon: 'Dagger',
        selectedTraitIds: [TRAIT.OVERFLOWING_THIRST],
        allies: { count: 4 }
      },
      observationTail(2000)
    );
    const application = result.events.find(
      (event) => event.type === 'buff' && event.kind === 'taste-for-blood' && event.skillId === skillId
    );

    assert.equal(application?.stacks, stacks, name);
    assert.equal(application?.affectsSelf, true, name);
    assert.equal(application?.alliedPlayerCount, 4, name);
    assert.equal(application?.recipientCount, 5, name);
  }

  const chain = simulate('Core', ['Necrotic Slash', 'Necrotic Stab', 'Necrotic Bite'], {
    primaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.OVERFLOWING_THIRST]
  });
  const applications = chain.events.filter((event) => event.type === 'buff' && event.kind === 'taste-for-blood');

  assert.deepEqual(
    applications.map((event) => [event.skillId, event.stacks]),
    [[ID.NECROTIC_BITE, 1]]
  );
});

test('Taste for Blood consumes one stack per direct hit and deals a 0.05 life siphon', () => {
  const lifeSiphon = simulate(
    'Core',
    ['Life Siphon'],
    {
      primaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.OVERFLOWING_THIRST]
    },
    observationTail(3000)
  );
  const chain = simulate('Core', ['Necrotic Slash', 'Necrotic Stab', 'Necrotic Bite', 'Necrotic Slash'], {
    primaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.OVERFLOWING_THIRST]
  });
  const lifeSiphonPackets = lifeSiphon.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.OVERFLOWING_THIRST
  );
  const chainPackets = chain.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.OVERFLOWING_THIRST
  );
  const breakdown = skillBreakdownRows(lifeSiphon).find((row) => row.name === 'Taste for Blood');
  const traitIcon = necromancerCatalog.traits.find((trait) => trait.id === TRAIT.OVERFLOWING_THIRST)?.icon;

  assert.equal(lifeSiphonPackets.length, 3);
  assert.equal(chainPackets.length, 1);
  assert.equal(breakdown?.icon, traitIcon);
  assert.equal(
    lifeSiphonPackets.every(
      (event) => event.coefficient === 0.05 && event.damageKind === 'life-steal' && event.noCrit === true
    ),
    true
  );
});

test('allied players consume independent Taste for Blood stack pools', () => {
  const result = simulate(
    'Core',
    ['Life Siphon'],
    {
      primaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.OVERFLOWING_THIRST],
      allies: { count: 2, strikesPerSecond: 10 }
    },
    observationTail(3000)
  );
  const packets = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.OVERFLOWING_THIRST
  );
  const triggerCounts = packets.reduce((counts, event) => {
    counts[event.triggeredBy] = (counts[event.triggeredBy] || 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(triggerCounts, {
    'Allied Player 1 Attack': 3,
    'Allied Player 2 Attack': 3,
    'Life Siphon': 3
  });
});

test('Taste for Blood gives minions independent pools after higher-priority players', () => {
  const run = (allies) =>
    simulate(
      'Core',
      ['Summon Bone Minions', 'Life Siphon', { type: 'wait', durationMs: 5000 }],
      {
        primaryWeapon: 'Dagger',
        selectedSkills: ['Summon Bone Minions'],
        selectedTraitIds: [TRAIT.OVERFLOWING_THIRST],
        allies: { count: allies, strikesPerSecond: 0 }
      },
      observationTail(3000)
    );
  const minionPacketOwners = (result) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === 'damage' &&
          event.sourceId === TRAIT.OVERFLOWING_THIRST &&
          String(event.summonOwner).startsWith('minion:bone-minion:')
      )
      .map((event) => event.summonOwner);
  const uncapped = run(0);
  const partiallyCapped = run(3);
  const capped = run(4);
  const uncappedOwners = minionPacketOwners(uncapped);

  assert.equal(uncappedOwners.includes('minion:bone-minion:0'), true);
  assert.equal(uncappedOwners.includes('minion:bone-minion:1'), true);
  assert.deepEqual([...new Set(minionPacketOwners(partiallyCapped))], ['minion:bone-minion:0']);
  assert.deepEqual(minionPacketOwners(capped), []);
});

test('off-hand sword follow-ups use their complete PvE effects', () => {
  const result = simulate(
    'Core',
    ['Hungering Maelstrom', 'Devouring Visage', 'Gormandize', 'Consume'],
    {
      boons: { quickness: true },
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Sword',
      target: {
        ...baseConfig.target,
        health: 1_000_000_000
      }
    },
    observationTail(3000)
  );
  const damage = (skillId) => result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    damage(ID.HUNGERING_MAELSTROM).map((event) => event.coefficient),
    [2.75]
  );
  assert.deepEqual(
    damage(ID.DEVOURING_VISAGE).map((event) => event.coefficient),
    [1.5]
  );
  assert.deepEqual(
    damage(ID.GORMANDIZE).map((event) => event.coefficient),
    [2.5]
  );
  assert.deepEqual(
    damage(ID.CONSUME).map((event) => event.coefficient),
    Array(5).fill(0.5)
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'control' &&
        event.skillId === ID.DEVOURING_VISAGE &&
        event.controlKind === 'fear' &&
        event.duration === 1.5
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillId === ID.CONSUME &&
        event.condition === 'Weakness' &&
        event.duration === 4
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillId === ID.CONSUME &&
        event.kind === 'might' &&
        event.stacks === 5 &&
        event.duration === 8
    ),
    true
  );
});

test('Plaguelands, chill fields, and cooldown reset retain live behavior', () => {
  const plague = simulate(
    'Reaper',
    ['Plaguelands', '__cooldown_reset', 'Plaguelands'],
    {
      stats: { expertise: 1500 },
      selectedSkills: ['Plaguelands'],
      selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION],
      target: {
        ...baseConfig.target,
        health: 1_000_000_000
      }
    },
    observationTail(20_000)
  );
  const field = simulate(
    'Reaper',
    ["Reaper's Shroud", "Executioner's Scythe", 'Soul Spiral'],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.DEATHLY_CHILL],
      target: {
        ...baseConfig.target,
        health: 1_000_000_000
      }
    },
    observationTail(1000)
  );
  const plagueEvents = (type, condition) =>
    plague.events.filter(
      (event) =>
        event.type === type && event.skillId === ID.PLAGUELANDS && (condition == null || event.condition === condition)
    );

  assert.deepEqual(plague.warnings, []);
  assert.equal(plague.steps.filter((step) => step.skill === 'Plaguelands').length, 2);
  assert.equal(plagueEvents('damage').length, 18);
  assert.equal(plagueEvents('condition', 'Bleeding').length, 18);
  assert.equal(plagueEvents('condition', 'Poisoned').length, 16);
  assert.equal(plagueEvents('condition', 'Torment').length, 14);
  assert.deepEqual(
    plague.events
      .filter((event) => event.type === 'self_condition')
      .slice(0, 2)
      .map((event) => [event.condition, event.duration]),
    [
      ['Bleeding', 10],
      ['Poisoned', 4]
    ]
  );
  assert.equal(
    plague.events.some((event) => event.type === 'marker' && event.action === 'cooldown-reset'),
    true
  );
  assert.equal(
    field.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.DEATHLY_CHILL).length,
    9
  );
});

test('Death Spiral includes its life-siphon damage packet', () => {
  const result = simulate('Reaper', ['Death Spiral'], {
    primaryWeapon: 'Greatsword'
  });
  const packets = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.DEATH_SPIRAL);
  const siphon = packets.find((event) => event.damageKind === 'life-steal');
  const resolvedSiphon = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.DEATH_SPIRAL && event.damageKind === 'life-steal'
  );

  assert.deepEqual(
    packets.map((event) => event.name),
    ['Death Spiral', 'Death Spiral — Life Siphon']
  );
  assert.equal(siphon?.flatStrikeBase, 3517);
  assert.equal(siphon?.flatStrikePowerCoeff, 0.01);
  assert.equal(siphon?.noCrit, true);
  assert.equal(resolvedSiphon?.criticalChance, 0);
  assert.equal(resolvedSiphon?.damage, 3537);

  const rows = new Map(skillBreakdownRows(result).map((row) => [row.name, row]));

  assert.equal(rows.get('Death Spiral').hits, 1);
  assert.equal(rows.get('Death Spiral — Life Siphon').hits, 1);
  assert.equal(rows.get('Death Spiral — Life Siphon').parentSkill, 'Death Spiral');
});

test('Necromancer dark-field life steals inherit finisher attribution', () => {
  const scenarios = [
    {
      rotation: ['Nightfall', 'Death Spiral'],
      config: { primaryWeapon: 'Greatsword' },
      parentSkill: 'Death Spiral',
      hits: 2
    },
    {
      rotation: ['Nightfall', 'Gravedigger'],
      config: { primaryWeapon: 'Greatsword' },
      parentSkill: 'Gravedigger',
      hits: 3
    },
    {
      rotation: ['Well of Darkness', 'Extirpate'],
      config: {
        primaryWeapon: 'Spear',
        selectedSkills: ['Well of Darkness']
      },
      parentSkill: 'Extirpate',
      hits: 3
    }
  ];

  for (const scenario of scenarios) {
    const result = simulate('Ritualist', scenario.rotation, scenario.config);
    const combo = result.resolvedEvents.find(
      (event) =>
        event.type === 'combo' &&
        event.fieldType === 'Dark' &&
        event.finisherType === 'Whirl' &&
        event.skillName === scenario.parentSkill
    );
    const bolts = result.resolvedEvents.filter(
      (event) =>
        event.type === 'damage' &&
        event.name === 'Leeching Bolts' &&
        event.skillName === 'Leeching Bolts' &&
        event.parentSkillName === scenario.parentSkill
    );

    assert.equal(combo.applicationCount, scenario.hits);
    assert.equal(bolts.length, scenario.hits);
    assert.ok(
      bolts.every(
        (event) => event.flatStrikeBase === 170 && event.flatStrikePowerCoeff === 0.03 && event.noCrit === true
      )
    );
    const rows = skillBreakdownRows(result);

    assert.equal(rows.find((row) => row.name === scenario.parentSkill)?.hits, 1);
    const boltRow = rows.find((row) => row.name === 'Leeching Bolts');

    assert.equal(boltRow?.hits, scenario.hits);
    assert.equal(boltRow?.casts, 0);
  }

  const withoutField = simulate('Ritualist', ['Death Spiral'], {
    primaryWeapon: 'Greatsword'
  });

  assert.equal(
    withoutField.resolvedEvents.some((event) => event.type === 'combo' && event.fieldType === 'Dark'),
    false
  );
});

test('Reaper prioritizes assumed Ice and otherwise uses standard field resolution', () => {
  const rotation = ['Nightfall', "Reaper's Shroud", "Executioner's Scythe", "Exit Reaper's Shroud", 'Gravedigger'];
  const standard = simulate('Reaper', rotation, {
    initialResource: 100,
    primaryWeapon: 'Greatsword',
    boons: { quickness: true }
  });
  const assumed = simulate('Reaper', rotation, {
    initialResource: 100,
    primaryWeapon: 'Greatsword',
    boons: { quickness: true },
    professionAssumptions: { permanentIceField: true }
  });
  const standardExtirpate = simulate(
    'Reaper',
    ["Reaper's Shroud", "Executioner's Scythe", "Exit Reaper's Shroud", 'Well of Darkness', 'Extirpate'],
    {
      initialResource: 100,
      primaryWeapon: 'Spear',
      selectedSkills: ['Well of Darkness'],
      boons: { quickness: true }
    }
  );
  const extirpate = simulate('Reaper', ['Well of Darkness', 'Extirpate'], {
    primaryWeapon: 'Spear',
    selectedSkills: ['Well of Darkness'],
    professionAssumptions: { permanentIceField: true }
  });
  const gravediggerCombo = (result) =>
    result.resolvedEvents.find((event) => event.type === 'combo' && event.skillName === 'Gravedigger');
  const extirpateCombo = extirpate.resolvedEvents.find(
    (event) => event.type === 'combo' && event.skillName === 'Extirpate'
  );
  const standardExtirpateCombo = standardExtirpate.resolvedEvents.find(
    (event) => event.type === 'combo' && event.skillName === 'Extirpate'
  );

  assert.equal(gravediggerCombo(standard).fieldType, 'Dark');
  assert.equal(gravediggerCombo(assumed).fieldId, 'necromancer:assumption:permanent-ice-field');
  assert.equal(extirpateCombo.fieldId, 'necromancer:assumption:permanent-ice-field');
  assert.equal(standardExtirpateCombo.fieldType, 'Ice');
  assert.deepEqual(standard.warnings, []);
  assert.deepEqual(assumed.warnings, []);
  assert.deepEqual(standardExtirpate.warnings, []);
  assert.deepEqual(extirpate.warnings, []);
});

test('Greatsword control and Nightfall pulses use their live mechanics', () => {
  const nightfallSkill = necromancerCatalog.skillsById.get(ID.NIGHTFALL);
  const grasp = simulate('Harbinger', ['Grasping Darkness', { type: 'wait', durationMs: 2000 }], {
    initialResource: 0,
    primaryWeapon: 'Greatsword',
    relic: 'Claw'
  });
  const nightfall = simulate('Harbinger', ['Nightfall', { type: 'wait', durationMs: 4000 }], {
    initialResource: 0,
    primaryWeapon: 'Greatsword'
  });
  const nightfallHits = nightfall.events.filter((event) => event.type === 'damage' && event.skillId === ID.NIGHTFALL);

  assert.deepEqual(
    nightfallSkill.effects.map((effect) => effect.type),
    ['strike', 'blind', 'condition']
  );
  assert.deepEqual(
    nightfallSkill.effects.map((effect) => effect.applications ?? effect.hits),
    [4, 4, 4]
  );
  assert.deepEqual(
    grasp.events
      .filter((event) => event.type === 'damage' && event.skillId === ID.GRASPING_DARKNESS)
      .map((event) => event.coefficient),
    [1.3]
  );
  assert.equal(grasp.endState.profession.lifeForce, 10);
  assert.equal(
    grasp.events.some((event) => event.type === 'necromancer.chill' && event.skillId === ID.GRASPING_DARKNESS),
    true
  );
  assert.equal(
    grasp.events.some((event) => event.type === 'control' && event.controlKind === 'pull'),
    true
  );
  assert.equal(
    grasp.procSteps.some((step) => step.skill === 'Relic of the Claw'),
    true
  );

  assert.equal(nightfallHits.length, 4);
  assert.deepEqual(
    nightfallHits.map((event) => event.coefficient),
    [1.15, 1.15, 1.15, 1.15]
  );
  assert.deepEqual(
    nightfallHits.map((event, index) => Math.round((event.at - nightfallHits[0].at) * 1000) - index * 1000),
    [0, 0, 0, 0]
  );
  assert.equal(nightfall.events.filter((event) => event.type === 'blind' && event.skillId === ID.NIGHTFALL).length, 4);
  assert.equal(
    nightfall.events.filter(
      (event) => event.type === 'condition' && event.skillId === ID.NIGHTFALL && event.condition === 'Crippled'
    ).length,
    4
  );
  assert.equal(nightfall.endState.profession.lifeForce, 28);
});

test('Nightfall commits its declarative field at the first pulse', () => {
  const beforeCommit = simulate(
    'Harbinger',
    [
      {
        name: 'Nightfall',
        interruptAfterMs: 560
      },
      {
        type: 'wait',
        durationMs: 4000
      }
    ],
    {
      initialResource: 0,
      primaryWeapon: 'Greatsword'
    }
  );
  const afterCommit = simulate(
    'Harbinger',
    [
      {
        name: 'Nightfall',
        interruptAfterMs: 640
      },
      {
        type: 'wait',
        durationMs: 4000
      }
    ],
    {
      initialResource: 0,
      primaryWeapon: 'Greatsword'
    }
  );
  const quickness = simulate('Harbinger', ['Nightfall', { type: 'wait', durationMs: 4000 }], {
    boons: { quickness: true },
    initialResource: 0,
    primaryWeapon: 'Greatsword'
  });
  const nightfallHits = (result) =>
    result.events.filter((event) => event.type === 'damage' && event.skillId === ID.NIGHTFALL);

  assert.equal(nightfallHits(beforeCommit).length, 0);
  assert.equal(beforeCommit.endState.profession.lifeForce, 0);
  assert.equal(nightfallHits(afterCommit).length, 4);
  assert.equal(afterCommit.endState.profession.lifeForce, 28);
  assert.equal(quickness.steps[0].fullCastMs, 480);
  assert.deepEqual(
    nightfallHits(quickness).map(
      (event, index) => Math.round(event.at * 1000 - quickness.steps[0].start) - index * 1000
    ),
    [400, 400, 400, 400]
  );
});

test('Lich Form swaps its bar and grants life force on exit', () => {
  const result = simulate('Core', ['Lich Form', 'Deathly Claws', 'Exit Lich Form'], { initialResource: 0 });
  const invalid = simulate('Core', ['Lich Form', 'Rending Claws'], {
    initialResource: 0,
    primaryWeapon: 'Axe'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeShroud, '');
  assert.ok(result.endState.profession.lifeForce >= 15);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Deathly Claws'));
  assert.match(invalid.warnings.join(' '), /Rending Claws is unavailable/);
});

test('minion summons persist, attack, and unlock their command', () => {
  const result = simulate('Core', [
    'Summon Bone Fiend',
    { type: 'wait', durationMs: 4000 },
    'Rigor Mortis',
    { type: 'wait', durationMs: 1000 }
  ]);
  const invalid = simulate('Core', ['Rigor Mortis']);

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeMinions['bone-fiend'], 1);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Bone Shard'));
  assert.ok(result.breakdown.some((entry) => entry.name === 'Rigor Mortis - Bone Shard'));
  assert.match(invalid.warnings.join(' '), /Rigor Mortis is unavailable/);
});

test('Bone Fiend uses paired Bone Shards and its fourth crippling volley', () => {
  const result = simulate('Core', ['Summon Bone Fiend', { type: 'wait', durationMs: 14_000 }], {
    selectedSkills: ['Summon Bone Fiend']
  });
  const attacks = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.source === 'Minion' && [3633, 3644].includes(event.skillId)
  );
  const ordinary = attacks.filter((event) => event.skillId === 3633);
  const crippling = attacks.filter((event) => event.skillId === 3644);
  const cripples = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === 3644 && event.condition === 'Crippled'
  );

  assert.deepEqual(
    attacks.map((event) => event.skillId),
    [3633, 3633, 3633, 3633, 3633, 3633, 3644, 3644]
  );
  assert.equal(
    ordinary.every((event) => event.coefficient === 0.1),
    true
  );
  assert.equal(
    crippling.every((event) => event.coefficient === 0.2),
    true
  );
  assert.equal(
    attacks.every(
      (event) =>
        event.comboFinishers[0].ownerId === 'necromancer' &&
        event.comboFinishers[0].finisherType === 'Projectile' &&
        event.comboFinishers[0].chance === 1
    ),
    true
  );
  assert.ok(Math.abs(ordinary[1].at - ordinary[0].at - 0.04) < 1e-12);
  assert.ok(Math.abs(ordinary[2].at - ordinary[0].at - 3.08) < 1e-12);
  assert.equal(attacks[0].summonBasePower, 1500);
  assert.equal(attacks[0].summonDamagePerCoefficient, 1430);
  assert.equal(attacks[0].weaponStrength, undefined);
  assert.deepEqual(
    cripples.map((event) => [event.stacks, event.duration]),
    [
      [1, 2],
      [1, 2]
    ]
  );
});

test('Vampiric siphons on every direct player and minion hit with separate power scaling', () => {
  const player = simulate('Core', ['Ghastly Claws'], {
    primaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.VAMPIRIC],
    stats: { power: 1000 }
  });
  const condition = simulate('Core', ['Blood Curse', { type: 'wait', durationMs: 2000 }], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.VAMPIRIC],
    stats: { power: 1000 }
  });
  const minion = simulate('Core', ['Summon Bone Fiend', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Fiend'],
    selectedTraitIds: [TRAIT.VAMPIRIC],
    stats: { power: 1000 }
  });
  const playerSiphons = player.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC
  );
  const conditionSiphons = condition.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC
  );
  const minionHits = minion.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.source === 'Minion' && event.skillId === 3633
  );
  const minionSiphons = minion.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Vampiric — Minion Life Steal'
  );

  // Ghastly Claws proves there is no internal cooldown: all eight packets siphon.
  assert.equal(playerSiphons.length, 8);
  assert.equal(
    playerSiphons.every(
      (event) =>
        event.flatStrikeBase === 38 &&
        event.flatStrikePowerCoeff === 0.003 &&
        event.damage === 41 &&
        event.damageKind === 'life-steal' &&
        event.criticalChance === 0
    ),
    true
  );
  assert.equal(conditionSiphons.length, 1);
  assert.equal(minionHits.length > 0, true);
  assert.equal(minionSiphons.length, minionHits.length);
  assert.equal(
    minionSiphons.every(
      (event) =>
        event.flatStrikeBase === 50 &&
        event.flatStrikePowerCoeff === 0.0213 &&
        event.damage === 71.3 &&
        event.triggeredBy === 'Bone Shard'
    ),
    true
  );
});

test('Vampiric Presence uses its half-second interval and stronger Shroud siphon', () => {
  const base = simulate('Core', ['Ghastly Claws'], {
    primaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 }
  });
  const shroud = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud'], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 }
  });
  const baseSiphons = base.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC_PRESENCE
  );
  const shroudSiphon = shroud.resolvedEvents.find(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC_PRESENCE
  );

  assert.deepEqual(
    baseSiphons.map((event) => Number(event.at.toFixed(2))),
    [0.27, 0.81, 1.35, 1.89]
  );
  assert.equal(
    baseSiphons.every(
      (event) =>
        event.flatStrikeBase === 32 &&
        event.flatStrikePowerCoeff === 0.0333 &&
        Math.abs(event.damage - 65.3) < 1e-12 &&
        event.damageKind === 'life-steal' &&
        event.criticalChance === 0
    ),
    true
  );
  assert.equal(shroudSiphon.flatStrikeBase, 62);
  assert.equal(shroudSiphon.flatStrikePowerCoeff, 0.0666);
  assert.ok(Math.abs(shroudSiphon.damage - 128.6) < 1e-12);
});

test('Vampiric Presence supports four allied players and respects its five-target cap', () => {
  const allies = simulate('Core', [{ type: 'wait', durationMs: 1100 }], {
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 },
    allies: { count: 10, strikesPerSecond: 10 }
  });
  const minion = simulate('Core', ['Summon Bone Fiend', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Fiend'],
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 }
  });
  const cappedMinion = simulate('Core', ['Summon Bone Fiend', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Fiend'],
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 },
    allies: { count: 4, strikesPerSecond: 0 }
  });
  const boneMinions = (allies = 0) =>
    simulate('Core', ['Summon Bone Minions', { type: 'wait', durationMs: 4500 }], {
      selectedSkills: ['Summon Bone Minions'],
      selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
      stats: { power: 1000 },
      allies: { count: allies, strikesPerSecond: 0 }
    });
  const alliedSiphons = allies.resolvedEvents.filter(
    (event) => event.type === 'damage' && String(event.triggeredBy).startsWith('Allied Player')
  );
  const alliedRows = simulationEventLogRows(allies, null, necromancerProfession).filter((row) =>
    row.description.startsWith('HIT Vampiric Presence')
  );
  const minionSiphons = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Vampiric Presence' && event.triggeredBy === 'Bone Shard'
    );
  const boneMinionSiphons = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === 'damage' &&
        event.name === 'Vampiric Presence' &&
        String(event.summonOwner).startsWith('minion:bone-minion:')
    );
  const uncappedBoneMinions = boneMinions();
  const partiallyCappedBoneMinions = boneMinions(3);

  assert.equal(alliedSiphons.length, 8);
  assert.deepEqual(
    [...new Set(alliedSiphons.map((event) => event.triggeredBy))],
    ['Allied Player 1 Attack', 'Allied Player 2 Attack', 'Allied Player 3 Attack', 'Allied Player 4 Attack']
  );
  assert.equal(alliedRows.length, 8);
  for (let allyIndex = 1; allyIndex <= 4; allyIndex += 1) {
    assert.equal(
      alliedRows.some((row) => row.description.includes(`[Allied Player ${allyIndex} Attack]`)),
      true
    );
  }
  assert.equal(
    alliedSiphons.every((event) => Math.abs(event.damage - 65.3) < 1e-12),
    true
  );
  assert.equal(minionSiphons(minion).length > 0, true);
  assert.equal(minionSiphons(cappedMinion).length, 0);
  assert.deepEqual(
    [...new Set(boneMinionSiphons(uncappedBoneMinions).map((event) => event.summonOwner))],
    ['minion:bone-minion:0', 'minion:bone-minion:1']
  );
  assert.deepEqual(
    [...new Set(boneMinionSiphons(partiallyCappedBoneMinions).map((event) => event.summonOwner))],
    ['minion:bone-minion:0']
  );
  assert.equal(
    simulationEventLogRows(uncappedBoneMinions, null, necromancerProfession).some((row) =>
      row.description.startsWith('HIT Vampiric Presence [Bone Minion #1]')
    ),
    true
  );
});

test('Rigor Mortis is instant and fires two immobilizing projectile finishers', () => {
  const result = simulate('Core', ['Summon Bone Fiend', 'Rigor Mortis', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Fiend'],
    selectedTraitIds: [TRAIT.INSIDIOUS_DISRUPTION]
  });
  const preservedChain = simulate(
    'Core',
    ['Summon Bone Fiend', { type: 'wait', durationMs: 9500 }, 'Rigor Mortis', { type: 'wait', durationMs: 3000 }],
    { selectedSkills: ['Summon Bone Fiend'] }
  );
  const rigorStep = result.steps.find((step) => step.skill === 'Rigor Mortis');
  const attacks = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === 3634);
  const controls = result.events.filter(
    (event) =>
      event.type === 'necromancer.summon-attack' && event.skillId === 3634 && event.controlKind === 'immobilize'
  );
  const controlledFollowup = result.events.filter(
    (event) =>
      event.type === 'necromancer.summon-attack' && event.skillId === 3633 && event.controlKind === 'immobilize'
  );
  const disruptionTorment = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.INSIDIOUS_DISRUPTION
  );
  const preservedRigorStep = preservedChain.steps.find((step) => step.skill === 'Rigor Mortis');
  const firstFollowup = preservedChain.resolvedEvents.find(
    (event) =>
      event.type === 'damage' && [3633, 3644].includes(event.skillId) && event.at * 1000 > preservedRigorStep.start
  );

  assert.equal(necromancerCatalog.skillsByName.get('Rigor Mortis').recharge, 50);
  assert.equal(rigorStep.fullCastMs, 0);
  assert.deepEqual(
    attacks.map((event) => [event.coefficient, event.comboFinishers[0].chance]),
    [
      [0.25, 1],
      [0.25, 1]
    ]
  );
  assert.equal(
    attacks.every(
      (event) =>
        event.comboFinishers[0].finisherType === 'Projectile' && event.comboFinishers[0].ownerId === 'necromancer'
    ),
    true
  );
  assert.deepEqual(
    controls.map((event) => [event.controlKind, event.controlDuration]),
    [
      ['immobilize', 2],
      ['immobilize', 2]
    ]
  );
  assert.equal(controlledFollowup.length, 2);
  assert.equal(disruptionTorment.length, 4);
  assert.equal(firstFollowup.skillId, 3644);
});

test('Bone Fiend projectile finishers create Chilling Bolts, not Frost Aura', () => {
  const executionerField = simulate(
    'Reaper',
    [
      'Summon Bone Fiend',
      "Reaper's Shroud",
      "Executioner's Scythe",
      "Exit Reaper's Shroud",
      { type: 'wait', durationMs: 4000 }
    ],
    {
      initialResource: 100,
      selectedSkills: ['Summon Bone Fiend'],
      selectedTraitIds: [TRAIT.DEATHLY_CHILL]
    }
  );
  const result = simulate(
    'Reaper',
    ['Summon Bone Fiend', 'Nightfall', 'Rigor Mortis', { type: 'wait', durationMs: 14_000 }],
    {
      primaryWeapon: 'Greatsword',
      selectedSkills: ['Summon Bone Fiend'],
      selectedTraitIds: [TRAIT.DEATHLY_CHILL],
      professionAssumptions: { permanentIceField: true }
    }
  );
  const boneShards = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && [3633, 3634, 3644].includes(event.skillId)
  );
  const chillingCombos = result.resolvedEvents.filter(
    (event) => event.type === 'combo' && event.fieldType === 'Ice' && event.finisherType === 'Projectile'
  );
  const deathlyChill = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.DEATHLY_CHILL
  );
  const executionerCombos = executionerField.resolvedEvents.filter(
    (event) =>
      event.type === 'combo' &&
      event.fieldType === 'Ice' &&
      event.finisherType === 'Projectile' &&
      event.actorType === 'summon'
  );

  assert.equal(executionerCombos.length, 2);
  assert.equal(chillingCombos.length, boneShards.length);
  assert.equal(
    result.procSteps.filter(
      (step) => step.skill === 'Deathly Chill' && String(step.sourceSkill).startsWith('Rigor Mortis')
    ).length,
    2
  );
  assert.equal(deathlyChill.length, boneShards.length);
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        String(event.kind).toLowerCase().includes('frost') || String(event.name).toLowerCase().includes('frost aura')
    ),
    false
  );
});

test('player boon sharing can be disabled for Necromancer minions', () => {
  const rotation = ['Summon Bone Fiend', 'Blood Is Power', { type: 'wait', durationMs: 4000 }];
  const config = {
    selectedSkills: ['Summon Bone Fiend', 'Blood Is Power'],
    boons: { might: 0, fury: false }
  };
  const shared = simulate('Core', rotation, {
    ...config,
    sharePlayerBoonsWithSummons: true
  });
  const isolated = simulate('Core', rotation, {
    ...config,
    sharePlayerBoonsWithSummons: false
  });
  const capped = simulate('Core', rotation, {
    ...config,
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const minionDamage = (result) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.source === 'Minion' && event.parentSkillName === 'Summon Bone Fiend'
      )
      .reduce((sum, event) => sum + event.damage, 0);

  assert.ok(minionDamage(shared) > minionDamage(isolated));
  assert.equal(minionDamage(capped), minionDamage(isolated));
  assert.ok(minionDamage(isolated) > 0);

  const sharedMight = shared.events.find(
    (event) => event.type === 'buff' && event.skillId === ID.BLOOD_IS_POWER && event.kind === 'might'
  );
  const cappedMight = capped.events.find(
    (event) => event.type === 'buff' && event.skillId === ID.BLOOD_IS_POWER && event.kind === 'might'
  );

  assert.equal(sharedMight.recipients, 'party');
  assert.deepEqual(sharedMight.companionIds, ['minion:bone-fiend:0']);
  assert.equal(sharedMight.affectsSummons, true);
  assert.equal(cappedMight.affectsSummons, false);

  const partiallyCapped = simulate(
    'Core',
    ['Summon Bone Minions', 'Blood Is Power', { type: 'wait', durationMs: 4000 }],
    {
      selectedSkills: ['Summon Bone Minions', 'Blood Is Power'],
      boons: { might: 0, fury: false },
      allies: { count: 3, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    }
  );
  const damageByOwner = new Map();

  for (const event of partiallyCapped.resolvedEvents) {
    if (
      event.type === 'damage' &&
      event.source === 'Minion' &&
      String(event.summonOwner).startsWith('minion:bone-minion:')
    ) {
      damageByOwner.set(event.summonOwner, (damageByOwner.get(event.summonOwner) || 0) + event.damage);
    }
  }

  assert.ok(damageByOwner.get('minion:bone-minion:0') > damageByOwner.get('minion:bone-minion:1'));
});

test('unequipped Necromancer slot skills cannot execute', () => {
  const denied = simulate('Core', ['Summon Bone Minions'], {
    selectedSkills: ['Signet of Spite']
  });
  const equipped = simulate('Core', ['Summon Bone Minions'], {
    selectedSkills: ['Summon Bone Minions']
  });

  assert.match(denied.warnings.join(' '), /skill is not equipped/);
  assert.equal(
    denied.resolvedEvents.some((event) => event.skillName === 'Summon Bone Minions - Minion Attack'),
    false
  );
  assert.equal(equipped.warnings.length, 0);
  assert.equal(equipped.endState.profession.activeMinions['bone-minion'], 2);
});

test('persistent minion summons cannot recharge until their minions die', () => {
  for (const summon of ['Summon Bone Fiend', 'Summon Shadow Fiend', 'Summon Flesh Golem']) {
    const result = simulate('Core', [summon, { type: 'wait', durationMs: 60_000 }, summon], {
      selectedSkills: [summon]
    });

    assert.equal(result.steps.filter((step) => step.skill === summon && !step.invalid).length, 1, summon);
    assert.match(result.warnings.join(' '), /summoned minion is still alive/, summon);
    assert.equal(result.endState.cooldowns[summon], undefined, summon);
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(
        { professionState: result.endState.profession },
        necromancerCatalog.skillsByName.get(summon)
      ),
      false,
      summon
    );
  }
});

test('bone minion recharge starts after both minions are destroyed', () => {
  const result = simulate(
    'Core',
    ['Summon Bone Minions', 'Putrid Explosion', 'Putrid Explosion', 'Summon Bone Minions'],
    {
      selectedSkills: ['Summon Bone Minions']
    }
  );
  const summons = result.steps.filter((step) => step.skill === 'Summon Bone Minions' && !step.invalid);
  const explosions = result.steps.filter((step) => step.skill === 'Putrid Explosion' && !step.invalid);

  assert.deepEqual(result.warnings, []);
  assert.equal(explosions.length, 2);
  assert.equal(summons.length, 2);
  assert.equal(explosions[1].start, 2000);
  assert.equal(summons[1].start, 18_500);
  assert.equal(result.endState.profession.activeMinions['bone-minion'], 2);
});

test('minion attacks use their canonical cadence, coefficients, and icons', () => {
  const bloodFiend = simulate('Core', ['Summon Blood Fiend', { type: 'wait', durationMs: 6500 }], {
    selectedSkills: ['Summon Blood Fiend']
  });
  const boneMinions = simulate('Core', ['Summon Bone Minions', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Minions']
  });
  const fleshGolem = simulate('Core', ['Summon Flesh Golem', { type: 'wait', durationMs: 6500 }], {
    selectedSkills: ['Summon Flesh Golem']
  });
  const bloodAttacks = bloodFiend.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Summon Blood Fiend - Minion Attack'
  );
  const boneAttacks = boneMinions.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Summon Bone Minions - Minion Attack'
  );
  const golemAttacks = fleshGolem.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.parentSkillName === 'Summon Flesh Golem'
  );
  const golemIcon = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Fist.png';

  assert.ok(bloodAttacks.length >= 2);
  assert.equal(
    bloodAttacks.every((event) => event.coefficient === 0.065),
    true
  );
  assert.ok(Math.abs(bloodAttacks[1].at - bloodAttacks[0].at - 3.1) < 1e-12);
  assert.equal(bloodAttacks[0].summonBasePower, 2400);
  assert.equal(bloodAttacks[0].summonDamagePerCoefficient, 4338);
  assert.equal(bloodAttacks[0].weaponStrength, undefined);
  assert.equal(boneAttacks.length, 2);
  assert.equal(boneAttacks[0].summonBasePower, 2250);
  assert.equal(boneAttacks[0].summonDamagePerCoefficient, 4750);
  assert.equal(boneAttacks[0].weaponStrength, undefined);
  assert.deepEqual(
    golemAttacks
      .slice(0, 3)
      .map((event) => [
        event.skillId,
        event.skillName,
        event.coefficient,
        event.summonBasePower,
        event.summonDamagePerCoefficient,
        event.weaponStrength,
        event.icon
      ]),
    [
      [3653, 'Slash', 0.18, 2500, 3744, undefined, golemIcon],
      [3654, 'Slash', 0.18, 2500, 3744, undefined, golemIcon],
      [3655, 'Fist', 0.29, 2500, 3952, undefined, golemIcon]
    ]
  );
});

test('calibrated minion strikes ignore player Power and Signet of Spite', () => {
  for (const summon of ['Summon Blood Fiend', 'Summon Bone Fiend', 'Summon Bone Minions', 'Summon Flesh Golem']) {
    const rotation = [summon, { type: 'wait', durationMs: 6500 }];
    const minionDamage = (result) =>
      result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.source === 'Minion')
        .map((event) => event.damage);
    const lowPower = simulate('Core', rotation, {
      selectedSkills: [summon],
      stats: { power: 1000 }
    });
    const highPower = simulate('Core', rotation, {
      selectedSkills: [summon],
      stats: { power: 3000 }
    });
    const signet = simulate('Core', rotation, {
      selectedSkills: [summon, 'Signet of Spite'],
      stats: { power: 1000 }
    });

    assert.deepEqual(minionDamage(highPower), minionDamage(lowPower), summon);
    assert.deepEqual(minionDamage(signet), minionDamage(lowPower), summon);
  }

  const rotation = ['Summon Blood Fiend', { type: 'wait', durationMs: 6500 }];
  const totalMinionDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.source === 'Minion')
      .reduce((sum, event) => sum + event.damage, 0);
  const base = simulate('Core', rotation, {
    selectedSkills: ['Summon Blood Fiend']
  });
  const corruption = simulate('Core', rotation, {
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.NECROMANTIC_CORRUPTION]
  });
  const strength = simulate('Ritualist', rotation, {
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.SPIRITS_STRENGTH]
  });

  assert.ok(Math.abs(totalMinionDamage(corruption) / totalMinionDamage(base) - 1.25) < 1e-12);
  assert.ok(Math.abs(totalMinionDamage(strength) / totalMinionDamage(base) - 1.5) < 1e-12);
});

test('independent minions inherit dynamically shared Fury', () => {
  const rotation = [
    'Summon Blood Fiend',
    "Ritualist's Shroud",
    'Wanderlust',
    "Exit Ritualist's Shroud",
    { type: 'wait', durationMs: 6500 }
  ];
  const firstBloodFiendAttack = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.source === 'Minion' && event.skillId === ID.SUMMON_BLOOD_FIEND
    );
  const base = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedSkills: ['Summon Blood Fiend']
  });
  const empowered = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.EMPOWERING_SPIRITS]
  });
  const capped = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.EMPOWERING_SPIRITS],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const spiritRotation = ["Ritualist's Shroud", 'Wanderlust', { type: 'wait', durationMs: 6500 }];
  const spiritBase = simulate('Ritualist', spiritRotation, {
    initialResource: 100
  });
  const spiritEmpowered = simulate('Ritualist', spiritRotation, {
    initialResource: 100,
    selectedTraitIds: [TRAIT.EMPOWERING_SPIRITS],
    sharePlayerBoonsWithSummons: true
  });

  assert.equal(firstBloodFiendAttack(base).criticalChance, 0.05);
  assert.equal(firstBloodFiendAttack(empowered).criticalChance, 0.3);
  assert.equal(firstBloodFiendAttack(capped).criticalChance, 0.05);
  assert.ok(spiritBase.resolvedEvents.length > 0);
  const spiritBoons = spiritEmpowered.events.filter(
    (event) => event.type === 'buff' && event.skillId === ID.WANDERLUST && ['quickness', 'fury'].includes(event.kind)
  );

  assert.equal(spiritBoons.length, 2);
  assert.ok(
    spiritBoons.every(
      (event) => event.recipients === 'party' && event.affectsSummons === false && event.companionIds.length === 0
    )
  );
});

test("Shadow Fiend reports Slash and Haunt's full command effects", () => {
  const summonOnly = simulate('Core', ['Summon Shadow Fiend'], {
    initialResource: 0,
    selectedSkills: ['Summon Shadow Fiend']
  });
  const result = simulate('Core', ['Summon Shadow Fiend', 'Haunt', { type: 'wait', durationMs: 4500 }], {
    initialResource: 0,
    selectedSkills: ['Summon Shadow Fiend']
  });
  const haunt = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.HAUNT);
  const slash = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === 3642);
  const blind = result.events.find((event) => event.type === 'blind' && event.skillId === ID.HAUNT);
  const conditionDuration = (condition) =>
    result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === ID.HAUNT && event.condition === condition
    )?.duration;

  assert.deepEqual(result.warnings, []);
  assert.equal(haunt.coefficient, 0.4);
  assert.equal(haunt.summonDamagePerCoefficient, 1750);
  assert.equal(haunt.summonBasePower, 1700);
  assert.equal(haunt.summonCriticalChance, 0.05);
  assert.equal(haunt.summonCriticalDamage, 1.5);
  assert.equal(slash.skillName, 'Slash');
  assert.equal(slash.parentSkillName, 'Summon Shadow Fiend');
  assert.equal(slash.coefficient, 0.3);
  assert.equal(slash.summonDamagePerCoefficient, 1750);
  assert.equal(slash.summonBasePower, 1700);
  assert.equal(slash.weaponStrength, undefined);
  assert.equal(haunt.at - result.events.find((event) => event.type === 'action' && event.skillId === ID.HAUNT)?.at, 2);
  assert.equal(blind.duration, 5);
  assert.equal(conditionDuration('Chilled'), 3);
  assert.equal(conditionDuration('Weakness'), 5);
  assert.equal(result.endState.profession.lifeForce - summonOnly.endState.profession.lifeForce, 10);
});

test('Sinister Shroud reduces shroud-skill recharge by fifteen percent', () => {
  const rotation = ["Ritualist's Shroud", 'Anguish', 'Anguish'];
  const base = simulate('Ritualist', rotation);
  const sinister = simulate('Ritualist', rotation, {
    selectedTraitIds: [TRAIT.SINISTER_SHROUD]
  });
  const anguishActions = (result) =>
    result.events.filter((event) => event.type === 'action' && event.skillName === 'Anguish');

  assert.deepEqual(
    anguishActions(base).map((event) => event.rechargeReadyAt),
    [7.84, 15.68]
  );
  assert.deepEqual(
    anguishActions(sinister).map((event) => event.rechargeReadyAt),
    [6.79, 13.58]
  );
  assert.equal(
    base.steps.filter((step) => step.skill === 'Anguish')[1].start -
      sinister.steps.filter((step) => step.skill === 'Anguish')[1].start,
    1050
  );
});

test('Reaper traits reduce shroud cooldowns and ignore minion critical hits', () => {
  const rotation = ["Reaper's Shroud", "Death's Charge", 'Life Rend', 'Life Slash', 'Life Reap', "Death's Charge"];
  const base = simulate('Reaper', rotation, {
    boons: { quickness: true, alacrity: true }
  });
  const onslaught = simulate('Reaper', rotation, {
    boons: { quickness: true, alacrity: true },
    selectedTraitIds: [TRAIT.REAPERS_ONSLAUGHT]
  });
  const shroudDamageTraits = simulate('Reaper', rotation, {
    boons: { quickness: true, alacrity: true },
    selectedTraitIds: [TRAIT.REAPERS_ONSLAUGHT, TRAIT.DEATH_PERCEPTION]
  });
  const secondChargeStart = (result) => result.steps.filter((step) => step.skill === "Death's Charge")[1].start;
  const firstLifeRendDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Life Rend')?.damage || 0;

  assert.equal(secondChargeStart(base) - secondChargeStart(onslaught), 1000);
  assert.ok(firstLifeRendDamage(onslaught) > firstLifeRendDamage(base));
  assert.ok(firstLifeRendDamage(shroudDamageTraits) > firstLifeRendDamage(base) * 1.15);

  const nova = simulate(
    'Reaper',
    ['Summon Flesh Golem', "Reaper's Shroud", 'Soul Spiral', { type: 'wait', durationMs: 20_000 }],
    {
      boons: { quickness: true },
      selectedSkills: ['Summon Flesh Golem'],
      selectedTraitIds: [TRAIT.CHILLING_NOVA]
    }
  );
  const novaProcs = nova.procSteps.filter((step) => step.skill === 'Chilling Nova');

  assert.ok(novaProcs.length > 0);
  assert.equal(
    novaProcs.some((step) => step.sourceSkill === 'Summon Flesh Golem - Minion Attack'),
    false
  );
});

test('Reaper shouts apply their PvE melee damage bonus', () => {
  const melee = simulate('Reaper', ['"You Are All Weaklings!"'], {
    selectedSkills: ['"You Are All Weaklings!"']
  });
  const ranged = simulate('Reaper', ['"You Are All Weaklings!"'], {
    selectedSkills: ['"You Are All Weaklings!"'],
    target: {
      ...baseConfig.target,
      nearby: false
    }
  });

  assert.ok(Math.abs(melee.strikeDamage - ranged.strikeDamage * 2) < 1e-9);
});

test('Ritualist spirits attack, empower Essence Blast, and innervate', () => {
  const result = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', 'Essence Blast', 'Innervate Anguish', "Exit Ritualist's Shroud"],
    { initialResource: 50 }
  );
  const lingering = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', "Exit Ritualist's Shroud", { type: 'wait', durationMs: 8000 }],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS]
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.endState.profession.activeSpirits, {});
  assert.ok(result.endState.profession.lifeForce > 50);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Essence Blast'));
  assert.equal(lingering.endState.profession.activeSpirits.anguish, true);
  assert.ok(lingering.endState.profession.lifeForce < 90);
  assert.ok(lingering.breakdown.some((entry) => entry.name === 'Anguish Autoattack'));
});

test('Soul Twisting refunds only the first spirit summon after entering Ritualist Shroud', () => {
  const baseline = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish'], { initialResource: 100 });
  const twisting = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish', 'Wanderlust'], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SOUL_TWISTING]
  });

  assert.ok(baseline.endState.cooldowns.Anguish);
  assert.equal(twisting.endState.cooldowns.Anguish, undefined);
  assert.ok(twisting.endState.cooldowns.Wanderlust);
  assert.equal(twisting.endState.profession.soulTwistingAvailable, false);
});

test('Ritualist autoattacks and Painful Bond carry their source icons', () => {
  const anguish = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish', { type: 'wait', durationMs: 8000 }], {
    initialResource: 100
  });
  const wanderlust = simulate('Ritualist', ["Ritualist's Shroud", 'Wanderlust', { type: 'wait', durationMs: 8000 }], {
    initialResource: 100
  });
  const anguishIcon = necromancerCatalog.skillsById.get(ID.ANGUISH).icon;
  const wanderlustIcon = necromancerCatalog.skillsById.get(ID.WANDERLUST).icon;
  const anguishRows = skillBreakdownRows(anguish);
  const wanderlustRows = skillBreakdownRows(wanderlust);

  assert.equal(anguishRows.find((row) => row.name === 'Anguish Autoattack')?.icon, anguishIcon);
  assert.equal(anguishRows.find((row) => row.name === 'Painful Bond')?.icon, anguishIcon);
  assert.equal(wanderlustRows.find((row) => row.name === 'Wanderlust Autoattack')?.icon, wanderlustIcon);
});

test('Ritualist live spirit packets retain independent ownership and cadence', () => {
  const packets = simulate(
    'Ritualist',
    [
      "Ritualist's Shroud",
      'Anguish',
      'Wanderlust',
      'Preservation',
      'Essence Blast',
      { type: 'wait', durationMs: 6000 }
    ],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.EXPLOSIVE_GROWTH, TRAIT.SPIRITS_STRENGTH]
    }
  );
  const detachedBond = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', "Exit Ritualist's Shroud", { type: 'wait', durationMs: 8000 }],
    {
      initialResource: 100
    }
  );
  const damageEvents = packets.resolvedEvents.filter((event) => event.type === 'damage');
  const anguish = damageEvents.filter((event) => event.skillName === 'Anguish');
  const wanderlust = damageEvents.filter((event) => event.skillName === 'Wanderlust');
  const preservationAutos = damageEvents.filter((event) => event.skillName === 'Preservation Autoattack');
  const wanderlustAutos = damageEvents.filter((event) => event.skillName === 'Wanderlust Autoattack');
  const anguishAutos = damageEvents.filter((event) => event.skillName === 'Anguish Autoattack');
  const lingering = wanderlust.filter((event) => event.actorType === 'player' && event.source === 'Spirit');
  const essence = damageEvents.find((event) => event.skillName === 'Essence Blast');
  const growth = damageEvents.filter((event) => event.skillName === 'Explosive Growth');
  const growthRow = skillBreakdownRows(packets).find((row) => row.name === 'Explosive Growth');
  const bond = detachedBond.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Painful Bond'
  );
  const detachedAutos = detachedBond.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Anguish Autoattack'
  );

  assert.equal(anguish.length, 7);
  assert.equal(
    anguish.every((event) => event.actorType === 'player' && event.coefficient === 0.5 && event.weaponStrength === 805),
    true
  );
  assert.equal(lingering.length, 4);
  assert.equal(
    lingering.every((event) => event.coefficient === 0.45),
    true
  );
  assert.ok(preservationAutos.length > 0);
  assert.equal(
    preservationAutos.every(
      (event) =>
        event.actorType === 'summon' &&
        event.coefficient === 0.3 &&
        event.weaponStrength === 1565 &&
        event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(
    wanderlustAutos.every(
      (event) =>
        event.coefficient === 0.4 && event.weaponStrength === 1565 && event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(
    anguishAutos.every(
      (event) =>
        event.coefficient === 0.4 && event.weaponStrength === 1685 && event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(essence.coefficient, 0.75);
  assert.equal(essence.activeSpirits, 3);
  assert.equal(essence.essenceBlastDamagePerSpirit, 0.15);
  assert.equal(growth.length, 3);
  assert.equal(growthRow.hits, 3);
  assert.equal(growthRow.parentSkill, 'Anguish');
  assert.equal(detachedAutos.length, 0);
  assert.ok(bond.length >= 8);
  assert.equal(
    bond.slice(1).every((event, index) => Math.abs(event.at - bond[index].at - 1) < 1e-9),
    true
  );
});

test('Ritualist spirit autos inherit owner Fury without inheriting owner Might', () => {
  const rotation = ["Ritualist's Shroud", 'Anguish', { type: 'wait', durationMs: 8000 }];
  const run = (boons) =>
    simulate('Ritualist', rotation, {
      initialResource: 100,
      boons,
      sharePlayerBoonsWithSummons: false
    });
  const spiritAuto = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Anguish Autoattack');
  const baseline = spiritAuto(run({ might: 0, fury: false }));
  const might = spiritAuto(run({ might: 25, fury: false }));
  const fury = spiritAuto(run({ might: 0, fury: true }));

  assert.ok(baseline);
  assert.ok(might);
  assert.ok(fury);
  assert.equal(might.damage, baseline.damage);
  assert.equal(might.criticalChance, baseline.criticalChance);
  assert.equal(fury.criticalChance, Math.min(1, baseline.criticalChance + 0.25));
  assert.ok(fury.damage > baseline.damage);
});

test("Innervate Anguish uses profession-mechanic strength without Spirit's Strength", () => {
  const rotation = ["Ritualist's Shroud", 'Anguish', 'Innervate Anguish'];
  const baseline = simulate('Ritualist', rotation, {
    initialResource: 100
  });
  const strengthened = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SPIRITS_STRENGTH]
  });
  const innervate = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Innervate Anguish');
  const baselineHit = innervate(baseline);
  const strengthenedHit = innervate(strengthened);

  assert.ok(baselineHit);
  assert.ok(strengthenedHit);
  assert.equal(baselineHit.coefficient, 1.3);
  assert.equal(baselineHit.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.equal(baselineHit.resolvedWeaponStrength, 1100);
  assert.equal(strengthenedHit.damage, baselineHit.damage);
});

test("Spirit's Strength scales Ritualist minion strikes at the specialization boundary", () => {
  const run = (selectedTraitIds) =>
    simulate('Ritualist', ['Summon Bone Fiend', { type: 'wait', durationMs: 5000 }], {
      selectedSkills: ['Summon Bone Fiend'],
      selectedTraitIds
    });
  const strike = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.source === 'Minion' && event.parentSkillName === 'Summon Bone Fiend'
    );
  const baseline = strike(run([]));
  const strengthened = strike(run([TRAIT.SPIRITS_STRENGTH]));

  assert.ok(baseline);
  assert.ok(strengthened);
  assert.equal(strengthened.damage, baseline.damage * 1.5);
});

test('Ritualist weapon spells consume stacks and Resilient Weapon is usable', () => {
  const weaponSpells = simulate(
    'Ritualist',
    [
      'Nightmare Weapon',
      'Splinter Weapon',
      "Ritualist's Shroud",
      'Essence Blast',
      'Essence Blast',
      'Essence Blast',
      'Essence Blast',
      'Essence Blast'
    ],
    {
      initialResource: 100,
      selectedSkills: ['Nightmare Weapon', 'Splinter Weapon']
    }
  );
  const resilient = simulate('Ritualist', ['Resilient Weapon'], {
    selectedSkills: ['Resilient Weapon']
  });
  const nightmare = weaponSpells.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Nightmare Weapon'
  );
  const splinter = weaponSpells.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Splinter Weapon'
  );
  const nightmareIcon = necromancerCatalog.skillsById.get(ID.NIGHTMARE_WEAPON).icon;
  const splinterIcon = necromancerCatalog.skillsById.get(ID.SPLINTER_WEAPON).icon;
  const nightmareProcs = weaponSpells.procSteps.filter((step) => step.skill === 'Nightmare Weapon');
  const splinterProcs = weaponSpells.procSteps.filter((step) => step.skill === 'Splinter Weapon');

  assert.deepEqual(weaponSpells.warnings, []);
  assert.equal(nightmare.length, 5);
  assert.equal(splinter.length, 5);
  assert.equal(
    splinter.every((event) => event.coefficient === 0.4),
    true
  );
  assert.equal(
    nightmareProcs.every((step) => step.icon === nightmareIcon),
    true
  );
  assert.equal(
    splinterProcs.every((step) => step.icon === splinterIcon),
    true
  );
  const nightmareProc = necromancerCatalog.balanceProfilesById.get(RITUALIST_BALANCE_PROFILE_IDS.nightmareWeaponProc);

  assert.equal(nightmareProc.effects[1].stacks, 2);
  assert.equal(nightmareProc.effects[1].duration, 8);
  assert.deepEqual(resilient.warnings, []);
  assert.equal(
    resilient.events.some(
      (event) => event.type === 'necromancer.weapon-spell' && event.spell === 'resilient' && event.playerStacks === 5
    ),
    true
  );
  assert.equal(NECROMANCER_NON_DPS_SKILL_NAMES.has('Resilient Weapon'), false);
});

test('Ritualist weapon spells scale with allied players', () => {
  const rotation = ['Nightmare Weapon', 'Splinter Weapon'];
  const solo = simulate(
    'Ritualist',
    rotation,
    {
      selectedSkills: rotation,
      allies: { count: 0, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const party = simulate(
    'Ritualist',
    rotation,
    {
      selectedSkills: rotation,
      allies: { count: 4, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const allyProcs = party.resolvedEvents.filter((event) => event.type === 'damage' && event.triggeredByAlly);
  const applicationEvents = party.events.filter((event) => event.type === 'necromancer.weapon-spell');

  assert.equal(solo.totalDamage, 0);
  assert.ok(party.totalDamage > solo.totalDamage);
  assert.equal(allyProcs.filter((event) => event.name === 'Nightmare Weapon').length, 12);
  assert.equal(allyProcs.filter((event) => event.name === 'Splinter Weapon').length, 12);
  assert.deepEqual([...new Set(allyProcs.map((event) => event.triggeredByAlly))], [1, 2, 3, 4]);
  assert.equal(
    applicationEvents.every(
      (event) => event.alliedPlayerCount === 4 && event.recipientCount === 5 && event.recipients.length === 0
    ),
    true
  );

  const wieldersBoon = simulate(
    'Ritualist',
    ['Nightmare Weapon'],
    {
      selectedSkills: ['Nightmare Weapon'],
      selectedTraitIds: [TRAIT.WIELDERS_BOON],
      allies: { count: 1, strikesPerSecond: 10 }
    },
    observationTail(2000)
  );

  assert.equal(
    wieldersBoon.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Nightmare Weapon' && event.triggeredByAlly === 1
    ).length,
    5
  );
});

test('Ritualist weapon spells prioritize players, include minions, and exclude spirits', () => {
  const result = simulate(
    'Ritualist',
    ['Summon Bone Minions', "Ritualist's Shroud", 'Anguish', "Exit Ritualist's Shroud", 'Nightmare Weapon'],
    {
      initialResource: 100,
      selectedSkills: ['Summon Bone Minions', 'Nightmare Weapon'],
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS],
      allies: { count: 2, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const application = result.events.find(
    (event) => event.type === 'necromancer.weapon-spell' && event.spell === 'nightmare'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.profession.activeSpirits.anguish, true);
  assert.equal(application.alliedPlayerCount, 2);
  assert.equal(application.recipientCount, 5);
  assert.deepEqual(application.recipients, ['minion:bone-minion:0', 'minion:bone-minion:1']);
  assert.equal(
    application.recipients.some((recipient) => recipient.startsWith('spirit:')),
    false
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Nightmare Weapon' && event.triggeredByAlly
    ).length,
    6
  );
});

test('Necromancer trait procs resolve from real event state', () => {
  const dhuumfire = simulate(
    'Core',
    ['Death Shroud', 'Life Blast', 'End Death Shroud', { type: 'wait', durationMs: 3100 }],
    { selectedTraitIds: [TRAIT.DHUUMFIRE] }
  );
  const demonicLore = simulate('Scourge', ['Manifest Sand Shade', { type: 'wait', durationMs: 3100 }], {
    selectedTraitIds: [TRAIT.DEMONIC_LORE]
  });
  const deathlyChill = simulate(
    'Reaper',
    ["Reaper's Shroud", "Executioner's Scythe", "Exit Reaper's Shroud", { type: 'wait', durationMs: 3100 }],
    { selectedTraitIds: [TRAIT.DEATHLY_CHILL] }
  );

  assert.ok(dhuumfire.resolvedEvents.some((event) => event.name === 'Dhuumfire - Burning'));
  assert.ok(demonicLore.resolvedEvents.some((event) => event.name === 'Demonic Lore - Burning'));
  assert.ok(deathlyChill.resolvedEvents.some((event) => event.name === 'Deathly Chill - Bleeding'));
});

test('Blood Is Power and Plague Signet preserve transferred conditions', () => {
  const result = simulate('Harbinger', ['Blood Is Power', 'Plague Signet', { type: 'wait', durationMs: 10_100 }], {
    selectedSkills: ['Blood Is Power', 'Plague Signet'],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION]
  });
  const transferred = result.resolvedEvents.filter((event) => event.transferredCondition);

  assert.deepEqual(result.warnings, []);
  assert.equal(
    transferred.some((event) => event.condition === 'Bleeding' && event.stacks === 2),
    true
  );
  assert.equal(
    transferred.some((event) => event.condition === 'Torment' && event.stacks === 2),
    true
  );
  assert.deepEqual(result.endState.profession.selfConditions, []);
  assert.equal(
    transferred.every((event) => Math.abs(event.effectiveDuration - 10) < 0.0001),
    true
  );
});

test('Plague Sending treats Scourge F5 as entering shroud', () => {
  const result = simulate('Scourge', ['Desert Shroud', 'Blood Is Power', { type: 'wait', durationMs: 10_100 }], {
    initialResource: 100,
    selectedSkills: ['Blood Is Power'],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION, TRAIT.PLAGUE_SENDING]
  });
  const transferred = result.resolvedEvents.filter((event) => event.transferredCondition);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    transferred.map((event) => [event.condition, event.stacks]),
    [
      ['Bleeding', 2],
      ['Torment', 2]
    ]
  );
  assert.deepEqual(result.endState.profession.selfConditions, []);
});

test('Dhuumfire uses the specialization duration split and Scourge ICD', () => {
  const core = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud'], {
    selectedTraitIds: [TRAIT.DHUUMFIRE]
  });
  const harbinger = simulate('Harbinger', ['Harbinger Shroud', 'Tainted Bolts', 'Exit Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.DHUUMFIRE]
  });
  const scourge = simulate(
    'Scourge',
    ['Manifest Sand Shade', 'Garish Pillar', { type: 'wait', durationMs: 1100 }, 'Sand Cascade'],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.DHUUMFIRE]
    }
  );
  const applications = (result) =>
    result.resolvedEvents.filter((event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning');

  assert.deepEqual(
    applications(core).map((event) => event.duration),
    [3]
  );
  assert.deepEqual(
    applications(harbinger).map((event) => event.duration),
    [1, 1]
  );
  assert.deepEqual(
    applications(scourge).map((event) => event.duration),
    [2, 2]
  );
  assert.ok(applications(scourge)[1].at - applications(scourge)[0].at >= 1);
});

test('Desert Shroud pulses do not retrigger shroud skill-one traits', () => {
  const result = simulate('Scourge', ['Desert Shroud', { type: 'wait', durationMs: 6100 }], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.DHUUMFIRE]
  });
  const applications = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning'
  );

  assert.equal(applications.length, 1);
});

test('requested Harbinger damage traits apply at their per-hit triggers', () => {
  const result = simulate(
    'Harbinger',
    [
      'Harbinger Shroud',
      'Tainted Bolts',
      'Dark Barrage',
      'Vital Draw',
      'Exit Harbinger Shroud',
      { type: 'wait', durationMs: 3100 }
    ],
    {
      initialResource: 100,
      initialBlight: 10,
      selectedTraitIds: [TRAIT.DHUUMFIRE, TRAIT.UNYIELDING_BLAST, TRAIT.SEPTIC_CORRUPTION, TRAIT.INSIDIOUS_DISRUPTION]
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.filter((event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning').length,
    2
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.skillId === ID.TAINTED_BOLTS && event.condition === 'Torment').length,
    2
  );
  assert.equal(result.procSteps.filter((step) => step.skill === 'Unyielding Blast').length, 1);
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.sourceId === TRAIT.SEPTIC_CORRUPTION && event.condition === 'Poisoned'
    ).length,
    6
  );
  const insidiousDisruption = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.INSIDIOUS_DISRUPTION && event.condition === 'Torment'
  );

  assert.equal(insidiousDisruption.length, 3);
  assert.ok(insidiousDisruption.every((event) => event.duration === 5));
});

test('Barbed Precision uses centered deterministic expected procs', () => {
  const result = simulate('Harbinger', ['Weeping Shots', { type: 'wait', durationMs: 4100 }], {
    primaryWeapon: 'Pistol',
    stats: { precision: 4000 },
    selectedTraitIds: [TRAIT.BARBED_PRECISION]
  });
  const applications = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.BARBED_PRECISION && event.condition === 'Bleeding'
  );

  // Six guaranteed critical hits have 1.98 expected procs. Centered cumulative
  // rounding materializes two whole applications instead of flooring to one.
  assert.equal(applications.length, 2);
  assert.ok(applications.every((application) => application.duration === 3));
  assert.ok(applications.every((application) => Math.abs(application.effectiveDuration - 3.6) < 1e-12));
});

test('Devouring Darkness scales torment with distinct target conditions', () => {
  const result = simulate('Core', ['Devouring Darkness', { type: 'wait', durationMs: 4100 }], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.LINGERING_CURSE],
    target: {
      conditions: {
        Bleeding: true,
        Burning: true,
        Chilled: true,
        Poisoned: true,
        Torment: true,
        Vulnerability: 25
      }
    }
  });
  const application = result.resolvedEvents.find(
    (event) => event.skillId === ID.DEVOURING_DARKNESS && event.condition === 'Torment'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(application?.stacks, 5);
  assert.equal(application?.effectiveDuration, 4);
});

test('current Harbinger grandmaster traits use their live PvE mechanics', () => {
  const cascadingFromStartingStacks = simulate('Harbinger', ['Elixir of Promise'], {
    initialBlight: 5,
    initialCascadingCorruptionStacks: 15,
    selectedSkills: ['Elixir of Promise'],
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
  });
  const cascading = simulate(
    'Harbinger',
    ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition', { type: 'wait', durationMs: 6100 }],
    {
      initialBlight: 25,
      selectedSkills: ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition'],
      selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
    }
  );
  const precombat = simulate(
    'Harbinger',
    [
      'Elixir of Promise',
      { name: '__combat_start' },
      'Elixir of Risk',
      'Elixir of Ambition',
      { type: 'wait', durationMs: 6100 }
    ],
    {
      initialBlight: 25,
      selectedSkills: ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition'],
      selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
    }
  );
  const deathlyHaste = simulate('Harbinger', ['Harbinger Shroud', 'Dark Barrage', 'Exit Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.DEATHLY_HASTE],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const twistedMedicine = simulate('Harbinger', ['Elixir of Risk'], {
    selectedSkills: ['Elixir of Risk'],
    selectedTraitIds: [TRAIT.TWISTED_MEDICINE],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const doom = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Tainted Bolts', 'Dark Barrage', 'Exit Harbinger Shroud', { type: 'wait', durationMs: 3100 }],
    {
      selectedTraitIds: [TRAIT.DOOM_APPROACHES]
    }
  );

  assert.deepEqual(cascading.warnings, []);
  assert.equal(
    cascadingFromStartingStacks.breakdown.some((entry) => entry.name === 'Cascading Corruption'),
    true
  );
  assert.equal(cascadingFromStartingStacks.endState.profession.cascadingCorruptionStacks, 0);
  const riskWeakness = cascading.resolvedEvents.find(
    (event) => event.skillId === ID.ELIXIR_OF_RISK && event.condition === 'Weakness'
  );

  assert.deepEqual(
    {
      stacks: riskWeakness?.stacks,
      duration: riskWeakness?.duration,
      effectiveDuration: riskWeakness?.effectiveDuration
    },
    {
      stacks: 1,
      duration: 10,
      effectiveDuration: 10
    }
  );
  const cascadingStrike = cascading.resolvedEvents.find(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.CASCADING_CORRUPTION
  );
  const cascadingTorment = cascading.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.CASCADING_CORRUPTION
  );

  assert.deepEqual(
    {
      skillId: cascadingStrike?.skillId,
      skillName: cascadingStrike?.skillName,
      parentSkillName: cascadingStrike?.parentSkillName
    },
    {
      skillId: ID.CASCADING_CORRUPTION,
      skillName: 'Cascading Corruption',
      parentSkillName: 'Elixir of Ambition'
    }
  );
  assert.deepEqual(
    {
      name: cascadingTorment?.name,
      skillId: cascadingTorment?.skillId,
      skillName: cascadingTorment?.skillName,
      parentSkillName: cascadingTorment?.parentSkillName,
      condition: cascadingTorment?.condition,
      stacks: cascadingTorment?.stacks,
      effectiveDuration: cascadingTorment?.effectiveDuration
    },
    {
      name: 'Cascading Corruption — Torment',
      skillId: ID.CASCADING_CORRUPTION,
      skillName: 'Cascading Corruption',
      parentSkillName: 'Elixir of Ambition',
      condition: 'Torment',
      stacks: 6,
      effectiveDuration: 6
    }
  );
  const cascadingRow = skillBreakdownRows(cascading).find((row) => row.name === 'Cascading Corruption');

  assert.ok(cascadingRow?.strike > 0);
  assert.ok(cascadingRow?.condition > 0);
  assert.equal(cascadingRow?.hits, 1);
  assert.equal(cascadingRow?.casts, 0);
  assert.equal(cascadingRow?.parentSkill, 'Elixir of Ambition');
  const meltdown = cascading.procSteps.find((step) => step.skill === 'Meltdown');

  assert.equal(meltdown?.icon, 'https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png');
  assert.equal(
    precombat.breakdown.some((entry) => entry.name === 'Cascading Corruption'),
    false
  );
  assert.equal(
    deathlyHaste.events.filter((event) => event.kind === 'quickness' && event.sourceId !== TRAIT.SOUL_BARBS).length,
    2
  );
  assert.ok(
    deathlyHaste.events
      .filter(
        (event) =>
          event.type === 'buff' && ['quickness', 'fury'].includes(event.kind) && event.sourceId !== TRAIT.SOUL_BARBS
      )
      .every((event) => event.recipients === 'party' && event.affectsSummons === false)
  );
  const twistedMedicineBoons = twistedMedicine.events.filter(
    (event) => event.type === 'buff' && ['might', 'fury'].includes(event.kind)
  );

  assert.equal(twistedMedicineBoons.length, 2);
  assert.ok(twistedMedicineBoons.every((event) => event.recipients === 'party' && event.affectsSummons === false));
  assert.equal(doom.events.filter((event) => event.type === 'damage' && event.skillId === ID.DARK_BARRAGE).length, 8);
  assert.equal(
    doom.procSteps.some((step) => step.skill === 'Doom Approaches'),
    true
  );
});

test('Soul Barbs and Dark Gunslinger change their documented outputs', () => {
  const soulBarbs = simulate('Harbinger', ['Harbinger Shroud', 'Tainted Bolts', 'Exit Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.SOUL_BARBS]
  });
  const basePistol = simulate('Harbinger', ['Vile Blast', 'Vile Blast'], {
    primaryWeapon: 'Pistol'
  });
  const gunslinger = simulate('Harbinger', ['Vile Blast', 'Vile Blast'], {
    primaryWeapon: 'Pistol',
    selectedTraitIds: [TRAIT.DARK_GUNSLINGER]
  });

  assert.equal(soulBarbs.events.filter((event) => event.kind === 'necromancer-soul-barbs').length, 2);
  assert.deepEqual(
    soulBarbs.events.filter((event) => event.kind === 'necromancer-soul-barbs').map((event) => event.duration),
    [15, 15]
  );
  const soulBarbsSeries = buildChartSeries(soulBarbs, 100).effects['Soul Barbs'];

  assert.ok(soulBarbsSeries.some((point) => point.v === 1));
  assert.ok(soulBarbsSeries.every((point) => point.v === 0 || point.v === 1));
  assert.ok(gunslinger.steps[1].start < basePistol.steps[1].start);
  const gunslingerPoison = gunslinger.resolvedEvents.find(
    (event) => event.skillId === ID.VILE_BLAST && event.condition === 'Poisoned'
  );

  assert.ok(Math.abs(gunslingerPoison.effectiveDuration - 6.496) < 1e-12);
});

test('cross-specialization Necromancer trait triggers remain executable', () => {
  const spite = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud'], {
    selectedTraitIds: [TRAIT.REAPERS_MIGHT, TRAIT.WEAKENING_SHROUD]
  });
  const reaper = simulate(
    'Reaper',
    ["Reaper's Shroud", 'Soul Spiral', "Exit Reaper's Shroud", { type: 'wait', durationMs: 8100 }],
    {
      selectedTraitIds: [TRAIT.TRANSFUSION]
    }
  );
  const fear = simulate('Reaper', ["Reaper's Mark", { type: 'wait', durationMs: 2100 }], {
    primaryWeapon: 'Staff',
    selectedTraitIds: [TRAIT.SHIVERS_OF_DREAD, TRAIT.BITTER_CHILL, TRAIT.TERROR]
  });
  const malicious = simulate('Core', ['Summon Blood Fiend'], {
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.MALICIOUS_SWARM]
  });
  const ashes = simulate('Scourge', ['Harrowing Wave'], {
    initialResource: 0,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Torch',
    selectedTraitIds: [TRAIT.NOURISHING_ASHES]
  });

  assert.equal(
    spite.procSteps.some((step) => step.skill === "Reaper's Might"),
    true
  );
  assert.equal(
    spite.breakdown.some((entry) => entry.name === 'Weakening Shroud'),
    true
  );
  assert.equal(
    reaper.breakdown.some((entry) => entry.name === 'Lesser Chilblains'),
    true
  );
  assert.equal(
    fear.procSteps.some((step) => step.skill === 'Bitter Chill'),
    true
  );
  assert.equal(
    fear.resolvedEvents.some((event) => event.sourceId === TRAIT.TERROR && event.condition === 'Fear'),
    true
  );
  assert.ok(fear.conditionDamage > 0);
  assert.equal(
    malicious.breakdown.some((entry) => entry.name === 'Lesser Signet of the Locust'),
    true
  );
  assert.equal(ashes.endState.profession.lifeForce, 10);
});

test('remaining outgoing Necromancer trait families affect combat state', () => {
  const carapaceBase = simulate('Core', ['Blood Curse', 'Rending Curse'], {
    primaryWeapon: 'Scepter'
  });
  const carapace = simulate('Core', ['Blood Curse', 'Rending Curse'], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.CORRUPTERS_FERVOR, TRAIT.DEADLY_STRENGTH]
  });
  const armored = simulate('Core', ['Death Shroud', 'Life Blast'], {
    selectedTraitIds: [TRAIT.ARMORED_SHROUD, TRAIT.DEADLY_STRENGTH]
  });
  const augury = simulate('Reaper', ['"Suffer!"'], {
    selectedSkills: ['"Suffer!"'],
    selectedTraitIds: [TRAIT.AUGURY_OF_DEATH]
  });
  const signet = simulate('Core', ['Signet of Spite'], {
    selectedSkills: ['Signet of Spite'],
    selectedTraitIds: [TRAIT.SIGNETS_OF_SUFFERING]
  });
  const brew = simulate('Harbinger', ['Elixir of Risk'], {
    selectedSkills: ['Elixir of Risk'],
    selectedTraitIds: [TRAIT.BOLSTERING_BREW]
  });
  const empowerment = simulate('Scourge', ['Manifest Sand Shade'], {
    selectedTraitIds: [TRAIT.DESERT_EMPOWERMENT]
  });

  assert.ok(carapace.strikeDamage > carapaceBase.strikeDamage);
  assert.ok(armored.endState.profession.carapaceExpiries.length >= 5);
  assert.equal(
    augury.breakdown.some((entry) => entry.name === 'Augury of Death'),
    true
  );
  assert.equal(
    signet.breakdown.some((entry) => entry.name === 'Signets of Suffering'),
    true
  );
  assert.equal(
    brew.events.some((event) => event.kind === 'protection' && event.skillId === ID.ELIXIR_OF_RISK),
    true
  );
  assert.equal(
    empowerment.events.some((event) => event.kind === 'alacrity' && event.skillId === ID.MANIFEST_SAND_SHADE),
    true
  );
});

test('trait skill replacements expose only their active variant', () => {
  const scepterBase = simulate('Core', ['Feast of Corruption'], {
    primaryWeapon: 'Scepter'
  });
  const scepterTrait = simulate('Core', ['Feast of Corruption', 'Devouring Darkness'], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.LINGERING_CURSE]
  });
  const scourgeTrait = simulate('Scourge', ['Desert Shroud', 'Sandstorm Shroud', { type: 'wait', durationMs: 4100 }], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.HERALD_OF_SORROW]
  });

  assert.deepEqual(scepterBase.warnings, []);
  assert.match(scepterTrait.warnings.join(' '), /Feast of Corruption is unavailable/);
  assert.ok(scepterTrait.breakdown.some((entry) => entry.name === 'Devouring Darkness'));
  assert.match(scourgeTrait.warnings.join(' '), /Desert Shroud is unavailable/);
  assert.ok(scourgeTrait.resolvedEvents.some((event) => event.name === 'Sandstorm Shroud'));
});

test('Corrupted Talent owns the Harbinger shroud-entry life-force gain', () => {
  const withoutTrait = simulate('Harbinger', ['Harbinger Shroud'], {
    initialResource: 0
  });
  const withTrait = simulate('Harbinger', ['Harbinger Shroud'], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.CORRUPTED_TALENT]
  });

  assert.equal(withoutTrait.endState.profession.lifeForce, 0);
  assert.equal(withTrait.endState.profession.lifeForce, 15);
});

test('modifier candidates include every active Necromancer trait', () => {
  const build = createNecromancerBuildDefaults();
  const app = {
    build,
    skillByName: necromancerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  recalculate(app);

  const activeTraitNames = new Set(app.attributeData.activeTraits.map((trait) => trait.name));
  const candidateNames = new Set(
    modifierCandidates(app)
      .filter((candidate) => candidate.type === 'Trait')
      .map((candidate) => candidate.name)
  );

  assert.deepEqual(candidateNames, activeTraitNames);
});

test('signet passives and Soul Battery are profession-owned resources', () => {
  const signets = simulate('Core', [{ type: 'wait', durationMs: 3100 }], {
    initialResource: 0,
    selectedSkills: ['Signet of Undeath', 'Signet of Vampirism']
  });
  const battery = simulate('Core', [], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SOUL_BATTERY]
  });
  const eternal = simulate('Core', [{ type: 'wait', durationMs: 4100 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.ETERNAL_LIFE]
  });
  const eternalCap = simulate('Core', [{ type: 'wait', durationMs: 70_100 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.ETERNAL_LIFE]
  });
  const perception = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud', 'Blood Curse'], {
    initialResource: 100,
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.DEATH_PERCEPTION]
  });

  assert.equal(signets.endState.profession.lifeForce, 4);
  assert.ok(signets.breakdown.some((entry) => entry.name === 'Signet of Vampirism - Passive Life Siphon'));
  assert.equal(battery.endState.profession.maximumLifeForce, 120);
  assert.equal(battery.endState.profession.lifeForce, 120);
  assert.equal(eternal.endState.profession.lifeForce, 12);
  assert.equal(eternalCap.endState.profession.lifeForce, 66);
  const lifeBlast = perception.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.LIFE_BLAST
  );
  const bloodCurse = perception.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.BLOOD_CURSE
  );

  assert.ok(Math.abs(lifeBlast.criticalChance - 0.6761904761904762) < 1e-12);
  assert.ok(Math.abs(lifeBlast.criticalDamage - 1.8333333333333333) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalChance - 0.6761904761904762) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalDamage - 1.8333333333333333) < 1e-12);
});

test('the Power Harbinger trait set uses current critical and resource rules', () => {
  const runShroudStrike = (selectedTraitIds) =>
    simulate('Harbinger', ['Harbinger Shroud', 'Tainted Bolts'], {
      stats: { precision: 4000 },
      selectedTraitIds,
      target: {
        ...baseConfig.target,
        health: 1_000_000_000,
        conditions: {
          ...baseConfig.target.conditions,
          Torment: true
        }
      }
    });
  const base = runShroudStrike([]);
  const deathPerception = runShroudStrike([TRAIT.DEATH_PERCEPTION]);
  const wickedCorruption = runShroudStrike([TRAIT.WICKED_CORRUPTION]);
  const both = runShroudStrike([TRAIT.DEATH_PERCEPTION, TRAIT.WICKED_CORRUPTION]);
  const strikeDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === ID.TAINTED_BOLTS)
      .reduce((sum, event) => sum + event.damage, 0);

  assert.ok(Math.abs(strikeDamage(deathPerception) / strikeDamage(base) - 1.1) < 1e-12);
  assert.ok(Math.abs(strikeDamage(wickedCorruption) / strikeDamage(base) - 1.1) < 1e-12);
  assert.ok(Math.abs(strikeDamage(both) / strikeDamage(base) - 1.21) < 1e-12);

  const implacable = simulate('Harbinger', ['Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.IMPLACABLE_FOE]
  });

  assert.equal(
    implacable.events.some(
      (event) => event.type === 'buff' && event.kind === 'stability' && event.stacks === 3 && event.duration === 5
    ),
    true
  );

  const fortitude = simulate('Harbinger', ['Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE, TRAIT.GLUTTONY],
    target: {
      ...baseConfig.target,
      health: 8000
    }
  });

  assert.equal(fortitude.endState.profession.lifeForce, 2.2);
});

test('critical sigils follow the active weapon set', () => {
  const result = simulate(
    'Harbinger',
    ['Vile Blast', 'Swap Weapons', 'Grasping Dead', { type: 'wait', durationMs: 2100 }],
    {
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Torch',
      weaponSet2Primary: 'Scepter',
      weaponSet2Secondary: 'Dagger',
      stats: { precision: 4000 },
      sigilSets: [
        { names: ['Torment'], strike: 1, condition: 1 },
        { names: ['Earth'], strike: 1, condition: 1 }
      ]
    }
  );

  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Torment'),
    true
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Earth'),
    true
  );
});

test('Necromancer resources and palette change with specialization state', () => {
  const harbingerResources = necromancerProfession.ui.resourceViews({
    specialization: 'Harbinger',
    professionState: {
      lifeForce: 80,
      maximumLifeForce: 100,
      lifeForcePoolCapacity: 13256.28,
      blight: 12,
      cascadingCorruptionStacks: 7
    }
  });
  const scourgeResources = necromancerProfession.ui.resourceViews({
    specialization: 'Scourge',
    build: {
      weapons: ['Spear', '']
    },
    professionState: {
      lifeForce: 80,
      maximumLifeForce: 100,
      soulShards: 4,
      shades: [10, 20]
    }
  });
  const reaperEntry = necromancerProfession.ui.paletteGroups({
    specialization: 'Reaper',
    professionState: {}
  })[0].skillIds;
  const reaperBar = necromancerProfession.ui.paletteGroups({
    specialization: 'Reaper',
    professionState: {
      activeShroud: 'reaper',
      availableFlips: { [ID.EXIT_REAPERS_SHROUD]: Infinity }
    }
  });
  const ritualistPalette = necromancerProfession.ui.paletteGroups({
    specialization: 'Ritualist',
    professionState: {
      activeShroud: '',
      activeSpirits: {}
    }
  });

  assert.deepEqual(
    harbingerResources.map((resource) => resource.id),
    ['life-force', 'blight', 'cascading-corruption']
  );
  assert.equal(harbingerResources[0].pipStyle, 'compact-profession-resource-necromancer-life-force');
  assert.equal(reaperBar[0].className, 'compact-resource-palette necromancer-f-skills');
  assert.equal(harbingerResources[0].maximum, 13256);
  assert.equal(harbingerResources[0].value, 13256 * 0.8);
  assert.equal(harbingerResources[0].startMaximum, 100);
  assert.equal(harbingerResources[2].value, 7);
  assert.equal(harbingerResources[2].buildKey, 'initialCascadingCorruptionStacks');
  assert.equal(harbingerResources[1].showInPalette, false);
  assert.equal(harbingerResources[2].showInPalette, false);
  assert.deepEqual(
    scourgeResources.map((resource) => resource.id),
    ['life-force', 'soul-shards', 'active-shades']
  );
  assert.deepEqual(
    scourgeResources.slice(1).map((resource) => ({
      displayMode: resource.displayMode,
      pipStyle: resource.pipStyle,
      showValue: resource.showValue,
      value: resource.value
    })),
    [
      {
        displayMode: 'counter',
        pipStyle: 'necromancer-soul-shards',
        showValue: false,
        value: 4
      },
      {
        displayMode: 'counter',
        pipStyle: 'necromancer-scourge-shades',
        showValue: false,
        value: 2
      }
    ]
  );
  assert.deepEqual(
    necromancerProfession.ui.rotationStateSnapshot({
      specialization: 'Harbinger',
      build: {
        specializations: [{ name: 'Harbinger', traits: '3-3-1' }]
      },
      professionState: { blight: 12, cascadingCorruptionStacks: 7 }
    }),
    [
      {
        id: 'harbinger-blight',
        label: 'Blight',
        value: '12/25',
        title: 'Current Harbinger Blight stacks'
      },
      {
        id: 'cascading-corruption-stacks',
        label: 'Cascading Corruption',
        value: '7/20',
        title: 'Cascading Corruption stacks toward the next Meltdown'
      }
    ]
  );
  assert.deepEqual(
    necromancerProfession.ui
      .resourceViews({
        specialization: 'Harbinger',
        build: {
          weapons: ['Greatsword', ''],
          alternateWeapons: ['Spear', '']
        },
        professionState: {
          lifeForce: 80,
          maximumLifeForce: 100,
          blight: 12,
          soulShards: 4
        }
      })
      .map((resource) => resource.id),
    ['life-force', 'blight', 'cascading-corruption', 'soul-shards']
  );
  assert.deepEqual(reaperEntry, [ID.REAPERS_SHROUD, ID.EXIT_REAPERS_SHROUD]);
  assert.equal(reaperBar[0].skillIds.includes(ID.EXIT_REAPERS_SHROUD), true);
  assert.equal(reaperBar[1].skillIds.includes(ID.LIFE_REND), true);
  assert.deepEqual(
    reaperBar[1].skillIds.filter((id) => [ID.INFUSING_TERROR, ID.TERRIFY].includes(id)),
    [ID.INFUSING_TERROR, ID.TERRIFY]
  );
  assert.equal(reaperBar[0].stackId, 'reaper-profession');
  assert.equal(reaperBar[1].stackId, 'reaper-profession');
  assert.equal(ritualistPalette[0].stackId, 'ritualist-profession');
  assert.deepEqual(ritualistPalette[0].skillIds, [
    ID.RITUALISTS_SHROUD,
    ID.EXIT_RITUALISTS_SHROUD,
    ID.INNERVATE_ANGUISH,
    ID.INNERVATE_WANDERLUST,
    ID.INNERVATE_PRESERVATION
  ]);
  assert.equal(ritualistPalette[1].stackId, 'ritualist-profession');
  assert.equal(ritualistPalette[1].skillIds.includes(ID.SUMMON_SPIRITS), true);
  assert.equal(ritualistPalette[1].skillIds.includes(ID.INNERVATE_ANGUISH), false);
  assert.deepEqual(
    necromancerProfession.ui.paletteSkillAvailability(
      {
        specialization: 'Reaper',
        professionState: {}
      },
      necromancerCatalog.skillsById.get(ID.LIFE_REND)
    ),
    {
      available: false,
      message: 'Enter Reaper Shroud first'
    }
  );
  assert.equal(Object.hasOwn(necromancerProfession.ui, 'rotationSkillAvailability'), false);
  assert.equal(formatResourceValue(113.89999999999999), '113.9');
  assert.deepEqual(
    necromancerProfession.ui.targetHealthThresholds({
      specialization: 'Core',
      build: { weapons: ['Axe', 'Focus'], specializations: [] }
    }),
    []
  );
  assert.deepEqual(
    necromancerProfession.ui.targetHealthThresholds({
      specialization: 'Reaper',
      build: { weapons: ['Greatsword', ''], specializations: [] }
    }),
    [0.5]
  );
});

test('Necromancer renders life force above its F-skills', async () => {
  const adapter = await loadProfessionAppAdapter('necromancer');
  const build = adapter.toApplicationBuild(createNecromancerBuildDefaults());
  const app = {
    build,
    adapter,
    profession: necromancerProfession,
    skills: necromancerCatalog.skills,
    skillById: necromancerCatalog.skillsById,
    skillByName: necromancerCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: null
  };
  const palette = { innerHTML: '', querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  const html = palette.innerHTML;
  const mechanic = html.indexOf('compact-resource-palette necromancer-f-skills');
  const resource = html.indexOf('data-resource-id="life-force"');

  assert.ok(mechanic >= 0);
  assert.ok(resource > mechanic);
  assert.match(html, /compact-profession-resource-necromancer-life-force/);
  assert.match(html, /<strong>100\/100<\/strong>/);
  assert.equal(html.match(/data-resource-id="life-force"/g)?.length, 1);
  assert.doesNotMatch(html, /data-resource-id="blight"/);
  assert.doesNotMatch(html, /data-resource-id="cascading-corruption"/);

  app.build.weapons = ['Spear', ''];
  app.build.specializations[2] = {
    name: 'Scourge',
    traits: '1-1-2'
  };
  app.results = {
    endState: {
      profession: {
        lifeForce: 80,
        maximumLifeForce: 100,
        soulShards: 0,
        shades: [10, 20]
      }
    }
  };
  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(
    palette.innerHTML,
    /data-resource-id="soul-shards"[\s\S]*data-resource-count="0"[\s\S]*necromancer-soul-shards/
  );
  app.results.endState.profession.soulShards = 4;
  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(
    palette.innerHTML,
    /data-resource-id="soul-shards"[\s\S]*data-resource-count="4"[\s\S]*necromancer-soul-shards/
  );
  assert.match(
    palette.innerHTML,
    /data-resource-id="active-shades"[\s\S]*data-resource-count="2"[\s\S]*necromancer-scourge-shades/
  );
});

test('Necromancer shroud transitions stay adjacent and toggle availability', () => {
  for (const [specialization, shroud, entryId, exitId] of [
    ['Core', 'death', ID.DEATH_SHROUD, ID.END_DEATH_SHROUD],
    ['Reaper', 'reaper', ID.REAPERS_SHROUD, ID.EXIT_REAPERS_SHROUD],
    ['Harbinger', 'harbinger', ID.HARBINGER_SHROUD, ID.EXIT_HARBINGER_SHROUD],
    ['Ritualist', 'ritualist', ID.RITUALISTS_SHROUD, ID.EXIT_RITUALISTS_SHROUD]
  ]) {
    const inactiveContext = {
      specialization,
      professionState: { activeShroud: '' }
    };
    const activeContext = {
      specialization,
      professionState: { activeShroud: shroud }
    };

    for (const context of [inactiveContext, activeContext]) {
      assert.deepEqual(
        necromancerProfession.ui.paletteGroups(context)[0].skillIds.slice(0, 2),
        [entryId, exitId],
        specialization
      );
    }

    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(inactiveContext, necromancerCatalog.skillsById.get(entryId)),
      true,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(inactiveContext, necromancerCatalog.skillsById.get(exitId)),
      false,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(activeContext, necromancerCatalog.skillsById.get(entryId)),
      false,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(activeContext, necromancerCatalog.skillsById.get(exitId)),
      true,
      specialization
    );
  }
});

test("Necromancer skill bar exposes each specialization's shroud abilities", () => {
  const groups = (specialization) =>
    necromancerProfession.ui.skillBarGroups({
      specialization,
      professionState: {}
    });

  assert.deepEqual(
    groups('Core').map((group) => [group.label, group.skillIds]),
    [
      ['F Keys', [ID.DEATH_SHROUD, ID.END_DEATH_SHROUD]],
      ['Death Shroud', [ID.LIFE_BLAST, ID.DARK_PATH, ID.DOOM, ID.LIFE_TRANSFER, ID.TAINTED_SHACKLES]]
    ]
  );
  assert.deepEqual(
    groups('Reaper').map((group) => [group.label, group.skillIds]),
    [
      ['F Keys', [ID.REAPERS_SHROUD, ID.EXIT_REAPERS_SHROUD]],
      ["Reaper's Shroud", [ID.LIFE_REND, ID.DEATHS_CHARGE, ID.INFUSING_TERROR, ID.SOUL_SPIRAL, ID.EXECUTIONERS_SCYTHE]]
    ]
  );
  assert.deepEqual(
    groups('Harbinger').map((group) => [group.label, group.skillIds]),
    [
      ['F Keys', [ID.HARBINGER_SHROUD, ID.EXIT_HARBINGER_SHROUD]],
      ['Harbinger Shroud', [ID.TAINTED_BOLTS, ID.DARK_BARRAGE, ID.DEVOURING_CUT, ID.VORACIOUS_ARC, ID.VITAL_DRAW]]
    ]
  );
  assert.deepEqual(
    groups('Ritualist').map((group) => [group.label, group.skillIds]),
    [
      [
        'F Keys',
        [
          ID.RITUALISTS_SHROUD,
          ID.EXIT_RITUALISTS_SHROUD,
          ID.INNERVATE_ANGUISH,
          ID.INNERVATE_WANDERLUST,
          ID.INNERVATE_PRESERVATION
        ]
      ],
      ["Ritualist's Shroud", [ID.ESSENCE_BLAST, ID.ANGUISH, ID.WANDERLUST, ID.PRESERVATION, ID.SUMMON_SPIRITS]]
    ]
  );

  const scourge = necromancerProfession.ui.skillBarGroups({
    specialization: 'Scourge',
    build: {
      specializations: [{ name: 'Scourge', traits: '1-3-3' }]
    },
    professionState: {}
  });

  assert.deepEqual(
    scourge.map((group) => group.label),
    ['F Keys']
  );
  assert.deepEqual(scourge[0].skillIds, [
    ID.MANIFEST_SAND_SHADE,
    ID.NEFARIOUS_FAVOR,
    ID.SAND_CASCADE,
    ID.GARISH_PILLAR,
    ID.SANDSTORM_SHROUD
  ]);
});

test('Necromancer state events have a real event-log presentation', () => {
  const rows = simulationEventLogRows(
    {
      events: [
        {
          type: 'necromancer.state',
          at: 1,
          reason: 'shroud-enter',
          state: {
            lifeForce: 82.5,
            activeShroud: 'reaper',
            blight: 3,
            soulShards: 2
          }
        }
      ],
      resolvedEvents: [],
      endState: { profession: {} }
    },
    null,
    necromancerProfession
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'necromancer.state');
  assert.match(rows[0].description, /shroud-enter.*Life force 82\.5.*Shroud reaper.*Blight 3.*Soul shards 2/);
  assert.doesNotMatch(rows[0].description, /UNPRESENTED CUSTOM EVENT/);
});

test('Necromancer siphon bookkeeping events stay out of the event log', () => {
  const rows = simulationEventLogRows(
    {
      events: [
        { type: 'necromancer.taste-for-blood-grant', at: 0, stacks: 3, duration: 10 },
        { type: 'necromancer.taste-for-blood-allied-hit', at: 1, allyIndex: 1 },
        { type: 'necromancer.vampiric-presence-allied-hit', at: 1, allyIndex: 1 }
      ],
      resolvedEvents: [],
      endState: { profession: {} }
    },
    null,
    necromancerProfession
  );

  assert.deepEqual(rows, []);
});

test('slot skills are inaccessible in transformed shrouds', () => {
  const slotSkill = necromancerCatalog.skillsById.get(ID.BLOOD_IS_POWER);

  for (const [specialization, shroud, entry] of [
    ['Core', 'death', 'Death Shroud'],
    ['Reaper', 'reaper', "Reaper's Shroud"],
    ['Harbinger', 'harbinger', 'Harbinger Shroud'],
    ['Ritualist', 'ritualist', "Ritualist's Shroud"]
  ]) {
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(
        {
          specialization,
          professionState: { activeShroud: shroud }
        },
        slotSkill
      ),
      false,
      specialization
    );
    const result = simulate(specialization, [entry, 'Blood Is Power'], {
      initialResource: 100,
      selectedSkills: ['Blood Is Power']
    });

    assert.match(result.warnings.join(' '), /Blood Is Power is unavailable/, specialization);
  }

  assert.equal(
    necromancerProfession.ui.isPaletteSkillAvailable(
      {
        specialization: 'Scourge',
        professionState: { activeShroud: '' }
      },
      slotSkill
    ),
    true
  );
});

test('Harbinger can equip torch skills through Weaponmaster Training', async () => {
  const adapter = await loadProfessionAppAdapter('necromancer');
  const skills = weaponSkills({
    adapter,
    skills: necromancerCatalog.skills,
    build: {
      specialization: 'Harbinger',
      weapons: ['Pistol', 'Torch'],
      alternateWeapons: ['Scepter', 'Dagger'],
      specializations: [
        { name: 'Curses', traits: '1-1-3' },
        { name: 'Harbinger', traits: '3-3-1' }
      ]
    },
    weaponData: {
      Pistol: { wielding: '1h' },
      Torch: { wielding: '1h' },
      Scepter: { wielding: '1h' },
      Dagger: { wielding: '1h' }
    }
  });

  assert.equal(
    skills.some((skill) => skill.name === 'Harrowing Wave'),
    true
  );
  assert.equal(
    skills.some((skill) => skill.name === 'Oppressive Collapse'),
    true
  );
  const scepterSkills = weaponSkills(
    {
      adapter,
      skills: necromancerCatalog.skills,
      build: {
        specialization: 'Harbinger',
        weapons: ['Pistol', 'Torch'],
        alternateWeapons: ['Scepter', 'Dagger'],
        specializations: [{ name: 'Curses', traits: '1-1-3' }]
      },
      weaponData: {
        Pistol: { wielding: '1h' },
        Torch: { wielding: '1h' },
        Scepter: { wielding: '1h' },
        Dagger: { wielding: '1h' }
      }
    },
    2
  );

  assert.equal(
    scepterSkills.some((skill) => skill.name === 'Devouring Darkness'),
    true
  );
  assert.equal(
    scepterSkills.some((skill) => skill.name === 'Feast of Corruption'),
    false
  );
  assert.equal(
    adapter.isSkillAvailable(necromancerCatalog.skillsById.get(ID.FEAST_OF_CORRUPTION), {
      specialization: 'Harbinger',
      build: { specializations: [] }
    }),
    true
  );
  assert.equal(
    adapter.isSkillAvailable(necromancerCatalog.skillsById.get(ID.DEVOURING_DARKNESS), {
      specialization: 'Harbinger',
      build: { specializations: [] }
    }),
    false
  );
  const torchRotation = simulate(
    'Harbinger',
    ['Harrowing Wave', 'Oppressive Collapse', { type: 'wait', durationMs: 4100 }],
    {
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Torch',
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    }
  );

  assert.deepEqual(torchRotation.warnings, []);
  assert.equal(
    torchRotation.breakdown.some((entry) => entry.name === 'Harrowing Wave'),
    true
  );
  assert.equal(
    torchRotation.breakdown.some((entry) => entry.name === 'Oppressive Collapse'),
    true
  );
  const oppressiveMight = torchRotation.events.find(
    (event) => event.type === 'buff' && event.skillId === ID.OPPRESSIVE_COLLAPSE && event.kind === 'might'
  );

  assert.equal(oppressiveMight.recipients, 'party');
  assert.equal(oppressiveMight.affectsSummons, false);
});

test('Necromancer builds migrate and validate against canonical metadata', () => {
  const defaults = createNecromancerBuildDefaults();

  assert.deepEqual(validateNecromancerBuild(defaults), {
    valid: true,
    errors: []
  });
  const migrated = migrateNecromancerBuild({
    weapons: ['Greatsword', 'Focus'],
    initialResource: 500,
    initialBlight: -4,
    initialCascadingCorruptionStacks: 30,
    selectedSkillIds: [ID.SUMMON_BLOOD_FIEND, ID.BLOOD_IS_POWER, ID.LICH_FORM]
  });

  assert.deepEqual(migrated.weapons, ['Greatsword', '']);
  assert.equal(migrated.initialResource, 100);
  assert.equal(migrated.initialBlight, 0);
  assert.equal(migrated.initialCascadingCorruptionStacks, 19);
  assert.equal(migrated.selectedSkills.Heal, 'Summon Blood Fiend');
  assert.equal(migrated.selectedSkills.Elite, 'Lich Form');
  assert.deepEqual(validateNecromancerBuild(migrated), {
    valid: true,
    errors: []
  });
  assert.throws(() => migrateNecromancerBuild({ profession: 'guardian' }), /Cannot load guardian build as Necromancer/);
});

test('Necromancer is wired through the selector and application adapter', async () => {
  const page = await readFile(new URL('../../../necromancer.html', import.meta.url), 'utf8');

  assert.equal(
    professionOptions.some((option) => option.id === 'necromancer'),
    true
  );
  assert.equal(professionRoute('necromancer'), 'necromancer.html');
  assert.equal((await loadProfession('necromancer'))?.id, 'necromancer');
  assert.equal((await loadProfessionAppAdapter('necromancer'))?.id, 'necromancer');
  assert.match(page, /data-profession="necromancer"/);
});
