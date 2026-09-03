import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfession, loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { assumptionControlsForSpecialization } from '#gw2/platform/builds/assumptions.js';
import { weaponPaletteRows } from '#gw2/app/rotation/palette/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { resourceDisplayViews } from '#gw2/app/rotation/palette/resource-view.js';
import { skillBreakdownRows } from '#gw2/app/presentation/results/result-tables.js';
import {
  createThiefBuildDefaults,
  migrateThiefBuild,
  validateThiefBuild
} from '#gw2/content/professions/thief/build/build.js';
import { thiefCatalog, thiefWeaponSkillMatchesSet } from '#gw2/content/professions/thief/catalog.js';
import { DATA_SNAPSHOT } from '#gw2/content/professions/thief/data/thief-api-metadata.js';
import { THIEF_SUPPLEMENTAL_SKILLS } from '#gw2/content/professions/thief/data/thief-supplemental-skills.js';
import { THIEF_TRAIT_COVERAGE } from '../../fixtures/trait-coverage/thief.js';
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/thief/data/ids.js';
import { THIEF_CORE_SKILL_MECHANICS } from '#gw2/content/professions/thief/core/skills/index.js';
import { thiefCoreModifierRules } from '#gw2/content/professions/thief/core/traits/modifiers.js';
import { thiefAppAdapter } from '#gw2/content/professions/thief/app/app-definition.js';
import { thiefProfession } from '#gw2/content/professions/thief/definition.js';
import { daredevilModifierRules } from '#gw2/content/professions/thief/specializations/daredevil/mechanics/dodge-rules.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/thief/core/profiles.js';
import { DAREDEVIL_BALANCE_PROFILE_IDS } from '#gw2/content/professions/thief/specializations/daredevil/profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/thief/specializations/deadeye/profiles.js';
import { SPECTER_BALANCE_PROFILE_IDS } from '#gw2/content/professions/thief/specializations/specter/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS } from '#gw2/content/professions/thief/specializations/antiquary/profiles.js';

const baseConfig = Object.freeze({
  selectedSkills: ['Hide in Shadows', "Assassin's Signet", 'Shadow Flare', 'Shadow Gust', 'Thieves Guild'],
  initialInitiative: 12,
  initialShadowForce: 0,
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  weaponSet2Primary: 'Pistol',
  weaponSet2Secondary: 'Pistol',
  deterministicChoices: {},
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

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: thiefProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      deterministicChoices: {
        ...baseConfig.deterministicChoices,
        ...(config.deterministicChoices || {})
      },
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    observationPolicy
  });
}

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

const applyThiefPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(thiefCatalog, patch), patch);

test('Thief catalog pins API identity and explicit terrestrial mechanics', () => {
  assert.equal(DATA_SNAPSHOT, '2026-07-28');
  assert.equal(thiefCatalog.specializations.length, 9);
  assert.equal(thiefCatalog.traits.length, 108);
  assert.ok(thiefCatalog.skills.length >= 249);
  assert.equal(thiefCatalog.skillsById.has(76550), false);
  assert.equal(thiefCatalog.skillsById.has(40436), true);
  assert.equal(thiefCatalog.skillsById.has(80278), false);
  assert.equal(thiefCatalog.skillsById.has(76744), false);
  assert.equal(thiefCatalog.skillsById.has(77230), true);
  assert.equal(thiefCatalog.skillsByName.get("Death's Advance").id, 40436);
  assert.equal(thiefCatalog.skillsByName.get('Canach-Coin Toss').id, 77230);
  assert.equal(thiefCatalog.skillsByName.get('Death Blossom').initiativeCost, 4);
  for (const excludedId of [13020, 13035, 13096, 76784, 76808, 76879, 77361]) {
    assert.equal(thiefCatalog.skillsById.has(excludedId), false, String(excludedId));
  }

  assert.equal(THIEF_CORE_SKILL_MECHANICS[13006].castTimeMs, undefined);
  assert.equal(THIEF_CORE_SKILL_MECHANICS[13006].quicknessCastTimeMs, 1040);
  assert.equal(thiefCatalog.skillsById.get(13006).castTimeMs, 1560);
  // Thief strike timelines stay explicit unless every hit shares one timestamp.
  for (const skill of thiefCatalog.skills) {
    for (const effect of skill.effects || []) {
      if (effect.type === 'strike') {
        if (effect.ticks) {
          for (const field of ['coefficient', 'hits', 'atMs', 'intervalMs']) {
            assert.equal(field in effect, false, `${skill.name}: ${field}`);
          }
        } else {
          assert.ok(Number(effect.coefficient) >= 0, skill.name);
          assert.ok(Number.isInteger(effect.hits) && effect.hits > 0, skill.name);
          if (effect.hits > 1) assert.ok(Number.isFinite(effect.atMs), skill.name);
        }
      } else if (effect.type === 'condition') {
        assert.ok(Array.isArray(effect.ticks), skill.name);
      }
    }
  }

  assert.deepEqual(
    THIEF_CORE_SKILL_MECHANICS[13006].effects[0].ticks.map(({ atMs, coefficient }) => [atMs, coefficient]),
    [
      [560, 0.21],
      [640, 0.21],
      [800, 0.21]
    ]
  );
  assert.deepEqual(
    THIEF_CORE_SKILL_MECHANICS[13006].effects[1].ticks.map(({ atMs, condition, stacks, duration }) => [
      atMs,
      condition,
      stacks,
      duration
    ]),
    [
      [560, 'Bleeding', 2, 6],
      [640, 'Bleeding', 2, 6],
      [800, 'Bleeding', 2, 6]
    ]
  );
  for (const excludedName of [
    'Deadly Strike',
    'Emergency Jade Shield',
    'Ice Drake Venom',
    'Inquest Portal Device',
    'Inquest Portal Device: Backfired',
    'Malicious Deadly Strike',
    'Malicious Ripper',
    'Prepare Seal Area',
    'Prepare Shadow Portal',
    'Seal Area',
    'Shadow Portal',
    'Shadow Refuge',
    'Shadow Return',
    'Shadowstep',
    'Scorpion Wire',
    'Smoke Screen',
    'The Ripper',
    'Roll for Initiative'
  ]) {
    assert.equal(thiefCatalog.skillsByName.has(excludedName), false, excludedName);
  }

  assert.ok(
    THIEF_SUPPLEMENTAL_SKILLS.every(
      (skill) =>
        !Object.hasOwn(skill, 'effects') && !Object.hasOwn(skill, 'cooldown') && !Object.hasOwn(skill, 'recharge')
    )
  );
  assert.match(thiefCatalog.skillsById.get(41068).icon, /Special:Redirect\/file\/Free_Action\.png$/);
  assert.ok(
    thiefCatalog.skills
      .filter((skill) => skill.type === 'Weapon')
      .every((skill) => Number.isFinite(Number(skill.initiativeCost)))
  );
  assert.ok(
    thiefCatalog.skills
      .filter((skill) => skill.artifactKind)
      .every((skill) => skill.type === 'Profession' && skill.slot === 'Profession_2')
  );
});

test('Thief modules expose isolated balance-profile authoring', () => {
  const modules = new Map(thiefProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) => {
    const module = modules.get(moduleId);

    return [...module.balanceProfiles, ...module.skillVariants].find((entry) => entry.id === profileId);
  };

  assert.equal(profile('Core', THIEF_CORE_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 12);
  assert.equal(
    profile('Daredevil', DAREDEVIL_BALANCE_PROFILE_IDS.lotusTraining).profile.effects[0].ticks.reduce(
      (total, tick) => total + tick.coefficient,
      0
    ),
    0.5625
  );
  assert.equal(profile('Deadeye', DEADEYE_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 5);
  assert.equal(profile('Specter', SPECTER_BALANCE_PROFILE_IDS.resources).patchableFields.resourceGain, 1);
  assert.equal(profile('Antiquary', ANTIQUARY_BALANCE_PROFILE_IDS.scuffle).patchableFields.pulseInterval, 3);

  const opaqueModifierRules = [...modules.values()].flatMap((module) =>
    module.modifierRules.filter(
      (rule) =>
        (typeof rule.amount === 'function' || typeof rule.factor === 'function') &&
        Object.keys(rule.parameters).length === 0
    )
  );

  assert.deepEqual(opaqueModifierRules, []);

  const preview = applyThiefPatch({
    skills: {
      [ID.CALTROPS]: {
        effects: [{ effectIndex: 0, tickIndex: 'all', duration: { from: 10, to: 12 } }]
      }
    },
    balanceProfiles: {
      [THIEF_CORE_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 12, to: 13 } }
      },
      [DAREDEVIL_BALANCE_PROFILE_IDS.lotusTraining]: {
        effects: [{ effectIndex: 0, tickIndex: 'all', coefficient: { from: 0.1875, to: 0.2 } }]
      },
      [DEADEYE_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 5, to: 6 } }
      },
      [SPECTER_BALANCE_PROFILE_IDS.resources]: {
        fields: { resourceGain: { from: 1, to: 1.25 } }
      },
      [ANTIQUARY_BALANCE_PROFILE_IDS.scuffle]: {
        fields: { pulseInterval: { from: 3, to: 2.5 } }
      }
    }
  });

  assert.ok(preview.skillsById.get(ID.CALTROPS).effects[0].ticks.every((tick) => tick.duration === 12));
  assert.equal(preview.balanceProfilesById.get(THIEF_CORE_BALANCE_PROFILE_IDS.resources).maximumStacks, 13);
  assert.ok(
    Math.abs(
      preview.balanceProfilesById
        .get(DAREDEVIL_BALANCE_PROFILE_IDS.lotusTraining)
        .effects[0].ticks.reduce((total, tick) => total + tick.coefficient, 0) - 0.6
    ) < 1e-12
  );
  assert.equal(preview.balanceProfilesById.get(DEADEYE_BALANCE_PROFILE_IDS.resources).maximumStacks, 6);
  assert.equal(preview.balanceProfilesById.get(SPECTER_BALANCE_PROFILE_IDS.resources).resourceGain, 1.25);
  assert.equal(preview.balanceProfilesById.get(ANTIQUARY_BALANCE_PROFILE_IDS.scuffle).pulseInterval, 2.5);

  assert.ok(thiefCatalog.skillsById.get(ID.CALTROPS).effects[0].ticks.every((tick) => tick.duration === 10));
  assert.equal(thiefCatalog.balanceProfilesById.get(THIEF_CORE_BALANCE_PROFILE_IDS.resources).maximumStacks, 12);
});

test('Thief defaults migrate deterministic assumptions and validate bars', () => {
  const defaults = createThiefBuildDefaults();

  assert.deepEqual(validateThiefBuild(defaults), {
    valid: true,
    errors: []
  });
  const migrated = migrateThiefBuild({
    ...defaults,
    assumptions: {
      ...defaults.assumptions,
      markedTargetChoice: 'unmarked',
      playerHealthPercent: 20,
      targetDistance: 1200,
      artifactDrawSequence: 'reverse',
      doubleEdgeOutcomeSequence: 'success',
      stolenSkillChoice: 'throw-gunk',
      deadeyeStolenSkillChoice: 'steal-time',
      forgedSurferBombsHit: '2'
    }
  });

  assert.equal(Object.hasOwn(migrated.assumptions, 'artifactDrawSequence'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'doubleEdgeOutcomeSequence'), false);
  assert.equal(migrated.assumptions.forgedSurferBombsHit, '2');
  assert.equal(Object.hasOwn(migrated.assumptions, 'markedTargetChoice'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'playerHealthPercent'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'targetDistance'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'stolenSkillChoice'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'deadeyeStolenSkillChoice'), false);
  assert.equal(
    thiefProfession.ui.assumptionControls.some((control) => control.key === 'markedTargetChoice'),
    false
  );
  const keysFor = (specialization) =>
    new Set(
      assumptionControlsForSpecialization(thiefProfession.ui.assumptionControls, specialization).map(
        (control) => control.key
      )
    );

  for (const specialization of ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary']) {
    assert.equal(keysFor(specialization).has('stolenSkillChoice'), false);
    assert.equal(keysFor(specialization).has('deadeyeStolenSkillChoice'), false);
  }

  assert.equal(keysFor('Antiquary').has('forgedSurferBombsHit'), true);
  assert.deepEqual(
    thiefProfession.ui.assumptionControls
      .filter((control) => ['forgedSurferBombsHit'].includes(control.key))
      .map((control) => control.section),
    ['Antiquary']
  );
  for (const specialization of ['Core', 'Daredevil', 'Deadeye', 'Specter']) {
    assert.equal(keysFor(specialization).has('forgedSurferBombsHit'), false);
  }

  for (const specialization of ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary']) {
    assert.equal(keysFor(specialization).has('playerHealthPercent'), false);
    assert.equal(keysFor(specialization).has('targetDistance'), false);
  }

  assert.equal(
    validateThiefBuild({
      ...defaults,
      weapons: ['Sword', 'Sword']
    }).valid,
    false
  );
});

test('Thief cooldown resets survive build migration and validation', () => {
  const defaults = createThiefBuildDefaults();
  const migrated = migrateThiefBuild({ ...defaults, rotation: ['__cooldown_reset'] });

  assert.deepEqual(migrated.rotation, [{ type: 'cooldown-reset' }]);
  assert.deepEqual(validateThiefBuild(migrated), { valid: true, errors: [] });
  assert.equal(
    validateThiefBuild({
      ...migrated,
      rotation: [{ type: 'cooldown-reset', interruptAfterMs: 1 }]
    }).valid,
    false
  );
});

test('Thief resources use profession-specific initiative and malice pips', () => {
  const resourceViews = (specialization, config = {}) =>
    thiefProfession.ui.resourceViews({
      specialization,
      config: { specialization, ...config },
      professionState: thiefProfession
        .resolveRuntime({
          specialization
        })
        .createProfessionState({ specialization, ...config })
    });

  const coreInitiative = resourceViews('Core')[0];

  assert.equal(coreInitiative.displayMode, 'pips');
  assert.equal(coreInitiative.pipStyle, 'thief-initiative');
  assert.equal(coreInitiative.pipRows, 2);
  assert.equal(coreInitiative.maximum, 12);

  const preparedInitiative = resourceViews('Core', {
    selectedTraitIds: [TRAIT.PREPAREDNESS]
  })[0];

  assert.equal(preparedInitiative.maximum, 15);
  assert.equal(preparedInitiative.pipRows, 2);

  const antiquaryInitiative = resourceViews('Antiquary')[0];

  assert.equal(antiquaryInitiative.pipStyle, 'thief-initiative');
  assert.equal(antiquaryInitiative.pipRows, 3);

  const projectedAntiquaryState = simulate('Antiquary', []).endState.profession;
  const projectedAntiquaryInitiative = resourceDisplayViews(thiefProfession, {
    specialization: 'Antiquary',
    professionState: projectedAntiquaryState
  })[0];

  assert.equal(projectedAntiquaryInitiative.pipRows, 3);

  const deadeyeMalice = resourceViews('Deadeye').find((view) => view.id === 'malice');

  assert.equal(deadeyeMalice.displayMode, 'pips');
  assert.equal(deadeyeMalice.pipStyle, 'thief-malice');

  const coreEndurance = resourceViews('Core').find((view) => view.id === 'endurance');

  assert.equal(coreEndurance.maximum, 100);
  assert.equal(coreEndurance.value, 100);
  assert.equal(coreEndurance.displayMode, 'bar');
  assert.equal(coreEndurance.pipStyle, 'endurance');
  assert.equal(coreEndurance.canStart, false);

  const daredevilEndurance = resourceViews('Daredevil').find((view) => view.id === 'endurance');

  assert.equal(daredevilEndurance.maximum, 150);
  assert.equal(daredevilEndurance.value, 150);

  const displayedInitiative = resourceDisplayViews(thiefProfession, {
    specialization: 'Core',
    professionState: {
      initiative: 4.9,
      maximumInitiative: 12
    }
  })[0];

  assert.equal(displayedInitiative.value, 4);
});

test('Thief Dodge waits for endurance and Vigor accelerates the queue', () => {
  const withoutVigor = simulate('Core', ['Dodge', 'Dodge', 'Dodge'], {
    boons: { vigor: false }
  });
  const withVigor = simulate('Core', ['Dodge', 'Dodge', 'Dodge'], {
    boons: { vigor: true }
  });

  assert.deepEqual(withoutVigor.warnings, []);
  assert.deepEqual(
    withoutVigor.steps.map((step) => step.start),
    [0, 800, 10000]
  );
  assert.deepEqual(withVigor.warnings, []);
  assert.deepEqual(
    withVigor.steps.map((step) => step.start),
    [0, 800, 6667]
  );
});

test('every legal one-hand combination resolves one exact opening slot 3', () => {
  const expected = new Map([
    ['Dagger/Dagger', 'Death Blossom'],
    ['Dagger/Pistol', 'Shadow Shot'],
    ['Dagger/', 'Twisting Fangs'],
    ['Pistol/Dagger', 'Shadow Strike'],
    ['Pistol/Pistol', 'Unload'],
    ['Pistol/', 'Repeater'],
    ['Sword/Dagger', 'Flanking Strike'],
    ['Sword/Pistol', 'Flawless Execution'],
    ['Sword/', 'Stab'],
    ['Scepter/Dagger', 'Twilight Combo'],
    ['Scepter/Pistol', 'Measured Shot'],
    ['Scepter/', 'Triple Threat'],
    ['Axe/Dagger', 'Harrowing Storm'],
    ['Axe/Pistol', 'Orchestrated Assault'],
    ['Axe/', 'Recall Axes']
  ]);

  for (const [key, name] of expected) {
    const pair = key.split('/');
    const roots = thiefCatalog.skills.filter(
      (skill) =>
        skill.type === 'Weapon' &&
        skill.slot === 'Weapon_3' &&
        skill.flipParentId == null &&
        thiefWeaponSkillMatchesSet(skill, pair, {
          catalog: thiefCatalog
        })
    );

    assert.deepEqual(
      roots.map((skill) => skill.name),
      [name],
      key
    );
  }

  assert.equal(
    thiefCatalog.skills.some(
      (skill) =>
        skill.type === 'Weapon' &&
        skill.slot === 'Weapon_3' &&
        thiefWeaponSkillMatchesSet(skill, ['Sword', 'Sword'], {
          catalog: thiefCatalog
        })
    ),
    false
  );
});

test('dual-wield follow-ups require and consume their opening skill', () => {
  const denied = simulate('Core', ['Larcenous Strike'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Dagger'
  });

  assert.match(denied.warnings[0], /opening dual-wield skill/);
  const result = simulate('Core', ['Flanking Strike', 'Larcenous Strike'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Dagger'
  });

  assert.equal(result.warnings.length, 0);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.endState.profession.availableFlips[13007], undefined);
});

test('every terrestrial main hand exposes its normal stealth attack', () => {
  const expected = new Map([
    ['Dagger', 'Backstab'],
    ['Pistol', 'Sneak Attack'],
    ['Sword', 'Tactical Strike'],
    ['Shortbow', 'Surprise Shot'],
    ['Staff', 'Hook Strike'],
    ['Rifle', "Death's Judgment"],
    ['Scepter', 'Shadowsquall'],
    ['Axe', 'Cunning Salvo'],
    ['Spear', 'Ashen Assault']
  ]);

  for (const [weapon, name] of expected) {
    assert.ok(
      thiefCatalog.skills.some(
        (skill) => skill.name === name && skill.stealthAttack && !skill.malicious && skill.requiredMainHand === weapon
      ),
      weapon
    );
  }
});

test('initiative regenerates at exact boundaries and ignores Alacrity', () => {
  const boundary = simulate('Core', ['Death Blossom'], {
    initialInitiative: 3
  });

  assert.equal(boundary.warnings.length, 0);
  assert.equal(boundary.steps[0].start, 1000);
  assert.equal(boundary.endState.profession.initiative, 1.56);

  for (const alacrity of [false, true]) {
    const result = simulate('Core', [{ type: 'wait', durationMs: 5000 }], {
      initialInitiative: 0,
      boons: { alacrity }
    });

    assert.equal(result.endState.profession.initiative, 5);
  }

  const kneeling = simulate('Deadeye', ['Kneel', { type: 'wait', durationMs: 3000 }], {
    initialInitiative: 1,
    primaryWeapon: 'Rifle',
    secondaryWeapon: ''
  });

  assert.equal(kneeling.warnings.length, 0);
  assert.ok(Math.abs(kneeling.endState.profession.initiative - 14 / 3) < 1e-9);
});

test('Unload grants 2 initiative when every bullet lands', () => {
  const completed = simulate('Core', ['Unload'], {
    initialInitiative: 3,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol'
  });
  const refund = completed.events.find((event) => event.type === 'thief.state' && event.reason === 'unload-refund');

  assert.equal(completed.steps[0].end - completed.steps[0].start, 1980);
  assert.equal(completed.steps[0].interrupted, false);
  assert.equal(refund.at, 1.98);
  assert.equal(refund.state.initiative, 3.98);

  const quickened = simulate('Core', ['Unload'], {
    initialInitiative: 3,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol',
    boons: { quickness: true }
  });
  const quickenedRefund = quickened.events.find(
    (event) => event.type === 'thief.state' && event.reason === 'unload-refund'
  );

  assert.equal(quickened.steps[0].end - quickened.steps[0].start, 1320);
  assert.equal(quickened.steps[0].interrupted, false);
  assert.deepEqual(
    quickened.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Unload')
      .map((event) => Math.round(event.at * 1000)),
    [97, 193, 290, 387, 483, 580, 677, 773]
  );
  assert.equal(quickenedRefund.at, 1.32);
  assert.ok(Math.abs(quickenedRefund.state.initiative - 3.32) < 1e-9);

  const safelyInterrupted = simulate('Core', [{ name: 'Unload', interruptMs: 1160 }], {
    initialInitiative: 3,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol'
  });
  const safeRefund = safelyInterrupted.events.find(
    (event) => event.type === 'thief.state' && event.reason === 'unload-refund'
  );
  const safeBullets = safelyInterrupted.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Unload'
  );

  assert.deepEqual(
    safeBullets.map((event) => Math.round(event.at * 1000)),
    []
  );
  assert.equal(safelyInterrupted.steps[0].end - safelyInterrupted.steps[0].start, 1160);
  assert.equal(safelyInterrupted.steps[0].interrupted, true);
  assert.equal(safeRefund, undefined);

  const interruptedBeforeFinalBullet = simulate('Core', [{ name: 'Unload', interruptMs: 1159 }], {
    initialInitiative: 3,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol'
  });

  assert.equal(
    interruptedBeforeFinalBullet.events.filter((event) => event.type === 'damage' && event.skillName === 'Unload')
      .length,
    0
  );
  assert.equal(
    interruptedBeforeFinalBullet.events.some(
      (event) => event.type === 'thief.state' && event.reason === 'unload-refund'
    ),
    false
  );
});

test('weapon swap preserves shared initiative', () => {
  const result = simulate('Core', ['Death Blossom', 'Swap Weapons', 'Unload']);

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.activeWeaponSet, 2);
  assert.ok(Math.abs(result.endState.profession.initiative - 10.54) < 1e-9);
  assert.ok(result.events.some((event) => event.type === 'weapon_set'));

  const resetChain = simulate('Core', ['Double Strike', 'Swap Weapons', 'Double Strike'], {
    weaponSet2Primary: 'Dagger',
    weaponSet2Secondary: 'Dagger'
  });

  assert.deepEqual(resetChain.warnings, []);
  assert.equal(resetChain.steps.filter((step) => step.skill === 'Double Strike').length, 2);
});

test('a pre-commit cancellation does not advance the Thief autoattack chain', () => {
  const result = simulate('Core', [{ name: 'Double Strike', interruptMs: 1 }, 'Double Strike'], {
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[0].cancelledBeforeCommit, true);
  assert.equal(result.endState.profession.autoattackChains[ID.DOUBLE_STRIKE], ID.WILD_STRIKE);
});

test('stealth attacks remove stealth, apply Revealed, and block replacement', () => {
  const result = simulate('Core', ['Cloak and Dagger', 'Backstab', 'Cloak and Dagger', 'Backstab']);

  assert.match(result.warnings.at(-1), /requires stealth/);
  assert.ok(result.endState.profession.revealedUntil > 0);
  assert.equal(result.endState.profession.stealthUntil <= result.duration, true);
});

test('non-stealth strike skills remove stealth and restore the normal autoattack', () => {
  const result = simulate('Core', ['Hide in Shadows', 'Heartseeker', 'Double Strike']);

  assert.deepEqual(result.warnings, []);
  assert.ok(result.endState.profession.revealedUntil > 0);
  assert.equal(result.endState.profession.stealthUntil <= result.duration, true);
  assert.ok(result.events.some((event) => event.type === 'damage' && event.skillName === 'Double Strike'));
});

test('delayed strikes break stealth on impact without blocking a same-time stealth attack', () => {
  const config = {
    primaryWeapon: 'Rifle',
    secondaryWeapon: '',
    selectedSkills: ['Shadow Meld', 'Shadow Flare']
  };
  const impact = simulate('Deadeye', ['Kneel', 'Shadow Meld', 'Shadow Flare', { type: 'wait', durationMs: 1 }], config);
  const flareDamage = impact.events.find((event) => event.type === 'damage' && event.skillName === 'Shadow Flare');
  const stealthBreak = impact.events.find(
    (event) => event.type === 'thief.state' && event.reason === 'strike-broke-stealth'
  );

  assert.equal(stealthBreak.at, flareDamage.at);
  const sameTimeAttack = simulate(
    'Deadeye',
    ['Kneel', 'Shadow Meld', 'Shadow Flare', "Malicious Death's Judgment"],
    config
  );
  const flare = sameTimeAttack.events.find((event) => event.type === 'damage' && event.skillName === 'Shadow Flare');
  const deathJudgment = sameTimeAttack.steps.find((step) => step.skill === "Malicious Death's Judgment");

  assert.deepEqual(sameTimeAttack.warnings, []);
  assert.ok(Math.abs(deathJudgment.start / 1000 - flare.at) < 1e-9);
});

test('stealth replaces weapon skill 1 without a separate palette group', () => {
  const context = {
    specialization: 'Core',
    time: 1,
    activeWeaponSet: 1,
    build: {
      weapons: ['Dagger', 'Dagger'],
      alternateWeapons: ['Pistol', 'Pistol']
    },
    professionState: {
      stealthUntil: 4,
      revealedUntil: 0
    }
  };
  const groups = thiefProfession.ui.paletteGroups(context);

  assert.equal(
    groups.some((group) => group.id === 'thief-stealth-attacks'),
    false
  );
  assert.equal(thiefProfession.ui.isPaletteSkillAvailable(context, thiefCatalog.skillsByName.get('Backstab')), true);
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(context, thiefCatalog.skillsByName.get('Double Strike')),
    false
  );

  const build = {
    ...createThiefBuildDefaults(),
    weapons: ['Dagger', 'Dagger'],
    alternateWeapons: ['', ''],
    specializations: []
  };
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skills: thiefCatalog.skills,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    weaponData: thiefAppAdapter.weaponData,
    results: null
  };
  const paletteNamesAfter = (rotation) => {
    app.results = simulate('Core', rotation, {
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Dagger',
      weaponSet2Primary: '',
      weaponSet2Secondary: ''
    });

    return weaponPaletteRows(app, 1)[0].skills.map((skill) => skill.name);
  };

  const ordinary = paletteNamesAfter([]);

  assert.ok(ordinary.includes('Double Strike'));
  assert.equal(ordinary.includes('Backstab'), false);

  const stealthed = paletteNamesAfter(['Cloak and Dagger']);

  assert.ok(stealthed.includes('Backstab'));
  assert.equal(stealthed.includes('Double Strike'), false);
});

test('Deadeye palette uses malicious stealth attacks and one stateful rifle bar', () => {
  const deadeyesMark = thiefCatalog.skillsByName.get("Deadeye's Mark");
  const deadeyeStolenSkillIds = [
    ID.STEAL_TIME,
    ID.STEAL_WARMTH,
    ID.STEAL_RESISTANCE,
    ID.STEAL_PRECISION,
    ID.STEAL_HEALTH,
    ID.STEAL_STRENGTH,
    ID.STEAL_DURABILITY,
    ID.STEAL_DEFENSES,
    ID.STEAL_MOBILITY
  ];

  assert.equal(deadeyesMark.flipParentId, null);

  const matchingNames = (pair, kneeling) =>
    thiefCatalog.skills
      .filter(
        (skill) =>
          skill.type === 'Weapon' &&
          thiefWeaponSkillMatchesSet(skill, pair, {
            catalog: thiefCatalog,
            specialization: 'Deadeye',
            professionState: { kneeling }
          })
      )
      .map((skill) => skill.name);

  const dagger = matchingNames(['Dagger', 'Dagger'], false);

  assert.ok(dagger.includes('Malicious Backstab'));
  assert.equal(dagger.includes('Backstab'), false);

  const standing = matchingNames(['Rifle', ''], false);

  assert.ok(standing.includes('Brutal Aim'));
  assert.ok(standing.includes('Double Tap'));
  assert.ok(standing.includes("Skirmisher's Shot"));
  assert.ok(standing.includes('Kneel'));
  assert.ok(standing.includes("Malicious Death's Judgment"));
  assert.equal(standing.includes('Deadly Aim'), false);
  assert.equal(standing.includes('Three Round Burst'), false);
  assert.equal(standing.includes("Spotter's Shot"), false);
  assert.equal(standing.includes('Free Action'), false);
  assert.equal(standing.includes("Death's Judgment"), false);

  const kneeling = matchingNames(['Rifle', ''], true);

  assert.ok(kneeling.includes('Deadly Aim'));
  assert.ok(kneeling.includes('Three Round Burst'));
  assert.ok(kneeling.includes("Spotter's Shot"));
  assert.ok(kneeling.includes('Free Action'));
  assert.equal(kneeling.includes('Brutal Aim'), false);
  assert.equal(kneeling.includes('Double Tap'), false);
  assert.equal(kneeling.includes("Skirmisher's Shot"), false);
  assert.equal(kneeling.includes('Kneel'), false);

  const paletteGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Deadeye',
    build: { weapons: ['Rifle', ''], alternateWeapons: ['Dagger', 'Dagger'] },
    activeWeaponSet: 1,
    professionState: { kneeling: false }
  });

  assert.equal(
    paletteGroups.some((group) => group.id === 'thief-rifle-stance'),
    false
  );

  const professionGroup = paletteGroups.find((group) => group.id === 'thief-profession');
  const alwaysVisibleStolenGroup = paletteGroups.find((group) => group.id === 'deadeye-stolen-skills');

  assert.deepEqual(professionGroup.skillIds, [ID.DEADEYES_MARK]);
  assert.deepEqual(alwaysVisibleStolenGroup.skillIds, deadeyeStolenSkillIds);
  assert.equal(professionGroup.stackId, 'deadeye-stolen-skills');
  assert.equal(alwaysVisibleStolenGroup.stackId, professionGroup.stackId);
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      { specialization: 'Deadeye', professionState: { storedStolenSkillIds: [] } },
      thiefCatalog.skillsById.get(ID.STEAL_TIME)
    ),
    false
  );

  const storedStolenSkillState = {
    storedStolenSkillId: ID.STEAL_TIME,
    storedStolenSkillIds: [ID.STEAL_TIME],
    storedStolenSkillCount: 1
  };
  const stolenGroup = thiefProfession.ui
    .paletteGroups({
      specialization: 'Deadeye',
      professionState: storedStolenSkillState
    })
    .find((group) => group.id === 'deadeye-stolen-skills');

  assert.deepEqual(stolenGroup.skillIds, deadeyeStolenSkillIds);
  assert.equal(stolenGroup.className, 'deadeye-stolen-skills-grid');
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      {
        specialization: 'Deadeye',
        professionState: storedStolenSkillState
      },
      thiefCatalog.skillsById.get(ID.STEAL_TIME)
    ),
    true
  );
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      { specialization: 'Deadeye', professionState: storedStolenSkillState },
      thiefCatalog.skillsById.get(ID.STEAL_DEFENSES)
    ),
    false
  );
});

test('Thief weapon chains and follow-ups occupy one live palette tile', () => {
  const paletteAfter = (specialization, weapons, rotation) => {
    const defaults = createThiefBuildDefaults();
    const specializations = [
      { name: 'Deadly Arts', traits: '1-1-1' },
      { name: 'Critical Strikes', traits: '1-1-1' },
      { name: specialization === 'Core' ? 'Shadow Arts' : specialization, traits: '1-1-1' }
    ];
    const app = {
      build: {
        ...defaults,
        weapons,
        alternateWeapons: ['', ''],
        specializations
      },
      adapter: thiefAppAdapter,
      profession: thiefProfession,
      skills: thiefCatalog.skills,
      skillById: thiefCatalog.skillsById,
      skillByName: thiefCatalog.skillsByName,
      weaponData: thiefAppAdapter.weaponData,
      results: simulate(specialization, rotation, {
        primaryWeapon: weapons[0],
        secondaryWeapon: weapons[1],
        weaponSet2Primary: '',
        weaponSet2Secondary: ''
      })
    };

    return weaponPaletteRows(app, 1)[0].skills;
  };

  const paletteNamesAfter = (...args) => paletteAfter(...args).map((skill) => skill.name);

  assert.ok(paletteNamesAfter('Specter', ['Scepter', 'Pistol'], []).includes('Shadow Bolt'));
  assert.ok(paletteNamesAfter('Specter', ['Scepter', 'Pistol'], ['Shadow Bolt']).includes('Double Bolt'));
  assert.ok(
    paletteNamesAfter('Specter', ['Scepter', 'Pistol'], ['Shadow Bolt', 'Double Bolt']).includes('Triple Bolt')
  );

  const sword = paletteNamesAfter('Core', ['Sword', 'Pistol'], ["Infiltrator's Strike"]);

  assert.ok(sword.includes("Infiltrator's Return"));
  assert.equal(sword.includes("Infiltrator's Strike"), false);

  const shortbow = paletteNamesAfter('Core', ['Shortbow', ''], ['Cluster Bomb']);

  assert.ok(shortbow.includes('Detonate Cluster'));
  assert.equal(shortbow.includes('Cluster Bomb'), false);

  const staff = paletteNamesAfter('Daredevil', ['Staff', ''], ['Debilitating Arc']);

  assert.ok(staff.includes('Helmet Breaker'));
  assert.equal(staff.includes('Debilitating Arc'), false);

  const standingRifle = paletteNamesAfter('Deadeye', ['Rifle', ''], []);

  assert.ok(standingRifle.includes("Death's Retreat"));
  assert.equal(standingRifle.includes("Sniper's Cover"), false);

  const kneelingRifleSkills = paletteAfter('Deadeye', ['Rifle', ''], ['Kneel', "Sniper's Cover"]);
  const kneelingRifle = kneelingRifleSkills.map((skill) => skill.name);

  assert.ok(kneelingRifle.includes("Death's Advance"));
  assert.equal(kneelingRifle.includes("Sniper's Cover"), false);
  assert.equal(
    kneelingRifleSkills.some((skill) => skill.id === 40436),
    true
  );
  assert.equal(
    kneelingRifleSkills.some((skill) => skill.id === 80278),
    false
  );
});

test('Steal exposes a choice pool and consumes whichever stolen skill is selected', () => {
  const stolenSkillIds = [ID.THROW_GUNK, ID.CONSUME_PLASMA, ID.WHIRLING_AXE];
  const initialGroups = thiefProfession.ui.paletteGroups({ specialization: 'Core' });
  const initialProfessionGroup = initialGroups.find((group) => group.id === 'thief-profession');
  const initialStolenGroup = initialGroups.find((group) => group.id === 'thief-stolen-skills');

  assert.deepEqual(initialProfessionGroup.skillIds, [ID.STEAL]);
  assert.deepEqual(initialStolenGroup.skillIds, stolenSkillIds);
  assert.equal(initialProfessionGroup.stackId, initialStolenGroup.stackId);
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      { specialization: 'Core' },
      thiefCatalog.skillsById.get(ID.CONSUME_PLASMA)
    ),
    false
  );

  const stored = simulate('Core', ['Steal']);

  assert.equal(stored.endState.profession.storedStolenSkillId, null);
  assert.deepEqual(stored.endState.profession.storedStolenSkillIds, stolenSkillIds);
  const storedGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Core',
    professionState: stored.endState.profession
  });

  assert.deepEqual(storedGroups.find((group) => group.id === 'thief-stolen-skills').skillIds, stolenSkillIds);
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      { specialization: 'Core', professionState: stored.endState.profession },
      thiefCatalog.skillsById.get(ID.CONSUME_PLASMA)
    ),
    true
  );
  const used = simulate('Core', ['Steal', 'Consume Plasma']);

  assert.equal(used.warnings.length, 0);
  assert.equal(used.endState.profession.storedStolenSkillId, null);
  assert.deepEqual(used.endState.profession.storedStolenSkillIds, []);
  assert.deepEqual(
    thiefProfession.ui
      .paletteGroups({ specialization: 'Daredevil', professionState: used.endState.profession })
      .find((group) => group.id === 'thief-stolen-skills').skillIds,
    stolenSkillIds
  );
});

test('Daredevil capacity and every dodge replacement resolve explicitly', () => {
  const expectations = new Map([
    ['Lotus Training', 'condition'],
    ['Bounding Dodger', 'damage'],
    ['Unhindered Combatant', 'buff']
  ]);

  for (const [selectedDodge, eventType] of expectations) {
    const traitId = TRAIT[selectedDodge.toUpperCase().replace(/[^A-Z0-9]+/g, '_')];
    const result = simulate('Daredevil', ['Dodge'], {
      selectedDodge,
      selectedTraitIds: [traitId]
    });

    assert.equal(result.endState.profession.maximumEndurance, 150);
    assert.ok(result.events.some((event) => event.type === eventType));

    if (selectedDodge === 'Bounding Dodger') {
      const stateIndex = result.events.findIndex(
        (event) => event.type === 'thief.state' && event.reason === 'daredevil-dodge'
      );
      const boundIndex = result.events.findIndex((event) => event.type === 'damage' && event.name === 'Bound');

      assert.ok(stateIndex >= 0 && stateIndex < boundIndex);
    }
  }

  const resilient = simulate('Daredevil', [], {
    selectedTraitIds: [TRAIT.MARAUDERS_RESILIENCE],
    stats: { power: 2000, vitality: 1000 }
  });

  assert.equal(resilient.endState.profession.maximumHealth, 13045);

  const impalingLotus = simulate('Daredevil', ['Dodge'], {
    selectedDodge: 'Lotus Training',
    selectedTraitIds: [TRAIT.LOTUS_TRAINING]
  });

  assert.deepEqual(
    impalingLotus.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Impaling Lotus')
      .map(({ at, coefficient }) => [at, coefficient]),
    [
      [0.2, 0.1875],
      [0.36, 0.1875],
      [0.52, 0.1875]
    ]
  );
  assert.deepEqual(
    impalingLotus.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Impaling Lotus')
      .map(({ at, condition, stacks, duration }) => [at, condition, stacks, duration]),
    [
      [0.2, 'Bleeding', 2, 4],
      [0.36, 'Torment', 2, 4],
      [0.52, 'Crippled', 1, 3]
    ]
  );
});

test('Exposed Weakness multiplies separately from additive strike bonuses', () => {
  const config = {
    selectedTraitIds: [TRAIT.EXPOSED_WEAKNESS],
    sigilSets: [
      { names: ['Test'], strike: 1.08, strikeAdd: 0.08 },
      { names: [], strike: 1, strikeAdd: 0 }
    ],
    target: {
      conditions: { Vulnerability: 25, Weakness: true }
    }
  };
  const exposed = simulate('Core', ['Double Strike'], config);
  const baseline = simulate('Core', ['Double Strike'], {
    ...config,
    selectedTraitIds: []
  });
  const damage = (result) => result.breakdown.find((entry) => entry.name === 'Double Strike').damage;

  assert.ok(Math.abs(damage(exposed) / damage(baseline) - 1.04) < 1e-12);
});

test('Critical Strikes applies runtime Fury, No Quarter, and multiplicative modifiers', () => {
  const criticalConfig = {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedSkills: [],
    stats: { power: 2000, precision: 5000, ferocity: 0 },
    target: { armor: 2597, defiant: true, health: 1_000_000 },
    boons: { fury: false }
  };
  const flawlessHits = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Flawless Execution');
  const unrelenting = simulate('Daredevil', ['Flawless Execution'], {
    ...criticalConfig,
    selectedTraitIds: [TRAIT.UNRELENTING_STRIKES]
  });
  const withNoQuarter = simulate('Daredevil', ['Flawless Execution', { type: 'wait', durationMs: 3700 }, 'Slice'], {
    ...criticalConfig,
    selectedTraitIds: [TRAIT.UNRELENTING_STRIKES, TRAIT.NO_QUARTER]
  });
  const firstFlawless = flawlessHits(withNoQuarter);

  assert.equal(firstFlawless[0].criticalDamage, 1.5);
  assert.equal(firstFlawless[1].criticalDamage, 1.5 + 250 / 1500);
  const extendedFurySlice = withNoQuarter.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Slice'
  );

  assert.equal(extendedFurySlice.criticalDamage, 1.5 + 250 / 1500);
  assert.equal(withNoQuarter.profession.traitProcReadyAt[TRAIT.UNRELENTING_STRIKES], firstFlawless[0].at + 8);
  assert.equal(withNoQuarter.profession.traitProcReadyAt[TRAIT.NO_QUARTER], extendedFurySlice.at + 2);

  const withAssassinsFury = simulate('Daredevil', ['Flawless Execution'], {
    ...criticalConfig,
    selectedTraitIds: [TRAIT.UNRELENTING_STRIKES, TRAIT.ASSASSINS_FURY]
  });

  assert.ok(
    Math.abs(flawlessHits(withAssassinsFury)[1].damage / flawlessHits(unrelenting)[1].damage - 2090 / 2000) < 1e-9
  );
  assert.equal(
    withAssassinsFury.profession.traitProcReadyAt[TRAIT.ASSASSINS_FURY],
    flawlessHits(withAssassinsFury)[0].at + 2
  );

  const modifierConfig = {
    stats: { power: 2000, precision: 1000, ferocity: 0 },
    target: { armor: 2597, defiant: true, health: 1_000_000 }
  };
  const strike = (selectedTraitIds, target = modifierConfig.target) =>
    simulate('Daredevil', ['Slice'], {
      ...modifierConfig,
      target,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Pistol',
      selectedTraitIds
    }).resolvedEvents.find((event) => event.type === 'damage');

  assert.equal(strike([TRAIT.KEEN_OBSERVER]).criticalChance, 0.2);
  assert.ok(Math.abs(strike([TRAIT.TWIN_FANGS]).criticalChance - 0.12) < 1e-12);
  assert.ok(
    Math.abs(
      strike([TRAIT.TWIN_FANGS], {
        ...modifierConfig.target,
        defiant: false
      }).criticalChance - 0.05
    ) < 1e-12
  );
  assert.ok(Math.abs(strike([TRAIT.TWIN_FANGS, TRAIT.FEROCIOUS_STRIKES]).criticalDamage - 1.5 * 1.07 * 1.1) < 1e-12);
});

test('Thief modifiers follow stable skill and packet IDs after display labels change', () => {
  const vampiric = thiefCoreModifierRules.find((rule) => rule.id === 'thief.vampiric-slash-vulnerable');
  assert.equal(
    vampiric.when({
      event: {
        type: 'damage',
        actorType: 'player',
        name: 'Renamed life-siphon packet',
        metadata: { packetKind: 'thief.vampiric-slash-life-siphon' }
      },
      config: { target: { conditions: { Vulnerability: true } } },
      time: 0
    }),
    true
  );

  const larcenous = thiefCoreModifierRules.find((rule) => rule.id === 'thief.larcenous-strike-boonless');
  assert.equal(
    larcenous.when({
      event: { type: 'damage', actorType: 'player', skillId: ID.LARCENOUS_STRIKE },
      profession: {
        catalog: {
          skillsById: new Map([
            [ID.LARCENOUS_STRIKE, { ...thiefCatalog.skillsById.get(ID.LARCENOUS_STRIKE), name: 'Renamed skill' }]
          ])
        }
      },
      config: { target: { boonless: true } },
      time: 0
    }),
    true
  );
});

test('Daredevil skills and endurance traits use configured values', () => {
  const expectedQuicknessTimes = new Map([
    [ID.BACKSTAB, 320],
    [ID.FIST_FLURRY, 680],
    [ID.IMPAIRING_DAGGERS, 480],
    [ID.PALM_STRIKE, 480],
    [ID.CHANNELED_VIGOR, 480]
  ]);

  for (const [skillId, duration] of expectedQuicknessTimes) {
    assert.equal(thiefCatalog.skillsById.get(skillId).quicknessCastTimeMs, duration);
  }

  const backstabStrike = thiefCatalog.skillsById.get(ID.BACKSTAB).effects.find((effect) => effect.type === 'strike');

  assert.deepEqual(
    [backstabStrike.ticks[0].atMs, backstabStrike.timingAnchor, backstabStrike.timingScale],
    [200, 'castStart', 'fixed']
  );
  assert.equal(thiefCatalog.skillsById.get(ID.BACKSTAB).interruptCommitMs, 200);
  const interruptedBackstab = simulate('Daredevil', ['Cloak and Dagger', { name: 'Backstab', interruptMs: 280 }], {
    stats: { precision: 5000 }
  });

  assert.equal(interruptedBackstab.steps[1].interrupted, true);
  assert.equal(interruptedBackstab.steps[1].end - interruptedBackstab.steps[1].start, 280);
  assert.equal(interruptedBackstab.breakdown.find((entry) => entry.sourceSkill === 'Backstab').hits, 1);
  assert.equal(thiefCatalog.skillsById.get(ID.DODGE).castTimeMs, 800);
  assert.equal(thiefCatalog.skillsById.get(ID.DODGE).quicknessCastTimeMs, undefined);
  assert.equal(thiefCatalog.skillsById.get(ID.DODGE).unaffectedByQuickness, true);
  assert.equal(thiefCatalog.skillsById.get(ID.CHANNELED_VIGOR).resourceGain, 125);

  const totalCoefficient = (name) => {
    const strike = thiefCatalog.skillsByName.get(name).effects.find((effect) => effect.type === 'strike');

    return strike.ticks.reduce((sum, tick) => sum + tick.coefficient, 0);
  };

  assert.equal(totalCoefficient('Fist Flurry'), 3.75);
  assert.equal(totalCoefficient('Impairing Daggers'), 2.5);
  assert.deepEqual(
    thiefCatalog.skillsByName
      .get('Impairing Daggers')
      .effects.find((effect) => effect.type === 'strike')
      .ticks.map((tick) => tick.coefficient),
    [0.75, 0.75, 1]
  );

  const directPalm = simulate('Daredevil', ['Palm Strike']);

  assert.match(directPalm.warnings[0], /Fist Flurry must connect/i);

  const traits = [TRAIT.BRAWLERS_TENACITY, TRAIT.WEAKENING_STRIKES, TRAIT.BOUNDING_DODGER];
  const skillSequence = ['Dodge', 'Fist Flurry', 'Palm Strike', { name: '__wait', waitMs: 2100 }];
  const base = simulate('Daredevil', skillSequence, {
    selectedDodge: 'Bounding Dodger',
    selectedTraitIds: traits.filter((id) => id !== TRAIT.BRAWLERS_TENACITY)
  });
  const brawler = simulate('Daredevil', skillSequence, {
    selectedDodge: 'Bounding Dodger',
    selectedTraitIds: traits
  });

  assert.deepEqual(brawler.warnings, []);
  assert.ok(Math.abs(brawler.endState.profession.endurance - base.endState.profession.endurance - 15) < 1e-9);
  assert.ok(
    brawler.resolvedEvents.some(
      (event) =>
        event.type === 'condition' && event.condition === 'Weakness' && event.sourceId === TRAIT.WEAKENING_STRIKES
    )
  );
  const palm = brawler.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Palm Strike');
  const pulmonary = brawler.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Pulmonary Impact'
  );

  assert.equal(pulmonary.length, 2);
  assert.ok(pulmonary.every((event) => event.canCrit === false && Math.abs(event.at - palm.at - 2) < 1e-9));

  const withoutSteal = simulate('Daredevil', ['Dodge', 'Dodge', 'Steal']);
  const withSteal = simulate('Daredevil', ['Dodge', 'Dodge', 'Steal'], {
    selectedTraitIds: [TRAIT.ENDURANCE_THIEF]
  });

  assert.ok(Math.abs(withSteal.endState.profession.endurance - withoutSteal.endState.profession.endurance - 50) < 1e-9);

  const havoc = daredevilModifierRules.find((rule) => rule.id === 'thief.havoc-specialist');
  const weakening = daredevilModifierRules.find((rule) => rule.id === 'thief.weakening-strikes');

  assert.equal(havoc.operation, 'multiply');
  assert.equal(havoc.factor, 1.15);
  assert.equal(weakening.operation, 'multiply');
  assert.equal(weakening.factor, 1.1);
});

test('Daredevil Staff skills use supplied coefficients and effects', () => {
  const expected = [
    ['Staff Strike', 0.85, 1, 0],
    ['Staff Bash', 0.9, 1, 0],
    ['Punishing Strikes', 2.1, 4, 0],
    ['Hook Strike', 0.65, 1, 0],
    ['Weakening Whirl', 2.22, 3, 3],
    ['Debilitating Arc', 1, 1, 3],
    ['Helmet Breaker', 1.25, 1, 1],
    ['Dust Strike', 1.8, 3, 4],
    ['Vault', 2.25, 1, 5]
  ];

  for (const [name, coefficient, hits, initiativeCost] of expected) {
    const skill = thiefCatalog.skillsByName.get(name);
    const strike = skill.effects.find((effect) => effect.type === 'strike');

    assert.equal(skill.weapon, 'Staff', name);
    assert.ok(Math.abs(strike.ticks.reduce((total, tick) => total + tick.coefficient, 0) - coefficient) < 1e-12, name);
    assert.equal(strike.ticks.length, hits, name);
    assert.equal(skill.initiativeCost, initiativeCost, name);
  }

  const expectedQuicknessTimes = [
    ['Staff Strike', 360],
    ['Staff Bash', 360],
    ['Punishing Strikes', 760],
    ['Weakening Whirl', 720],
    ['Debilitating Arc', 200],
    ['Hook Strike', 640]
  ];

  for (const [name, quicknessCastTimeMs] of expectedQuicknessTimes) {
    const skill = thiefCatalog.skillsByName.get(name);

    assert.equal(skill.quicknessCastTimeMs, quicknessCastTimeMs, name);
    assert.equal(skill.castTimeMs, quicknessCastTimeMs * 1.5, name);
  }

  for (const name of ['Punishing Strikes', 'Weakening Whirl']) {
    const skill = thiefCatalog.skillsByName.get(name);

    assert.equal(skill.comboFinishers[0].ownerId, 'thief', name);
    assert.equal(skill.comboFinishers[0].finisherType, 'Whirl', name);
  }

  const impalingLotus = thiefCatalog.skillsByName.get('Impaling Lotus');

  assert.equal(impalingLotus.comboFinishers[0].ownerId, 'thief');
  assert.equal(impalingLotus.comboFinishers[0].finisherType, 'Whirl');

  const punishing = thiefCatalog.skillsByName.get('Punishing Strikes');
  const vulnerability = punishing.effects.find((effect) => effect.type === 'condition');

  assert.deepEqual(
    [vulnerability.ticks[0].condition, vulnerability.ticks[0].stacks, vulnerability.ticks[0].duration],
    ['Vulnerability', 4, 8]
  );

  const weakening = thiefCatalog.skillsByName.get('Weakening Whirl');
  const weakness = weakening.effects.find((effect) => effect.type === 'condition');

  assert.deepEqual(
    [weakness.ticks[0].condition, weakness.ticks[0].stacks, weakness.ticks[0].duration],
    ['Weakness', 1, 2]
  );

  const arc = thiefCatalog.skillsByName.get('Debilitating Arc');
  const cripple = arc.effects.find((effect) => effect.type === 'condition');

  assert.deepEqual(
    [cripple.ticks[0].condition, cripple.ticks[0].stacks, cripple.ticks[0].duration],
    ['Crippled', 1, 6]
  );

  const hook = thiefCatalog.skillsByName.get('Hook Strike');
  const hookControl = hook.effects.find((effect) => effect.type === 'control');

  assert.equal(hook.stealthAttack, true);
  assert.equal(hookControl.controlKind, 'knockdown');

  const helmet = thiefCatalog.skillsByName.get('Helmet Breaker');
  const helmetControl = helmet.effects.find((effect) => effect.type === 'control');

  assert.equal(helmetControl.controlKind, 'daze');

  const dust = thiefCatalog.skillsByName.get('Dust Strike');
  const blind = dust.effects.find((effect) => effect.type === 'blind');

  assert.equal(blind.duration, 1);
});

test('Deadeye cantrips, malice, stolen skills, and traits are stateful', () => {
  const deadeyeTraits = [TRAIT.MALICIOUS_INTENT, TRAIT.ONE_IN_THE_CHAMBER, TRAIT.FIRE_FOR_EFFECT];
  const result = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom'], {
    selectedTraitIds: deadeyeTraits,
    stats: { precision: 5000 }
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.markedTargetId, 'primary-target');
  assert.equal(result.endState.profession.storedStolenSkillId, ID.STEAL_TIME);
  assert.equal(result.endState.profession.storedStolenSkillCount, 1);
  assert.equal(result.endState.profession.malice, 4);
  assert.ok(
    result.resolvedEvents.filter((event) => event.skillName === 'Death Blossom' && event.type === 'damage').length > 1
  );

  const consumed = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Cloak and Dagger', 'Malicious Backstab'], {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    stats: { precision: 5000 }
  });

  assert.equal(consumed.warnings.length, 0);
  assert.equal(consumed.endState.profession.malice, 0);

  const selectableStolenSkills = simulate('Deadeye', ["Deadeye's Mark"]);
  const selectableStolenGroup = thiefProfession.ui
    .paletteGroups({ specialization: 'Deadeye', professionState: selectableStolenSkills.endState.profession })
    .find((group) => group.id === 'deadeye-stolen-skills');

  assert.equal(selectableStolenGroup.skillIds.length, 9);
  assert.equal(selectableStolenGroup.className, 'deadeye-stolen-skills-grid');

  const noMaliceStealth = simulate('Deadeye', ["Deadeye's Mark", 'Steal Defenses']);

  assert.equal(noMaliceStealth.warnings.length, 0);
  assert.equal(noMaliceStealth.endState.profession.storedStolenSkillId, null);
  assert.equal(noMaliceStealth.endState.profession.stealthUntil, 0);

  const stolen = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Steal Time'], {
    selectedTraitIds: deadeyeTraits,
    stats: { precision: 5000 }
  });

  assert.equal(stolen.warnings.length, 0);
  assert.ok(stolen.endState.profession.stealthUntil > stolen.duration);
  assert.ok(stolen.events.some((event) => event.name?.includes('Fire for Effect') && event.boon === 'Might'));

  const improvised = simulate('Deadeye', ["Deadeye's Mark", 'Steal Time', 'Steal Time'], {
    selectedTraitIds: [TRAIT.IMPROVISATION]
  });

  assert.equal(improvised.warnings.length, 0);
  assert.equal(improvised.endState.profession.storedStolenSkillId, null);
  assert.equal(improvised.endState.profession.storedStolenSkillCount, 0);

  const lockedImprovisation = simulate('Deadeye', ["Deadeye's Mark", 'Steal Defenses', 'Steal Time'], {
    selectedTraitIds: [TRAIT.IMPROVISATION]
  });

  assert.equal(lockedImprovisation.warnings.length, 1);
  assert.equal(lockedImprovisation.endState.profession.storedStolenSkillId, ID.STEAL_DEFENSES);
  assert.deepEqual(lockedImprovisation.endState.profession.storedStolenSkillIds, [ID.STEAL_DEFENSES]);

  const mercy = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Mercy', "Deadeye's Mark"], {
    selectedTraitIds: deadeyeTraits,
    selectedSkills: ['Mercy'],
    stats: { precision: 5000 }
  });

  assert.equal(mercy.warnings.length, 0);
  assert.equal(mercy.endState.profession.markGeneration, 2);
  assert.equal(mercy.endState.profession.malice, 2);

  const chamber = simulate('Deadeye', ['Shadow Flare'], {
    selectedTraitIds: [TRAIT.ONE_IN_THE_CHAMBER],
    selectedSkills: ['Shadow Flare']
  });

  assert.equal(chamber.endState.profession.storedStolenSkillId, null);
  assert.deepEqual(chamber.endState.profession.storedStolenSkillIds, [
    ID.STEAL_TIME,
    ID.STEAL_WARMTH,
    ID.STEAL_RESISTANCE,
    ID.STEAL_PRECISION,
    ID.STEAL_HEALTH,
    ID.STEAL_STRENGTH,
    ID.STEAL_DURABILITY,
    ID.STEAL_DEFENSES,
    ID.STEAL_MOBILITY
  ]);

  const fireForEffectRestriction = simulate('Deadeye', ["Deadeye's Mark", 'Steal Defenses'], {
    selectedTraitIds: [TRAIT.FIRE_FOR_EFFECT]
  });

  assert.equal(fireForEffectRestriction.warnings.length, 1);
  assert.equal(fireForEffectRestriction.endState.profession.storedStolenSkillId, ID.STEAL_TIME);
  assert.deepEqual(fireForEffectRestriction.endState.profession.storedStolenSkillIds, [ID.STEAL_TIME]);
  assert.deepEqual(
    thiefProfession.ui
      .paletteGroups({
        specialization: 'Deadeye',
        config: { specialization: 'Deadeye', selectedTraitIds: [TRAIT.FIRE_FOR_EFFECT] },
        professionState: fireForEffectRestriction.endState.profession
      })
      .find((group) => group.id === 'deadeye-stolen-skills').skillIds,
    [ID.STEAL_TIME]
  );

  const expired = simulate('Deadeye', ["Deadeye's Mark", { type: 'wait', durationMs: 30_001 }], {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT]
  });

  assert.equal(expired.endState.profession.markedTargetId, null);
  assert.equal(expired.endState.profession.malice, 0);
});

test('Deadeye malice resolves on the first hit and malicious impact', () => {
  const criticalConfig = {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    stats: { precision: 5000 },
    randomness: { mode: 'stochastic', seed: 1 }
  };
  const criticalBurst = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom'], criticalConfig);
  const burstHits = criticalBurst.resolvedEvents.filter(
    (event) => event.skillName === 'Death Blossom' && event.type === 'damage'
  );

  assert.equal(burstHits.length, 3);
  assert.ok(burstHits.every((event) => event.didCrit === true));
  assert.equal(criticalBurst.endState.profession.malice, 4);

  const noncriticalBurst = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom'], {
    stats: { precision: 0 },
    randomness: { mode: 'stochastic', seed: 1 }
  });

  assert.equal(noncriticalBurst.endState.profession.malice, 1);

  const earlyMercy = simulate(
    'Deadeye',
    ["Deadeye's Mark", 'Kneel', 'Three Round Burst', { name: 'Mercy', offset: 100 }],
    {
      ...criticalConfig,
      initialInitiative: 4,
      primaryWeapon: 'Rifle',
      secondaryWeapon: '',
      selectedSkills: ['Mercy']
    }
  );
  const earlyMercyState = earlyMercy.events.find(
    (event) => event.type === 'thief.state' && event.reason === 'mercy'
  ).state;

  assert.ok(Math.abs(earlyMercyState.initiative - 5.133333333333333) < 1e-9);
  assert.equal(earlyMercy.endState.profession.malice, 2);

  const rifleRotation = ["Deadeye's Mark", 'Kneel', 'Three Round Burst', 'Shadow Meld', "Malicious Death's Judgment"];
  const rifleConfig = {
    ...criticalConfig,
    primaryWeapon: 'Rifle',
    secondaryWeapon: '',
    selectedSkills: ['Mercy', 'Shadow Meld']
  };
  const ordinaryShot = simulate('Deadeye', rifleRotation, rifleConfig);
  const mercyShot = simulate('Deadeye', [...rifleRotation, { name: 'Mercy', offset: 100 }], rifleConfig);
  const maliciousEvent = (result) =>
    result.resolvedEvents.find((event) => event.skillName === "Malicious Death's Judgment" && event.type === 'damage');
  const ordinaryEvent = maliciousEvent(ordinaryShot);
  const mercyEvent = maliciousEvent(mercyShot);
  const mercyStep = mercyShot.steps.find((step) => step.skill === 'Mercy');
  const maliceSpent = mercyShot.events.find((event) => event.type === 'thief.state' && event.reason === 'malice-spent');

  assert.equal(mercyEvent.deadeyeMaliceSnapshot, 5);
  assert.equal(mercyEvent.damage, ordinaryEvent.damage);
  assert.equal(maliceSpent.at, mercyEvent.at);
  assert.ok(maliceSpent.at > mercyStep.start / 1000);

  const remarked = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', "Deadeye's Mark"], {
    stats: { precision: 5000 },
    randomness: { mode: 'stochastic', seed: 1 }
  });

  assert.equal(remarked.endState.profession.malice, 2);
});

test('Deadeye strike modifiers, grandmasters, and stealth attacks use supplied values', () => {
  const skillDamage = (result, name) =>
    result.breakdown.find((entry) => entry.sourceSkill === name || entry.name === name)?.damage || 0;
  const ratio = (withEffect, withoutEffect, skill) =>
    skillDamage(withEffect, skill) / skillDamage(withoutEffect, skill);
  const fullCrit = { stats: { precision: 5000 } };

  const plainFlare = simulate('Deadeye', ['Shadow Flare'], {
    ...fullCrit,
    selectedSkills: ['Shadow Flare']
  });
  const markedFlare = simulate('Deadeye', ["Deadeye's Mark", 'Shadow Flare'], {
    ...fullCrit,
    selectedSkills: ['Shadow Flare']
  });

  assert.ok(Math.abs(ratio(markedFlare, plainFlare, 'Shadow Flare') - 1.5) < 1e-9);
  assert.ok(markedFlare.endState.profession.availableFlips[ID.SHADOW_SWAP] > markedFlare.duration);

  const plainStolen = simulate('Deadeye', ["Deadeye's Mark", 'Steal Time'], fullCrit);
  const stealTimeStrike = thiefCatalog.skillsByName
    .get('Steal Time')
    .effects.find((effect) => effect.type === 'strike');
  const plainStealTimeEvent = plainStolen.resolvedEvents.find(
    (event) => event.skillName === 'Steal Time' && event.type === 'damage'
  );

  assert.equal(stealTimeStrike.ticks[0].coefficient, 1);
  assert.equal(plainStealTimeEvent.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.equal(plainStealTimeEvent.resolvedWeaponStrength, 1100);
  const chamberStolen = simulate('Deadeye', ["Deadeye's Mark", 'Steal Time'], {
    ...fullCrit,
    selectedTraitIds: [TRAIT.ONE_IN_THE_CHAMBER]
  });

  assert.ok(Math.abs(ratio(chamberStolen, plainStolen, 'Steal Time') - 1.25) < 1e-9);

  const markedSword = simulate('Deadeye', ["Deadeye's Mark", 'Slice'], {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol'
  });
  const ironSight = simulate('Deadeye', ["Deadeye's Mark", 'Slice'], {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedTraitIds: [TRAIT.IRON_SIGHT]
  });

  assert.ok(Math.abs(ratio(ironSight, markedSword, 'Slice') - 1.1) < 1e-9);

  const plainCantrip = simulate('Deadeye', ['Mercy', 'Slice'], {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedSkills: ['Mercy']
  });
  const relicCantrip = simulate('Deadeye', ['Mercy', 'Slice'], {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedSkills: ['Mercy'],
    relic: 'Deadeye'
  });

  assert.ok(Math.abs(ratio(relicCantrip, plainCantrip, 'Slice') - 1.1) < 1e-9);

  const boonConfig = {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    boons: { fury: true, quickness: true, vigor: true }
  };
  const plainBoonStrike = simulate('Deadeye', ['Slice'], boonConfig);
  const premeditated = simulate('Deadeye', ['Slice'], {
    ...boonConfig,
    selectedTraitIds: [TRAIT.PREMEDITATION]
  });
  const premeditationRatio = ratio(premeditated, plainBoonStrike, 'Slice');

  assert.ok(Math.abs(premeditationRatio - 1.03) < 1e-9, premeditationRatio);

  const quickKiller = simulate('Deadeye', ['Slice'], {
    ...boonConfig,
    selectedTraitIds: [TRAIT.BE_QUICK_OR_BE_KILLED]
  });
  const quickKillerRatio = ratio(quickKiller, plainBoonStrike, 'Slice');

  assert.ok(Math.abs(quickKillerRatio - 2380 / 2180) < 1e-9, quickKillerRatio);
  const markedKiller = simulate('Deadeye', ["Deadeye's Mark"], {
    selectedTraitIds: [TRAIT.BE_QUICK_OR_BE_KILLED]
  });

  assert.ok(markedKiller.events.some((event) => event.boon === 'Quickness' && event.duration === 4));

  const seven = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Death Blossom', 'Death Blossom'], {
    ...fullCrit,
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT, TRAIT.MALEFICENT_SEVEN]
  });

  assert.equal(seven.warnings.length, 0);
  assert.equal(seven.endState.profession.maximumMalice, 7);
  assert.equal(seven.endState.profession.malice, 7);
  assert.ok(seven.events.some((event) => event.name?.includes('Maleficent Seven')));

  const silent = simulate(
    'Deadeye',
    ["Deadeye's Mark", 'Death Blossom', 'Death Blossom', 'Dodge', 'Malicious Backstab'],
    { ...fullCrit, selectedTraitIds: [TRAIT.SILENT_SCOPE] }
  );

  assert.equal(silent.warnings.length, 0);
  assert.equal(silent.endState.profession.stealthAttackCharges, 0);

  const sneak = thiefCatalog.skillsByName.get('Malicious Sneak Attack');
  const sneakStrike = sneak.effects.find((effect) => effect.type === 'strike');
  const sneakTorment = sneak.effects
    .find((effect) => effect.type === 'condition' && effect.ticks.some((tick) => tick.condition === 'Torment'))
    .ticks.find((tick) => tick.condition === 'Torment');

  assert.ok(Math.abs(sneakStrike.ticks.reduce((total, tick) => total + tick.coefficient, 0) - 1.8) < 1e-12);
  assert.equal(sneakStrike.ticks.length, 5);
  assert.deepEqual([sneakTorment.stacks, sneakTorment.duration], [1, 1]);

  for (const [name, quicknessCastTimeMs] of [
    ['Deadly Aim', 600],
    ['Three Round Burst', 840],
    ['Steal Time', 280],
    ['Shadow Flare', 480],
    ['Shadow Meld', 440],
    ["Malicious Death's Judgment", 600],
    ['Malicious Tactical Strike', 440]
  ]) {
    assert.equal(thiefCatalog.skillsByName.get(name).quicknessCastTimeMs, quicknessCastTimeMs, name);
  }

  assert.equal(thiefCatalog.skillsByName.get('Shadow Flare').castTimeMs, 720);
  assert.equal(thiefCatalog.skillsByName.get('Steal Time').castTimeMs, 420);
  assert.equal(thiefCatalog.skillsByName.get('Shadow Meld').castTimeMs, 660);
  const shadowFlareStrike = thiefCatalog.skillsByName
    .get('Shadow Flare')
    .effects.find((effect) => effect.type === 'strike');
  const shadowSwapStrike = thiefCatalog.skillsByName
    .get('Shadow Swap')
    .effects.find((effect) => effect.type === 'strike');

  assert.deepEqual(
    [shadowFlareStrike.ticks[0].atMs, shadowFlareStrike.timingAnchor, shadowFlareStrike.timingScale],
    [480, 'castStart', 'cast']
  );
  assert.deepEqual(
    [shadowSwapStrike.ticks[0].atMs, shadowSwapStrike.timingAnchor, shadowSwapStrike.timingScale],
    [0, 'castEnd', 'fixed']
  );

  const threeRoundBurst = thiefCatalog.skillsByName.get('Three Round Burst');

  assert.deepEqual(
    threeRoundBurst.effects
      .filter((effect) => effect.type === 'strike')
      .map((effect) => [effect.ticks.reduce((total, tick) => total + tick.coefficient, 0), effect.ticks.length]),
    [[2.25, 3]]
  );

  const maliciousSneak = simulate('Deadeye', ["Deadeye's Mark", 'Unload', 'Steal Time', 'Malicious Sneak Attack'], {
    ...fullCrit,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol',
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT]
  });

  assert.equal(maliciousSneak.warnings.length, 0);
  assert.equal(
    maliciousSneak.events.find((event) => event.skillName === 'Malicious Sneak Attack' && event.condition === 'Torment')
      .duration,
    11
  );
  assert.equal(
    maliciousSneak.resolvedEvents.filter(
      (event) => event.skillName === 'Malicious Sneak Attack' && event.type === 'damage'
    ).length,
    5
  );
});

test('Kneel replaces the rifle bar until Free Action or weapon swap', () => {
  const result = simulate('Deadeye', ['Kneel', 'Three Round Burst', 'Free Action', 'Double Tap'], {
    primaryWeapon: 'Rifle',
    secondaryWeapon: ''
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.kneeling, false);
  assert.ok(result.totalDamage > 0);
});

test('Deadeye rifle stance rejects every inactive replacement', () => {
  const rifle = {
    primaryWeapon: 'Rifle',
    secondaryWeapon: ''
  };

  for (const skill of ['Deadly Aim', 'Three Round Burst', "Spotter's Shot", 'Free Action']) {
    const result = simulate('Deadeye', [skill], rifle);

    assert.match(result.warnings[0], /kneel/i, skill);
  }

  for (const skill of ['Brutal Aim', 'Double Tap', "Skirmisher's Shot", 'Kneel']) {
    const result = simulate('Deadeye', ['Kneel', skill], rifle);

    assert.match(result.warnings[0], /kneel|rifle skill/i, skill);
  }
});

test('Specter Siphon, initiative spending, and Shadow Shroud share force', () => {
  const inactiveGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Specter',
    professionState: {
      shadowForce: 0,
      shadowShroudActive: false
    }
  });

  assert.equal(
    inactiveGroups.find((group) => group.id === 'thief-profession').className,
    'compact-resource-palette specter-f-skills'
  );
  assert.equal(inactiveGroups.find((group) => group.id === 'thief-profession').stackId, 'specter-profession');
  assert.equal(inactiveGroups.find((group) => group.id === 'thief-shadow-shroud').className, 'specter-shroud-skills');
  assert.equal(inactiveGroups.find((group) => group.id === 'thief-shadow-shroud').stackId, 'specter-profession');
  assert.deepEqual(
    inactiveGroups
      .find((group) => group.id === 'thief-shadow-shroud')
      .skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name),
    ['Haunt Shot', 'Grasping Shadows', "Dawn's Repose", 'Eternal Night', 'Mind Shock']
  );
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      {
        specialization: 'Specter',
        professionState: {
          shadowForce: 0,
          shadowShroudActive: false
        }
      },
      thiefCatalog.skillsByName.get('Enter Shadow Shroud')
    ),
    false
  );

  const result = simulate('Specter', ['Siphon', 'Enter Shadow Shroud', 'Haunt Shot', 'Exit Shadow Shroud'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol'
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.shadowShroudActive, false);
  assert.equal(result.endState.profession.storedStolenSkillId, null);
  assert.ok(result.endState.profession.shadowForce > 0);
  assert.equal(result.events.filter((event) => event.type === 'sigil_swap').length, 0);
  assert.equal(result.events.filter((event) => event.type === 'weapon_set' && event.shroudSwap).length, 2);
});

test('Specter can use its shroud autoattack while stealth is active', () => {
  const hauntShot = thiefCatalog.skillsByName.get('Haunt Shot');
  const paletteContext = {
    specialization: 'Specter',
    time: 1,
    activeWeaponSet: 1,
    build: { weapons: ['Dagger', 'Dagger'], alternateWeapons: ['', ''] },
    professionState: {
      stealthUntil: 4,
      revealedUntil: 0,
      shadowForce: 100,
      shadowShroudActive: true
    }
  };

  assert.equal(thiefProfession.ui.isPaletteSkillAvailable(paletteContext, hauntShot), true);
  const result = simulate('Specter', ['Hide in Shadows', 'Enter Shadow Shroud', 'Haunt Shot'], {
    initialShadowForce: 100
  });

  assert.deepEqual(result.warnings, []);
  assert.ok(result.events.some((event) => event.type === 'damage' && event.skillName === 'Haunt Shot'));
  assert.ok(result.endState.profession.revealedUntil > 0);
});

test('Specter automatically leaves Shadow Shroud when shadow force depletes', () => {
  const result = simulate('Specter', ['Enter Shadow Shroud', { type: 'wait', durationMs: 1000 }], {
    initialShadowForce: 1
  });

  assert.equal(result.endState.profession.shadowShroudActive, false);
  assert.equal(result.endState.profession.shadowForce, 0);
  assert.equal(result.events.filter((event) => event.type === 'weapon_set' && event.shroudSwap).length, 2);
});

test('Specter shadow force is 69% of health and drains 2% per second', () => {
  const capacity = simulate('Specter', [], {
    stats: { vitality: 1000 }
  }).endState.profession;
  const drained = simulate(
    'Specter',
    ['Enter Shadow Shroud', { type: 'wait', durationMs: 1000 }, 'Exit Shadow Shroud'],
    {
      initialShadowForce: 100,
      stats: { vitality: 1000 }
    }
  ).endState.profession;

  assert.equal(capacity.maximumHealth, 11645);
  assert.equal(capacity.shadowForcePoolCapacity, 11645 * 0.69);
  assert.equal(drained.shadowForce, 98);
});

test('Dagger uses the supplied Quickness timings and total multi-hit coefficients', () => {
  const expectedQuicknessTimes = new Map([
    [ID.DOUBLE_STRIKE, 360],
    [ID.WILD_STRIKE, 400],
    [ID.LOTUS_STRIKE, 440],
    [ID.HEARTSEEKER, 600],
    [ID.DEATH_BLOSSOM, 1040],
    [ID.DANCING_DAGGER, 500],
    [ID.CLOAK_AND_DAGGER, 600],
    [ID.MALICIOUS_BACKSTAB, 440]
  ]);

  for (const [skillId, quicknessTime] of expectedQuicknessTimes) {
    const skill = thiefCatalog.skillsById.get(skillId);

    assert.equal(skill.quicknessCastTimeMs, quicknessTime, skill.name);
    assert.equal(skill.castTimeMs, quicknessTime * 1.5, skill.name);
  }

  const expectedPackets = [
    ['Double Strike', 2, 0.8],
    ['Twisting Fangs', 2, 0.63],
    ['Death Blossom', 3, 0.63]
  ];

  for (const [name, hits, totalCoefficient] of expectedPackets) {
    const strike = thiefCatalog.skillsByName.get(name).effects.find((effect) => effect.type === 'strike');

    assert.equal(strike.ticks.length, hits, name);
    assert.equal(
      strike.ticks.reduce((sum, tick) => sum + tick.coefficient, 0),
      totalCoefficient,
      name
    );
  }

  const heartseeker = thiefCatalog.skillsByName.get('Heartseeker');
  const heartseekerStrike = heartseeker.effects.find((effect) => effect.type === 'strike');

  assert.equal(heartseekerStrike.ticks[0].coefficient, 1);
  assert.deepEqual(heartseekerStrike.coefficientModifiers, [
    { kind: 'target-health-below', threshold: 0.25, multiplier: 2.22 },
    { kind: 'target-health-below', threshold: 0.5, multiplier: 1.6 }
  ]);

  const deathBlossom = thiefCatalog.skillsByName.get('Death Blossom');

  assert.equal(deathBlossom.comboFinishers[0].ownerId, 'thief');
  assert.equal(deathBlossom.comboFinishers[0].finisherType, 'Whirl');
  const backstab = thiefCatalog.skillsByName.get('Backstab');
  const malicious = thiefCatalog.skillsByName.get('Malicious Backstab');

  assert.equal(backstab.effects[0].ticks[0].coefficient, 1.5);
  assert.equal(malicious.effects[0].ticks[0].coefficient, 1.5);
  assert.equal(backstab.cooldown, 1);
  assert.equal(malicious.cooldown, 1);
});

test('Dagger runtime applies endurance, shadowstep, and per-packet mechanics', () => {
  const chain = simulate('Core', ['Dodge', 'Double Strike', 'Wild Strike', 'Lotus Strike'], {
    boons: { quickness: true }
  });

  assert.deepEqual(
    chain.steps.slice(1).map((step) => step.fullCastMs),
    [360, 400, 440]
  );
  const thiefStates = chain.events.filter((event) => event.type === 'thief.state');
  const wildStrikeStateIndex = thiefStates.findIndex((event) => event.reason === 'Wild Strike');
  const beforeWildStrike = thiefStates
    .slice(0, wildStrikeStateIndex)
    .filter((event) => event.at <= chain.steps[2].start / 1000 + 1e-9)
    .at(-1);

  assert.ok(Math.abs(thiefStates[wildStrikeStateIndex].state.endurance - beforeWildStrike.state.endurance - 10) < 1e-9);
  // Wild Strike's completion grant must not discard regeneration accrued during its cast.
  assert.equal(chain.endState.profession.endurance, 70);
  const doubleStrikeHits = chain.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Double Strike'
  );

  assert.deepEqual(
    doubleStrikeHits.map((event) => event.coefficient),
    [0.4, 0.4]
  );

  const shadowShot = simulate('Core', ['Shadow Shot'], {
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Pistol',
    relic: 'Peitha'
  });

  assert.ok(shadowShot.events.some((event) => event.type === 'peitha' && event.skillName === 'Shadow Shot'));
  assert.equal(
    shadowShot.events.find((event) => event.type === 'blind' && event.skillName === 'Shadow Shot').duration,
    5
  );
});

test('Wild Strike commits its strike and bleeding before its remaining animation is interrupted', () => {
  const wildEffects = (interruptMs) =>
    simulate('Core', ['Double Strike', { name: 'Wild Strike', interruptMs }], {
      boons: { quickness: true }
    }).events.filter(
      (event) => event.skillName === 'Wild Strike' && (event.type === 'damage' || event.type === 'condition')
    );

  assert.deepEqual(wildEffects(159), []);
  assert.deepEqual(
    wildEffects(160).map((event) => [event.type, Math.round(event.at * 1000)]),
    [
      ['damage', 520],
      ['condition', 520]
    ]
  );
  assert.equal(wildEffects(240).length, 2);
});

test('Lotus Strike commits its strike and poison before a later animation interrupt', () => {
  const lotusEffects = (interruptMs) =>
    simulate('Core', ['Double Strike', 'Wild Strike', { name: 'Lotus Strike', interruptMs }], {
      boons: { quickness: true }
    }).events.filter(
      (event) => event.skillName === 'Lotus Strike' && (event.type === 'damage' || event.type === 'condition')
    );

  assert.deepEqual(lotusEffects(279), []);
  assert.deepEqual(
    lotusEffects(280).map((event) => [event.type, Math.round(event.at * 1000)]),
    [
      ['damage', 1040],
      ['condition', 1040]
    ]
  );
  assert.equal(lotusEffects(319).length, 2);
  assert.equal(lotusEffects(361).length, 2);
});

test('Malicious stealth attacks use their supplied coefficients and malice scaling', () => {
  const front = simulate('Core', ['Cloak and Dagger', 'Backstab'], {
    target: { defiant: false }
  });
  const behind = simulate('Core', ['Cloak and Dagger', 'Backstab'], {
    target: { defiant: true }
  });
  const skillDamage = (result, name) => result.breakdown.find((entry) => entry.sourceSkill === name)?.damage || 0;

  assert.ok(Math.abs(skillDamage(behind, 'Backstab') / skillDamage(front, 'Backstab') - 2) < 1e-9);

  const unmarked = simulate('Deadeye', ['Cloak and Dagger', 'Malicious Backstab'], { stats: { precision: 5000 } });
  const marked = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Cloak and Dagger', 'Malicious Backstab'], {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    stats: { precision: 5000 }
  });
  const maliciousRatio = skillDamage(marked, 'Malicious Backstab') / skillDamage(unmarked, 'Malicious Backstab');

  assert.ok(Math.abs(maliciousRatio - 1.5) < 1e-9, maliciousRatio);
  assert.equal(marked.endState.profession.malice, 0);

  const deathsJudgment = thiefCatalog.skillsByName.get("Malicious Death's Judgment");

  assert.deepEqual(
    deathsJudgment.effects
      .filter((effect) => effect.type === 'strike')
      .map((effect) => [effect.ticks.reduce((total, tick) => total + tick.coefficient, 0), effect.ticks.length]),
    [[2.67, 1]]
  );

  const rifleConfig = {
    primaryWeapon: 'Rifle',
    secondaryWeapon: '',
    stats: { precision: 5000 }
  };
  const unmarkedRifle = simulate(
    'Deadeye',
    ['Kneel', 'Three Round Burst', 'Shadow Meld', "Malicious Death's Judgment"],
    rifleConfig
  );
  const markedRifle = simulate(
    'Deadeye',
    ["Deadeye's Mark", 'Kneel', 'Three Round Burst', 'Shadow Meld', "Malicious Death's Judgment"],
    {
      ...rifleConfig,
      selectedTraitIds: [TRAIT.MALICIOUS_INTENT]
    }
  );
  const deathsJudgmentRatio =
    skillDamage(markedRifle, "Malicious Death's Judgment") / skillDamage(unmarkedRifle, "Malicious Death's Judgment");

  assert.ok(Math.abs(deathsJudgmentRatio - 1.5) < 1e-9, deathsJudgmentRatio);
  assert.equal(markedRifle.endState.profession.malice, 0);
});

test('Revealed Training does not empower the stealth attack that reveals the thief', () => {
  const rotation = ['Cloak and Dagger', 'Backstab', 'Double Strike'];
  const config = {
    selectedSkills: [],
    stats: { power: 2000, precision: 5000 }
  };
  const baseline = simulate('Core', rotation, config);
  const trained = simulate('Core', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.REVEALED_TRAINING]
  });
  const damage = (result, name) => result.breakdown.find((entry) => entry.sourceSkill === name)?.damage || 0;

  assert.ok(Math.abs(damage(trained, 'Backstab') / damage(baseline, 'Backstab') - 1.04) < 1e-9);
  assert.ok(Math.abs(damage(trained, 'Double Strike') / damage(baseline, 'Double Strike') - 1.1) < 1e-9);
});

test('Specter uses the supplied measured Quickness cast times', () => {
  const expected = new Map([
    [ID.SIPHON, 520],
    [ID.HAUNT_SHOT, 640],
    [ID.GRASPING_SHADOWS, 240],
    [ID.DAWNS_REPOSE, 520],
    [ID.ETERNAL_NIGHT, 740],
    [ID.MIND_SHOCK, 360],
    [ID.SHADOW_BOLT, 520],
    [ID.DOUBLE_BOLT, 640],
    [ID.TRIPLE_BOLT, 1080],
    [ID.SHADOWSQUALL, 1960],
    [ID.SHADOW_SAP, 600],
    [ID.TWILIGHT_COMBO, 760],
    [ID.MEASURED_SHOT, 560],
    [ID.ENDLESS_NIGHT, 1920],
    [ID.WELL_OF_BOUNTY, 400],
    [ID.WELL_OF_SORROW, 600],
    [ID.WELL_OF_TEARS, 600]
  ]);

  for (const [skillId, duration] of expected) {
    const skill = thiefCatalog.skillsById.get(skillId);

    assert.equal(skill.quicknessCastTimeMs, duration, skill.name);
    assert.equal(skill.castTimeMs, duration * 1.5, skill.name);
  }

  const quickSiphon = simulate('Specter', ['Siphon'], {
    boons: { quickness: true }
  });

  assert.equal(quickSiphon.steps[0].fullCastMs, 520);
});

test('Specter scepter and shroud packets apply their conditions per hit', () => {
  const expectedPackets = [
    ['Double Bolt', 2, 0.375, 'Torment'],
    ['Triple Bolt', 3, 0.45, 'Torment'],
    ['Triple Threat', 3, 0.45, 'Torment'],
    ['Shadowsquall', 8, 0.2, 'Poisoned'],
    ['Endless Night', 7, 0.33, 'Torment']
  ];

  for (const [name, count, coefficient, condition] of expectedPackets) {
    const skill = thiefCatalog.skillsByName.get(name);
    const strikes = skill.effects.filter((effect) => effect.type === 'strike');
    const applications = skill.effects.find(
      (effect) => effect.type === 'condition' && effect.ticks?.some((tick) => tick.condition === condition)
    );
    const hits = strikes.reduce((sum, strike) => sum + strike.ticks.length, 0);
    const totalCoefficient = strikes.reduce(
      (sum, strike) => sum + strike.ticks.reduce((tickSum, tick) => tickSum + tick.coefficient, 0),
      0
    );

    assert.equal(hits, count, name);
    assert.ok(Math.abs(totalCoefficient / count - coefficient) < 1e-12, name);
    assert.equal(applications.ticks.length, count, name);
    assert.ok(
      applications.ticks.every((tick) => tick.condition === condition),
      name
    );
  }

  const twilight = simulate(
    'Specter',
    ['Twilight Combo'],
    {
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Dagger',
      boons: { quickness: true }
    },
    observationTail(1000)
  );

  assert.equal(twilight.steps[0].fullCastMs, 760);
  assert.deepEqual(
    twilight.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Twilight Combo')
      .map((event) => [event.at, event.name]),
    [
      [0.64, 'Initial Attack'],
      [0.8, 'Secondary Attack']
    ]
  );
  assert.deepEqual(
    twilight.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Twilight Combo')
      .map((event) => [event.at, event.condition, event.stacks]),
    [
      [0.64, 'Chilled', 1],
      [0.64, 'Poisoned', 1],
      [0.8, 'Torment', 3]
    ]
  );

  const deadlyAmbition = simulate('Specter', ['Twilight Combo'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.DEADLY_AMBITION],
    boons: { quickness: true }
  });
  const deadlyAmbitionPoisons = deadlyAmbition.events.filter(
    (event) =>
      event.type === 'condition' && event.sourceId === TRAIT.DEADLY_AMBITION && event.skillName === 'Twilight Combo'
  );

  assert.ok(thiefCatalog.skillsByName.get('Twilight Combo').categories.includes('DualWield'));
  assert.equal(deadlyAmbitionPoisons.length, 1);
  assert.equal(deadlyAmbitionPoisons[0].condition, 'Poisoned');
  assert.equal(deadlyAmbitionPoisons[0].stacks, 1);

  const eternal = simulate('Specter', ['Enter Shadow Shroud', 'Eternal Night'], {
    initialShadowForce: 100,
    boons: { quickness: true }
  });
  const eternalHits = eternal.events.filter((event) => event.type === 'damage' && event.skillName === 'Eternal Night');

  assert.deepEqual(
    eternalHits.map((event) => Number(event.at.toFixed(2))),
    [0.36, 0.68]
  );
  assert.ok(eternalHits.every((event) => event.coefficient === 1.75));
  const eternalConditions = eternal.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Eternal Night'
  );

  assert.deepEqual(
    eternalConditions.map((event) => [event.at, event.condition, event.stacks]),
    [
      [0.36, 'Chilled', 1],
      [0.36, 'Poisoned', 2],
      [0.68, 'Weakness', 1],
      [0.68, 'Poisoned', 2]
    ]
  );

  const mindShock = simulate(
    'Specter',
    ['Enter Shadow Shroud', 'Mind Shock'],
    {
      initialShadowForce: 100,
      boons: { quickness: true }
    },
    observationTail(4000)
  );

  assert.equal(mindShock.steps[1].fullCastMs, 360);
  assert.equal(mindShock.events.find((event) => event.type === 'buff' && event.kind === 'stability').at, 0.36);
  assert.equal(mindShock.events.find((event) => event.type === 'damage' && event.skillName === 'Mind Shock').at, 3.36);
  const stun = mindShock.events.find((event) => event.type === 'control' && event.skillName === 'Mind Shock');

  assert.equal(stun.at, 3.36);
  assert.equal(stun.controlKind, 'stun');
});

test('Specter packet offsets align scepter and shroud impacts', () => {
  const packetOffsets = (result, skillName) => {
    const step = result.steps.find((entry) => entry.skill === skillName);

    return result.events
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .map((event) => Number((event.at - step.start / 1000).toFixed(3)));
  };

  const bolts = simulate('Specter', ['Shadow Bolt', 'Double Bolt', 'Triple Bolt'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger',
    boons: { quickness: true }
  });

  assert.deepEqual(packetOffsets(bolts, 'Shadow Bolt'), [0.52]);
  assert.deepEqual(packetOffsets(bolts, 'Double Bolt'), [0.32, 0.6]);
  assert.deepEqual(packetOffsets(bolts, 'Triple Bolt'), [0.32, 0.64, 1.04]);

  const shroud = simulate('Specter', ['Enter Shadow Shroud', 'Grasping Shadows', 'Eternal Night', 'Haunt Shot'], {
    initialShadowForce: 100,
    boons: { quickness: true }
  });

  assert.deepEqual(packetOffsets(shroud, 'Grasping Shadows'), [1.24]);
  assert.deepEqual(packetOffsets(shroud, 'Eternal Night'), [0.36, 0.68]);
  assert.deepEqual(packetOffsets(shroud, 'Haunt Shot'), [0.56]);
});

test('Thief utility skills materialize their declarative pulse timelines', () => {
  const pulseOffsets = (result, skillName, type, condition, anchor) => {
    const step = result.steps.find((entry) => entry.skill === skillName);

    return result.events
      .filter(
        (event) =>
          event.type === type && event.skillName === skillName && (condition == null || event.condition === condition)
      )
      .map((event) => Number((event.at - step[anchor] / 1000).toFixed(3)));
  };

  const caltrops = simulate('Core', ['Caltrops', { name: '__wait', waitMs: 9000 }], {
    selectedSkills: ['Caltrops']
  });

  assert.deepEqual(pulseOffsets(caltrops, 'Caltrops', 'condition', 'Bleeding', 'end'), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(pulseOffsets(caltrops, 'Caltrops', 'condition', 'Crippled', 'end'), [0, 1, 2, 3, 4]);

  const needles = simulate(
    'Specter',
    [
      'Prepare Thousand Needles',
      { name: '__wait', waitMs: 3000 },
      'Thousand Needles',
      { name: '__wait', waitMs: 4500 }
    ],
    {
      selectedSkills: ['Prepare Thousand Needles'],
      boons: { quickness: true }
    }
  );

  assert.deepEqual(pulseOffsets(needles, 'Thousand Needles', 'damage', null, 'start'), [0.28, 1.28, 2.28, 3.28, 4.28]);

  const pitfall = simulate('Core', ['Prepare Pitfall', 'Pitfall', { name: '__wait', waitMs: 3000 }], {
    selectedSkills: ['Prepare Pitfall']
  });
  const pitfallDamage = pitfall.events.filter((event) => event.type === 'damage' && event.skillName === 'Pitfall');
  const pitfallControl = pitfall.events.find((event) => event.type === 'control' && event.skillName === 'Pitfall');

  assert.equal(pitfall.steps.find((step) => step.skill === 'Pitfall').start, 3500);
  assert.deepEqual(
    pitfallDamage.map((event) => [Number((event.at - 3.5).toFixed(3)), event.coefficient]),
    [
      [0, 1.25],
      [1, 0.5],
      [2, 0.5],
      [3, 0.5]
    ]
  );
  assert.deepEqual(pulseOffsets(pitfall, 'Pitfall', 'condition', 'Vulnerability', 'start'), [1, 2, 3]);
  assert.ok(
    pitfall.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Pitfall')
      .every((event) => event.stacks === 2 && event.duration === 6)
  );
  assert.equal(pitfallControl.controlKind, 'knockdown');
  assert.equal(pitfallControl.duration, 3);
});

test('Pitfall placement recharge remains independent from its three-second trigger rearm', () => {
  const prepareTimes = (result) =>
    result.events
      .filter((event) => event.type === 'action' && event.skillName === 'Prepare Pitfall')
      .map((event) => event.at);
  const early = simulate('Core', ['Prepare Pitfall', 'Pitfall', 'Prepare Pitfall'], {
    selectedSkills: ['Prepare Pitfall']
  });
  const held = simulate('Core', ['Prepare Pitfall', { name: '__wait', waitMs: 24500 }, 'Pitfall', 'Prepare Pitfall'], {
    selectedSkills: ['Prepare Pitfall']
  });

  assert.deepEqual(early.warnings, []);
  assert.deepEqual(held.warnings, []);
  assert.deepEqual(prepareTimes(early), [0, 25]);
  assert.deepEqual(prepareTimes(held), [0, 28]);
});

test('Specter wells preserve one-second pulse intervals and ordered effects', () => {
  const sorrow = simulate('Specter', ['Well of Sorrow', { type: 'wait', durationMs: 5000 }], {
    selectedSkills: ['Well of Sorrow'],
    boons: { quickness: true }
  });

  assert.equal(sorrow.steps[0].fullCastMs, 600);
  assert.deepEqual(
    sorrow.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Well of Sorrow')
      .map((event) => [event.at, Number(event.coefficient.toFixed(3))]),
    [
      [1, 0.222],
      [2, 0.222],
      [3, 0.222],
      [4, 0.222],
      [5, 0.222]
    ]
  );
  assert.deepEqual(
    sorrow.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Well of Sorrow')
      .map((event) => [event.at, event.condition, event.stacks]),
    [
      [1, 'Torment', 2],
      [2, 'Bleeding', 3],
      [3, 'Torment', 2],
      [4, 'Poisoned', 3],
      [5, 'Torment', 2]
    ]
  );

  const tears = simulate('Specter', ['Well of Tears', { type: 'wait', durationMs: 5000 }], {
    selectedSkills: ['Well of Tears'],
    boons: { quickness: true }
  });

  assert.deepEqual(
    tears.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Well of Tears')
      .map((event) => [event.at, event.coefficient]),
    [
      [0.6, 1],
      [1.6, 1],
      [2.6, 1],
      [3.6, 1],
      [4.6, 1]
    ]
  );

  const bounty = simulate('Specter', ['Well of Bounty', { type: 'wait', durationMs: 5000 }], {
    selectedSkills: ['Well of Bounty'],
    boons: { quickness: true }
  });

  assert.deepEqual(
    bounty.events
      .filter((event) => event.type === 'buff' && event.skillName === 'Well of Bounty')
      .map((event) => [event.at, event.kind, event.stacks, event.duration]),
    [
      [0.4, 'stability', 2, 5],
      [1.4, 'might', 8, 15],
      [2.4, 'fury', 1, 5],
      [3.4, 'vigor', 1, 8],
      [4.4, 'regeneration', 1, 12]
    ]
  );
});

test('Specter shadow-force and recharge traits use supplied values', () => {
  const baseline = simulate('Specter', ['Siphon']);
  const amplified = simulate('Specter', ['Siphon'], {
    selectedTraitIds: [TRAIT.AMPLIFIED_SIPHONING]
  });

  assert.equal(baseline.endState.profession.shadowForce, 25);
  assert.equal(amplified.endState.profession.shadowForce, 27.5);

  const initiative = simulate('Specter', ['Shadow Sap'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger'
  });

  assert.equal(initiative.endState.profession.shadowForce, 4);

  const reduced = simulate('Specter', ['Siphon'], {
    selectedTraitIds: [TRAIT.LEAD_ATTACKS, TRAIT.SLEIGHT_OF_HAND]
  });

  assert.equal(reduced.endState.cooldowns.Siphon.remaining, 11700);

  const larcenous = simulate(
    'Specter',
    ['Twilight Combo'],
    {
      initialShadowForce: 0,
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.LARCENOUS_TORMENT],
      boons: { quickness: true }
    },
    observationTail(1000)
  );

  assert.equal(larcenous.profession.shadowForce, 5.5);
  assert.equal(
    larcenous.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Larcenous Torment')
      .length,
    3
  );
});

test('Specter attribute, ally, and shadowstep traits resolve explicitly', () => {
  const attributeConfig = {
    specialization: 'Specter',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.SECOND_OPINION, TRAIT.STRENGTH_OF_SHADOWS],
    stats: {
      conditionDamage: 1000,
      healingPower: 100,
      vitality: 1000,
      expertise: 0
    }
  };
  const query = createGw2CombatQuery({
    profession: resolveProfessionRuntime(thiefProfession, attributeConfig),
    config: attributeConfig
  });
  const stats = query.statsAt(0);

  assert.equal(stats.conditionDamage, 1180);
  assert.equal(stats.healingPower, 170);
  assert.equal(stats.expertise, 130);

  const allies = simulate('Specter', ['Enter Shadow Shroud', "Dawn's Repose", { name: '__wait', waitMs: 1000 }], {
    initialShadowForce: 100,
    selectedTraitIds: [TRAIT.SHADESTEP],
    allies: { count: 2, strikesPerSecond: 1 },
    boons: { quickness: true }
  });
  const protection = allies.events.find(
    (event) => event.type === 'buff' && event.skillName === "Dawn's Repose" && event.kind === 'protection'
  );

  assert.equal(protection.duration, 5);
  assert.equal(protection.resolvedAudience.recipientCount, 3);
  const barrier = allies.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Enter Shadow Shroud' && event.kind === 'barrier'
  );

  assert.equal(barrier.resolvedAudience.includesSelf, false);
  assert.equal(barrier.resolvedAudience.recipientCount, 1);
  const dawnBarrier = allies.events.find(
    (event) => event.type === 'buff' && event.skillName === "Dawn's Repose" && event.kind === 'barrier'
  );

  assert.equal(dawnBarrier.resolvedAudience.includesSelf, false);
  assert.equal(dawnBarrier.resolvedAudience.recipientCount, 2);
  assert.deepEqual(
    allies.events
      .filter((event) => event.type === 'buff' && event.kind === 'rot-wallow-venom')
      .map((event) => [event.at, event.duration, event.resolvedAudience.recipientCount]),
    [
      [0, 10, 1],
      [0.52, 10, 1]
    ]
  );
  assert.equal(
    allies.events.filter(
      (event) => event.type === 'condition' && event.skillName === 'Rot Wallow Venom' && event.condition === 'Torment'
    ).length,
    2
  );

  const peitha = simulate('Specter', ['Well of Tears'], {
    selectedSkills: ['Well of Tears'],
    relic: 'Peitha',
    boons: { quickness: true }
  });

  assert.ok(peitha.events.some((event) => event.type === 'peitha' && event.skillName === 'Well of Tears'));
});

test('Condi spear Antiquary skills use EVTC-measured Quickness cast times', () => {
  const expected = new Map([
    [ID.ENTANGLING_ASP, 520],
    [ID.SHATTERING_ASSAULT, 640],
    [ID.DISTRACTING_THROW, 360],
    [ID.ASHEN_ASSAULT, 1200],
    [ID.MANTIS_STING, 400],
    [ID.FALLING_SPIDER, 600],
    [ID.PREPARE_THOUSAND_NEEDLES, 600],
    [ID.CALTROPS, 920],
    [ID.MISTBURN_MORTAR, 600],
    [ID.SKRITT_SWIPE, 200]
  ]);

  for (const [skillId, duration] of expected) {
    const skill = thiefCatalog.skillsById.get(skillId);

    assert.equal(skill.quicknessCastTimeMs, duration, skill.name);
    assert.equal(skill.castTimeMs, duration * 1.5, skill.name);
  }
});

test('Spear slots 2 and 3 expose and enforce their linked chain', () => {
  const chainSkills = [
    'Mantis Sting',
    'Entangling Asp',
    'Falling Spider',
    'Unsuspecting Strike',
    'Vampiric Slash',
    'Shattering Assault'
  ].map((name) => thiefCatalog.skillsByName.get(name));
  const visibleAtStage = (stage) =>
    chainSkills
      .filter((skill) =>
        thiefWeaponSkillMatchesSet(skill, ['Spear', ''], {
          catalog: thiefCatalog,
          professionState: { spearChainStage: stage }
        })
      )
      .map((skill) => skill.name);
  const paletteAtStage = (stage) =>
    weaponPaletteRows(
      {
        build: {
          ...createThiefBuildDefaults(),
          weapons: ['Spear', ''],
          alternateWeapons: ['Spear', '']
        },
        adapter: thiefAppAdapter,
        profession: thiefProfession,
        skills: thiefCatalog.skills,
        skillById: thiefCatalog.skillsById,
        skillByName: thiefCatalog.skillsByName,
        weaponData: thiefAppAdapter.weaponData,
        results: {
          endState: {
            activeWeaponSet: 1,
            profession: { spearChainStage: stage }
          }
        }
      },
      1
    )[0]
      .skills.filter((skill) => [2, 3].includes(Number(String(skill.slot).split('_').at(-1))))
      .map((skill) => skill.name);

  assert.deepEqual(visibleAtStage(0), ['Mantis Sting', 'Unsuspecting Strike']);
  assert.deepEqual(visibleAtStage(1), ['Entangling Asp', 'Vampiric Slash']);
  assert.deepEqual(visibleAtStage(2), ['Falling Spider', 'Shattering Assault']);
  assert.deepEqual(
    chainSkills
      .filter((skill) =>
        thiefWeaponSkillMatchesSet(skill, ['Spear', ''], {
          catalog: thiefCatalog,
          professionState: { spearChainStage: 0 },
          weaponBarPreview: true
        })
      )
      .map((skill) => [skill.name, skill.weaponBarChainStep]),
    [
      ['Mantis Sting', 1],
      ['Entangling Asp', 2],
      ['Falling Spider', 3],
      ['Unsuspecting Strike', 1],
      ['Vampiric Slash', 2],
      ['Shattering Assault', 3]
    ]
  );
  assert.deepEqual(paletteAtStage(0), ['Mantis Sting', 'Unsuspecting Strike']);
  assert.deepEqual(paletteAtStage(1), ['Entangling Asp', 'Vampiric Slash']);
  assert.deepEqual(paletteAtStage(2), ['Falling Spider', 'Shattering Assault']);
  assert.equal(
    thiefProfession.ui.paletteSkillAvailability(
      { professionState: { spearChainStage: 0 } },
      thiefCatalog.skillsByName.get('Entangling Asp')
    ).available,
    false
  );
  assert.equal(
    thiefProfession.ui.paletteSkillAvailability(
      { professionState: { spearChainStage: 1 } },
      thiefCatalog.skillsByName.get('Entangling Asp')
    ).available,
    true
  );

  const spearConfig = {
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  };
  const afterAutoattack = simulate('Core', ['Barbed Spear'], spearConfig);

  assert.equal(afterAutoattack.endState.profession.spearChainStage, 0);
  assert.equal(afterAutoattack.endState.profession.spearPreviousSkillId, null);

  const afterLeadAndAutoattack = simulate('Core', ['Mantis Sting', 'Barbed Spear'], spearConfig);

  assert.equal(afterLeadAndAutoattack.endState.profession.spearChainStage, 1);
  assert.equal(afterLeadAndAutoattack.endState.profession.spearPreviousSkillId, ID.MANTIS_STING);
  const stealthFinisher = simulate(
    'Core',
    ['Unsuspecting Strike', 'Vampiric Slash', 'Shattering Assault', 'Ashen Assault'],
    spearConfig
  );

  assert.deepEqual(stealthFinisher.warnings, []);
  assert.ok(stealthFinisher.steps.some((step) => step.skill === 'Ashen Assault'));
});

test('Spider Venom grants six independent charges to the player and allies', () => {
  const result = simulate(
    'Core',
    ['Spider Venom', 'Heartseeker'],
    {
      selectedSkills: ['Hide in Shadows', 'Spider Venom'],
      allies: { count: 4, strikesPerSecond: 1 }
    },
    observationTail(6000)
  );
  const partyBuff = result.events.find((event) => event.type === 'buff' && event.kind === 'spider-venom');

  assert.equal(partyBuff.stacks, 6);
  assert.equal(partyBuff.duration, 24);
  assert.equal(partyBuff.resolvedAudience.recipientCount, 5);
  assert.equal(partyBuff.resolvedAudience.alliedPlayerCount, 4);
  assert.deepEqual(partyBuff.resolvedAudience.companionIds, []);
  assert.equal(partyBuff.resolvedAudience.includesSummons, false);

  const allyPoisons = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.SPIDER_VENOM && event.triggeredByAlly
  );

  assert.equal(allyPoisons.length, 24);
  assert.deepEqual([...new Set(allyPoisons.map((event) => event.triggeredByAlly))], [1, 2, 3, 4]);
  assert.ok(allyPoisons.every((event) => event.stacks === 1 && Math.abs(event.naturalExpiresAt - event.at - 3) < 1e-9));

  const personalPoisons = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.SPIDER_VENOM && !event.triggeredByAlly
  );

  assert.equal(personalPoisons.length, 1);
});

test('Skale and Devourer Venom grant party charges that proc together on attacks', () => {
  const result = simulate(
    'Core',
    ['Skale Venom', 'Devourer Venom', 'Heartseeker'],
    {
      selectedSkills: ['Skale Venom', 'Devourer Venom'],
      allies: { count: 4, strikesPerSecond: 10 },
      target: { conditions: {} }
    },
    observationTail(500)
  );
  const buff = (kind) => result.events.find((event) => event.type === 'buff' && event.kind === kind);
  const venomConditions = (skillId, allied) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === skillId && Boolean(event.triggeredByAlly) === allied
    );
  const personalSkale = venomConditions(ID.SKALE_VENOM, false);
  const personalDevourer = venomConditions(ID.DEVOURER_VENOM, false);

  assert.deepEqual(
    [buff('skale-venom'), buff('devourer-venom')].map((event) => [
      event.stacks,
      event.duration,
      event.resolvedAudience.recipientCount
    ]),
    [
      [4, 24, 5],
      [2, 24, 5]
    ]
  );
  assert.deepEqual(
    personalSkale.map((event) => [event.condition, event.stacks, event.naturalExpiresAt - event.at]),
    [
      ['Vulnerability', 1, 10],
      ['Torment', 1, 3]
    ]
  );
  assert.deepEqual(
    personalDevourer.map((event) => [
      event.condition,
      event.stacks,
      Number((event.naturalExpiresAt - event.at).toFixed(3))
    ]),
    [['Immobilized', 1, 1]]
  );
  assert.equal(venomConditions(ID.SKALE_VENOM, true).length, 32);
  assert.equal(venomConditions(ID.DEVOURER_VENOM, true).length, 8);

  const limited = simulate(
    'Core',
    ['Skale Venom', 'Devourer Venom', 'Double Strike', 'Wild Strike', 'Lotus Strike', 'Double Strike'],
    {
      selectedSkills: ['Skale Venom', 'Devourer Venom'],
      target: { conditions: {} }
    }
  );
  const personalProcs = (skillId) =>
    limited.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === skillId && !event.triggeredByAlly
    );

  assert.deepEqual(limited.warnings, []);
  assert.equal(personalProcs(ID.SKALE_VENOM).length, 8);
  assert.equal(personalProcs(ID.DEVOURER_VENOM).length, 2);
});

test('Antiquary artifacts, per-cast Double Edge, and summons are deterministic', () => {
  assert.ok(
    thiefCatalog.skills
      .filter((skill) => skill.handlerId === 'thief.double-edge')
      .every((skill) => skill.usableWhileRecharging === true)
  );
  const artifact = simulate('Antiquary', ['Skritt Swipe', 'Forged Surfer Dash', { type: 'wait', durationMs: 1200 }], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger'
  });

  assert.equal(artifact.warnings.length, 0);
  assert.equal(artifact.endState.profession.artifactUsesRemaining, 0);
  assert.ok(artifact.totalDamage > 0);

  const reshuffled = simulate('Antiquary', ['Skritt Swipe', 'Reshuffle'], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger'
  });

  assert.deepEqual(
    reshuffled.endState.profession.artifactSlots.map((slot) => slot.skillId),
    [...THIEF_ARTIFACT_IDS.OFFENSIVE, ...THIEF_ARTIFACT_IDS.DEFENSIVE]
  );

  const doubleEdge = simulate(
    'Antiquary',
    [
      'Stone Summit Cannon',
      {
        name: 'Stone Summit Cannon',
        doubleEdgeOutcome: 'backfire'
      }
    ],
    {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Dagger'
    }
  );

  assert.equal(doubleEdge.warnings.length, 0);
  assert.ok(doubleEdge.endState.profession.backfireState[76725]);

  const doubleEdgeSuccess = simulate(
    'Antiquary',
    [
      'Stone Summit Cannon',
      {
        name: 'Stone Summit Cannon',
        doubleEdgeOutcome: 'success'
      }
    ],
    {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Dagger'
    }
  );

  assert.equal(doubleEdgeSuccess.warnings.length, 0);
  assert.equal(doubleEdgeSuccess.endState.profession.backfireState[76725], undefined);

  const guild = simulate('Antiquary', ['Thieves Guild', { type: 'combat-start' }, { type: 'wait', durationMs: 2100 }], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger'
  });

  assert.ok(
    guild.resolvedEvents.some(
      (event) => event.actorType === 'summon' && event.skillName === 'Thieves Guild — Sword/Dagger Skritt'
    )
  );
});

test('Thieves Guild waits for the player to enter combat before attacking', () => {
  const idle = simulate('Core', ['Thieves Guild', { type: 'wait', durationMs: 4000 }]);

  assert.equal(idle.combatStartTime, null);
  assert.equal(
    idle.events.some(
      (event) => event.actorType === 'summon' && ['damage', 'condition', 'control', 'blind'].includes(event.type)
    ),
    false
  );

  const delayed = simulate('Core', [
    'Thieves Guild',
    { type: 'wait', durationMs: 2000 },
    { type: 'combat-start' },
    { type: 'wait', durationMs: 2100 }
  ]);
  const summonAttacks = delayed.events.filter(
    (event) => event.actorType === 'summon' && ['damage', 'condition'].includes(event.type)
  );

  assert.ok(summonAttacks.length > 0);
  assert.ok(summonAttacks.every((event) => event.at >= delayed.combatStartTime));
});

test('Thieves Guild summons three specialization-specific thieves for 24 seconds', () => {
  assert.equal(thiefCatalog.skillsByName.get('Thieves Guild').cooldown, 120);
  assert.equal(thiefCatalog.skillsByName.get('Thieves Guild').summonAttack.duration, 24);
  const expectedThirdSummon = new Map([
    ['Core', 'Sword Thief'],
    ['Daredevil', 'Staff Daredevil'],
    ['Deadeye', 'Rifle Deadeye'],
    ['Specter', 'Scepter Specter'],
    ['Antiquary', 'Sword/Dagger Skritt']
  ]);

  for (const [specialization, thirdSummon] of expectedThirdSummon) {
    const result = simulate(specialization, [
      'Thieves Guild',
      { type: 'combat-start' },
      { type: 'wait', durationMs: 1800 }
    ]);

    assert.deepEqual(
      [
        ...new Set(
          result.resolvedEvents
            .filter(
              (event) =>
                event.type === 'damage' && event.actorType === 'summon' && event.sourceId === 'thief.thieves-guild'
            )
            .map((event) => event.skillName)
        )
      ].sort(),
      [
        'Thieves Guild — Male Dual-Pistol Thief',
        'Thieves Guild — Female Dual-Dagger Thief',
        `Thieves Guild — ${thirdSummon}`
      ].sort(),
      specialization
    );
  }

  const lifetime = simulate('Specter', [
    'Thieves Guild',
    { type: 'combat-start' },
    { type: 'wait', durationMs: 26000 }
  ]);
  const summonPackets = lifetime.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.actorType === 'summon' && event.sourceId === 'thief.thieves-guild'
  );

  assert.ok(summonPackets.length > 0);
  assert.equal(lifetime.endState.profession.activeThievesGuild, null);
  assert.deepEqual(
    [...new Set(summonPackets.map((event) => event.skillWeapon))].sort(),
    ['Pistol', 'Dagger', 'Scepter'].sort()
  );
  const entityRows = skillBreakdownRows(lifetime).filter((row) => row.parentSkill === 'Thieves Guild');

  assert.ok(entityRows.length > 0);
  assert.ok(entityRows.every((row) => !row.name.startsWith('Thieves Guild \u2014 ')));
  assert.ok(entityRows.some((row) => row.name === 'Thief \u2014 Unload'));
  assert.ok(entityRows.some((row) => row.name === 'Specter \u2014 Shadow Bolt'));
  const scorpionWire = entityRows.find((row) => row.name === 'Thief \u2014 Scorpion Wire');

  assert.ok(scorpionWire.strike > 0);
  assert.ok(scorpionWire.condition > 0);
  assert.ok(entityRows.every((row) => !row.name.endsWith(' \u2014 Poisoned')));
});

test('Specter Thieves Guild follows its measured scepter, well, and Triple Threat pattern', () => {
  const result = simulate('Specter', ['Thieves Guild', { type: 'combat-start' }, { type: 'wait', durationMs: 26000 }]);
  const specterStrikes = result.events.filter(
    (event) =>
      event.type === 'damage' &&
      event.actorType === 'summon' &&
      event.sourceId === 'thief.thieves-guild' &&
      event.skillName === 'Thieves Guild \u2014 Scepter Specter'
  );
  const strikesFor = (name) => specterStrikes.filter((event) => event.damageBreakdownName === `Specter \u2014 ${name}`);
  const strikeTimesFor = (name) => strikesFor(name).map((event) => Number(event.at.toFixed(3)));

  assert.deepEqual(strikeTimesFor('Well of Sorrow'), [4.358, 5.357, 6.358, 7.356, 8.355]);
  assert.deepEqual(strikeTimesFor('Triple Threat'), [20.914, 21.437, 22.037]);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'condition' && event.damageBreakdownName === 'Specter \u2014 Well of Sorrow')
      .map((event) => [Number(event.at.toFixed(3)), event.condition, event.stacks, event.duration]),
    [
      [4.358, 'Poisoned', 1, 3],
      [5.357, 'Torment', 2, 4],
      [6.358, 'Torment', 1, 4],
      [7.356, 'Torment', 1, 4],
      [8.355, 'Poisoned', 1, 3]
    ]
  );
  assert.deepEqual(
    specterStrikes.filter((event) => event.at >= 6 && event.at < 10).map((event) => event.damageBreakdownName),
    [
      'Specter \u2014 Shadow Bolt',
      'Specter \u2014 Well of Sorrow',
      'Specter \u2014 Double Bolt',
      'Specter \u2014 Double Bolt',
      'Specter \u2014 Well of Sorrow',
      'Specter \u2014 Triple Bolt',
      'Specter \u2014 Well of Sorrow',
      'Specter \u2014 Triple Bolt',
      'Specter \u2014 Triple Bolt'
    ]
  );

  const tripleThreatConditions = result.events.filter(
    (event) => event.type === 'condition' && event.damageBreakdownName === 'Specter \u2014 Triple Threat'
  );

  assert.deepEqual(
    tripleThreatConditions.map((event) => [Number(event.at.toFixed(3)), event.condition, event.stacks, event.duration]),
    [
      [20.914, 'Torment', 1, 2],
      [21.437, 'Torment', 1, 2],
      [22.037, 'Torment', 1, 2]
    ]
  );
  assert.deepEqual(strikeTimesFor('Shadow Bolt'), [2.517, 6.04, 11.107, 16.173, 23.758]);
});

test('Thieves Guild uses independent summon weapons and attack profiles', () => {
  const rotation = ['Thieves Guild', { type: 'combat-start' }, { type: 'wait', durationMs: 26000 }];
  const result = simulate('Daredevil', rotation);
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.actorType === 'summon' && event.sourceId === 'thief.thieves-guild'
  );
  const profile = (name) => strikes.filter((event) => event.skillName.includes(name));
  const entityRowNames = skillBreakdownRows(result)
    .filter((row) => row.parentSkill === 'Thieves Guild')
    .map((row) => row.name);

  assert.ok(entityRowNames.includes('Thief \u2014 Unload'));
  assert.ok(entityRowNames.includes('Daredevil \u2014 Vault'));
  const impairingDaggers = skillBreakdownRows(result).find((row) => row.name === 'Daredevil \u2014 Impairing Daggers');

  assert.ok(impairingDaggers.strike > 0);
  assert.ok(impairingDaggers.condition > 0);
  assert.ok(
    entityRowNames.every(
      (name) => !name.startsWith('Male ') && !name.startsWith('Female ') && !name.startsWith('Staff ')
    )
  );
  const summarize = (name) => {
    const events = profile(name);

    return {
      coefficient: Number(events.reduce((total, event) => total + Number(event.coefficient || 0), 0).toFixed(3)),
      hits: events.reduce((total, event) => total + Number(event.hits || 0), 0),
      weaponStrengthProfiles: [...new Set(events.map((event) => event.weaponStrengthProfileId))]
    };
  };

  assert.deepEqual(summarize('Male Dual-Pistol Thief'), {
    coefficient: 9.2,
    hits: 49,
    weaponStrengthProfiles: ['weapon.pistol']
  });
  assert.deepEqual(summarize('Female Dual-Dagger Thief'), {
    coefficient: 43.9,
    hits: 33,
    weaponStrengthProfiles: ['weapon.dagger']
  });
  assert.deepEqual(summarize('Staff Daredevil'), {
    coefficient: 10.95,
    hits: 17,
    weaponStrengthProfiles: ['weapon.staff']
  });
  assert.ok(
    strikes.every(
      (event) =>
        event.independentSummonStrike === true &&
        event.summonBasePower === 1750 &&
        event.criticalChance === 0.2 &&
        event.criticalDamage === 1.5
    )
  );

  const summonStrikeDamage = (simulation) =>
    simulation.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.actorType === 'summon' && event.sourceId === 'thief.thieves-guild'
      )
      .reduce((total, event) => total + Number(event.damage || 0), 0);
  const summonConditionDamage = (simulation) =>
    simulation.breakdown
      .filter((entry) => entry.parentSkill === 'Thieves Guild')
      .reduce((total, entry) => total + Number(entry.conditionDamage || 0), 0);
  const lowPower = simulate('Daredevil', rotation, {
    stats: { power: 1000, precision: 1000, ferocity: 0 }
  });
  const highPower = simulate('Daredevil', rotation, {
    stats: { power: 4000, precision: 3000, ferocity: 1500 }
  });

  assert.equal(summonStrikeDamage(lowPower), summonStrikeDamage(highPower));
  const withRelic = simulate('Daredevil', rotation, { relic: 'Thief' });
  const withoutRelic = simulate('Daredevil', rotation);

  assert.equal(summonStrikeDamage(withRelic), summonStrikeDamage(withoutRelic));
  assert.equal(summonConditionDamage(withRelic), summonConditionDamage(withoutRelic));
});

test('Antiquary exposes every artifact from Swipe and Scuffle', () => {
  const expectedArtifactIds = [...THIEF_ARTIFACT_IDS.OFFENSIVE, ...THIEF_ARTIFACT_IDS.DEFENSIVE];
  const config = {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger'
  };

  const swipe = simulate('Antiquary', ['Skritt Swipe'], config);

  assert.deepEqual(
    swipe.endState.profession.artifactSlots.map((slot) => slot.skillId),
    expectedArtifactIds
  );
  const paletteGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Antiquary',
    professionState: swipe.endState.profession,
    build: { assumptions: {} }
  });

  assert.deepEqual(
    paletteGroups.find((group) => group.id === 'thief-artifacts-offensive').skillIds,
    THIEF_ARTIFACT_IDS.OFFENSIVE
  );
  assert.deepEqual(
    paletteGroups.find((group) => group.id === 'thief-artifacts-defensive').skillIds,
    THIEF_ARTIFACT_IDS.DEFENSIVE
  );
  assert.deepEqual(
    paletteGroups.filter((group) => group.id.startsWith('thief-artifacts-')).map((group) => group.stackId),
    ['thief-artifacts', 'thief-artifacts']
  );
  assert.equal(paletteGroups.find((group) => group.id === 'thief-profession').skillIds.includes(ID.RESHUFFLE), false);

  const picked = simulate('Antiquary', ['Skritt Swipe', 'Mistburn Mortar'], config);

  assert.equal(picked.warnings.length, 0);
  assert.equal(picked.endState.profession.artifactUsesRemaining, 0);
  // Spent artifacts stay listed (never concealed); paletteSkillAvailability is
  // what greys them out, so a used artifact is disabled rather than removed.
  const spentContext = {
    specialization: 'Antiquary',
    professionState: picked.endState.profession,
    build: { assumptions: {} }
  };

  assert.equal(
    thiefProfession.ui
      .paletteGroups(spentContext)
      .filter((group) => group.id.startsWith('thief-artifacts-'))
      .every((group) => group.skillIds.length > 0 && !group.className.includes('pal-group-concealed')),
    true
  );
  assert.equal(
    thiefProfession.ui.paletteSkillAvailability(spentContext, {
      id: ID.MISTBURN_MORTAR,
      name: 'Mistburn Mortar',
      artifactKind: 'offensive'
    }).available,
    false
  );

  const scuffle = simulate('Antiquary', ['Skritt Scuffle', { type: 'wait', durationMs: 5200 }], config);

  assert.deepEqual(
    scuffle.endState.profession.artifactSlots.map((slot) => slot.skillId),
    expectedArtifactIds
  );
});

test('Meticulous Custodian upgrades artifact packets and effect durations', () => {
  const config = {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    deterministicChoices: { forgedSurferBombsHit: '1' }
  };
  const artifact = (name, meticulous = false) =>
    simulate('Antiquary', ['Skritt Swipe', name, { type: 'wait', durationMs: 6000 }], {
      ...config,
      selectedTraitIds: meticulous ? [TRAIT.METICULOUS_CUSTODIAN] : []
    });
  const damage = (result, match) =>
    result.breakdown.find((entry) => (typeof match === 'function' ? match(entry) : entry.name === match))?.damage || 0;
  const ratio = (name, rowName = name) => {
    const base = artifact(name);
    const meticulous = artifact(name, true);

    return damage(meticulous, rowName) / damage(base, rowName);
  };

  assert.ok(
    Math.abs(
      ratio(
        'Metal Legion Guitar',
        (entry) => entry.sourceSkill === 'Metal Legion Guitar' && entry.name.endsWith('Packet 1')
      ) - 1.5
    ) < 1e-9
  );
  assert.ok(Math.abs(ratio('Metal Legion Guitar', 'Final Smash') - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio('Mistburn Mortar') - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio('Summon Kryptis Turret') - 3.84 / 2.8) < 1e-9);
  assert.ok(Math.abs(ratio('Chak Shield') - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio('Holo-Dancer Decoy') - 1.5) < 1e-9);

  const mortar = artifact('Mistburn Mortar', true);
  const turret = artifact('Summon Kryptis Turret', true);
  const sunCrystal = artifact('Zephyrite Sun Crystal', true);
  const chakShield = artifact('Chak Shield', true);

  assert.equal(chakShield.breakdown.find((entry) => entry.name === 'Chak Shield').hits, 6);
  assert.equal(mortar.endState.profession.mistburnExpiresAt, 13.2);
  assert.equal(turret.endState.profession.kryptisDamageUntil, 10.96);
  assert.ok(sunCrystal.conditionDamage > artifact('Zephyrite Sun Crystal').conditionDamage * 1.8);
});

test('Antiquary skill bar previews wiki-categorized artifacts', () => {
  const groups = thiefProfession.ui.skillBarGroups({
    specialization: 'Antiquary'
  });

  assert.deepEqual(
    groups.map((group) => ({
      label: group.label,
      names: group.skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name)
    })),
    [
      {
        label: 'Offensive Artifacts',
        names: ['Forged Surfer Dash', 'Metal Legion Guitar', 'Mistburn Mortar', 'Summon Kryptis Turret']
      },
      {
        label: 'Defensive Artifacts',
        names: ['Chak Shield', 'Exalted Hammer', 'Holo-Dancer Decoy', 'Zephyrite Sun Crystal']
      }
    ]
  );
  const specter = thiefProfession.ui.skillBarGroups({
    specialization: 'Specter'
  });

  assert.deepEqual(
    specter.map((group) => group.label),
    ['F Keys', 'Shadow Shroud']
  );
  assert.deepEqual(
    specter[1].skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name),
    ['Haunt Shot', 'Grasping Shadows', "Dawn's Repose", 'Eternal Night', 'Mind Shock']
  );
});

test('Thief skill bar previews specialization-specific stolen skills', () => {
  const namesFor = (specialization, config = {}) =>
    thiefProfession.ui
      .skillBarGroups({ specialization, config: { specialization, ...config } })
      .flatMap((group) => group.skillIds)
      .map((id) => thiefCatalog.skillsById.get(id)?.name);

  assert.deepEqual(namesFor('Core'), ['Throw Gunk', 'Consume Plasma', 'Whirling Axe']);
  assert.deepEqual(namesFor('Daredevil'), namesFor('Core'));
  assert.deepEqual(namesFor('Deadeye'), [
    'Steal Time',
    'Steal Warmth',
    'Steal Resistance',
    'Steal Precision',
    'Steal Health',
    'Steal Strength',
    'Steal Durability',
    'Steal Defenses',
    'Steal Mobility'
  ]);
  assert.deepEqual(namesFor('Deadeye', { selectedTraitIds: [TRAIT.FIRE_FOR_EFFECT] }), ['Steal Time']);
  assert.deepEqual(
    thiefProfession.ui
      .paletteGroups({ specialization: 'Deadeye', traits: new Set([TRAIT.FIRE_FOR_EFFECT]) })
      .find((group) => group.id === 'deadeye-stolen-skills').skillIds,
    [ID.STEAL_TIME]
  );
  assert.equal(
    thiefProfession.ui
      .skillBarGroups({ specialization: 'Deadeye', config: { specialization: 'Deadeye' } })
      .find((group) => group.id === 'deadeye-stolen-skills').className,
    'deadeye-stolen-skills-grid'
  );
});

test('trait-coverage manifest covers all Thief traits', () => {
  assert.equal(THIEF_TRAIT_COVERAGE.length, thiefCatalog.traits.length);
  assert.ok(THIEF_TRAIT_COVERAGE.every((entry) => entry.effects.length > 0));
});

test('Thief is a loadable native application', async () => {
  assert.equal((await loadProfession('thief')).id, 'thief');
  const adapter = await loadProfessionAppAdapter('thief');

  assert.equal(adapter.profession.id, 'thief');
  assert.equal(adapter.weaponSkillMatchesSet, thiefWeaponSkillMatchesSet);
  assert.ok(adapter.assumptionControls.length >= 3);
  const html = await readFile(new URL('../../../dist/site/thief.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="thief"/);
  assert.match(html, /Thief<\/span> Rotation Simulator/);
});
