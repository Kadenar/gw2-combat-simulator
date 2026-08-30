import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionRoute
} from '../../../js/games/gw2/app/profession/registry.js';
import { simulationEventLogRows } from '../../../js/games/gw2/app/rotation/result/event-log.js';
import { paletteSkillView, renderPalette } from '../../../js/games/gw2/app/rotation/palette/view.js';
import { buildChartSeries, skillBreakdownRows } from '../../../js/games/gw2/app/rotation/result/model.js';
import {
  automaticPhotonForgeExitTimelineMarkers,
  timelineWeaponLineExitMarkerRowIndex,
  timelineWeaponRows
} from '../../../js/games/gw2/app/rotation/timeline/model.js';
import { simulateGw2 } from '../../../js/games/gw2/platform/simulation/simulate.js';
import {
  applyBalanceProfilePatch,
  applySkillPatch
} from '../../../js/games/gw2/integrations/patches/authoring/patches.js';
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  toApplicationBuild,
  validateEngineerBuild
} from '../../../js/games/gw2/content/professions/engineer/build/build.js';
import { engineerCatalog } from '../../../js/games/gw2/content/professions/engineer/catalog.js';
import { DATA_SNAPSHOT } from '../../../js/games/gw2/content/professions/engineer/data/engineer-api-metadata.js';
import { ENGINEER_SUPPLEMENTAL_SKILLS } from '../../../js/games/gw2/content/professions/engineer/data/engineer-supplemental-skills.js';
import { ENGINEER_TRAIT_COVERAGE } from '../../fixtures/trait-coverage/engineer.js';
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT
} from '../../../js/games/gw2/content/professions/engineer/data/ids.js';
import { engineerProfession } from '../../../js/games/gw2/content/professions/engineer/definition.js';
import { engineerCoreModule } from '../../../js/games/gw2/content/professions/engineer/core/module.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '../../../js/games/gw2/content/professions/engineer/core/profiles.js';
import { ENGINEER_CORE_SKILL_MECHANICS } from '../../../js/games/gw2/content/professions/engineer/core/skills.js';
import { ENGINEER_TURRET_ATTACK_SKILL_IDS } from '../../../js/games/gw2/content/professions/engineer/core/turrets.js';
import { amalgamModule } from '../../../js/games/gw2/content/professions/engineer/specializations/amalgam/module.js';
import { AMALGAM_BALANCE_PROFILE_IDS } from '../../../js/games/gw2/content/professions/engineer/specializations/amalgam/profiles.js';
import { amalgamAttributeRules } from '../../../js/games/gw2/content/professions/engineer/specializations/amalgam/rules.js';
import { holosmithModule } from '../../../js/games/gw2/content/professions/engineer/specializations/holosmith/module.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS } from '../../../js/games/gw2/content/professions/engineer/specializations/holosmith/profiles.js';
import { holosmithProfileStrikeFactor } from '../../../js/games/gw2/content/professions/engineer/specializations/holosmith/heat-tiers.js';
import { holosmithModifierRules } from '../../../js/games/gw2/content/professions/engineer/specializations/holosmith/rules.js';
import { mechanistModule } from '../../../js/games/gw2/content/professions/engineer/specializations/mechanist/module.js';
import { MECHANIST_BALANCE_PROFILE_IDS } from '../../../js/games/gw2/content/professions/engineer/specializations/mechanist/profiles.js';
import { engineerMechAttributes } from '../../../js/games/gw2/content/professions/engineer/specializations/mechanist/state.js';
import { scrapperModule } from '../../../js/games/gw2/content/professions/engineer/specializations/scrapper/module.js';
import { SCRAPPER_BALANCE_PROFILE_IDS } from '../../../js/games/gw2/content/professions/engineer/specializations/scrapper/profiles.js';
import { scrapperSchedulerHooks } from '../../../js/games/gw2/content/professions/engineer/specializations/scrapper/rules.js';
import { createScrapperState } from '../../../js/games/gw2/content/professions/engineer/specializations/scrapper/state.js';
import { engineerAppAdapter } from '../../../js/games/gw2/content/professions/engineer/app/app-definition.js';
import { AMALGAM_SKILL_MECHANICS } from '../../../js/games/gw2/content/professions/engineer/specializations/amalgam/skills.js';
import { assertProfessionFamilyConformance } from '../../helpers/profession-family-conformance.js';

const baseConfig = Object.freeze({
  selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Supply Crate'],
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

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

const applyEngineerPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(engineerCatalog, patch), patch);

test('Engineer interrupt timing avoids zero-millisecond placeholders', () => {
  // Kit transitions are reconstructed as concurrent actions; they are not evidence that these skills commit immediately.
  const skillsWithoutVerifiedCommit = ['Static Shot', 'Glue Shot', 'Overcharged Shot', 'Thunderclap', 'Devastator'];

  for (const name of skillsWithoutVerifiedCommit) {
    const catalogSkill = mechanic(name);

    assert.equal(catalogSkill.interruptCommitMs, undefined, name);
    assert.ok(
      catalogSkill.effects.every((effect) => effect.interruptCommitMs !== 0),
      name
    );
  }

  assert.equal(mechanic('Blowtorch').interruptCommitMs, 360);

  for (const name of ['Grenade', 'Poison Grenade', 'Shrapnel Grenade', 'Freeze Grenade']) {
    assert.equal(mechanic(name).retainsCastLockoutAfterInterrupt, true, name);
  }

  const fragmentationShot = mechanic('Fragmentation Shot');
  const flameBlast = mechanic('Flame Blast');

  // Effect-level cutoffs preserve EVTC's observed interruption duration instead of replacing every shortened cast with one skill-wide value.
  assert.equal(fragmentationShot.interruptCommitMs, undefined);
  assert.ok(fragmentationShot.effects.every((effect) => effect.interruptCommitMs === 360));
  assert.ok(fragmentationShot.effects.every((effect) => effect.persistsAfterInterrupt === true));
  assert.equal(flameBlast.interruptCommitMs, undefined);
  assert.equal('measuredCancelMs' in flameBlast, false);
  assert.equal(flameBlast.retainsCastLockoutAfterInterrupt, true);
  assert.ok(flameBlast.effects.every((effect) => effect.interruptCommitMs === 480));
  assert.ok(flameBlast.effects.every((effect) => effect.atMs === 480));
  assert.ok(flameBlast.effects.every((effect) => effect.persistsAfterInterrupt === true));
});

test('Fragmentation Shot and Flame Blast retain packets only after their measured commit boundaries', () => {
  const damageCount = (skillName, interruptAfterMs) => {
    const flameBlast = skillName === 'Flame Blast';
    const result = simulate(
      'Core',
      [...(flameBlast ? ['Flamethrower'] : []), { name: skillName, interruptAfterMs }],
      flameBlast
        ? {
            selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Rifle Turret', 'Supply Crate']
          }
        : {},
      observationTail(1_000)
    );

    return result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === skillName).length;
  };

  assert.equal(damageCount('Fragmentation Shot', 359), 0);
  assert.equal(damageCount('Fragmentation Shot', 360), 1);
  assert.equal(damageCount('Flame Blast', 479), 0);
  assert.equal(damageCount('Flame Blast', 480), 1);
});

test('Poison Dart Volley interruption retains only the channel packets that have landed', () => {
  const packetCounts = (interruptAfterMs) => {
    const result = simulate(
      'Core',
      [{ name: 'Poison Dart Volley', interruptAfterMs }],
      { boons: { quickness: true } },
      observationTail(1_000)
    );

    return ['damage', 'condition'].map(
      (type) => result.events.filter((event) => event.type === type && event.skillId === ID.POISON_DART_VOLLEY).length
    );
  };

  assert.equal(mechanic('Poison Dart Volley').interruptMode, 'per-packet');
  assert.deepEqual(packetCounts(167), [0, 0]);
  assert.deepEqual(packetCounts(168), [1, 1]);
  assert.deepEqual(packetCounts(600), [3, 3]);
  assert.deepEqual(packetCounts(839), [4, 4]);
});

test('Napalm interruption retains only volleys fired before the cutoff', () => {
  const result = simulate(
    'Core',
    ['Flamethrower', { name: 'Napalm', interruptAfterMs: 900 }],
    {
      selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Rifle Turret', 'Supply Crate']
    },
    observationTail(1_000)
  );
  const packetCounts = ['damage', 'condition'].map(
    (type) => result.events.filter((event) => event.type === type && event.skillId === ID.NAPALM).length
  );

  assert.deepEqual(packetCounts, [5, 5]);
});

test('Poison Dart Volley and Static Shot are not combo finishers', () => {
  assert.equal(mechanic('Poison Dart Volley').comboFinishers, undefined);
  assert.equal(mechanic('Static Shot').comboFinishers, undefined);
});

test('Engineer catalog pins API identity and explicit skill mechanics', () => {
  assert.equal(DATA_SNAPSHOT, '2026-07-28');
  assert.equal(engineerCatalog.specializations.length, 9);
  assert.equal(engineerCatalog.traits.length, 108);
  assert.ok(engineerCatalog.skills.length >= 330);
  assert.equal(engineerCatalog.skillsById.get(5842).name, 'Bomb');
  assert.equal(engineerCatalog.skillsByName.get('Bomb').effects[0].coefficient, 1.2);
  assert.match(engineerCatalog.skillsById.get(5806).icon, /Special:Redirect\/file\/Poison_Grenade\.png$/);
  assert.equal(
    engineerCatalog.skillsByName.get('Shrapnel Grenade').icon,
    'https://render.guildwars2.com/file/' + '467E6BF83D152F95BC5D0B3573F4D2D71F5A4BFA/102830.png'
  );
  assert.equal(
    engineerCatalog.skillsByName.get('Vent Exhaust').icon,
    'https://render.guildwars2.com/file/' + '3C2B5C060DA920011A20ACDB96DB155D4BDE2A04/103434.png'
  );
  const ventExhaust = engineerCatalog.skillsByName.get('Vent Exhaust');

  // Vent Exhaust is an invoked skill, so its packets and heat loss live on the skill without a cast handler.
  assert.equal(ventExhaust.handlerId, undefined);
  assert.equal(ventExhaust.heatGain, undefined);
  assert.equal(ventExhaust.heatLoss, 15);
  assert.equal(ventExhaust.effects[0].coefficient, 1.1);
  assert.equal(ventExhaust.effects[0].canCrit, false);
  assert.equal(ventExhaust.effects[1].condition, 'Burning');
  assert.equal(ventExhaust.effects[1].stacks, 2);
  assert.equal(ventExhaust.effects[1].duration, 6);
  const thermalReleaseValve = engineerCatalog.balanceProfilesById.get(
    HOLOSMITH_BALANCE_PROFILE_IDS.thermalReleaseValve
  );

  assert.equal(thermalReleaseValve.resourceCost, undefined);
  assert.deepEqual(thermalReleaseValve.effects, [{ type: 'boon', boon: 'vigor', stacks: 1, duration: 3 }]);
  assert.equal(
    engineerCatalog.skillsByName.get('Orbital Command Strike').icon,
    'https://render.guildwars2.com/file/' + '99CFD7B1B200DCC508172BC8A3C2EE970C06493E/1012854.png'
  );
  assert.equal(
    engineerCatalog.skillsByName.get('Flame Jet').icon,
    'https://render.guildwars2.com/file/' + '2CDBD11894D945140B3480BFEC960800086352E5/103269.png'
  );
  assert.equal(
    engineerCatalog.skillsByName.get('Bandage Blast').icon,
    'https://render.guildwars2.com/file/' + 'F473E7A5D7D301A3B813443812C73338C073ABB2/102898.png'
  );
  assert.equal(
    engineerCatalog.skillsByName.get('Stow Flamethrower').icon,
    'https://render.guildwars2.com/file/' + '7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png'
  );
  assert.equal(
    engineerCatalog.skillsByName.get('Jade Energy Shot').icon,
    'https://render.guildwars2.com/file/' + '73600241FA662501C5D617719A7B4792F30B2846/2503622.png'
  );
  assert.equal(
    engineerCatalog.skillsById.get(ID.ROCKET_PUNCH_MECH).icon,
    'https://render.guildwars2.com/file/' + '02DA2C9899B63DE522020824C67D05951F40CA4A/2503679.png'
  );
  assert.ok(
    engineerCatalog.skills
      .filter((skill) => skill.specialization === 'Amalgam' && skill.categories?.includes('Morph'))
      .every((skill) => skill.icon.startsWith('https://render.guildwars2.com/'))
  );
  assert.equal(engineerCatalog.skillsById.has(6175), false);
  assert.equal(engineerCatalog.skillsById.has(58090), false);
  const poisonGrenade = ENGINEER_CORE_SKILL_MECHANICS[5806];

  assert.equal(poisonGrenade.castTimeMs, undefined);
  assert.equal(poisonGrenade.quicknessCastTimeMs, 680);
  assert.equal(engineerCatalog.skillsById.get(5806).castTimeMs, 1020);
  assert.equal(
    poisonGrenade.effects[0].ticks.reduce((total, packet) => total + packet.coefficient, 0),
    2.25
  );
  assert.deepEqual(
    poisonGrenade.effects[1].ticks.map((packet) => [packet.atMs, packet.condition, packet.stacks]),
    [
      [400, 'Poisoned', 3],
      [440, 'Poisoned', 3],
      [440, 'Poisoned', 3]
    ]
  );
  assert.ok(
    ENGINEER_SUPPLEMENTAL_SKILLS.every(
      (skill) =>
        !Object.hasOwn(skill, 'effects') && !Object.hasOwn(skill, 'cooldown') && !Object.hasOwn(skill, 'recharge')
    )
  );
});

test('Engineer modules expose isolated balance-profile authoring', () => {
  assertProfessionFamilyConformance({
    family: engineerProfession,
    core: engineerCoreModule,
    specializations: {
      Scrapper: scrapperModule,
      Holosmith: holosmithModule,
      Mechanist: mechanistModule,
      Amalgam: amalgamModule
    }
  });

  const modules = new Map(engineerProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Scrapper', 'Holosmith', 'Mechanist', 'Amalgam']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) => {
    const module = modules.get(moduleId);

    return [...module.balanceProfiles, ...module.skillVariants].find((entry) => entry.id === profileId);
  };

  assert.equal(profile('Core', ENGINEER_CORE_BALANCE_PROFILE_IDS.resources).patchableFields.resourceCost, 50);
  assert.equal(profile('Scrapper', SCRAPPER_BALANCE_PROFILE_IDS.appliedForce).patchableFields.attributePerStack, 30);
  assert.equal(profile('Holosmith', HOLOSMITH_BALANCE_PROFILE_IDS.heat).patchableFields.maximumStacks, undefined);
  assert.equal(profile('Holosmith', HOLOSMITH_BALANCE_PROFILE_IDS.heat).patchableFields.threshold, undefined);
  assert.equal(
    profile('Holosmith', HOLOSMITH_BALANCE_PROFILE_IDS.enhancedCapacity).patchableFields.maximumStacks,
    undefined
  );
  assert.equal(
    profile('Holosmith', HOLOSMITH_BALANCE_PROFILE_IDS.enhancedCapacity).patchableFields.threshold,
    undefined
  );
  assert.equal(
    profile('Holosmith', HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier).patchableFields.enhancedStrikeFactor,
    1.35
  );
  assert.equal(
    modules.get('Holosmith').skills.find((skill) => skill.id === ID.VENT_EXHAUST).patchableFields.heatLoss,
    15
  );
  assert.equal(profile('Mechanist', MECHANIST_BALANCE_PROFILE_IDS.resources).patchableFields.attributeConversion, 0.5);
  assert.equal(
    profile('Amalgam', AMALGAM_BALANCE_PROFILE_IDS.mercurialTendencies).patchableFields.rechargeReduction,
    2.5
  );

  const rifleTurretAttack = engineerCatalog.skillsById.get(ENGINEER_TURRET_ATTACK_SKILL_IDS.rifle);

  assert.equal(rifleTurretAttack.simulatorExcluded, true);
  assert.equal(rifleTurretAttack.effects[0].actorType, 'summon');
  assert.equal(rifleTurretAttack.effects[0].coefficient, 0.75);

  const opaqueModifierRules = [...modules.values()].flatMap((module) =>
    module.modifierRules.filter(
      (rule) =>
        (typeof rule.amount === 'function' || typeof rule.factor === 'function') &&
        Object.keys(rule.parameters).length === 0
    )
  );

  assert.deepEqual(opaqueModifierRules, []);

  const preview = applyEngineerPatch({
    skills: {
      [ENGINEER_TURRET_ATTACK_SKILL_IDS.rifle]: {
        effects: [{ effectIndex: 0, coefficient: { from: 0.75, to: 0.8 } }]
      }
    },
    balanceProfiles: {
      [ENGINEER_CORE_BALANCE_PROFILE_IDS.resources]: {
        fields: { resourceCost: { from: 50, to: 45 } }
      },
      [SCRAPPER_BALANCE_PROFILE_IDS.appliedForce]: {
        fields: { attributePerStack: { from: 30, to: 35 } }
      },
      [HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier]: {
        fields: { enhancedStrikeFactor: { from: 1.35, to: 1.5 } }
      },
      [MECHANIST_BALANCE_PROFILE_IDS.resources]: {
        fields: { attributeConversion: { from: 0.5, to: 0.6 } }
      },
      [AMALGAM_BALANCE_PROFILE_IDS.mercurialTendencies]: {
        fields: { rechargeReduction: { from: 2.5, to: 3 } }
      }
    }
  });

  assert.equal(preview.skillsById.get(ENGINEER_TURRET_ATTACK_SKILL_IDS.rifle).effects[0].coefficient, 0.8);
  assert.equal(preview.balanceProfilesById.get(ENGINEER_CORE_BALANCE_PROFILE_IDS.resources).resourceCost, 45);
  assert.equal(preview.balanceProfilesById.get(SCRAPPER_BALANCE_PROFILE_IDS.appliedForce).attributePerStack, 35);
  assert.equal(
    preview.balanceProfilesById.get(HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier).enhancedStrikeFactor,
    1.5
  );
  assert.equal(preview.balanceProfilesById.get(MECHANIST_BALANCE_PROFILE_IDS.resources).attributeConversion, 0.6);
  assert.equal(preview.balanceProfilesById.get(AMALGAM_BALANCE_PROFILE_IDS.mercurialTendencies).rechargeReduction, 3);

  assert.equal(rifleTurretAttack.effects[0].coefficient, 0.75);
  assert.equal(engineerCatalog.balanceProfilesById.get(ENGINEER_CORE_BALANCE_PROFILE_IDS.resources).resourceCost, 50);
});

test('Engineer sword impacts use measured cast-start packet timing', () => {
  const expectedOffsets = new Map([
    [ID.SUN_EDGE, 350],
    [ID.SUN_EDGE_ID_70514, 350],
    [ID.SUN_RIPPER, 450],
    [ID.SUN_RIPPER_ID_69906, 450],
    [ID.GLEAM_SABER, 600],
    [ID.GLEAM_SABER_ID_70771, 600]
  ]);

  for (const [skillId, atMs] of expectedOffsets) {
    const skill = engineerCatalog.skillsById.get(skillId);
    const strike = skill.effects.find((effect) => effect.type === 'strike');

    assert.deepEqual(
      {
        atMs: strike.atMs,
        timingAnchor: strike.timingAnchor,
        timingScale: strike.timingScale
      },
      { atMs, timingAnchor: 'castStart', timingScale: 'fixed' }
    );
  }
});

test('Holosmith palette exposes tool-belt skills, forge, and replacement bars', () => {
  const build = createEngineerBuildDefaults();
  const groups = engineerProfession.ui.paletteGroups({
    build,
    specialization: 'Holosmith',
    professionState: { photonForgeActive: false }
  });
  const profession = groups.find((group) => group.id === 'engineer-profession');
  const grenade = groups.find((group) => group.label === 'Gren');
  const forge = groups.find((group) => group.id === 'engineer-forge');
  const names = (group) => group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name);

  assert.deepEqual(names(profession), [
    'Regenerating Mist',
    'Grenade Barrage',
    'Mine Field',
    'Surprise Shot (engineer skill)',
    'Engage Photon Forge',
    'Deactivate Photon Forge'
  ]);
  assert.deepEqual(names(grenade), [
    'Grenade',
    'Shrapnel Grenade',
    'Flash Grenade',
    'Freeze Grenade',
    'Poison Grenade',
    'Stow Grenade Kit'
  ]);
  assert.equal(grenade.stackId, 'engineer-kits');
  assert.equal(grenade.placement, 'weapon-set-1');
  assert.match(profession.className, /compact-resource-palette/);
  assert.equal(profession.stackId, 'holosmith-profession');
  assert.equal(forge.stackId, 'holosmith-profession');
  assert.equal(forge.skillIds.length, 7);
  assert.ok(names(forge).every((name) => !name.endsWith('—Storm')));
});

test('Engineer renders Endurance only for Tools and uses a standard bar', () => {
  const build = createEngineerBuildDefaults();
  const state = engineerProfession
    .resolveRuntime({
      specialization: 'Core'
    })
    .createProfessionState({ specialization: 'Core' });
  const core = engineerProfession.ui.resourceViews({
    specialization: 'Core',
    build,
    professionState: state
  });

  assert.equal(
    core.some((view) => view.id === 'endurance'),
    false
  );

  const tools = engineerProfession.ui.resourceViews({
    specialization: 'Core',
    build: {
      ...build,
      specializations: [
        { name: 'Tools', traits: '1-2-3' },
        { name: 'Explosives', traits: '3-2-3' },
        { name: 'Firearms', traits: '1-2-3' }
      ]
    },
    professionState: state
  });
  const endurance = tools.find((view) => view.id === 'endurance');

  assert.equal(endurance.displayMode, 'bar');
  assert.equal(endurance.paletteSkillId, ID.DODGE);
  assert.equal(Object.hasOwn(endurance, 'pipStyle'), false);

  const holosmith = engineerProfession.ui.resourceViews({
    specialization: 'Holosmith',
    build,
    professionState: engineerProfession
      .resolveRuntime({
        specialization: 'Holosmith'
      })
      .createProfessionState({ specialization: 'Holosmith' })
  });

  assert.deepEqual(
    holosmith.map((view) => view.id),
    ['heat']
  );
  assert.equal(holosmith[0].pipStyle, 'compact-profession-resource-holosmith-heat');
});

test('Engineer Tools endurance renders beneath Dodge instead of as a standalone resource', async () => {
  const adapter = await loadProfessionAppAdapter('engineer');
  const canonicalBuild = createEngineerBuildDefaults();
  canonicalBuild.specializations = [
    { name: 'Tools', traits: '1-2-3' },
    { name: 'Explosives', traits: '3-2-3' },
    { name: 'Firearms', traits: '1-2-3' }
  ];
  const build = adapter.toApplicationBuild(canonicalBuild);
  const app = {
    build,
    adapter,
    profession: engineerProfession,
    skills: engineerCatalog.skills,
    skillById: engineerCatalog.skillsById,
    skillByName: engineerCatalog.skillsByName,
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

  // Skill-attached resources render inside Dodge and are excluded from the standalone resource section.
  assert.match(palette.innerHTML, /class="[^"]*pal-has-resource[^"]*" data-skill="Dodge"/);
  assert.match(palette.innerHTML, /data-resource-id="endurance"/);
  assert.doesNotMatch(palette.innerHTML, /class="active-resource" data-resource-id="endurance"/);
});

test('Engineer kits render beneath weapons while Holosmith mechanics stay grouped', async () => {
  const adapter = await loadProfessionAppAdapter('engineer');
  const canonicalBuild = createEngineerBuildDefaults();

  canonicalBuild.selectedSkills.Utility2 = 'Flamethrower';
  canonicalBuild.selectedSkills.Utility3 = 'Bomb Kit';
  const build = adapter.toApplicationBuild(canonicalBuild);
  const app = {
    build,
    adapter,
    profession: engineerProfession,
    skills: engineerCatalog.skills,
    skillById: engineerCatalog.skillsById,
    skillByName: engineerCatalog.skillsByName,
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
  const holosmith = html.indexOf('data-palette-stack="holosmith-profession"');
  const profession = html.indexOf('engineer-profession-skills');
  const heat = html.indexOf('data-resource-id="heat"');
  const forge = html.indexOf('engineer-forge-skills');
  const weapons = html.indexOf('data-role="weapon-set-stack"');
  const grenade = html.indexOf('data-skill="Grenade"');
  const flamethrower = html.indexOf('data-skill="Flame Jet"');
  const bomb = html.indexOf('data-skill="Bomb"');
  const actions = html.indexOf('action-palette-group');

  assert.ok(holosmith >= 0);
  assert.ok(profession > holosmith);
  assert.ok(forge > profession);
  assert.ok(heat > forge);
  assert.ok(weapons > heat);
  assert.ok(grenade > weapons);
  assert.ok(flamethrower > grenade);
  assert.ok(bomb > flamethrower);
  assert.ok(actions > bomb);
  assert.match(html, /compact-profession-resource-holosmith-heat/);
});

test('Engineer event log exposes Heat only for Holosmith heat transitions', () => {
  const event = {
    type: 'engineer.state',
    reason: 'heat',
    state: { heat: 25 }
  };
  const eventLogRow = (specialization, value) => {
    const config = { specialization };
    const runtime = engineerProfession.resolveRuntime(config);

    return runtime.ui.eventLogRow(
      {
        config,
        state: { profession: runtime.createProfessionState(config) }
      },
      value
    );
  };

  assert.equal(eventLogRow('Amalgam', event), null);
  assert.equal(
    eventLogRow('Holosmith', {
      ...event,
      reason: 'equip-kit'
    }),
    null
  );
  assert.equal(eventLogRow('Holosmith', event).description, 'heat - Heat 25.0');
});

test('Engineer defaults migrate and validate morph branch choices', () => {
  const defaults = createEngineerBuildDefaults();

  assert.equal(defaults.assumptions.inDamagingField, false);
  assert.deepEqual(
    engineerProfession.ui.assumptionControls.find((control) => control.key === 'inDamagingField'),
    {
      key: 'inDamagingField',
      label: 'In damaging field',
      type: 'boolean',
      defaultValue: false,
      specializations: ['Amalgam']
    }
  );
  assert.deepEqual(validateEngineerBuild(defaults), {
    valid: true,
    errors: []
  });
  const migrated = migrateEngineerBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77203, 76954]
  });

  assert.deepEqual(migrated.selectedMorphSkillIds, [77103, 77203, 76954]);
  assert.equal(
    validateEngineerBuild({
      ...defaults,
      selectedMorphSkillIds: [77103, 77203, 77285]
    }).valid,
    false
  );
  assert.equal(
    validateEngineerBuild({
      ...defaults,
      selectedMorphSkillIds: [77103, 76866, 76954]
    }).valid,
    false
  );
  assert.deepEqual(
    migrateEngineerBuild({
      ...defaults,
      selectedMorphSkillIds: [77103, 76866, 76954]
    }).selectedMorphSkillIds,
    [77103, 77203, 76954]
  );
});

test('Amalgam protocol IDs survive application build conversion', () => {
  const defaults = createEngineerBuildDefaults();
  const application = toApplicationBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77104, 76705],
    rotation: [77103, 77104, 76705]
  });

  assert.deepEqual(application.rotation, [
    { type: 'cast', skillId: 77103 },
    { type: 'cast', skillId: 77104 },
    { type: 'cast', skillId: 76705 }
  ]);

  const legacyApplication = toApplicationBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77104, 76705],
    rotation: ['Offensive Protocol: Shred', 'Defensive Protocol: Thorns', 'Offensive Protocol: Obliterate']
  });

  assert.deepEqual(legacyApplication.rotation, application.rotation);
});

test('kits replace the weapon bar and trigger swap procs', () => {
  const denied = simulate('Core', ['Grenade']);

  assert.match(denied.warnings[0], /equip Grenade Kit first/);

  const result = simulate('Core', ['Grenade Kit', 'Shrapnel Grenade']);

  assert.equal(result.warnings.length, 0);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.endState.profession.activeKit, 'Grenade Kit');
  assert.ok(result.events.some((event) => event.type === 'sigil_swap'));

  const weaponDenied = simulate('Core', ['Grenade Kit', 'Blunderbuss']);

  assert.match(weaponDenied.warnings[0], /active kit.*replaces weapon skills/);

  for (const exitSkill of ['Stow Grenade Kit', 'Swap Weapons']) {
    const exited = simulate('Core', ['Grenade Kit', exitSkill, 'Blunderbuss']);

    assert.equal(exited.warnings.length, 0, exitSkill);
    assert.equal(exited.endState.profession.activeKit, '', exitSkill);
    assert.equal(exited.endState.activeWeaponSet, 1, exitSkill);
  }

  const swapDenied = simulate('Core', ['Swap Weapons']);

  assert.match(swapDenied.warnings[0], /only to leave an active kit/);
});

test('Photon Forge entry and exit start dedicated timeline rows', () => {
  const transition = engineerProfession.ui.timelineWeaponLineTransition;

  assert.equal(
    transition({
      specialization: 'Holosmith',
      skill: engineerCatalog.skillsByName.get('Engage Photon Forge'),
      weaponLine: null
    }),
    'Photon Forge'
  );
  assert.equal(
    transition({
      specialization: 'Holosmith',
      skill: engineerCatalog.skillsByName.get('Deactivate Photon Forge'),
      weaponLine: 'Photon Forge'
    }),
    null
  );
});

test('Photon Forge kit lockout is shortened by Alacrity', () => {
  // Kit availability must use the Forge lockout's effective recharge rather than its raw six-second base.
  const kitStart = (alacrity) => {
    const result = simulate('Holosmith', ['Engage Photon Forge', 'Grenade Kit'], {
      boons: { alacrity }
    });

    assert.equal(result.warnings.length, 0);
    return result.steps.find((step) => step.skill === 'Grenade Kit').start;
  };

  assert.equal(kitStart(false), 6000);
  assert.equal(kitStart(true), 4800);
});

test('Photon Forge kit lockout renders as a queueable palette cooldown', async () => {
  const result = simulate('Holosmith', ['Engage Photon Forge'], {
    boons: { alacrity: true }
  });
  const kit = mechanic('Grenade Kit');
  const context = {
    specialization: 'Holosmith',
    professionState: result.endState.profession,
    time: result.endState.time / 1000
  };
  const availability = engineerProfession.ui.paletteSkillAvailability(context, kit);
  const view = paletteSkillView(
    { results: result },
    kit,
    availability.available,
    availability.message,
    availability.retryAt
  );

  assert.equal(result.endState.profession.kitLockoutUntil, 4.8);
  assert.deepEqual(availability, {
    available: false,
    message: 'Kits are disabled briefly after entering Photon Forge.',
    retryAt: 4.8
  });
  assert.equal(view.disabled, true);
  assert.equal(view.contextDisabled, false);
  assert.equal(view.cooldownLabel, '4.8s');
  assert.deepEqual(engineerProfession.ui.paletteSkillAvailability({ ...context, time: 4.8 }, kit), {
    available: true,
    message: ''
  });

  const adapter = await loadProfessionAppAdapter('engineer');
  const build = adapter.toApplicationBuild(createEngineerBuildDefaults());
  const app = {
    build,
    adapter,
    profession: engineerProfession,
    skills: engineerCatalog.skills,
    skillById: engineerCatalog.skillsById,
    skillByName: engineerCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: result
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

  // The selected utility tile is a separate palette surface from the kit skill row.
  assert.match(palette.innerHTML, /data-skill="Grenade Kit"[\s\S]*?<span class="pal-cd">4\.8s<\/span>/);
});

test('Engineer kit palettes stack and include their linked stow skills', () => {
  const paletteGroups = engineerProfession.ui.paletteGroups({
    specialization: 'Core',
    build: {
      selectedSkills: {
        Heal: 'Med Kit',
        Utility1: 'Grenade Kit',
        Utility2: 'Flamethrower',
        Utility3: 'Bomb Kit',
        Elite: 'Tool Kit'
      }
    },
    professionState: { activeKit: 'Grenade Kit' }
  });
  const groups = paletteGroups.filter((group) => group.stackId === 'engineer-kits');
  const names = (group) => group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name);

  assert.deepEqual(
    groups.map((group) => group.label),
    ['Gren', 'Flam', 'Bomb', 'Med', 'Tool']
  );
  assert.equal(paletteGroups.at(-1).id, 'engineer-profession');
  assert.deepEqual(
    groups.map((group) => names(group).at(-1)),
    ['Stow Grenade Kit', 'Stow Flamethrower', 'Stow Bomb Kit', 'Stow Med Kit', 'Stow Tool Kit']
  );
});

test('Scrapper F skills follow selected skill-slot order', () => {
  const context = {
    specialization: 'Scrapper',
    build: {
      selectedSkills: {
        Heal: 'Healing Turret',
        Utility1: 'Grenade Kit',
        Utility2: 'Throw Mine',
        Utility3: 'Rifle Turret',
        Elite: 'Supply Crate'
      }
    },
    professionState: {}
  };
  const group = engineerProfession.ui
    .paletteGroups(context)
    .find((candidate) => candidate.id === 'engineer-profession');

  assert.equal(group.includeActionSkills, true);
  const expected = [
    'Regenerating Mist',
    'Grenade Barrage',
    'Mine Field',
    'Surprise Shot (engineer skill)',
    'Function Gyro'
  ];

  assert.deepEqual(
    group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    expected
  );
  const core = simulate('Core', ['Function Gyro']);

  assert.match(core.warnings[0], /Unknown skill id Function Gyro/);
  const skillBarGroups = engineerProfession.ui.skillBarGroups(context);

  assert.deepEqual(
    skillBarGroups.map((candidate) => candidate.label),
    ['F Skills']
  );
  assert.deepEqual(
    skillBarGroups.flatMap((candidate) => candidate.skillIds.map((id) => engineerCatalog.skillsById.get(id).name)),
    expected
  );
});

test('Core and Mechanist skill bars expose their derived F skills', () => {
  const selectedSkills = {
    Heal: 'Healing Turret',
    Utility1: 'Grenade Kit',
    Utility2: 'Throw Mine',
    Utility3: 'Rifle Turret',
    Elite: 'Supply Crate'
  };
  const core = engineerProfession.ui.skillBarGroups({
    specialization: 'Core',
    build: { selectedSkills },
    professionState: {}
  });

  assert.deepEqual(
    core.map((group) => group.label),
    ['F Skills']
  );
  assert.deepEqual(
    core.flatMap((group) => group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name)),
    ['Regenerating Mist', 'Grenade Barrage', 'Mine Field', 'Surprise Shot (engineer skill)', 'Med Pack Drop']
  );

  const mechanist = engineerProfession.ui.skillBarGroups({
    specialization: 'Mechanist',
    build: {
      selectedSkills,
      specializations: [
        {
          name: 'Mechanist',
          traits: '3-2-2'
        }
      ]
    },
    professionState: { mech: { active: true } }
  });

  assert.deepEqual(
    mechanist.map((group) => group.label),
    ['F Skills']
  );
  assert.deepEqual(
    mechanist.flatMap((group) => group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name)),
    ['Spark Revolver', 'Crisis Zone', 'Barrier Burst', 'Recall Mech']
  );

  const holosmith = engineerProfession.ui.skillBarGroups({
    specialization: 'Holosmith',
    build: { selectedSkills },
    professionState: {}
  });

  assert.deepEqual(
    holosmith.map((group) => group.label),
    ['F Skills', 'Photon Forge']
  );
  assert.deepEqual(
    holosmith[0].skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Regenerating Mist', 'Grenade Barrage', 'Mine Field', 'Surprise Shot (engineer skill)', 'Engage Photon Forge']
  );
  assert.equal(holosmith.at(-1).label, 'Photon Forge');
  assert.deepEqual(
    holosmith.at(-1).skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Light Strike', 'Holo Leap', 'Corona Burst', 'Photon Blitz', 'Holographic Shockwave']
  );
});

test('Engineer slot selection excludes contextual and unsupported utilities', () => {
  const selectable = (name) => engineerProfession.ui.isSlotSkillSelectable({}, engineerCatalog.skillsByName.get(name));

  for (const name of [
    'Elixir B',
    'Elixir C',
    'Elixir S',
    'Elixir U',
    'Elixir R',
    'Utility Goggles',
    'Rocket Boots',
    'Stow Grenade Kit',
    'Stow Flamethrower',
    'Detonate',
    'Detonate Thumper Turret',
    'Detonate Rifle Turret'
  ]) {
    assert.equal(selectable(name), false, name);
  }

  for (const name of ['Grenade Kit', 'Flamethrower', 'Bomb Kit', 'Med Kit', 'Tool Kit', 'Throw Mine', 'Rifle Turret']) {
    assert.equal(selectable(name), true, name);
  }
});

test('Engineer build validation matches unsupported slot filtering', () => {
  const defaults = createEngineerBuildDefaults();

  for (const name of ['Elixir B', 'Harpoon Turret']) {
    const build = {
      ...defaults,
      selectedSkills: {
        ...defaults.selectedSkills,
        Utility1: name
      }
    };
    const validation = validateEngineerBuild(build);

    assert.equal(validation.valid, false, name);
    assert.match(validation.errors.join(' '), /available Utility skill/);
  }
});

test('Engineer mine and turret detonations are armed by their parent skills', () => {
  for (const [parent, flip] of [
    ['Throw Mine', 'Detonate'],
    ['Rifle Turret', 'Detonate Rifle Turret'],
    ['Flame Turret', 'Detonate Flame Turret'],
    ['Net Turret', 'Detonate Net Turret'],
    ['Thumper Turret', 'Detonate Thumper Turret'],
    ['Healing Turret', 'Detonate Healing Turret'],
    ['Rocket Turret', 'Detonate Rocket Turret']
  ]) {
    const config = {
      selectedSkills: [...baseConfig.selectedSkills, parent]
    };
    const denied = simulate('Core', [flip], config);

    assert.match(denied.warnings[0], new RegExp(`use ${parent} first`));

    const result = simulate('Core', [parent, flip], config);

    assert.equal(result.warnings.length, 0, `${parent} -> ${flip}`);
    assert.equal(result.endState.profession.availableFlips[engineerCatalog.skillsByName.get(flip).id], false);
  }

  const mineConfig = {
    selectedSkills: [...baseConfig.selectedSkills, 'Throw Mine']
  };
  const throwStarts = (rotation) =>
    simulate('Core', rotation, mineConfig)
      .steps.filter((step) => step.skill === 'Throw Mine')
      .map((step) => step.start);

  assert.equal(engineerCatalog.skillsByName.get('Throw Mine').rechargeAnchor, 'castStart');
  assert.deepEqual(throwStarts(['Throw Mine', { type: 'wait', durationMs: 11500 }, 'Throw Mine']), [0, 12000]);
  assert.deepEqual(
    throwStarts(['Throw Mine', 'Detonate', { type: 'wait', durationMs: 11500 }, 'Throw Mine']),
    [0, 12000]
  );

  // Gadgeteer's added mine shares the input but produces its own strike and combo attempt.
  const gadgeteer = simulate('Core', ['Bomb Kit', 'Fire Bomb', 'Stow Bomb Kit', 'Throw Mine', 'Detonate'], {
    selectedSkills: [...baseConfig.selectedSkills, 'Bomb Kit'],
    selectedTraitIds: [TRAIT.GADGETEER]
  });
  assert.equal(
    gadgeteer.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Detonate (engineer skill)')
      .length,
    2
  );
  const mineFinishers = gadgeteer.events.filter(
    (event) => event.type === 'combo_finisher' && event.skillName === 'Detonate'
  );
  assert.equal(mineFinishers.length, 2);
  assert.equal(new Set(mineFinishers.map((event) => event.attemptId)).size, 2);
  assert.equal(
    gadgeteer.resolvedEvents.filter((event) => event.type === 'combo' && event.skillName === 'Detonate').length,
    2
  );
});

test('Elixir Gun packets, fields, finishers, and HGH use their authored contracts', () => {
  const selectedSkills = [...baseConfig.selectedSkills, 'Elixir Gun'];
  const result = simulate(
    'Core',
    [
      'Elixir Gun',
      'Tranquilizer Dart',
      'Glob Shot',
      'Fumigate',
      'Acid Bomb',
      'Super Elixir',
      { type: 'wait', durationMs: 6000 }
    ],
    { selectedSkills }
  );
  const damage = (events, name) => events.filter((event) => event.type === 'damage' && event.skillName === name);
  const conditions = (name, condition) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === name && event.condition === condition
    );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    damage(result.resolvedEvents, 'Tranquilizer Dart').map((event) => event.coefficient),
    [0.4]
  );
  assert.deepEqual(
    conditions('Tranquilizer Dart', 'Bleeding').map((event) => [event.stacks, event.duration]),
    [[1, 4]]
  );
  assert.deepEqual(
    conditions('Tranquilizer Dart', 'Weakness').map((event) => [event.stacks, event.duration]),
    [[1, 1]]
  );
  assert.equal(engineerCatalog.skillsById.get(ID.TRANQUILIZER_DART).comboFinishers[0].chance, 0.2);

  assert.deepEqual(
    damage(result.resolvedEvents, 'Glob Shot').map((event) => event.coefficient),
    [0.75]
  );
  assert.deepEqual(
    conditions('Glob Shot', 'Crippled').map((event) => event.duration),
    [3]
  );
  assert.deepEqual(
    conditions('Glob Shot', 'Immobilized').map((event) => event.duration),
    [2]
  );
  assert.equal(engineerCatalog.skillsById.get(ID.GLOB_SHOT).cooldown, 8);

  assert.deepEqual(
    damage(result.resolvedEvents, 'Fumigate').map((event) => event.coefficient),
    [0.4, 0.4, 0.4, 0.4, 0.4]
  );
  assert.deepEqual(
    conditions('Fumigate', 'Poisoned').map((event) => [event.stacks, event.duration]),
    Array(5).fill([1, 2])
  );
  assert.deepEqual(
    conditions('Fumigate', 'Vulnerability').map((event) => [event.stacks, event.duration]),
    Array(5).fill([1, 6])
  );
  assert.equal(engineerCatalog.skillsById.get(ID.FUMIGATE).cooldown, 12);

  assert.deepEqual(
    damage(result.resolvedEvents, 'Acid Bomb').map((event) => event.coefficient),
    [1.35, 0.85, 0.85, 0.85, 0.85, 0.85]
  );
  assert.equal(
    result.events.filter((event) => event.type === 'combo_finisher' && event.skillName === 'Acid Bomb').length,
    1
  );
  assert.equal(engineerCatalog.skillsById.get(ID.ACID_BOMB).effects[0].comboFinishers[0].finisherType, 'Blast');
  assert.equal(engineerCatalog.skillsById.get(ID.SUPER_ELIXIR).cooldown, 16);
  assert.equal(engineerCatalog.skillsById.get(ID.SUPER_ELIXIR).comboFields[0].fieldType, 'Light');

  const hgh = simulate('Core', ['Elixir Gun', 'Acid Bomb', { type: 'wait', durationMs: 6500 }], {
    selectedSkills,
    selectedTraitIds: [TRAIT.HGH]
  });
  const hghField = hgh.events.find((event) => event.type === 'combo_field' && event.skillName === 'Acid Bomb');
  const hghBuff = (kind) =>
    hgh.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.HGH && event.kind === kind);

  assert.equal(damage(hgh.resolvedEvents, 'Acid Bomb').length, 7);
  assert.equal(hghField.expiresAt - hghField.at, 6);
  assert.deepEqual([hghBuff('might').stacks, hghBuff('might').duration], [2, 12]);
  assert.deepEqual([hghBuff('fury').stacks, hghBuff('fury').duration], [1, 4]);
});

test('detonating a turret cancels its remaining summoned attacks', () => {
  const config = {
    selectedSkills: [...baseConfig.selectedSkills, 'Rifle Turret']
  };
  const active = simulate('Core', ['Rifle Turret', { type: 'wait', durationMs: 10000 }], config);
  const detonated = simulate(
    'Core',
    ['Rifle Turret', 'Detonate Rifle Turret', { type: 'wait', durationMs: 10000 }],
    config
  );
  const turretHits = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Rifle Turret' && event.actorType === 'summon'
    );

  assert.equal(turretHits(active).length, 5);
  assert.equal(turretHits(detonated).length, 1);
  assert.equal(
    detonated.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Detonate Rifle Turret')
      .length,
    1
  );
});

test('Engineer contextual weapon follow-ups are not standalone selections', () => {
  const rifleGrenade = engineerCatalog.skillsByName.get('Rifle Burst Grenade');

  assert.equal(rifleGrenade.simulatorExcluded, true);
  assert.equal(
    engineerCatalog.autoattackChains.some((chain) => chain.includes(rifleGrenade.id)),
    false
  );

  const rifleBurst = simulate('Core', ['Rifle Burst']);

  assert.equal(rifleBurst.warnings.length, 0);
  assert.ok(rifleBurst.resolvedEvents.some((event) => event.name === 'Rifle Burst Grenade'));

  const deniedGrenade = simulate('Core', ['Rifle Burst Grenade']);

  assert.match(deniedGrenade.warnings[0], /activates automatically/);

  for (const [parent, flip] of [
    ['Magnetic Shield', 'Magnetic Inversion'],
    ['Static Shield', 'Throw Shield']
  ]) {
    const denied = simulate('Core', [flip]);

    assert.match(denied.warnings[0], new RegExp(`use ${parent} first`));

    const used = simulate('Core', [parent, flip]);

    assert.equal(used.warnings.length, 0, flip);
    assert.equal(used.endState.profession.availableFlips[engineerCatalog.skillsByName.get(flip).id], false, flip);
  }
});

test('tool-belt skills derive from selected slot skills', () => {
  const available = simulate('Core', ['Grenade Barrage']);

  assert.equal(available.warnings.length, 0);
  assert.ok(available.totalDamage > 0);

  const denied = simulate('Core', ['Grenade Barrage'], {
    selectedSkills: ['Healing Turret', 'Throw Mine', 'Rifle Turret', 'Supply Crate']
  });

  assert.match(denied.warnings[0], /Grenade Kit is not equipped/);
});

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
  assert.equal(lightStrike.effects[0].atMs, 200);
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
  assert.equal(brightSlash.effects[0].atMs, 320);
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
  assert.ok(staticShock.effects.every((effect) => effect.atMs === 480));

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
  const selectedSkills = ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Prime Light Beam'];
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
  const packetFor = (skillName, initialHeat, selectedTraitIds, selectedSkills, packetName = skillName) => {
    const result = simulate('Holosmith', [skillName, { type: 'wait', durationMs: 1000 }], {
      initialHeat,
      selectedTraitIds,
      selectedSkills,
      stats: { precision: 1000, ferocity: 0 }
    });

    return result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillName === skillName && event.name === packetName
    );
  };

  const utilitySkills = ['A.E.D.', 'Grenade Kit', 'Photon Wall', 'Laser Disk', 'Prime Light Beam'];
  const singularitySkills = ['A.E.D.', 'Grenade Kit', 'Photon Wall', 'Hard Light Arena', 'Prime Light Beam'];
  const ratio = (variant, base) => variant.damage / base.damage;

  const baseBladeBurst = packetFor('Blade Burst', 0, [], utilitySkills);
  const baseParticleAccelerator = packetFor('Particle Accelerator', 0, [], utilitySkills);
  const baseSingularityExplosion = packetFor('Prismatic Singularity', 0, [], singularitySkills, 'Explosion Damage');
  const baseSingularityPull = packetFor('Prismatic Singularity', 0, [], singularitySkills, 'Pull Damage');
  const enhancedSingularityExplosion = packetFor(
    'Prismatic Singularity',
    101,
    [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    singularitySkills,
    'Explosion Damage'
  );
  const enhancedSingularityPull = packetFor(
    'Prismatic Singularity',
    101,
    [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    singularitySkills,
    'Pull Damage'
  );

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
  assert.ok(
    Math.abs(
      ratio(
        packetFor(
          'Prismatic Singularity',
          100,
          [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
          singularitySkills,
          'Explosion Damage'
        ),
        baseSingularityExplosion
      ) - 1
    ) < 1e-12
  );
  assert.ok(
    Math.abs(
      ratio(enhancedSingularityExplosion, enhancedSingularityPull) /
        ratio(baseSingularityExplosion, baseSingularityPull) -
        1.25
    ) < 1e-12
  );
  assert.equal(
    ratio(
      packetFor('Prismatic Singularity', 100, [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT], singularitySkills, 'Pull Damage'),
      baseSingularityPull
    ),
    1
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

test('Mechanist commands are selected by traits and mech attacks persist', () => {
  const result = simulate('Mechanist', ['Spark Revolver', { type: 'wait', durationMs: 2000 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
      TRAIT.MECH_CORE_BARRIER_ENGINE
    ]
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.profession.mech.commandSkillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Spark Revolver', 'Crisis Zone', 'Barrier Burst']
  );
  assert.ok(
    result.resolvedEvents.some((event) => event.skillName === 'Jade Energy Shot' && event.actorType === 'summon')
  );
});

test('Mechanist commands use a serial mech lane without reserving the engineer lane', () => {
  const result = simulate('Mechanist', ['Refraction Cutter', 'Spark Revolver', 'Radiant Arc', 'Core Reactor Shot'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedTraitIds: [
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ]
  });
  const refraction = result.steps.find((step) => step.skill === 'Refraction Cutter');
  const spark = result.steps.find((step) => step.skill === 'Spark Revolver');
  const radiant = result.steps.find((step) => step.skill === 'Radiant Arc');
  const reactor = result.steps.find((step) => step.skill === 'Core Reactor Shot');

  // The engineer advances after its own cast while the second mech command
  // waits for the first command's independent animation to finish.
  assert.deepEqual(result.warnings, []);
  assert.equal(spark.start, refraction.start);
  assert.equal(radiant.start, refraction.end);
  assert.ok(radiant.start < spark.end);
  assert.equal(reactor.start, spark.end);

  const instant = simulate('Mechanist', ['Spark Revolver', 'Crisis Zone'], {
    selectedTraitIds: [TRAIT.MECH_ARMS_JADE_CANNONS, TRAIT.MECH_FRAME_CHANNELING_CONDUITS, TRAIT.MECH_CORE_JADE_DYNAMO]
  }).steps;

  assert.equal(instant[1].start, instant[0].start);
  assert.equal(instant[1].start, instant[1].end);
});

test('Amalgam exposes only persisted F2-F4 morph choices', () => {
  const selected = simulate('Amalgam', [77103], {
    selectedMorphSkillIds: [77103, 77203, 76954]
  });

  assert.equal(selected.warnings.length, 0);
  assert.ok(selected.totalDamage > 0);

  const denied = simulate('Amalgam', [76568], {
    selectedMorphSkillIds: [77103, 77203, 76954]
  });

  assert.match(denied.warnings[0], /another morph is selected/);

  const groups = engineerProfession.ui.skillBarGroups({
    specialization: 'Amalgam',
    build: {
      selectedSkills: {
        Heal: 'Healing Turret'
      },
      selectedMorphSkillIds: [77103, 77203, 76954]
    }
  });

  assert.deepEqual(
    groups.map((group) => group.label),
    ['F Skills', 'Protocols']
  );
  assert.deepEqual(
    groups[0].skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Regenerating Mist', 'Evolve']
  );
  const protocolSelections = groups[1].selections;

  assert.deepEqual(
    protocolSelections.map((selection) => engineerCatalog.skillsById.get(selection.skillId).name),
    ['Offensive Protocol: Shred', 'Defensive Protocol: Protect', 'Offensive Protocol: Demolish']
  );
  assert.equal(groups[1].className, 'engineer-amalgam-protocols');
  assert.deepEqual(
    protocolSelections.map((selection) => [selection.keyLabel, selection.typeLabel]),
    [
      ['F2', 'Protocol'],
      ['F3', 'Protocol'],
      ['F4', 'Protocol']
    ]
  );
  assert.ok(
    protocolSelections.every(
      (selection) => selection.selectionKey === 'selectedMorphSkillIds' && selection.optionSkillIds.length === 7
    )
  );
});

test('Amalgam protocol selection swaps conflicting protocol names', () => {
  const build = {
    selectedMorphSkillIds: [77103, 77203, 76954]
  };
  const select = (index, skillId) =>
    engineerProfession.ui.updateSkillBarSelection(
      { specialization: 'Amalgam', build },
      {
        key: 'selectedMorphSkillIds',
        index,
        skillId
      }
    );

  assert.equal(select(0, 76959), true);
  assert.deepEqual(build.selectedMorphSkillIds, [76959, 76866, 76954]);
  assert.deepEqual(
    build.selectedMorphSkillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Defensive Protocol: Protect', 'Offensive Protocol: Shred', 'Offensive Protocol: Demolish']
  );

  assert.equal(select(1, 76693), true);
  assert.deepEqual(build.selectedMorphSkillIds, [76959, 76693, 76568]);
  assert.equal(new Set(build.selectedMorphSkillIds.map((id) => engineerCatalog.skillsById.get(id).name)).size, 3);
});

test('Engineer packets use total coefficients and configured cadence', () => {
  const mechanic = (name) => engineerCatalog.skillsByName.get(name);

  assert.equal(mechanic('Shrapnel Grenade').quicknessCastTimeMs, 680);
  assert.equal(mechanic('Poison Grenade').quicknessCastTimeMs, 680);
  assert.equal(mechanic('Freeze Grenade').quicknessCastTimeMs, 680);
  assert.equal(mechanic('Flame Jet').castTimeMs, 2570);
  assert.equal(mechanic('Flame Jet').effects[0].coefficient, 2.5);
  assert.equal(
    mechanic('Napalm').effects[0].ticks.reduce((total, packet) => total + packet.coefficient, 0),
    5
  );
  assert.equal(mechanic('Napalm').quicknessCastTimeMs, 1760);
  assert.equal(mechanic('Napalm').cooldown, 25);
  assert.equal(mechanic('Napalm').interruptMode, 'per-packet');
  assert.deepEqual(
    mechanic('Napalm').effects[0].ticks.map((packet) => packet.atMs),
    [280, 441, 560, 679, 842, 955, 1077, 1240, 1361, 1482]
  );
  assert.equal(mechanic('Napalm').effects[1].ticks.length, 10);
  assert.deepEqual(
    mechanic('Napalm').effects[1].ticks.map((packet) => packet.atMs),
    mechanic('Napalm').effects[0].ticks.map((packet) => packet.atMs)
  );
  assert.equal(mechanic('Flame Blast').cooldown, 6);
  assert.equal(mechanic('Flame Blast').quicknessCastTimeMs, 800);
  assert.equal(mechanic('Flame Blast').effects[0].metadata.damageKind, 'explosion');
  assert.deepEqual(
    [
      'Fragmentation Shot',
      'Poison Dart Volley',
      'Static Shot',
      'Glue Shot',
      'Blowtorch',
      'Prime Light Beam',
      'Corona Burst',
      'Photon Blitz'
    ].map((name) => [name, mechanic(name).quicknessCastTimeMs]),
    [
      ['Fragmentation Shot', 520],
      ['Poison Dart Volley', 840],
      ['Static Shot', 320],
      ['Glue Shot', 560],
      ['Blowtorch', 560],
      ['Prime Light Beam', 1160],
      ['Corona Burst', 480],
      ['Photon Blitz', 1320]
    ]
  );
  assert.equal(mechanic('Poison Dart Volley').effects[0].coefficient, 2);
  assert.equal(mechanic('Poison Dart Volley').effects[1].ticks.length, 5);
  assert.equal(mechanic('Static Shot').effects[1].stacks, 3);
  assert.equal(mechanic('Static Shot').effects[1].duration, 5);
  assert.equal(mechanic('Glue Shot').effects[0].coefficient, 2.5);
  assert.equal(mechanic('Blowtorch').effects[0].coefficient, 2);
  assert.equal(mechanic('Blowtorch').effects[1].duration, 4.5);
  assert.deepEqual(
    mechanic('Corona Burst')
      .effects.filter((effect) => effect.type === 'strike')
      .map((effect) => effect.coefficient),
    [1.5, 1.5]
  );
  assert.ok(
    mechanic('Corona Burst')
      .effects.filter((effect) => effect.type === 'strike')
      .every((effect) => effect.metadata.damageKind === 'explosion')
  );
  assert.equal(
    mechanic('Photon Blitz').effects[0].ticks.reduce((total, tick) => total + tick.coefficient, 0),
    5.12
  );
  assert.equal(mechanic('Photon Blitz').effects[0].ticks[0].atMs, 280);
  assert.deepEqual(
    ['Laser Disk', 'Photon Wall', 'Launch Wall', 'Prime Light Beam'].map((name) => [
      name,
      mechanic(name).cooldown,
      mechanic(name).quicknessCastTimeMs
    ]),
    [
      ['Laser Disk', 30, 960],
      ['Photon Wall', 25, 400],
      ['Launch Wall', 0.5, 520],
      ['Prime Light Beam', 60, 1160]
    ]
  );
  assert.equal(mechanic('Prime Light Beam').effects[0].coefficient, 3);
  assert.equal(mechanic('Prime Light Beam').effects[0].metadata.damageKind, 'explosion');
  assert.equal(mechanic('Prime Light Beam').effects[2].metadata.controlKind, 'launch');
  assert.equal(mechanic('Grenade Barrage').effects[0].weapon, 'Profession mechanic');
  assert.equal(mechanic('Blade Burst').effects[0].weapon, 'Profession mechanic');
  assert.equal(mechanic('Particle Accelerator').effects[0].weapon, 'Profession mechanic');
  assert.equal(mechanic('Static Shock').effects[0].weapon, 'Profession mechanic');
  assert.equal(mechanic('Prime Light Beam').effects[1].eventType, 'engineer.prime-light-beam-field');
  assert.equal(mechanic('Grenade Barrage').effects[0].metadata.damageKind, 'explosion');
  assert.equal(mechanic('Air Blast').quicknessCastTimeMs, 360);
  assert.equal(mechanic('Puncturing Jab').quicknessCastTimeMs, 440);
  assert.equal(mechanic('Rending Strike').quicknessCastTimeMs, 520);
  assert.equal(mechanic('Amplifying Slice').quicknessCastTimeMs, 640);
  assert.equal(mechanic('Lightning Rod').castTimeMs, 400);
  assert.equal(mechanic('Lightning Rod').unaffectedByQuickness, true);
  assert.equal(mechanic('Conduit Surge').castTimeMs, 520);
  assert.equal(mechanic('Conduit Surge').unaffectedByQuickness, true);
  assert.equal(mechanic('Electric Artillery').quicknessCastTimeMs, 520);
  assert.equal(mechanic('Stoke the Flames').quicknessCastTimeMs, 440);
  assert.equal(mechanic('Evolve').quicknessCastTimeMs, 640);
  assert.equal(mechanic('Devastator').castTimeMs, 1000);
  assert.equal(mechanic('Devastator').unaffectedByQuickness, true);

  const shredSkill = mechanic('Offensive Protocol: Shred');
  const shred = shredSkill.effects[0];

  assert.equal(shredSkill.quicknessCastTimeMs, 760);
  assert.deepEqual(
    shred.ticks.map((packet) => packet.coefficient),
    [0.96, 0.96, 0.96]
  );
  assert.deepEqual(
    shred.ticks.map((packet) => packet.atMs),
    [638.4, 684, 729.6]
  );
  assert.equal(shredSkill.effects[1].condition, 'Immobilized');
  assert.equal(shredSkill.effects[1].duration, 3);

  const demolish = mechanic('Offensive Protocol: Demolish');

  assert.equal(demolish.castTimeMs, 2340);
  assert.equal(demolish.quicknessCastTimeMs, 1000 + 560);
  assert.equal(demolish.rechargeAnchor, 'castStart');
  assert.equal(demolish.rechargeOffsetMs, 1000);
  assert.deepEqual(
    demolish.effects[0].ticks.map((packet) => [packet.atMs, packet.coefficient]),
    [
      [360, 0.9],
      [640, 0.9],
      [920, 0.9]
    ]
  );
  assert.equal(demolish.effects[1].coefficient, 2.25);
  assert.equal(demolish.effects[1].atMs, 1440);
  assert.equal(
    demolish.effects.some((effect) => effect.boon === 'stability'),
    false
  );
  const obliterate = mechanic('Offensive Protocol: Obliterate');

  assert.equal(obliterate.quicknessCastTimeMs, 800);
  assert.equal(obliterate.effects[0].coefficient, 2.88);
  assert.equal(obliterate.effects[0].atMs, 640);
  assert.equal(obliterate.effects[0].timingAnchor, 'castStart');
  assert.equal(obliterate.effects[1].condition, 'Bleeding');
  assert.equal(obliterate.effects[1].stacks, 8);
  assert.equal(obliterate.effects[1].duration, 6);
  assert.equal(obliterate.effects[1].atMs, 640);

  const flux = mechanic('Flux State');

  assert.equal(flux.quicknessCastTimeMs, 640);
  assert.equal(flux.effects[1].coefficient, 9);
  assert.equal(flux.effects[1].hits, 12);
  assert.equal(flux.effects[1].atMs, 520);
  assert.equal(flux.effects[1].intervalMs, 520);
  assert.equal(flux.effects[2].ticks.length, 12);

  const plasmatic = mechanic('Plasmatic State');

  assert.equal(plasmatic.castTimeMs, 1440);
  assert.equal(plasmatic.quicknessCastTimeMs, 480 + 480);
  assert.equal(plasmatic.rechargeAnchor, 'castStart');
  assert.equal(plasmatic.rechargeOffsetMs, 480);
  assert.equal(
    plasmatic.effects[0].ticks.reduce((sum, packet) => sum + packet.coefficient, 0),
    4.5
  );
  assert.equal(plasmatic.effects[1].ticks.length, 2);

  const spark = mechanic('Spark Revolver').effects[0];

  const mechCommands = engineerCatalog.skills.filter(
    (skill) =>
      skill.specialization === 'Mechanist' && Number(skill.mechanicSlot) >= 1 && Number(skill.mechanicSlot) <= 3
  );

  assert.equal(mechCommands.length, 9);
  assert.equal(
    mechCommands.every((skill) => skill.independentCast === true),
    true
  );
  const instantMechCommands = mechCommands.filter((skill) => skill.castTimeMs === 0);

  assert.deepEqual(
    instantMechCommands.map((skill) => skill.name),
    ['Crisis Zone', 'Discharge Array']
  );
  assert.equal(
    instantMechCommands.every((skill) => skill.independentCastCanOverlap === true),
    true
  );
  assert.equal(
    mechCommands.filter((skill) => skill.castTimeMs > 0).every((skill) => skill.independentCastCanOverlap !== true),
    true
  );
  assert.deepEqual(
    ['Core Reactor Shot', 'Jade Mortar', 'Spark Revolver'].map((name) => mechanic(name).quicknessCastTimeMs),
    [1000, 1080, 1400]
  );
  assert.equal(
    ['Core Reactor Shot', 'Jade Mortar', 'Spark Revolver'].every(
      (name) => mechanic(name).rechargeAnchor === 'castStart'
    ),
    true
  );

  assert.ok(Math.abs(spark.ticks.reduce((sum, packet) => sum + packet.coefficient, 0) - 2.112) < 1e-12);
  assert.equal(spark.ticks.length, 12);
  assert.equal(spark.actorType, 'summon');
});

test('Engineer sword variants have specialization-owned facts and runtime gating', () => {
  const skill = (id) => engineerCatalog.skillsById.get(id);
  const mechanistRuntime = engineerProfession.resolveRuntime({ specialization: 'Mechanist' });
  const holosmithRuntime = engineerProfession.resolveRuntime({ specialization: 'Holosmith' });

  for (const id of [
    ID.SUN_EDGE_ID_70514,
    ID.SUN_RIPPER_ID_69906,
    ID.GLEAM_SABER_ID_70771,
    ID.RADIANT_ARC_ID_69565,
    ID.REFRACTION_CUTTER_ID_71121
  ]) {
    assert.equal(skill(id).specialization, '');
  }

  assert.equal(mechanistRuntime.catalog.skillsById.has(ID.GLEAM_SABER), false);
  assert.equal(mechanistRuntime.catalog.skillsById.has(ID.GLEAM_SABER_ID_70771), true);
  assert.equal(
    holosmithRuntime.ui.weaponSkillMatchesSet(
      holosmithRuntime.catalog.skillsById.get(ID.GLEAM_SABER_ID_70771),
      ['Sword'],
      { specialization: 'Holosmith' }
    ),
    false
  );
  assert.equal(
    holosmithRuntime.ui.weaponSkillMatchesSet(holosmithRuntime.catalog.skillsById.get(ID.GLEAM_SABER), ['Sword'], {
      specialization: 'Holosmith'
    }),
    true
  );

  assert.equal(skill(ID.SUN_EDGE).effects[0].coefficient, 0.88);
  assert.deepEqual(
    skill(ID.SUN_EDGE)
      .effects.slice(1)
      .map((effect) => [effect.condition, effect.stacks, effect.duration]),
    [['Vulnerability', 1, 10]]
  );
  assert.equal(skill(ID.SUN_RIPPER).effects[0].coefficient, 0.93);
  assert.equal(skill(ID.GLEAM_SABER).effects[0].coefficient, 1.5);
  assert.equal(skill(ID.RADIANT_ARC).effects[0].coefficient, 2.5);
  assert.equal(skill(ID.RADIANT_ARC).cooldown, 12);
  assert.equal(skill(ID.RADIANT_ARC).comboFinishers[0].finisherType, 'Leap');
  assert.deepEqual(
    skill(ID.RADIANT_ARC)
      .effects.filter((effect) => effect.type === 'condition')
      .map((effect) => [effect.condition, effect.stacks, effect.duration]),
    [['Crippled', 1, 4]]
  );
  assert.equal(skill(ID.REFRACTION_CUTTER).effects[0].coefficient, 1.4);
  assert.equal(skill(ID.REFRACTION_CUTTER).effects[1].coefficient, 0.4);
  assert.equal(skill(ID.REFRACTION_CUTTER).effects[1].comboFinishers[0].chance, 1);
  assert.equal(skill(ID.REFRACTION_CUTTER_BLADE).effects[0].coefficient, 0.4);

  assert.equal(skill(ID.SUN_EDGE_ID_70514).effects[0].coefficient, 0.96);
  assert.equal(skill(ID.SUN_RIPPER_ID_69906).effects[0].coefficient, 1.02);
  assert.equal(skill(ID.GLEAM_SABER_ID_70771).effects[0].coefficient, 1.65);
  assert.equal(skill(ID.RADIANT_ARC_ID_69565).effects[0].coefficient, 2.5);
  assert.equal(skill(ID.RADIANT_ARC_ID_69565).cooldown, 14);
  assert.equal(skill(ID.RADIANT_ARC_ID_69565).comboFinishers[0].finisherType, 'Leap');
  assert.deepEqual(
    skill(ID.RADIANT_ARC_ID_69565)
      .effects.slice(1)
      .map((effect) => [effect.condition || effect.boon, effect.stacks, effect.duration]),
    [
      ['Crippled', 1, 4],
      ['quickness', 1, 3]
    ]
  );

  const refraction = skill(ID.REFRACTION_CUTTER_ID_71121);

  assert.equal(refraction.cooldown, 6);
  assert.equal(refraction.effects[0].coefficient, 1.4);
  assert.equal(refraction.effects[1].coefficient, 0.8);
  assert.equal(refraction.effects[1].hits, 2);
  assert.equal(refraction.effects[1].comboFinishers[0].chance, 1);
  assert.equal(refraction.effects[2].applications, 2);

  const replaced = simulate('Holosmith', [{ type: 'cast', skillId: ID.SUN_EDGE_ID_70514 }]);

  assert.match(replaced.warnings[0], /Holosmith replaces this sword skill/);

  const quicknessDurations = [
    simulate('Holosmith', ['Radiant Arc'], { initialHeat: 0 }),
    simulate('Holosmith', ['Radiant Arc'], { initialHeat: 60 }),
    simulate('Holosmith', ['Radiant Arc'], { initialHeat: 101 }),
    simulate('Holosmith', ['Radiant Arc'], {
      initialHeat: 100,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
    }),
    simulate('Holosmith', ['Radiant Arc'], {
      initialHeat: 101,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
    })
  ].map(
    (simulation) =>
      simulation.events.find(
        (event) => event.type === 'engineer.radiant-arc-quickness' && event.name === 'Radiant Arc - quickness'
      ).duration
  );

  assert.deepEqual(quicknessDurations, [2, 4, 4, 4, 6]);

  const result = simulate('Mechanist', [
    { type: 'cast', skillId: ID.REFRACTION_CUTTER_ID_71121 },
    { type: 'cast', skillId: ID.SUN_EDGE_ID_70514 },
    { type: 'cast', skillId: ID.SUN_RIPPER_ID_69906 },
    { type: 'cast', skillId: ID.GLEAM_SABER_ID_70771 },
    { type: 'wait', durationMs: 200 }
  ]);
  const blades = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Refraction Cutter Blade'
  );
  const bleeds = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Refraction Cutter' && event.condition === 'Bleeding'
  );

  assert.deepEqual(
    blades.map((event) => event.coefficient),
    [0.4, 0.4]
  );
  assert.ok(blades.every((event) => event.comboFinishers[0].chance === 1));
  assert.equal(bleeds.length, 2);
  assert.ok(bleeds.every((event) => event.stacks === 1 && event.duration === 4));
  const core = simulate(
    'Core',
    [
      { type: 'cast', skillId: ID.REFRACTION_CUTTER_ID_71121 },
      { type: 'cast', skillId: ID.SUN_EDGE_ID_70514 },
      { type: 'cast', skillId: ID.SUN_RIPPER_ID_69906 },
      { type: 'cast', skillId: ID.GLEAM_SABER_ID_70771 },
      { type: 'cast', skillId: ID.RADIANT_ARC_ID_69565 }
    ],
    { primaryWeapon: 'Sword', secondaryWeapon: 'Pistol' }
  );

  assert.deepEqual(core.warnings, []);
  assert.ok(
    result.procSteps.some((step) => step.skill === 'Gleam Saber — Sword Recharge' && step.cooldownReduction === 1)
  );
});

test('Engineer mace packets retain player, explosion, and finisher classifications', () => {
  const result = simulate('Mechanist', ['Mace Strike', 'Mace Smash', 'Mace Blast', 'Rocket Fist Prototype']);

  assert.equal(result.warnings.length, 0);
  const damage = (name) => result.events.find((event) => event.type === 'damage' && event.name === name);
  const smash = damage('Mace Smash');
  const blast = damage('Mace Blast');
  const fist = damage('Rocket Fist Prototype');

  assert.equal(smash.actorType, 'player');
  assert.equal(
    result.events.find((event) => event.type === 'condition' && event.skillName === 'Mace Smash').actorType,
    'player'
  );
  assert.equal(blast.damageKind, 'explosion');
  assert.equal(engineerCatalog.skillsById.get(ID.MACE_BLAST).comboFinishers[0].finisherType, 'Leap');
  assert.equal(fist.damageKind, 'explosion');
  assert.equal(fist.projectile, true);
  assert.equal(fist.comboFinishers[0].finisherType, 'Projectile');
});

test('Mechanist rifle uses live close-range packets and measured cadence', () => {
  const skill = (name) => engineerCatalog.skillsByName.get(name);
  const burst = skill('Rifle Burst');

  assert.equal(burst.castTimeMs, 960);
  assert.equal(burst.quicknessCastTimeMs, 640);
  assert.equal(burst.interruptMode, 'per-packet');
  assert.deepEqual(
    burst.effects.map((effect) => [effect.coefficient, effect.atMs]),
    [
      [0.6, 320],
      [0.8, 600]
    ]
  );
  assert.equal(burst.effects[0].comboFinishers[0].chance, 0.2);
  assert.equal(burst.effects[1].metadata.damageKind, 'explosion');

  const blunderbuss = skill('Blunderbuss');

  assert.equal(blunderbuss.cooldown, 6);
  assert.equal(blunderbuss.effects[0].coefficient, 2.2);
  assert.deepEqual(
    blunderbuss.effects
      .filter((effect) => effect.condition === 'Bleeding')
      .map((effect) => [effect.stacks, effect.duration]),
    [[3, 9]]
  );

  const net = skill('Net Shot');

  assert.equal(net.cooldown, 9);
  assert.equal(net.effects[0].coefficient, 1.25);
  assert.ok(net.effects.some((effect) => effect.condition === 'Immobilized' && effect.duration === 4));
  assert.ok(
    net.effects.some((effect) => effect.condition === 'Vulnerability' && effect.stacks === 8 && effect.duration === 8)
  );

  const overcharged = skill('Overcharged Shot');

  assert.equal(overcharged.cooldown, 14);
  assert.equal(overcharged.effects[0].coefficient, 1);
  assert.equal(overcharged.effects[1].metadata.controlKind, 'launch');

  const result = simulate('Mechanist', ['Rifle Burst'], {
    boons: { quickness: true }
  });

  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'damage' && ['Rifle Burst', 'Rifle Burst Grenade'].includes(event.name))
      .map((event) => [event.name, event.at, event.coefficient]),
    [
      ['Rifle Burst', 0.32, 0.6],
      ['Rifle Burst Grenade', 0.6, 0.8]
    ]
  );

  const interruptedPackets = (interruptMs) =>
    simulate(
      'Mechanist',
      [
        { name: 'Rifle Burst', interruptMs },
        { type: 'wait', durationMs: 1000 }
      ],
      { boons: { quickness: true } }
    ).events.filter((event) => event.type === 'damage' && ['Rifle Burst', 'Rifle Burst Grenade'].includes(event.name));

  assert.deepEqual(
    interruptedPackets(319).map((event) => event.name),
    []
  );
  assert.deepEqual(
    interruptedPackets(320).map((event) => event.name),
    ['Rifle Burst']
  );
  assert.deepEqual(
    interruptedPackets(599).map((event) => event.name),
    ['Rifle Burst']
  );
  assert.deepEqual(
    interruptedPackets(600).map((event) => event.name),
    ['Rifle Burst', 'Rifle Burst Grenade']
  );
});

test('Engineer hammer skills use the requested packets and field cadence', () => {
  const skill = (name) => engineerCatalog.skillsByName.get(name);

  assert.equal(skill('Positive Strike').quicknessCastTimeMs, 480);
  assert.equal(skill('Positive Strike').effects[0].coefficient, 0.7);
  assert.deepEqual(skill('Positive Strike').effects[1], {
    type: 'boon',
    boon: 'might',
    duration: 8,
    stacks: 1,
    atMs: 360,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  });
  assert.equal(skill('Negative Bash').quicknessCastTimeMs, 640);
  assert.equal(skill('Negative Bash').effects[0].coefficient, 1);
  assert.equal(skill('Negative Bash').effects[1].duration, 8);
  assert.equal(skill('Equalizing Blow').quicknessCastTimeMs, 440);
  assert.equal(skill('Equalizing Blow').effects[0].coefficient, 1.4);
  assert.equal(skill('Equalizing Blow').effects[1].stacks, 3);
  assert.equal(skill('Equalizing Blow').effects[2].stacks, 3);

  const electro = skill('Electro-whirl');

  assert.equal(electro.cooldown, 6);
  assert.equal(electro.effects[0].coefficient, 3);
  assert.equal(electro.effects[0].hits, 2);
  assert.equal(electro.effects[0].metadata.damageKind, 'explosion');
  assert.equal(electro.comboFinishers[0].finisherType, 'Whirl');

  const rocket = skill('Rocket Charge');

  assert.equal(rocket.castTimeMs, 1920);
  assert.equal(rocket.quicknessCastTimeMs, undefined);
  assert.equal(rocket.unaffectedByQuickness, true);
  assert.equal(rocket.cooldown, 12);
  assert.deepEqual(rocket.effects[0].ticks, [
    { atMs: 640, coefficient: 1.2 },
    { atMs: 1240, coefficient: 1.2 },
    { atMs: 1920, coefficient: 1.2 }
  ]);

  const hammerTiming = simulate('Core', ['Positive Strike', 'Negative Bash', 'Equalizing Blow', 'Rocket Charge'], {
    boons: { quickness: true }
  });

  assert.deepEqual(
    hammerTiming.steps.map((step) => step.end - step.start),
    [480, 640, 440, 1920]
  );
  assert.deepEqual(
    hammerTiming.events
      .filter(
        (event) =>
          event.type === 'damage' &&
          ['Positive Strike', 'Negative Bash', 'Equalizing Blow', 'Rocket Charge'].includes(event.name)
      )
      .map((event) => [event.name, Number(event.at.toFixed(2))]),
    [
      ['Positive Strike', 0.36],
      ['Negative Bash', 0.8],
      ['Equalizing Blow', 1.44],
      ['Rocket Charge', 2.2],
      ['Rocket Charge', 2.8],
      ['Rocket Charge', 3.48]
    ]
  );

  const shield = skill('Shock Shield');

  assert.equal(shield.cooldown, 18);
  assert.equal(shield.blockDuration, 2);
  assert.equal(shield.effects[0].coefficient, 1.25);
  assert.equal(shield.effects[0].hits, 5);
  assert.equal(shield.effects[1].stacks, 10);
  assert.equal(shield.effects[1].duration, 5);

  const thunder = simulate('Core', ['Thunderclap', { type: 'wait', durationMs: 5000 }]);
  const thunderDamage = thunder.events.filter((event) => event.type === 'damage' && event.name === 'Thunderclap');
  const thunderVulnerability = thunder.events.filter(
    (event) => event.type === 'condition' && event.name === 'Thunderclap — Vulnerability'
  );
  const thunderControl = thunder.events.find((event) => event.type === 'control' && event.skillName === 'Thunderclap');

  assert.deepEqual(
    thunderDamage.map((event) => event.at),
    [1.75, 2.75, 3.75, 4.75, 5.75]
  );
  assert.ok(thunderDamage.every((event) => event.coefficient === 0.8));
  assert.equal(thunderVulnerability.length, 5);
  assert.ok(thunderVulnerability.every((event) => event.stacks === 1 && event.duration === 8));
  assert.equal(thunderControl.at, 0.75);
  assert.equal(thunderControl.controlKind, 'stun');
  assert.equal(skill('Thunderclap').comboFields[0].fieldType, 'Lightning');

  const quickThunder = simulate('Core', ['Thunderclap', { type: 'wait', durationMs: 5000 }], {
    boons: { quickness: true }
  });

  assert.equal(quickThunder.steps[0].end, 520);
  assert.deepEqual(
    quickThunder.events
      .filter((event) => event.type === 'damage' && event.name === 'Thunderclap')
      .map((event) => Number(event.at.toFixed(2))),
    [1.52, 2.52, 3.52, 4.52, 5.52]
  );
});

test('Bomb Kit packets honor fuses, explosions, fields, and finishers', () => {
  const selectedSkills = ['Healing Turret', 'Bomb Kit', 'Grenade Kit', 'Rifle Turret', 'Supply Crate'];
  const waitForBombPackets = () => ({ type: 'wait', durationMs: 5000 });
  const bombSkills = engineerCatalog.skills.filter(
    (candidate) => candidate.kit === 'Bomb Kit' && candidate.effects.some((effect) => effect.type === 'strike')
  );

  assert.ok(
    bombSkills.every((candidate) =>
      candidate.effects
        .filter((effect) => effect.type === 'strike')
        .every((effect) => effect.metadata?.damageKind === 'explosion')
    )
  );

  const bomb = simulate('Core', ['Bomb Kit', 'Bomb', waitForBombPackets()], {
    selectedSkills
  });
  const bombHit = bomb.events.find((event) => event.type === 'damage' && event.name === 'Bomb');

  assert.equal(bombHit.at, 1);
  assert.equal(bombHit.coefficient, 1.2);
  assert.equal(bombHit.damageKind, 'explosion');

  const fire = simulate('Core', ['Bomb Kit', 'Fire Bomb', waitForBombPackets()], { selectedSkills });
  const fireHits = fire.events.filter((event) => event.type === 'damage' && event.name === 'Fire Bomb');
  const fireBurns = fire.events.filter((event) => event.type === 'condition' && event.name === 'Fire Bomb — Burning');

  assert.deepEqual(
    fireHits.map((event) => Number(event.at.toFixed(2))),
    [1.66, 2.66, 3.66, 4.66]
  );
  assert.ok(fireHits.every((event) => event.coefficient === 0.25));
  assert.deepEqual(
    fireBurns.map((event) => [Number(event.at.toFixed(2)), event.stacks, event.duration]),
    [
      [1.66, 2, 5],
      [2.66, 1, 2],
      [3.66, 1, 2],
      [4.66, 1, 2]
    ]
  );
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').quicknessCastTimeMs, 600);
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').interruptCommitMs, 400);
  const interruptedFire = (interruptMs) =>
    simulate('Core', ['Bomb Kit', { name: 'Fire Bomb', interruptMs }, waitForBombPackets()], {
      selectedSkills,
      boons: { quickness: true }
    }).events.filter((event) => event.type === 'damage' && event.name === 'Fire Bomb');

  assert.equal(interruptedFire(399).length, 0);
  assert.equal(interruptedFire(400).length, 4);
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').comboFields[0].fieldType, 'Fire');
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').comboFields[0].duration, 3);

  const galvanic = simulate('Core', ['Bomb Kit', 'Galvanic Bomb', waitForBombPackets()], { selectedSkills });

  assert.ok(
    galvanic.events.some(
      (event) => event.type === 'damage' && Math.abs(event.at - 1.66) < 1e-12 && event.coefficient === 2.5
    )
  );
  assert.ok(
    galvanic.events.some(
      (event) =>
        event.type === 'condition' && event.condition === 'Confusion' && event.stacks === 6 && event.duration === 8
    )
  );
  assert.ok(
    galvanic.events.some((event) => event.type === 'control' && event.controlKind === 'daze' && event.duration === 1)
  );
  assert.equal(engineerCatalog.skillsByName.get('Galvanic Bomb').comboFinishers[0].finisherType, 'Blast');
  assert.equal(engineerCatalog.skillsByName.get('Galvanic Bomb').quicknessCastTimeMs, 600);

  const magnetic = engineerCatalog.skillsByName.get('Magnetic Bomb');

  assert.equal(magnetic.effects[0].coefficient, 1.5);
  assert.equal(magnetic.effects[1].metadata.controlKind, 'pull');
  assert.equal(magnetic.quicknessCastTimeMs, 600);
  const magneticResult = simulate('Core', ['Bomb Kit', 'Magnetic Bomb', waitForBombPackets()], {
    selectedSkills,
    boons: { quickness: true }
  });

  assert.ok(
    magneticResult.events.some(
      (event) => event.type === 'damage' && event.name === 'Magnetic Bomb' && Math.abs(event.at - 2.36) < 1e-12
    )
  );
  assert.ok(
    magneticResult.events.some(
      (event) => event.type === 'control' && event.skillName === 'Magnetic Bomb' && Math.abs(event.at - 2.36) < 1e-12
    )
  );

  const big = simulate('Core', ['Bomb Kit', "Big Ol' Bomb", waitForBombPackets()], { selectedSkills });

  assert.ok(
    big.events.some((event) => event.type === 'damage' && Math.abs(event.at - 3.66) < 1e-12 && event.coefficient === 3)
  );
  assert.ok(
    big.events.some(
      (event) => event.type === 'control' && Math.abs(event.at - 3.66) < 1e-12 && event.controlKind === 'knockdown'
    )
  );
  assert.equal(engineerCatalog.skillsByName.get("Big Ol' Bomb").comboFinishers[0].successfulCombos, 2);
  assert.equal(engineerCatalog.skillsByName.get("Big Ol' Bomb").quicknessCastTimeMs, 600);

  const quickDamageTimes = (name) =>
    simulate('Core', ['Bomb Kit', name, waitForBombPackets()], {
      selectedSkills,
      boons: { quickness: true }
    })
      .events.filter((event) => event.type === 'damage' && event.name === name)
      .map((event) => Number(event.at.toFixed(2)));

  assert.deepEqual(quickDamageTimes('Fire Bomb'), [1.36, 2.36, 3.36, 4.36]);
  assert.deepEqual(quickDamageTimes('Galvanic Bomb'), [1.36]);
  assert.deepEqual(quickDamageTimes('Magnetic Bomb'), [2.36]);
  assert.deepEqual(quickDamageTimes("Big Ol' Bomb"), [3.36]);

  const doubleBlast = simulate(
    'Core',
    [
      'Bomb Kit',
      "Big Ol' Bomb",
      'Fire Bomb',
      'Galvanic Bomb',
      'Stow Bomb Kit',
      'Glue Shot',
      { type: 'wait', durationMs: 5000 }
    ],
    {
      selectedSkills,
      weapons: ['Pistol', 'Pistol'],
      relic: 'Bloodstone'
    }
  );

  assert.ok(
    doubleBlast.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Bloodstone Explosion')
  );
  assert.ok(
    doubleBlast.procSteps.some((step) => step.skill === 'Relic of Bloodstone' && step.sourceSkill === "Big Ol' Bomb")
  );

  const unboundBlasts = simulate(
    'Core',
    ['Bomb Kit', "Big Ol' Bomb", 'Galvanic Bomb', { type: 'wait', durationMs: 5000 }],
    { selectedSkills, relic: 'Bloodstone' }
  );

  assert.equal(
    unboundBlasts.procSteps.some(
      (step) => step.skill === 'Bloodstone Volatility' || step.skill === 'Relic of Bloodstone'
    ),
    false
  );
});

test('Grenade Kit emits three explosive grenade packets', () => {
  const profiles = [
    ['Grenade', 0, 0.33, null],
    ['Shrapnel Grenade', 5, 0.63, 'Bleeding'],
    ['Flash Grenade', 10, 0.1, 'Blind'],
    ['Freeze Grenade', 20, 0.75, 'Chilled'],
    ['Poison Grenade', 20, 0.75, 'Poisoned']
  ];

  for (const [name, cooldown, coefficient, secondary] of profiles) {
    const candidate = engineerCatalog.skillsByName.get(name);
    const strike = candidate.effects.find((effect) => effect.type === 'strike');

    assert.equal(candidate.cooldown, cooldown, name);
    const packetCoefficients = strike.ticks
      ? strike.ticks.map((packet) => packet.coefficient)
      : Array(strike.hits).fill(strike.coefficient / strike.hits);

    assert.equal(packetCoefficients.length, 3, name);
    assert.ok(
      packetCoefficients.every((packetCoefficient) => Math.abs(packetCoefficient - coefficient) < 1e-12),
      name
    );
    assert.equal(strike.metadata.damageKind, 'explosion', name);

    if (secondary === 'Blind') {
      assert.equal(candidate.effects.find((effect) => effect.type === 'blind').metadata.duration, 5);
    } else if (secondary) {
      assert.ok(
        candidate.effects[1].ticks.every((packet) => packet.condition === secondary),
        name
      );
    }
  }

  const committedGrenades = ['Grenade', 'Shrapnel Grenade', 'Freeze Grenade', 'Poison Grenade'];

  for (const name of committedGrenades) {
    const grenadeSkill = engineerCatalog.skillsByName.get(name);

    assert.equal(grenadeSkill.interruptCommitMs, 360, name);
    assert.ok(
      grenadeSkill.effects.every((effect) => effect.persistsAfterInterrupt === true),
      name
    );

    const interruptedPackets = (interruptMs) =>
      simulate('Core', ['Grenade Kit', { name, interruptMs }, { type: 'wait', durationMs: 1000 }]).events.filter(
        (event) => event.type === 'damage' && event.name === name
      );

    assert.equal(interruptedPackets(359).length, 0, name);
    assert.equal(interruptedPackets(360).length, 3, name);
  }

  const shrapnel = engineerCatalog.skillsByName.get('Shrapnel Grenade');

  assert.equal(shrapnel.comboFinishers, undefined);
  for (const name of ['Poison Grenade', 'Freeze Grenade']) {
    assert.equal(engineerCatalog.skillsByName.get(name).comboFinishers, undefined, name);
  }

  assert.equal(
    shrapnel.effects[1].ticks.reduce((total, packet) => total + packet.stacks, 0),
    3
  );
  assert.ok(shrapnel.effects[1].ticks.every((packet) => packet.duration === 7));

  const result = simulate('Core', ['Grenade Kit', 'Shrapnel Grenade']);
  const packets = result.events.filter((event) => event.type === 'damage' && event.name === 'Shrapnel Grenade');

  assert.equal(packets.length, 3);
  assert.ok(packets.every((event) => Math.abs(event.coefficient - 0.63) < 1e-12 && event.damageKind === 'explosion'));
  assert.deepEqual(
    packets.map((event) => event.at),
    [0.4, 0.44, 0.44]
  );
  const bleeding = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Shrapnel Grenade'
  );

  assert.deepEqual(
    bleeding.map((event) => [event.at, event.stacks, event.duration]),
    [
      [0.4, 1, 7],
      [0.44, 1, 7],
      [0.44, 1, 7]
    ]
  );

  const grenade = simulate('Core', ['Grenade Kit', 'Grenade']);

  assert.deepEqual(
    grenade.events
      .filter((event) => event.type === 'damage' && event.name === 'Grenade')
      .map((event) => [event.at, event.coefficient]),
    [
      [0.4, 0.33],
      [0.44, 0.33],
      [0.44, 0.33]
    ]
  );
});

test('Shred fires three Burning Bolts through Stoke the Flames', () => {
  const stoke = engineerCatalog.skillsByName.get('Stoke the Flames');
  const shred = engineerCatalog.skillsById.get(77103);

  assert.equal(stoke.comboFields[0].fieldType, 'Fire');
  assert.equal(stoke.comboFields[0].duration, 1);
  assert.equal(shred.comboFinishers[0].finisherType, 'Projectile');
  assert.equal(shred.comboFinishers[0].chance, 1);

  const config = {
    boons: { quickness: true },
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Rifle Turret', 'Supply Crate'],
    selectedMorphSkillIds: [77103, 77104, 76705]
  };
  const result = simulate(
    'Amalgam',
    ['Flamethrower', 'Stoke the Flames', { name: 'Offensive Protocol: Shred', skillId: 77103 }],
    config
  );
  const combos = result.resolvedEvents.filter(
    (event) =>
      event.type === 'combo' &&
      event.skillName === 'Offensive Protocol: Shred' &&
      event.fieldType === 'Fire' &&
      event.finisherType === 'Projectile'
  );

  assert.equal(combos.length, 3);
  assert.ok(
    combos.every(
      (event) => event.outcome.condition === 'Burning' && event.outcome.stacks === 1 && event.outcome.duration === 1
    )
  );

  const withoutField = simulate('Amalgam', [{ name: 'Offensive Protocol: Shred', skillId: 77103 }], config);

  assert.equal(
    withoutField.resolvedEvents.some(
      (event) => event.type === 'combo' && event.skillName === 'Offensive Protocol: Shred'
    ),
    false
  );
});

test('measured Quickness animations and Flame Blast commitment drive steps', () => {
  const grenades = simulate(
    'Amalgam',
    ['Grenade Kit', { name: 'Shrapnel Grenade', interruptAfterMs: 360 }, 'Freeze Grenade'],
    {
      boons: { quickness: true },
      selectedMorphSkillIds: [77103, 77104, 76705]
    }
  );
  const shrapnel = grenades.steps.find((step) => step.skill === 'Shrapnel Grenade');
  const freeze = grenades.steps.find((step) => step.skill === 'Freeze Grenade');

  // The grenade launches at its commit point, while the next serial action remains locked to the full throw animation.
  assert.equal(shrapnel.end - shrapnel.start, 360);
  assert.equal(freeze.start - shrapnel.start, 680);

  const flamethrower = simulate(
    'Amalgam',
    ['Flamethrower', { name: 'Flame Blast', interruptAfterMs: 480 }, 'Flame Jet'],
    {
      boons: { quickness: true },
      selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Rifle Turret', 'Supply Crate'],
      selectedMorphSkillIds: [77103, 77104, 76705]
    }
  );
  const flameBlast = flamethrower.steps.find((step) => step.skill === 'Flame Blast');
  const flameJet = flamethrower.steps.find((step) => step.skill === 'Flame Jet');
  const flameBlastAction = flamethrower.events.find(
    (event) => event.type === 'action' && event.skillName === 'Flame Blast'
  );
  const flameBlastDamage = flamethrower.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Flame Blast'
  );

  // The packet and recharge commit at 480 ms, but the next serial cast remains locked to the full 800 ms animation.
  assert.equal(flameBlast.end - flameBlast.start, 480);
  assert.equal(flameBlast.fullCastMs, 800);
  assert.equal(flameBlast.interrupted, true);
  assert.equal(flameJet.start - flameBlast.start, 800);
  assert.equal(flameBlastAction.rechargeReadyAt, 6.48);
  assert.equal(flameBlastDamage.at - flameBlast.start / 1000, 0.48);
  assert.equal(
    flamethrower.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Flame Blast').length,
    1
  );

  const full = simulate('Amalgam', ['Flamethrower', 'Flame Blast'], {
    boons: { quickness: true },
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Rifle Turret', 'Supply Crate'],
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const fullFlameBlast = full.steps.find((step) => step.skill === 'Flame Blast');

  assert.equal(fullFlameBlast.end - fullFlameBlast.start, 800);
  assert.equal(fullFlameBlast.interrupted, false);

  const demolish = simulate('Amalgam', [76927], {
    boons: { quickness: true },
    selectedMorphSkillIds: [76927, 77104, 76705]
  });
  const demolishStep = demolish.steps.find((step) => step.skill === 'Offensive Protocol: Demolish');

  assert.equal(demolishStep.end - demolishStep.start, 1000 + 560);
  const smash = demolish.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Smash Damage');

  assert.equal(Math.round((smash.at - demolishStep.start / 1000) * 1000), 1440);
});

test('Flame Jet gains ten percent strike damage against burning targets', () => {
  const config = {
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Rifle Turret', 'Supply Crate'],
    selectedMorphSkillIds: [77103, 77104, 76705]
  };
  const withoutBurning = simulate('Amalgam', ['Flamethrower', 'Flame Jet'], {
    ...config,
    target: { conditions: { Vulnerability: 25 } }
  });
  const withBurning = simulate('Amalgam', ['Flamethrower', 'Flame Jet'], {
    ...config,
    target: { conditions: { Vulnerability: 25, Burning: 1 } }
  });
  const firstPacket = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Flame Jet');

  assert.ok(Math.abs(firstPacket(withBurning).damage / firstPacket(withoutBurning).damage - 1.1) < 1e-12);
});

test('Engineer spear focus selects one branch and Lightning Rod pulses eight times', () => {
  const focused = simulate(
    'Amalgam',
    ['Conduit Surge', 'Lightning Rod', 'Electric Artillery', { type: 'wait', durationMs: 4000 }],
    {
      selectedMorphSkillIds: [77103, 77104, 76705]
    }
  );

  assert.equal(focused.warnings.length, 0);
  const lightning = focused.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Lightning Rod');

  assert.equal(lightning.length, 8);
  assert.ok(lightning.every((event) => event.coefficient === 0.3));
  assert.deepEqual(
    lightning.slice(1).map((event, index) => Number((event.at - lightning[index].at).toFixed(3))),
    Array(7).fill(0.5)
  );
  const rodStep = focused.steps.find((step) => step.skill === 'Lightning Rod');
  const artilleryStep = focused.steps.find((step) => step.skill === 'Electric Artillery');

  assert.equal(artilleryStep.start - rodStep.start, 4200);
  assert.equal(focused.events.find((event) => event.type === 'engineer.electric-artillery').charges, 8);
  const immobilize = focused.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Lightning Rod' && event.condition === 'Immobilized'
  );

  assert.equal(immobilize.length, 1);
  assert.equal(immobilize[0].duration, 2);
  assert.equal(
    focused.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Conduit Surge').length,
    1
  );
  assert.equal(
    focused.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Electric Artillery').length,
    1
  );
  const artilleryBurn = focused.resolvedEvents.find(
    (event) => event.type === 'condition' && event.name === 'Electric Artillery — Burning'
  );

  assert.equal(artilleryBurn.stacks, 2);
  assert.equal(artilleryBurn.duration, 7);

  const unfocused = simulate('Amalgam', ['Lightning Rod', 'Electric Artillery'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const unfocusedHits = unfocused.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Lightning Rod'
  );

  assert.equal(unfocusedHits.length, 8);
  assert.ok(unfocusedHits.every((event) => event.coefficient === 0.17));
  assert.equal(
    unfocused.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Electric Artillery')
      .coefficient,
    1
  );
  assert.equal(
    unfocused.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Electric Artillery' && event.condition === 'Burning'
    ).duration,
    5
  );
  assert.deepEqual(unfocused.endState.profession.lightningRodChargeExpiries, []);
  assert.equal(unfocused.endState.profession.electricArtilleryAvailable, false);
});

test('Electric Artillery is unavailable until Lightning Rod creates its flip', () => {
  const result = simulate('Amalgam', ['Electric Artillery'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });

  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Lightning Rod has not finished charging/);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Electric Artillery'),
    false
  );
});

test('Lightning Rod exposes Electric Artillery after charging', () => {
  const charging = simulate('Amalgam', ['Lightning Rod'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const charged = simulate('Amalgam', ['Lightning Rod', { type: 'wait', durationMs: 4000 }], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const chargingContext = {
    professionState: charging.endState.profession,
    time: charging.duration
  };
  const chargedContext = {
    professionState: charged.endState.profession,
    time: charged.duration
  };
  const rod = engineerCatalog.skillsByName.get('Lightning Rod');
  const artillery = engineerCatalog.skillsByName.get('Electric Artillery');

  assert.equal(engineerProfession.ui.isPaletteSkillAvailable(chargingContext, rod), false);
  assert.equal(engineerProfession.ui.isPaletteSkillAvailable(chargingContext, artillery), false);
  assert.equal(engineerProfession.ui.isPaletteSkillAvailable(chargedContext, artillery), true);
  assert.equal(charging.endState.profession.availableFlips[artillery.id], false);
  assert.equal(charged.endState.profession.availableFlips[artillery.id], true);
});

test('Roiling Skies changes control branch with focus and always cripples', () => {
  const unfocused = simulate('Amalgam', ['Roiling Skies'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const focused = simulate('Amalgam', ['Conduit Surge', 'Roiling Skies'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });

  assert.equal(
    unfocused.events.find((event) => event.type === 'control' && event.skillName === 'Roiling Skies').controlKind,
    'stun'
  );
  assert.equal(
    focused.events.find((event) => event.type === 'control' && event.skillName === 'Roiling Skies').controlKind,
    'launch'
  );
  assert.equal(
    focused.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Roiling Skies' && event.condition === 'Crippled'
    ).duration,
    5
  );
});

test('focused Devastator completes its full cast and triggers six hits', () => {
  const result = simulate('Amalgam', ['Conduit Surge', 'Devastator', { type: 'wait', durationMs: 2000 }], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.steps.find((step) => step.skill === 'Devastator').end -
      result.steps.find((step) => step.skill === 'Devastator').start,
    1000
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Devastator').length,
    1
  );
  const focused = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Focused Devastation'
  );

  assert.equal(focused.length, 6);
  assert.ok(focused.every((event) => event.coefficient === 0.2));
  assert.ok(focused.every((event) => event.skillId === 73064));
  assert.ok(focused.every((event) => event.sourceId === 73064));
  assert.equal(new Set(focused.map((event) => event.activationId)).size, 1);
  assert.notEqual(
    focused[0].activationId,
    result.resolvedEvents.find((event) => event.name === 'Devastator').activationId
  );
  assert.ok(
    focused.every(
      (event) => event.weaponStrengthProfileId === 'nonweapon.unequipped' && event.resolvedWeaponStrength === 690.5
    )
  );
  assert.ok(
    result.resolvedEvents.filter((event) => event.name === 'Devastator').every((event) => event.skillId === 72974)
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.name === 'Focused Devastation — Burning'
    ).length,
    6
  );
  assert.ok(
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.name === 'Focused Devastation — Burning')
      .every((event) => event.skillId === 73064 && event.sourceId === 73064)
  );
  assert.equal(result.breakdown.find((entry) => entry.name === 'Devastator').skillId, 72974);
  assert.equal(result.breakdown.find((entry) => entry.name === 'Focused Devastation').skillId, 73064);

  const stochastic = simulate('Amalgam', ['Conduit Surge', 'Devastator', { type: 'wait', durationMs: 2000 }], {
    selectedMorphSkillIds: [77103, 77104, 76705],
    randomness: { mode: 'stochastic', seed: 73064 }
  });
  const stochasticStrengths = new Set(
    stochastic.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Focused Devastation')
      .map((event) => event.resolvedWeaponStrength)
  );

  assert.equal(stochasticStrengths.size, 1);
  assert.ok([...stochasticStrengths][0] >= 656);
  assert.ok([...stochasticStrengths][0] < 725);
});

test('Amalgam traits activate on morph and Evolve chronology', () => {
  const result = simulate('Amalgam', [77103, 77104, 76705, 'Evolve', 'Grenade Kit', 'Shrapnel Grenade'], {
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Plasmatic State', 'Flux State'],
    selectedMorphSkillIds: [77103, 77104, 76705],
    selectedTraitIds: [TRAIT.WILLING_HOST, TRAIT.HARDENED_CHROME, TRAIT.CARBOLIC_COMPOSITION, TRAIT.NEW_GENES]
  });

  assert.equal(result.warnings.length, 0);
  assert.ok(result.profession.willingHostUntil > 0);
  assert.ok(result.profession.evolvedUntil > 0);
  assert.equal(result.profession.rapaciousUntil, result.profession.evolvedUntil);
  assert.equal(result.profession.predatorUntil, result.profession.evolvedUntil);
  assert.equal(result.profession.titanicUntil, result.profession.evolvedUntil);
  assert.equal(
    result.events.filter(
      (event) => event.type === 'buff' && event.kind === 'alacrity' && event.skillName === 'New Genes'
    ).length,
    3
  );
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Rapacious Strain'));
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'condition' && event.name === 'Carbolic Composition — Poisoned'
    )
  );
});

test('Evolve raises attributes by ten percent for eight seconds', () => {
  const neutralMorphs = [76815, 77285, 77358];
  const config = {
    selectedMorphSkillIds: neutralMorphs,
    stats: {
      power: 2000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 1000
    }
  };
  const baseline = simulate('Amalgam', [{ type: 'wait', durationMs: 750 }, 'Puncturing Jab'], config);
  const evolved = simulate('Amalgam', ['Evolve', 'Puncturing Jab'], config);
  const puncture = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab');

  assert.ok(Math.abs(puncture(evolved).damage / puncture(baseline).damage - 1.1) < 1e-12);
  assert.equal(evolved.endState.profession.evolvedUntil, 8.78);
});

test("Sharpshooter derives bleeding damage from Evolve's Power bonus", () => {
  const config = {
    selectedMorphSkillIds: [76815, 77285, 77358],
    selectedTraitIds: [TRAIT.SHARPSHOOTER, TRAIT.DOUBLE_HELIX],
    stats: {
      power: 2000,
      conditionDamage: 1000,
      expertise: 0
    },
    amalgamEvolveAttributePool: {
      Power: 2000,
      'Condition Damage': 1000
    },
    target: { conditions: {} }
  };
  const result = simulate(
    'Amalgam',
    ['Evolve', 'Grenade Kit', 'Shrapnel Grenade', { type: 'wait', durationMs: 1000 }],
    config
  );
  const bleed = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Shrapnel Grenade' && event.condition === 'Bleeding'
  );

  // Double Helix raises eligible Power from 2000 to 2400; Sharpshooter then
  // replaces bleeding's condition damage with two-thirds of that final Power.
  assert.ok(bleed);
  assert.ok(Math.abs(bleed.damage / bleed.damagingStackSeconds - 118) < 1e-12);
});

test('Evolve cannot raise condition duration above the global cap', () => {
  const result = simulate(
    'Amalgam',
    ['Evolve', 'Grenade Kit', 'Shrapnel Grenade', { type: 'wait', durationMs: 13000 }],
    {
      selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Bomb Kit', 'Flux State'],
      selectedMorphSkillIds: [77103, 77104, 76705],
      selectedTraitIds: [TRAIT.SERRATED_STEEL],
      stats: { expertise: 1500 },
      target: { conditions: {} }
    }
  );
  const directBleeds = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Shrapnel Grenade' && event.condition === 'Bleeding'
  );

  assert.equal(directBleeds.length, 3);
  assert.ok(directBleeds.every((event) => Math.abs(event.effectiveDuration - 14) < 1e-12));
});

test('Evolve grants each selected protocol strain without leaking it to casts', () => {
  const result = simulate('Amalgam', ['Evolve'], {
    selectedMorphSkillIds: [77103, 77203, 76954]
  });
  const berserker = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Berserker Strain' && event.kind === 'stability'
  );

  assert.equal(berserker.stacks, 5);
  assert.equal(berserker.duration, 8);
  assert.equal(result.endState.profession.berserkerUntil, result.endState.profession.evolvedUntil);

  const demolish = simulate('Amalgam', [76954], {
    selectedMorphSkillIds: [77103, 77203, 76954]
  });

  assert.equal(
    demolish.events.some((event) => event.type === 'buff' && event.kind === 'stability'),
    false
  );
});

test('Hardened Chrome and New Genes grant the requested morph boons', () => {
  const protocols = [
    [76959, 'protection', 4, 1],
    [76798, 'aegis', 4, 1],
    [77163, 'stability', 4, 2],
    [76815, 'vigor', 4, 1],
    [76806, 'might', 12, 5],
    [77103, 'fury', 6, 1],
    [76927, 'swiftness', 6, 1]
  ];
  const defaults = new Map([
    [2, 77103],
    [3, 77203],
    [4, 76954]
  ]);

  for (const [skillId, kind, duration, stacks] of protocols) {
    const skill = engineerCatalog.skillsById.get(skillId);
    const selected = new Map(defaults);

    selected.set(Number(skill.mechanicSlot), skillId);
    const result = simulate('Amalgam', [skillId], {
      selectedMorphSkillIds: [...selected.values()],
      selectedTraitIds: [TRAIT.HARDENED_CHROME, TRAIT.NEW_GENES]
    });
    const hardened = result.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.HARDENED_CHROME);

    assert.equal(hardened.kind, 'protection');
    assert.equal(hardened.duration, 2.5);

    const newGenes = result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.NEW_GENES);

    assert.ok(newGenes.some((event) => event.kind === 'alacrity' && event.duration === 5 && event.stacks === 1));
    assert.ok(newGenes.some((event) => event.kind === 'might' && event.duration === 12 && event.stacks === 4));
    assert.ok(newGenes.some((event) => event.kind === kind && event.duration === duration && event.stacks === stacks));
  }

  const evolve = simulate('Amalgam', ['Evolve'], {
    selectedTraitIds: [TRAIT.HARDENED_CHROME]
  });
  const protection = evolve.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.HARDENED_CHROME);

  assert.equal(protection.duration, 4);
});

test('Carbolic Composition poisons only Amalgam skill hits', () => {
  const result = simulate('Amalgam', [77103, 'Puncturing Jab'], {
    selectedMorphSkillIds: [77103, 77203, 76954],
    selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION],
    target: { conditions: {} }
  });
  const poison = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Carbolic Composition'
  );

  assert.equal(poison.length, 3);
  assert.ok(
    poison.every(
      (event) =>
        event.triggeredBy === 'Offensive Protocol: Shred' && Math.abs(event.naturalExpiresAt - event.at - 3.99) < 1e-12
    )
  );
  assert.equal(
    poison.some((event) => event.triggeredBy === 'Puncturing Jab'),
    false
  );

  const strain = simulate('Amalgam', ['Evolve', 'Puncturing Jab'], {
    selectedMorphSkillIds: [77103, 77104, 76705],
    selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION],
    stats: { precision: 4000, ferocity: 0 },
    target: { conditions: {} }
  });
  const rapacious = strain.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Rapacious Strain');

  assert.equal(rapacious.criticalChance, 1);
  assert.deepEqual(
    {
      actorType: rapacious.actorType,
      ownerActorType: rapacious.ownerActorType
    },
    { actorType: 'effect', ownerActorType: 'player' }
  );
  assert.ok(
    strain.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Carbolic Composition' &&
        event.triggeredBy === 'Rapacious Strain'
    )
  );

  const inherited = simulate('Amalgam', ['Flux State', { type: 'wait', durationMs: 7000 }], {
    selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION, TRAIT.EXPLOSIVE_ENTRANCE],
    target: { conditions: {} }
  });

  assert.equal(
    inherited.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Carbolic Composition' &&
        event.triggeredBy === 'Explosive Entrance'
    ),
    false
  );
});

test('Silver Lining moves strain activation from Evolve to each morph', () => {
  const selectedMorphSkillIds = [76959, 76866, 76954];
  const baseMorph = simulate('Amalgam', [76959], {
    selectedMorphSkillIds
  });

  assert.equal(
    baseMorph.events.some((event) => event.type === 'buff' && event.skillName === 'Resiliant Strain'),
    false
  );

  const baseEvolve = simulate('Amalgam', ['Evolve'], {
    selectedMorphSkillIds
  });

  assert.ok(
    baseEvolve.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Resiliant Strain' &&
        event.kind === 'resistance' &&
        event.duration === 8
    )
  );

  const silverMorph = simulate('Amalgam', [76959], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING]
  });

  assert.ok(
    silverMorph.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Resiliant Strain' &&
        event.kind === 'resistance' &&
        event.duration === 8
    )
  );

  const silverEvolve = simulate('Amalgam', ['Evolve'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING]
  });

  assert.equal(
    silverEvolve.events.some(
      (event) =>
        event.type === 'buff' && ['Resiliant Strain', 'Predator Strain', 'Berserker Strain'].includes(event.skillName)
    ),
    false
  );
});

test('Mercurial Tendencies reduces Evolve once per quarter-second', () => {
  const selectedMorphSkillIds = [76815, 76866, 76954];
  const baseline = simulate('Amalgam', ['Evolve', 76815, 'Evolve'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING]
  });
  const reduced = simulate('Amalgam', ['Evolve', 76815, 'Evolve'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING, TRAIT.MERCURIAL_TENDENCIES]
  });
  const evolveStart = (result) => result.steps.filter((step) => step.skill === 'Evolve')[1].start;

  assert.equal(evolveStart(baseline) - evolveStart(reduced), 2500);
  const procs = reduced.events.filter((event) => event.type === 'proc' && event.name === 'Mercurial Tendencies');

  assert.equal(procs.length, 1);
  assert.equal(procs[0].cooldownReduction, 2.5);
});

test('Willing Host and Symbiotic Synergy apply their damage windows', () => {
  const selectedMorphSkillIds = [76815, 76866, 76954];
  const baselineMorph = simulate('Amalgam', [76815], {
    selectedMorphSkillIds,
    target: { conditions: {} }
  });
  const symbioticMorph = simulate('Amalgam', [76815], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SYMBIOTIC_SYNERGY],
    target: { conditions: {} }
  });
  const pierceDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Offensive Protocol: Pierce')
      .damage;

  assert.ok(Math.abs(pierceDamage(symbioticMorph) / pierceDamage(baselineMorph) - 1.33) < 1e-12);

  const baselineFollowup = simulate('Amalgam', [76815, 'Puncturing Jab'], {
    selectedMorphSkillIds,
    target: { conditions: {} }
  });
  const willingFollowup = simulate('Amalgam', [76815, 'Puncturing Jab'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.WILLING_HOST],
    target: { conditions: {} }
  });
  const punctureDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab').damage;

  assert.ok(Math.abs(punctureDamage(willingFollowup) / punctureDamage(baselineFollowup) - 1.05) < 1e-12);

  const reset = simulate('Amalgam', [76815, 'Evolve', 76815], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SYMBIOTIC_SYNERGY]
  });
  const morphSteps = reset.steps.filter((step) => step.skill === 'Offensive Protocol: Pierce');
  const evolveStep = reset.steps.find((step) => step.skill === 'Evolve');

  assert.equal(morphSteps[1].start, evolveStep.end);
});

test('Double Helix gives Evolve two charges and doubles its attribute bonus', () => {
  const config = {
    selectedMorphSkillIds: [76815, 77285, 77358],
    selectedTraitIds: [TRAIT.DOUBLE_HELIX],
    stats: {
      power: 2000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 1000
    },
    target: { conditions: {} }
  };
  const charges = simulate('Amalgam', ['Evolve', 'Evolve'], config);
  const evolveSteps = charges.steps.filter((step) => step.skill === 'Evolve');

  assert.equal(evolveSteps.length, 2);
  assert.equal(evolveSteps[1].start, evolveSteps[0].end);

  const baseline = simulate('Amalgam', [{ type: 'wait', durationMs: 750 }, 'Puncturing Jab'], config);
  const evolved = simulate('Amalgam', ['Evolve', 'Puncturing Jab'], config);
  const puncture = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab');

  assert.ok(Math.abs(puncture(evolved).damage / puncture(baseline).damage - 1.2) < 1e-12);
});

test('Evolve scales only its eligible static attribute pool', () => {
  const pool = {
    Power: 1000,
    Precision: 1000,
    Toughness: 1000,
    Vitality: 1000,
    Ferocity: 1000,
    'Condition Damage': 1000,
    Expertise: 1000,
    Concentration: 1000,
    'Healing Power': 1000
  };
  const attributes = [
    'power',
    'precision',
    'toughness',
    'vitality',
    'ferocity',
    'conditionDamage',
    'expertise',
    'concentration',
    'healingPower'
  ];
  const resolved = Object.fromEntries(attributes.map((attribute) => [attribute, 1500]));
  const context = (traits) => ({
    traits: new Set(traits),
    config: { amalgamEvolveAttributePool: pool },
    runtime: {
      profession: {
        specialization: {
          kind: 'Amalgam',
          state: { evolvedUntil: 10 }
        }
      }
    },
    time: 1
  });

  assert.deepEqual(
    amalgamAttributeRules.modifyAttributes(context([]), resolved),
    Object.fromEntries(attributes.map((attribute) => [attribute, 1600]))
  );
  assert.deepEqual(
    amalgamAttributeRules.modifyAttributes(context([TRAIT.DOUBLE_HELIX]), resolved),
    Object.fromEntries(attributes.map((attribute) => [attribute, 1700]))
  );
});

test('Amalgam app config excludes temporary attributes from Evolve', () => {
  const canonical = createEngineerBuildDefaults();

  canonical.specializations = [
    { name: 'Explosives', traits: '3-2-3' },
    { name: 'Firearms', traits: '3-3-2' },
    { name: 'Amalgam', traits: '2-2-3' }
  ];
  const app = {
    build: toApplicationBuild(canonical),
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  engineerAppAdapter.recalculate(app);
  const config = engineerAppAdapter.simulationConfig(app);

  assert.deepEqual(config.amalgamEvolveAttributePool, app.attributeData.amalgamEvolveAttributePool);
  assert.equal(config.stats.ferocity - config.amalgamEvolveAttributePool.Ferocity, 150);
});

test('Thorns damaging-field assumption creates six one-second retaliations', () => {
  const selectedMorphSkillIds = [77103, 77104, 76705];
  const inactive = simulate('Amalgam', [77104], {
    selectedMorphSkillIds
  });

  assert.equal(
    inactive.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Thorns Retaliation'),
    false
  );

  const active = simulate(
    'Amalgam',
    ['Evolve', 77104],
    {
      selectedMorphSkillIds,
      professionAssumptions: { inDamagingField: true }
    },
    observationTail(6000)
  );
  const retaliation = active.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Thorns Retaliation'
  );

  assert.equal(retaliation.length, 6);
  assert.ok(retaliation.every((event) => event.coefficient === 0.5));
  assert.deepEqual(
    retaliation.slice(1).map((event, index) => Number((event.at - retaliation[index].at).toFixed(3))),
    Array(5).fill(1)
  );
  assert.equal(
    active.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Rapacious Strain').length,
    6
  );
  assert.equal(
    active.endState.profession.thornsUntil,
    active.steps.find((step) => step.skill === 'Defensive Protocol: Thorns').end / 1000 + 6
  );
});

test('Rapacious Strain follows Flux State packets beyond its half-second ICD', () => {
  const result = simulate('Amalgam', ['Evolve', 'Flux State', { type: 'wait', durationMs: 7000 }], {
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Bomb Kit', 'Flux State'],
    selectedMorphSkillIds: [77103, 77104, 76705],
    target: { conditions: {} }
  });
  const rapacious = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Rapacious Strain'
  );

  // Flux State's initial packet plus twelve 520 ms field packets each clear
  // Rapacious Strain's strict 500 ms ICD while both strain states are active.
  assert.equal(rapacious.length, 13);
  assert.deepEqual(
    rapacious.slice(1).map((event, index) => Number((event.at - rapacious[index].at).toFixed(3))),
    Array(12).fill(0.52)
  );
});

test('Plasmatic State models both phases as one cast', () => {
  const result = simulate('Amalgam', ['Plasmatic State', 'Puncturing Jab'], {
    boons: { quickness: true },
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Plasmatic State', 'Flux State'],
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const step = result.steps.find((step) => step.skill === 'Plasmatic State');
  const following = result.steps.find((step) => step.skill === 'Puncturing Jab');

  assert.equal(step.end - step.start, 960);
  assert.equal(following.start - step.start, 960);
  const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Plasmatic State');

  assert.equal(Math.round((action.rechargeReadyAt - action.at) * 1000), 25_480);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Plasmatic State').length,
    2
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Plasmatic State')
      .map((event) => Math.round((event.at - step.start / 1000) * 1000)),
    [427, 787]
  );
  const firstPacket = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Plasmatic State'
  );

  assert.ok(Math.abs(result.endState.profession.plasmaticStateUntil - firstPacket.at - 6) < 1e-12);
});

test('Explosives and Firearms traits materialize offensive effects', () => {
  const result = simulate('Amalgam', ['Grenade Kit', 'Shrapnel Grenade'], {
    selectedMorphSkillIds: [77103, 77104, 76705],
    stats: {
      precision: 2500,
      expertise: 0
    },
    boons: { fury: true },
    selectedTraitIds: [
      TRAIT.EXPLOSIVE_ENTRANCE,
      TRAIT.STEEL_PACKED_POWDER,
      TRAIT.AIM_ASSISTED_ROCKET,
      TRAIT.SHRAPNEL,
      TRAIT.SERRATED_STEEL,
      TRAIT.HEMATIC_FOCUS,
      TRAIT.CHEMICAL_ROUNDS,
      TRAIT.THERMAL_VISION,
      TRAIT.MODIFIED_AMMUNITION,
      TRAIT.INCENDIARY_POWDER
    ]
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Explosive Entrance').length,
    1
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket').length,
    1
  );
  assert.ok(result.resolvedEvents.some((event) => event.type === 'condition' && event.name === 'Shrapnel — Bleeding'));
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'condition' && event.name === 'Incendiary Powder — Burning')
  );
  assert.ok(result.profession.traitProcReadyAt.thermalVisionUntil > 0);
});

test('Explosives traits use the requested packets, gates, and health modifiers', () => {
  const grenadier = simulate('Core', ['Healing Turret'], {
    selectedTraitIds: [TRAIT.GRENADIER]
  });
  const lesserBarrage = grenadier.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Lesser Grenade Barrage'
  );

  assert.equal(lesserBarrage.length, 6);
  assert.ok(
    lesserBarrage.every((event) => event.coefficient === 0.5 && event.totalHits === 6 && event.explosion === true)
  );

  const entrance = simulate('Core', ['Grenade Kit', 'Grenade', 'Dodge', 'Grenade'], {
    selectedTraitIds: [TRAIT.EXPLOSIVE_ENTRANCE, TRAIT.GRAND_ENTRANCE]
  });

  assert.equal(
    entrance.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Explosive Entrance').length,
    2
  );
  assert.ok(entrance.procSteps.some((step) => step.skill === 'Grand Entrance'));

  const explosionTraits = simulate(
    'Core',
    ['Grenade Kit', 'Grenade', 'Shrapnel Grenade', { type: 'wait', durationMs: 100 }],
    {
      selectedTraitIds: [TRAIT.SHORT_FUSE, TRAIT.STEEL_PACKED_POWDER, TRAIT.EXPLOSIVE_TEMPER, TRAIT.SHRAPNEL],
      stats: { precision: 1000, ferocity: 0 },
      target: { conditions: {} }
    }
  );

  assert.equal(explosionTraits.procSteps.filter((step) => step.skill === 'Short Fuse').length, 1);
  assert.ok(explosionTraits.procSteps.filter((step) => step.skill === 'Explosive Temper').length >= 3);
  assert.ok(
    explosionTraits.resolvedEvents.some(
      (event) => event.type === 'condition' && event.condition === 'Bleeding' && event.skillName === 'Shrapnel'
    )
  );
  const grenadePackets = explosionTraits.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Grenade'
  );

  assert.equal(grenadePackets[0].criticalDamage, 1.5);
  assert.equal(grenadePackets[1].criticalDamage, 1.5 + 20 / 1500);

  const noModifiers = simulate('Core', ['Puncturing Jab'], {
    stats: { precision: 1000, ferocity: 0 },
    playerHealthFraction: 0.8,
    targetHealthFraction: 0.5,
    target: { conditions: { Vulnerability: 10 } }
  });
  const modifiers = simulate('Core', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.GLASS_CANNON, TRAIT.SHAPED_CHARGE, TRAIT.BIG_BOOMER],
    stats: { precision: 1000, ferocity: 0 },
    playerHealthFraction: 0.8,
    targetHealthFraction: 0.5,
    target: { conditions: { Vulnerability: 10 } }
  });
  const firstStrike = (result) => result.resolvedEvents.find((event) => event.type === 'damage');

  assert.ok(Math.abs(firstStrike(modifiers).damage / firstStrike(noModifiers).damage - 1.07 * 1.05 * 1.15) < 1e-12);
});

test('Aim-Assisted Rocket calls an orbital strike after four rockets', () => {
  const result = simulate(
    'Core',
    [
      'Grenade Kit',
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 3000 }
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      target: { conditions: {} }
    }
  );
  const rockets = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'
  );
  const orbital = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Orbital Command Strike'
  );

  assert.equal(rockets.length, 4);
  assert.equal(result.procSteps.filter((step) => step.skill === 'Aim-Assisted Rocket').length, 4);
  assert.equal(result.procSteps.filter((step) => step.skill === 'Orbital Command Strike').length, 1);
  assert.ok(
    rockets.every(
      (event) =>
        event.coefficient === 1 &&
        event.explosion === true &&
        event.actorType === 'effect' &&
        event.sourceId === ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL &&
        event.weaponStrengthProfileId === 'nonweapon.unequipped' &&
        event.resolvedWeaponStrength === 690.5
    )
  );
  assert.equal(orbital.coefficient, 1.92);
  assert.equal(orbital.comboFinishers[0].ownerId, 'engineer');
  assert.equal(orbital.comboFinishers[0].finisherType, 'Blast');
  assert.equal(orbital.comboFinishers[0].chance, 1);
  assert.equal(orbital.explosion, false);
  assert.equal(orbital.actorType, 'effect');
  assert.equal(orbital.sourceId, ID.ORBITAL_COMMAND_STRIKE);
  assert.equal(orbital.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(orbital.resolvedWeaponStrength, 690.5);

  const rifleProjectiles = simulate(
    'Core',
    ['Overcharged Shot', { type: 'wait', durationMs: 2440 }, 'Rifle Burst', { type: 'wait', durationMs: 4000 }],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      target: { conditions: {} }
    }
  );
  const overcharged = rifleProjectiles.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Overcharged Shot'
  );
  const rifleGrenade = rifleProjectiles.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Rifle Burst Grenade'
  );
  const rifleRockets = rifleProjectiles.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'
  );

  assert.equal(rifleRockets.length, 2);
  assert.ok(Math.abs(rifleRockets[0].at - overcharged.at - 0.04) < 1e-12);
  assert.ok(Math.abs(rifleRockets[1].at - rifleGrenade.at - 0.04) < 1e-12);

  for (const command of ['Spark Revolver', 'Core Reactor Shot', 'Jade Mortar']) {
    const mechProjectile = simulate('Mechanist', [command, { type: 'wait', durationMs: 4000 }], {
      selectedTraitIds: [
        TRAIT.AIM_ASSISTED_ROCKET,
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_JADE_DYNAMO
      ],
      target: { conditions: {} }
    });
    const rocket = mechProjectile.resolvedEvents.find(
      (event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'
    );

    assert.equal(rocket, undefined, `${command} must not trigger the player-owned trait proc`);
  }

  const fielded = simulate(
    'Core',
    [
      'Grenade Kit',
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Bomb Kit',
      'Fire Bomb',
      'Grenade Kit',
      'Grenade',
      { type: 'wait', durationMs: 4000 }
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      selectedSkills: ['Healing Turret', 'Bomb Kit', 'Grenade Kit', 'Rifle Turret', 'Supply Crate'],
      relic: 'Bloodstone',
      target: { conditions: {} }
    }
  );

  assert.ok(
    fielded.procSteps.some(
      (step) => step.skill === 'Bloodstone Volatility' && step.sourceSkill === 'Orbital Command Strike'
    )
  );
});

test('Firearms traits apply critical tiers, durations, procs, and Power bleeding', () => {
  const heavy = [0.8, 0.7, 0.4, 0.2].map((targetHealthFraction) => {
    const result = simulate('Core', ['Puncturing Jab'], {
      selectedTraitIds: [TRAIT.HIGH_CALIBER, TRAIT.HEAVY_METAL],
      stats: { precision: 1000, ferocity: 0 },
      targetHealthFraction,
      target: { conditions: {} }
    });
    const hit = result.resolvedEvents.find((event) => event.type === 'damage');

    return [hit.criticalChance, hit.criticalDamage];
  });

  assert.deepEqual(heavy, [
    [0.2, 1.5],
    [0.25, 1.5750000000000002],
    [0.30000000000000004, 1.6500000000000001],
    [0.35, 1.7249999999999999]
  ]);

  const bleed = (selectedTraitIds) =>
    simulate('Core', ['Puncturing Jab', { type: 'wait', durationMs: 2000 }], {
      selectedTraitIds,
      stats: {
        power: 2000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 1000,
        expertise: 0
      },
      target: { conditions: {} }
    }).resolvedEvents.find(
      (event) => event.type === 'condition' && event.condition === 'Bleeding' && event.skillName === 'Puncturing Jab'
    );
  const baseBleed = bleed([]);
  const serratedBleed = bleed([TRAIT.SERRATED_STEEL]);
  const powerBleed = bleed([TRAIT.SHARPSHOOTER]);

  assert.ok(
    Math.abs((serratedBleed.naturalExpiresAt - serratedBleed.at) / (baseBleed.naturalExpiresAt - baseBleed.at) - 1.33) <
      1e-12
  );
  assert.equal(baseBleed.damageTicks[0].damage, 82);
  assert.ok(Math.abs(powerBleed.damageTicks[0].damage - 102) < 1e-12);

  const noScope = simulate('Core', ['Grenade Kit', 'Grenade', { type: 'wait', durationMs: 100 }], {
    selectedTraitIds: [TRAIT.NO_SCOPE],
    stats: { precision: 4000, ferocity: 0 },
    target: { conditions: {} }
  });
  const noScopeHits = noScope.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Grenade');

  assert.equal(noScope.procSteps.filter((step) => step.skill === 'No Scope').length, 1);
  assert.equal(noScopeHits[0].criticalDamage, 1.5);
  assert.equal(noScopeHits[1].criticalDamage, 1.6);

  const bloodTraits = simulate('Core', ['Grenade Kit', 'Shrapnel Grenade', { type: 'wait', durationMs: 100 }], {
    selectedTraitIds: [TRAIT.SANGUINE_ARRAY, TRAIT.HEMATIC_FOCUS]
  });

  assert.ok(bloodTraits.procSteps.some((step) => step.skill === 'Sanguine Array'));
  assert.equal(bloodTraits.procSteps.filter((step) => step.skill === 'Hematic Focus').length, 1);

  const pistolBurn = (selectedTraitIds) =>
    simulate('Core', ['Blowtorch', { type: 'wait', durationMs: 1500 }], {
      selectedTraitIds,
      stats: {
        precision: 1000,
        conditionDamage: 1000,
        expertise: 0
      },
      target: { conditions: {} }
    }).resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Burning');
  const baseBurn = pistolBurn([]);
  const chemicalBurn = pistolBurn([TRAIT.CHEMICAL_ROUNDS]);
  const thermalBurn = pistolBurn([TRAIT.THERMAL_VISION]);

  assert.ok(
    Math.abs((chemicalBurn.naturalExpiresAt - chemicalBurn.at) / (baseBurn.naturalExpiresAt - baseBurn.at) - 4 / 3) <
      1e-12
  );
  assert.ok(Math.abs(thermalBurn.damageTicks[0].damage / baseBurn.damageTicks[0].damage - 1.05) < 1e-12);

  const ammunitionBase = simulate('Core', ['Puncturing Jab'], {
    target: {
      conditions: { Bleeding: 1, Burning: 1, Poisoned: 1 }
    }
  });
  const ammunition = simulate('Core', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.MODIFIED_AMMUNITION],
    target: {
      conditions: { Bleeding: 1, Burning: 1, Poisoned: 1 }
    }
  });

  assert.ok(
    Math.abs(
      ammunition.resolvedEvents.find((event) => event.type === 'damage').damage /
        ammunitionBase.resolvedEvents.find((event) => event.type === 'damage').damage -
        1.03
    ) < 1e-12
  );
});

test('Chemical Rounds extends every pistol condition beyond the condition-duration cap', () => {
  // At +100% condition duration, each pistol condition must still gain the trait's separate 4/3 base multiplier.
  const conditionDuration = (skillName, condition, selectedTraitIds) => {
    const result = simulate('Core', [skillName], {
      selectedTraitIds,
      stats: { expertise: 1500 },
      target: { conditions: {} }
    });
    const application = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === skillName && event.condition === condition
    );

    return application.naturalExpiresAt - application.at;
  };

  const pistolConditions = [
    ['Fragmentation Shot', 'Bleeding'],
    ['Poison Dart Volley', 'Poisoned'],
    ['Static Shot', 'Confusion'],
    ['Glue Shot', 'Crippled'],
    ['Glue Shot', 'Immobilized'],
    ['Blowtorch', 'Burning']
  ];

  for (const [skillName, condition] of pistolConditions) {
    const base = conditionDuration(skillName, condition, []);
    const chemical = conditionDuration(skillName, condition, [TRAIT.CHEMICAL_ROUNDS]);

    assert.ok(Math.abs(chemical / base - 4 / 3) < 1e-12, `${skillName} — ${condition}`);
  }
});

test('Incendiary Powder tracks player and mech cooldowns independently', () => {
  const result = simulate('Mechanist', ['Grenade Kit', 'Grenade', { type: 'wait', durationMs: 2500 }], {
    selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Overclock Signet'],
    selectedTraitIds: [
      TRAIT.INCENDIARY_POWDER,
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ],
    stats: { precision: 4000, expertise: 0 },
    target: { conditions: {} }
  });
  const burning = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.condition === 'Burning' && event.skillName === 'Incendiary Powder'
  );

  assert.deepEqual(
    burning.map((event) => event.actorType),
    ['effect', 'summon']
  );
  assert.ok(burning.every((event) => Math.abs(event.naturalExpiresAt - event.at - 10.64) < 1e-12));

  const turret = simulate('Core', ['Rifle Turret', { type: 'wait', durationMs: 3000 }], {
    selectedTraitIds: [TRAIT.INCENDIARY_POWDER],
    stats: { precision: 4000, expertise: 0 },
    target: { conditions: {} }
  });

  assert.equal(
    turret.resolvedEvents.some((event) => event.type === 'condition' && event.skillName === 'Incendiary Powder'),
    false
  );
});

test('Tools traits materialize tool-belt, dodge, kit, and battery behavior', () => {
  const amalgamReplacementToolbeltSkills = Object.values(AMALGAM_SKILL_MECHANICS).filter(
    (mechanics) => Number(mechanics.mechanicSlot) >= 2 && Number(mechanics.mechanicSlot) <= 5
  );

  assert.ok(amalgamReplacementToolbeltSkills.length > 0);
  assert.ok(amalgamReplacementToolbeltSkills.every((mechanics) => mechanics.countsAsToolbeltSkill === true));

  const quickDodge = simulate('Core', ['Dodge'], { boons: { quickness: true } });

  assert.equal(quickDodge.steps[0].end - quickDodge.steps[0].start, 800);

  const toolbelt = simulate(
    'Core',
    ['Regenerating Mist', 'Grenade Barrage', 'Mine Field', 'Surprise Shot (engineer skill)', 'Med Pack Drop'],
    {
      selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION, TRAIT.STATIC_DISCHARGE, TRAIT.KINETIC_BATTERY],
      stats: { precision: 4000, ferocity: 0 },
      target: { conditions: {} }
    }
  );

  assert.equal(toolbelt.events.filter((event) => event.type === 'buff' && event.kind === 'vigor').length, 6);
  assert.equal(
    toolbelt.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Static Discharge').length,
    6
  );
  const dischargeProcs = toolbelt.procSteps.filter((step) => step.skill === 'Static Discharge');

  assert.equal(dischargeProcs.length, 6);
  assert.equal(dischargeProcs[0].sourceSkill, 'Regenerating Mist');
  const discharge = toolbelt.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Static Discharge'
  );
  const dischargeSkill = engineerCatalog.skillsById.get(ID.STATIC_DISCHARGE_TRAIT_SKILL);
  const dischargeRow = skillBreakdownRows(toolbelt).find((row) => row.name === 'Static Discharge');

  assert.equal(discharge.coefficient, 0.33);
  assert.equal(discharge.skillId, ID.STATIC_DISCHARGE_TRAIT_SKILL);
  assert.equal(discharge.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(discharge.resolvedWeaponStrength, 690.5);
  assert.equal(discharge.weaponStrengthSampled, false);
  assert.equal(discharge.criticalDamage, 3);
  assert.equal(
    dischargeSkill.icon,
    'https://render.guildwars2.com/file/01D310FE65DBA378CBAFD13B2BFEDE59939C5153/102964.png'
  );
  assert.equal(dischargeRow.icon, dischargeSkill.icon);
  assert.ok(dischargeProcs.every((proc) => proc.icon === dischargeSkill.icon));
  assert.ok(
    toolbelt.events.some((event) => event.type === 'buff' && event.kind === 'kinetic-battery' && event.duration === 5)
  );
  assert.ok(
    toolbelt.events.some((event) => event.type === 'buff' && event.kind === 'quickness' && event.duration === 5)
  );
  assert.equal(toolbelt.endState.profession.kineticCharges, 1);

  const wrench = simulate('Core', ['Supply Crate', 'Dodge'], {
    selectedTraitIds: [TRAIT.POWER_WRENCH]
  });

  assert.equal(wrench.endState.cooldowns['Supply Crate'].readyAt, 73000);

  const adrenal = simulate('Core', ['Grenade Barrage', 'Dodge', { type: 'wait', durationMs: 1000 }], {
    selectedTraitIds: [TRAIT.MECHANIZED_DEPLOYMENT, TRAIT.ADRENAL_IMPLANT],
    boons: { vigor: true }
  });

  assert.equal(adrenal.endState.cooldowns['Grenade Barrage'].readyAt, 21270);
  assert.equal(adrenal.endState.profession.endurance, 65.75);

  const streamlined = simulate('Core', ['Grenade Kit'], {
    selectedTraitIds: [TRAIT.STREAMLINED_KITS]
  });
  const mine = streamlined.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Drop Mine');

  assert.equal(mine.coefficient, 1.75);
  assert.equal(mine.explosion, true);
  assert.ok(
    streamlined.events.some((event) => event.type === 'buff' && event.kind === 'swiftness' && event.duration === 20)
  );

  const scrapperToolbelt = simulate('Scrapper', ['Function Gyro'], {
    selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION]
  });
  const forgeMechanic = simulate('Holosmith', ['Engage Photon Forge'], {
    selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION]
  });

  assert.equal(engineerCatalog.skillsById.get(ID.FUNCTION_GYRO).countsAsToolbeltSkill, true);
  assert.equal(engineerCatalog.skillsById.get(ID.ENGAGE_PHOTON_FORGE).countsAsToolbeltSkill, false);
  assert.equal(
    scrapperToolbelt.events.some((event) => event.type === 'buff' && event.kind === 'vigor'),
    true
  );
  assert.equal(
    forgeMechanic.events.some((event) => event.type === 'buff' && event.kind === 'vigor'),
    false
  );

  const amalgamToolbelt = simulate('Amalgam', [77163, 'Evolve', 'Dodge'], {
    selectedMorphSkillIds: [77163, 76901, 76568],
    selectedTraitIds: [TRAIT.MECHANIZED_DEPLOYMENT, TRAIT.OPTIMIZED_ACTIVATION, TRAIT.ADRENAL_IMPLANT]
  });

  // Amalgam F2-F5 mechanics replace tool-belt slots and retain every Tools interaction attached to those slots.
  assert.equal(amalgamToolbelt.endState.cooldowns['Defensive Protocol: Thorns'].readyAt, 16000);
  assert.equal(
    amalgamToolbelt.events.filter(
      (event) => event.type === 'buff' && event.kind === 'vigor' && event.sourceId === TRAIT.OPTIMIZED_ACTIVATION
    ).length,
    2
  );
});

test('Scrapper traits apply gyro control, superspeed, boons, and charges', () => {
  const result = simulate(
    'Scrapper',
    ['Med Kit', 'Bandage Self', 'Function Gyro', 'Function Gyro', { type: 'wait', durationMs: 2100 }],
    {
      selectedSkills: ['Med Kit', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Supply Crate'],
      selectedTraitIds: [
        TRAIT.SPEED_OF_SYNERGY,
        TRAIT.GYROSCOPIC_ACCELERATION,
        TRAIT.SYSTEM_SHOCKER,
        TRAIT.MASS_MOMENTUM,
        TRAIT.OBJECT_IN_MOTION,
        TRAIT.EX_MACHINA,
        TRAIT.APPLIED_FORCE
      ],
      boons: { might: 10 }
    }
  );

  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.events.filter((event) => event.type === 'buff' && event.name === 'Speed of Synergy — superspeed').length,
    1
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.name === 'Speed of Synergy — superspeed' && event.duration === 10
    )
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.name === 'Gyroscopic Acceleration — superspeed' && event.duration === 5
    )
  );
  assert.equal(result.events.filter((event) => event.type === 'control' && event.controlKind === 'daze').length, 2);
  assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'stability' && event.duration === 3));
  assert.ok(result.procSteps.filter((step) => step.skill === 'Mass Momentum').length >= 3);
  assert.ok(result.procSteps.some((step) => step.skill === 'Applied Force'));
  assert.equal(result.endState.ammo['Function Gyro'].maximum, 2);

  const reconstructionField = simulate('Scrapper', ['Reconstruction Field'], {
    selectedSkills: ['Medic Gyro', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Supply Crate'],
    selectedTraitIds: [TRAIT.SPEED_OF_SYNERGY]
  });

  // Current F1 evidence retains seven seconds of Speed of Synergy superspeed after Reconstruction Field completes.
  assert.ok(
    reconstructionField.events.some((event) => event.name === 'Speed of Synergy — superspeed' && event.duration === 7)
  );

  const base = simulate('Scrapper', ['Puncturing Jab'], {
    target: { conditions: {} }
  });
  const moving = simulate('Scrapper', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.OBJECT_IN_MOTION],
    boons: {
      stability: true,
      swiftness: true,
      superspeed: true
    },
    target: { conditions: {} }
  });

  assert.ok(
    Math.abs(
      moving.resolvedEvents.find((event) => event.type === 'damage').damage /
        base.resolvedEvents.find((event) => event.type === 'damage').damage -
        1.05 ** 3
    ) < 1e-12
  );

  const appliedForce = simulate('Scrapper', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.APPLIED_FORCE],
    boons: { might: 25 },
    stats: { power: 2000 },
    target: { conditions: {} }
  });
  const withoutAppliedForce = simulate('Scrapper', ['Puncturing Jab'], {
    boons: { might: 25 },
    stats: { power: 2000 },
    target: { conditions: {} }
  });

  assert.ok(
    Math.abs(
      appliedForce.resolvedEvents.find((event) => event.type === 'damage').damage /
        withoutAppliedForce.resolvedEvents.find((event) => event.type === 'damage').damage -
        3500 / 2750
    ) < 1e-12
  );
});

test('Kinetic Accelerators emits party quickness and might from successful combos', () => {
  const config = {
    selectedSkills: ['Medic Gyro', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Supply Crate'],
    selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
    boons: { quickness: false },
    stats: { power: 2000, concentration: 260 }
  };
  const result = simulate(
    'Scrapper',
    ['Medic Gyro', 'Function Gyro', { type: 'wait', durationMs: 3200 }, 'Positive Strike'],
    config
  );
  const withoutTrait = simulate(
    'Scrapper',
    ['Medic Gyro', 'Function Gyro', { type: 'wait', durationMs: 3200 }, 'Positive Strike'],
    { ...config, selectedTraitIds: [] }
  );

  assert.equal(result.warnings.length, 0);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'combo' && event.skillName === 'Function Gyro' && event.finisherType === 'Blast'
    )
  );
  assert.equal(
    withoutTrait.resolvedEvents.some((event) => event.type === 'combo' && event.skillName === 'Function Gyro'),
    false
  );
  assert.equal(result.procSteps.filter((step) => step.skill === 'Kinetic Accelerators').length, 1);
  const quickness = result.events.find(
    (event) => event.type === 'buff' && event.name === 'Kinetic Accelerators — quickness'
  );
  const might = result.events.find((event) => event.type === 'buff' && event.name === 'Kinetic Accelerators — might');

  assert.equal(quickness.recipients, 'party');
  assert.equal(quickness.duration, 3.52);
  assert.equal(might.recipients, 'party');
  assert.equal(might.duration, 10 * (1 + 260 / 1500));
  assert.equal(might.stacks, 3);
  const chart = buildChartSeries(result, 40);

  assert.equal(chart.effectUnits.Quickness, 's');
  assert.equal(chart.effects.Quickness[0].v, 3.52);
  assert.ok(chart.effects.Quickness.some((point) => point.v > 0));

  const acceleratedStep = result.steps.find((step) => step.skill === 'Positive Strike');
  const baseStep = withoutTrait.steps.find((step) => step.skill === 'Positive Strike');

  assert.equal(acceleratedStep.end - acceleratedStep.start, 480);
  assert.equal(baseStep.end - baseStep.start, 720);

  const acceleratedHit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Positive Strike'
  );
  const baseHit = withoutTrait.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Positive Strike'
  );

  assert.ok(Math.abs(acceleratedHit.damage / baseHit.damage - 2090 / 2000) < 1e-12);
});

test('Kinetic Accelerators applies its strict ICD only to whirl finishers', () => {
  const boons = [];
  const context = {
    config: {
      selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
      stats: { concentration: 0 }
    },
    state: {
      activeWeaponSet: 1,
      profession: {
        core: {},
        specialization: { kind: 'Scrapper', state: createScrapperState() }
      }
    },
    epsilon: 1e-9,
    emitDerived(_event, boon) {
      boons.push(boon);
    }
  };
  const combo = (finisherType, at) => ({
    type: 'combo',
    at,
    source: 'engineer',
    sourceId: 1,
    actorType: 'player',
    skillName: `${finisherType} test`,
    finisherType,
    schedulerPrediction: 'combo-result'
  });

  const observe = scrapperSchedulerHooks.onEventScheduled.handler;

  observe(context, combo('Whirl', 1));
  observe(context, combo('Whirl', 2));
  observe(context, combo('Leap', 2));
  observe(context, combo('Blast', 2));
  observe(context, combo('Whirl', 4));
  observe(context, combo('Whirl', 4.001));

  const quickness = boons.filter((event) => event.kind === 'quickness');
  const might = boons.filter((event) => event.kind === 'might');

  assert.deepEqual(
    quickness.map((event) => [event.at, event.duration]),
    [
      [1, 3],
      [2, 3],
      [2, 3],
      [4.001, 3]
    ]
  );
  assert.deepEqual(
    might.map((event) => [event.at, event.duration, event.stacks]),
    [
      [1, 10, 3],
      [2, 10, 3],
      [2, 10, 3],
      [4.001, 10, 3]
    ]
  );
  assert.ok(boons.every((event) => event.recipients === 'party'));
  assert.ok(boons.every((event) => event.schedulerPrediction == null));
});

test('Scrapper 1-3-2 converts 13% of Power into Concentration', () => {
  const canonical = createEngineerBuildDefaults();

  canonical.gear = Object.fromEntries(Object.keys(canonical.gear).map((slot) => [slot, "Berserker's"]));
  canonical.rune = '';
  canonical.food = '';
  canonical.utility = '';
  canonical.jadeBotCore = false;
  canonical.infusions = canonical.infusions.map((infusion) => ({
    ...infusion,
    count: 0
  }));
  canonical.specializations = [
    { name: 'Explosives', traits: '3-2-3' },
    { name: 'Firearms', traits: '3-3-1' },
    { name: 'Scrapper', traits: '1-3-2' }
  ];
  canonical.assumptions.quickness = false;
  const app = {
    build: toApplicationBuild(canonical),
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  engineerAppAdapter.recalculate(app);

  assert.ok(app.attributeData.activeTraits.some((trait) => trait.name === 'Kinetic Accelerators'));
  assert.equal(
    app.attributeData.attributes.Concentration.traits,
    Math.round(app.attributeData.attributes.Power.final * 0.13)
  );
});

test('Mine Field materializes five mines plus detonation with cripple', () => {
  const mineField = mechanic('Mine Field');
  const detonation = mechanic('Detonate Mine Field');

  assert.equal(mineField.cooldown, 17);
  assert.equal(mineField.effects[0].coefficient, 3.85);
  assert.equal(mineField.effects[0].hits, 5);
  assert.equal(detonation.effects[0].coefficient, 0.77);
  assert.equal(detonation.effects[0].hits, 1);

  const result = simulate('Core', ['Mine Field', 'Detonate Mine Field']);

  assert.equal(result.warnings.length, 0);
  const mines = result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Damage per Mine');

  assert.equal(mines.length, 6);
  assert.ok(mines.every((event) => event.coefficient === 0.77));

  const cripple = result.resolvedEvents.filter((event) => event.type === 'condition' && event.condition === 'Crippled');

  assert.equal(cripple.length, 6);
  assert.ok(cripple.every((event) => event.duration === 2.5));

  // A precast field waits for combat; fields cast after the marker still trigger at cast completion.
  const precast = simulate('Core', ['Mine Field', { type: 'wait', durationMs: 1000 }, '__combat_start']);
  const active = simulate('Core', ['__combat_start', 'Mine Field']);
  const mineTimes = (simulation) =>
    simulation.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Damage per Mine')
      .map((event) => event.at);

  assert.deepEqual(mineTimes(precast), Array(5).fill(2.38));
  assert.deepEqual(mineTimes(active), Array(5).fill(1.38));

  const staticPrecast = simulate('Core', ['Mine Field', { type: 'wait', durationMs: 1000 }, '__combat_start'], {
    selectedTraitIds: [TRAIT.STATIC_DISCHARGE]
  });
  const staticActive = simulate('Core', ['__combat_start', 'Mine Field'], {
    selectedTraitIds: [TRAIT.STATIC_DISCHARGE]
  });
  const discharges = (simulation) =>
    simulation.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Static Discharge');

  assert.equal(discharges(staticPrecast).length, 1);
  assert.equal(discharges(staticActive).length, 2);
  assert.ok(discharges(staticActive).some((event) => event.parentSkillName === 'Detonate Mine Field'));
});

test('Takedown Round adds strike damage only after endurance is spent', () => {
  // The focused ratio protects the trait condition without depending on a saved benchmark rotation.
  const full = simulate('Core', ['Positive Strike'], { selectedTraitIds: [TRAIT.TAKEDOWN_ROUND] });
  const spent = simulate('Core', ['Dodge', 'Positive Strike'], { selectedTraitIds: [TRAIT.TAKEDOWN_ROUND] });

  assert.ok(Math.abs(spent.strikeDamage / full.strikeDamage - 1.1) < 1e-12);
});

test('power Scrapper toolbelt skills use their per-hit and control facts', () => {
  const orbitalStrike = mechanic('Orbital Strike');

  assert.equal(orbitalStrike.cooldown, 40);
  assert.equal(orbitalStrike.quicknessCastTimeMs, 880);
  assert.equal(orbitalStrike.effects[0].coefficient, 1.33);
  assert.equal(orbitalStrike.effects[0].atMs, 1700);
  assert.equal(orbitalStrike.effects[0].timingAnchor, 'castEnd');
  assert.equal(orbitalStrike.comboFinishers[0].finisherType, 'Blast');

  const orbital = simulate('Core', ['Orbital Strike', { type: 'wait', durationMs: 3000 }], {
    boons: { quickness: true },
    selectedSkills: ['A.E.D.', 'Grenade Kit', 'Throw Mine', 'Bomb Kit', 'Elite Mortar Kit']
  });
  const orbitalCast = orbital.steps.find((step) => step.skill === 'Orbital Strike');
  const orbitalHit = orbital.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Orbital Strike');

  assert.equal(orbitalCast.end - orbitalCast.start, 880);
  assert.equal(orbitalHit.at * 1000 - orbitalCast.end, 1700);

  const grenadeBarrage = mechanic('Grenade Barrage');

  assert.equal(grenadeBarrage.cooldown, 25);
  assert.equal(grenadeBarrage.effects[0].coefficient, 3.6);
  assert.equal(grenadeBarrage.effects[0].hits, 6);
  assert.equal(grenadeBarrage.comboFinishers, undefined);

  const staticShock = mechanic('Static Shock');

  assert.equal(staticShock.cooldown, 20);
  assert.equal(staticShock.effects[0].coefficient, 1);
  assert.equal(staticShock.effects[1].metadata.controlKind, 'daze');

  const result = simulate('Core', ['Grenade Barrage']);
  const grenades = result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Grenade Barrage');

  assert.equal(grenades.length, 6);
  assert.ok(grenades.every((event) => event.coefficient === 0.6));
});

test('Medic Gyro and Reconstruction Field expose their water fields', () => {
  const reconstructionField = mechanic('Reconstruction Field');

  assert.equal(reconstructionField.cooldown, 25);
  assert.equal(reconstructionField.comboFields[0].fieldType, 'Water');
  assert.equal(reconstructionField.comboFields[0].duration, 2);
  assert.deepEqual(reconstructionField.effects[0], {
    type: 'boon',
    boon: 'protection',
    duration: 2,
    stacks: 1
  });

  const medicGyro = mechanic('Medic Gyro');

  assert.equal(medicGyro.cooldown, 20);
  assert.equal(medicGyro.comboFields[0].fieldType, 'Water');
  assert.equal(medicGyro.comboFields[0].duration, 5);
});

test('Poison Gas Shell pulses its five-second poison field', () => {
  const poisonGasShell = mechanic('Poison Gas Shell');

  assert.equal(poisonGasShell.comboFields[0].fieldType, 'Poison');
  assert.equal(poisonGasShell.comboFields[0].duration, 5);
  assert.equal(poisonGasShell.effects[1].condition, 'Poisoned');
  assert.equal(poisonGasShell.effects[1].duration, 3);
  assert.equal(poisonGasShell.effects[1].applications, 5);
  assert.equal(poisonGasShell.effects[1].intervalMs, 1000);

  const result = simulate('Core', ['Elite Mortar Kit', 'Poison Gas Shell', { type: 'wait', durationMs: 5000 }], {
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Elite Mortar Kit']
  });
  const poison = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Poison Gas Shell' && event.condition === 'Poisoned'
  );

  assert.equal(poison.length, 5);
  assert.deepEqual(
    poison.map((event) => Number((event.at - poison[0].at).toFixed(9))),
    [0, 1, 2, 3, 4]
  );
  assert.ok(poison.every((event) => event.duration === 3));
});

test('Mechanical Genius gives the jade mech independent inherited attributes', () => {
  const player = {
    power: 2000,
    precision: 1500,
    toughness: 1200,
    vitality: 1300,
    ferocity: 600,
    conditionDamage: 1000,
    expertise: 300,
    concentration: 400,
    healingPower: 500
  };
  const base = engineerMechAttributes({ specialization: 'Mechanist' }, player);

  assert.deepEqual(base, {
    power: 2000,
    precision: 1,
    toughness: 2200,
    vitality: 2300,
    ferocity: 300,
    conditionDamage: 500,
    expertise: 150,
    concentration: 200,
    healingPower: 250
  });
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS]
      },
      player
    ).conditionDamage,
    1000
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS]
      },
      player
    ).expertise,
    300
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS]
      },
      player
    ).concentration,
    400
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS]
      },
      player
    ).healingPower,
    500
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR]
      },
      player
    ).precision,
    1501
  );

  const uncapped = {
    power: 10000,
    precision: 10000,
    toughness: 10000,
    vitality: 10000,
    ferocity: 10000,
    conditionDamage: 10000,
    expertise: 10000,
    concentration: 10000,
    healingPower: 10000
  };
  const cappedBase = engineerMechAttributes(
    {
      specialization: 'Mechanist'
    },
    uncapped
  );

  assert.equal(cappedBase.power, 2250);
  assert.equal(cappedBase.ferocity, 750);
  assert.equal(cappedBase.conditionDamage, 750);
  assert.equal(cappedBase.expertise, 750);
  assert.equal(cappedBase.concentration, 750);
  assert.equal(cappedBase.healingPower, 750);
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR]
      },
      uncapped
    ).precision,
    2500
  );
  const cappedConductive = engineerMechAttributes(
    {
      specialization: 'Mechanist',
      selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS]
    },
    uncapped
  );

  assert.equal(cappedConductive.conditionDamage, 1500);
  assert.equal(cappedConductive.expertise, 1500);
  const cappedChanneling = engineerMechAttributes(
    {
      specialization: 'Mechanist',
      selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS]
    },
    uncapped
  );

  assert.equal(cappedChanneling.concentration, 1500);
  assert.equal(cappedChanneling.healingPower, 1500);
  const copiedMightAfterCaps = engineerProfession
    .resolveRuntime({
      specialization: 'Mechanist'
    })
    .modifyAttributes(
      {
        config: {
          specialization: 'Mechanist',
          selectedSkills: ['Shift Signet'],
          boons: { might: 25 }
        },
        event: {
          actorType: 'summon',
          engineerMech: true
        }
      },
      {
        ...uncapped,
        power: uncapped.power + 750,
        conditionDamage: uncapped.conditionDamage + 750
      }
    );

  assert.equal(copiedMightAfterCaps.power, 3000);
  assert.equal(copiedMightAfterCaps.conditionDamage, 1500);

  const firearms = simulate('Mechanist', ['Spark Revolver', { type: 'wait', durationMs: 1500 }], {
    stats: {
      power: 2811,
      precision: 1960,
      ferocity: 1480
    },
    boons: { fury: true },
    attributeProvenance: {
      professionStaticRulesApplied: true
    },
    selectedTraitIds: [
      TRAIT.HEMATIC_FOCUS,
      TRAIT.NO_SCOPE,
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ],
    target: { conditions: {} }
  });
  const mechStrike = firearms.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Spark Revolver'
  );

  assert.ok(Math.abs(mechStrike.criticalChance - 0.9576190476190476) < 1e-12);
  assert.ok(Math.abs(mechStrike.criticalDamage - 1.9433333333333334) < 1e-12);
});

test('Mechanist arm traits alter mech hits and their command skills', () => {
  const singleEdge = simulate('Mechanist', ['Rolling Smash', { type: 'wait', durationMs: 1500 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const rolling = singleEdge.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Rolling Smash');

  assert.equal(rolling.actorType, 'summon');
  assert.equal(rolling.coefficient, 1.6);
  const rollingBleeds = singleEdge.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.condition === 'Bleeding' &&
      ['Rolling Smash', 'Mech Arms: Single-Edge Cutters'].includes(event.skillName)
  );

  assert.ok(
    rollingBleeds.some((event) => event.skillName === 'Rolling Smash' && event.stacks === 4 && event.duration === 8)
  );
  const cutterBleeds = rollingBleeds.filter((event) => event.skillName === 'Mech Arms: Single-Edge Cutters');

  assert.equal(cutterBleeds.length, 2);
  assert.ok(cutterBleeds.every((event) => event.stacks === 1 && event.duration === 3));
  assert.ok(cutterBleeds[1].at - cutterBleeds[0].at >= 1);

  const highImpact = simulate('Mechanist', ['Explosive Knuckle', { type: 'wait', durationMs: 1500 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
      TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const knuckle = highImpact.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Explosive Knuckle'
  );

  assert.equal(knuckle.actorType, 'summon');
  assert.equal(knuckle.coefficient, 1.8);
  assert.equal(knuckle.damageKind, 'explosion');
  assert.equal(knuckle.weaponStrengthProfileId, 'summon.weapon-type-2');
  assert.equal(knuckle.resolvedWeaponStrength, 2878);
  assert.ok(
    highImpact.resolvedEvents.some(
      (event) => event.type === 'condition' && event.condition === 'Weakness' && event.duration === 5
    )
  );
  const highImpactProcs = highImpact.procSteps.filter((step) => step.skill === 'Mech Arms: High-Impact Drivers');

  assert.equal(highImpactProcs.length, 2);
  assert.ok(highImpactProcs[1].start - highImpactProcs[0].start >= 1);

  const jadeCannons = simulate('Mechanist', ['Spark Revolver', { type: 'wait', durationMs: 2300 }], {
    selectedTraitIds: [TRAIT.MECH_ARMS_JADE_CANNONS, TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS, TRAIT.MECH_CORE_J_DRIVE],
    stats: { precision: 4000 },
    target: { conditions: {} }
  });
  const spark = jadeCannons.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Spark Revolver'
  );

  assert.equal(spark.length, 12);
  assert.ok(
    spark.every(
      (event) =>
        event.actorType === 'summon' &&
        Math.abs(event.coefficient - 0.176) < 1e-12 &&
        event.weaponStrengthProfileId === 'summon.weapon-type-2' &&
        event.resolvedWeaponStrength === 2878
    )
  );
  const autos = jadeCannons.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Jade Energy Shot'
  );

  assert.ok(autos.length >= 2);
  assert.ok(spark.every((event) => event.criticalChance === 0.25));
  assert.deepEqual(
    autos
      .slice(0, 2)
      .map((event) => [
        event.skillId,
        event.coefficient,
        event.criticalChance,
        event.weaponStrengthProfileId,
        event.resolvedWeaponStrength
      ]),
    [
      [ID.JADE_ENERGY_SHOT, 0.42, 0.25, 'summon.weapon-type-1', 2553.5],
      [ID.JADE_ENERGY_SHOT_ID_63348, 0.42, 0.25, 'summon.weapon-type-1', 2553.5]
    ]
  );
  assert.ok(
    jadeCannons.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Mech Arms: Jade Cannons' &&
        event.condition === 'Vulnerability' &&
        event.duration === 6
    )
  );

  const meleeChain = simulate('Mechanist', [{ type: 'wait', durationMs: 3000 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  }).resolvedEvents.filter(
    (event) =>
      event.type === 'damage' && ['Hard Strike', 'Heavy Smash (Mech)', 'Twin Strike (Mech)'].includes(event.name)
  );

  assert.deepEqual(
    [...new Set(meleeChain.map((event) => event.name))],
    ['Hard Strike', 'Heavy Smash (Mech)', 'Twin Strike (Mech)']
  );
  assert.ok(
    meleeChain.every(
      (event) => event.weaponStrengthProfileId === 'summon.weapon-type-2' && event.resolvedWeaponStrength === 2878
    )
  );
});

test('Mechanist frame commands use mech stats and requested pulse profiles', () => {
  const conductive = simulate('Mechanist', ['Discharge Array', { type: 'wait', durationMs: 5000 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const discharge = conductive.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Discharge Array'
  );

  assert.equal(discharge.length, 5);
  assert.ok(
    discharge.every((event, index) => event.actorType === 'summon' && event.coefficient === 0.3 && event.at === index)
  );
  for (const [condition, stacks, duration] of [
    ['Slow', 1, 2],
    ['Confusion', 2, 3],
    ['Burning', 1, 3]
  ]) {
    const applications = conductive.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Discharge Array' && event.condition === condition
    );

    assert.equal(applications.length, 5);
    assert.ok(applications.every((event) => event.stacks === stacks && event.duration === duration));
  }

  const variable = simulate('Mechanist', ['Core Reactor Shot', { type: 'wait', durationMs: 700 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const reactor = variable.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Core Reactor Shot'
  );

  assert.equal(reactor.actorType, 'summon');
  assert.equal(reactor.coefficient, 2.5);
  assert.equal(reactor.weaponStrengthProfileId, 'summon.weapon-type-1');
  assert.equal(reactor.resolvedWeaponStrength, 2553.5);
  assert.ok(
    variable.events.some(
      (event) => event.type === 'control' && event.skillName === 'Core Reactor Shot' && event.controlKind === 'launch'
    )
  );
});

test('Mech Fighter, Jade Dynamo, and J-Drive add their active effects', () => {
  const fighter = simulate('Mechanist', ['Lightning Rod'], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const punch = fighter.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Rocket Punch (Mech)');

  assert.equal(punch.actorType, 'summon');
  assert.equal(punch.coefficient, 1);
  assert.equal(punch.explosion, true);
  assert.equal(punch.weaponStrengthProfileId, 'summon.weapon-type-1');
  assert.equal(punch.resolvedWeaponStrength, 2553.5);
  const punchBreakdown = fighter.breakdown.find((entry) => entry.name === 'Rocket Punch (Mech)');

  assert.equal(punchBreakdown.skillId, ID.ROCKET_PUNCH_MECH);
  assert.equal(punchBreakdown.actorType, 'summon');
  const punchRow = skillBreakdownRows(fighter).find((row) => row.name === 'Rocket Punch (Mech)');

  assert.equal(punchRow.skillId, ID.ROCKET_PUNCH_MECH);
  assert.equal(punchRow.actorType, 'summon');
  assert.equal(punchRow.group, 'Entities');
  assert.ok(
    fighter.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Rocket Punch (Mech)' &&
        event.condition === 'Burning' &&
        event.duration === 5
    )
  );
  assert.ok(
    fighter.events.some(
      (event) =>
        event.type === 'control' &&
        event.skillName === 'Rocket Punch (Mech)' &&
        event.controlKind === 'defiance' &&
        event.duration === 100
    )
  );

  const dynamo = simulate('Mechanist', ['Jade Mortar', 'Jade Mortar'], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ],
    target: { conditions: {} }
  });
  const mortarSteps = dynamo.steps.filter((step) => step.skill === 'Jade Mortar');

  assert.equal(mortarSteps[0].end - mortarSteps[0].start, 1620);
  assert.equal(mortarSteps[1].start - mortarSteps[0].start, 16000);
  assert.equal(
    dynamo.events.filter((event) => event.type === 'buff' && event.kind === 'quickness' && event.duration === 2.5)
      .length,
    2
  );
  const mortar = dynamo.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Jade Mortar');

  assert.equal(mortar.actorType, 'summon');
  assert.equal(mortar.coefficient, 2.2);
  assert.equal(mortar.weaponStrengthProfileId, 'summon.weapon-type-2');
  assert.equal(mortar.resolvedWeaponStrength, 2878);

  const overclock = simulate('Mechanist', ['Overclock Signet', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Shift Signet', 'Force Signet', 'Overclock Signet'],
    selectedTraitIds: [
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ],
    target: { conditions: {} }
  });
  const buster = overclock.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Jade Buster Cannon'
  );
  const busterBurns = overclock.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Jade Buster Cannon' && event.condition === 'Burning'
  );

  assert.equal(buster.length, 5);
  assert.ok(
    buster.every(
      (event) =>
        event.actorType === 'summon' &&
        event.coefficient === 0.95 &&
        event.weaponStrengthProfileId === 'summon.weapon-type-3' &&
        event.resolvedWeaponStrength === 2749
    )
  );
  assert.equal(new Set(buster.map((event) => event.activationId)).size, 1);
  assert.equal(busterBurns.length, 5);
  assert.ok(busterBurns.every((event) => event.stacks === 1 && event.duration === 6));
  const stochasticBuster = simulate('Mechanist', ['Overclock Signet', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Shift Signet', 'Force Signet', 'Overclock Signet'],
    selectedTraitIds: [
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ],
    randomness: { mode: 'stochastic', seed: 63374 },
    target: { conditions: {} }
  }).resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Jade Buster Cannon');
  const stochasticStrengths = [...new Set(stochasticBuster.map((event) => event.resolvedWeaponStrength))];

  assert.equal(stochasticStrengths.length, 1);
  assert.ok(stochasticStrengths[0] >= 2448 && stochasticStrengths[0] < 3050);
  assert.ok(stochasticBuster.every((event) => event.weaponStrengthSampled === true));

  const jDriveConfig = {
    selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Force Signet', 'Superconducting Signet', 'Overclock Signet'],
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  };
  const sky = simulate('Mechanist', ['Sky Circus'], jDriveConfig);
  const missiles = sky.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Missile Damage');

  assert.equal(missiles.length, 3);
  assert.ok(missiles.every((event) => event.actorType === 'summon' && event.coefficient === 0.6));
  assert.equal(
    sky.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Landing Damage').coefficient,
    1.2
  );
  assert.ok(
    sky.events.some(
      (event) => event.type === 'control' && event.skillName === 'Sky Circus' && event.controlKind === 'knockdown'
    )
  );

  const base = simulate('Mechanist', ['Puncturing Jab'], {
    target: { conditions: {} }
  });
  const standardSignetConfig = {
    selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Force Signet', 'Shift Signet', 'Overclock Signet'],
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_BARRIER_ENGINE
    ],
    target: { conditions: {} }
  };
  const standardSigned = simulate('Mechanist', ['Puncturing Jab'], standardSignetConfig);
  const signed = simulate('Mechanist', ['Puncturing Jab'], jDriveConfig);
  const strike = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab');

  assert.ok(Math.abs(strike(standardSigned).damage / strike(base).damage - 1.15) < 1e-12);
  assert.ok(Math.abs(strike(signed).damage / strike(base).damage - 1.18) < 1e-12);

  const mechWithoutShift = simulate('Mechanist', ['Core Reactor Shot', { type: 'wait', durationMs: 1000 }], {
    ...standardSignetConfig,
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_BARRIER_ENGINE
    ],
    selectedSkills: standardSignetConfig.selectedSkills.filter((skill) => skill !== 'Shift Signet'),
    boons: { might: 25 }
  });
  const mechWithShift = simulate('Mechanist', ['Core Reactor Shot', { type: 'wait', durationMs: 1000 }], {
    ...standardSignetConfig,
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_BARRIER_ENGINE
    ],
    boons: { might: 25 }
  });
  const mechStrike = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Core Reactor Shot');

  assert.ok(Math.abs(mechStrike(mechWithShift).damage / mechStrike(mechWithoutShift).damage - 1.375) < 1e-12);
  assert.equal(
    engineerProfession
      .resolveRuntime({
        specialization: 'Mechanist'
      })
      .modifyConditionDamage(
        {
          config: jDriveConfig,
          time: 0
        },
        1
      ),
    1.12
  );

  const signetRecharge = simulate('Mechanist', ['Force Signet', 'Force Signet'], jDriveConfig);
  const signetSteps = signetRecharge.steps.filter((step) => step.skill === 'Force Signet');

  assert.equal(signetSteps[1].start - signetSteps[0].end, 22800);
});

test('Energy Amplifier adds Power and Healing Power during regeneration', () => {
  const context = {
    config: {
      selectedTraitIds: [TRAIT.ENERGY_AMPLIFIER],
      boons: { regeneration: true }
    },
    time: 0
  };
  const attributes = engineerProfession
    .resolveRuntime({
      specialization: 'Core'
    })
    .modifyAttributes(context, {
      power: 2000,
      precision: 1000,
      toughness: 1000,
      vitality: 1000,
      ferocity: 0,
      conditionDamage: 0,
      expertise: 0,
      concentration: 0,
      healingPower: 500
    });

  assert.equal(attributes.power, 2250);
  assert.equal(attributes.healingPower, 750);
});

test('trait-coverage manifest covers all Engineer traits', () => {
  assert.equal(ENGINEER_TRAIT_COVERAGE.length, engineerCatalog.traits.length);
  assert.ok(ENGINEER_TRAIT_COVERAGE.every((entry) => entry.effects.length > 0));
  const coverage = (name) => {
    const trait = engineerCatalog.traits.find((entry) => entry.name === name);

    return ENGINEER_TRAIT_COVERAGE.find((entry) => entry.traitId === trait.id);
  };

  assert.equal(coverage('Aim-Assisted Rocket').status, 'implemented');
  assert.equal(coverage('Carbolic Composition').status, 'implemented');
  assert.equal(coverage('Grenadier').status, 'implemented');
  assert.equal(coverage('Static Discharge').status, 'implemented');
  assert.equal(coverage('Object in Motion').status, 'implemented');
  assert.equal(
    ENGINEER_TRAIT_COVERAGE.some((entry) => entry.status === 'pending'),
    false
  );
});

test('Engineer is a loadable native application', async () => {
  assert.equal(professionRoute('engineer'), 'engineer.html');
  assert.equal((await loadProfession('engineer')).id, 'engineer');
  assert.equal((await loadProfessionAppAdapter('engineer')).profession.id, 'engineer');
  const html = await readFile(new URL('../../../dist/site/engineer.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="engineer"/);
  assert.match(html, /Engineer<\/span> Rotation Simulator/);
});
