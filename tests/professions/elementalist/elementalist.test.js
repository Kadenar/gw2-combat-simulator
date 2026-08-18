import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionOptions,
  professionRegistry
} from '../../../js/app/profession/registry.js';
import { PROFESSION_ROUTES, professionRoute } from '../../../js/app/profession/selector.js';
import { applyBalanceProfilePatch, applySkillPatch } from '../../../js/platform/gw2/skill-patch.js';
import {
  ELEMENTALIST_BUILD_SCHEMA_VERSION,
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  toApplicationBuild,
  validateElementalistBuild
} from '../../../js/professions/elementalist/build.js';
import { elementalistCatalog } from '../../../js/professions/elementalist/catalog.js';
import { elementalistProfession } from '../../../js/professions/elementalist/definition.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../js/professions/elementalist/data/ids.js';
import { LEGACY_ELEMENTALIST_SKILL_ID_MIGRATIONS } from '../../../js/professions/elementalist/data/legacy-skill-ids.js';
import { FIRE_ELEMENTAL_EVTC_PROFILE } from '../../../js/professions/elementalist/core/elemental-profile.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS,
  elementalistBalanceValue
} from '../../../js/professions/elementalist/core/profiles.js';
import { elementalistAttunementRechargeDuration } from '../../../js/professions/elementalist/core/rules.js';
import { TEMPEST_BALANCE_PROFILE_IDS } from '../../../js/professions/elementalist/specializations/tempest/profiles.js';
import { WEAVER_BALANCE_PROFILE_IDS } from '../../../js/professions/elementalist/specializations/weaver/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS } from '../../../js/professions/elementalist/specializations/catalyst/profiles.js';
import { EVOKER_BALANCE_PROFILE_IDS } from '../../../js/professions/elementalist/specializations/evoker/profiles.js';
const professionRoot = new URL('../../../js/professions/elementalist/', import.meta.url);

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

  const profile = (moduleId, profileId) =>
    modules.get(moduleId).balanceProfiles.find((entry) => entry.id === profileId);
  assert.equal(profile('Core', ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.resources).patchableFields.recharge, 10);
  assert.equal(
    profile('Core', ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.summonedElemental).patchableFields.durationMultiplier,
    120
  );
  assert.equal(profile('Tempest', TEMPEST_BALANCE_PROFILE_IDS.lightningJolt).profile.effects[0].coefficient, 2.64);
  assert.equal(profile('Weaver', WEAVER_BALANCE_PROFILE_IDS.primordialStance).profile.effects[0].coefficient, 0.33);
  assert.equal(profile('Catalyst', CATALYST_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 30);
  assert.equal(profile('Evoker', EVOKER_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 6);

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
        effects: [{ effectIndex: 0, coefficient: { from: 2.64, to: 2.8 } }]
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
  assert.equal(preview.balanceProfilesById.get(TEMPEST_BALANCE_PROFILE_IDS.lightningJolt).effects[0].coefficient, 2.8);
  assert.equal(
    preview.balanceProfilesById.get(WEAVER_BALANCE_PROFILE_IDS.primordialStance).effects[0].coefficient,
    0.4
  );
  assert.equal(preview.balanceProfilesById.get(CATALYST_BALANCE_PROFILE_IDS.resources).maximumStacks, 40);
  assert.equal(preview.balanceProfilesById.get(EVOKER_BALANCE_PROFILE_IDS.resources).maximumStacks, 8);
  assert.equal(
    elementalistBalanceValue(
      { catalog: preview },
      ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.summonedElemental,
      'durationMultiplier',
      120
    ),
    100
  );
  assert.equal(
    elementalistAttunementRechargeDuration(
      {
        catalog: preview,
        config: {
          selectedTraits: ['Elemental Enchantment'],
          boons: {}
        }
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
  assert.equal(FIRE_ELEMENTAL_EVTC_PROFILE.fireball.baseDamage, 995);
  assert.equal(
    [...elementalistCatalog.balanceProfilesById.values()].some(
      (entry) => entry.parentId === ID.FIRE_ELEMENTAL_FIREBALL
    ),
    false
  );
});

test('Elementalist build defaults and saved snapshots migrate explicitly', () => {
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

  const migratedHitbox = migrateElementalistBuild({ hitboxSize: 'small' });
  assert.equal(migratedHitbox.assumptions.hitboxSize, 'small');

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

test('Elementalist schema 3 synthetic skill IDs migrate to stable identities', () => {
  const migrated = migrateElementalistBuild({
    schemaVersion: 3,
    profession: 'elementalist',
    specializations: [
      { name: 'Fire', traits: '1-3-1' },
      { name: 'Air', traits: '3-3-2' },
      { name: 'Tempest', traits: '3-1-1' }
    ],
    selectedSkillIds: [1100138, 1100139, 1100122, 1100126, 1100276],
    rotation: [1100001, { type: 'cast', skillId: 1100122 }, { type: 'cast', id: '1100264' }]
  });

  assert.equal(migrated.schemaVersion, ELEMENTALIST_BUILD_SCHEMA_VERSION);
  assert.deepEqual(migrated.selectedSkills, {
    Heal: 'Wash the Pain Away!',
    Utility1: 'Feel the Burn!',
    Utility2: 'Glyph of Storms (Fire)',
    Utility3: 'Signet of Fire',
    Elite: 'Glyph of Elementals'
  });
  assert.deepEqual(
    migrated.rotation.map((command) => command.skillId),
    [ID.FIRE_ATTUNEMENT, ID.GLYPH_OF_STORMS_FIRE, ID.AERIAL_AGILITY_CHAIN]
  );
  assert.equal(Object.hasOwn(migrated, 'selectedSkillIds'), false);
});

test('the Elementalist legacy inventory completely targets the stable catalog', () => {
  assert.equal(LEGACY_ELEMENTALIST_SKILL_ID_MIGRATIONS.size, 284);
  assert.ok(
    [...LEGACY_ELEMENTALIST_SKILL_ID_MIGRATIONS.values()].every((id) => elementalistCatalog.skillsById.has(id))
  );
  assert.equal(
    elementalistCatalog.skills.some(
      (skill) => typeof skill.id === 'number' && skill.id >= 1_100_000 && skill.id < 1_101_000
    ),
    false
  );
  assert.equal(new Set(elementalistCatalog.skills.map((skill) => skill.id)).size, elementalistCatalog.skills.length);
});

test('standalone Elementalist snapshot fields migrate into the native schema', () => {
  const defaults = createElementalistBuildDefaults();
  const snapshot = {
    build: {
      ...defaults,
      profession: undefined,
      schemaVersion: undefined
    },
    selectedSkills: {
      heal: 'Signet of Restoration',
      util1: 'Arcane Blast',
      util2: 'Signet of Fire',
      util3: 'Arcane Wave',
      elite: 'Weave Self'
    },
    activeAttunement: 'Water',
    secondaryAttunement: 'Earth',
    evokerElement: 'Air',
    evokerStartCharges: 4,
    evokerStartEmpowered: 2,
    permaBoons: {
      Might: 17,
      Fury: true,
      Burning: true,
      Vulnerability: 12
    },
    rotation: [
      'Fire Attunement',
      { name: '__wait', waitMs: 420 },
      '__combat_start',
      { name: 'Arcane Blast', offset: 120, interruptMs: 250 }
    ]
  };

  const migrated = migrateElementalistBuild(snapshot);
  assert.equal(validateElementalistBuild(migrated).valid, true);
  assert.deepEqual(migrated.selectedSkills, {
    Heal: 'Signet of Restoration',
    Utility1: 'Arcane Blast',
    Utility2: 'Signet of Fire',
    Utility3: 'Arcane Wave',
    Elite: 'Weave Self'
  });
  assert.equal(migrated.startAttunement, 'Water');
  assert.equal(migrated.secondaryAttunement, 'Earth');
  assert.equal(migrated.evokerElement, 'Air');
  assert.equal(migrated.initialEvokerCharges, 4);
  assert.equal(migrated.initialEvokerEmpowered, 2);
  assert.equal(migrated.assumptions.might, 17);
  assert.equal(migrated.assumptions.fury, true);
  assert.equal(migrated.assumptions.quickness, false);
  assert.deepEqual(migrated.assumptions.targetConditions, {
    Burning: true,
    Vulnerability: 12
  });
  assert.ok(
    migrated.rotation
      .filter((command) => command.type === 'cast')
      .every((command) => elementalistCatalog.skillsById.has(command.skillId))
  );
  assert.deepEqual(
    toApplicationBuild(snapshot).rotation.map((entry) => (typeof entry === 'string' ? entry : entry.name)),
    ['Fire Attunement', '__wait', '__combat_start', 'Arcane Blast']
  );
});

test('all Elementalist build and rotation assets migrate through the native codec', async () => {
  const root = new URL('../../../', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('Builds/elementalist/manifest.json', root), 'utf8'));
  const presets = manifest.flatMap((section) =>
    section.presets.map((preset) => ({ ...preset, section: section.section }))
  );
  const buildFiles = (await readdir(new URL('Builds/elementalist/', root)))
    .filter((name) => name.startsWith('b-') && name.endsWith('.json'))
    .sort();
  const rotationFiles = (await readdir(new URL('Rotations/elementalist/', root)))
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

    assert.equal(validation.valid, true, `${preset.section}: ${preset.label}: ${validation.errors.join('; ')}`);
    assert.equal(
      Object.hasOwn(savedBuild.assumptions, 'elementalSimulationProfile'),
      false,
      `${preset.section}: ${preset.label}: retired elemental profile`
    );
    assert.equal(
      Object.hasOwn(savedBuild.assumptions, 'glyphBoonedElementals'),
      false,
      `${preset.section}: ${preset.label}: retired elemental boon flag`
    );
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
