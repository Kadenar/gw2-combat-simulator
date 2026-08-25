import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfession } from '../../../js/app/profession/registry.js';
import { skillBarInspectionStacks } from '../../../js/app/build/panels/skills.js';
import { displayedSkillTiles } from '../../../js/app/rotation/palette/model.js';
import { automaticTomeStowTimelineMarkers, timelineWeaponRows } from '../../../js/app/rotation/timeline/model.js';
import { createCalculateAttributes } from '../../../js/platform/gw2/builds/attributes.js';
import { simulateGw2 } from '../../../js/platform/gw2/simulation/simulate.js';
import { applyBalanceProfilePatch, applySkillPatch } from '../../../js/platform/gw2/authoring/patches.js';
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild
} from '../../../js/professions/guardian/build.js';
import { applyGuardianBuildAttributeRules } from '../../../js/professions/guardian/build-attributes.js';
import { guardianCatalog } from '../../../js/professions/guardian/catalog.js';
import { DATA_SNAPSHOT } from '../../../js/professions/guardian/data/guardian-api-metadata.js';
import { guardianProfession } from '../../../js/professions/guardian/definition.js';
import { guardianAppAdapter } from '../../../js/professions/guardian/app/app-definition.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '../../../js/professions/guardian/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS } from '../../../js/professions/guardian/core/profiles.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS } from '../../../js/professions/guardian/specializations/dragonhunter/profiles.js';
import { FIREBRAND_BALANCE_PROFILE_IDS } from '../../../js/professions/guardian/specializations/firebrand/profiles.js';
import { WILLBENDER_BALANCE_PROFILE_IDS } from '../../../js/professions/guardian/specializations/willbender/profiles.js';
import { LUMINARY_BALANCE_PROFILE_IDS } from '../../../js/professions/guardian/specializations/luminary/profiles.js';

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

const applyGuardianPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(guardianCatalog, patch), patch);

test('Guardian uses a current API catalog with real skills and trait lines', () => {
  assert.match(DATA_SNAPSHOT, /^2026-/);
  assert.equal(guardianCatalog.specializations.length, 9);
  assert.equal(guardianCatalog.traits.length, 108);
  assert.ok(guardianCatalog.skills.length >= 190);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.TRUE_STRIKE).name, 'True Strike');
  assert.equal(guardianCatalog.skillsByName.get('Virtue of Justice').id, 9115);
  assert.equal(
    guardianCatalog.specializations.some((spec) => spec.name === 'Luminary'),
    true
  );
});

test('Guardian modules expose isolated balance-profile authoring', () => {
  const modules = new Map(guardianProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Dragonhunter', 'Firebrand', 'Willbender', 'Luminary']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) =>
    modules.get(moduleId).balanceProfiles.find((entry) => entry.id === profileId);

  assert.equal(profile('Core', GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice).profile.threshold, 5);
  assert.equal(profile('Dragonhunter', DRAGONHUNTER_BALANCE_PROFILE_IDS.tether).profile.effects[0].duration, 2);
  assert.equal(profile('Firebrand', FIREBRAND_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 5);
  assert.equal(profile('Willbender', WILLBENDER_BALANCE_PROFILE_IDS.flames).profile.effects[0].coefficient, 0.22);
  assert.equal(profile('Luminary', LUMINARY_BALANCE_PROFILE_IDS.forge).patchableFields.maximumStacks, 4);
  assert.deepEqual(
    modules.get('Core').modifierRules.find((rule) => rule.id === 'guardian.inspired-virtue').parameters,
    { damagePerBoon: 0.005 }
  );
  assert.deepEqual(
    modules.get('Firebrand').modifierRules.find((rule) => rule.id === 'guardian.firebrand.imbued-haste-attributes')
      .parameters,
    { attributeBonus: 250 }
  );

  const preview = applyGuardianPatch({
    skills: {
      [GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE]: {
        effects: [
          {
            effectIndex: 0,
            coefficient: { from: 0.8, to: 0.9 }
          }
        ]
      }
    },
    balanceProfiles: {
      [GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice]: {
        fields: { threshold: { from: 5, to: 4 } }
      },
      [DRAGONHUNTER_BALANCE_PROFILE_IDS.tether]: {
        effects: [
          {
            effectIndex: 0,
            duration: { from: 2, to: 3 }
          }
        ]
      },
      [FIREBRAND_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 5, to: 6 } }
      },
      [WILLBENDER_BALANCE_PROFILE_IDS.flames]: {
        effects: [
          {
            effectIndex: 0,
            coefficient: { from: 0.22, to: 0.3 }
          }
        ]
      },
      [LUMINARY_BALANCE_PROFILE_IDS.forge]: {
        fields: { maximumStacks: { from: 4, to: 5 } }
      }
    }
  });

  assert.equal(preview.skillsById.get(GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE).effects[0].coefficient, 0.9);
  assert.equal(preview.balanceProfilesById.get(GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice).threshold, 4);
  assert.equal(preview.balanceProfilesById.get(DRAGONHUNTER_BALANCE_PROFILE_IDS.tether).effects[0].duration, 3);
  assert.equal(preview.balanceProfilesById.get(FIREBRAND_BALANCE_PROFILE_IDS.resources).maximumStacks, 6);
  assert.equal(preview.balanceProfilesById.get(WILLBENDER_BALANCE_PROFILE_IDS.flames).effects[0].coefficient, 0.3);
  assert.equal(preview.balanceProfilesById.get(LUMINARY_BALANCE_PROFILE_IDS.forge).maximumStacks, 5);

  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE).effects[0].coefficient, 0.8);
  assert.equal(guardianCatalog.balanceProfilesById.get(GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice).threshold, 5);
  assert.equal(guardianCatalog.balanceProfilesById.get(FIREBRAND_BALANCE_PROFILE_IDS.resources).maximumStacks, 5);
});

test('Masterful Writ utilities grant their flat attributes', () => {
  const baseline = createGuardianBuildDefaults();

  baseline.utility = '';
  const strength = structuredClone(baseline);

  strength.utility = 'Writ of Masterful Strength';
  const malice = structuredClone(baseline);

  malice.utility = 'Writ of Masterful Malice';

  const baselineAttributes = calculateGuardianAttributes(baseline, []).attributes;
  const strengthAttributes = calculateGuardianAttributes(strength, []).attributes;
  const maliceAttributes = calculateGuardianAttributes(malice, []).attributes;

  assert.equal(strengthAttributes.Power.utility, 200);
  assert.equal(strengthAttributes.Power.final - baselineAttributes.Power.final, 200);
  assert.equal(maliceAttributes['Condition Damage'].utility, 200);
  assert.equal(maliceAttributes['Condition Damage'].final - baselineAttributes['Condition Damage'].final, 200);
});

test('Justice active burning resolves through simulateGw2', () => {
  const withoutJustice = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike'],
    config
  });
  const withJustice = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice', 'True Strike', { type: 'wait', durationMs: 2000 }],
    config
  });

  assert.equal(withoutJustice.conditionDamage, 0);
  assert.ok(withJustice.conditionDamage > 0);
  assert.equal(withJustice.endState.profession.justiceBurns, 1);
  assert.equal(withJustice.endState.profession.justiceActiveBurns, 1);
  assert.equal(withJustice.endState.profession.justiceArmed, false);
});

test('Justice passive counts individual hits and respects its active cooldown', () => {
  const passive = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Wrath'],
    config: { ...config, primaryWeapon: 'Greatsword' }
  });
  const activated = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice', 'Whirling Wrath'],
    config: { ...config, primaryWeapon: 'Greatsword' }
  });
  const permeating = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Wrath'],
    config: {
      ...config,
      primaryWeapon: 'Greatsword',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH]
    }
  });
  const radiantPassive = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Wrath'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword'
    }
  });
  const radiantPermeating = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Wrath'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH]
    }
  });
  const radiantActivated = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice', 'Whirling Wrath'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword'
    }
  });

  assert.equal(passive.endState.profession.justicePassiveBurns, 2);
  assert.equal(passive.endState.profession.justiceHitCount, 4);
  assert.equal(activated.endState.profession.justiceActiveBurns, 1);
  assert.equal(activated.endState.profession.justicePassiveBurns, 0);
  assert.equal(activated.endState.profession.virtueReadyAt.justice, 20);
  assert.equal(permeating.endState.profession.justicePassiveBurns, 4);
  assert.equal(permeating.endState.profession.justiceHitCount, 2);
  assert.equal(radiantPassive.endState.profession.justicePassiveBurns, 2);
  assert.equal(radiantPassive.endState.profession.justiceHitCount, 4);
  assert.equal(radiantPermeating.endState.profession.justicePassiveBurns, 4);
  assert.equal(radiantPermeating.endState.profession.justiceHitCount, 2);
  assert.equal(radiantActivated.endState.profession.justicePassiveBurns, 0);
});

test('Guardian greatsword uses the reference cast and strike profiles', () => {
  const simulate = (quickness) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: [
        'Strike',
        'Vengeful Strike',
        'Wrathful Strike',
        'Whirling Wrath',
        'Leap of Faith',
        'Symbol of Resolution',
        'Binding Blade',
        { type: 'wait', durationMs: 15000 }
      ],
      config: {
        ...config,
        boons: { quickness },
        primaryWeapon: 'Greatsword'
      }
    });
  const profile = (result, skillName) => {
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return {
      cast: Math.round((action.endsAt - action.at) * 1000),
      ticks: result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillName === skillName)
        .map((event) => Number(((event.at - action.at) * 1000).toFixed(6))),
      coefficient: Number(
        result.resolvedEvents
          .filter((event) => event.type === 'damage' && event.skillName === skillName)
          .reduce((sum, event) => sum + event.coefficient, 0)
          .toFixed(4)
      )
    };
  };

  const normal = simulate(false);
  const quick = simulate(true);

  assert.deepEqual(
    ['Strike', 'Vengeful Strike', 'Wrathful Strike'].map((name) => profile(normal, name).cast),
    [600, 900, 1000]
  );
  assert.deepEqual(
    ['Strike', 'Vengeful Strike', 'Wrathful Strike'].map((name) => profile(quick, name).cast),
    [400, 600, 680]
  );
  assert.deepEqual(profile(quick, 'Whirling Wrath'), {
    cast: 1480,
    ticks: [106, 211, 317, 422, 528, 634, 739, 846, 951, 1057, 1162, 1268, 1374, 1480],
    coefficient: 4.375
  });
  assert.deepEqual(profile(quick, 'Leap of Faith'), {
    cast: 720,
    ticks: [720],
    coefficient: 2
  });
  assert.deepEqual(profile(quick, 'Symbol of Resolution'), {
    cast: 280,
    ticks: [200, 1200, 2200, 3200, 4200],
    coefficient: 3.4
  });
  assert.deepEqual(profile(quick, 'Binding Blade'), {
    cast: 480,
    ticks: [480, 1480, 2480, 3480, 4480, 5480, 6480, 7480, 8480, 9480, 10480],
    coefficient: 2.5
  });
  const tether = quick.resolvedEvents.filter((event) => event.sourceId === GUARDIAN_SKILL_IDS.BINDING_BLADE_TETHER);

  assert.equal(tether.length, 10);
  assert.equal(
    tether.every((event) => event.canCrit === false),
    true
  );
  assert.equal(
    tether.every(
      (event) => event.flatStrikeBase === 160 && event.flatStrikePowerCoeff === 0.3 && event.damageKind === 'condition'
    ),
    true
  );
  assert.equal(quick.conditionDamage > 0, true);
});

test('Guardian longbow uses measured Quickness cast times', () => {
  const skillNames = ['Symbol of Energy', 'True Shot', "Hunter's Ward", 'Deflecting Shot'];
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: skillNames,
    config: {
      ...config,
      boons: { quickness: true },
      primaryWeapon: 'Longbow'
    }
  });
  const castTimes = skillNames.map((skillName) => {
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return Math.round((action.endsAt - action.at) * 1000);
  });

  assert.deepEqual(castTimes, [400, 680, 720, 600]);
});

test('Guardian longbow packets and Symbol of Energy burning use measured EVTC timing', () => {
  const profile = (skillName) => {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: [skillName, { type: 'wait', durationMs: 6000 }],
      config: {
        ...config,
        primaryWeapon: 'Longbow'
      }
    });
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return {
      result,
      action,
      damage: result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skillName)
    };
  };

  const offsets = ({ action, damage }) => damage.map((event) => Math.round((event.at - action.at) * 1000));
  const puncture = profile('Puncture Shot');
  const deflecting = profile('Deflecting Shot');
  const symbol = profile('Symbol of Energy');
  const trueShot = profile('True Shot');
  const ward = profile("Hunter's Ward");
  const symbolBurning = symbol.result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Symbol of Energy' && event.condition === 'Burning'
  );

  assert.deepEqual(offsets(puncture), [840]);
  assert.deepEqual(offsets(deflecting), [820]);
  assert.deepEqual(offsets(symbol), [600, 1600, 2600, 3600, 4600]);
  assert.deepEqual(offsets(trueShot), [1020]);
  assert.deepEqual(offsets(ward), [980, 1500, 2020, 2540]);
  assert.deepEqual(
    ward.damage.map((event) => event.coefficient),
    [0.75, 0.75, 0.75, 2.5]
  );
  assert.equal(symbolBurning.length, 1);
  assert.equal(Math.round((symbolBurning[0].at - symbol.action.at) * 1000), 600);
  assert.equal(symbolBurning[0].duration, 12);
});

test('Guardian utilities and traps use the reference damage timelines', () => {
  const skillNames = [
    'Sword of Justice',
    'Procession of Blades',
    'Bane Signet',
    "Dragon's Maw",
    'Purification',
    'Test of Faith'
  ];
  const simulate = (quickness) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: [...skillNames, { type: 'wait', durationMs: 5000 }],
      config: {
        ...config,
        boons: { quickness },
        specialization: 'Dragonhunter'
      }
    });
  const profiles = (result) =>
    Object.fromEntries(
      skillNames.map((skillName) => {
        const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);
        const damage = result.resolvedEvents.filter(
          (event) => event.type === 'damage' && event.skillName === skillName
        );

        return [
          skillName,
          {
            cast: Math.round((action.endsAt - action.at) * 1000),
            ticks: damage.map((event) => Math.round((event.at - action.at) * 1000)),
            coefficient: Number(damage.reduce((sum, event) => sum + event.coefficient, 0).toFixed(4))
          }
        ];
      })
    );
  const normalResult = simulate(false);
  const quickResult = simulate(true);
  const normal = profiles(normalResult);
  const quick = profiles(quickResult);
  const swordAction = quickResult.events.find(
    (event) => event.type === 'action' && event.skillName === 'Sword of Justice'
  );

  assert.deepEqual(
    skillNames.map((name) => normal[name].cast),
    [900, 660, 750, 660, 900, 0]
  );
  assert.deepEqual(
    skillNames.map((name) => quick[name].cast),
    [600, 440, 500, 440, 600, 0]
  );
  assert.deepEqual(quick['Sword of Justice'], {
    cast: 600,
    ticks: [650, 1050, 1450, 1850],
    coefficient: 3.2
  });
  assert.deepEqual(
    quickResult.resolvedEvents
      .filter(
        (event) =>
          event.type === 'condition' && event.skillName === 'Sword of Justice' && event.condition === 'Vulnerability'
      )
      .map((event) => [Math.round((event.at - swordAction.at) * 1000), event.stacks, event.duration]),
    [
      [650, 3, 8],
      [1050, 3, 8],
      [1450, 3, 8],
      [1850, 3, 8]
    ]
  );
  const swordRecharge = simulateGw2({
    profession: guardianProfession,
    rotation: ['Sword of Justice', 'Sword of Justice', 'Sword of Justice', 'Sword of Justice'],
    config: { ...config, boons: { quickness: true } }
  });

  assert.deepEqual(
    swordRecharge.steps.map((step) => step.start),
    [0, 1600, 3200, 15600]
  );
  assert.deepEqual(quick['Procession of Blades'], {
    cast: 440,
    ticks: [1280, 1560, 1840, 2120, 2400, 2680, 2960, 3240, 3520, 3800],
    coefficient: 4.4
  });
  assert.deepEqual(quick['Bane Signet'], {
    cast: 500,
    ticks: [500],
    coefficient: 1
  });
  assert.deepEqual(quick["Dragon's Maw"], {
    cast: 440,
    ticks: [500],
    coefficient: 3.6
  });
  assert.deepEqual(quick.Purification, {
    cast: 600,
    ticks: [500],
    coefficient: 0.1875
  });
  assert.deepEqual(quick['Test of Faith'], {
    cast: 0,
    ticks: [500],
    coefficient: 1.4
  });
});

test('Spear Helio Rush arms Illuminated and enhances the next spear skill', () => {
  const spearConfig = { ...config, primaryWeapon: 'Spear' };

  const helioAlone = simulateGw2({
    profession: guardianProfession,
    rotation: ['Helio Rush'],
    config: spearConfig
  });
  const gleamingAlone = simulateGw2({
    profession: guardianProfession,
    rotation: ['Gleaming Disc', { type: 'wait', durationMs: 1000 }],
    config: spearConfig
  });
  const combo = simulateGw2({
    profession: guardianProfession,
    rotation: ['Helio Rush', 'Gleaming Disc', { type: 'wait', durationMs: 1000 }],
    config: spearConfig
  });

  // Helio Rush is not illuminated itself but arms the buff for the next attack.
  assert.equal(helioAlone.endState.profession.spearIlluminatedArmed, true);
  assert.equal(
    helioAlone.procSteps.some((step) => step.skill === 'Illuminated'),
    false
  );
  assert.equal(
    helioAlone.events.some((event) => event.type === 'buff' && event.kind === 'resolution' && event.duration === 4),
    true
  );
  assert.equal(
    gleamingAlone.procSteps.some((step) => step.skill === 'Illuminated'),
    false
  );

  // The armed buff makes Gleaming Disc illuminated: an "Illuminated" proc fires
  // and the combo out-damages the two skills cast in isolation.
  const illuminated = combo.procSteps.filter((step) => step.skill === 'Illuminated');

  assert.equal(illuminated.length, 1);
  assert.equal(illuminated[0].sourceSkill, 'Gleaming Disc');
  assert.ok(combo.strikeDamage > helioAlone.strikeDamage + gleamingAlone.strikeDamage + 1);

  const expired = simulateGw2({
    profession: guardianProfession,
    rotation: ['Helio Rush', { type: 'wait', durationMs: 5001 }, 'Gleaming Disc', { type: 'wait', durationMs: 1000 }],
    config: spearConfig
  });

  assert.deepEqual(
    expired.resolvedEvents
      .filter((event) => event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
      .map((event) => event.coefficient),
    [1.5, 1.5]
  );

  const preservedThroughFiller = simulateGw2({
    profession: guardianProfession,
    rotation: ['Helio Rush', 'Daybreaking Slash', 'Gleaming Disc', { type: 'wait', durationMs: 1000 }],
    config: spearConfig
  });

  assert.deepEqual(
    preservedThroughFiller.resolvedEvents
      .filter((event) => event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
      .map((event) => event.coefficient),
    [1.5, 2.25]
  );
});

test('Spear Symbol of Luminance keeps all spear skills illuminated while active', () => {
  const spearConfig = { ...config, primaryWeapon: 'Spear' };

  const symbolThenHelio = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Luminance', 'Helio Rush'],
    config: {
      ...spearConfig,
      boons: { quickness: true }
    }
  });

  assert.equal(symbolThenHelio.steps[0].end, 440);
  // The window empowers Helio Rush even though nothing armed it beforehand.
  assert.ok(symbolThenHelio.endState.profession.spearLuminanceUntil > 0);
  assert.equal(
    symbolThenHelio.procSteps.some((step) => step.skill === 'Illuminated' && step.sourceSkill === 'Helio Rush'),
    true
  );
  assert.deepEqual(
    symbolThenHelio.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.HELIO_RUSH)
      .map((event) => event.coefficient),
    [2.25]
  );
});

test('Guardian spear coefficients and repeated pulses stay per-hit', () => {
  const spearConfig = {
    ...config,
    boons: { quickness: true },
    primaryWeapon: 'Spear'
  };
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Helio Rush', 'Gleaming Disc', 'Symbol of Luminance', 'Solar Storm', { type: 'wait', durationMs: 5000 }],
    config: spearConfig
  });
  const coefficients = (name) =>
    result.resolvedEvents.filter((event) => event.name === name).map((event) => event.coefficient);

  assert.deepEqual(coefficients('Helio Rush'), [1.5]);
  assert.deepEqual(coefficients('Gleaming Disc'), [1.5, 2.25]);
  assert.deepEqual(coefficients('Gleaming Disc (Illuminated)'), []);
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC
    ).length,
    2
  );
  const gleamingAction = result.events.find(
    (event) => event.type === 'action' && event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC
  );

  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
      .map((event) => Math.round((event.at - gleamingAction.at) * 1000)),
    [0, 680]
  );
  assert.deepEqual(coefficients('Symbol of Luminance — Initial'), [1.5]);
  assert.deepEqual(coefficients('Symbol of Luminance'), [0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(coefficients('Solar Storm — 1st Strike'), [1.5]);
  assert.deepEqual(coefficients('Solar Storm — 2nd Strike'), [1.2]);
  assert.deepEqual(coefficients('Solar Storm — 3rd Strike'), [0.9]);
  assert.deepEqual(coefficients('Solar Storm — 4th Strike'), [0.6]);
  assert.deepEqual(coefficients('Solar Storm — 5th Strike'), [0.3]);
  assert.deepEqual(coefficients('Solar Storm (Illuminated)'), []);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.SOLAR_STORM)
      .length,
    5
  );
});

test('Guardian swaps weapons and exposes profession palette groups', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Swap Weapons'],
    config
  });

  assert.equal(result.endState.activeWeaponSet, 2);
  assert.deepEqual(guardianProfession.ui.resourceViews({}), []);
  assert.deepEqual(guardianProfession.ui.paletteGroups({})[0].skillIds, [
    GUARDIAN_SKILL_IDS.JUSTICE,
    GUARDIAN_SKILL_IDS.RESOLVE,
    GUARDIAN_SKILL_IDS.COURAGE
  ]);
});

test('weapon swap ignores Alacrity and Relic of the Warrior reduces its recharge to 7.5 seconds', () => {
  const swapStarts = (extraConfig) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['__combat_start', 'Swap Weapons', 'Swap Weapons'],
      config: { ...config, ...extraConfig }
    })
      .steps.filter((step) => step.skill === 'Swap Weapons')
      .map((step) => step.start);

  assert.deepEqual(swapStarts({ boons: { alacrity: true } }), [0, 10000]);
  assert.deepEqual(swapStarts({ boons: { alacrity: true }, relic: 'Warrior' }), [0, 7500]);
});

test('Guardian skill bar exposes F keys and Luminary Radiant Forge skills', () => {
  const coreGroups = guardianProfession.ui.skillBarGroups({
    specialization: 'Core'
  });

  assert.deepEqual(
    coreGroups.map((group) => group.label),
    ['F Keys']
  );
  assert.deepEqual(coreGroups[0].skillIds, [
    GUARDIAN_SKILL_IDS.JUSTICE,
    GUARDIAN_SKILL_IDS.RESOLVE,
    GUARDIAN_SKILL_IDS.COURAGE
  ]);

  const luminaryGroups = guardianProfession.ui.skillBarGroups({
    specialization: 'Luminary',
    professionState: { radiantForge: false }
  });

  assert.deepEqual(
    luminaryGroups.map((group) => group.label),
    ['F Keys', 'Radiant Forge']
  );
  assert.equal(luminaryGroups[0].skillIds.includes(GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE), true);
  assert.equal(luminaryGroups[1].skillIds.includes(GUARDIAN_SKILL_IDS.GLARING_BURST), true);
  assert.equal(luminaryGroups[1].skillIds.includes(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER), true);
  assert.equal(luminaryGroups[1].skillIds.includes(GUARDIAN_SKILL_IDS.BRILLIANT_SLAM), true);
  assert.deepEqual(
    skillBarInspectionStacks(
      luminaryGroups[1].skillIds.map((skillId) => guardianCatalog.skillsById.get(skillId)),
      luminaryGroups[1].inspectionChainRoots
    ).map(({ root, children }) => [root.id, children.map((skill) => skill.id)]),
    [
      [GUARDIAN_SKILL_IDS.GLARING_BURST, []],
      [GUARDIAN_SKILL_IDS.DAZZLING_HAMMER, [GUARDIAN_SKILL_IDS.SHINING_SPIN]],
      [GUARDIAN_SKILL_IDS.LUMINOUS_STAFF, [GUARDIAN_SKILL_IDS.RESTORATIVE_GLOW]],
      [GUARDIAN_SKILL_IDS.GLEAMING_BLADE, [GUARDIAN_SKILL_IDS.LUCENT_THRUST]],
      [GUARDIAN_SKILL_IDS.RADIANT_BULWARK, [GUARDIAN_SKILL_IDS.BRILLIANT_SLAM]]
    ]
  );

  const firebrandGroups = guardianProfession.ui.skillBarGroups({
    specialization: 'Firebrand',
    professionState: { activeTome: '', tomePages: 5 }
  });

  assert.deepEqual(
    firebrandGroups.map((group) => group.label),
    ['F Keys', 'Tome of Justice', 'Tome of Resolve', 'Tome of Courage']
  );
  assert.deepEqual(
    firebrandGroups.slice(1).map((group) => group.skillIds.length),
    [5, 5, 5]
  );
  assert.deepEqual(firebrandGroups[0].skillIds, [
    GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
    GUARDIAN_SKILL_IDS.TOME_OF_RESOLVE,
    GUARDIAN_SKILL_IDS.TOME_OF_COURAGE
  ]);
  assert.deepEqual(
    firebrandGroups.map((group) => group.layout),
    ['guardian-tomes', 'guardian-tomes', 'guardian-tomes', 'guardian-tomes']
  );
  assert.equal(firebrandGroups[1].skillIds.includes(GUARDIAN_SKILL_IDS.SEARING_SPELL), true);
  assert.equal(firebrandGroups[2].skillIds.includes(GUARDIAN_SKILL_IDS.AZURE_SUN), true);
  assert.equal(firebrandGroups[3].skillIds.includes(GUARDIAN_SKILL_IDS.UNBROKEN_LINES), true);
});

test('Guardian palettes keep inactive tome and forge skills visible', () => {
  const inactiveFirebrand = {
    specialization: 'Firebrand',
    professionState: {
      activeTome: '',
      tomePages: 5,
      radiantForge: false
    }
  };
  const activeFirebrand = {
    ...inactiveFirebrand,
    professionState: {
      ...inactiveFirebrand.professionState,
      activeTome: 'justice'
    }
  };
  const inactiveFirebrandGroups = guardianProfession.ui.paletteGroups(inactiveFirebrand);
  const activeFirebrandGroups = guardianProfession.ui.paletteGroups(activeFirebrand);
  const groupIds = (groups) => groups.map((group) => group.id);

  assert.deepEqual(groupIds(inactiveFirebrandGroups), ['profession', 'tome-justice', 'tome-resolve', 'tome-courage']);
  assert.deepEqual(
    activeFirebrandGroups.map((group) => group.skillIds),
    inactiveFirebrandGroups.map((group) => group.skillIds)
  );
  assert.equal(
    inactiveFirebrandGroups
      .find((group) => group.id === 'tome-justice')
      .skillIds.includes(GUARDIAN_SKILL_IDS.SEARING_SPELL),
    true
  );
  assert.equal(
    inactiveFirebrandGroups
      .find((group) => group.id === 'tome-resolve')
      .skillIds.includes(GUARDIAN_SKILL_IDS.DESERT_BLOOM),
    true
  );
  assert.equal(
    inactiveFirebrandGroups
      .find((group) => group.id === 'tome-courage')
      .skillIds.includes(GUARDIAN_SKILL_IDS.UNFLINCHING_CHARGE),
    true
  );

  const inactiveForgeGroups = guardianProfession.ui.paletteGroups({
    specialization: 'Luminary',
    professionState: { radiantForge: false }
  });
  const activeForgeGroups = guardianProfession.ui.paletteGroups({
    specialization: 'Luminary',
    professionState: { radiantForge: true }
  });

  assert.deepEqual(
    inactiveForgeGroups.map((group) => group.stackId),
    ['luminary-profession', 'luminary-profession']
  );
  assert.deepEqual(
    activeForgeGroups.map((group) => group.skillIds),
    inactiveForgeGroups.map((group) => group.skillIds)
  );
  assert.equal(
    inactiveForgeGroups
      .find((group) => group.id === 'radiant-forge')
      .skillIds.includes(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER),
    true
  );
});

test('Guardian palette availability follows the active tome or forge', () => {
  const isAvailable = guardianProfession.ui.isPaletteSkillAvailable;
  const trueStrike = guardianCatalog.skillsByName.get('True Strike');
  const searingSpell = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.SEARING_SPELL);
  const desertBloom = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.DESERT_BLOOM);
  const dazzlingHammer = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER);

  assert.equal(
    isAvailable(
      {
        professionState: { activeTome: '', tomePages: 5 }
      },
      trueStrike
    ),
    true
  );
  assert.equal(
    isAvailable(
      {
        professionState: { activeTome: '', tomePages: 5 }
      },
      searingSpell
    ),
    false
  );
  assert.equal(
    isAvailable(
      {
        professionState: { activeTome: 'justice', tomePages: 5 }
      },
      trueStrike
    ),
    false
  );
  assert.equal(
    isAvailable(
      {
        professionState: { activeTome: 'justice', tomePages: 5 }
      },
      searingSpell
    ),
    true
  );
  assert.equal(
    isAvailable(
      {
        professionState: { activeTome: 'justice', tomePages: 5 }
      },
      desertBloom
    ),
    false
  );
  assert.equal(
    isAvailable(
      {
        professionState: { radiantForge: false }
      },
      dazzlingHammer
    ),
    false
  );
  assert.equal(
    isAvailable(
      {
        professionState: { radiantForge: true }
      },
      trueStrike
    ),
    false
  );
  assert.equal(
    isAvailable(
      {
        professionState: { radiantForge: true }
      },
      dazzlingHammer
    ),
    true
  );
});

test('Guardian only casts weapon skills equipped on the active set', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Through the Heart', 'Swap Weapons', 'Through the Heart'],
    config: {
      ...config,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Focus',
      weaponSet2Primary: 'Pistol',
      weaponSet2Secondary: 'Torch'
    }
  });

  assert.equal(
    result.resolvedEvents.filter((event) => event.skillName === 'Through the Heart' && event.type === 'damage').length,
    1
  );
  assert.match(result.warnings.join(' '), /Through the Heart is unavailable/);
});

test('Guardian cannot cast weapon skills while a tome or forge is active', () => {
  const firebrand = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'True Strike', 'Stow Tome', 'True Strike'],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace'
    }
  });
  const luminary = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'True Strike', 'Exit Radiant Forge', 'True Strike'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Mace'
    }
  });

  assert.equal(firebrand.steps[1].invalid, true);
  assert.equal(Boolean(firebrand.steps[3].invalid), false);
  assert.equal(luminary.steps[1].invalid, true);
  assert.equal(Boolean(luminary.steps[3].invalid), false);
});

test('Guardian player strikes trigger shared player-owned sigils', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike'],
    config: {
      ...config,
      stats: {
        ...config.stats,
        precision: 3100
      },
      boons: { fury: true },
      sigilSets: [
        { names: ['Air'], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.equal(result.resolvedEvents.find((event) => event.skillName === 'True Strike').actorType, 'player');
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Air'),
    true
  );
});

test('Guardian timing applies Quickness, Alacrity, ammo, and trait recharge', () => {
  const quick = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike'],
    config: { ...config, boons: { quickness: true } }
  });
  const alacrity = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice'],
    config: { ...config, boons: { alacrity: true } }
  });
  const virtuous = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice'],
    config: {
      ...config,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS]
    }
  });
  const ammo = simulateGw2({
    profession: guardianProfession,
    rotation: ['Hail of Justice', 'Hail of Justice', 'Hail of Justice'],
    config: {
      ...config,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Pistol'
    }
  });

  assert.equal(quick.endState.time, 360);
  assert.equal(alacrity.endState.cooldowns['Virtue of Justice'].readyAt, 16000);
  assert.equal(virtuous.endState.cooldowns['Virtue of Justice'].readyAt, 17000);
  assert.equal(ammo.endState.ammo['Hail of Justice'].charges, 0);
  assert.equal(ammo.steps[2].start, 11680);
  assert.deepEqual(ammo.warnings, []);
});

test('Zealous Blade reduces every Greatsword skill recharge by 20%', () => {
  const skillNames = ['Whirling Wrath', 'Leap of Faith', 'Symbol of Resolution', 'Binding Blade'];
  const rechargeDurations = (selectedTraitIds) =>
    skillNames.map((skillName) => {
      const result = simulateGw2({
        profession: guardianProfession,
        rotation: [skillName],
        config: { ...config, primaryWeapon: 'Greatsword', selectedTraitIds }
      });
      const skill = guardianCatalog.skillsByName.get(skillName);
      const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);
      const rechargeStart = skill.rechargeAnchor === 'castStart' ? action.at : action.endsAt;

      return Number((action.rechargeReadyAt - rechargeStart).toFixed(3));
    });

  assert.deepEqual(rechargeDurations([]), [8, 10, 12, 25]);
  assert.deepEqual(rechargeDurations([GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE]), [6.4, 8, 9.6, 20]);
});

test('Guardian measured Quickness cast times remain exact', () => {
  const quicknessConfig = {
    ...config,
    boons: { quickness: true },
    specialization: 'Luminary',
    primaryWeapon: 'Spear'
  };
  const castDuration = (rotation, skillName) => {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation,
      config: quicknessConfig
    });
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return Math.round((action.endsAt - action.at) * 1000);
  };

  assert.equal(castDuration(['Helio Rush'], 'Helio Rush'), 320);
  assert.equal(castDuration(['Gleaming Disc'], 'Gleaming Disc'), 560);
  assert.equal(castDuration(['Solar Storm'], 'Solar Storm'), 560);
  assert.equal(castDuration(['Enter Radiant Forge', 'Dazzling Hammer'], 'Dazzling Hammer'), 480);

  const chain = simulateGw2({
    profession: guardianProfession,
    rotation: ['Daybreaking Slash', 'Daybreaking Slash', 'Helio Rush', 'Daybreaking Slash'],
    config: quicknessConfig
  });

  assert.deepEqual(
    chain.events
      .filter((event) => event.type === 'action' && event.skillName === 'Daybreaking Slash')
      .map((event) => Math.round((event.endsAt - event.at) * 1000)),
    [520, 440, 520]
  );
});

test('Willbender utilities use the supplied physical skill profiles', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Flash Combo',
      "Heaven's Palm",
      'Whirling Light',
      'Crashing Courage',
      { type: 'wait', durationMs: 6000 }
    ],
    config: {
      ...config,
      specialization: 'Willbender',
      boons: { quickness: true }
    }
  });
  const actions = new Map(
    result.events.filter((event) => event.type === 'action').map((event) => [event.skillName, event])
  );
  const strikes = (name) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === name);
  const conditions = (name) =>
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillName === name);

  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round((actions.get('Flash Combo').endsAt - actions.get('Flash Combo').at) * 1000), 680);
  assert.equal(Math.round((actions.get("Heaven's Palm").endsAt - actions.get("Heaven's Palm").at) * 1000), 960);
  assert.equal(strikes('Flash Combo').length, 5);
  assert.equal(
    strikes('Flash Combo').reduce((sum, event) => sum + event.coefficient, 0),
    4.5
  );
  assert.deepEqual(
    strikes("Heaven's Palm").map((event) => event.coefficient),
    [3]
  );
  assert.equal(
    result.events.some(
      (event) => event.type === 'control' && event.skillName === "Heaven's Palm" && event.controlKind === 'knockback'
    ),
    true
  );
  assert.equal(strikes('Whirling Light').length, 4);
  assert.equal(
    strikes('Whirling Light').every(
      (event) => event.comboFinishers?.[0]?.finisherType === 'Whirl' && event.comboFinishers[0].ownerId === 'guardian'
    ),
    true
  );
  assert.equal(
    conditions('Whirling Light').filter((event) => event.condition === 'Burning' && event.duration === 3).length,
    4
  );
  assert.equal(
    conditions('Whirling Light').filter((event) => event.condition === 'Weakness' && event.duration === 3).length,
    4
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Crashing Courage' &&
        event.kind === 'aegis' &&
        event.duration === 4
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Crashing Courage' &&
        event.kind === 'stability' &&
        event.duration === 4
    ),
    true
  );
  assert.equal(
    strikes('Crashing Courage').find((event) => event.name === 'Crashing Courage — Initial Damage').coefficient,
    1
  );
  assert.equal(
    strikes('Willbender Flames').filter((event) => event.skillId === GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES_COURAGE)
      .length,
    5
  );
  assert.equal(result.endState.profession.availableFlips[GUARDIAN_SKILL_IDS.REPOSE], 6.68);
});

test('Whirling Light creates four Burning Bolts inside Purging Flames', () => {
  const inFireField = simulateGw2({
    profession: guardianProfession,
    rotation: ['Purging Flames', 'Whirling Light'],
    config: {
      ...config,
      specialization: 'Willbender'
    }
  });
  const withoutFireField = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Light'],
    config: {
      ...config,
      specialization: 'Willbender'
    }
  });
  const burningCombos = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === 'Whirling Light' &&
        event.fieldType === 'Fire' &&
        event.finisherType === 'Whirl'
    );

  assert.deepEqual(inFireField.warnings, []);
  assert.equal(burningCombos(inFireField).length, 1);
  assert.equal(
    burningCombos(inFireField).every(
      (event) => event.applicationCount === 4 && event.outcome.condition === 'Burning' && event.outcome.duration === 1
    ),
    true
  );
  assert.equal(burningCombos(withoutFireField).length, 0);
});

test('Guardian Blasts use centralized field binding and require an active field', () => {
  const inFireField = simulateGw2({
    profession: guardianProfession,
    rotation: ['Purging Flames', 'Mighty Blow'],
    config: { ...config, primaryWeapon: 'Hammer' }
  });
  const withoutField = simulateGw2({
    profession: guardianProfession,
    rotation: ['Mighty Blow'],
    config: { ...config, primaryWeapon: 'Hammer' }
  });
  const finisher = inFireField.events.find(
    (event) => event.type === 'combo_finisher' && event.skillName === 'Mighty Blow'
  );
  const combo = inFireField.resolvedEvents.find((event) => event.type === 'combo' && event.skillName === 'Mighty Blow');

  assert.equal(finisher.finisherType, 'Blast');
  assert.equal(finisher.fieldBinding.kind, 'field-id');
  assert.equal(combo.fieldType, 'Fire');
  assert.equal(combo.finisherType, 'Blast');
  assert.equal(
    inFireField.events.some((event) => event.type === 'blast_combo'),
    false
  );
  assert.equal(
    withoutField.resolvedEvents.some((event) => event.type === 'combo' && event.skillName === 'Mighty Blow'),
    false
  );
});

test('Willbender virtues, flames, and trait triggers use their full mechanics', () => {
  const willbenderConfig = {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true }
  };
  const full = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', 'Whirling Wrath', { type: 'wait', durationMs: 6000 }],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.POWER_FOR_POWER,
        GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
        GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM
      ]
    }
  });
  const powerFlames = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', { type: 'wait', durationMs: 6000 }],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_FOR_POWER]
    }
  });
  const plainFlames = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', { type: 'wait', durationMs: 6000 }],
    config: willbenderConfig
  });
  const searingFlames = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', { type: 'wait', durationMs: 6000 }],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SEARING_PACT]
    }
  });
  const amplifiedWrath = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', 'Whirling Wrath'],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH]
    }
  });
  const permeatingWrath = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', 'Whirling Wrath'],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH]
    }
  });
  const flameStrikes = full.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Willbender Flames'
  );
  const whirlingAction = full.events.find((event) => event.type === 'action' && event.skillName === 'Whirling Wrath');
  const firstFlameDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Willbender Flames').damage;

  assert.deepEqual(full.warnings, []);
  assert.equal(
    Math.round(
      (full.events.find((event) => event.type === 'action' && event.skillName === 'Rushing Justice').endsAt -
        full.events.find((event) => event.type === 'action' && event.skillName === 'Rushing Justice').at) *
        1000
    ),
    480
  );
  assert.equal(full.resolvedEvents.find((event) => event.name === 'Rushing Justice — Impact Damage').coefficient, 1.5);
  assert.equal(full.resolvedEvents.find((event) => event.name === 'Rushing Justice — Initial Burning').duration, 4);
  assert.equal(flameStrikes.length, 5);
  assert.equal(
    flameStrikes.every((event) => event.coefficient === 0.22),
    true
  );
  assert.ok(Math.abs(firstFlameDamage(powerFlames) / firstFlameDamage(plainFlames) - 3) < 1e-9);
  assert.equal(
    searingFlames.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Searing Pact' &&
        event.condition === 'Burning' &&
        event.duration === 1
    ).length,
    5
  );
  assert.equal(
    powerFlames.resolvedEvents.some((event) => event.type === 'condition' && event.skillName === 'Willbender Flames'),
    false
  );
  assert.equal(
    full.resolvedEvents.some(
      (event) => event.name === 'Justice — Active Burning' && event.duration === 2 && event.icon
    ),
    true
  );
  assert.equal(
    amplifiedWrath.resolvedEvents.find((event) => event.name === 'Rushing Justice — Initial Burning').effectiveDuration,
    4
  );
  assert.equal(
    amplifiedWrath.resolvedEvents.find((event) => event.name === 'Justice — Active Burning').effectiveDuration,
    2.4
  );
  assert.equal(amplifiedWrath.resolvedEvents.filter((event) => event.name === 'Justice — Active Burning').length, 3);
  assert.equal(permeatingWrath.resolvedEvents.filter((event) => event.name === 'Justice — Active Burning').length, 5);
  assert.equal(full.endState.profession.justiceUntil, 10.04);
  assert.equal(full.endState.profession.lethalTempoStacks, 5);
  assert.equal(
    full.events.filter(
      (event) =>
        event.type === 'proc' &&
        event.name === 'Restorative Virtues' &&
        event.at >= whirlingAction.at &&
        event.at <= whirlingAction.endsAt
    ).length,
    3
  );
  assert.equal(
    full.events.some(
      (event) =>
        event.type === 'proc' && event.name === 'Restorative Virtues' && event.detail === '0.25s weapon recharge'
    ),
    true
  );
  assert.equal(full.events.find((event) => event.type === 'buff' && event.name === 'Lethal Tempo').duration, 4);
  const rushingJusticeAction = full.events.find(
    (event) => event.type === 'action' && event.skillName === 'Rushing Justice'
  );

  assert.equal(rushingJusticeAction.rechargeReadyAt - rushingJusticeAction.at, 12);
});

test('Willbender flame replacement and Phoenix Protocol follow virtue triggers', () => {
  const willbenderConfig = {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true }
  };
  const overlapping = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flowing Resolve', 'Flowing Resolve', { type: 'wait', durationMs: 6000 }],
    config: willbenderConfig
  });
  const replaced = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Flowing Resolve',
      { type: 'wait', durationMs: 700 },
      'Rushing Justice',
      { type: 'wait', durationMs: 6000 }
    ],
    config: willbenderConfig
  });
  const phoenix = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flowing Resolve', 'Whirling Wrath', { type: 'wait', durationMs: 6000 }],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL]
    }
  });
  const stackedVirtues = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flowing Resolve', { type: 'wait', durationMs: 1000 }, 'Rushing Justice', 'Whirling Wrath'],
    config: willbenderConfig
  });
  const allVirtues = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flowing Resolve', 'Crashing Courage', 'Rushing Justice', 'Whirling Wrath'],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES]
    }
  });
  const flameCount = (result, skillId) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Willbender Flames' && event.skillId === skillId
    ).length;

  assert.equal(flameCount(overlapping, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES), 10);
  assert.equal(overlapping.steps[1].start - overlapping.steps[0].start, 1020);
  assert.equal(flameCount(replaced, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES), 1);
  assert.equal(flameCount(replaced, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES_ID_62618), 5);
  assert.deepEqual(
    new Set(
      stackedVirtues.events
        .filter((event) => event.type === 'guardian.willbender-virtue-triggered')
        .map((event) => event.virtue)
    ),
    new Set(['justice', 'resolve'])
  );
  const allVirtueTriggers = allVirtues.events.filter((event) => event.type === 'guardian.willbender-virtue-triggered');

  assert.deepEqual(new Set(allVirtueTriggers.map((event) => event.virtue)), new Set(['justice', 'resolve', 'courage']));
  for (const virtue of ['justice', 'resolve', 'courage']) {
    assert.equal(
      allVirtueTriggers.some((event) => event.virtue === virtue && event.cooldownReduction > 0),
      true
    );
  }

  const courageTriggers = allVirtueTriggers.filter((event) => event.virtue === 'courage');

  for (const kind of ['aegis', 'stability']) {
    assert.equal(
      allVirtues.events.filter(
        (event) =>
          event.type === 'buff' &&
          event.skillName === 'Crashing Courage' &&
          event.kind === kind &&
          String(event.name || '').startsWith('Crashing Courage — Triggered')
      ).length,
      courageTriggers.length
    );
  }

  const phoenixResolveTriggers = phoenix.events.filter(
    (event) => event.type === 'guardian.willbender-virtue-triggered' && event.virtue === 'resolve'
  );
  const phoenixActivationAlacrity = phoenix.events.filter(
    (event) => event.type === 'buff' && event.name === 'Phoenix Protocol — Activation Alacrity'
  );
  const phoenixTriggeredAlacrity = phoenix.events.filter(
    (event) => event.type === 'buff' && event.name === 'Phoenix Protocol — Alacrity'
  );

  assert.deepEqual(
    phoenixActivationAlacrity.map((event) => [
      event.duration,
      event.recipients,
      event.affectsSelf,
      event.alliedPlayerCount
    ]),
    [[5, 'self', true, 0]]
  );
  assert.equal(phoenixResolveTriggers.length > 0, true);
  assert.equal(phoenixTriggeredAlacrity.length, phoenixResolveTriggers.length);
  assert.deepEqual(
    phoenixTriggeredAlacrity.map((event) => [event.at, event.duration, event.affectsSelf, event.alliedPlayerCount]),
    phoenixResolveTriggers.map((event) => [event.at, 1, true, 0])
  );
  assert.equal(
    phoenixTriggeredAlacrity.every((event) => event.triggeredBy != null && String(event.triggeredBy).length > 0),
    true
  );
});

test('Willbender Flames use a separate stochastic weapon-strength activation from their virtue', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', { type: 'wait', durationMs: 6000 }],
    config: {
      ...config,
      specialization: 'Willbender',
      randomness: { mode: 'stochastic', seed: 1 }
    }
  });
  const virtue = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Rushing Justice'
  );
  const flames = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Willbender Flames'
  );

  assert.equal(virtue.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.equal(flames.length, 5);
  assert.notEqual(flames[0].activationId, virtue.activationId);
  assert.equal(new Set(flames.map((event) => event.activationId)).size, 1);
  assert.equal(
    flames.every((event) => event.weaponStrengthProfileId === 'nonweapon.unequipped'),
    true
  );
});

test('Guardian symbols and persistent attacks resolve after their casts', () => {
  const symbol = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Resolution', { type: 'wait', durationMs: 4000 }],
    config: { ...config, primaryWeapon: 'Greatsword' }
  });
  const procession = simulateGw2({
    profession: guardianProfession,
    rotation: ['Procession of Blades', { type: 'wait', durationMs: 5000 }],
    config: {
      ...config,
      specialization: 'Dragonhunter'
    }
  });

  assert.equal(
    symbol.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Symbol of Resolution')
      .length,
    5
  );
  assert.equal(
    procession.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Procession of Blades')
      .length,
    10
  );
});

test('Guardian autoattack chains and torch flips enforce sequence state', () => {
  const invalidChain = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike', 'Faithful Strike'],
    config: { ...config, primaryWeapon: 'Mace' }
  });
  const chain = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike', 'Pure Strike', 'Faithful Strike'],
    config: { ...config, primaryWeapon: 'Mace' }
  });
  const invalidFlip = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Fire"],
    config: {
      ...config,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Torch'
    }
  });
  const flip = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Flame", "Zealot's Fire", { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Torch'
    }
  });

  assert.match(invalidChain.warnings.join(' '), /Faithful Strike is unavailable — cast Pure Strike first\./);
  assert.equal(chain.resolvedEvents.filter((event) => event.type === 'damage').length, 3);
  assert.match(invalidFlip.warnings.join(' '), /Zealot's Fire is unavailable — not currently armed\./);
  assert.ok(flip.strikeDamage > 0);
  assert.ok(flip.conditionDamage > 0);
});

test("Radiant Fire upgrades Zealot's Flame duration, recharge, and ammo", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Zealot's Flame",
      "Zealot's Fire",
      "Zealot's Flame",
      "Zealot's Fire",
      "Zealot's Flame",
      "Zealot's Fire",
      { type: 'wait', durationMs: 4000 }
    ],
    config: {
      ...config,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      boons: { quickness: true },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RADIANT_FIRE]
    }
  });
  const flameActions = result.events.filter((event) => event.type === 'action' && event.skillName === "Zealot's Flame");
  const flameBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === "Zealot's Flame" && event.condition === 'Burning'
  );
  const fireBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === "Zealot's Fire" && event.condition === 'Burning'
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    flameActions.map((event) => event.at),
    [0, 0.68, 12]
  );
  assert.equal(result.endState.ammo["Zealot's Flame"].maximum, 2);
  assert.equal(flameBurns.length, 12);
  assert.deepEqual(
    flameBurns.filter((event) => event.activationId === flameActions[0].activationId).map((event) => event.at),
    [0, 1, 2, 3]
  );
  assert.equal(
    flameBurns.every((event) => Math.abs(event.effectiveDuration - 5.4) < 1e-9),
    true
  );
  assert.equal(
    fireBurns.every((event) => event.stacks === 3 && Math.abs(event.effectiveDuration - 3.6) < 1e-9),
    true
  );
});

test('Guardian damage traits use resolver-time target state', () => {
  const baseline = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Flame", 'True Strike', { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      primaryWeapon: 'Mace',
      secondaryWeapon: 'Torch'
    }
  });
  const traited = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Flame", 'True Strike', { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      primaryWeapon: 'Mace',
      secondaryWeapon: 'Torch',
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.FIERY_WRATH,
        GUARDIAN_TRAIT_IDS.RADIANT_POWER,
        GUARDIAN_TRAIT_IDS.RADIANT_FIRE,
        GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH
      ]
    }
  });

  assert.ok(traited.strikeDamage > baseline.strikeDamage);
  assert.ok(traited.conditionDamage > baseline.conditionDamage);
});

test('Renewed Focus recharges all three core virtues', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice', 'Virtue of Resolve', 'Virtue of Courage', 'Renewed Focus'],
    config
  });

  assert.equal(Object.hasOwn(result.endState.cooldowns, 'Virtue of Justice'), false);
  assert.equal(Object.hasOwn(result.endState.cooldowns, 'Virtue of Resolve'), false);
  assert.equal(Object.hasOwn(result.endState.cooldowns, 'Virtue of Courage'), false);
  assert.deepEqual(result.endState.profession.virtueReadyAt, {
    justice: 2,
    resolve: 2,
    courage: 2
  });
});

test('every catalog skill has executable mechanics', () => {
  assert.equal(
    guardianCatalog.skills.every((skill) => skill.implemented === true),
    true
  );
  assert.equal(guardianCatalog.skillsByName.has('Chapter 1: Searing Spell'), true);
  assert.equal(guardianCatalog.skillsByName.has('Dazzling Hammer'), true);

  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Hammer Swing'],
    config: { ...config, primaryWeapon: 'Hammer' }
  });

  assert.ok(result.totalDamage > 0);
  assert.deepEqual(result.warnings, []);
});

test('API mode aliases are not exposed as parent-child skill flips', () => {
  for (const name of ['Sword of Justice', '"Feel My Wrath!"']) {
    const variants = guardianCatalog.skills.filter((skill) => skill.name === name);

    assert.equal(variants.length, 2);
    assert.equal(
      variants.every((skill) => skill.flipParentId == null),
      true
    );
  }
});

test('non-DPS Guardian slot skills are excluded from the simulator surface', () => {
  const excludedNames = [
    '"Advance!"',
    '"Save Yourselves!"',
    '"Hold the Line!"',
    'Signet of Mercy',
    'Merciful Intervention',
    'Wall of Reflection',
    'Contemplation of Purity',
    '"Stand Your Ground!"',
    'Valorous Stance',
    'Stalwart Stance',
    'Mantra of Lore',
    'Hallowed Ground',
    'Bow of Truth'
  ];

  for (const name of excludedNames) {
    assert.equal(guardianCatalog.skillsByName.get(name)?.simulatorExcluded, true, name);
  }

  const migrated = migrateGuardianBuild({
    ...createGuardianBuildDefaults(),
    selectedSkills: {
      ...createGuardianBuildDefaults().selectedSkills,
      Utility1: 'Contemplation of Purity'
    }
  });

  assert.notEqual(migrated.selectedSkills.Utility1, 'Contemplation of Purity');
});

test('Guardian results advance to cooldown expiry before recasting', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'True Strike',
      { type: 'wait', durationMs: 1000 },
      'Pure Strike',
      'Virtue of Justice',
      'Virtue of Justice'
    ],
    config: { ...config, primaryWeapon: 'Mace' }
  });

  assert.deepEqual(
    result.steps.map((step) => ({
      ri: step.ri,
      skill: step.skill,
      start: step.start,
      end: step.end,
      invalid: Boolean(step.invalid)
    })),
    [
      { ri: 0, skill: 'True Strike', start: 0, end: 500, invalid: false },
      { ri: 1, skill: 'Wait', start: 500, end: 1500, invalid: false },
      { ri: 2, skill: 'Pure Strike', start: 1500, end: 2000, invalid: false },
      {
        ri: 3,
        skill: 'Virtue of Justice',
        start: 2000,
        end: 2000,
        invalid: false
      },
      {
        ri: 4,
        skill: 'Virtue of Justice',
        start: 22000,
        end: 22000,
        invalid: false
      }
    ]
  );
  assert.equal(result.endState.cooldowns['Virtue of Justice'].readyAt, 42000);
  assert.deepEqual(result.warnings, []);
});

test('Firebrand tomes consume shared pages and execute tome damage', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 4: Scorched Aftermath',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'True Strike',
      { type: 'wait', durationMs: 6000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      initialTomePages: 5
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.tomePages, 4);
  assert.equal(result.endState.profession.ashesCharges, 0);
  assert.ok(result.conditionBreakdown.some((row) => row.name === 'Burning'));
  assert.ok(result.conditionBreakdown.some((row) => row.name === 'Bleeding'));
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Ashes of the Just'),
    true
  );
});

test('Firebrand tome chapters use their reference packets and cooldowns', () => {
  const firebrandConfig = {
    ...config,
    specialization: 'Firebrand',
    maximumTomePages: 8,
    initialTomePages: 8
  };
  const justice = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 2: Igniting Burst',
      'Chapter 3: Heated Rebuke',
      'Chapter 4: Scorched Aftermath',
      { type: 'wait', durationMs: 5000 }
    ],
    config: firebrandConfig
  });
  const coefficients = (skillId) =>
    justice.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === skillId)
      .reduce((sum, event) => sum + event.coefficient, 0);
  const condition = (skillId, name) =>
    justice.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === skillId && event.condition === name
    );

  assert.equal(coefficients(GUARDIAN_SKILL_IDS.SEARING_SPELL), 0.95);
  assert.equal(coefficients(GUARDIAN_SKILL_IDS.IGNITING_BURST), 0.55);
  assert.equal(coefficients(GUARDIAN_SKILL_IDS.HEATED_REBUKE), 0.45);
  assert.equal(Number(coefficients(GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH).toFixed(6)), 3.2);
  assert.deepEqual(
    justice.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH)
      .map((event) => event.coefficient),
    [0.64, 0.64, 0.64, 0.64, 0.64]
  );
  assert.deepEqual(
    {
      stacks: condition(GUARDIAN_SKILL_IDS.SEARING_SPELL, 'Vulnerability').stacks,
      duration: condition(GUARDIAN_SKILL_IDS.SEARING_SPELL, 'Vulnerability').duration
    },
    { stacks: 2, duration: 10 }
  );
  assert.equal(condition(GUARDIAN_SKILL_IDS.IGNITING_BURST, 'Weakness').duration, 4);
  assert.equal(
    justice.events.find((event) => event.type === 'control' && event.skillId === GUARDIAN_SKILL_IDS.HEATED_REBUKE)
      .controlKind,
    'pull'
  );
  assert.equal(
    justice.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' &&
        event.skillId === GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH &&
        event.condition === 'Burning'
    ).length,
    5
  );
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH).comboFields[0].fieldType, 'Fire');

  const resolve = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Resolve',
      'Chapter 1: Desert Bloom',
      'Chapter 2: Radiant Recovery',
      'Chapter 3: Azure Sun',
      'Chapter 4: Shining River',
      'Epilogue: Eternal Oasis',
      { type: 'wait', durationMs: 5000 }
    ],
    config: firebrandConfig
  });
  const resolveBuffs = (skillId, kind) =>
    resolve.events.filter((event) => event.type === 'buff' && event.skillId === skillId && event.kind === kind);

  assert.equal(resolveBuffs(GUARDIAN_SKILL_IDS.AZURE_SUN, 'vigor')[0].duration, 5);
  assert.equal(resolveBuffs(GUARDIAN_SKILL_IDS.AZURE_SUN, 'regeneration')[0].duration, 6);
  assert.equal(resolveBuffs(GUARDIAN_SKILL_IDS.AZURE_SUN, 'swiftness')[0].duration, 5);
  assert.equal(resolveBuffs(GUARDIAN_SKILL_IDS.SHINING_RIVER, 'swiftness').length, 5);

  const courage = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Courage',
      'Chapter 1: Unflinching Charge',
      'Chapter 2: Daring Challenge',
      'Chapter 3: Valiant Bulwark',
      'Chapter 4: Stalwart Stand',
      'Epilogue: Unbroken Lines',
      { type: 'wait', durationMs: 4000 }
    ],
    config: firebrandConfig
  });
  const courageBuffs = (skillId, kind) =>
    courage.events.filter((event) => event.type === 'buff' && event.skillId === skillId && event.kind === kind);

  assert.equal(
    courage.events
      .filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.DARING_CHALLENGE)
      .reduce((sum, event) => sum + event.coefficient, 0),
    1.4
  );
  assert.deepEqual(
    courage.events
      .filter((event) => event.type === 'control' && event.skillId === GUARDIAN_SKILL_IDS.DARING_CHALLENGE)
      .map((event) => [event.controlKind, event.duration]),
    [['taunt', 2]]
  );
  assert.equal(courageBuffs(GUARDIAN_SKILL_IDS.STALWART_STAND, 'resistance').length, 4);
  assert.deepEqual(
    ['protection', 'stability', 'aegis', 'toughness'].map((kind) => [
      kind,
      courageBuffs(GUARDIAN_SKILL_IDS.UNBROKEN_LINES, kind)[0].duration
    ]),
    [
      ['protection', 5],
      ['stability', 5],
      ['aegis', 4],
      ['toughness', 5]
    ]
  );
  assert.equal(courageBuffs(GUARDIAN_SKILL_IDS.UNBROKEN_LINES, 'toughness')[0].stacks, 300);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.VALIANT_BULWARK).cooldown, 15);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.STALWART_STAND).cooldown, 20);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.UNBROKEN_LINES).cooldown, 25);
});

test('Ashes of the Just grants party charges using Firebrand condition stats', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'True Strike',
      { type: 'wait', durationMs: 3000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RADIANT_FIRE],
      allies: { count: 4, strikesPerSecond: 1 }
    }
  });
  const ashesBuff = result.events.find((event) => event.type === 'buff' && event.kind === 'ashes-of-the-just');
  const might = result.events.find(
    (event) => event.type === 'buff' && event.skillId === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST && event.kind === 'might'
  );
  const allyBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && event.triggeredByAlly
  );
  const personalBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && !event.triggeredByAlly
  );

  assert.deepEqual(
    {
      stacks: ashesBuff.stacks,
      duration: ashesBuff.duration,
      recipients: ashesBuff.recipientCount
    },
    { stacks: 2, duration: 10, recipients: 5 }
  );
  assert.deepEqual(
    {
      stacks: might.stacks,
      duration: might.duration,
      recipients: might.recipientCount
    },
    { stacks: 8, duration: 10, recipients: 5 }
  );
  assert.equal(allyBurns.length, 8);
  assert.equal(personalBurns.length, 1);
  assert.ok(allyBurns.every((event) => event.duration === 2 && event.effectiveDuration === 2.4));
  assert.ok(personalBurns.every((event) => event.duration === 2 && event.effectiveDuration === 2.4));
  assert.ok(result.conditionDamage > 0);
});

test('Ashes of the Just cannot trigger before its application event', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'True Strike',
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'Symbol of Faith',
      { type: 'wait', durationMs: 2000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      initialTomePages: 5
    }
  });
  const ashesAppliedAt = result.events.find(
    (event) => event.type === 'guardian.tome-page-used' && event.skillId === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST
  ).at;
  const ashes = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
  );

  assert.ok(ashes.length > 0);
  assert.ok(ashes.every((event) => event.at >= ashesAppliedAt));
});

test('later tome pages do not restore consumed Ashes charges', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Chapter 2: Igniting Burst',
      'Stow Tome',
      'True Strike',
      'Pure Strike',
      'Faithful Strike',
      { type: 'wait', durationMs: 2000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      allies: { count: 0, strikesPerSecond: 1 }
    }
  });
  const personalBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && !event.triggeredByAlly
  );

  assert.equal(personalBurns.length, 2);
  assert.equal(result.endState.profession.ashesCharges, 0);
});

test('Firebrand page exhaustion stows the tome and pages regenerate', () => {
  const exhausted = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Resolve',
      'Epilogue: Eternal Oasis',
      'Chapter 1: Desert Bloom',
      { type: 'wait', durationMs: 8000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 2
    }
  });
  const traited = simulateGw2({
    profession: guardianProfession,
    rotation: [],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS, GUARDIAN_TRAIT_IDS.LOREMASTER]
    }
  });

  assert.match(exhausted.warnings.join(' '), /Chapter 1: Desert Bloom is unavailable/);
  assert.equal(exhausted.endState.profession.activeTome, '');
  assert.equal(exhausted.endState.profession.tomePages, 1);
  assert.equal(traited.endState.profession.maximumTomePages, 8);
  assert.equal(traited.endState.profession.tomePages, 8);
  assert.equal(traited.endState.profession.tomePageInterval, 5);
});

test('Firebrand page exhaustion injects a timeline stow and closes its lane', () => {
  const rotation = ['Tome of Resolve', 'Epilogue: Eternal Oasis', 'True Strike'];
  const firebrandConfig = {
    ...config,
    specialization: 'Firebrand',
    primaryWeapon: 'Mace',
    initialTomePages: 2
  };
  const result = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: firebrandConfig
  });

  assert.deepEqual(automaticTomeStowTimelineMarkers(result, rotation.length), [
    {
      insertionIndex: 2,
      skill: 'Stow Tome',
      start: 200,
      detail: 'page exhaustion'
    }
  ]);
  const transition = guardianProfession.ui.timelineWeaponLineTransition;
  const rows = timelineWeaponRows(rotation, {
    weaponLineEndIndexes: new Set(
      automaticTomeStowTimelineMarkers(result, rotation.length).map((marker) => marker.insertionIndex)
    ),
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: guardianCatalog.skillsByName.get(name),
        specialization: 'Firebrand',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Tome of Resolve', null]
  );
});

test('Firebrand tome page cost waits for a regenerating page', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Resolve',
      // Epilogue: Eternal Oasis costs two pages; starting at one page it must
      // wait for the next scheduled page rather than being discarded.
      'Epilogue: Eternal Oasis'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 1
    }
  });

  const epilogue = result.steps.find((step) => step.skill === 'Epilogue: Eternal Oasis');

  assert.deepEqual(result.warnings, []);
  assert.ok(epilogue && !epilogue.invalid);
  // The first page lands at the 8s interval, so the cast is delayed to it.
  assert.ok(epilogue.start >= 8000);
  assert.equal(result.endState.profession.activeTome, '');
});

test('Firebrand axe skills and Unrelenting Criticism use reference packets', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Core Cleave',
      'Bleeding Edge',
      'Searing Slash',
      'Symbol of Vengeance',
      'Blazing Edge',
      { type: 'wait', durationMs: 5000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Axe',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.UNRELENTING_CRITICISM]
    }
  });
  const packet = (skillId) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);
  const coefficient = (skillId) => packet(skillId).reduce((sum, event) => sum + event.coefficient, 0);

  assert.deepEqual(
    [
      [packet(GUARDIAN_SKILL_IDS.CORE_CLEAVE).length, coefficient(GUARDIAN_SKILL_IDS.CORE_CLEAVE)],
      [packet(GUARDIAN_SKILL_IDS.BLEEDING_EDGE).length, coefficient(GUARDIAN_SKILL_IDS.BLEEDING_EDGE)],
      [packet(GUARDIAN_SKILL_IDS.SEARING_SLASH).length, coefficient(GUARDIAN_SKILL_IDS.SEARING_SLASH)],
      [packet(GUARDIAN_SKILL_IDS.SYMBOL_OF_VENGEANCE).length, coefficient(GUARDIAN_SKILL_IDS.SYMBOL_OF_VENGEANCE)],
      [packet(GUARDIAN_SKILL_IDS.BLAZING_EDGE).length, coefficient(GUARDIAN_SKILL_IDS.BLAZING_EDGE)]
    ],
    [
      [2, 0.72],
      [2, 0.72],
      [2, 2.4],
      [5, 3],
      [1, 0.8]
    ]
  );
  const criticism = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name === 'Unrelenting Criticism — Bleeding'
  );

  assert.equal(criticism.length, 12);
  assert.ok(criticism.every((event) => event.duration === 4.5));
  assert.equal(
    result.events.filter(
      (event) =>
        event.type === 'buff' && event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_VENGEANCE && event.kind === 'fury'
    ).length,
    5
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'control' &&
        event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_VENGEANCE &&
        event.controlKind === 'daze'
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'control' && event.skillId === GUARDIAN_SKILL_IDS.BLAZING_EDGE && event.controlKind === 'pull'
    ),
    true
  );
});

test('Condition Firebrand uses configured cast and strike packet timings', () => {
  const profile = (result, skillName) => {
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return {
      cast: Math.round((action.endsAt - action.at) * 1000),
      packets: result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillName === skillName)
        .map((event) => Math.round((event.at - action.at) * 1000))
    };
  };

  const firebrandConfig = {
    ...config,
    specialization: 'Firebrand',
    boons: { quickness: true }
  };
  const axe = simulateGw2({
    profession: guardianProfession,
    rotation: ['Core Cleave', 'Bleeding Edge', 'Searing Slash'],
    config: { ...firebrandConfig, primaryWeapon: 'Axe' }
  });
  const pistol = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Hail of Justice',
      'Peacekeeper',
      'Symbol of Ignition',
      'Through the Heart',
      { type: 'wait', durationMs: 3000 }
    ],
    config: {
      ...firebrandConfig,
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Pistol'
    }
  });
  const tome = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Purging Flames',
      'Tome of Justice',
      'Chapter 4: Scorched Aftermath',
      { type: 'wait', durationMs: 5000 }
    ],
    config: firebrandConfig
  });
  const cleansing = simulateGw2({
    profession: guardianProfession,
    rotation: ['Cleansing Flame'],
    config: {
      ...firebrandConfig,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch'
    }
  });

  assert.deepEqual(profile(axe, 'Core Cleave'), {
    cast: 640,
    packets: [360, 600]
  });
  assert.deepEqual(profile(axe, 'Bleeding Edge'), {
    cast: 680,
    packets: [480, 640]
  });
  assert.deepEqual(profile(axe, 'Searing Slash'), {
    cast: 640,
    packets: [480, 640]
  });
  assert.deepEqual(profile(pistol, 'Hail of Justice'), {
    cast: 1120,
    packets: [280, 440, 640, 800, 960]
  });
  assert.deepEqual(profile(pistol, 'Peacekeeper'), {
    cast: 1040,
    packets: [280, 480, 640, 800, 960]
  });
  assert.deepEqual(profile(pistol, 'Symbol of Ignition'), {
    cast: 360,
    packets: [280, 960, 1640, 2320, 3000]
  });
  assert.deepEqual(profile(pistol, 'Through the Heart'), {
    cast: 600,
    packets: [360]
  });
  assert.deepEqual(profile(tome, 'Purging Flames'), {
    cast: 320,
    packets: [320, 1320, 2320, 3320, 4320, 5320]
  });
  assert.deepEqual(profile(tome, 'Chapter 4: Scorched Aftermath'), {
    cast: 920,
    packets: [440, 1440, 2440, 3440, 4440]
  });
  assert.deepEqual(profile(cleansing, 'Cleansing Flame'), {
    cast: 2600,
    packets: [260, 520, 780, 1040, 1300, 1560, 1820, 2080, 2340, 2600]
  });
  assert.equal(
    cleansing.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Cleansing Flame').length,
    10
  );
  assert.ok(
    Math.abs(
      cleansing.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillName === 'Cleansing Flame')
        .reduce((sum, event) => sum + event.coefficient, 0) - 4
    ) < 1e-9
  );
  assert.equal(
    cleansing.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Cleansing Flame' &&
        event.condition === 'Burning' &&
        event.stacks === 2 &&
        event.duration === 4 &&
        Math.abs(
          event.at -
            cleansing.events.find(
              (candidate) => candidate.type === 'action' && candidate.skillName === 'Cleansing Flame'
            ).endsAt
        ) < 1e-9
    ),
    true
  );
});

test('Guardian scepter skills use reference cast times and Symbol of Punishment packets', () => {
  const scepterConfig = {
    ...config,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol',
    boons: { quickness: true }
  };
  const baseline = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Punishment', 'Orb of Wrath', { type: 'wait', durationMs: 5000 }],
    config: scepterConfig
  });
  const writ = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Punishment', { type: 'wait', durationMs: 7000 }],
    config: {
      ...scepterConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.WRIT_OF_PERSISTENCE]
    }
  });
  const recharge = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Punishment', 'Symbol of Punishment'],
    config: scepterConfig
  });
  const symbolAction = baseline.events.find(
    (event) => event.type === 'action' && event.skillName === 'Symbol of Punishment'
  );
  const orbAction = baseline.events.find((event) => event.type === 'action' && event.skillName === 'Orb of Wrath');
  const symbolDamage = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Symbol of Punishment');
  const baseDamage = symbolDamage(baseline);
  const writDamage = symbolDamage(writ);
  const baseBreakdown = baseline.breakdown.find((entry) => entry.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT);
  const writBreakdown = writ.breakdown.find((entry) => entry.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT);
  const symbolMight = baseline.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Symbol of Punishment' && event.kind === 'might'
  );
  const symbolField = baseline.events.find(
    (event) => event.type === 'combo_field' && event.skillName === 'Symbol of Punishment'
  );

  assert.equal(Math.round((symbolAction.endsAt - symbolAction.at) * 1000), 320);
  assert.equal(Math.round((orbAction.endsAt - orbAction.at) * 1000), 440);
  assert.equal(
    baseline.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Orb of Wrath').coefficient,
    0.6
  );
  assert.deepEqual(
    baseDamage.map((event) => Math.round((event.at - symbolAction.at) * 1000)),
    [240, 760, 1240, 1240, 1760, 2240, 2240, 2760, 3240, 3240, 3760, 4240]
  );
  assert.ok(Math.abs(baseDamage.reduce((sum, event) => sum + event.coefficient, 0) - 3.6) < 1e-9);
  assert.equal(baseBreakdown.hits, 12);
  assert.equal(writDamage.length, 18);
  assert.ok(Math.abs(writDamage.reduce((sum, event) => sum + event.coefficient, 0) - 5.4) < 1e-9);
  assert.equal(writBreakdown.hits, 18);
  assert.equal(symbolMight.length, 5);
  assert.equal(
    symbolMight.every((event) => event.stacks === 4 && event.duration === 5),
    true
  );
  assert.equal(symbolField.fieldType, 'Light');
  assert.equal(Math.round((symbolField.at - symbolAction.at) * 1000), 240);
  assert.equal(symbolField.expiresAt - symbolField.at, 4);
  assert.equal(
    writ.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Symbol of Punishment' && event.kind === 'might'
    ).length,
    7
  );
  assert.deepEqual(
    writ.events
      .filter((event) => event.type === 'combo_field' && event.skillName === 'Symbol of Punishment')
      .map((event) => [event.at, event.expiresAt]),
    [
      [0.24, 4.24],
      [4.24, 6.24]
    ]
  );
  assert.deepEqual(
    recharge.events
      .filter((event) => event.type === 'action' && event.skillName === 'Symbol of Punishment')
      .map((event) => event.at),
    [0, 10.32]
  );
});

test('Guardian pistol conditions and Symbol of Ignition use full packets', () => {
  const pistolConfig = {
    ...config,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol',
    boons: { quickness: true }
  };
  const packets = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Hail of Justice',
      'Hail of Justice',
      'Peacekeeper',
      'Through the Heart',
      'Jurisdiction',
      { type: 'wait', durationMs: 8000 }
    ],
    config: pistolConfig
  });
  const ignition = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Ignition', 'Peacekeeper', { type: 'wait', durationMs: 5000 }],
    config: pistolConfig
  });
  const conditions = (result, skillName, condition) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === skillName && event.condition === condition
    );

  assert.deepEqual(packets.warnings, []);
  assert.deepEqual(
    packets.events
      .filter((event) => event.type === 'action' && event.skillName === 'Hail of Justice')
      .map((event) => event.at),
    [0, 2.12]
  );
  assert.equal(conditions(packets, 'Hail of Justice', 'Bleeding').length, 10);
  assert.equal(conditions(packets, 'Hail of Justice', 'Crippled').length, 10);
  assert.equal(
    conditions(packets, 'Hail of Justice', 'Crippled').every(
      (event) => event.duration === 1 && event.projectile === true
    ),
    true
  );
  assert.equal(conditions(packets, 'Peacekeeper', 'Burning').length, 5);
  assert.equal(
    conditions(packets, 'Peacekeeper', 'Burning').every((event) => event.duration === 1.5),
    true
  );
  assert.equal(conditions(packets, 'Through the Heart', 'Bleeding').length, 1);
  assert.equal(conditions(packets, 'Through the Heart', 'Bleeding')[0].duration, 8);
  assert.equal(
    conditions(packets, 'Jurisdiction', 'Burning').some((event) => event.stacks === 5 && event.duration === 6),
    true
  );
  assert.equal(
    packets.events.some(
      (event) => event.type === 'control' && event.skillName === 'Jurisdiction' && event.controlKind === 'stun'
    ),
    true
  );

  const symbolDamage = ignition.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Symbol of Ignition'
  );
  const symbolMight = ignition.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Symbol of Ignition' && event.kind === 'might'
  );
  const ignitions = conditions(ignition, 'Symbol of Ignition', 'Burning');
  const symbolAction = ignition.events.find(
    (event) => event.type === 'action' && event.skillName === 'Symbol of Ignition'
  );

  assert.equal(symbolDamage.length, 5);
  assert.equal(
    symbolDamage.reduce((sum, event) => sum + event.coefficient, 0),
    2
  );
  assert.equal(symbolMight.length, 5);
  assert.equal(
    symbolMight.every((event) => event.duration === 5),
    true
  );
  assert.equal(ignitions.length, 3);
  assert.equal(
    ignitions.every((event) => event.duration === 1),
    true
  );
  assert.equal(symbolAction.comboFields[0].fieldType, 'Light');
  assert.equal(symbolAction.comboFields[0].duration, 4);
});

test('Peacekeeper begins its six-second recharge when its cast starts', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Peacekeeper', 'Peacekeeper'],
    config: {
      ...config,
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Pistol',
      boons: { quickness: true, alacrity: true }
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'action' && event.skillName === 'Peacekeeper')
      .map((event) => event.at),
    [0, 4.8]
  );
});

test('Signet of Wrath loses its passive condition damage while recharging', () => {
  const throughDamage = (result) =>
    result.breakdown.find((entry) => entry.name.startsWith('Through the Heart') && entry.conditionDamage > 0)
      .conditionDamage;
  const baseConfig = {
    ...config,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol'
  };
  const withoutSignet = simulateGw2({
    profession: guardianProfession,
    rotation: ['Through the Heart', { type: 'wait', durationMs: 9000 }],
    config: baseConfig
  });
  const passive = simulateGw2({
    profession: guardianProfession,
    rotation: ['Through the Heart', { type: 'wait', durationMs: 9000 }],
    config: { ...baseConfig, selectedSkills: ['Signet of Wrath'] }
  });
  const recharging = simulateGw2({
    profession: guardianProfession,
    rotation: ['Signet of Wrath', 'Through the Heart', 'Signet of Wrath', { type: 'wait', durationMs: 9000 }],
    config: { ...baseConfig, selectedSkills: ['Signet of Wrath'] }
  });
  const signetConditions = recharging.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Signet of Wrath'
  );

  assert.ok(throughDamage(passive) > throughDamage(withoutSignet));
  assert.ok(Math.abs(throughDamage(recharging) - throughDamage(withoutSignet)) < 1e-9);
  assert.deepEqual(
    recharging.events
      .filter((event) => event.type === 'action' && event.skillName === 'Signet of Wrath')
      .map((event) => event.at),
    [0, 19]
  );
  assert.equal(
    signetConditions.some((event) => event.condition === 'Burning' && event.stacks === 3 && event.duration === 5),
    true
  );
  assert.equal(
    signetConditions.some((event) => event.condition === 'Immobilized' && event.duration === 6),
    true
  );
});

test('Firebrand mantras resolve normal and final charges with full recharge', () => {
  const flame = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush', 'Flame Surge', { type: 'wait', durationMs: 15800 }, 'Flame Rush'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame'],
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS],
      boons: { alacrity: true }
    }
  });
  const flameConditions = flame.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.condition === 'Burning' &&
      ['Flame Rush', 'Flame Surge'].includes(event.skillName)
  );

  assert.deepEqual(
    flame.steps.filter((step) => ['Flame Rush', 'Flame Surge'].includes(step.skill)).map((step) => step.start),
    [0, 1000, 2000, 18000]
  );
  assert.deepEqual(
    flameConditions.map((event) => [event.skillName, event.stacks, event.duration]),
    [
      ['Flame Rush', 1, 12],
      ['Flame Rush', 1, 12],
      ['Flame Surge', 3, 12],
      ['Flame Rush', 1, 12]
    ]
  );
  assert.equal(flame.procSteps.filter((step) => step.skill === 'Weighty Terms').length, 1);

  const support = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Restoring Reprieve',
      'Restoring Reprieve',
      'Rejuvenating Respite',
      'Potent Haste',
      'Potent Haste',
      'Overwhelming Celerity',
      'Portent of Freedom',
      'Portent of Freedom',
      'Unhindered Delivery'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Solace', 'Mantra of Potence', 'Mantra of Liberation'],
      allies: { count: 4, strikesPerSecond: 1 }
    }
  });
  const boonsFor = (skillName) =>
    support.events
      .filter((event) => event.type === 'buff' && event.skillName === skillName)
      .map((event) => [event.kind, event.stacks, event.duration]);

  assert.deepEqual(boonsFor('Rejuvenating Respite'), [
    ['aegis', 1, 2],
    ['protection', 1, 3],
    ['resolution', 1, 3]
  ]);
  assert.deepEqual(boonsFor('Overwhelming Celerity'), [
    ['quickness', 1, 5],
    ['might', 8, 10]
  ]);
  assert.deepEqual(boonsFor('Unhindered Delivery'), [
    ['resolution', 1, 8],
    ['stability', 5, 8],
    ['swiftness', 1, 5]
  ]);
  assert.deepEqual(support.warnings, []);
});

test('Firebrand mantra parents and charged skills use distinct cast states', () => {
  const solace = guardianCatalog.skillsByName.get('Mantra of Solace');
  const reprieve = guardianCatalog.skillsByName.get('Restoring Reprieve');
  const respite = guardianCatalog.skillsByName.get('Rejuvenating Respite');
  const flame = guardianCatalog.skillsByName.get('Mantra of Flame');
  const rush = guardianCatalog.skillsByName.get('Flame Rush');
  const surge = guardianCatalog.skillsByName.get('Flame Surge');

  assert.equal(solace.castTimeMs, 2240);
  assert.equal(flame.castTimeMs, 2240);
  assert.equal(reprieve.castTimeMs, 0);
  assert.equal(respite.castTimeMs, 0);
  assert.equal(rush.castTimeMs, 0);
  assert.equal(surge.castTimeMs, 0);
  assert.equal(reprieve.flipParentId, solace.id);
  assert.equal(respite.flipParentId, reprieve.id);
  assert.equal(rush.flipParentId, flame.id);
  assert.equal(surge.flipParentId, rush.id);

  const normal = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.ok(normal.endState.profession.availableFlips[rush.id]);
  assert.equal(normal.endState.profession.availableFlips[surge.id], undefined);
  assert.equal(normal.endState.ammo['Flame Rush'].charges, 2);

  const final = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.equal(final.endState.profession.availableFlips[rush.id], undefined);
  assert.ok(final.endState.profession.availableFlips[surge.id]);

  const depleted = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush', 'Flame Surge'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.equal(depleted.endState.profession.availableFlips[rush.id], undefined);
  assert.equal(depleted.endState.profession.availableFlips[surge.id], undefined);
  assert.equal(depleted.endState.ammo['Flame Rush'], undefined);
  assert.ok(depleted.endState.cooldowns['Mantra of Flame'].remaining > 0);
});

test('Firebrand tome transitions are weapon swaps and timeline row changes', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Stow Tome', 'Tome of Resolve', 'Stow Tome'],
    config: { ...config, specialization: 'Firebrand' }
  });

  assert.deepEqual(
    result.events.filter((event) => event.type === 'weapon_set').map((event) => [event.skillName, event.mechanicSwap]),
    [
      ['Tome of Justice', true],
      ['Stow Tome', true],
      ['Tome of Resolve', true],
      ['Stow Tome', true]
    ]
  );

  const transition = guardianProfession.ui.timelineWeaponLineTransition;
  const rotation = [
    'Tome of Justice',
    'Chapter 1: Searing Spell',
    'Stow Tome',
    'True Strike',
    'Tome of Resolve',
    'Stow Tome'
  ];
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: guardianCatalog.skillsByName.get(name),
        specialization: 'Firebrand',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Tome of Justice', null, 'Tome of Resolve']
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0], [1, 2], [3, 4], [5]]
  );
});

test('Feel My Wrath applies split quickness durations and triggers Quickfire', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['"Feel My Wrath!"', '"Feel My Wrath!"', { type: 'wait', durationMs: 2000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['"Feel My Wrath!"'],
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.QUICKFIRE],
      boons: { quickness: true },
      allies: { count: 1, strikesPerSecond: 1 }
    }
  });
  const quickness = result.events.filter(
    (event) => event.type === 'buff' && event.skillName === '"Feel My Wrath!"' && event.kind === 'quickness'
  );

  assert.deepEqual(
    result.steps.filter((step) => step.skill === '"Feel My Wrath!"').map((step) => [step.start, step.end]),
    [
      [0, 400],
      [30400, 30800]
    ]
  );
  assert.deepEqual(
    quickness.map((event) => [event.affectsSelf, event.alliedPlayerCount, event.duration]),
    [
      [false, 1, 3],
      [true, 0, 6],
      [false, 1, 3],
      [true, 0, 6]
    ]
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.skillName === 'Quickfire' && event.triggeredByAlly === 1).length,
    2
  );
  assert.ok(
    result.resolvedEvents.filter((event) => event.skillName === 'Quickfire').every((event) => event.duration === 2)
  );
});

test('Quickfire grants one Ashes charge to a self-only quickness recipient', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Chapter 2: Igniting Burst', { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.QUICKFIRE],
      allies: { count: 0, strikesPerSecond: 0 }
    }
  });
  const quickfireBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && event.duration === 2
  );

  assert.equal(result.procSteps.filter((step) => step.skill === 'Quickfire').length, 1);
  assert.equal(quickfireBurns.length, 1);
  assert.equal(quickfireBurns[0].triggeredByAlly, undefined);
});

test('equipping a dormant tome does not restart its Swift Scholar lockout', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Stow Tome',
      { type: 'wait', durationMs: 1000 },
      'Tome of Justice',
      'Stow Tome',
      { type: 'wait', durationMs: 19000 },
      'Tome of Justice'
    ],
    config: {
      ...config,
      specialization: 'Firebrand'
    }
  });

  assert.equal(
    result.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Tome of Justice' && event.kind === 'quickness'
    ).length,
    2
  );
  assert.equal(result.endState.profession.virtueReadyAt.justice, 40);
  assert.deepEqual(result.warnings, []);
});

test('Firebrand specialization traits drive pages, quickness, and tome bonuses', () => {
  const lore = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 2: Igniting Burst',
      'Chapter 3: Heated Rebuke',
      'Stow Tome',
      'Tome of Justice'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 5,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.LEGENDARY_LORE]
    }
  });

  assert.equal(lore.endState.profession.tomePages, 3);
  assert.equal(
    lore.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Tome of Justice' && event.kind === 'quickness'
    ).length,
    1
  );
  assert.equal(
    lore.events.filter(
      (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.LEGENDARY_LORE && event.kind === 'might'
    ).length,
    3
  );
  assert.ok(
    lore.events
      .filter((event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.LEGENDARY_LORE)
      .every((event) => event.stacks === 2 && event.duration === 10)
  );

  const weighted = simulateGw2({
    profession: guardianProfession,
    rotation: ['Potent Haste', 'Potent Haste', 'Overwhelming Celerity'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Potence'],
      initialTomePages: 1,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS]
    }
  });

  assert.deepEqual(weighted.warnings, []);
  assert.equal(weighted.endState.profession.tomePages, 3);
  assert.deepEqual(
    weighted.resolvedEvents
      .filter((event) => event.type === 'condition' && event.sourceId === GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS)
      .map((event) => [event.condition, event.duration]),
    [['Slow', 1.5]]
  );

  const liberated = simulateGw2({
    profession: guardianProfession,
    rotation: ['Shelter'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Shelter'],
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.LIBERATORS_VOW]
    }
  });

  assert.equal(
    liberated.events.some(
      (event) =>
        event.type === 'buff' &&
        event.kind === 'quickness' &&
        event.sourceId === GUARDIAN_SKILL_IDS.SHELTER &&
        event.duration === 2
    ),
    true
  );
});

test('Firebrand grandmaster support traits react to boons and control', () => {
  const quickfire = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Courage', 'Epilogue: Unbroken Lines', { type: 'wait', durationMs: 2000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      maximumTomePages: 8,
      initialTomePages: 8,
      allies: { count: 1, strikesPerSecond: 1 },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.STALWART_SPEED, GUARDIAN_TRAIT_IDS.QUICKFIRE]
    }
  });

  assert.equal(
    quickfire.procSteps.some((step) => step.skill === 'Stalwart Speed'),
    true
  );
  assert.equal(
    quickfire.procSteps.some((step) => step.skill === 'Quickfire'),
    true
  );
  const stoic = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Courage', 'Chapter 2: Daring Challenge'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR]
    }
  });
  const stoicBuffs = stoic.events.filter(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR
  );

  assert.deepEqual(
    stoicBuffs.map((event) => [event.kind, event.stacks, event.duration]),
    [
      ['resistance', 1, 2],
      ['might', 3, 10]
    ]
  );
});

test('Firebrand dormant passives and Imbued Haste use timeline state', () => {
  const passive = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Wrath', { type: 'wait', durationMs: 80000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Greatsword'
    }
  });

  assert.equal(passive.endState.profession.justicePassiveBurns, 2);
  assert.equal(
    passive.resolvedEvents
      .filter((event) => event.sourceId === 'guardian.justice-passive')
      .every((event) => event.skillId === GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE && event.skillName === 'Tome of Justice'),
    true
  );
  assert.deepEqual(
    passive.events
      .filter(
        (event) =>
          event.type === 'buff' && event.skillId === GUARDIAN_SKILL_IDS.TOME_OF_COURAGE && event.kind === 'aegis'
      )
      .map((event) => event.at),
    [0, 40, 80]
  );

  const tome = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Tome of Justice', 'Chapter 1: Searing Spell', { type: 'wait', durationMs: 3000 }],
      config: {
        ...config,
        specialization: 'Firebrand',
        selectedTraitIds
      }
    });
  const normal = tome([]);
  const imbued = tome([GUARDIAN_TRAIT_IDS.IMBUED_HASTE]);

  assert.ok(imbued.conditionDamage > normal.conditionDamage);
});

test('Luminary Radiant Forge enforces entry and radiant weapon flips', () => {
  const unavailable = simulateGw2({
    profession: guardianProfession,
    rotation: ['Dazzling Hammer'],
    config: { ...config, specialization: 'Luminary' }
  });
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin', 'Glaring Burst'],
    config: { ...config, specialization: 'Luminary' }
  });

  assert.match(unavailable.warnings.join(' '), /Dazzling Hammer is unavailable/);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.radiantForge, true);
  assert.equal(result.endState.profession.radiantWeapon, 'hammer');
  const glaring = result.resolvedEvents.find((event) => event.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST);

  assert.equal(glaring.coefficient, 1);
  assert.equal(glaring.radiantWeapon, 'hammer');
  assert.equal(Object.hasOwn(result.endState.cooldowns, 'Enter Radiant Forge'), false);
  assert.ok(result.totalDamage > 0);
});

test('Guardian weapon and Radiant Forge flips occupy one live palette tile', () => {
  const app = {
    skills: guardianCatalog.skills,
    skillById: guardianCatalog.skillsById,
    profession: guardianProfession,
    results: null
  };
  const displayedIdsAfter = (rotation, skillIds, extraConfig = {}) => {
    app.results = simulateGw2({
      profession: guardianProfession,
      rotation,
      config: { ...config, ...extraConfig }
    });

    return displayedSkillTiles(
      app,
      skillIds.map((skillId) => guardianCatalog.skillsById.get(skillId))
    ).map((skill) => skill.id);
  };

  const hammerTwo = [GUARDIAN_SKILL_IDS.MIGHTY_BLOW, GUARDIAN_SKILL_IDS.GLACIAL_BLOW].map((skillId) =>
    guardianCatalog.skillsById.get(skillId)
  );

  assert.deepEqual(
    guardianProfession.ui.paletteWeaponSkills({ traits: new Set() }, hammerTwo).map((skill) => skill.id),
    [GUARDIAN_SKILL_IDS.MIGHTY_BLOW]
  );
  assert.deepEqual(
    guardianProfession.ui
      .paletteWeaponSkills({ traits: new Set([GUARDIAN_TRAIT_IDS.GLACIAL_HEART]) }, hammerTwo)
      .map((skill) => skill.id),
    [GUARDIAN_SKILL_IDS.GLACIAL_BLOW]
  );

  const shieldParent = GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION;
  const shieldChild = GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION_ID_9224;
  const shieldConfig = { primaryWeapon: 'Mace', secondaryWeapon: 'Shield' };

  assert.deepEqual(displayedIdsAfter([], [shieldParent], shieldConfig), [shieldParent]);
  assert.deepEqual(displayedIdsAfter([{ type: 'cast', skillId: shieldParent }], [shieldParent], shieldConfig), [
    shieldChild
  ]);
  assert.deepEqual(
    displayedIdsAfter(
      [
        { type: 'cast', skillId: shieldParent },
        { type: 'cast', skillId: shieldChild }
      ],
      [shieldParent],
      shieldConfig
    ),
    [shieldParent]
  );

  assert.deepEqual(
    displayedIdsAfter(["Zealot's Flame"], [GUARDIAN_SKILL_IDS.ZEALOTS_FLAME], {
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Torch'
    }),
    [GUARDIAN_SKILL_IDS.ZEALOTS_FIRE]
  );

  assert.deepEqual(
    displayedIdsAfter(
      ['Enter Radiant Forge', 'Dazzling Hammer'],
      [
        GUARDIAN_SKILL_IDS.DAZZLING_HAMMER,
        GUARDIAN_SKILL_IDS.LUMINOUS_STAFF,
        GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
        GUARDIAN_SKILL_IDS.RADIANT_BULWARK
      ],
      { specialization: 'Luminary' }
    ),
    [
      GUARDIAN_SKILL_IDS.SHINING_SPIN,
      GUARDIAN_SKILL_IDS.LUMINOUS_STAFF,
      GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
      GUARDIAN_SKILL_IDS.RADIANT_BULWARK
    ]
  );
});

test('Shining Spin strikes 400 ms into its quickened cast', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'],
    config: {
      ...config,
      specialization: 'Luminary',
      boons: { quickness: true }
    }
  });
  const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Shining Spin');
  const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Shining Spin');

  assert.equal(Math.round((strike.at - action.at) * 1000), 400);
});

test('Luminary Radiant Forge transitions reset weapon autoattack chains', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Strike', 'Enter Radiant Forge', 'Exit Radiant Forge', 'Strike'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.filter((event) => event.type === 'action' && event.skillName === 'Strike').length, 2);
});

test('Radiant Forge strikes use its normalized transform weapon strength', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Enter Radiant Forge',
      'Dazzling Hammer',
      'Shining Spin',
      'Glaring Burst',
      'Luminous Staff',
      'Glaring Burst',
      'Gleaming Blade',
      'Glaring Burst',
      'Lucent Thrust',
      'Radiant Bulwark',
      'Brilliant Slam'
    ],
    config: { ...config, specialization: 'Luminary' }
  });
  const hitsFor = (skillName) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skillName);
  const assertProfile = (skillName, profileId, strength) => {
    const hits = hitsFor(skillName);

    assert.ok(hits.length > 0, skillName);
    assert.ok(
      hits.every((event) => event.weaponStrengthProfileId === profileId && event.resolvedWeaponStrength === strength),
      skillName
    );
  };

  for (const skillName of [
    'Dazzling Hammer',
    'Shining Spin',
    'Luminous Staff',
    'Gleaming Blade',
    'Lucent Thrust',
    'Brilliant Slam'
  ]) {
    assertProfile(skillName, 'transform.radiant-forge', 1015);
  }

  assert.deepEqual(
    hitsFor('Glaring Burst').map((event) => [
      event.radiantWeapon,
      event.weaponStrengthProfileId,
      event.resolvedWeaponStrength
    ]),
    [
      ['hammer', 'transform.radiant-forge', 1015],
      ['blade', 'transform.radiant-forge', 1015]
    ]
  );
  assert.deepEqual(result.warnings, []);
});

test('Radiant Forge recharge starts on exit and uses equipped weapons', () => {
  const hammerOnly = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin', 'Exit Radiant Forge', 'Enter Radiant Forge'],
    config: { ...config, specialization: 'Luminary' }
  });
  const allWeapons = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Enter Radiant Forge',
      'Dazzling Hammer',
      'Luminous Staff',
      'Gleaming Blade',
      'Radiant Bulwark',
      'Exit Radiant Forge',
      'Enter Radiant Forge'
    ],
    config: { ...config, specialization: 'Luminary' }
  });

  assert.equal(hammerOnly.steps.filter((step) => step.skill === 'Enter Radiant Forge')[1].start, 6440);
  assert.equal(allWeapons.steps.filter((step) => step.skill === 'Enter Radiant Forge')[1].start, 14820);
  assert.equal(allWeapons.endState.profession.radiantForgeEndsAt, 34.82);
});

test('Radiant Forge recharge starts when its automatic exit occurs', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', { type: 'wait', durationMs: 21000 }, 'Enter Radiant Forge'],
    config: { ...config, specialization: 'Luminary' }
  });

  assert.equal(result.steps.filter((step) => step.skill === 'Enter Radiant Forge')[1].start, 25000);
});

test('Radiant Forge transitions emit the current set and trigger swap sigils', () => {
  const outOfCombat = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', { type: 'wait', durationMs: 1000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.equal(
    outOfCombat.procSteps.some((step) => step.type === 'sigil_proc'),
    false
  );

  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Daring Advance',
      'Piercing Stance',
      'Enter Radiant Forge',
      'Exit Radiant Forge',
      'Enter Radiant Forge',
      'Exit Radiant Forge',
      'Enter Radiant Forge',
      { type: 'wait', durationMs: 9000 }
    ],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });
  const procTimes = (name) =>
    result.procSteps.filter((step) => step.skill === `Sigil of ${name}`).map((step) => step.start);
  const applications = (condition) =>
    result.resolvedEvents.filter(
      (event) =>
        event.skillName === `Sigil of ${condition === 'Chilled' ? 'Hydromancy' : 'Geomancy'}` &&
        event.condition === condition
    );

  assert.deepEqual(procTimes('Hydromancy'), [1300, 11300]);
  assert.deepEqual(procTimes('Geomancy'), [1300, 11300]);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'weapon_set').map((event) => [event.skillName, event.weaponSet]),
    [
      ['Enter Radiant Forge', 1],
      ['Exit Radiant Forge', 1],
      ['Enter Radiant Forge', 1],
      ['Exit Radiant Forge', 1],
      ['Enter Radiant Forge', 1]
    ]
  );
  assert.ok(
    result.procSteps
      .filter((step) => ['Sigil of Hydromancy', 'Sigil of Geomancy'].includes(step.skill))
      .every(
        (step) =>
          step.sourceSkill === 'Enter Radiant Forge' && step.icon.startsWith('https://render.guildwars2.com/file/')
      )
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.skillName === 'Sigil of Hydromancy' && event.type === 'damage')
      .length,
    2
  );
  assert.equal(applications('Chilled').length, 2);
  assert.equal(applications('Bleeding').length, 2);
  assert.ok(applications('Bleeding').every((application) => application.damage > 0));

  const manualExit = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Daring Advance',
      'Piercing Stance',
      'Enter Radiant Forge',
      { type: 'wait', durationMs: 10000 },
      'Exit Radiant Forge',
      { type: 'wait', durationMs: 1000 }
    ],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.deepEqual(
    manualExit.procSteps
      .filter((step) => step.skill === 'Sigil of Hydromancy')
      .map((step) => [step.start, step.sourceSkill]),
    [
      [1300, 'Enter Radiant Forge'],
      [11300, 'Exit Radiant Forge']
    ]
  );

  const automaticExit = simulateGw2({
    profession: guardianProfession,
    rotation: ['Daring Advance', 'Piercing Stance', 'Enter Radiant Forge', { type: 'wait', durationMs: 21000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.deepEqual(
    automaticExit.procSteps
      .filter((step) => step.skill === 'Sigil of Geomancy')
      .map((step) => [step.start, step.sourceSkill]),
    [
      [1300, 'Enter Radiant Forge'],
      [21300, 'Exit Radiant Forge']
    ]
  );
  assert.deepEqual(
    automaticExit.events
      .filter((event) => event.type === 'weapon_set')
      .map((event) => [event.skillName, event.weaponSet, Boolean(event.automatic)]),
    [
      ['Enter Radiant Forge', 1, false],
      ['Exit Radiant Forge', 1, true]
    ]
  );

  const radiantWeapon = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Daring Advance',
      'Piercing Stance',
      'Enter Radiant Forge',
      { type: 'wait', durationMs: 10000 },
      'Dazzling Hammer',
      'Shining Spin',
      { type: 'wait', durationMs: 1000 }
    ],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.deepEqual(
    radiantWeapon.procSteps
      .filter((step) => step.skill === 'Sigil of Hydromancy')
      .map((step) => [step.start, step.sourceSkill]),
    [
      [1300, 'Enter Radiant Forge'],
      [12020, 'Dazzling Hammer']
    ]
  );
  assert.equal(
    radiantWeapon.procSteps.some((step) => step.skill === 'Sigil of Hydromancy' && step.sourceSkill === 'Shining Spin'),
    false
  );
});

test('Luminary weapon coefficients, disables, and armament buffs resolve', () => {
  const rotation = [
    'Enter Radiant Forge',
    'Dazzling Hammer',
    'Shining Spin',
    'Luminous Staff',
    { type: 'wait', durationMs: 3500 }
  ];
  const empowered = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS]
    }
  });
  const armaments = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS]
    }
  });
  const damage = (result, name) => result.resolvedEvents.find((event) => event.name === name);
  const dazzling = damage(armaments, 'Dazzling Hammer');
  const shining = damage(armaments, 'Shining Spin');
  const defiantAfterDaze = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'],
    config: {
      ...config,
      specialization: 'Luminary',
      target: { ...config.target, defiant: true }
    }
  });
  const ordinaryAfterDaze = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'],
    config: {
      ...config,
      specialization: 'Luminary'
    }
  });

  assert.equal(dazzling.coefficient, 1.2);
  assert.equal(shining.coefficient, 1.25);
  assert.ok(shining.damage > dazzling.damage);
  assert.ok(
    Math.abs(damage(defiantAfterDaze, 'Shining Spin').damage / damage(ordinaryAfterDaze, 'Shining Spin').damage - 1) <
      1e-9
  );
  assert.ok(Math.abs(dazzling.damage / damage(empowered, 'Dazzling Hammer').damage - 1) < 1e-9);
  assert.ok(Math.abs(shining.damage / damage(empowered, 'Shining Spin').damage - 1.17 / 1.1) < 1e-9);
  const armamentStaff = armaments.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage');
  const empoweredStaff = empowered.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage');

  assert.ok(Math.abs(armamentStaff[0].damage / empoweredStaff[0].damage - 1.17 / 1.1) < 1e-9);
  assert.equal(
    armamentStaff
      .slice(1)
      .every((event, index) => Math.abs(event.damage / empoweredStaff[index + 1].damage - 1) < 1e-9),
    true
  );
  assert.equal(armaments.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage').length, 4);
  assert.deepEqual(
    armaments.procSteps.filter((step) => step.skill === 'Empowered Armaments').map((step) => step.detail),
    ['triggered', 'refreshed']
  );
  assert.equal(
    armaments.procSteps.filter((step) => step.skill === 'Radiant Armaments')[1].detail,
    'staff: hammer bonus removed'
  );

  const justice = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice', 'Enter Radiant Forge', 'Dazzling Hammer', { type: 'wait', durationMs: 1000 }],
    config: { ...config, specialization: 'Luminary' }
  });
  const hammerPackets = justice.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER
  );

  assert.deepEqual(
    hammerPackets.map((event) => event.coefficient),
    [1.2, 1.5]
  );
  assert.ok(Math.abs(hammerPackets[1].at - hammerPackets[0].at - 0.75) < 1e-9);

  const gleaming = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: [...(selectedTraitIds ? ['Radiant Courage'] : []), 'Enter Radiant Forge', 'Gleaming Blade'],
      config: { ...config, specialization: 'Luminary' }
    });
  const normalBlade = damage(gleaming(false), 'Gleaming Blade');
  const empoweredBlade = damage(gleaming(true), 'Gleaming Blade');

  assert.ok(Math.abs(empoweredBlade.damage / normalBlade.damage - 1.5) < 1e-9);
});

test('Guardian armaments share the additive sigil bucket', () => {
  const rotation = ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'];
  const run = ({ selectedTraitIds = [], sigilSets = undefined, burning = false } = {}) =>
    simulateGw2({
      profession: guardianProfession,
      rotation,
      config: {
        ...config,
        specialization: 'Luminary',
        selectedTraitIds,
        sigilSets,
        target: {
          ...config.target,
          conditions: burning ? { Burning: true } : {}
        }
      }
    });
  const shining = (result) => result.resolvedEvents.find((event) => event.name === 'Shining Spin').damage;
  const baseline = run();
  const sigils = run({
    sigilSets: [{ names: ['Force', 'Impact'], strikeAdd: 0.08, strike: 1.08 }, {}]
  });
  const armaments = run({
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS],
    sigilSets: [{ names: ['Force', 'Impact'], strikeAdd: 0.08, strike: 1.08 }, {}]
  });
  const conditional = run({
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS,
      GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS,
      GUARDIAN_TRAIT_IDS.FIERY_WRATH
    ],
    sigilSets: [{ names: ['Force', 'Impact'], strikeAdd: 0.08, strike: 1.08 }, {}],
    burning: true
  });

  assert.ok(Math.abs(shining(sigils) / shining(baseline) - 1.08) < 1e-9);
  assert.ok(Math.abs(shining(armaments) / shining(baseline) - 1.25) < 1e-9);
  assert.ok(Math.abs(shining(conditional) / shining(armaments) - 1.05) < 1e-9);
});

test('Radiant virtues grant one-use hammer and sword empowerments', () => {
  const armedHammer = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice'],
    config: { ...config, specialization: 'Luminary' }
  });
  const hammer = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice', 'Enter Radiant Forge', 'Dazzling Hammer', 'Dazzling Hammer'],
    config: { ...config, specialization: 'Luminary' }
  });
  const armedSword = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Courage'],
    config: { ...config, specialization: 'Luminary' }
  });
  const sword = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Courage', 'Enter Radiant Forge', 'Gleaming Blade', 'Gleaming Blade'],
    config: { ...config, specialization: 'Luminary' }
  });
  const bladeHits = sword.resolvedEvents.filter((event) => event.name === 'Gleaming Blade');

  assert.equal(armedHammer.endState.profession.radiantJusticeArmed, true);
  assert.equal(
    hammer.resolvedEvents.filter((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact').length,
    1
  );
  assert.equal(hammer.endState.profession.radiantJusticeArmed, false);
  assert.ok(
    hammer.procSteps.some(
      (step) =>
        step.type === 'skill_proc' && step.skill === 'Empowered Hammer' && step.sourceSkill === 'Radiant Justice'
    )
  );

  assert.equal(armedSword.endState.profession.radiantCourageSwordArmed, true);
  assert.equal(bladeHits.length, 2);
  assert.ok(Math.abs(bladeHits[0].damage / bladeHits[1].damage - 1.5) < 1e-9);
  assert.equal(sword.endState.profession.radiantCourageSwordArmed, false);
  assert.ok(
    sword.procSteps.some(
      (step) => step.type === 'skill_proc' && step.skill === 'Empowered Sword' && step.sourceSkill === 'Radiant Courage'
    )
  );
});

test('Guardian strike modifiers use their tested additive and mult buckets', () => {
  const run = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Symbol of Resolution', { type: 'wait', durationMs: 1500 }],
      config: {
        ...config,
        boons: { fury: true },
        primaryWeapon: 'Greatsword',
        selectedTraitIds,
        sigilSets: [{ names: ['Force'], strikeAdd: 0.05, strike: 1.05 }, {}],
        target: {
          ...config.target,
          conditions: {
            Burning: true,
            Vulnerability: 25
          }
        }
      }
    });
  const pulse = (result) => result.resolvedEvents.filter((event) => event.name === 'Symbol of Resolution')[0].damage;
  const baseline = run([]);
  const conditional = run([
    GUARDIAN_TRAIT_IDS.FIERY_WRATH,
    GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
    GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
    GUARDIAN_TRAIT_IDS.RETRIBUTION
  ]);

  assert.ok(Math.abs(pulse(conditional) / pulse(baseline) - (1.25 / 1.05) * 1.05 * 1.05) < 1e-9);
});

test('Luminary stances apply modifiers, combos, delayed damage, and control', () => {
  const piercing = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance', 'Piercing Stance', { type: 'wait', durationMs: 1000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      relic: 'Claw'
    }
  });
  const daring = simulateGw2({
    profession: guardianProfession,
    rotation: ['Daring Advance', { type: 'wait', durationMs: 1000 }],
    config: { ...config, specialization: 'Luminary' }
  });
  const daringThenPiercing = simulateGw2({
    profession: guardianProfession,
    rotation: ['Daring Advance', 'Piercing Stance', { type: 'wait', durationMs: 1000 }],
    config: { ...config, specialization: 'Luminary' }
  });
  const quickPiercing = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance'],
    config: {
      ...config,
      specialization: 'Luminary',
      boons: { quickness: true }
    }
  });
  const effulgent = simulateGw2({
    profession: guardianProfession,
    rotation: ['Effulgent Stance', 'Whirling Wrath', { type: 'wait', durationMs: 4000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      relic: 'Claw'
    }
  });
  const effulgentWithGuardianProcs = simulateGw2({
    profession: guardianProfession,
    rotation: ['Effulgent Stance', 'Enter Radiant Forge', 'Dazzling Hammer', { type: 'wait', durationMs: 4000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const effulgentDamage = effulgent.resolvedEvents.find((event) => event.name === 'Effulgent Stance');
  const procChargedEffulgent = effulgentWithGuardianProcs.resolvedEvents.find(
    (event) => event.name === 'Effulgent Stance'
  );
  const piercingBuffs = piercing.events.filter((event) => event.kind === 'guardian-piercing-stance');
  const quickPiercingAction = quickPiercing.events.find(
    (event) => event.type === 'action' && event.skillName === 'Piercing Stance'
  );
  const quickPiercingBuff = quickPiercing.events.find((event) => event.kind === 'guardian-piercing-stance');
  const quickPiercingPackets = quickPiercing.events.filter(
    (event) => ['damage', 'control'].includes(event.type) && event.skillName === 'Piercing Stance'
  );

  assert.equal(
    piercing.events.find((event) => event.type === 'control' && event.skillName === 'Piercing Stance').controlKind,
    'daze'
  );
  assert.equal(piercingBuffs[0].duration, 8);
  assert.ok(Math.abs(piercingBuffs[1].at + piercingBuffs[1].duration - 16.24) < 1e-9);
  assert.equal(quickPiercingAction.endsAt - quickPiercingAction.at, 0.2);
  assert.ok(Math.abs(quickPiercingBuff.at - quickPiercingAction.at - 0.16) < 1e-9);
  assert.ok(quickPiercingPackets.every((event) => Math.abs(event.at - quickPiercingBuff.at) < 1e-9));
  assert.equal(
    daringThenPiercing.resolvedEvents.find((event) => event.skillName === 'Daring Advance').damage,
    daring.resolvedEvents.find((event) => event.skillName === 'Daring Advance').damage
  );
  assert.ok(piercing.procSteps.some((step) => step.skill === 'Relic of the Claw'));
  assert.equal(
    daring.events.some((event) => event.type === 'control' && event.skillName === 'Daring Advance'),
    false
  );
  assert.equal(daring.events.find((event) => event.kind === 'guardian-daring-advance').duration, 8);
  assert.equal(effulgentDamage.at, 4);
  assert.equal(effulgentDamage.stackCount, 10);
  assert.equal(effulgentDamage.coefficient, 4);
  assert.equal(effulgentDamage.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(effulgentDamage.resolvedWeaponStrength, 690.5);
  assert.equal(effulgentDamage.weaponStrengthSampled, false);
  assert.equal(procChargedEffulgent.stackCount, 2);
  assert.ok(Math.abs(procChargedEffulgent.coefficient - 1.2) < 1e-9);
  assert.deepEqual(
    effulgent.procSteps
      .filter((step) => step.type === 'skill_proc' && step.skill === 'Effulgent Stance')
      .map((step) => [step.start, step.sourceSkill, step.detail]),
    [[4000, 'Effulgent Stance', '10/10 stacks']]
  );
  assert.ok(effulgent.procSteps.some((step) => step.skill === 'Relic of the Claw' && step.start === 4000));
});

test('Sovereign of Light consumes combo and trait-granted light auras', () => {
  const combo = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Resolution', 'Leap of Faith', 'Enter Radiant Forge', 'Dazzling Hammer'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const justice = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance', 'Radiant Justice', 'Piercing Stance'],
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const justiceWithClaw = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance', 'Radiant Justice', 'Piercing Stance'],
    config: {
      ...config,
      specialization: 'Luminary',
      relic: 'Claw',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const sovereignHits = combo.resolvedEvents.filter((event) => event.name === 'Sovereign of Light');
  const sovereignProcs = combo.procSteps.filter((step) => step.skill === 'Sovereign of Light');

  assert.equal(sovereignHits.length, 1);
  assert.deepEqual(
    sovereignHits.map((event) => event.triggeredBy),
    ['Dazzling Hammer']
  );
  assert.equal(
    sovereignHits.every((event) => event.coefficient === 1.5),
    true
  );
  assert.equal(
    sovereignHits.every((event) => event.skillWeapon === 'Unequipped'),
    true
  );
  assert.equal(sovereignProcs.length, 1);
  assert.equal(
    sovereignProcs.every((step) => Boolean(step.icon)),
    true
  );
  assert.ok(justice.events.some((event) => event.type === 'blind' && event.skillName === 'Justice is Blind'));
  assert.equal(justice.resolvedEvents.filter((event) => event.name === 'Sovereign of Light').length, 1);
  const justiceSovereign = justice.resolvedEvents.find((event) => event.name === 'Sovereign of Light');
  const clawSovereign = justiceWithClaw.resolvedEvents.find((event) => event.name === 'Sovereign of Light');

  assert.deepEqual(
    {
      actorType: clawSovereign.actorType,
      ownerActorType: clawSovereign.ownerActorType
    },
    { actorType: 'effect', ownerActorType: 'player' }
  );
  assert.ok(Math.abs(clawSovereign.damage / justiceSovereign.damage - 1.07) < 1e-12);
});

test('Luminary recharge traits alter the intended cooldown families', () => {
  const masterRotation = [
    'Enter Radiant Forge',
    'Dazzling Hammer',
    'Exit Radiant Forge',
    'Radiant Justice',
    'Enter Radiant Forge',
    'Dazzling Hammer'
  ];
  const withMaster = simulateGw2({
    profession: guardianProfession,
    rotation: masterRotation,
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS]
    }
  });
  const withoutMaster = simulateGw2({
    profession: guardianProfession,
    rotation: masterRotation,
    config: { ...config, specialization: 'Luminary' }
  });
  const inspirationRotation = [
    'Radiant Justice',
    'Enter Radiant Forge',
    'Dazzling Hammer',
    'Exit Radiant Forge',
    'Radiant Justice'
  ];
  const withInspiration = simulateGw2({
    profession: guardianProfession,
    rotation: inspirationRotation,
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION]
    }
  });
  const withoutInspiration = simulateGw2({
    profession: guardianProfession,
    rotation: inspirationRotation,
    config: { ...config, specialization: 'Luminary' }
  });

  assert.equal(withMaster.steps.filter((step) => step.skill === 'Dazzling Hammer')[1].start, 5720);
  assert.equal(withoutMaster.steps.filter((step) => step.skill === 'Dazzling Hammer')[1].start, 7720);
  assert.equal(withInspiration.steps.filter((step) => step.skill === 'Radiant Justice')[1].start, 16000);
  assert.equal(withoutInspiration.steps.filter((step) => step.skill === 'Radiant Justice')[1].start, 20000);
});

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
  assert.equal(guardianAppAdapter.simulationConfig(app).stats.conditionDurationBonuses.Burning, undefined);
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
    professionState: {
      tomePages: 3,
      maximumTomePages: 5
    }
  });

  assert.equal(dragonhunter.includes(GUARDIAN_SKILL_IDS.WINGS_OF_RESOLVE), true);
  assert.equal(dragonhunter.includes(GUARDIAN_SKILL_IDS.SHIELD_OF_COURAGE), true);
  assert.equal(spear.flipParentId, null);
  assert.equal(verdict.flipParentId, spear.id);
  assert.equal(firebrand.includes(GUARDIAN_SKILL_IDS.SEARING_SPELL), true);
  assert.equal(firebrandResources[0].value, 3);
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
