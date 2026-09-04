import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  currentAutoattackSkill,
  paletteActionSkills,
  weaponPaletteRows,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';
import { activeResourceGroup, paletteSkillResourceView } from '#gw2/app/rotation/palette/resource-view.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  createRangerBuildDefaults,
  migrateRangerBuild,
  validateRangerBuild
} from '#gw2/professions/ranger/build/build.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/ranger/core/profiles.js';
import { RANGER_CORE_PUBLIC_END_STATE_KEYS } from '#gw2/professions/ranger/core/state.js';
import { DRUID_BALANCE_PROFILE_IDS } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { druidCastAvailability } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar-rules.js';
import { createDruidState, DRUID_PUBLIC_END_STATE_KEYS } from '#gw2/professions/ranger/specializations/druid/state.js';
import { SOULBEAST_BALANCE_PROFILE_IDS } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import {
  createSoulbeastState,
  SOULBEAST_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { UNTAMED_BALANCE_PROFILE_IDS } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import {
  createUntamedState,
  UNTAMED_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/ranger/specializations/untamed/state.js';
import { GALESHOT_BALANCE_PROFILE_IDS } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { GALESHOT_PUBLIC_END_STATE_KEYS } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerCoreCastRules } from '#gw2/professions/ranger/core/traits/modifiers.js';
import { soulbeastCastRules } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import { untamedCastRules } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash.js';
import { RANGER_PUBLIC_END_STATE_KEYS } from '#gw2/professions/ranger/state.js';
import { rangerAppAdapter } from '#gw2/professions/ranger/app/app-definition.js';

const baseConfig = Object.freeze({
  initialAstralForce: 100,
  initialArrows: 8,
  selectedPet: 'Lynx',
  selectedPet2: 'Fanged Iboga',
  selectedHammerSkillIds: [ID.WILD_SWING, ID.OVERBEARING_SMASH, ID.SAVAGE_SHOCK_WAVE, ID.THUMP],
  professionAssumptions: {
    targetDefiant: true
  },
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
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: rangerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      professionAssumptions: {
        ...baseConfig.professionAssumptions,
        ...(config.professionAssumptions || {})
      },
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    }
  });
}

const applyRangerPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(rangerCatalog, patch), patch);

const authoringRangerProfession = withActivePatchPreview(rangerProfession);

test('Ranger scheduler snapshots expose flat profession state', () => {
  const result = simulate('Soulbeast', []);

  assert.equal(result.snapshot.core, undefined);
  assert.equal(result.snapshot.specialization, undefined);
  assert.equal(result.snapshot.activePet, 'Lynx');
  assert.equal(result.snapshot.beastmodeActive, true);
});

test('Ranger public state is composed from Core and specialization-owned manifests', () => {
  assert.equal(RANGER_CORE_PUBLIC_END_STATE_KEYS.includes('beastmodeActive'), false);
  assert.equal(RANGER_CORE_PUBLIC_END_STATE_KEYS.includes('astralForce'), false);
  assert.deepEqual(RANGER_PUBLIC_END_STATE_KEYS, [
    ...RANGER_CORE_PUBLIC_END_STATE_KEYS,
    ...DRUID_PUBLIC_END_STATE_KEYS,
    ...SOULBEAST_PUBLIC_END_STATE_KEYS,
    ...UNTAMED_PUBLIC_END_STATE_KEYS,
    ...GALESHOT_PUBLIC_END_STATE_KEYS
  ]);
});

test('Ranger Core source stays specialization-agnostic', async () => {
  const directory = new URL('../../../js/games/gw2/professions/ranger/core/', import.meta.url);
  const files = (await readdir(directory, { recursive: true })).filter((file) => file.endsWith('.ts'));
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, directory), 'utf8')));
  const coreSource = sources.join('\n');

  assert.doesNotMatch(coreSource, /specializations\//);
  assert.doesNotMatch(coreSource, /\b(?:Druid|Soulbeast|Untamed|Galeshot|Beastmode)\b/);
  assert.doesNotMatch(coreSource, /\b(?:beastmodeActive|astralForce|rangerUnleashed|cycloneBowActive)\b/);
});

test('Ranger catalog preserves runtime references and handlers', () => {
  assert.equal(rangerCatalog.skillsById.get(ID.PATH_OF_SCARS_MAX_RANGE).variantBadge, 'MAX');
  assert.equal(rangerCatalog.skillsById.get(ID.PATH_OF_SCARS).variantBadge, undefined);
  assert.equal(
    RANGER_PETS.every(
      (pet) =>
        pet.beastmodeSkillIds.length === 3 && pet.beastmodeSkillIds.every((id) => rangerCatalog.skillsById.has(id))
    ),
    true
  );
  assert.equal(
    rangerCatalog.skills
      .filter((skill) => skill.petSkill || skill.unleashedPetSkill)
      .every((skill) => skill.independentCast),
    true
  );
  assert.equal(rangerCatalog.skillsById.get(ID.CELESTIAL_AVATAR).handlerId, 'ranger.celestial-avatar-enter');
  assert.equal(rangerCatalog.skillsById.get(ID.BEASTMODE).handlerId, 'ranger.beastmode-enter');
  assert.equal(rangerCatalog.skillsById.get(ID.UNLEASH_RANGER).handlerId, 'ranger.unleash-ranger');
  assert.equal(rangerCatalog.skillsById.get(ID.SUMMON_CYCLONE_BOW).handlerId, 'ranger.cyclone-bow-enter');
  assert.equal(rangerCatalog.skillsById.get(ID.SWAP_WEAPONS).handlerId, 'ranger.weapon-swap');
  assert.equal(rangerCatalog.skillsById.get(ID.PET_SWAP).icon, rangerCatalog.skillsById.get(ID.SWAP_WEAPONS).icon);
});

test('Ranger modules expose isolated balance-profile authoring', () => {
  const modules = new Map(authoringRangerProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Druid', 'Soulbeast', 'Untamed', 'Galeshot']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) => {
    const module = modules.get(moduleId);

    return [...module.balanceProfiles, ...module.skillVariants].find((entry) => entry.id === profileId);
  };

  assert.equal(profile('Core', RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha).patchableFields.weaponAttributeBonus, 300);
  assert.equal(profile('Druid', DRUID_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 100);
  assert.equal(profile('Soulbeast', SOULBEAST_BALANCE_PROFILE_IDS.oneWolfPack).profile.effects[0].coefficient, 0.95);
  assert.equal(profile('Untamed', UNTAMED_BALANCE_PROFILE_IDS.resources).patchableFields.durationMultiplier, 4);
  assert.equal(profile('Galeshot', GALESHOT_BALANCE_PROFILE_IDS.resources).patchableFields.pulseInterval, 5);

  const opaqueModifierRules = [...modules.values()].flatMap((module) =>
    module.modifierRules.filter(
      (rule) =>
        (typeof rule.amount === 'function' || typeof rule.factor === 'function') &&
        Object.keys(rule.parameters).length === 0
    )
  );

  assert.deepEqual(opaqueModifierRules, []);
  assert.deepEqual(
    modules.get('Core').modifierRules.find((rule) => rule.id === 'ranger.consuming-bite-condition-count').parameters,
    { maximumConditions: 5, coefficientPerCondition: 0.025 }
  );

  const preview = applyRangerPatch({
    skills: {
      [ID.SUPERSONIC_ARROW]: {
        fields: { arrowCost: { from: 3, to: 2 } }
      }
    },
    balanceProfiles: {
      [RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha]: {
        fields: { weaponAttributeBonus: { from: 300, to: 350 } }
      },
      [DRUID_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 100, to: 120 } }
      },
      [SOULBEAST_BALANCE_PROFILE_IDS.oneWolfPack]: {
        effects: [{ effectIndex: 0, coefficient: { from: 0.95, to: 1 } }]
      },
      [UNTAMED_BALANCE_PROFILE_IDS.resources]: {
        fields: { durationMultiplier: { from: 4, to: 5 } }
      },
      [GALESHOT_BALANCE_PROFILE_IDS.resources]: {
        fields: { pulseInterval: { from: 5, to: 4 } }
      }
    }
  });

  assert.equal(preview.skillsById.get(ID.SUPERSONIC_ARROW).arrowCost, 2);
  assert.equal(preview.balanceProfilesById.get(RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha).weaponAttributeBonus, 350);
  assert.equal(preview.balanceProfilesById.get(DRUID_BALANCE_PROFILE_IDS.resources).maximumStacks, 120);
  assert.equal(preview.balanceProfilesById.get(SOULBEAST_BALANCE_PROFILE_IDS.oneWolfPack).effects[0].coefficient, 1);
  assert.equal(preview.balanceProfilesById.get(UNTAMED_BALANCE_PROFILE_IDS.resources).durationMultiplier, 5);
  assert.equal(preview.balanceProfilesById.get(GALESHOT_BALANCE_PROFILE_IDS.resources).pulseInterval, 4);

  const petMetadata = rangerPetCombatMetadata({
    catalog: preview,
    config: {
      selectedPet: 'Pig',
      selectedTraitIds: [TRAIT.PACK_ALPHA]
    },
    state: {
      time: 0,
      cooldowns: new Map(),
      profession: {
        core: { activePet: 'Pig', activePetSlot: 1, petAutoGeneration: 0 }
      }
    }
  });

  assert.equal(petMetadata.summonBasePower, 1874);

  assert.equal(rangerCatalog.skillsById.get(ID.SUPERSONIC_ARROW).arrowCost, 3);
  assert.equal(
    rangerCatalog.balanceProfilesById.get(RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha).weaponAttributeBonus,
    300
  );
});

test('Ranger builds migrate and validate against the canonical catalog', () => {
  const defaults = createRangerBuildDefaults();

  assert.deepEqual(validateRangerBuild(defaults), { valid: true, errors: [] });
  assert.equal(defaults.initialUntamedState, 'Pet');
  assert.deepEqual(defaults.weapons, ['Hammer', '']);
  assert.deepEqual(defaults.alternateWeapons, ['Axe', 'Axe']);
  assert.equal(defaults.relic, 'Claw');
  assert.equal(defaults.selectedPet, 'Pig');
  assert.equal(defaults.selectedPet2, 'Lynx');
  assert.deepEqual(defaults.selectedHammerSkillIds, [
    ID.UNLEASHED_WILD_SWING,
    ID.OVERBEARING_SMASH,
    ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
    ID.UNLEASHED_THUMP
  ]);
  assert.equal(Object.hasOwn(defaults.assumptions, 'playerHealthPercent'), false);
  assert.equal(Object.hasOwn(defaults.assumptions, 'targetDistance'), false);
  assert.deepEqual(
    rangerProfession.ui.assumptionControls.map((control) => control.key),
    ['targetDefiant', 'simulationMode']
  );

  const migrated = migrateRangerBuild({
    ...defaults,
    initialAstralForce: 500,
    initialArrows: -4,
    initialUntamedState: 'Ranger',
    assumptions: {
      selectedPet: 'Lynx',
      soulbeastArchetype: 'Ferocious',
      playerHealthPercent: 10,
      targetDistance: 1500
    }
  });

  assert.equal(migrated.initialAstralForce, 100);
  assert.equal(migrated.initialArrows, 0);
  assert.equal(migrated.selectedPet, 'Pig');
  assert.equal(migrated.initialUntamedState, 'Ranger');
  assert.equal(Object.hasOwn(migrated.assumptions, 'selectedPet'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'soulbeastArchetype'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'playerHealthPercent'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'targetDistance'), false);
  assert.deepEqual(validateRangerBuild(migrated), { valid: true, errors: [] });
  assert.throws(() => migrateRangerBuild({ profession: 'necromancer' }), /Cannot load necromancer build as Ranger/);

  const withoutLegacyOverbearingStage = migrateRangerBuild({
    ...defaults,
    rotation: ['Hammer Strike', { name: 'Overbearing Smash (Follow-Up)', skillId: 63201 }, 'Hammer Slam']
  });

  assert.deepEqual(
    withoutLegacyOverbearingStage.rotation.map((command) => command.skillId),
    [ID.HAMMER_STRIKE, ID.HAMMER_SLAM]
  );

  const withoutAutonomousPetCasts = migrateRangerBuild({
    ...defaults,
    selectedPet: 'Carrion Devourer',
    selectedPet2: 'Fanged Iboga',
    rotation: [
      { name: 'Twin Darts', skillId: ID.TWIN_DARTS },
      { name: 'Tail Lash', skillId: ID.PET_TAIL_LASH },
      'Poisonous Cloud',
      { name: 'Regenerate', skillId: ID.REGENERATE },
      { name: 'Consuming Bite', skillId: ID.CONSUMING_BITE },
      {
        name: 'Crippling Anguish',
        skillId: ID.CRIPPLING_ANGUISH_PET
      },
      { name: 'Narcotic Spores', skillId: ID.NARCOTIC_SPORES_PET },
      { name: 'Fang Grapple', skillId: ID.FANG_GRAPPLE }
    ]
  });

  assert.deepEqual(
    withoutAutonomousPetCasts.rotation.map((command) => command.skillId),
    [ID.POISONOUS_CLOUD, ID.NARCOTIC_SPORES_PET]
  );
});

test('Go for the Throat follows Soulbeast F3 and unmerged pet F2', () => {
  const soulbeast = simulate('Soulbeast', ['Worldly Impact'], {
    selectedPet: 'Pig',
    selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT]
  });
  const soulbeastProcs = soulbeast.procSteps.filter((step) => step.skill === 'Lesser "Sic \'Em!"');

  assert.equal(soulbeastProcs.length, 1);
  assert.equal(soulbeastProcs[0].sourceSkill, 'Worldly Impact');
  assert.equal(soulbeastProcs[0].detail, '5s, +15% strike damage');
  assert.equal(Boolean(soulbeastProcs[0].icon), true);

  const core = simulate('Core', ['Intimidating Howl'], {
    selectedPet: 'Krytan Drakehound',
    selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT]
  });
  const coreProcs = core.procSteps.filter((step) => step.skill === 'Lesser "Sic \'Em!"');

  assert.equal(coreProcs.length, 1);
  assert.equal(coreProcs[0].sourceSkill, 'Intimidating Howl');
  assert.equal(coreProcs[0].detail, '8s, +40% pet strike damage');
  assert.equal(Boolean(coreProcs[0].icon), true);

  const familySkill = simulate('Core', ['Spit'], {
    selectedPet: 'Forest Spider',
    selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT]
  });

  assert.equal(
    familySkill.procSteps.some((step) => step.skill === 'Lesser "Sic \'Em!"'),
    false
  );
});

test('Relic of Fireworks triggers on Soulbeast beast skills', () => {
  const result = simulate('Soulbeast', ['Worldly Impact'], {
    selectedPet: 'Smokescale',
    relic: 'Fireworks'
  });
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');

  assert.ok(procs.length > 0);
  assert.ok(procs.every((step) => step.sourceSkill === 'Worldly Impact'));
});

test('precombat pet F2 starts combat before Go for the Throat applies', () => {
  const rotation = ['Furious Pounce', '__combat_start', { type: 'wait', durationMs: 8000 }];
  const config = {
    selectedPet: 'Tiger',
    target: { health: 10000000 }
  };
  const baseline = simulate('Core', rotation, config);
  const goForTheThroat = simulate('Core', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT]
  });
  const proc = goForTheThroat.procSteps.find((step) => step.skill === 'Lesser "Sic \'Em!"');
  const f2Damage = (result) => result.breakdown.find((row) => row.name === 'Furious Pounce').damage;
  const slashDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.FELINE_SLASH).damage;

  assert.equal(proc.sourceSkill, 'Furious Pounce');
  assert.equal(proc.start, goForTheThroat.combatStartTime * 1000);
  assert.equal(goForTheThroat.firstHitTime, goForTheThroat.combatStartTime);
  assert.equal(f2Damage(goForTheThroat), f2Damage(baseline));
  assert.ok(Math.abs(slashDamage(goForTheThroat) / slashDamage(baseline) - 1.4) < 1e-9);
});

test('Soulbeast condition modifiers and duration bonuses use their actual targets', () => {
  const rotation = ['Splitblade', { type: 'wait', durationMs: 10000 }];
  const config = {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe',
    selectedPet: 'Pig',
    professionAssumptions: { targetDefiant: true },
    stats: { conditionDamage: 1000, expertise: 0 },
    target: { health: 10000000 }
  };
  const baseline = simulate('Soulbeast', rotation, config);
  const huntersTactics = simulate('Soulbeast', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.HUNTERS_TACTICS]
  });
  const oppressive = simulate('Soulbeast', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.OPPRESSIVE_SUPERIORITY]
  });
  const oppressiveWithExpertise = simulate('Soulbeast', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.OPPRESSIVE_SUPERIORITY],
    stats: { ...config.stats, expertise: 150 }
  });
  const bleeding = (result) =>
    result.breakdown.filter((row) => row.name.includes('Bleeding')).reduce((total, row) => total + row.damage, 0);
  const splitbladeStrike = (result) => result.breakdown.find((row) => row.name === 'Splitblade').damage;
  const splitbladeBleedDuration = (result) => {
    const application = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === ID.SPLITBLADE && event.condition === 'Bleeding'
    );

    return application.expiresAt - application.at;
  };

  assert.equal(bleeding(huntersTactics), bleeding(baseline));
  assert.ok(splitbladeStrike(huntersTactics) > splitbladeStrike(baseline));
  assert.ok(Math.abs(splitbladeBleedDuration(oppressive) - 6.6) < 1e-9);
  assert.ok(Math.abs(splitbladeBleedDuration(oppressiveWithExpertise) - 7.2) < 1e-9);
});

test('Twice as Vicious activates from a disable', () => {
  const rotation = ['Overbearing Smash', 'Hammer Strike', 'Hammer Slam', 'Heavy Smash'];
  const config = {
    primaryWeapon: 'Hammer',
    selectedPet: 'Pig',
    selectedHammerSkillIds: [ID.WILD_SWING, ID.OVERBEARING_SMASH, ID.SAVAGE_SHOCK_WAVE, ID.THUMP]
  };
  const baseline = simulate('Soulbeast', rotation, config);
  const twiceAsVicious = simulate('Soulbeast', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.TWICE_AS_VICIOUS]
  });
  const heavySmashDamage = (result) => result.breakdown.find((row) => row.name === 'Heavy Smash').damage;

  assert.ok(Math.abs(heavySmashDamage(twiceAsVicious) / heavySmashDamage(baseline) - 1.07) < 1e-12);
});

test('Ranger Ice projectile finishers resolve per projectile without triggering Twice as Vicious', () => {
  const rotation = ['Frost Trap', 'Splitblade', 'Ricochet', 'Ricochet', 'Ricochet', 'Ricochet', 'Ricochet'];
  const deterministic = simulate('Soulbeast', rotation, {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe',
    selectedPet: 'Pig',
    selectedTraitIds: [TRAIT.TWICE_AS_VICIOUS]
  });
  const withoutTwiceAsVicious = simulate('Soulbeast', rotation, {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe',
    selectedPet: 'Pig'
  });
  const comboConditions = deterministic.resolvedEvents.filter(
    (event) => event.type === 'combo' && event.fieldType === 'Ice' && event.finisherType === 'Projectile'
  );

  assert.deepEqual(
    comboConditions.map((event) => [event.skillName, event.outcome.condition, event.outcome.duration]),
    [
      ['Splitblade', 'Chilled', 1],
      ['Ricochet', 'Chilled', 1]
    ]
  );
  assert.equal(deterministic.totalDamage, withoutTwiceAsVicious.totalDamage);

  const stochastic = simulate('Soulbeast', rotation.slice(0, 6), {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe',
    selectedPet: 'Pig',
    randomness: { mode: 'stochastic', seed: 1 }
  });

  assert.equal(
    stochastic.resolvedEvents.filter(
      (event) => event.type === 'combo' && event.fieldType === 'Ice' && event.finisherType === 'Projectile'
    ).length,
    3
  );
});

test('Core Ranger exposes only the selected pet Beast skill', () => {
  assert.equal(RANGER_PETS.find((pet) => pet.name === 'Lynx').skillIds.includes(ID.RENDING_POUNCE), true);
  const result = simulate('Core', ['Rapid Fire', 'Rending Pounce'], {
    primaryWeapon: 'Longbow'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activePet, 'Lynx');
  assert.equal(result.endState.profession.activePetSkillIds.includes(ID.RENDING_POUNCE), true);
  assert.equal(result.totalDamage > 0, true);

  const swapped = simulate('Core', ['Swap Weapons']);

  assert.deepEqual(swapped.warnings, []);
  assert.equal(swapped.endState.activeWeaponSet, 2);

  const wrongPet = simulate('Core', ['Rending Pounce'], {
    selectedPet: 'Jungle Stalker'
  });

  assert.match(wrongPet.warnings[0], /select the pet that owns/);

  const overlapping = simulate('Core', ['Rapid Fire', 'Rending Pounce', 'Point-Blank Shot'], {
    primaryWeapon: 'Longbow'
  });
  const rapidFire = overlapping.steps.find((step) => step.skill === 'Rapid Fire');
  const rendingPounce = overlapping.steps.find((step) => step.skill === 'Rending Pounce');
  const pointBlankShot = overlapping.steps.find((step) => step.skill === 'Point-Blank Shot');

  assert.equal(rendingPounce.start, rapidFire.start);
  assert.equal(pointBlankShot.start, rapidFire.end);
});

test('Ranger pet AI skills are autonomous and Beast commands stay independent', () => {
  const carrionContext = {
    specialization: 'Core',
    professionState: {
      activePet: 'Carrion Devourer',
      activePetSkillIds: RANGER_PETS.find((pet) => pet.name === 'Carrion Devourer').skillIds
    }
  };
  const carrionPalette = rangerProfession.ui.paletteGroups(carrionContext).find((group) => group.id === 'ranger-pet');

  assert.deepEqual(carrionPalette.skillIds, [ID.POISONOUS_CLOUD, ID.PET_SWAP]);
  assert.equal(carrionPalette.includeActionSkills, true);
  assert.equal(carrionPalette.statusIcon.label, 'Carrion Devourer');
  assert.equal(carrionPalette.statusIcon.icon, RANGER_PETS.find((pet) => pet.name === 'Carrion Devourer').icon);

  const endurance = rangerProfession.ui.resourceViews({
    specialization: 'Galeshot',
    professionState: { endurance: 35, maximumEndurance: 100 }
  })[0];

  assert.equal(endurance.value, 35);
  assert.equal(endurance.paletteSkillId, ID.DODGE);
  const resourceApp = {
    profession: rangerProfession,
    adapter: { eliteSpecialization: () => 'Core' },
    build: { initialResource: 0 },
    results: {
      endState: {
        profession: { endurance: 35, maximumEndurance: 100 }
      }
    }
  };

  assert.deepEqual(paletteSkillResourceView(resourceApp, ID.DODGE), {
    id: 'endurance',
    label: 'Current endurance: 35/100',
    value: 35,
    maximum: 100
  });
  assert.equal(activeResourceGroup(resourceApp), '');

  const directAuto = simulate('Core', ['Twin Darts'], {
    selectedPet: 'Carrion Devourer'
  });

  assert.match(directAuto.warnings[0], /uses this skill automatically/);

  const result = simulate(
    'Core',
    ['__combat_start', 'Rapid Fire', 'Poisonous Cloud', 'Point-Blank Shot', { type: 'wait', durationMs: 4000 }],
    { primaryWeapon: 'Longbow', selectedPet: 'Carrion Devourer' }
  );
  const rapidFire = result.steps.find((step) => step.skill === 'Rapid Fire');
  const poison = result.steps.find((step) => step.skill === 'Poisonous Cloud');
  const pointBlankShot = result.steps.find((step) => step.skill === 'Point-Blank Shot');
  const poisonAction = result.events.find((event) => event.type === 'action' && event.skillId === ID.POISONOUS_CLOUD);

  assert.equal(poison.start, rapidFire.start);
  assert.equal(pointBlankShot.start, rapidFire.end);
  assert.equal(poisonAction.actorType, 'summon');
  assert.equal(poisonAction.at > rapidFire.start / 1000, true);
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'action' &&
        event.skillId === ID.TWIN_DARTS &&
        event.actorType === 'summon' &&
        event.autonomousPetSkill
    ),
    true
  );
});

test('queued Beast commands never delay player skills', () => {
  const result = simulate(
    'Core',
    [
      '__combat_start',
      'Poisonous Cloud',
      'Rapid Fire',
      'Poisonous Cloud',
      'Point-Blank Shot',
      { type: 'wait', durationMs: 35000 }
    ],
    { primaryWeapon: 'Longbow', selectedPet: 'Carrion Devourer' }
  );
  const rapidFire = result.steps.find((step) => step.skill === 'Rapid Fire');
  const pointBlankShot = result.steps.find((step) => step.skill === 'Point-Blank Shot');
  const poisonActions = result.events.filter(
    (event) => event.type === 'action' && event.skillId === ID.POISONOUS_CLOUD
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(rapidFire.start, 0);
  assert.equal(pointBlankShot.start, rapidFire.end);
  assert.equal(poisonActions.length, 2);
  assert.equal(poisonActions[1].at - poisonActions[0].at >= 29.999, true);
});

test('Ranger pet commands require Alacrity on the active pet', () => {
  const config = {
    selectedPet: 'Fanged Iboga',
    boons: { alacrity: true }
  };
  const playerAlacrity = simulate('Core', ['Narcotic Spores'], config);
  const petAlacrity = simulate('Core', ['"We Heal As One!"', 'Narcotic Spores'], config);
  const rechargeMs = (result) => {
    const step = result.steps.find((candidate) => candidate.skill === 'Narcotic Spores');

    return result.endState.cooldowns['Narcotic Spores'].readyAt - step.end;
  };

  assert.equal(rechargeMs(playerAlacrity), 15000);
  assert.equal(rechargeMs(petAlacrity), 12000);
  const petAlacrityApplication = petAlacrity.events.find(
    (event) => event.type === 'buff' && event.kind === 'alacrity' && event.resolvedAudience.includesSummons
  );

  assert.ok(petAlacrityApplication);
  assert.equal(petAlacrityApplication.resolvedAudience.companionIds.length, 1);
  assert.match(petAlacrityApplication.resolvedAudience.companionIds[0], /^ranger-pet:/);
});

test('Ranger party boons prioritize players before the active pet', () => {
  const simulateSunSpirit = (alliedPlayerCount) =>
    simulate('Core', ['Sun Spirit', { type: 'wait', durationMs: 6000 }], {
      selectedSkills: ['Sun Spirit'],
      selectedPet: 'Fanged Iboga',
      allies: { count: alliedPlayerCount, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    });
  const shared = simulateSunSpirit(2).events.find(
    (event) => event.type === 'buff' && event.skillName === 'Sun Spirit' && event.kind === 'might'
  );
  const capped = simulateSunSpirit(4).events.find(
    (event) => event.type === 'buff' && event.skillName === 'Sun Spirit' && event.kind === 'might'
  );

  assert.ok(shared);
  assert.equal(shared.resolvedAudience.alliedPlayerCount, 2);
  assert.equal(shared.resolvedAudience.companionIds.length, 1);
  assert.match(shared.resolvedAudience.companionIds[0], /^ranger-pet:/);
  assert.ok(capped);
  assert.equal(capped.resolvedAudience.alliedPlayerCount, 4);
  assert.deepEqual(capped.resolvedAudience.companionIds, []);
  assert.equal(capped.resolvedAudience.includesSummons, false);
});

test('Pack Alpha excludes unleashed-pet and Beastmode skill recharges', () => {
  const context = (skill) => ({
    skill,
    traits: new Set([TRAIT.PACK_ALPHA]),
    state: {
      time: 0,
      profession: { core: { quickDrawUntil: 0 } }
    }
  });
  const recharge = (skill) => rangerCoreCastRules.modifyRechargeDuration(context(skill), 10);

  assert.equal(recharge({ name: 'Pet skill', petSkill: true }), 8);
  const unleashedPetSkill = {
    name: 'Unleashed pet skill',
    petSkill: true,
    unleashedPetSkill: true
  };
  const beastmodeSkill = {
    name: 'Beastmode skill',
    petSkill: true,
    beastmodeSkill: true
  };

  assert.equal(untamedCastRules.modifyRechargeDuration(context(unleashedPetSkill), recharge(unleashedPetSkill)), 10);
  assert.equal(soulbeastCastRules.modifyRechargeDuration(context(beastmodeSkill), recharge(beastmodeSkill)), 10);
});

test("Pack Alpha improves only the Pig's five documented attributes", () => {
  const metadata = rangerPetCombatMetadata({
    config: { selectedTraitIds: [TRAIT.PACK_ALPHA] },
    state: {
      cooldowns: new Map(),
      profession: {
        core: { activePet: 'Pig', activePetSlot: 1, petAutoGeneration: 0 }
      }
    }
  });

  assert.deepEqual(
    {
      power: metadata.summonBasePower,
      precision: metadata.summonBasePrecision,
      toughness: metadata.summonBaseToughness,
      vitality: metadata.summonBaseVitality,
      conditionDamage: metadata.summonBaseConditionDamage,
      ferocity: metadata.summonBaseFerocity,
      expertise: metadata.summonBaseExpertise,
      healingPower: metadata.summonBaseHealingPower
    },
    {
      power: 1824,
      precision: 1480,
      toughness: 2511,
      vitality: 3885,
      conditionDamage: 1000,
      ferocity: 0,
      expertise: 0,
      healingPower: 600
    }
  );
});

test('Tiger uses its documented attributes and nominal Bite recharge', () => {
  const metadata = rangerPetCombatMetadata({
    config: {
      selectedTraitIds: [TRAIT.PACK_ALPHA],
      selectedSkills: ['Signet of the Wild']
    },
    state: {
      time: 0,
      cooldowns: new Map(),
      profession: {
        core: { activePet: 'Tiger', activePetSlot: 1, petAutoGeneration: 0 }
      }
    }
  });

  assert.deepEqual(
    {
      power: metadata.summonBasePower,
      precision: metadata.summonBasePrecision,
      toughness: metadata.summonBaseToughness,
      vitality: metadata.summonBaseVitality,
      ferocity: metadata.summonBaseFerocity,
      conditionDamage: metadata.summonBaseConditionDamage
    },
    {
      power: 1824,
      precision: 2511,
      toughness: 1824,
      vitality: 2511,
      ferocity: 180,
      conditionDamage: 1300
    }
  );

  const result = simulate('Core', ['__combat_start', { type: 'wait', durationMs: 30000 }], {
    selectedPet: 'Tiger',
    target: { health: 10000000 }
  });
  const biteTimes = result.resolvedEvents
    .filter((event) => event.type === 'damage' && event.skillId === ID.FELINE_BITE)
    .map((event) => event.at);

  assert.equal(biteTimes.length, 4);
  assert.equal(
    biteTimes.slice(1).every((at, index) => at - biteTimes[index] >= 8),
    true
  );
});

test('Ranger autonomous pet cooldowns use only pet Alacrity', () => {
  const config = {
    selectedPet: 'Carrion Devourer',
    boons: { alacrity: true },
    stats: { concentration: 1500 }
  };
  const baseline = simulate('Core', ['__combat_start', { type: 'wait', durationMs: 24000 }], config);
  const petAlacrity = simulate(
    'Core',
    ['"We Heal As One!"', '__combat_start', { type: 'wait', durationMs: 24000 }],
    config
  );
  const tailLashes = (result) =>
    result.events.filter(
      (event) => event.type === 'action' && event.skillId === ID.PET_TAIL_LASH && event.autonomousPetSkill
    ).length;

  assert.equal(tailLashes(baseline), 1);
  assert.equal(tailLashes(petAlacrity), 2);
});

test("Galeshot passive arrow recharge uses the player's Alacrity", () => {
  const rotation = [{ type: 'wait', durationMs: 4000 }];
  const baseline = simulate('Galeshot', rotation, {
    initialArrows: 0,
    boons: { alacrity: false }
  });
  const alacrity = simulate('Galeshot', rotation, {
    initialArrows: 0,
    boons: { alacrity: true }
  });

  assert.equal(baseline.endState.profession.arrows, 0);
  assert.equal(alacrity.endState.profession.arrows, 1);
});

test('Ranger palette groups the active pet, command, swap, and Dodge endurance', () => {
  const build = createRangerBuildDefaults();

  build.specializations = [];
  build.selectedPet = 'Carrion Devourer';
  build.selectedPet2 = 'Fanged Iboga';
  build.weapons = ['Longbow', ''];
  build.alternateWeapons = ['Axe', 'Axe'];
  const app = {
    build,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    skills: rangerCatalog.skills,
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    results: simulate('Core', [], {
      selectedPet: 'Carrion Devourer',
      selectedPet2: 'Fanged Iboga',
      primaryWeapon: 'Longbow',
      weaponSet2Primary: 'Axe',
      weaponSet2Secondary: 'Axe'
    })
  };
  const paletteElement = {
    innerHTML: '',
    querySelectorAll: () => []
  };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? paletteElement : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  const html = paletteElement.innerHTML;

  assert.equal((html.match(/data-skill-id="-4"/g) || []).length, 1);
  assert.ok(html.indexOf('Carrion Devourer') < html.indexOf('Poisonous Cloud'));
  assert.ok(html.indexOf('Poisonous Cloud') < html.indexOf('data-skill="Swap Pets"'));
  assert.match(html, /class="[^"]*pal-has-resource[^"]*" data-skill="Dodge"/);
  assert.match(html, /data-resource-id="endurance"/);
  assert.doesNotMatch(html, /class="active-resource" data-resource-id="endurance"/);
});

test("Core Ranger resolves Winter's Bite readiness events", () => {
  const result = simulate('Core', ["Winter's Bite"], {
    primaryWeapon: 'Axe'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.winterBiteReady, true);
});

test('Druid gates, drains, and releases Celestial Avatar', () => {
  const blocked = simulate('Druid', ['Natural Convergence'], {
    initialAstralForce: 100
  });

  assert.match(blocked.warnings[0], /enter Celestial Avatar/);

  const entered = simulate('Druid', ['Celestial Avatar']);

  assert.deepEqual(entered.warnings, []);
  assert.equal(entered.endState.profession.astralForce, 100);
  assert.equal(entered.endState.profession.celestialAvatarActive, true);
  assert.equal(entered.endState.profession.availableFlips[ID.RELEASE_CELESTIAL_AVATAR], 15);

  const draining = simulate('Druid', ['Celestial Avatar', { type: 'wait', durationMs: 5000 }]);

  assert.equal(draining.endState.profession.astralForce, 100 * (10 / 15));
  assert.equal(draining.endState.profession.celestialAvatarActive, true);
  assert.equal(
    rangerProfession.ui.paletteSkillAvailability(
      {
        specialization: 'Druid',
        professionState: draining.endState.profession
      },
      rangerCatalog.skillsById.get(ID.RELEASE_CELESTIAL_AVATAR)
    ).available,
    true
  );

  const result = simulate('Druid', ['Celestial Avatar', 'Natural Convergence', 'Release Celestial Avatar']);
  const naturalConvergenceDuration = rangerCatalog.skillsById.get(ID.NATURAL_CONVERGENCE).castTimeMs / 1000;

  assert.deepEqual(result.warnings, []);
  assert.ok(
    Math.abs(result.endState.profession.astralForce - 100 * ((15 - naturalConvergenceDuration) / 15) * 0.5) < 0.01
  );
  assert.equal(result.endState.profession.celestialAvatarActive, false);
  assert.equal(Object.hasOwn(result.endState.profession.availableFlips, ID.RELEASE_CELESTIAL_AVATAR), false);
  assert.equal(result.totalDamage > 0, true);
});

test("Soulbeast starts merged and grants only the selected pet's Beast skills", () => {
  const alreadyMerged = simulate('Soulbeast', ['Beastmode']);

  assert.match(alreadyMerged.warnings[0], /already active/);

  const blocked = simulate('Soulbeast', ['Smoke Assault']);

  assert.match(blocked.warnings[0], /select the pet that grants/);

  const result = simulate('Soulbeast', ['Smoke Assault'], {
    selectedPet: 'Smokescale'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.beastmodeActive, true);
  assert.equal(result.endState.profession.archetype, 'Ferocious');
  assert.equal(result.totalDamage > 0, true);

  const leftBeastmode = simulate('Soulbeast', ['Leave Beastmode', 'Smoke Assault'], { selectedPet: 'Smokescale' });

  assert.match(leftBeastmode.warnings[0], /enter Beastmode/);
  assert.equal(leftBeastmode.endState.profession.beastmodeActive, false);
});

test('Soulbeast owns merged pet suspension and restores the pet after leaving Beastmode', () => {
  const merged = simulate('Soulbeast', ['__combat_start', { type: 'wait', durationMs: 4000 }], {
    selectedPet: 'Carrion Devourer'
  });
  const unmerged = simulate('Soulbeast', ['__combat_start', 'Leave Beastmode', { type: 'wait', durationMs: 4000 }], {
    selectedPet: 'Carrion Devourer'
  });

  const autonomousPetActions = (result) =>
    result.events.filter(
      (event) => event.type === 'action' && event.actorType === 'summon' && event.autonomousPetSkill
    );

  assert.deepEqual(merged.warnings, []);
  assert.deepEqual(autonomousPetActions(merged), []);
  assert.equal(autonomousPetActions(unmerged).length > 0, true);

  const swapped = simulate('Soulbeast', ['Leave Beastmode', 'Swap Pets'], {
    selectedPet: 'Pig',
    selectedPet2: 'Smokescale'
  });

  assert.deepEqual(swapped.warnings, []);
  assert.equal(swapped.endState.profession.activePet, 'Smokescale');
  assert.equal(swapped.endState.profession.archetype, 'Ferocious');
});

test("Soulbeast applies Sic 'Em to the merged ranger and to the pet while unmerged", () => {
  const skillName = rangerCatalog.skillsById.get(ID.SIC_EM).name;
  const merged = simulate('Soulbeast', [skillName]);
  const unmerged = simulate('Soulbeast', ['Leave Beastmode', skillName]);

  assert.equal(
    merged.events.some((event) => event.type === 'buff' && event.kind === 'sic-em'),
    true
  );
  assert.equal(
    merged.events.some((event) => event.type === 'buff' && event.kind === 'sic-em-pet'),
    false
  );
  assert.equal(
    unmerged.events.some((event) => event.type === 'buff' && event.kind === 'sic-em'),
    false
  );
  assert.equal(
    unmerged.events.some((event) => event.type === 'buff' && event.kind === 'sic-em-pet'),
    true
  );
});

test('Poisonous Strikes follows Soulbeast pet ownership', () => {
  const daggerChain = ['Groundwork Gouge', 'Leading Swipe', 'Serpent Stab', 'Deadly Delivery'];
  const merged = simulate('Soulbeast', ['Double Arc', ...daggerChain], { primaryWeapon: 'Dagger' });
  const unmerged = simulate(
    'Soulbeast',
    ['Leave Beastmode', 'Double Arc', ...daggerChain, { type: 'wait', durationMs: 3000 }],
    { primaryWeapon: 'Dagger', selectedPet: 'Carrion Devourer' }
  );
  const procs = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Poisonous Strikes' && event.condition === 'Poisoned'
    );

  assert.equal(
    procs(merged).some((event) => event.source === 'ranger' && event.actorType === 'effect'),
    true
  );
  assert.equal(
    procs(unmerged).some((event) => event.source === 'ranger-pet' && event.actorType === 'summon'),
    true
  );
  assert.equal(
    procs(unmerged).some((event) => event.source === 'ranger'),
    false
  );
});

test('Soulbeast palette swaps between merged skills and the active pet', () => {
  const merged = simulate('Soulbeast', [], { selectedPet: 'Smokescale' });
  const unmerged = simulate('Soulbeast', ['Leave Beastmode'], {
    selectedPet: 'Smokescale'
  });
  const context = (professionState) => ({
    specialization: 'Soulbeast',
    config: { specialization: 'Soulbeast', selectedPet: 'Smokescale' },
    professionState
  });
  const availability = (professionState, skillId) =>
    rangerProfession.ui.paletteSkillAvailability(context(professionState), rangerCatalog.skillsById.get(skillId))
      .available;

  const mergedGroups = rangerProfession.ui.paletteGroups(context(merged.endState.profession));

  assert.deepEqual(
    mergedGroups.map((group) => group.id),
    ['ranger-soulbeast-profession']
  );
  assert.deepEqual(mergedGroups[0].skillIds, [
    ID.BEASTMODE,
    ID.LEAVE_BEASTMODE,
    ...RANGER_PETS.find((pet) => pet.name === 'Smokescale').beastmodeSkillIds
  ]);
  assert.equal(availability(merged.endState.profession, ID.BEASTMODE), false);
  assert.equal(availability(merged.endState.profession, ID.LEAVE_BEASTMODE), true);

  const unmergedGroups = rangerProfession.ui.paletteGroups(context(unmerged.endState.profession));

  assert.deepEqual(
    unmergedGroups.map((group) => group.id),
    ['ranger-soulbeast-profession', 'ranger-pet']
  );
  assert.deepEqual(unmergedGroups[0].skillIds, [ID.BEASTMODE, ID.LEAVE_BEASTMODE]);
  assert.deepEqual(unmergedGroups[1].skillIds, [ID.SMOKE_CLOUD, ID.PET_SWAP]);
  assert.equal(unmergedGroups[1].statusIcon.label, 'Smokescale');
  assert.equal(availability(unmerged.endState.profession, ID.BEASTMODE), true);
  assert.equal(availability(unmerged.endState.profession, ID.LEAVE_BEASTMODE), false);

  const actionApp = {
    skills: [...rangerCatalog.skills],
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    build: { ...createRangerBuildDefaults(), rotation: [] },
    results: { endState: { profession: merged.endState.profession } }
  };

  assert.equal(
    paletteActionSkills(actionApp, 'Soulbeast').some((skill) => skill.id === ID.PET_SWAP),
    false
  );
  actionApp.results.endState.profession = unmerged.endState.profession;
  assert.equal(
    paletteActionSkills(actionApp, 'Soulbeast').some((skill) => skill.id === ID.PET_SWAP),
    true
  );
});

test('Ranger transformation availability follows skill IDs after display labels change', () => {
  const check = (kind, state, skill, availability) =>
    availability(
      {
        config: { specialization: kind, selectedPet: 'Lynx' },
        state: { profession: { specialization: { kind, state } } },
        start: 0,
        epsilon: 1e-9
      },
      skill
    );

  const soulbeast = createSoulbeastState();
  const beastmode = { ...rangerCatalog.skillsById.get(ID.BEASTMODE), name: 'Renamed Beastmode' };
  assert.equal(
    check('Soulbeast', soulbeast, beastmode, soulbeastCastRules.availability.handler).code,
    'ranger.beastmode-active'
  );

  const druid = createDruidState({ initialAstralForce: 100 });
  druid.celestialAvatarActive = true;
  const avatar = { ...rangerCatalog.skillsById.get(ID.CELESTIAL_AVATAR), name: 'Renamed Celestial Avatar' };
  assert.equal(check('Druid', druid, avatar, druidCastAvailability).code, 'ranger.avatar-active');

  const untamed = createUntamedState({ initialUntamedState: 'Ranger' });
  const unleash = { ...rangerCatalog.skillsById.get(ID.UNLEASH_RANGER), name: 'Renamed Unleash Ranger' };
  assert.equal(
    check('Untamed', untamed, unleash, untamedCastRules.availability.handler).code,
    'ranger.ranger-unleashed'
  );
});

test('Hammer variants are selected for every Ranger specialization', () => {
  const blocked = simulate('Untamed', ['Unleashed Wild Swing'], {
    primaryWeapon: 'Hammer'
  });

  assert.match(blocked.warnings[0], /select this Hammer variant/);

  const result = simulate('Untamed', ['Unleash Ranger', 'Unleashed Wild Swing', 'Unleash Pet'], {
    primaryWeapon: 'Hammer',
    selectedHammerSkillIds: [ID.UNLEASHED_WILD_SWING, ID.OVERBEARING_SMASH, ID.SAVAGE_SHOCK_WAVE, ID.THUMP]
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.rangerUnleashed, false);
  assert.equal(result.endState.profession.ambushReadyUntil > 0, true);
  assert.equal(result.totalDamage > 0, true);

  const standardWhileUnleashed = simulate('Untamed', ['Unleash Ranger', 'Wild Swing'], { primaryWeapon: 'Hammer' });

  assert.deepEqual(standardWhileUnleashed.warnings, []);

  const druidBlocked = simulate('Druid', ['Unleashed Wild Swing'], {
    primaryWeapon: 'Hammer'
  });

  assert.match(druidBlocked.warnings[0], /select this Hammer variant/);
  const druidSelected = simulate('Druid', ['Unleashed Wild Swing'], {
    primaryWeapon: 'Hammer',
    selectedHammerSkillIds: [ID.UNLEASHED_WILD_SWING, ID.OVERBEARING_SMASH, ID.SAVAGE_SHOCK_WAVE, ID.THUMP]
  });

  assert.deepEqual(druidSelected.warnings, []);
});

test('Ranger Hammer autoattacks advance their palette chain', () => {
  const config = {
    primaryWeapon: 'Hammer',
    selectedHammerSkillIds: [
      ID.UNLEASHED_WILD_SWING,
      ID.OVERBEARING_SMASH,
      ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
      ID.UNLEASHED_THUMP
    ]
  };
  const afterStrike = simulate('Soulbeast', ['Hammer Strike'], config);
  const afterSlam = simulate('Soulbeast', ['Hammer Strike', 'Hammer Slam'], config);
  const afterSmash = simulate('Soulbeast', ['Hammer Strike', 'Hammer Slam', 'Heavy Smash'], config);

  assert.equal(afterStrike.endState.profession.autoattackChains[ID.HAMMER_STRIKE], ID.HAMMER_SLAM);
  assert.equal(afterSlam.endState.profession.autoattackChains[ID.HAMMER_STRIKE], ID.HEAVY_SMASH);
  assert.equal(afterSmash.endState.profession.autoattackChains[ID.HAMMER_STRIKE], undefined);

  const build = {
    ...createRangerBuildDefaults(),
    weapons: ['Hammer', ''],
    selectedHammerSkillIds: config.selectedHammerSkillIds
  };
  const app = {
    build,
    skills: [...rangerCatalog.skills],
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    results: afterStrike
  };

  assert.equal(currentAutoattackSkill(app).id, ID.HAMMER_SLAM);
  app.results = afterSlam;
  assert.equal(currentAutoattackSkill(app).id, ID.HEAVY_SMASH);
  app.results = afterSmash;
  assert.equal(currentAutoattackSkill(app).id, ID.HAMMER_STRIKE);
});

test('Ranger rejects out-of-order autoattack chain steps', () => {
  const result = simulate('Soulbeast', ['Hammer Slam', 'Hammer Strike', 'Heavy Smash'], {
    primaryWeapon: 'Hammer',
    selectedHammerSkillIds: [
      ID.UNLEASHED_WILD_SWING,
      ID.OVERBEARING_SMASH,
      ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
      ID.UNLEASHED_THUMP
    ]
  });

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Hammer Strike']
  );
  assert.match(result.warnings.join(' '), /cast Hammer Strike first/);
  assert.match(result.warnings.join(' '), /cast Hammer Slam first/);
});

test('Power Soulbeast EVTC damage cutoffs preserve interrupted packets', () => {
  const hammerConfig = {
    primaryWeapon: 'Hammer',
    selectedHammerSkillIds: [
      ID.UNLEASHED_WILD_SWING,
      ID.OVERBEARING_SMASH,
      ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
      ID.UNLEASHED_THUMP
    ]
  };
  const cases = [
    { skillId: ID.FROST_TRAP, cutoffMs: 440, prefix: [], config: {} },
    { skillId: ID.RICOCHET, cutoffMs: 320, prefix: [], config: { primaryWeapon: 'Axe' } },
    { skillId: ID.SPLITBLADE, cutoffMs: 480, prefix: [], config: { primaryWeapon: 'Axe' } },
    { skillId: ID.WINTERS_BITE, cutoffMs: 360, prefix: [], config: { primaryWeapon: 'Axe' } },
    {
      skillId: ID.PATH_OF_SCARS,
      cutoffMs: 360,
      prefix: [],
      config: { primaryWeapon: 'Axe', secondaryWeapon: 'Axe' }
    },
    {
      skillId: ID.PATH_OF_SCARS_MAX_RANGE,
      cutoffMs: 360,
      prefix: [],
      config: { primaryWeapon: 'Axe', secondaryWeapon: 'Axe' }
    },
    { skillId: ID.HAMMER_STRIKE, cutoffMs: 360, prefix: [], config: hammerConfig },
    { skillId: ID.UNLEASHED_SAVAGE_SHOCK_WAVE, cutoffMs: 520, prefix: [], config: hammerConfig },
    { skillId: ID.UNLEASHED_THUMP, cutoffMs: 800, prefix: [], config: hammerConfig },
    { skillId: ID.HAMMER_SLAM, cutoffMs: 320, prefix: [ID.HAMMER_STRIKE], config: hammerConfig },
    {
      skillId: ID.UNLEASHED_WILD_SWING,
      cutoffMs: 400,
      prefix: [],
      config: hammerConfig
    },
    {
      skillId: ID.HEAVY_SMASH,
      cutoffMs: 320,
      prefix: [ID.HAMMER_STRIKE, ID.HAMMER_SLAM],
      config: hammerConfig
    },
    { skillId: ID.OVERBEARING_SMASH, cutoffMs: 240, prefix: [], config: hammerConfig },
    { skillId: ID.WORLDLY_IMPACT, cutoffMs: 520, prefix: [], config: { selectedPet: 'Pig' } },
    { skillId: ID.MAUL_ID_41406, cutoffMs: 400, prefix: [], config: { selectedPet: 'Pig' } }
  ];

  for (const { skillId, cutoffMs, prefix, config } of cases) {
    const skill = rangerCatalog.skillsById.get(skillId);
    const damageCount = (interruptMs) =>
      simulate(
        'Soulbeast',
        [...prefix, { name: skill.name, skillId, interruptMs }, { type: 'wait', durationMs: 6000 }],
        config
      ).events.filter((event) => event.type === 'damage' && event.skillId === skillId).length;

    assert.equal(skill.interruptCommitMs, cutoffMs, skill.name);
    assert.equal(damageCount(cutoffMs - 1), 0, `${skill.name} before commit`);
    assert.ok(damageCount(cutoffMs) > 0, `${skill.name} at commit`);
  }
});

test('Selected unleashed Hammer skills remain castable after Overbearing Smash', () => {
  const selectedHammerSkillIds = [
    ID.UNLEASHED_WILD_SWING,
    ID.OVERBEARING_SMASH,
    ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
    ID.UNLEASHED_THUMP
  ];
  const result = simulate('Soulbeast', ['Overbearing Smash'], {
    primaryWeapon: 'Hammer',
    selectedHammerSkillIds
  });
  const build = {
    ...createRangerBuildDefaults(),
    weapons: ['Hammer', ''],
    selectedHammerSkillIds
  };
  const app = {
    build,
    skills: [...rangerCatalog.skills],
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    results: result
  };
  const availableIds = new Set(weaponSkills(app, 1).map((skill) => skill.id));

  for (const skillId of [ID.UNLEASHED_WILD_SWING, ID.UNLEASHED_SAVAGE_SHOCK_WAVE, ID.UNLEASHED_THUMP]) {
    assert.equal(availableIds.has(skillId), true);
    assert.deepEqual(
      rangerProfession.ui.paletteSkillAvailability(
        {
          build,
          specialization: 'Soulbeast',
          professionState: result.endState.profession,
          time: result.durationMs / 1000
        },
        rangerCatalog.skillsById.get(skillId)
      ),
      { available: true, message: '' }
    );
  }

  const paletteElement = {
    innerHTML: '',
    querySelectorAll: () => []
  };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? paletteElement : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  for (const skillId of [ID.UNLEASHED_WILD_SWING, ID.UNLEASHED_SAVAGE_SHOCK_WAVE, ID.UNLEASHED_THUMP]) {
    const skill = rangerCatalog.skillsById.get(skillId);

    assert.equal(skill.paletteFlip, false);
    const markup = paletteElement.innerHTML.match(
      new RegExp(`<div class="([^"]*)" data-skill="${skill.name}"\\s+data-skill-id="${skill.id}"[^>]*>`)
    );

    assert.ok(markup, `${skill.name} should be rendered`);
    assert.doesNotMatch(markup[1], /pal-context-disabled/);
    assert.match(markup[0], /draggable="true"/);
  }
});

test('Untamed starts in the selected unleashed state', () => {
  const pet = simulate('Untamed', [], { initialUntamedState: 'Pet' });
  const ranger = simulate('Untamed', [], { initialUntamedState: 'Ranger' });

  assert.equal(pet.endState.profession.rangerUnleashed, false);
  assert.equal(ranger.endState.profession.rangerUnleashed, true);

  const availability = (professionState, skillId) =>
    rangerProfession.ui.paletteSkillAvailability(
      { specialization: 'Untamed', professionState },
      rangerCatalog.skillsById.get(skillId)
    ).available;

  assert.equal(availability(pet.endState.profession, ID.UNLEASH_RANGER), true);
  assert.equal(availability(pet.endState.profession, ID.UNLEASH_PET), false);
  assert.equal(availability(ranger.endState.profession, ID.UNLEASH_RANGER), false);
  assert.equal(availability(ranger.endState.profession, ID.UNLEASH_PET), true);
});

test('Untamed Unleash forms share a fixed one-second recharge', () => {
  const result = simulate('Untamed', ['Unleash Pet', 'Unleash Ranger'], {
    initialUntamedState: 'Ranger',
    boons: { alacrity: true }
  });
  const unleashSteps = result.steps.filter((step) => ['Unleash Pet', 'Unleash Ranger'].includes(step.skill));
  const unleashActions = result.events.filter(
    (event) => event.type === 'action' && [ID.UNLEASH_PET, ID.UNLEASH_RANGER].includes(event.skillId)
  );

  assert.deepEqual(
    unleashSteps.map(({ skill, start }) => ({ skill, start })),
    [
      { skill: 'Unleash Pet', start: 0 },
      { skill: 'Unleash Ranger', start: 1000 }
    ]
  );
  assert.deepEqual(
    unleashActions.map((event) => event.rechargeReadyAt - event.at),
    [1, 1]
  );
  assert.equal(result.endState.profession.ambushReadyUntil, 5);

  const suppressed = simulate('Untamed', ['Unleash Pet', 'Unleash Ranger', 'Unleash Pet', 'Unleash Ranger'], {
    initialUntamedState: 'Ranger'
  });

  assert.equal(suppressed.endState.profession.ambushReadyUntil, 5);

  const refreshed = simulate(
    'Untamed',
    ['Unleash Pet', 'Unleash Ranger', 'Unleash Pet', { type: 'wait', durationMs: 8001 }, 'Unleash Ranger'],
    { initialUntamedState: 'Ranger' }
  );

  assert.equal(refreshed.endState.profession.ambushReadyUntil, 14.001);
});

test('Untamed ambush skills require the specialization and an active unleash proc', () => {
  const relentlessWhirl = rangerCatalog.skillsById.get(ID.RELENTLESS_WHIRL);

  for (const specialization of ['Core', 'Druid', 'Soulbeast', 'Galeshot']) {
    assert.equal(
      rangerAppAdapter.isSkillAvailable(relentlessWhirl, { specialization }),
      false,
      `${specialization} should not have Relentless Whirl`
    );
  }

  assert.equal(
    rangerAppAdapter.isSkillAvailable(relentlessWhirl, {
      specialization: 'Untamed'
    }),
    true
  );

  const availability = (professionState, time = 0) =>
    rangerProfession.ui.paletteSkillAvailability({ specialization: 'Untamed', professionState, time }, relentlessWhirl);

  assert.deepEqual(availability({ rangerUnleashed: false, ambushReadyUntil: 4 }), {
    available: false,
    message: 'Unleash Ranger first'
  });
  assert.deepEqual(availability({ rangerUnleashed: true }), {
    available: false,
    message: 'Unleash to make an ambush available'
  });
  assert.deepEqual(availability({ rangerUnleashed: true, ambushReadyUntil: 4 }, 3.9), { available: true, message: '' });
  assert.deepEqual(availability({ rangerUnleashed: true, ambushReadyUntil: 4 }, 4), {
    available: false,
    message: 'Unleash to make an ambush available'
  });

  assert.match(
    simulate('Untamed', ['Relentless Whirl'], {
      primaryWeapon: 'Hammer'
    }).warnings[0],
    /Unleash Ranger first/
  );
  assert.deepEqual(
    simulate('Untamed', ['Unleash Ranger', 'Relentless Whirl'], {
      primaryWeapon: 'Hammer'
    }).warnings,
    []
  );

  const build = {
    ...createRangerBuildDefaults(),
    weapons: ['Hammer', ''],
    alternateWeapons: ['', ''],
    specializations: [
      { name: 'Skirmishing', traits: '1-2-3' },
      { name: 'Beastmastery', traits: '3-3-3' },
      { name: 'Untamed', traits: '1-1-1' }
    ],
    initialUntamedState: 'Pet'
  };
  const app = {
    build,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    skills: rangerCatalog.skills,
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    weaponData: rangerAppAdapter.weaponData,
    results: null
  };
  const paletteNamesAfter = (rotation) => {
    app.results = simulate('Untamed', rotation, {
      initialUntamedState: 'Pet',
      primaryWeapon: 'Hammer',
      weaponSet2Primary: '',
      weaponSet2Secondary: ''
    });

    return weaponPaletteRows(app, 1)[0].skills.map((skill) => skill.name);
  };

  const ordinary = paletteNamesAfter([]);

  assert.ok(ordinary.includes('Hammer Strike'));
  assert.equal(ordinary.includes('Relentless Whirl'), false);

  const unleashed = paletteNamesAfter(['Unleash Ranger']);

  assert.ok(unleashed.includes('Relentless Whirl'));
  assert.equal(unleashed.includes('Hammer Strike'), false);
});

test('Greatsword Counterattack flips to Counterattack Kick and restores its tile', () => {
  const build = {
    ...createRangerBuildDefaults(),
    weapons: ['Greatsword', ''],
    alternateWeapons: ['', ''],
    specializations: [
      { name: 'Skirmishing', traits: '1-1-1' },
      { name: 'Beastmastery', traits: '1-1-1' },
      { name: 'Wilderness Survival', traits: '1-1-1' }
    ]
  };
  const app = {
    build,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    skills: rangerCatalog.skills,
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    weaponData: rangerAppAdapter.weaponData,
    results: null
  };
  const paletteAfter = (rotation) => {
    app.results = simulate('Core', rotation, {
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      weaponSet2Primary: '',
      weaponSet2Secondary: ''
    });

    return weaponPaletteRows(app, 1)[0].skills.map((skill) => skill.name);
  };

  assert.match(
    simulate('Core', ['Counterattack Kick'], {
      primaryWeapon: 'Greatsword',
      secondaryWeapon: ''
    }).warnings.join(' '),
    /use Counterattack first/
  );
  assert.ok(paletteAfter([]).includes('Counterattack'));
  assert.ok(paletteAfter(['Counterattack']).includes('Counterattack Kick'));
  assert.ok(paletteAfter(['Counterattack', 'Counterattack Kick']).includes('Counterattack'));
});

test("Panther's Prowl replaces all four Ranger spear stealth-attack slots", () => {
  const build = {
    ...createRangerBuildDefaults(),
    weapons: ['Spear', ''],
    alternateWeapons: ['', ''],
    specializations: [
      { name: 'Skirmishing', traits: '1-1-1' },
      { name: 'Beastmastery', traits: '1-1-1' },
      { name: 'Wilderness Survival', traits: '1-1-1' }
    ]
  };
  const app = {
    build,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    skills: rangerCatalog.skills,
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    weaponData: rangerAppAdapter.weaponData,
    results: null
  };
  const paletteAfter = (rotation) => {
    app.results = simulate('Core', rotation, {
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      weaponSet2Primary: '',
      weaponSet2Secondary: ''
    });

    return weaponPaletteRows(app, 1)[0].skills.map((skill) => skill.name);
  };

  const ordinary = ["Mongoose's Frenzy", "Falcon's Stoop", "Warclaw's Engage", "Panther's Prowl"];
  const stealth = ["Wolf's Onslaught", "Owl's Flight", "Predator's Ambush", "Spider's Web"];

  assert.match(
    simulate('Core', ["Wolf's Onslaught"], {
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    }).warnings.join(' '),
    /use Mongoose's Frenzy first/
  );
  assert.ok(ordinary.every((name) => paletteAfter([]).includes(name)));
  assert.ok(stealth.every((name) => paletteAfter(["Panther's Prowl"]).includes(name)));
  assert.ok(ordinary.every((name) => !paletteAfter(["Panther's Prowl"]).includes(name)));

  const consumed = paletteAfter(["Panther's Prowl", "Wolf's Onslaught"]);

  assert.ok(ordinary.every((name) => consumed.includes(name)));
  assert.ok(stealth.every((name) => !consumed.includes(name)));
});
