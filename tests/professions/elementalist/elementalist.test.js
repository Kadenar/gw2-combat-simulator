import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  loadProfession,
  loadProfessionAppAdapter,
  PROFESSION_ROUTES,
  professionOptions,
  professionRegistry,
  professionRoute
} from '#gw2/app/profession/registry.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { selectedGw2TraitValues } from '#gw2/platform/combat/query/combat-query.js';
import {
  ELEMENTALIST_BUILD_SCHEMA_VERSION,
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  validateElementalistBuild
} from '#gw2/content/professions/elementalist/build/build.js';
import { elementalistCatalog } from '#gw2/content/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/content/professions/elementalist/definition.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/elementalist/data/ids.js';
import { FIRE_ELEMENTAL_EVTC_PROFILE } from '#gw2/content/professions/elementalist/core/skills/elemental-profiles.js';
import { ELEMENTALIST_CORE_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/index.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/elementalist/core/profiles.js';
import { elementalistAttunementRechargeDuration } from '#gw2/content/professions/elementalist/core/mechanics/attunements.js';
import { TEMPEST_BALANCE_PROFILE_IDS } from '#gw2/content/professions/elementalist/specializations/tempest/profiles.js';
import { WEAVER_BALANCE_PROFILE_IDS } from '#gw2/content/professions/elementalist/specializations/weaver/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS } from '#gw2/content/professions/elementalist/specializations/catalyst/profiles.js';
import { EVOKER_BALANCE_PROFILE_IDS } from '#gw2/content/professions/elementalist/specializations/evoker/profiles.js';
const professionRoot = new URL('../../../js/games/gw2/content/professions/elementalist/', import.meta.url);

const applyElementalistPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(elementalistCatalog, patch), patch);

async function professionSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);

      if (entry.isDirectory()) return professionSourceFiles(target);

      return /\.(?:[cm]?js|ts)$/.test(entry.name) ? [target] : [];
    })
  );

  return nested.flat();
}

async function accessSourceModule(target) {
  try {
    await access(target);
  } catch (error) {
    if (!target.pathname.endsWith('.js')) throw error;
    const typeScript = new URL(target);

    typeScript.pathname = typeScript.pathname.replace(/\.js$/, '.ts');
    try {
      await access(typeScript);
    } catch {
      const declaration = new URL(target);

      declaration.pathname = declaration.pathname.replace(/\.js$/, '.d.ts');
      await access(declaration);
    }
  }
}

test('profession selector exposes every ready application route', () => {
  assert.deepEqual(PROFESSION_ROUTES, Object.fromEntries(professionRegistry.map(({ id, route }) => [id, route])));
  assert.equal(professionRoute('elementalist'), 'elementalist.html');
  assert.equal(professionRoute('unknown'), 'index.html');
  assert.deepEqual(
    professionOptions,
    professionRegistry.map(({ id, name }) => ({ id, name }))
  );
});

test('Elementalist is registered through the generic profession contract', async () => {
  const [profession, adapter] = await Promise.all([
    loadProfession('elementalist'),
    loadProfessionAppAdapter('elementalist')
  ]);

  assert.equal(profession.id, 'elementalist');
  assert.equal(profession.name, 'Elementalist');
  assert.ok(profession.catalog.specializations.length >= 9);
  assert.ok(profession.catalog.traits.length > 0);
  assert.ok(profession.catalog.skills.every((skill) => skill.icon));
  assert.ok(profession.catalog.traits.every((trait) => trait.icon));
  assert.ok(profession.catalog.specializations.every((specialization) => specialization.icon));
  assert.equal(profession.simulation, null);
  assert.equal(adapter.id, 'elementalist');
});

test('Elementalist modules expose isolated balance-profile authoring', () => {
  const modules = new Map(elementalistProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Tempest', 'Weaver', 'Catalyst', 'Evoker']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) => {
    const module = modules.get(moduleId);

    return [...module.balanceProfiles, ...module.skillVariants].find((entry) => entry.id === profileId);
  };

  assert.equal(profile('Core', ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.resources).patchableFields.recharge, 10);
  assert.equal(
    profile('Core', ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.summonedElemental).patchableFields.durationMultiplier,
    120
  );
  assert.equal(profile('Tempest', TEMPEST_BALANCE_PROFILE_IDS.lightningJolt).profile.effects[0].coefficient, 1.32);
  assert.equal(profile('Weaver', WEAVER_BALANCE_PROFILE_IDS.primordialStance).profile.effects[0].coefficient, 0.33);
  assert.equal(profile('Catalyst', CATALYST_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 30);
  assert.equal(profile('Evoker', EVOKER_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 6);
  assert.equal(
    modules.get('Core').skills.some((entry) => entry.id === ID.FRIGID_FLURRY),
    true
  );
  assert.equal(
    modules.get('Core').balanceProfiles.some((entry) => entry.profile.parentId === ID.FRIGID_FLURRY),
    false
  );
  assert.deepEqual(modules.get('Core').modifierRules.find((rule) => rule.id === 'elementalist.inferno').parameters, {
    powerScaling: 0.0825
  });

  const opaqueModifierRules = [...modules.values()].flatMap((module) =>
    module.modifierRules.filter(
      (rule) =>
        (typeof rule.amount === 'function' || typeof rule.factor === 'function') &&
        Object.keys(rule.parameters).length === 0
    )
  );

  assert.deepEqual(opaqueModifierRules, []);

  const preview = applyElementalistPatch({
    skills: {
      [ID.OVERLOAD_AIR]: {
        fields: { cooldown: { from: 20, to: 18 } }
      }
    },
    balanceProfiles: {
      [ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.resources]: {
        fields: { recharge: { from: 10, to: 9 } }
      },
      [ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.summonedElemental]: {
        fields: { durationMultiplier: { from: 120, to: 100 } }
      },
      [ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.elementalEnchantment]: {
        fields: { rechargeMultiplier: { from: 0.85, to: 0.8 } }
      },
      [TEMPEST_BALANCE_PROFILE_IDS.lightningJolt]: {
        effects: [{ effectIndex: 0, coefficient: { from: 1.32, to: 1.4 } }]
      },
      [WEAVER_BALANCE_PROFILE_IDS.primordialStance]: {
        effects: [{ effectIndex: 0, coefficient: { from: 0.33, to: 0.4 } }]
      },
      [CATALYST_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 30, to: 40 } }
      },
      [EVOKER_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 6, to: 8 } }
      }
    }
  });

  assert.equal(preview.skillsById.get(ID.OVERLOAD_AIR).cooldown, 18);
  assert.equal(preview.balanceProfilesById.get(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.resources).recharge, 9);
  assert.equal(preview.balanceProfilesById.get(TEMPEST_BALANCE_PROFILE_IDS.lightningJolt).effects[0].coefficient, 1.4);
  assert.equal(
    preview.balanceProfilesById.get(WEAVER_BALANCE_PROFILE_IDS.primordialStance).effects[0].coefficient,
    0.4
  );
  assert.equal(preview.balanceProfilesById.get(CATALYST_BALANCE_PROFILE_IDS.resources).maximumStacks, 40);
  assert.equal(preview.balanceProfilesById.get(EVOKER_BALANCE_PROFILE_IDS.resources).maximumStacks, 8);
  assert.equal(
    balanceProfileValueFromContext(
      { catalog: preview },
      ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.summonedElemental,
      'durationMultiplier',
      120
    ),
    100
  );
  // Mirror the production simulation boundary by deriving internal name aliases
  // from the canonical selected trait IDs before invoking lifecycle logic.
  const traitConfig = {
    selectedTraitIds: [TRAIT.ELEMENTAL_ENCHANTMENT],
    boons: {}
  };
  assert.equal(
    elementalistAttunementRechargeDuration(
      {
        catalog: preview,
        config: traitConfig,
        traits: selectedGw2TraitValues(traitConfig, preview)
      },
      10
    ),
    8
  );

  assert.equal(elementalistCatalog.skillsById.get(ID.OVERLOAD_AIR).cooldown, 20);
  assert.equal(
    elementalistCatalog.balanceProfilesById.get(ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.resources).recharge,
    10
  );
  assert.equal(FIRE_ELEMENTAL_EVTC_PROFILE.fireball.baseDamage, 830);
  assert.equal(FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst.baseDamage, 1150);
  assert.equal(
    [...elementalistCatalog.balanceProfilesById.values()].some(
      (entry) => entry.parentId === ID.FIRE_ELEMENTAL_FIREBALL
    ),
    false
  );
});

test('Elementalist build defaults and canonical builds normalize explicitly', () => {
  const defaults = createElementalistBuildDefaults();

  assert.equal(defaults.profession, 'elementalist');
  assert.equal(defaults.weapons[0], 'Sword');
  assert.deepEqual(defaults.alternateWeapons, ['', '']);
  assert.equal(defaults.startingWeaponSet, 1);
  assert.equal(defaults.assumptions.hitboxSize, 'small');
  assert.equal(validateElementalistBuild(defaults).valid, true);
  assert.equal(elementalistCatalog.skillsByName.has('Swap Weapons'), false);

  const migrated = migrateElementalistBuild({
    weapons: ['Scepter', 'Warhorn'],
    specializations: defaults.specializations
  });

  assert.equal(migrated.profession, 'elementalist');
  assert.deepEqual(migrated.weapons, ['Scepter', 'Warhorn']);
  assert.equal(validateElementalistBuild(migrated).valid, true);

  const migratedHitbox = migrateElementalistBuild({ assumptions: { hitboxSize: 'large' } });

  assert.equal(migratedHitbox.assumptions.hitboxSize, 'large');

  const collapsed = migrateElementalistBuild({
    ...defaults,
    alternateWeapons: ['Staff', ''],
    startingWeaponSet: 2
  });

  assert.deepEqual(collapsed.alternateWeapons, ['', '']);
  assert.equal(collapsed.startingWeaponSet, 1);
  assert.equal(validateElementalistBuild(collapsed).valid, true);
  assert.equal(
    validateElementalistBuild({
      ...defaults,
      alternateWeapons: ['Staff', '']
    }).valid,
    false
  );
});

test('Elementalist canonical strike timelines preserve packet timing, coefficients, and same-time order', () => {
  const invokeLightning = ELEMENTALIST_CORE_SKILL_MECHANICS[ID.INVOKE_LIGHTNING];
  const strike = invokeLightning.effects[0];

  assert.equal(strike.type, 'strike');
  assert.equal(strike.timingAnchor, 'castStart');
  assert.equal(strike.timingScale, 'cast');
  assert.deepEqual(
    strike.ticks.slice(0, 3).map(({ atMs, coefficient }) => [atMs, coefficient]),
    [
      [360, 0.825],
      [360, 0.7425],
      [360, 0.66]
    ]
  );
});

test('Elementalist canonical condition timelines preserve their packet start and applications', () => {
  const frostStorm = ELEMENTALIST_CORE_SKILL_MECHANICS[ID.FROST_STORM];
  const [strike, bleeding] = frostStorm.effects;

  assert.equal(strike.type, 'strike');
  assert.equal(bleeding.type, 'condition');
  assert.equal(strike.ticks[0].atMs, 1040);
  assert.deepEqual(bleeding.ticks[0], {
    atMs: 1320,
    condition: 'Bleeding',
    stacks: 1,
    duration: 3
  });
  assert.deepEqual(
    bleeding.ticks.map(({ atMs }) => atMs),
    strike.ticks.slice(1).map(({ atMs }) => atMs)
  );
});

test('Elementalist canonical strike timelines retain per-packet combat metadata', () => {
  const fieryWhirl = ELEMENTALIST_CORE_SKILL_MECHANICS[ID.FIERY_WHIRL];
  const strike = fieryWhirl.effects[0];

  assert.equal(strike.type, 'strike');
  assert.deepEqual(strike.comboFinishers, [
    {
      ownerId: 'elementalist',
      finisherType: 'Whirl',
      ambiguousFieldSelection: 'oldest'
    }
  ]);
  assert.deepEqual(
    strike.ticks.map(({ atMs, coefficient }) => [atMs, coefficient]),
    [
      [280, 0.688],
      [400, 0.688],
      [530, 0.688],
      [640, 0.688],
      [760, 0.688],
      [880, 0.688],
      [990, 0.688],
      [1130, 0.688]
    ]
  );
});

test('Elementalist canonical timelines retain causal and hitbox order for same-time packets', () => {
  const glyphOfStormsAir = elementalistCatalog.skillsById.get(ID.GLYPH_OF_STORMS_AIR);
  const packets = glyphOfStormsAir.effects.flatMap((effect) =>
    effect.ticks
      .filter(({ atMs }) => atMs === 880)
      .map((tick) => [
        effect.type,
        effect.type === 'strike' ? tick.coefficient : tick.condition,
        tick.metadata.hitboxIndex
      ])
  );

  assert.deepEqual(packets, [
    ['strike', 0.825, 1],
    ['condition', 'Vulnerability', 1],
    ['strike', 0.78375, 2],
    ['condition', 'Vulnerability', 2],
    ['strike', 0.7425, 3],
    ['condition', 'Vulnerability', 3]
  ]);
});

test('all Elementalist build and rotation assets migrate through the native codec', async () => {
  const root = new URL('../../..', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('data/gw2/builds/elementalist/manifest.json', root), 'utf8'));
  const presets = manifest.flatMap((section) =>
    section.presets.map((preset) => ({ ...preset, section: section.section }))
  );
  const buildFiles = (await readdir(new URL('data/gw2/builds/elementalist/', root)))
    .filter((name) => name.startsWith('b-') && name.endsWith('.json'))
    .sort();
  const rotationFiles = (await readdir(new URL('data/gw2/rotations/elementalist/', root)))
    .filter((name) => name.startsWith('r-') && name.endsWith('.json'))
    .sort();

  assert.deepEqual([...new Set(presets.map((preset) => path.basename(preset.build)))].sort(), buildFiles);
  assert.deepEqual([...new Set(presets.map((preset) => path.basename(preset.rotation)))].sort(), rotationFiles);

  for (const preset of presets) {
    const [savedBuild, savedRotation] = await Promise.all([
      readFile(new URL(preset.build, root), 'utf8').then(JSON.parse),
      readFile(new URL(preset.rotation, root), 'utf8').then(JSON.parse)
    ]);
    const build = migrateElementalistBuild({
      ...savedBuild,
      rotation: savedRotation.rotation
    });
    const validation = validateElementalistBuild(build);

    assert.equal(savedBuild.schemaVersion, ELEMENTALIST_BUILD_SCHEMA_VERSION, `${preset.section}: ${preset.label}`);
    assert.equal(validation.valid, true, `${preset.section}: ${preset.label}: ${validation.errors.join('; ')}`);
    assert.ok(
      build.rotation
        .filter((command) => command.type === 'cast')
        .every((command) => elementalistCatalog.skillsById.has(command.skillId)),
      `${preset.section}: ${preset.label}`
    );
  }
});

test('every relative import in the Elementalist package resolves', async () => {
  const files = await professionSourceFiles(professionRoot);

  assert.ok(files.length > 30);

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g);

    for (const match of imports) {
      const specifier = match[1].split('?')[0];
      const target = new URL(specifier, file);

      await assert.doesNotReject(
        accessSourceModule(target),
        `${path.relative(process.cwd(), file.pathname)} -> ${specifier}`
      );
    }
  }
});

test('native Elementalist has no standalone, CSV, or optimizer dependency', async () => {
  const files = await professionSourceFiles(professionRoot);

  assert.ok(files.length > 30);

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const relative = path.relative(process.cwd(), file.pathname);

    assert.doesNotMatch(source, /(?:[\\/]|["'])legacy(?:[\\/]|["'])/i, relative);
    assert.doesNotMatch(source, /\bcsv\b/i, relative);
    assert.doesNotMatch(source, /\boptimizer\b|effectivePower|effective power/i, relative);
  }
});
