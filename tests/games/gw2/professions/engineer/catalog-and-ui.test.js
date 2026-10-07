import { flattenProfessionState } from '#gw2/platform/profession-definition/state.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import {
  applyBalanceProfilePatch,
  applySkillPatch,
  validatePatchPreview
} from '#gw2/integrations/patches/authoring/patches.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { loadProfession, loadProfessionAppAdapter } from '#gw2/profession-registry.js';
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  toApplicationBuild,
  validateEngineerBuild
} from '#gw2/professions/engineer/build/build.js';
import { engineerCoreCastAvailability } from '#gw2/professions/engineer/core/mechanics/availability.js';
import { engineerCoreModule } from '#gw2/professions/engineer/core/module.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import { ENGINEER_SUPPLEMENTAL_SKILLS } from '#gw2/professions/engineer/data/engineer-supplemental-skills.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { amalgamModule } from '#gw2/professions/engineer/specializations/amalgam/module.js';
import { holosmithModule } from '#gw2/professions/engineer/specializations/holosmith/module.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { mechanistModule } from '#gw2/professions/engineer/specializations/mechanist/module.js';
import { MECHANIST_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/traits/frames.js';
import { scrapperModule } from '#gw2/professions/engineer/specializations/scrapper/module.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { assertProfessionFamilyConformance } from '#tests/helpers/profession-family-conformance.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const baseConfig = Object.freeze({
  selectedSkillIds: [5857, 5805, 6161, 5933, 5868],
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

const simulate = createObservedProfessionSimulator(engineerProfession, baseConfig);

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

const applyEngineerPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(engineerCatalog, patch), patch);

const authoringEngineerProfession = withActivePatchPreview(engineerProfession);

test('Mechanist keeps its mech present and exposes only trait-selected commands', () => {
  // Removed mech controls must stay absent from both simulation and authoring catalogs.
  for (const id of [63050, 63089, 63210, 63300]) {
    assert.equal(engineerCatalog.skillsById.has(id), false);
    assert.equal(
      ENGINEER_SUPPLEMENTAL_SKILLS.some((skill) => skill.id === id),
      false
    );
    assert.equal(
      authoringEngineerProfession.patchAuthoring.modules.some((module) =>
        module.skillVariants.some((skill) => skill.id === id)
      ),
      false
    );
  }

  for (const name of ['Crash Down', 'Recall Mech', 'Mech Support: Depth Charges'])
    assert.equal(engineerCatalog.skillsByName.has(name), false);

  const result = simulate('Mechanist', ['Overclock Signet', { type: 'wait', durationMs: 6000 }], {
    selectedSkillIds: [...baseConfig.selectedSkillIds.slice(0, 4), 63095]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.mech.active, true);
  assert.ok(result.events.some((event) => event.type === 'damage' && event.skillId === ID.JADE_BUSTER_CANNON));
  assert.ok(result.events.some((event) => event.type === 'damage' && event.mechBasicAttack));

  const groups = engineerProfession.ui.paletteGroups({
    specialization: 'Mechanist',
    professionState: result.planningState.profession
  });
  assert.deepEqual(
    groups.find((group) => group.id === 'engineer-profession').skillIds,
    result.planningState.profession.mech.commandSkillIds
  );
});

// Canonical inheritance edits survive loading and application; obsolete fields must fail validation.
test('Mechanist profile overrides preserve canonical edits and reject obsolete fields', () => {
  const resourceId = MECHANIST_BALANCE_PROFILE_IDS.resources;
  const saved = {
    id: 'mech-inheritance',
    label: 'Mech inheritance',
    professions: {
      engineer: {
        balanceProfiles: {
          [resourceId]: {
            fields: {
              baseAttribute: 100,
              inheritanceRatio: 0.25,
              secondaryAttributeCap: 50,
              powerCap: 500,
              improvedSecondaryAttributeCap: 80,
              precisionCap: 300,
              improvedInheritanceRatio: 0.75,
              basePrecision: 2
            }
          }
        }
      }
    }
  };
  const original = structuredClone(saved);
  const normalized = validatePatchPreview(saved);
  assert.deepEqual(normalized, original);
  assert.deepEqual(validatePatchPreview(normalized), normalized);
  assert.deepEqual(saved, original);
  const catalog = applyEngineerPatch(normalized.professions.engineer);
  const resources = catalog.balanceProfilesById.get(resourceId);
  const attributes = engineerMechAttributes(
    { selectedTraitIds: [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR] },
    { power: 4000, precision: 1000, ferocity: 1000 },
    resources
  );
  assert.equal(attributes.power, 500);
  assert.equal(attributes.precision, 300);
  assert.equal(attributes.ferocity, 50);
  for (const invalid of [
    { minimumStacks: 20, secondaryAttributeCap: 30 },
    { secondaryAttributeCap: { from: 99, to: 200 } },
    { secondaryAttributeCap: NaN },
    { imaginaryCap: 20 }
  ]) {
    assert.throws(() => applyEngineerPatch({ balanceProfiles: { [resourceId]: { fields: invalid } } }));
  }

  for (const field of [
    'attributeBonus',
    'attributeConversion',
    'minimumStacks',
    'maximumStacks',
    'threshold',
    'weaponAttributeBonus',
    'coefficientMultiplier',
    'basePower'
  ]) {
    assert.throws(() => applyEngineerPatch({ balanceProfiles: { [resourceId]: { fields: { [field]: 1 } } } }));
  }
});

// Cannon payload and timing belong to the skill, so the passive profile rejects their obsolete tuning keys.
test('Overclock Signet runtime inputs stay outside balance authoring', () => {
  for (const field of ['firstHitDelay', 'pulseInterval', 'animationDuration', 'maximumStacks', 'packetCount']) {
    assert.throws(() =>
      authoringEngineerProfession.validatePatch({
        balanceProfiles: { [ID.OVERCLOCK_SIGNET]: { fields: { [field]: 1 } } }
      })
    );
    assert.equal(Object.hasOwn(engineerCatalog.balanceProfilesById.get(ID.OVERCLOCK_SIGNET), field), false);
  }
});

test('Engineer flip declarations expose and consume windows independently of API metadata', () => {
  runEngineer(
    [],
    {},
    {
      initialize(runtime) {
        const complete = (skill) =>
          applySkillSideEffects(
            runtime,
            { skill, id: 'flip-test', start: 0, fullEnd: 0, effectiveEnd: 0 },
            'castCommit'
          );
        for (const skill of engineerCatalog.skills.filter(
          (candidate) =>
            candidate.paletteFlipSkillId != null &&
            candidate.id !== ID.HEALING_TURRET &&
            candidate.id !== ID.PHOTON_WALL
        )) {
          const flip = engineerCatalog.skillsById.get(skill.paletteFlipSkillId);
          assert.equal(engineerCoreCastAvailability(runtime, flip).ready, false);
          complete({ ...skill, flipSkillId: ID.RIFLE_BURST });
          assert.equal(engineerCoreCastAvailability(runtime, flip).ready, true);
          assert.equal(runtime.profession.core.availableFlips[ID.RIFLE_BURST], undefined);
          complete(flip);
          assert.equal(engineerCoreCastAvailability(runtime, flip).ready, false);
        }

        const before = structuredClone(runtime.profession.core.availableFlips);
        // Palette metadata alone cannot create a runtime window; only an authored action can.
        complete({ id: -999, name: 'Palette-only parent', paletteFlipSkillId: ID.MAGNETIC_INVERSION });
        complete({ id: -999, name: 'Unowned API flip', flipSkillId: ID.MAGNETIC_INVERSION });
        assert.deepEqual(runtime.profession.core.availableFlips, before);
      }
    }
  );
});

test('Overheat authoring retains the live penalty and rejects obsolete saved controls', () => {
  // Sparse saved edits remain valid for the live field; removed no-op controls fail explicitly without mutating inputs.
  const id = HOLOSMITH_BALANCE_PROFILE_IDS.overheat;
  const profile = authoringEngineerProfession.patchAuthoring.modules
    .find((module) => module.id === 'Holosmith')
    .balanceProfiles.find((entry) => entry.id === id);
  assert.deepEqual(Object.keys(profile.patchableFields), ['maximumStacks']);
  const live = { balanceProfiles: { [id]: { fields: { maximumStacks: { from: 15, to: 9 } } } } };
  assert.equal(authoringEngineerProfession.validatePatch(live), true);
  assert.equal(applyEngineerPatch(live).balanceProfilesById.get(id).maximumStacks, 9);
  for (const field of ['minimumStacks', 'threshold', 'pulseInterval', 'durationMultiplier']) {
    const saved = JSON.parse(JSON.stringify({ balanceProfiles: { [id]: { fields: { [field]: 1 } } } }));
    assert.throws(() => authoringEngineerProfession.validatePatch(saved), new RegExp(`does not expose ${field}`));
    assert.equal(saved.balanceProfiles[id].fields[field], 1);
    assert.equal(Object.hasOwn(engineerCatalog.balanceProfilesById.get(id), field), false);
  }

  assert.equal(engineerCatalog.balanceProfilesById.get(id).maximumStacks, 15);
});

test('Poison Dart Volley and Static Shot are not combo finishers', () => {
  assert.equal(mechanic('Poison Dart Volley').comboFinishers, undefined);
  assert.equal(mechanic('Static Shot').comboFinishers, undefined);
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
  assert.equal(profile('Scrapper', TRAIT.APPLIED_FORCE).patchableFields.attributePerStack, 30);
  assert.equal(profile('Holosmith', HOLOSMITH_BALANCE_PROFILE_IDS.heat).patchableFields.maximumStacks, undefined);
  assert.equal(profile('Holosmith', HOLOSMITH_BALANCE_PROFILE_IDS.heat).patchableFields.threshold, undefined);
  assert.equal(profile('Holosmith', TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT).patchableFields.maximumStacks, undefined);
  assert.equal(profile('Holosmith', TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT).patchableFields.threshold, undefined);
  assert.equal(
    profile('Holosmith', HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier).patchableFields.enhancedStrikeFactor,
    1.35
  );
  assert.equal(
    modules.get('Holosmith').skills.find((skill) => skill.id === ID.VENT_EXHAUST).patchableFields.heatLoss,
    15
  );
  assert.equal(profile('Mechanist', MECHANIST_BALANCE_PROFILE_IDS.resources).patchableFields.inheritanceRatio, 0.5);
  assert.equal(profile('Amalgam', TRAIT.MERCURIAL_TENDENCIES).patchableFields.rechargeReduction, 2.5);

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
      [TRAIT.APPLIED_FORCE]: {
        fields: { attributePerStack: { from: 30, to: 35 } }
      },
      [HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier]: {
        fields: { enhancedStrikeFactor: { from: 1.35, to: 1.5 } }
      },
      [MECHANIST_BALANCE_PROFILE_IDS.resources]: {
        fields: { inheritanceRatio: { from: 0.5, to: 0.6 } }
      },
      [TRAIT.MERCURIAL_TENDENCIES]: {
        fields: { rechargeReduction: { from: 2.5, to: 3 } }
      }
    }
  });

  assert.equal(preview.balanceProfilesById.get(ENGINEER_CORE_BALANCE_PROFILE_IDS.resources).resourceCost, 45);
  assert.equal(preview.balanceProfilesById.get(TRAIT.APPLIED_FORCE).attributePerStack, 35);
  assert.equal(
    preview.balanceProfilesById.get(HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier).enhancedStrikeFactor,
    1.5
  );
  assert.equal(preview.balanceProfilesById.get(MECHANIST_BALANCE_PROFILE_IDS.resources).inheritanceRatio, 0.6);
  assert.equal(preview.balanceProfilesById.get(TRAIT.MERCURIAL_TENDENCIES).rechargeReduction, 3);

  assert.equal(engineerCatalog.balanceProfilesById.get(ENGINEER_CORE_BALANCE_PROFILE_IDS.resources).resourceCost, 50);
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
  assert.equal(grenade.placement, 'active-weapon');
  assert.match(profession.className, /compact-resource-palette/);
  assert.equal(profession.stackId, 'holosmith-profession');
  assert.equal(forge.stackId, 'holosmith-profession');
  assert.equal(forge.skillIds.length, 7);
  assert.ok(names(forge).every((name) => !name.endsWith('—Storm')));
});

test('Engineer renders Endurance only for Tools and uses a standard bar', () => {
  const build = createEngineerBuildDefaults();
  const state = engineerProfession
    .resolveProfession({
      specialization: 'Core'
    })
    .createState({ specialization: 'Core' });
  const core = engineerProfession.ui.resourceViews({
    catalog: engineerCatalog,
    specialization: 'Core',
    build,
    professionState: flattenProfessionState(state)
  });

  assert.equal(
    core.some((view) => view.id === 'endurance'),
    false
  );

  const tools = engineerProfession.ui.resourceViews({
    catalog: engineerCatalog,
    specialization: 'Core',
    build: {
      ...build,
      specializations: [
        { name: 'Tools', traits: '1-2-3' },
        { name: 'Explosives', traits: '3-2-3' },
        { name: 'Firearms', traits: '1-2-3' }
      ]
    },
    professionState: flattenProfessionState(state)
  });
  const endurance = tools.find((view) => view.id === 'endurance');

  assert.equal(endurance.displayMode, 'bar');
  assert.equal(endurance.paletteSkillId, SHARED_SKILL_IDS.DODGE);
  assert.equal(Object.hasOwn(endurance, 'pipStyle'), false);

  const holosmith = engineerProfession.ui.resourceViews({
    catalog: engineerCatalog,
    specialization: 'Holosmith',
    build,
    professionState: engineerProfession
      .resolveProfession({
        specialization: 'Holosmith'
      })
      .createState({ specialization: 'Holosmith' })
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
    activeCatalog: engineerCatalog,
    skills: engineerCatalog.skills,
    skillById: engineerCatalog.skillsById,
    skillByName: engineerCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: null
  };
  const palette = inertContainer();
  const previousDocument = globalThis.document;

  globalThis.document = {
    querySelector: () => null,
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

  canonicalBuild.selectedSkillIds.Utility2 = 5927;
  canonicalBuild.selectedSkillIds.Utility3 = 5812;
  const build = adapter.toApplicationBuild(canonicalBuild);
  const app = {
    build,
    adapter,
    profession: engineerProfession,
    activeCatalog: engineerCatalog,
    skills: engineerCatalog.skills,
    skillById: engineerCatalog.skillsById,
    skillByName: engineerCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: null
  };
  const palette = inertContainer();
  const previousDocument = globalThis.document;

  globalThis.document = {
    querySelector: () => null,
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
    type: 'engineer.heat',
    reason: 'heat',
    heat: 25
  };
  const eventLogRow = (specialization, value) => {
    const config = { specialization };
    const runtime = engineerProfession.resolveProfession(config);

    return engineerProfession.ui.eventLogRow(
      {
        config,
        professionState: flattenProfessionState(runtime.createState(config))
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

test('Amalgam selects and labels Evolve from the current build traits in the palette and saved rotations', () => {
  // Trait changes replace F5 and normalize old names/IDs without exposing both variants.
  const build = createEngineerBuildDefaults();
  for (const [traits, expectedId, name] of [
    ['1-1-1', ID.EVOLVE_BASE, 'Evolve (Base)'],
    ['1-1-3', ID.EVOLVE_DOUBLE_HELIX, 'Evolve (Double Helix)'],
    ['1-1-1', ID.EVOLVE_BASE, 'Evolve (Base)']
  ]) {
    build.specializations[2] = { name: 'Amalgam', traits };
    const group = engineerProfession.ui
      .paletteGroups({ specialization: 'Amalgam', build })
      .find((group) => group.id === 'engineer-profession');
    assert.deepEqual(
      group.skillIds.filter((id) => [ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX].includes(id)),
      [expectedId]
    );
    assert.equal(engineerCatalog.skillsById.get(expectedId).name, name);
    const migrated = migrateEngineerBuild({ ...build, rotation: ['Evolve', ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX] });
    assert.ok(migrated.rotation.every((command) => command.skillId === expectedId));
    assert.deepEqual(validateEngineerBuild(migrated), { valid: true, errors: [] });
  }
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

// Explicit parents keep selectable toolbelts usable without admitting unsupported racial actions.
test('toolbelt IDs require the equipped parent and exclude unsupported racial skills', () => {
  const selectedSkillIds = [31248];
  assert.equal(simulate('Scrapper', [ID.BYPASS_COATING], { selectedSkillIds }).warnings.length, 0);
  assert.match(simulate('Scrapper', [ID.BYPASS_COATING], { selectedSkillIds: [] }).warnings[0], /not equipped/);
  for (const skillId of [ID.CONFUSING_SPEECH, ID.VENT_RADIATION]) {
    assert.equal(engineerCatalog.skillsById.get(skillId).simulatorExcluded, true);
    assert.ok(simulate('Core', [skillId]).warnings.length > 0);
  }
});

test('kits replace the weapon bar and trigger swap procs', () => {
  const denied = simulate('Core', ['Grenade']);

  assert.match(denied.warnings[0], /equip Grenade Kit first/);

  const result = simulate('Core', ['Grenade Kit', 'Shrapnel Grenade']);

  assert.equal(result.warnings.length, 0);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.planningState.profession.activeKit, ID.GRENADE_KIT);
  assert.ok(result.events.some((event) => event.type === 'sigil_swap'));

  const weaponDenied = simulate('Core', ['Grenade Kit', 'Blunderbuss']);

  assert.match(weaponDenied.warnings[0], /active kit.*replaces weapon skills/);

  for (const exitSkill of ['Stow Grenade Kit', 'Swap Weapons']) {
    const exited = simulate('Core', ['Grenade Kit', exitSkill, 'Blunderbuss']);

    assert.equal(exited.warnings.length, 0, exitSkill);
    assert.equal(exited.planningState.profession.activeKit, null, exitSkill);
    assert.equal(exited.planningState.activeWeaponSet, 1, exitSkill);
  }

  const swapDenied = simulate('Core', [{ type: 'combat-start' }, 'Swap Weapons']);

  assert.match(swapDenied.warnings[0], /cannot swap weapon sets in combat/);
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

test('Engineer kit palettes stack and include their linked stow skills', () => {
  const paletteGroups = engineerProfession.ui.paletteGroups({
    specialization: 'Core',
    build: {
      selectedSkillIds: {
        Heal: 5802,
        Utility1: 5805,
        Utility2: 5927,
        Utility3: 5812,
        Elite: 5868
      }
    },
    professionState: { activeKit: ID.GRENADE_KIT }
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
      selectedSkillIds: {
        Heal: 5857,
        Utility1: 5805,
        Utility2: 6161,
        Utility3: 5933,
        Elite: 5868
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

  assert.match(core.warnings[0], /Function Gyro: Unknown skill/);
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
      selectedSkillIds: {
        ...defaults.selectedSkillIds,
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
      selectedSkillIds: [...baseConfig.selectedSkillIds, engineerCatalog.skillsByName.get(parent).id]
    };
    const denied = simulate('Core', [flip], config);

    assert.match(denied.warnings[0], new RegExp(`use ${parent} first`));

    const result = simulate('Core', [parent, flip], config);

    assert.equal(result.warnings.length, 0, `${parent} -> ${flip}`);
    assert.equal(result.planningState.profession.availableFlips[engineerCatalog.skillsByName.get(flip).id], undefined);
  }

  const healing = simulate('Core', ['Healing Turret']);

  assert.equal(healing.planningState.cooldowns[ID.HEALING_TURRET], undefined);
  assert.deepEqual(healing.planningState.cooldowns[ID.DETONATE_HEALING_TURRET], {
    readyAt: Math.ceil((healing.steps[0].end + 500) / 40) * 40,
    remaining: Math.ceil((healing.steps[0].end + 500) / 40) * 40 - healing.steps[0].end
  });
  assert.ok(
    healing.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Healing Turret' &&
        event.kind === 'regeneration' &&
        event.duration === 3
    )
  );
  // Turret replacement and overcharge retain their cooldowns after the preceding action finishes.
  const turretCycle = simulate('Core', [
    'Healing Turret',
    'Detonate Healing Turret',
    { type: 'wait', durationMs: 19760 },
    'Healing Turret',
    { type: 'wait', durationMs: 10240 },
    'Cleansing Burst'
  ]);
  const [firstTurret, detonation, secondTurret, cleansingBurst] = turretCycle.steps.filter((step) =>
    ['Healing Turret', 'Detonate Healing Turret', 'Cleansing Burst'].includes(step.skill)
  );
  assert.equal(detonation.start, Math.ceil((firstTurret.end + 500) / 40) * 40);
  assert.equal(secondTurret.start - detonation.end, 19760);
  assert.equal(cleansingBurst.start - secondTurret.end, 10240);

  const mineConfig = {
    selectedSkillIds: [...baseConfig.selectedSkillIds, 6161]
  };
  const throwStarts = (rotation) =>
    simulate('Core', rotation, mineConfig)
      .steps.filter((step) => step.skill === 'Throw Mine')
      .map((step) => step.start);

  assert.equal(engineerCatalog.skillsByName.get('Throw Mine').rechargeAnchor, 'castStart');
  assert.deepEqual(throwStarts(['Throw Mine', { type: 'wait', durationMs: 8500 }, 'Throw Mine']), [0, 9600]);
  assert.deepEqual(
    throwStarts(['Throw Mine', 'Detonate', { type: 'wait', durationMs: 8500 }, 'Throw Mine']),
    [0, 9600]
  );

  // Gadgeteer's added mine shares the input but produces its own strike and combo attempt.
  const gadgeteer = simulate('Core', ['Bomb Kit', 'Fire Bomb', 'Stow Bomb Kit', 'Throw Mine', 'Detonate'], {
    selectedSkillIds: [...baseConfig.selectedSkillIds, 5812],
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
  const selectedSkillIds = [...baseConfig.selectedSkillIds, 5933];
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
    { selectedSkillIds }
  );
  const conditions = (name, condition) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === name && event.condition === condition
    );

  assert.deepEqual(result.warnings, []);
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
    conditions('Glob Shot', 'Crippled').map((event) => event.duration),
    [3]
  );
  assert.deepEqual(
    conditions('Glob Shot', 'Immobilized').map((event) => event.duration),
    [2]
  );
  assert.equal(engineerCatalog.skillsById.get(ID.GLOB_SHOT).cooldown, 8);
  assert.equal(engineerCatalog.skillsById.get(ID.FUMIGATE).cooldown, 12);
  assert.equal(
    result.events.filter((event) => event.type === 'combo_finisher' && event.skillName === 'Acid Bomb').length,
    1
  );
  assert.equal(engineerCatalog.skillsById.get(ID.ACID_BOMB).effects[0].comboFinishers[0].finisherType, 'Blast');
  assert.equal(engineerCatalog.skillsById.get(ID.SUPER_ELIXIR).cooldown, 16);
  assert.equal(engineerCatalog.skillsById.get(ID.SUPER_ELIXIR).comboFields[0].fieldType, 'Light');

  const hgh = simulate('Core', ['Elixir Gun', 'Acid Bomb', { type: 'wait', durationMs: 6500 }], {
    selectedSkillIds,
    selectedTraitIds: [TRAIT.HGH]
  });
  const hghField = hgh.events.find((event) => event.type === 'combo_field' && event.skillName === 'Acid Bomb');
  const hghBuff = (kind) =>
    hgh.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.HGH && event.kind === kind);
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

  assert.match(deniedGrenade.warnings[0], /unavailable for this build/);

  for (const [parent, flip] of [
    ['Magnetic Shield', 'Magnetic Inversion'],
    ['Static Shield', 'Throw Shield']
  ]) {
    const denied = simulate('Core', [flip]);

    assert.match(denied.warnings[0], new RegExp(`use ${parent} first`));

    const used = simulate('Core', [parent, flip]);

    assert.equal(used.warnings.length, 0, flip);
    assert.equal(
      used.planningState.profession.availableFlips[engineerCatalog.skillsByName.get(flip).id],
      undefined,
      flip
    );
  }
});

test('tool-belt skills derive from selected slot skills', () => {
  const available = simulate('Core', ['Grenade Barrage']);

  assert.equal(available.warnings.length, 0);
  assert.ok(available.totalDamage > 0);

  const denied = simulate('Core', ['Grenade Barrage'], {
    selectedSkillIds: [5857, 6161, 5933, 5868]
  });

  assert.match(denied.warnings[0], /Grenade Kit is not equipped/);
});

test('Engineer is a loadable native application', async () => {
  assert.equal((await loadProfession('engineer')).id, 'engineer');
  assert.equal((await loadProfessionAppAdapter('engineer')).profession.id, 'engineer');
  const html = await readFile(new URL('../../../../../dist/site/engineer.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="engineer"/);
  // The built document identifies the profession before the shared header mounts in the browser.
  assert.match(html, /<title>GW2 Combat Simulator — Engineer<\/title>/);
});
