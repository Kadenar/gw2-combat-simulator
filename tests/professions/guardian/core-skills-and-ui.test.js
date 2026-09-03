import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { skillBarInspectionStacks } from '#gw2/app/build/panels/skills.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createGuardianBuildDefaults } from '#gw2/professions/guardian/build/build.js';
import { applyGuardianBuildAttributeRules } from '#gw2/professions/guardian/build/attributes.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/core/profiles.js';
import { observeGuardianScheduledEvent } from '#gw2/professions/guardian/core/traits/index.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { FIREBRAND_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { WILLBENDER_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import { LUMINARY_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/luminary/profiles.js';

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

const authoringGuardianProfession = withActivePatchPreview(guardianProfession);

test('Virtue of Resolution replacement returns before later scheduled-event behavior', () => {
  const emitted = [];
  const event = {
    type: 'buff',
    at: 1,
    kind: 'resolution',
    duration: 4,
    isSymbol: true,
    skillId: GUARDIAN_SKILL_IDS.SYMBOL_OF_RESOLUTION,
    skillName: 'Symbol of Resolution'
  };
  const context = {
    catalog: guardianCatalog,
    config: {
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE]
    },
    emit: (scheduled) => emitted.push(scheduled),
    // Mutating the event to a symbol hit proves the observer stops immediately after replacement.
    replaceEvent: (scheduled, replacement) => Object.assign(scheduled, replacement, { type: 'damage' })
  };

  observeGuardianScheduledEvent(context, event);

  assert.equal(event.duration, 5);
  assert.deepEqual(emitted, []);
});

test('Guardian modules expose isolated balance-profile authoring', () => {
  const modules = new Map(authoringGuardianProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Dragonhunter', 'Firebrand', 'Willbender', 'Luminary']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) => {
    const module = modules.get(moduleId);

    return [...module.balanceProfiles, ...module.skillVariants].find((entry) => entry.id === profileId);
  };

  assert.equal(profile('Core', GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice).profile.threshold, 5);
  assert.equal(profile('Dragonhunter', DRAGONHUNTER_BALANCE_PROFILE_IDS.tether).profile.effects[0].duration, 2);
  assert.equal(profile('Firebrand', FIREBRAND_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 5);
  assert.equal(
    profile('Willbender', WILLBENDER_BALANCE_PROFILE_IDS.flames).profile.effects[0].ticks[0].coefficient,
    0.22
  );
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
            tickIndex: 'all',
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
  assert.ok(
    preview.balanceProfilesById
      .get(WILLBENDER_BALANCE_PROFILE_IDS.flames)
      .effects[0].ticks.every((tick) => tick.coefficient === 0.3)
  );
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
  assert.equal(
    withJustice.procSteps.find((step) => step.skill === 'Justice Active')?.icon,
    guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.JUSTICE).icon
  );
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

test('Justice counts symbol packets and applies the measured two-second passive burn', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Resolution', { type: 'wait', durationMs: 6000 }],
    config: { ...config, specialization: 'Luminary', primaryWeapon: 'Greatsword' }
  });
  const burn = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.justice-passive'
  );
  const proc = result.procSteps.find((step) => step.skill === 'Justice Passive');

  assert.equal(result.endState.profession.justicePassiveBurns, 1);
  assert.equal(burn.duration, 2);
  assert.equal(proc.sourceSkill, 'Symbol of Resolution');
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
    cast: 320,
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
    tether.every((event) => event.flatStrikeBase === 160 && event.flatStrikePowerCoeff === 0.3),
    true
  );
  const tetherBreakdown = quick.breakdown.find((entry) => entry.sourceId === GUARDIAN_SKILL_IDS.BINDING_BLADE_TETHER);

  assert.equal(
    tetherBreakdown.strikeDamage,
    tether.reduce((damage, event) => damage + event.damage, 0)
  );
  assert.equal(tetherBreakdown.conditionDamage, 0);
  assert.equal(tetherBreakdown.hits, 10);
});

test('Symbol of Resolution retains its pulses after committing at 240 ms', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      { name: 'Symbol of Resolution', interruptMs: 240 },
      { type: 'wait', durationMs: 5_000 }
    ],
    config: { ...config, primaryWeapon: 'Greatsword' }
  });
  const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Symbol of Resolution');
  const ticks = result.resolvedEvents
    .filter((event) => event.type === 'damage' && event.skillName === 'Symbol of Resolution')
    .map((event) => Math.round((event.at - action.at) * 1_000));

  assert.equal(Math.round((action.endsAt - action.at) * 1_000), 240);
  assert.deepEqual(ticks, [200, 1_200, 2_200, 3_200, 4_200]);
});

test('Guardian greatsword autos separate packet, safe-cancel, and retained-lockout timing', () => {
  const earlyStrike = simulateGw2({
    profession: guardianProfession,
    rotation: [{ name: 'Strike', interruptMs: 399 }],
    config: { ...config, boons: { quickness: true }, primaryWeapon: 'Greatsword' }
  });
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Strike',
      { name: 'Vengeful Strike', interruptMs: 400 },
      { name: 'Wrathful Strike', interruptMs: 520 },
      'Strike'
    ],
    config: { ...config, boons: { quickness: true }, primaryWeapon: 'Greatsword' }
  });
  const actions = result.events.filter((event) => event.type === 'action');
  const action = (index) => actions[index];
  const packetOffset = (index) => {
    const packet = result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.activationId === action(index).activationId
    );

    return Math.round((packet.at - action(index).at) * 1000);
  };

  assert.equal(
    earlyStrike.resolvedEvents.some((event) => event.type === 'damage'),
    false
  );
  assert.deepEqual([packetOffset(0), packetOffset(1), packetOffset(2)], [400, 400, 440]);
  assert.deepEqual(
    [action(1), action(2)].map((event) => ({
      duration: Math.round((event.endsAt - event.at) * 1000),
      fullDuration: Math.round((event.fullEndsAt - event.at) * 1000),
      lockoutDuration: Math.round((event.castLockoutEndsAt - event.at) * 1000)
    })),
    [
      { duration: 400, fullDuration: 600, lockoutDuration: 600 },
      { duration: 520, fullDuration: 680, lockoutDuration: 680 }
    ]
  );
  assert.equal(Math.round((action(3).at - action(2).at) * 1000), 680);
  assert.deepEqual(result.warnings, []);
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

  assert.deepEqual(offsets(puncture), [600]);
  assert.deepEqual(offsets(deflecting), [640]);
  assert.deepEqual(offsets(symbol), [600, 1600, 2600, 3600, 4600]);
  assert.deepEqual(offsets(trueShot), [680]);
  assert.deepEqual(offsets(ward), [680, 1200, 1720, 2240]);
  assert.deepEqual(
    ward.damage.map((event) => event.coefficient),
    [0.75, 0.75, 0.75, 2.5]
  );
  assert.equal(symbolBurning.length, 1);
  assert.equal(Math.round((symbolBurning[0].at - symbol.action.at) * 1000), 600);
  assert.equal(symbolBurning[0].duration, 12);
});

test('Guardian utilities and traps use the reference damage timelines', () => {
  const skillNames = ['Sword of Justice', 'Procession of Blades', 'Bane Signet', "Dragon's Maw", 'Purification'];
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
    [900, 660, 750, 660, 900]
  );
  assert.deepEqual(
    skillNames.map((name) => quick[name].cast),
    [600, 440, 500, 440, 600]
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

test('Inspired Virtue emits its base boon through the shared boon-duration policy', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Courage'],
    config: {
      ...config,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE],
      stats: { ...config.stats, concentration: 750 }
    }
  });
  const protection = result.events.find(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE
  );

  assert.ok(protection);
  assert.equal(protection.kind, 'protection');
  assert.equal(protection.duration, 7.5);
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

test('Spear Symbol of Luminance knocks back on its initial hit', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Luminance'],
    config: { ...config, primaryWeapon: 'Spear' }
  });
  const initialHit = result.events.find(
    (event) => event.type === 'damage' && event.name === 'Symbol of Luminance — Initial'
  );
  const controls = result.events.filter(
    (event) => event.type === 'control' && event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_LUMINANCE
  );

  assert.ok(initialHit);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].controlKind, 'knockback');
  assert.equal(controls[0].at, initialHit.at);
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
  const dormantFirebrandGroup = guardianProfession.ui.paletteGroups({
    ...inactiveFirebrand,
    time: 10,
    professionState: {
      ...inactiveFirebrand.professionState,
      tomeDormantReadyAt: { justice: 20, resolve: 10, courage: 30 }
    }
  })[0];
  const groupIds = (groups) => groups.map((group) => group.id);

  assert.deepEqual(groupIds(inactiveFirebrandGroups), ['profession', 'tome-justice', 'tome-resolve', 'tome-courage']);
  assert.deepEqual(
    activeFirebrandGroups.map((group) => group.skillIds),
    inactiveFirebrandGroups.map((group) => group.skillIds)
  );
  assert.deepEqual(dormantFirebrandGroup.resourceIds, ['pages']);
  assert.equal(dormantFirebrandGroup.resourcePlacement, 'above');
  assert.match(dormantFirebrandGroup.className, /tome-justice-dormant/);
  assert.doesNotMatch(dormantFirebrandGroup.className, /tome-resolve-dormant/);
  assert.match(dormantFirebrandGroup.className, /tome-courage-dormant/);
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
