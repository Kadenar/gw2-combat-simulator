import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import { applyElementalistBuildAttributeRules } from '#gw2/professions/elementalist/build/attributes.js';
import { ELEMENTALIST_TRAIT_IDS as ELEMENTALIST } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { applyEngineerBuildAttributeRules } from '#gw2/professions/engineer/build/attributes.js';
import {
  ENGINEER_TRAIT_IDS as ENGINEER,
  ENGINEER_SKILL_IDS as ENGINEER_SKILLS
} from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { applyGuardianBuildAttributeRules } from '#gw2/professions/guardian/build/attributes.js';
import {
  GUARDIAN_TRAIT_IDS as GUARDIAN,
  GUARDIAN_SKILL_IDS as GUARDIAN_SKILLS
} from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { applyMesmerBuildAttributeRules } from '#gw2/professions/mesmer/build/attributes.js';
import { MESMER_TRAIT_IDS as MESMER, MESMER_SKILL_IDS as MESMER_SKILLS } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { WARRIOR_TRAIT_IDS as WARRIOR } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Patch the real registered owners so fixtures cannot hide duplicate or disconnected authoring declarations.
function patched(profession, edit) {
  return withPatchPreview(profession, {
    id: 's4-preview',
    label: 'S4 preview',
    professions: { [profession.id]: edit }
  });
}

test('Phantasmal Fury keeps Core and Virtuoso tuning behind its current selection', () => {
  // Virtuoso registers the extra contribution without changing Core or requiring Quiet Intensity selection.
  const family = patched(mesmerProfession, {
    balanceProfiles: {
      [MESMER.PHANTASMAL_FURY]: { fields: { criticalChance: 0.3 } },
      [MESMER.QUIET_INTENSITY]: { fields: { phantasmCriticalChance: 0.2 } }
    }
  });
  for (const specialization of ['Core', 'Virtuoso']) {
    for (const [patchId, expected] of [
      ['current', specialization === 'Core' ? 0.25 : 0.4],
      ['s4-preview', specialization === 'Core' ? 0.3 : 0.5]
    ]) {
      const runtime = family.runtimeFor({ specialization, patchId });
      const context = {
        catalog: runtime.catalog,
        config: { selectedTraitIds: [MESMER.PHANTASMAL_FURY] },
        event: { actorType: 'summon', summonKind: 'phantasm' },
        time: 0
      };
      assert.equal(runtime.modifyCriticalChance(context, 0), expected);
      assert.equal(runtime.modifyCriticalChance({ ...context, config: { selectedTraitIds: [] } }, 0), 0);
      assert.equal(
        runtime.modifyCriticalChance({ ...context, event: { actorType: 'summon', summonKind: 'clone' } }, 0),
        0
      );
    }
  }
});

test('Luminary definitions preserve eligible build grants and applied armament windows', () => {
  // Imported buffs retain their lifetime without current trait selection; live patches still own their amounts.
  const family = patched(guardianProfession, {
    balanceProfiles: { [GUARDIAN.LIGHTS_GIFT]: { fields: { attributeBonus: 240 } } },
    modifierRules: {
      'guardian.empowered-armaments': { amount: 0.2 },
      'guardian.radiant-armaments': { amount: 0.1 }
    }
  });
  const calculate = createCalculateAttributes(applyGuardianBuildAttributeRules, family.traitBuildAttributes);
  const build = {
    specializations: [
      { name: 'Luminary', traits: '1-1-1' },
      { name: 'Virtues', traits: '1-1-1' }
    ]
  };
  const balance = family.balanceContextFor('s4-preview');
  const attributes = calculate(build, [], 1, null, null, balance).attributes;
  assert.equal(attributes.Vitality.traits, 240);
  assert.equal(attributes['Condition Damage'].traits, 87);
  const disabled = calculate(build, [], 1, "Light's Gift", null, balance).attributes;
  assert.equal(disabled.Vitality.traits, 0);
  assert.equal(disabled['Condition Damage'].traits, 70);
  const events = ['guardian-empowered-armaments', 'guardian-radiant-armaments'].map((kind) => ({
    type: 'buff',
    at: 0,
    duration: 2,
    stacks: 1,
    kind,
    resolvedAudience: { includesSelf: true, alliedPlayerCount: 0 },
    metadata: { radiantWeapon: 'hammer' }
  }));
  const timeline = createGw2TimelineIndex({ events });
  for (const [patchId, expected] of [
    ['current', 117],
    ['s4-preview', 130]
  ]) {
    const runtime = family.runtimeFor({ specialization: 'Luminary', patchId });
    const context = {
      catalog: runtime.catalog,
      config: { selectedTraitIds: [] },
      events,
      timeline,
      time: 1,
      event: { actorType: 'player' }
    };
    assert.ok(Math.abs(runtime.modifyStrikeDamage(context, 100) - expected) < 1e-10);
    assert.equal(runtime.modifyStrikeDamage({ ...context, time: 2 }, 100), 100);
  }
});

test('Willbender build definitions read active tuning and honor disabled trait previews', () => {
  // Each mutually exclusive adept owns its panel grant, including the Vitality input to later conversions.
  const family = patched(guardianProfession, {
    balanceProfiles: {
      [GUARDIAN.SEARING_PACT]: { fields: { attributeBonus: 150 } },
      [GUARDIAN.POWER_FOR_POWER]: { fields: { attributeBonus: 200 } },
      [GUARDIAN.CONCEITED_CURATE]: { fields: { attributeBonus: 240 } }
    }
  });
  const calculate = createCalculateAttributes(applyGuardianBuildAttributeRules, family.traitBuildAttributes);
  for (const [choices, name, attribute, baseline, preview] of [
    ['1-1-1', 'Searing Pact', 'Condition Damage', 120, 150],
    ['2-1-1', 'Power for Power', 'Power', 120, 200],
    ['3-1-1', 'Conceited Curate', 'Vitality', 180, 240]
  ]) {
    const build = { specializations: [{ name: 'Willbender', traits: choices }] };
    for (const [patchId, bonus] of [
      ['current', baseline],
      ['s4-preview', preview]
    ]) {
      const balance = family.balanceContextFor(patchId);
      assert.equal(calculate(build, [], 1, null, null, balance).attributes[attribute].traits, bonus);
      assert.equal(calculate(build, [], 1, name, null, balance).attributes[attribute].traits, 0);
    }
  }
});

test('Imbued Haste shares patched attributes between build preview and current runtime selection', () => {
  // The registered owner grants three attributes once and honors disabled-trait and boon previews.
  const family = patched(guardianProfession, {
    balanceProfiles: { [GUARDIAN.IMBUED_HASTE]: { fields: { attributeBonus: 175 } } }
  });
  const calculate = createCalculateAttributes(applyGuardianBuildAttributeRules, family.traitBuildAttributes);
  const build = { specializations: [{ name: 'Firebrand', traits: '1-1-1' }] };
  for (const [patchId, bonus] of [
    ['current', 250],
    ['s4-preview', 175]
  ]) {
    const balance = family.balanceContextFor(patchId);
    const preview = calculate(build, [], 1, null, null, balance);
    const disabled = calculate(build, [], 1, 'Imbued Haste', null, balance);
    const withoutQuickness = calculate({ ...build, assumptions: { quickness: false } }, [], 1, null, null, balance);
    const runtime = family.runtimeFor({ specialization: 'Firebrand', patchId });
    const context = {
      catalog: runtime.catalog,
      time: 0,
      config: { selectedTraitIds: [GUARDIAN.IMBUED_HASTE], boons: { quickness: true } }
    };
    for (const [label, key] of [
      ['Condition Damage', 'conditionDamage'],
      ['Healing Power', 'healingPower'],
      ['Vitality', 'vitality']
    ]) {
      assert.equal(preview.attributes[label].traits, bonus);
      assert.equal(disabled.attributes[label].traits, 0);
      assert.equal(withoutQuickness.attributes[label].traits, 0);
      assert.equal(runtime.modifyAttributes(context, { [key]: 100 })[key], 100 + bonus);
      assert.equal(
        runtime.modifyAttributes(
          { ...context, config: { ...context.config, attributeProvenance: { professionStaticRulesApplied: true } } },
          { [key]: 100 + bonus }
        )[key],
        100 + bonus
      );
      assert.equal(
        runtime.modifyAttributes({ ...context, config: { ...context.config, selectedTraitIds: [] } }, { [key]: 100 })[
          key
        ],
        100
      );
    }
  }
});

test('Guardian Virtues share patched conversion and recharge without reapplying build attributes', () => {
  // The same owner supplies the panel conversion and live virtue recharge for each current build.
  const family = patched(guardianProfession, {
    balanceProfiles: {
      [GUARDIAN.POWER_OF_THE_VIRTUOUS]: { fields: { attributeConversion: 0.11, rechargeMultiplier: 0.5 } }
    }
  });
  const calculate = createCalculateAttributes(applyGuardianBuildAttributeRules, family.traitBuildAttributes);
  const build = { specializations: [{ name: 'Virtues', traits: '1-1-1' }] };
  for (const [patchId, bonus, recharge] of [
    ['current', 70, 25.5],
    ['s4-preview', 110, 15]
  ]) {
    const balance = family.balanceContextFor(patchId);
    assert.equal(calculate(build, [], 1, null, null, balance).attributes['Condition Damage'].traits, bonus);
    assert.equal(
      calculate(build, [], 1, 'Power of the Virtuous', null, balance).attributes['Condition Damage'].traits,
      0
    );
    const runtime = family.runtimeFor({ patchId });
    const context = {
      catalog: runtime.catalog,
      time: 0,
      config: { selectedTraitIds: [GUARDIAN.POWER_OF_THE_VIRTUOUS], stats: { vitality: 1000 } }
    };
    const justice = runtime.catalog.skillsById.get(GUARDIAN_SKILLS.JUSTICE);
    assert.equal(runtime.rechargeWork(context, justice, 30), recharge);
    assert.equal(runtime.modifyAttributes(context, { conditionDamage: 100 }).conditionDamage, 100 + bonus);
    context.config.attributeProvenance = { professionStaticRulesApplied: true };
    assert.equal(runtime.modifyAttributes(context, { conditionDamage: 100 + bonus }).conditionDamage, 100 + bonus);
    context.config.selectedTraitIds = [];
    assert.equal(runtime.rechargeWork(context, justice, 30), 30);
  }
});

test('Guardian weapon definitions preserve patched build bonuses and live weapon-swap provenance', () => {
  // A delayed Greatsword packet uses the equipped weapon's bonus, subtracting the panel's previous weapon grant.
  const family = patched(guardianProfession, {
    balanceProfiles: {
      [GUARDIAN.ZEALOUS_BLADE]: { fields: { attributeBonus: 100, weaponAttributeBonus: 300 } },
      [GUARDIAN.RIGHT_HAND_STRENGTH]: { fields: { attributeBonus: 40 } }
    }
  });
  const balance = family.balanceContextFor('s4-preview');
  const calculate = createCalculateAttributes(applyGuardianBuildAttributeRules, family.traitBuildAttributes);
  const build = {
    specializations: [
      { name: 'Zeal', traits: '1-2-1' },
      { name: 'Radiance', traits: '2-1-1' }
    ],
    weapons: ['Greatsword'],
    alternateWeapons: ['Sword', 'Focus']
  };
  assert.equal(calculate(build, [], 1, null, null, balance).attributes.Power.traits, 300);
  assert.equal(calculate(build, [], 2, null, null, balance).attributes.Power.traits, 140);
  const runtime = family.runtimeFor({ patchId: 's4-preview' });
  const context = {
    catalog: runtime.catalog,
    time: 1,
    event: { skillWeapon: 'Greatsword' },
    config: {
      primaryWeapon: 'Sword',
      selectedTraitIds: [GUARDIAN.ZEALOUS_BLADE, GUARDIAN.RIGHT_HAND_STRENGTH],
      attributeProvenance: { professionStaticRulesApplied: true, calculatedPrimaryWeapon: 'Greatsword' }
    }
  };
  assert.equal(runtime.modifyAttributes(context, { power: 1300 }).power, 1140);
  assert.equal(
    runtime.modifyAttributes(
      { ...context, config: { ...context.config, primaryWeapon: 'Greatsword' } },
      { power: 1300 }
    ).power,
    1300
  );
});

test('Engineer Core definitions share patched build grants and preserve static attribute provenance', () => {
  // The build panel and live resolver consume the same registered owner without adding its grant twice.
  const family = patched(engineerProfession, {
    balanceProfiles: { [ENGINEER.CHEMICAL_ROUNDS]: { fields: { attributeBonus: 180 } } }
  });
  const calculate = createCalculateAttributes(applyEngineerBuildAttributeRules, family.traitBuildAttributes);
  const build = { specializations: [{ name: 'Firearms', traits: '1-2-3' }] };
  for (const [patchId, bonus] of [
    ['current', 120],
    ['s4-preview', 180]
  ]) {
    const balance = family.balanceContextFor(patchId);
    assert.equal(calculate(build, [], 1, null, null, balance).attributes['Condition Damage'].traits, bonus);
    assert.equal(calculate(build, [], 1, 'Chemical Rounds', null, balance).attributes['Condition Damage'].traits, 0);
    const runtime = family.runtimeFor({ patchId });
    const context = { catalog: runtime.catalog, time: 0, config: { selectedTraitIds: [ENGINEER.CHEMICAL_ROUNDS] } };
    assert.equal(runtime.modifyAttributes(context, { conditionDamage: 100 }).conditionDamage, 100 + bonus);
    assert.equal(
      runtime.modifyAttributes(
        {
          ...context,
          config: {
            ...context.config,
            attributeProvenance: { professionStaticRulesApplied: true }
          }
        },
        { conditionDamage: 100 + bonus }
      ).conditionDamage,
      100 + bonus
    );
  }
});

test('Mechanist registered recharge owners read preview values and preserve Overclock eligibility', () => {
  // Command and signet recharge use their selected trait profiles; Overclock cannot reduce itself.
  const family = patched(engineerProfession, {
    balanceProfiles: {
      [ENGINEER.MECH_CORE_JADE_DYNAMO]: { fields: { rechargeMultiplier: 0.5 } },
      [ENGINEER.MECH_CORE_J_DRIVE]: { fields: { rechargeMultiplier: 0.6 } }
    }
  });
  const runtime = family.runtimeFor({ specialization: 'Mechanist', patchId: 's4-preview' });
  const context = {
    catalog: runtime.catalog,
    config: {
      selectedSkillIds: [63095],
      selectedTraitIds: [ENGINEER.MECH_CORE_JADE_DYNAMO, ENGINEER.MECH_CORE_J_DRIVE]
    },
    cooldowns: new Map([[ENGINEER_SKILLS.OVERCLOCK_SIGNET, 90]]),
    cooldownController: { readyAt: (id) => context.cooldowns.get(id) },
    time: 1
  };
  const skill = (id) => runtime.catalog.skillsById.get(id);
  assert.equal(runtime.rechargeWork(context, skill(ENGINEER_SKILLS.JADE_MORTAR), 30), 15);
  assert.equal(runtime.rechargeWork(context, skill(ENGINEER_SKILLS.SUPERCONDUCTING_SIGNET), 30), 18);
  assert.equal(runtime.rechargeWork(context, skill(ENGINEER_SKILLS.OVERCLOCK_SIGNET), 90), 90);
  context.config.selectedTraitIds = [];
  assert.equal(runtime.rechargeWork(context, skill(ENGINEER_SKILLS.SUPERCONDUCTING_SIGNET), 30), 30);
});

test('Elementalist Core definitions preserve patched build grants and disabled-trait preview selection', () => {
  const family = patched(elementalistProfession, {
    balanceProfiles: {
      [ELEMENTALIST.BURNING_RAGE]: { fields: { attributeBonus: 240 } },
      [ELEMENTALIST.BURNING_PRECISION]: { fields: { durationMultiplier: 30 } },
      [ELEMENTALIST.ZEPHYRS_SPEED]: { fields: { criticalChance: 0.1 } }
    }
  });
  const calculate = createCalculateAttributes(applyElementalistBuildAttributeRules, family.traitBuildAttributes);
  const build = {
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' }
    ]
  };
  const live = calculate(build, [], 1, null, null, family.balanceContextFor('current'));
  const preview = calculate(build, [], 1, null, null, family.balanceContextFor('s4-preview'));
  assert.equal(live.attributes['Condition Damage'].traits, 180);
  assert.equal(preview.attributes['Condition Damage'].traits, 240);
  assert.equal(preview.attributes['Burning Duration'].traits, 30);
  assert.equal(preview.attributes['Critical Chance'].traits, 10);
  assert.equal(
    calculate(build, [], 1, 'Burning Rage', null, family.balanceContextFor('s4-preview')).attributes['Condition Damage']
      .traits,
    0
  );
});

test('Electric Discharge keeps its packet-owned critical modifier after selection ends and reads preview tuning', () => {
  // Its proc packet already owns eligibility; ordinary trait modifiers still require current selection.
  const family = patched(elementalistProfession, {
    balanceProfiles: { [ELEMENTALIST.ELECTRIC_DISCHARGE]: { fields: { criticalDamage: 3 } } }
  });
  for (const [patchId, factor] of [
    ['current', 2],
    ['s4-preview', 3]
  ]) {
    const runtime = family.runtimeFor({ patchId });
    const context = {
      time: 1,
      catalog: runtime.catalog,
      event: { actorType: 'effect', skillName: 'Electric Discharge' },
      config: { selectedTraitIds: [] }
    };
    assert.equal(runtime.modifyCriticalDamage(context, 1), factor);
    assert.equal(runtime.modifyCriticalDamage({ ...context, event: { skillName: 'Other' } }, 1), 1);
    assert.equal(runtime.modifyCriticalChance({ ...context, event: { actorType: 'player' } }, 0), 0);
  }
});

test('Familiar Prowess retains its applied window and patched Focus scaling after selection ends', () => {
  // Buff lifetime owns eligibility; the cached runtime still checks Focus against each current build.
  const family = patched(elementalistProfession, {
    modifierRules: {
      'elementalist.familiars-prowess-strike': { parameters: { baseAmount: 0.2, focusedAmount: 0.3 } }
    }
  });
  const runtime = family.runtimeFor({ specialization: 'Evoker', patchId: 's4-preview' });
  const context = {
    time: 1,
    catalog: runtime.catalog,
    event: { actorType: 'player' },
    config: { evokerElement: 'Air', selectedTraitIds: [] },
    runtime: { boons: new Map([["familiar's-prowess", [{ at: 0, expiresAt: 2, stacks: 1 }]]]) }
  };
  assert.equal(runtime.modifyStrikeDamage(context, 100), 120);
  assert.equal(
    runtime.modifyStrikeDamage(
      { ...context, config: { ...context.config, selectedTraitIds: [ELEMENTALIST.FAMILIARS_FOCUS] } },
      100
    ),
    130
  );
  assert.equal(runtime.modifyStrikeDamage({ ...context, time: 2 }, 100), 100);
});

test('Virtuoso definitions share patched build conversion and live modifiers without leaking between builds', () => {
  const family = patched(mesmerProfession, {
    balanceProfiles: { [MESMER.QUIET_INTENSITY]: { fields: { vitalityConversion: 0.2, criticalChance: 0.25 } } },
    modifierRules: { 'mesmer.mental-focus': { factor: 1.2 } }
  });
  const runtime = family.runtimeFor({ specialization: 'Virtuoso', patchId: 's4-preview', selectedTraitIds: [] });
  assert.equal(
    runtime,
    family.runtimeFor({
      specialization: 'Virtuoso',
      patchId: 's4-preview',
      selectedTraitIds: [MESMER.QUIET_INTENSITY, MESMER.MENTAL_FOCUS]
    })
  );
  const context = {
    time: 0,
    catalog: runtime.catalog,
    event: { actorType: 'player' },
    config: { selectedTraitIds: [MESMER.QUIET_INTENSITY, MESMER.MENTAL_FOCUS], stats: { vitality: 1000 } },
    query: { furyActiveAt: () => true }
  };
  assert.equal(runtime.modifyCriticalChance(context, 0), 0.25);
  assert.equal(runtime.modifyAttributes(context, { ferocity: 0 }).ferocity, 200);
  assert.equal(runtime.modifyStrikeDamage(context, 100), 120);
  assert.equal(
    runtime.modifyStrikeDamage({ ...context, event: { actorType: 'summon', summonKind: 'phantasm' } }, 100),
    100
  );
  assert.equal(runtime.modifyCriticalChance({ ...context, config: { selectedTraitIds: [] } }, 0), 0);
  // Phantasmal Fury is still its own selection gate while reading the shared Virtuoso tuning profile.
  assert.equal(
    runtime.modifyCriticalChance(
      {
        ...context,
        event: { actorType: 'summon', summonKind: 'phantasm' },
        config: { selectedTraitIds: [MESMER.PHANTASMAL_FURY] }
      },
      0
    ),
    0.4
  );

  const calculate = createCalculateAttributes(applyMesmerBuildAttributeRules, family.traitBuildAttributes);
  const build = { specializations: [{ name: 'Virtuoso', traits: '0-0-0' }], assumptions: { fury: true } };
  const live = calculate(build, [], 1, null, null, family.balanceContextFor('current'));
  const preview = calculate(build, [], 1, null, null, family.balanceContextFor('s4-preview'));
  assert.equal(live.attributes.Ferocity.traits, 100);
  assert.equal(preview.attributes.Ferocity.traits, 200);
  assert.equal(preview.attributes['Critical Chance'].final - live.attributes['Critical Chance'].final, 10);
  assert.equal(
    calculate(build, [], 1, 'Quiet Intensity', null, family.balanceContextFor('s4-preview')).attributes.Ferocity.traits,
    0
  );
  assert.equal(
    runtime.modifyAttributes(
      {
        ...context,
        config: {
          ...context.config,
          attributeProvenance: {
            professionStaticRulesApplied: true,
            calculatedWeaponSet: 1,
            calculatedPrimaryWeapon: 'Dagger'
          }
        }
      },
      { ferocity: preview.attributes.Ferocity.final }
    ).ferocity,
    200
  );
  assert.equal(family.catalog.balanceProfilesById.get(MESMER.QUIET_INTENSITY).vitalityConversion, 0.1);
});

test('Versatile Power adjusts selected burst and Dragon Trigger recharge using the active profile', () => {
  const family = patched(warriorProfession, {
    balanceProfiles: { [WARRIOR.VERSATILE_POWER]: { fields: { rechargeMultiplier: 0.5 } } }
  });
  for (const [patchId, factor] of [
    ['current', 0.85],
    ['s4-preview', 0.5]
  ]) {
    // Dragon Trigger owns the slash recharge without needing the burst flag used by damage traits.
    for (const [specialization, skillName] of [
      ['Core', 'Eviscerate'],
      ['Bladesworn', 'Dragon Trigger']
    ]) {
      const runtime = family.runtimeFor({ patchId, specialization });
      const skill = runtime.catalog.skillsByName.get(skillName);
      const weapon = runtime.catalog.skillsByName.get('Cyclone Axe');
      assert.ok(skill && weapon);
      const context = { helpers: runtime.catalog, config: { selectedTraitIds: [WARRIOR.VERSATILE_POWER] } };
      assert.equal(runtime.rechargeWork(context, skill, 10), 10 * factor);
      assert.equal(runtime.rechargeWork({ ...context, config: { selectedTraitIds: [] } }, skill, 10), 10);
      assert.equal(runtime.rechargeWork(context, weapon, 10), 10);
    }
  }
});

test('Dazzling keeps accepted-control actor gates and effect removal through registered composition', () => {
  const family = patched(mesmerProfession, {
    balanceProfiles: { [MESMER.DAZZLING]: { removeEffects: [{ type: 'condition', name: 'Vulnerability' }] } }
  });
  for (const actorType of ['player', 'summon', 'environment']) {
    for (const [patchId, selected] of [
      ['current', true],
      ['current', false],
      ['s4-preview', true]
    ]) {
      const config = { specialization: 'Core', patchId, selectedTraitIds: selected ? [MESMER.DAZZLING] : [] };
      const native = family.runtimeFor(config);
      const result = observeGw2Runtime({
        config,
        rotation: [{ type: 'wait', durationMs: 2000 }],
        profession: {
          ...native,
          initialize(runtime) {
            native.initialize(runtime);
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'control',
                at: 1,
                actorType,
                source: 'mesmer',
                sourceId: MESMER_SKILLS.MAGIC_BULLET,
                skillId: MESMER_SKILLS.MAGIC_BULLET,
                skillName: 'Magic Bullet',
                controlKind: 'stun',
                duration: 1
              }
            });
          }
        }
      });
      assert.deepEqual(result.warnings, []);
      const effect = result.events.find((event) => event.type === 'condition' && event.sourceId === MESMER.DAZZLING);
      assert.equal(Boolean(effect), patchId === 'current' && selected && actorType !== 'environment');
      if (effect) assert.equal(effect.ownerActorType, 'player');
    }
  }
});

test('Persisting Flames patches transform packets before emission and display the same stack cap used by damage', () => {
  const family = patched(elementalistProfession, {
    balanceProfiles: {
      [ELEMENTALIST.PERSISTING_FLAMES]: { fields: { summons: 1, durationPerTier: 3, maximumStacks: 2 } }
    },
    modifierRules: { 'elementalist.persisting-flames': { parameters: { damagePerStack: 0.1 } } }
  });
  const effects = [
    {
      type: 'strike',
      damageKind: 'field-tick',
      ticks: [
        { atMs: 0, coefficient: 1 },
        { atMs: 1000, coefficient: 1 }
      ]
    }
  ];
  const skill = { type: 'Weapon', comboFields: [{ fieldType: 'Fire', duration: 2 }] };
  for (const [patchId, extension, packets, damage] of [
    ['current', 2, 2, 110],
    ['s4-preview', 3, 1, 120]
  ]) {
    const runtime = family.runtimeFor({ patchId });
    const context = {
      time: 1,
      helpers: runtime.catalog,
      catalog: runtime.catalog,
      config: { selectedTraitIds: [ELEMENTALIST.PERSISTING_FLAMES] },
      runtime: { boons: new Map([['persisting flames', [{ at: 0, expiresAt: 15, stacks: 5 }]]]) },
      event: { actorType: 'player' }
    };
    assert.equal(runtime.modifyComboFields(context, { skill }, skill.comboFields)[0].duration, 2 + extension);
    const transformed = runtime.modifyEffects(context, { skill }, effects);
    assert.equal(transformed.at(-1).ticks[0].atMs, 1000 * (1 + packets));
    assert.ok(Math.abs(runtime.modifyStrikeDamage(context, 100) - damage) < 1e-10);
    assert.equal(runtime.modifyEffects({ ...context, config: { selectedTraitIds: [] } }, { skill }, effects), effects);
  }

  const tooltip = describeSimulationTrait(
    family.balanceContextFor('s4-preview'),
    { id: ELEMENTALIST.PERSISTING_FLAMES, name: 'Persisting Flames' },
    elementalistTooltips
  );
  assert.equal(tooltip.facts.find((fact) => fact.name === 'Maximum stacks').detail, '2');
  assert.equal(effects[0].ticks.at(-1).atMs, 1000);
  assert.equal(skill.comboFields[0].duration, 2);
});

test('Mesmer Core and elite build owners consume patched values with independent boon assumptions', () => {
  // Native composition applies each selected contribution once and keeps preview overrides local to that calculation.
  const family = patched(mesmerProfession, {
    balanceProfiles: {
      [MESMER.CHAOTIC_PERSISTENCE]: { fields: { expertiseBonus: 180, concentrationBonus: 320 } },
      [MESMER.FLOW_OF_TIME]: { fields: { criticalChance: 0.2 } }
    }
  });
  const calculate = createCalculateAttributes(applyMesmerBuildAttributeRules, family.traitBuildAttributes);
  const build = {
    specializations: [
      { name: 'Chaos', traits: '1-1-1' },
      { name: 'Chronomancer', traits: '1-1-1' }
    ]
  };
  for (const [patchId, expertise, concentration] of [
    ['current', 100, 250],
    ['s4-preview', 180, 320]
  ]) {
    const balance = family.balanceContextFor(patchId);
    const attributes = calculate(build, [], 1, null, null, balance).attributes;
    assert.equal(attributes.Expertise.traits, expertise);
    assert.equal(attributes.Concentration.traits, concentration);
    const withoutFlow = calculate(build, [], 1, 'Flow of Time', null, balance).attributes;
    assert.equal(
      attributes['Critical Chance'].final - withoutFlow['Critical Chance'].final,
      patchId === 'current' ? 15 : 20
    );
    const disabled = calculate(build, [], 1, 'Chaotic Persistence', null, balance).attributes;
    assert.equal(disabled.Expertise.traits, 0);
    assert.equal(disabled.Concentration.traits, 0);
    const withoutRegeneration = calculate(
      { ...build, assumptions: { regeneration: false } },
      [],
      1,
      null,
      null,
      balance
    ).attributes;
    assert.equal(withoutRegeneration.Expertise.traits, 0);
    assert.equal(withoutRegeneration.Concentration.traits, 0);
  }
});
