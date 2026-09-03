import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { paletteSkillView, renderPalette } from '#gw2/app/rotation/palette/view.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient
} from '#gw2/platform/engine/effects/timelines.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  toApplicationBuild,
  validateEngineerBuild
} from '#gw2/professions/engineer/build/build.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_SUPPLEMENTAL_SKILLS } from '#gw2/professions/engineer/data/engineer-supplemental-skills.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { engineerCoreModule } from '#gw2/professions/engineer/core/module.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import { ENGINEER_CORE_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/index.js';
import { amalgamModule } from '#gw2/professions/engineer/specializations/amalgam/module.js';
import { AMALGAM_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import { holosmithModule } from '#gw2/professions/engineer/specializations/holosmith/module.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { mechanistModule } from '#gw2/professions/engineer/specializations/mechanist/module.js';
import { MECHANIST_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { scrapperModule } from '#gw2/professions/engineer/specializations/scrapper/module.js';
import { SCRAPPER_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';
import { assertProfessionFamilyConformance } from '../../helpers/profession-family-conformance.js';

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

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

const applyEngineerPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(engineerCatalog, patch), patch);

const authoringEngineerProfession = withActivePatchPreview(engineerProfession);

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
  assert.ok(flameBlast.effects.every((effect) => effectFirstAtMs(effect) === 480));
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
            selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Elixir Gun', 'Supply Crate']
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
      selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Elixir Gun', 'Supply Crate']
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

test('Engineer catalog retains reviewed packet and profile mechanics', () => {
  assert.equal(engineerCatalog.skillsById.get(5842).name, 'Bomb');
  assert.equal(strikeEffectCoefficient(engineerCatalog.skillsByName.get('Bomb').effects[0]), 1.2);
  assert.match(engineerCatalog.skillsById.get(5806).icon, /Special:Redirect\/file\/Poison_Grenade\.png$/);
  const ventExhaust = engineerCatalog.skillsByName.get('Vent Exhaust');

  // Vent Exhaust is an invoked skill, so its packets and heat loss live on the skill without a cast handler.
  assert.equal(ventExhaust.handlerId, undefined);
  assert.equal(ventExhaust.heatGain, undefined);
  assert.equal(ventExhaust.heatLoss, 15);
  assert.equal(strikeEffectCoefficient(ventExhaust.effects[0]), 1.1);
  assert.equal(ventExhaust.effects[0].canCrit, false);
  assert.deepEqual(conditionEffectTicks(ventExhaust.effects[1])[0], {
    atMs: 0,
    condition: 'Burning',
    stacks: 2,
    duration: 6
  });
  const thermalReleaseValve = engineerCatalog.balanceProfilesById.get(
    HOLOSMITH_BALANCE_PROFILE_IDS.thermalReleaseValve
  );

  assert.equal(thermalReleaseValve.resourceCost, undefined);
  assert.deepEqual(thermalReleaseValve.effects, [{ type: 'boon', boon: 'vigor', stacks: 1, duration: 3 }]);
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

  const modules = new Map(authoringEngineerProfession.patchAuthoring.modules.map((module) => [module.id, module]));

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

  const opaqueModifierRules = [...modules.values()].flatMap((module) =>
    module.modifierRules.filter(
      (rule) =>
        (typeof rule.amount === 'function' || typeof rule.factor === 'function') &&
        Object.keys(rule.parameters).length === 0
    )
  );

  assert.deepEqual(opaqueModifierRules, []);

  const preview = applyEngineerPatch({
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

  assert.equal(preview.balanceProfilesById.get(ENGINEER_CORE_BALANCE_PROFILE_IDS.resources).resourceCost, 45);
  assert.equal(preview.balanceProfilesById.get(SCRAPPER_BALANCE_PROFILE_IDS.appliedForce).attributePerStack, 35);
  assert.equal(
    preview.balanceProfilesById.get(HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier).enhancedStrikeFactor,
    1.5
  );
  assert.equal(preview.balanceProfilesById.get(MECHANIST_BALANCE_PROFILE_IDS.resources).attributeConversion, 0.6);
  assert.equal(preview.balanceProfilesById.get(AMALGAM_BALANCE_PROFILE_IDS.mercurialTendencies).rechargeReduction, 3);

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
        atMs: effectFirstAtMs(strike),
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
    'Healing Mist',
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

test('Engineer build imports do not coerce string booleans to true', () => {
  const defaults = createEngineerBuildDefaults();
  const migrated = migrateEngineerBuild({
    ...defaults,
    assumptions: {
      ...defaults.assumptions,
      targetMoving: 'false',
      inDamagingField: 'false'
    }
  });
  const invalid = {
    ...defaults,
    assumptions: {
      ...defaults.assumptions,
      targetMoving: 'false',
      inDamagingField: 'false'
    }
  };

  assert.equal(migrated.assumptions.targetMoving, false);
  assert.equal(migrated.assumptions.inDamagingField, false);
  assert.equal(validateEngineerBuild(invalid).valid, false);
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

  const malformedPrefix = toApplicationBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77104, 76705],
    rotation: [null, 'Offensive Protocol: Shred']
  });

  assert.deepEqual(malformedPrefix.rotation, [{ type: 'cast', skillId: 77103 }]);
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
  assert.equal(view.cooldownLabel, '4.80s');
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
  assert.match(palette.innerHTML, /data-skill="Grenade Kit"[\s\S]*?<span class="pal-cd">4\.80s<\/span>/);
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
        Elite: 'Supply Crate'
      }
    },
    professionState: { activeKit: 'Grenade Kit' }
  });
  const groups = paletteGroups.filter((group) => group.stackId === 'engineer-kits');
  const names = (group) => group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name);

  assert.deepEqual(
    groups.map((group) => group.label),
    ['Gren', 'Flam', 'Bomb', 'Med']
  );
  assert.equal(paletteGroups.at(-1).id, 'engineer-profession');
  assert.deepEqual(
    groups.map((group) => names(group).at(-1)),
    ['Stow Grenade Kit', 'Stow Flamethrower', 'Stow Bomb Kit', 'Stow Med Kit']
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
        Utility3: 'Elixir Gun',
        Elite: 'Supply Crate'
      }
    },
    professionState: {}
  };
  const group = engineerProfession.ui
    .paletteGroups(context)
    .find((candidate) => candidate.id === 'engineer-profession');

  assert.equal(group.includeActionSkills, true);
  const expected = ['Regenerating Mist', 'Grenade Barrage', 'Mine Field', 'Healing Mist', 'Function Gyro'];

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
    Utility3: 'Elixir Gun',
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
    ['Regenerating Mist', 'Grenade Barrage', 'Mine Field', 'Healing Mist', 'Med Pack Drop']
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
    ['Regenerating Mist', 'Grenade Barrage', 'Mine Field', 'Healing Mist', 'Engage Photon Forge']
  );
  assert.equal(holosmith.at(-1).label, 'Photon Forge');
  assert.deepEqual(
    holosmith.at(-1).skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Light Strike', 'Holo Leap', 'Corona Burst', 'Photon Blitz', 'Holographic Shockwave']
  );
});

test('Engineer slot selection excludes contextual and unsupported utilities', () => {
  const selectable = (name) => engineerProfession.ui.isSlotSkillSelectable({}, engineerCatalog.skillsByName.get(name));

  for (const name of ['Stow Grenade Kit', 'Stow Flamethrower', 'Detonate']) {
    assert.equal(selectable(name), false, name);
  }

  for (const name of ['Grenade Kit', 'Flamethrower', 'Bomb Kit', 'Med Kit', 'Elixir Gun', 'Throw Mine']) {
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

test('Engineer mine and healing turret detonations are armed by their parent skills', () => {
  for (const [parent, flip] of [
    ['Throw Mine', 'Detonate'],
    ['Healing Turret', 'Detonate Healing Turret']
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

  const healing = simulate('Core', ['Healing Turret']);

  assert.ok(
    healing.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Healing Turret' &&
        event.kind === 'regeneration' &&
        event.duration === 3
    )
  );

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
    selectedSkills: ['Healing Turret', 'Throw Mine', 'Elixir Gun', 'Supply Crate']
  });

  assert.match(denied.warnings[0], /Grenade Kit is not equipped/);
});
