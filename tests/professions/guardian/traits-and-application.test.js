import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfession } from '#gw2/app/profession/registry.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild
} from '#gw2/professions/guardian/build/build.js';
import { applyGuardianBuildAttributeRules } from '#gw2/professions/guardian/build/attributes.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { guardianAppAdapter } from '#gw2/professions/guardian/app/app-definition.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';

// Attribute assertions use the same calculator composed into the Guardian adapter.
const calculateGuardianAttributes = createCalculateAttributes(applyGuardianBuildAttributeRules);

const config = {
  stats: {
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000
  },
  target: { armor: 2597 }
};

test('Zeal symbol traits emit their full profiles and stack damage', () => {
  const symbols = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice', { type: 'wait', durationMs: 5000 }],
    config: {
      ...config,
      boons: { fury: true },
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
        GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
        GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE
      ]
    }
  });
  const zealotsResolution = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike', { type: 'wait', durationMs: 5000 }],
    config: {
      ...config,
      target: { ...config.target, health: 2500 },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION]
    }
  });
  const blades = symbols.resolvedEvents.filter((event) => event.name === 'Lesser Symbol of Blades');
  const resolution = zealotsResolution.resolvedEvents.filter((event) => event.name === 'Lesser Symbol of Resolution');

  assert.equal(blades.length, 5);
  assert.equal(
    blades.every((event) => event.coefficient === 0.65),
    true
  );
  assert.equal(
    blades.every((event) => event.skillWeapon === 'Unequipped'),
    true
  );
  assert.equal(symbols.endState.profession.symbolicAvengerStacks, 5);
  assert.ok(blades.at(-1).damage > blades[0].damage);
  assert.equal(
    symbols.events.filter(
      (event) =>
        event.type === 'condition' && event.condition === 'Vulnerability' && event.skillName === 'Symbolic Exposure'
    ).length,
    5
  );
  assert.equal(resolution.length, 5);
  assert.equal(
    resolution.every((event) => event.coefficient === 0.5),
    true
  );
  assert.equal(
    resolution.every((event) => event.skillWeapon === 'Unequipped'),
    true
  );
  assert.equal(zealotsResolution.endState.profession.zealotsResolutionReadyAt, resolution[0].at + 30);
});

test('Furious Focus uses a separate stochastic weapon-strength activation from its triggering virtue', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Spear of Justice', { type: 'wait', durationMs: 5000 }],
    config: {
      ...config,
      specialization: 'Dragonhunter',
      primaryWeapon: 'Spear',
      boons: { fury: true },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS],
      randomness: { mode: 'stochastic', seed: 1 }
    }
  });
  const virtue = result.resolvedEvents.find((event) => event.name === 'Spear of Justice' && event.type === 'damage');
  const symbol = result.resolvedEvents.filter(
    (event) => event.name === 'Lesser Symbol of Blades' && event.type === 'damage'
  );

  assert.equal(virtue.weaponStrengthProfileId, 'weapon.spear');
  assert.equal(symbol.length, 5);
  assert.notEqual(symbol[0].activationId, virtue.activationId);
  assert.equal(new Set(symbol.map((event) => event.activationId)).size, 1);
  assert.equal(
    symbol.every((event) => event.weaponStrengthProfileId === 'nonweapon.unequipped'),
    true
  );
});

test('resolution traits affect strike damage, critical chance, and might', () => {
  const run = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Symbol of Resolution', { type: 'wait', durationMs: 6000 }],
      config: {
        ...config,
        primaryWeapon: 'Greatsword',
        selectedTraitIds
      }
    });
  const righteous = run([GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS]);
  const retribution = run([GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS, GUARDIAN_TRAIT_IDS.RETRIBUTION]);
  const first = (result) => result.resolvedEvents.find((event) => event.name === 'Symbol of Resolution — Initial');
  const pulses = retribution.resolvedEvents.filter((event) => event.name === 'Symbol of Resolution');

  assert.ok(Math.abs(first(retribution).damage / first(righteous).damage - 1.1) < 1e-9);
  assert.ok(
    Math.abs(
      first(retribution).criticalChance -
        0.25 -
        (config.stats.precision > 895 ? (config.stats.precision - 895) / 2100 : 0)
    ) < 1e-9
  );
  assert.equal(
    pulses.every((event, index) => index === 0 || event.damage > pulses[index - 1].damage),
    true
  );
  assert.deepEqual(
    retribution.procSteps.filter((step) => step.skill === 'Righteous Instincts').map((step) => step.start),
    [200, 1200, 2200, 3200, 4200, 5200]
  );
});

test('Guardian build attributes expose static Zeal and Radiance bonuses', () => {
  const build = createGuardianBuildDefaults();

  build.weapons = ['Greatsword', ''];
  build.specializations = [
    { name: 'Zeal', traits: '2-2-3' },
    { name: 'Radiance', traits: '2-3-3' },
    { name: 'Luminary', traits: '3-3-2' }
  ];
  const all = calculateGuardianAttributes(build, []).attributes;
  const withoutBlade = calculateGuardianAttributes(build, [], 1, 'Zealous Blade').attributes;
  const withoutPower = calculateGuardianAttributes(build, [], 1, 'Radiant Power').attributes;
  const withoutRightHand = calculateGuardianAttributes(build, [], 1, 'Right-Hand Strength').attributes;

  assert.equal(all.Power.final - withoutBlade.Power.final, 240);
  assert.equal(all.Ferocity.final - withoutPower.Ferocity.final, 150);
  assert.equal(all.Precision.final - withoutRightHand.Precision.final, 80);
  assert.equal(all.Power.final - withoutRightHand.Power.final, 0);

  build.weapons = ['Sword', 'Focus'];
  const oneHanded = calculateGuardianAttributes(build, []).attributes;
  const oneHandedWithout = calculateGuardianAttributes(build, [], 1, 'Right-Hand Strength').attributes;

  assert.equal(oneHanded.Power.final - oneHandedWithout.Power.final, 80);

  build.specializations[1] = { name: 'Radiance', traits: '2-2-3' };
  const radiantFire = calculateGuardianAttributes(build, []).attributes;
  const withoutRadiantFire = calculateGuardianAttributes(build, [], 1, 'Radiant Fire').attributes;

  assert.equal(radiantFire['Burning Duration'].traits, 20);
  assert.equal(radiantFire['Burning Duration'].final, 20);
  assert.equal(withoutRadiantFire['Burning Duration'], undefined);

  const app = {
    build,
    skillByName: guardianCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  guardianAppAdapter.recalculate(app);
  assert.equal(guardianAppAdapter.simulationConfig(app).stats.conditionDurationBonuses.Burning, 20);
});

test('Dragonhunter virtues apply tether, passive aegis, and virtue traits', () => {
  const selectedTraitIds = [
    GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
    GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
    GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER,
    GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
    GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER
  ];
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Spear of Justice', 'Helio Rush', { type: 'wait', durationMs: 13000 }],
    config: {
      ...config,
      specialization: 'Dragonhunter',
      primaryWeapon: 'Spear',
      boons: { quickness: true },
      selectedTraitIds
    }
  });
  const activeBurning = result.resolvedEvents.filter((event) => event.name === 'Spear of Justice — Active Burning');
  const spearStrike = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Spear of Justice'
  );
  const buffs = result.events.filter((event) => event.type === 'buff');

  assert.deepEqual(result.warnings, []);
  assert.equal(spearStrike.coefficient, 0.8);
  assert.equal(activeBurning.length, 12);
  assert.equal(
    activeBurning.every((event) => event.duration === 2),
    true
  );
  assert.equal(result.endState.profession.tetherUntil, 12.56);
  assert.equal(result.endState.profession.availableFlips[GUARDIAN_SKILL_IDS.HUNTERS_VERDICT], 12.56);
  assert.equal(
    buffs.some((event) => event.kind === 'aegis' && event.skillName === 'Shield of Courage' && event.duration === 20),
    true
  );
  assert.equal(
    buffs.some((event) => event.kind === 'might' && event.stacks === 3 && event.duration === 5),
    true
  );
  assert.equal(
    buffs.some((event) => event.kind === 'resolution' && event.duration === 3.75),
    true
  );
  assert.equal(
    buffs.some((event) => event.kind === 'resolution' && event.skillName === 'Helio Rush' && event.duration === 5),
    true
  );
  assert.equal(
    buffs.some((event) => event.kind === 'guardian-inspiring-virtue' && event.duration === 6),
    true
  );

  const verdict = simulateGw2({
    profession: guardianProfession,
    rotation: ['Spear of Justice', "Hunter's Verdict", { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      specialization: 'Dragonhunter',
      primaryWeapon: 'Spear',
      boons: { quickness: true },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER]
    }
  });

  assert.deepEqual(verdict.warnings, []);
  assert.equal(verdict.resolvedEvents.filter((event) => event.name === 'Spear of Justice — Active Burning').length, 1);
  assert.equal(
    verdict.events.some(
      (event) => event.type === 'control' && event.skillName === "Hunter's Verdict" && event.controlKind === 'pull'
    ),
    true
  );

  const courage = simulateGw2({
    profession: guardianProfession,
    rotation: ['Shield of Courage'],
    config: {
      ...config,
      specialization: 'Dragonhunter',
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
        GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
        GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE
      ]
    }
  });

  assert.equal(
    courage.events.some((event) => event.type === 'buff' && event.kind === 'protection'),
    true
  );
  assert.equal(
    courage.events.some(
      (event) => event.type === 'buff' && event.kind === 'stability' && event.stacks === 3 && event.duration === 4
    ),
    true
  );

  const soaring = simulateGw2({
    profession: guardianProfession,
    rotation: ['Wings of Resolve'],
    config: {
      ...config,
      specialization: 'Dragonhunter',
      primaryWeapon: 'Spear',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOARING_DEVASTATION]
    }
  });

  assert.equal(
    soaring.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Wings of Resolve' && event.coefficient === 1.5
    ),
    true
  );
  assert.equal(
    soaring.resolvedEvents.some((event) => event.condition === 'Immobilized' && event.duration === 3),
    true
  );
});

test('Relic of Fireworks triggers on Dragonhunter virtues', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Spear of Justice', { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      specialization: 'Dragonhunter',
      primaryWeapon: 'Spear',
      relic: 'Fireworks'
    }
  });
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');

  assert.ok(procs.length > 0);
  assert.ok(procs.every((step) => step.sourceSkill === 'Spear of Justice'));
});

test('Dragonhunter traps and control traits apply their complete effects', () => {
  const trap = simulateGw2({
    profession: guardianProfession,
    rotation: ['Procession of Blades', { type: 'wait', durationMs: 5000 }],
    config: {
      ...config,
      specialization: 'Dragonhunter',
      relic: 'Dragonhunter',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.HUNTERS_PREMONITION]
    }
  });

  assert.equal(trap.procSteps.filter((step) => step.skill === 'Relic of the Dragonhunter').length, 10);
  assert.equal(
    trap.events.some(
      (event) =>
        event.type === 'buff' &&
        event.kind === 'aegis' &&
        event.skillName === 'Procession of Blades' &&
        event.duration === 3
    ),
    true
  );

  const maw = simulateGw2({
    profession: guardianProfession,
    rotation: ["Dragon's Maw", { type: 'wait', durationMs: 1500 }],
    config: {
      ...config,
      target: { ...config.target, defiant: true },
      specialization: 'Dragonhunter',
      initialEndurance: 0,
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.DULLED_SENSES,
        GUARDIAN_TRAIT_IDS.HEAVY_LIGHT,
        GUARDIAN_TRAIT_IDS.HUNTERS_DETERMINATION
      ]
    }
  });
  const mawStrike = maw.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === "Dragon's Maw");

  assert.deepEqual(maw.warnings, []);
  assert.equal(mawStrike.coefficient, 3.6);
  assert.equal(
    maw.resolvedEvents.some((event) => event.condition === 'Slow' && event.duration === 4),
    true
  );
  assert.equal(
    maw.resolvedEvents.some((event) => event.condition === 'Crippled' && event.duration === 4),
    true
  );
  assert.equal(
    maw.events.some(
      (event) => event.type === 'buff' && event.kind === 'might' && event.stacks === 10 && event.duration === 8
    ),
    true
  );
  assert.equal(
    maw.procSteps.some((step) => step.skill === 'Heavy Light'),
    true
  );
  assert.equal(
    maw.procSteps.some((step) => step.skill === "Hunter's Determination"),
    true
  );
  assert.equal(maw.endState.profession.endurance, 100);
});

test('Glacial Heart and Master of Consecrations replace their numeric effects', () => {
  const glacial = simulateGw2({
    profession: guardianProfession,
    rotation: ['Glacial Blow'],
    config: {
      ...config,
      primaryWeapon: 'Hammer',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.GLACIAL_HEART]
    }
  });
  const purging = simulateGw2({
    profession: guardianProfession,
    rotation: ['Purging Flames', { type: 'wait', durationMs: 9000 }],
    config: {
      ...config,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS]
    }
  });

  assert.deepEqual(glacial.warnings, []);
  assert.equal(
    glacial.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Glacial Blow' && event.coefficient === 2.5
    ),
    true
  );
  assert.equal(
    glacial.resolvedEvents.some((event) => event.type === 'combo' && event.skillName === 'Glacial Blow'),
    false
  );
  assert.equal(
    glacial.resolvedEvents.some((event) => event.condition === 'Chilled' && event.duration === 2.5),
    true
  );
  assert.equal(
    purging.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Purging Flames').length,
    8
  );
  assert.deepEqual(
    purging.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Purging Flames')
      .map((event) => Math.round(event.at * 1000)),
    [320, 1320, 2320, 3320, 4320, 5320, 6320, 7320]
  );
  const purgingAction = purging.events.find((event) => event.type === 'action' && event.skillName === 'Purging Flames');

  assert.equal(purgingAction.comboFields[0].fieldType, 'Fire');
  assert.equal(purgingAction.comboFields[0].duration, 7);
});

test('Luminary UI excludes virtue aliases and lists the forge exit once', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice', 'Enter Radiant Forge'],
    config: { ...config, specialization: 'Luminary' }
  });
  const professionSkillIds = guardianProfession.ui.paletteGroups({
    specialization: 'Luminary',
    professionState: result.endState.profession
  })[0].skillIds;
  const professionSkillNames = professionSkillIds.map((id) => guardianCatalog.skillsById.get(id)?.name);

  assert.equal(result.endState.profession.availableFlips[GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE], undefined);
  assert.equal(professionSkillNames.includes('Spear of Justice'), false);
  assert.equal(professionSkillNames.filter((name) => name === 'Exit Radiant Forge').length, 1);
});

test('elite specializations expose their profession mechanics', () => {
  const spear = guardianCatalog.skillsByName.get('Spear of Justice');
  const verdict = guardianCatalog.skillsByName.get("Hunter's Verdict");
  const dragonhunter = guardianProfession.ui.paletteGroups({
    specialization: 'Dragonhunter'
  })[0].skillIds;
  const firebrand = guardianProfession.ui
    .paletteGroups({
      specialization: 'Firebrand',
      professionState: {
        activeTome: 'justice',
        tomePages: 5,
        maximumTomePages: 5
      }
    })
    .flatMap((group) => group.skillIds);
  const firebrandResources = guardianProfession.ui.resourceViews({
    specialization: 'Firebrand',
    simulationTime: 10,
    professionState: {
      tomePages: 3,
      maximumTomePages: 5,
      tomeDormantReadyAt: { justice: 20, resolve: 10, courage: 0 }
    }
  });

  assert.equal(dragonhunter.includes(GUARDIAN_SKILL_IDS.WINGS_OF_RESOLVE), true);
  assert.equal(dragonhunter.includes(GUARDIAN_SKILL_IDS.SHIELD_OF_COURAGE), true);
  assert.equal(spear.flipParentId, null);
  assert.equal(verdict.flipParentId, spear.id);
  assert.equal(firebrand.includes(GUARDIAN_SKILL_IDS.SEARING_SPELL), true);
  assert.equal(firebrandResources[0].value, 3);
  assert.equal(firebrandResources[1].id, 'tome-dormancy');
  assert.equal(firebrandResources[1].displayMode, 'status');
  assert.equal(firebrandResources[1].statusItemsLabel, undefined);
  assert.deepEqual(
    firebrandResources[1].statusItems.map(({ id, valueLabel }) => [id, valueLabel]),
    [
      ['justice', 'Dormant 10.0s'],
      ['resolve', 'Ready'],
      ['courage', 'Ready']
    ]
  );
});

test('Guardian declarative scheduling respects the configured starting set', () => {
  const initial = simulateGw2({
    profession: guardianProfession,
    rotation: [],
    config: { ...config, startingWeaponSet: 2 }
  });
  const swapped = simulateGw2({
    profession: guardianProfession,
    rotation: ['Swap Weapons'],
    config: { ...config, startingWeaponSet: 2 }
  });

  assert.equal(initial.endState.activeWeaponSet, 2);
  assert.equal(swapped.endState.activeWeaponSet, 1);
  assert.equal(swapped.events.find((event) => event.type === 'weapon_set').weaponSet, 1);
});

test('Guardian builds migrate and validate against real catalog metadata', () => {
  const defaults = createGuardianBuildDefaults();
  const migrated = migrateGuardianBuild({
    ...defaults,
    rotation: ['Virtue of Justice', 'True Strike']
  });

  assert.equal(validateGuardianBuild(migrated).valid, true);
  assert.deepEqual(
    migrated.rotation.map((command) => command.skillId),
    [
      guardianProfession.catalog.skillsByName.get('Virtue of Justice').id,
      guardianProfession.catalog.skillsByName.get('True Strike').id
    ]
  );
  assert.equal(
    validateGuardianBuild({
      ...migrated,
      weapons: ['Greatsword', 'Torch']
    }).valid,
    false
  );
});

test('Guardian is registered at the profession composition boundary', async () => {
  assert.equal(await loadProfession('guardian'), guardianProfession);
});
