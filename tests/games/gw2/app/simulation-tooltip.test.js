import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeSimulationSkill,
  describeSimulationTrait,
  skillTooltip,
  simulationEffectFacts,
  tooltipDecimal,
  tooltipNumber
} from '#gw2/app/shared/simulation-tooltip.js';
import { defineProfessionApp } from '#gw2/app/create-adapter.js';
import { skillTooltipAttributes } from '#gw2/app/shared/tooltip-overlay.js';
import { tooltipFactIcon } from '#gw2/app/shared/icons.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { necromancerTooltips } from '#gw2/professions/necromancer/app/tooltips.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { applyNecromancerBuildAttributeRules } from '#gw2/professions/necromancer/build/attributes.js';
import { createNecromancerBuildDefaults, toApplicationBuild } from '#gw2/professions/necromancer/build/build.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { necromancerCoreCastRules } from '#gw2/professions/necromancer/core/traits/modifiers.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { SCOURGE_BALANCE_PROFILE_IDS as SCOURGE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';

// Qualified attribute, adrenaline, and skill-recharge facts keep the game's matching glyphs.
test('attribute bonuses, adrenaline, and skill recharge use game CDN icons', async () => {
  const { rangerProfession } = await import('#gw2/professions/ranger/profession.js');
  const { rangerTooltips } = await import('#gw2/professions/ranger/app/tooltips.js');
  const context = withPatchPreview(rangerProfession, null).balanceContextFor();
  const trait = context.catalog.traits.find(({ name }) => name === 'Pack Alpha');
  const tooltip = describeSimulationTrait(context, trait, rangerTooltips);
  const attributes = tooltip.facts.filter(({ name }) => name.includes('attribute'));
  assert.equal(attributes.length, 2);
  for (const fact of attributes) assert.match(fact.icon, /\/156652\.png$/);
  assert.match(tooltip.facts.find(({ name }) => name === 'Pet skill recharge').icon, /\/1770202\.png$/);
  assert.match(tooltipFactIcon('Attribute increase per stack'), /\/156652\.png$/);
  assert.match(tooltipFactIcon('Adrenaline gained'), /\/156652\.png$/);
  assert.match(tooltipFactIcon('Minimum adrenaline'), /\/156652\.png$/);
  assert.match(tooltipFactIcon('Motivation gained'), /\/156661\.png$/);
  assert.match(tooltipFactIcon('Motivation required for tier two'), /\/156661\.png$/);
  assert.match(tooltipFactIcon('Pulse interval'), /\/1770206\.png$/);
  assert.match(tooltipFactIcon('Pulse intervals'), /\/1770206\.png$/);
  assert.match(tooltipFactIcon('Earth skill recharge'), /\/1770202\.png$/);
  assert.match(tooltipFactIcon('Internal cooldown'), /\/156651\.png$/);
});

// A single sparse profile edit must reach the build panel, combat, and tooltip without duplicate tuning inputs.
test('Radiant Power shares patched attribute and critical-chance values across consumers', async () => {
  const { guardianProfession } = await import('#gw2/professions/guardian/profession.js');
  const { guardianTooltips } = await import('#gw2/professions/guardian/app/tooltips.js');
  const { GUARDIAN_TRAIT_IDS: traits } = await import('#gw2/professions/guardian/data/ids.js');
  const { createGuardianBuildDefaults } = await import('#gw2/professions/guardian/build/build.js');
  const { applyGuardianBuildAttributeRules } = await import('#gw2/professions/guardian/build/attributes.js');
  const preview = withPatchPreview(guardianProfession, {
    id: 'radiant-profile',
    label: 'Radiant profile',
    professions: {
      guardian: {
        balanceProfiles: { [traits.RADIANT_POWER]: { fields: { attributeBonus: 237, criticalChance: 0.17 } } }
      }
    }
  }).balanceContextFor('radiant-profile');
  const build = createGuardianBuildDefaults();
  build.specializations = [{ name: 'Radiance', traits: '2-3-3' }];
  const calculate = createCalculateAttributes(applyGuardianBuildAttributeRules);
  const all = calculate(build, [], 1, null, null, preview).attributes;
  const without = calculate(build, [], 1, 'Radiant Power', null, preview).attributes;
  assert.equal(all.Ferocity.final - without.Ferocity.final, 237);
  const context = { catalog: preview.catalog, config: { selectedTraitIds: [traits.RADIANT_POWER] }, time: 0 };
  const ferocity = preview.modifierRulesById.get('guardian.radiant-power-ferocity');
  assert.equal(ferocity.amount(context), 237);
  assert.equal(
    ferocity.amount({
      ...context,
      config: { ...context.config, attributeProvenance: { professionStaticRulesApplied: true } }
    }),
    0
  );
  assert.equal(preview.modifierRulesById.get('guardian.radiant-power-critical-chance').amount(context), 0.17);
  const model = describeSimulationTrait(
    preview,
    preview.catalog.traits.find(({ id }) => id === traits.RADIANT_POWER),
    guardianTooltips
  );
  assert.equal(model.facts.find(({ name }) => name === 'Ferocity').detail, '237');
  assert.equal(model.facts.find(({ name }) => name === 'Critical chance against burning targets').detail, '+17%');
});

// Duration edits must reach both calculation routes without applying the bonus twice.
test('Carbolic Composition shares one patched duration bonus across consumers', async () => {
  const { engineerProfession } = await import('#gw2/professions/engineer/profession.js');
  const { engineerTooltips } = await import('#gw2/professions/engineer/app/tooltips.js');
  const { ENGINEER_TRAIT_IDS: traits } = await import('#gw2/professions/engineer/data/ids.js');
  const { createEngineerBuildDefaults } = await import('#gw2/professions/engineer/build/build.js');
  const { applyEngineerBuildAttributeRules } = await import('#gw2/professions/engineer/build/attributes.js');
  const preview = withPatchPreview(engineerProfession, {
    id: 'carbolic-profile',
    label: 'Carbolic profile',
    professions: {
      engineer: { balanceProfiles: { [traits.CARBOLIC_COMPOSITION]: { fields: { conditionDurationBonus: 0.42 } } } }
    }
  }).balanceContextFor('carbolic-profile');
  const build = createEngineerBuildDefaults();
  build.specializations = [{ name: 'Amalgam', traits: '1-1-1' }];
  const calculated = createCalculateAttributes(applyEngineerBuildAttributeRules)(build, [], 1, null, null, preview);
  assert.equal(calculated.attributes['Poison Duration'].traits, 42);
  const rule = preview.modifierRulesById.get('engineer.carbolic-composition-duration');
  const context = {
    catalog: preview.catalog,
    config: { selectedTraitIds: [traits.CARBOLIC_COMPOSITION] },
    condition: 'Poisoned'
  };
  assert.equal(rule.amount(context), 0.42);
  assert.equal(rule.when(context), true);
  assert.equal(
    rule.when({
      ...context,
      config: { ...context.config, attributeProvenance: { professionStaticRulesApplied: true } }
    }),
    false
  );
  const model = describeSimulationTrait(preview, { id: traits.CARBOLIC_COMPOSITION }, engineerTooltips);
  assert.equal(model.facts.find(({ name }) => name === 'Poison duration').detail, '+42%');
});

test('Pure Strike has one authored critical-damage multiplier shared by combat and tooltip', async () => {
  const { warriorProfession } = await import('#gw2/professions/warrior/profession.js');
  const { warriorTooltips } = await import('#gw2/professions/warrior/app/tooltips.js');
  const { WARRIOR_TRAIT_IDS: traits } = await import('#gw2/professions/warrior/data/ids.js');
  const preview = withPatchPreview(warriorProfession, {
    id: 'pure-strike-profile',
    label: 'Pure Strike profile',
    professions: { warrior: { balanceProfiles: { [traits.PURE_STRIKE]: { fields: { criticalDamage: 1.35 } } } } }
  }).balanceContextFor('pure-strike-profile');
  const profile = preview.catalog.balanceProfilesById.get(traits.PURE_STRIKE);
  assert.equal(Object.hasOwn(profile, 'coefficientMultiplier'), false);
  assert.equal(Object.hasOwn(profile, 'damageMultiplier'), false);
  const rule = preview.modifierRulesById.get('warrior.pure-strike');
  assert.equal(rule.factor({ catalog: preview.catalog }), 1.35);
  const model = describeSimulationTrait(
    preview,
    preview.catalog.traits.find(({ id }) => id === traits.PURE_STRIKE),
    warriorTooltips
  );
  assert.equal(model.facts.find(({ name }) => name === 'Critical damage').detail, '+35%');
});

// Revenant trait facts expose the simulated bonuses and reuse the affected trait or standard resource icon.
test('Revenant trait tooltips show bonuses, resource icons, and excluded traits', async () => {
  const { revenantProfession } = await import('#gw2/professions/revenant/profession.js');
  const { revenantTooltips } = await import('#gw2/professions/revenant/app/tooltips.js');
  const { REVENANT_TRAIT_IDS: traits } = await import('#gw2/professions/revenant/data/ids.js');
  const context = withPatchPreview(revenantProfession, null).balanceContextFor();
  const trait = (id) => context.catalog.traits.find((entry) => entry.id === id);
  const describe = (id) => describeSimulationTrait(context, trait(id), revenantTooltips);
  for (const [id, detail] of [
    [traits.ROILING_MISTS, '+25%'],
    [traits.SEETHING_MALICE, '+120'],
    [traits.PACT_OF_PAIN, '+15%'],
    [traits.YEARNING_EMPOWERMENT, '+10%']
  ]) {
    assert.equal(describe(id).facts[0].detail, detail, trait(id).name);
  }

  // Implemented fixed bonuses must remain visible, with off-hand alternatives and per-stack units kept distinct.
  for (const [id, name, detail] of [
    [traits.DESTRUCTIVE_IMPULSES, 'Strike and condition damage without an off-hand weapon', '+5%'],
    [traits.DESTRUCTIVE_IMPULSES, 'Strike and condition damage with an off-hand weapon', '+7.5%'],
    [traits.TARGETED_DESTRUCTION, 'Strike damage per vulnerability stack', '+0.5%'],
    [traits.REINFORCED_POTENCY, 'Concentration', '+240'],
    [traits.REINFORCED_POTENCY, 'Strike damage per unique boon', '+1%'],
    [traits.CORE_VALUE, 'Additional boon extension', '1s'],
    [traits.EMPIRE_DIVIDED, 'Power', '+240'],
    [traits.FORCEFUL_PERSISTENCE, 'Strike damage per active facet', '+10%'],
    [traits.FORCEFUL_PERSISTENCE, 'Strike damage per other active upkeep skill', '+25%']
  ]) {
    assert.equal(describe(id).facts.find((fact) => fact.name === name)?.detail, detail, trait(id).name);
  }

  const gift = describe(traits.NUMINOUS_GIFT);
  for (const [name, id] of [
    ['Additional Targeted Destruction bonus', traits.TARGETED_DESTRUCTION],
    ['Additional damaging-condition duration', traits.YEARNING_EMPOWERMENT]
  ]) {
    assert.ok(trait(id).icon);
    assert.equal(gift.facts.find((fact) => fact.name === name).icon, trait(id).icon);
  }

  for (const id of [traits.LINGERING_DETERMINATION, traits.SONG_OF_ARBOREUM]) {
    assert.match(describe(id).facts[0].icon, /\/156661\.png$/);
  }

  const excluded = describe(traits.CONTAINED_TEMPER);
  assert.match(excluded.description, /outside the simulator's scope/);
  assert.deepEqual(excluded.facts, []);
});

// Repeated renders reuse only the selected model; patch changes and per-row descriptions remain independent.
test('adapter caches skill tooltips per balance context without retaining stale patches or row state', () => {
  const preview = (coefficient) =>
    withPatchPreview(necromancerProfession, {
      id: 'tooltip-cache',
      label: 'Tooltip cache',
      professions: { necromancer: { skills: { [ID.BLOOD_CURSE]: { effects: [{ type: 'strike', coefficient }] } } } }
    });
  let profession = preview(2);
  let descriptions = 0;
  const adapter = defineProfessionApp({
    profession: { ...profession, balanceContextFor: (patchId) => profession.balanceContextFor(patchId) },
    tooltips: {
      ...necromancerTooltips,
      skillFacts: (context, skill) => {
        descriptions += 1;
        return necromancerTooltips.skillFacts(context, skill);
      }
    },
    applyBuildAttributeRules: applyNecromancerBuildAttributeRules,
    toApplicationBuild,
    specializationFallback: 'Spite'
  });
  const skill = profession.catalog.skillsById.get(ID.BLOOD_CURSE);
  const live = adapter.skillTooltip(skill, 'current');
  assert.equal(adapter.skillTooltip({ ...skill }, 'current'), live);
  assert.equal(descriptions, 1);
  const patched = adapter.skillTooltip(skill, 'tooltip-cache');
  assert.match(patched.facts.find((fact) => fact.name === 'Strike damage').detail, /^2 coefficient/);
  assert.equal(adapter.skillTooltip(skill, 'tooltip-cache'), patched);
  assert.equal(adapter.skillTooltip(skill, 'current'), live);
  assert.equal(descriptions, 2);
  assert.match(
    skillTooltipAttributes(skill, live, { details: 'Available now', detailsTitle: 'Cast details' }),
    /Available now/
  );
  const pending = skillTooltipAttributes(skill, live, { details: 'Available at 5s', detailsTitle: 'Cast details' });
  assert.match(pending, /Available at 5s/);
  assert.doesNotMatch(pending, /Available now/);

  profession = preview(3);
  const revised = adapter.skillTooltip(skill, 'tooltip-cache');
  assert.match(revised.facts.find((fact) => fact.name === 'Strike damage').detail, /^3 coefficient/);
  assert.equal(descriptions, 3);
});

// Handler descriptions must format their own packet once, without a discarded generic pass.
test('custom skill tooltips format their payload once', () => {
  let reads = 0;
  const skill = {
    id: 'custom-tooltip',
    name: 'Custom tooltip',
    effects: [
      {
        type: 'strike',
        get coefficient() {
          reads += 1;
          return 1;
        }
      }
    ]
  };
  const model = describeSimulationSkill({ catalog: { skillsById: new Map([[skill.id, skill]]) } }, skill, {
    traits: {},
    skills: { [skill.id]: skillTooltip('Custom attack.') }
  });
  assert.match(model.facts[0].detail, /^1 coefficient/);
  assert.equal(reads, 1);
});

// Finisher chance is useful for projectiles; other finisher types always display just their type.
test('combo finisher tooltips show chance only for projectiles', () => {
  const skill = {
    id: 'finisher-tooltip',
    name: 'Finisher tooltip',
    comboFinishers: ['Leap', 'Blast', 'Whirl', 'Projectile'].map((finisherType) => ({ finisherType, chance: 1 }))
  };
  const model = describeSimulationSkill({}, skill, { traits: {} });
  assert.deepEqual(
    model.facts.filter(({ name }) => name === 'Combo finisher').map(({ detail }) => detail),
    ['Leap', 'Blast', 'Whirl', 'Projectile · 100% chance']
  );
});

// Trait facts follow the same specialization overrides and selected patches as combat.
test('Dhuumfire tooltips show specialization durations and the Scourge cooldown', () => {
  const profession = withPatchPreview(necromancerProfession, {
    id: 'dhuumfire-tooltip',
    label: 'Dhuumfire tooltip',
    professions: {
      necromancer: {
        skills: { [ID.TAINTED_BOLTS]: { fields: { dhuumfireDuration: 5 } } },
        balanceProfiles: {
          [SCOURGE.shade]: { fields: { dhuumfireDuration: 4, dhuumfireInterval: 2 } }
        }
      }
    }
  });
  for (const [specialization, duration, cooldown, patchId] of [
    ['Core', 3, undefined, undefined],
    ['Reaper', 3, undefined, undefined],
    ['Ritualist', 3, undefined, undefined],
    ['Harbinger', 1, undefined, undefined],
    ['Harbinger', 5, undefined, 'dhuumfire-tooltip'],
    ['Scourge', 2, '1s', undefined],
    ['Scourge', 4, '2s', 'dhuumfire-tooltip']
  ]) {
    const context = profession.balanceContextFor(patchId);
    const trait = context.catalog.traits.find((entity) => entity.id === TRAIT.DHUUMFIRE);
    const model = describeSimulationTrait(context, trait, necromancerTooltips, specialization);
    assert.ok(model.facts.find((fact) => fact.name === 'Burning').detail.startsWith(`${duration}s`));
    assert.equal(model.facts.find((fact) => fact.name === 'Burning').stacks, 1);
    assert.equal(model.facts.find((fact) => fact.name === 'Internal cooldown')?.detail, cooldown);
  }

  const simulate = createProfessionSimulator(profession, {
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597 }
  });
  const result = simulate(
    'Scourge',
    ['Manifest Sand Shade', 'Garish Pillar', { type: 'wait', durationMs: 2100 }, 'Sand Cascade'],
    {
      patchId: 'dhuumfire-tooltip',
      initialResource: 100,
      selectedTraitIds: [TRAIT.DHUUMFIRE]
    }
  );
  const applications = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning'
  );
  assert.deepEqual(
    applications.map((event) => event.duration),
    [4, 4]
  );
  assert.ok(applications[1].at - applications[0].at >= 2);
});

// Alternative packets stay separate from shared costs for every Blight-enhanced action.
test('Harbinger payloads use separate base and enhanced tabs', () => {
  const context = withPatchPreview(necromancerProfession, null).balanceContextFor();
  for (const skill of context.catalog.skills.filter((entry) =>
    ['necromancer.elixir', 'necromancer.blight-skill'].includes(entry.handlerId)
  )) {
    const model = describeSimulationSkill(context, skill, necromancerTooltips);
    assert.deepEqual(
      model.factTabs.map((tab) => tab.label),
      ['Base effects', 'Enhanced effects']
    );
    assert.ok(model.factTabs.every((tab) => tab.facts.length));
    assert.ok(model.facts.some((fact) => fact.name === 'Blight required and consumed'));
    assert.ok(!model.facts.some((fact) => fact.name === 'Strike damage'));
  }

  const risk = describeSimulationSkill(context, context.catalog.skillsById.get(ID.ELIXIR_OF_RISK), necromancerTooltips);
  assert.match(risk.factTabs[0].facts.find((fact) => fact.name === 'Strike damage').detail, /^2 coefficient/);
  assert.match(risk.factTabs[1].facts.find((fact) => fact.name === 'Strike damage').detail, /^4 coefficient/);
});

// A selected recharge patch must change the displayed reduction and only the eligible skill families.
test('Sinister Shroud tooltip and recharge handling share the selected profile', () => {
  const profession = withPatchPreview(necromancerProfession, {
    id: 'sinister-tooltip',
    label: 'Sinister tooltip',
    professions: {
      necromancer: { balanceProfiles: { [TRAIT.SINISTER_SHROUD]: { fields: { rechargeMultiplier: 0.7 } } } }
    }
  });
  for (const [patchId, detail, duration] of [
    [undefined, '+15%', 17],
    ['sinister-tooltip', '+30%', 14]
  ]) {
    const context = profession.balanceContextFor(patchId);
    const trait = context.catalog.traits.find((entity) => entity.id === TRAIT.SINISTER_SHROUD);
    const model = describeSimulationTrait(context, trait, necromancerTooltips);
    assert.equal(model.facts.find((fact) => fact.name === 'Shroud and shade recharge reduction').detail, detail);
    const recharge = (skill, selectedTraitIds = [TRAIT.SINISTER_SHROUD]) =>
      necromancerCoreCastRules.modifyRechargeDuration({ catalog: context.catalog, skill, selectedTraitIds }, 20);
    assert.equal(recharge({ shroud: true }), duration);
    assert.equal(recharge({ handlerId: 'necromancer.shade' }), duration);
    assert.equal(recharge({}), 20);
    assert.equal(recharge({ shroud: true }, []), 20);
  }
});

// Changing a selected declaration must update presentation and preview without a second numeric source.
test('selected balance context keeps trait tooltips and attribute bonuses on the same patch', () => {
  const profession = withPatchPreview(necromancerProfession, {
    id: 'tooltip-check',
    label: 'Tooltip check',
    professions: {
      necromancer: {
        modifierRules: {
          'necromancer.septic-corruption-blight': { parameters: { damagePerStack: 0.005 } }
        },
        balanceProfiles: {
          [TRAIT.DEATH_PERCEPTION]: { fields: { criticalChance: 0.2 } },
          2185: { conditions: { Poisoned: { stacks: 2, duration: 4 } } }
        }
      }
    }
  });
  const live = profession.balanceContextFor();
  const preview = profession.balanceContextFor('tooltip-check');
  const find = (id) => preview.catalog.traits.find((trait) => trait.id === id);
  const death = describeSimulationTrait(preview, find(893), necromancerTooltips);
  assert.equal(death.facts.find((fact) => fact.name === 'Critical chance').detail, '+20%');
  const septic = describeSimulationTrait(preview, find(2185), necromancerTooltips);
  assert.equal(septic.facts.find((fact) => fact.name === 'Condition damage per blight').detail, '+0.5%');
  assert.match(septic.facts.find((fact) => fact.name === 'Poisoned').detail, /4s/);
  assert.equal(septic.facts.find((fact) => fact.name === 'Poisoned').stacks, 2);
  assert.equal(live.catalog.balanceProfilesById.get(TRAIT.DEATH_PERCEPTION).criticalChance, 0.15);
  assert.equal(profession.balanceContextFor('tooltip-check'), preview);
  assert.throws(() => profession.balanceContextFor('missing'), /Unknown/);

  const build = createNecromancerBuildDefaults();
  build.specializations = [{ name: 'Soul Reaping', traits: '1-1-2' }];
  const calculate = createCalculateAttributes(applyNecromancerBuildAttributeRules);
  const attributes = calculate(build, [], 1, null, null, preview);
  assert.equal(attributes.attributes['Critical Chance'].traits, 20);
});

// Payload formatting keeps sequential applications and distinct recipients instead of inventing aggregate stacks.
test('effect facts preserve repeated packets, semantic icons and recipient context', () => {
  const model = simulationEffectFacts([
    {
      type: 'strike',
      ticks: [
        { atMs: 0, coefficient: 0.2 },
        { atMs: 100, coefficient: 0.3 }
      ]
    },
    {
      type: 'condition',
      ticks: [
        { atMs: 0, condition: 'Burning', stacks: 2, duration: 3 },
        { atMs: 100, condition: 'Burning', stacks: 2, duration: 3 }
      ]
    },
    { type: 'boon', boon: 'might', stacks: 3, duration: 6, audience: { recipients: 'self' } },
    { type: 'boon', boon: 'might', stacks: 1, duration: 6, audience: { recipients: 'party', affectsSelf: false } }
  ]);
  assert.equal(model.incomplete, false);
  assert.match(model.facts[0].detail, /0.5 coefficient total · 2 hits/);
  assert.ok(model.facts[0].icon);
  const burning = model.facts.find((fact) => fact.name === 'Burning');
  assert.equal(burning.applications, 2);
  assert.equal(burning.detail, '3s');
  assert.equal(burning.stacks, 2);
  assert.ok(burning.icon);
  assert.equal(model.facts.filter((fact) => fact.name === 'Might').length, 2);
  assert.ok(model.facts.filter((fact) => fact.name === 'Might').every((fact) => fact.icon));
  const recipients = simulationEffectFacts([
    { type: 'boon', boon: 'Fury', duration: 3, audience: { recipients: 'summons' } },
    { type: 'boon', boon: 'Fury', duration: 3, actorType: 'summon', audience: { recipients: 'self' } },
    { type: 'buff', kind: 'toughness', stacks: 300, duration: 5 }
  ]);
  assert.match(recipients.facts[0].detail, /you and your companions/);
  assert.match(recipients.facts[1].detail, /on the companion/);
  assert.match(recipients.facts[2].detail, /\+300 points/);
  assert.equal(recipients.facts[2].stacks, undefined);
  const distinct = simulationEffectFacts([
    { type: 'boon', boon: 'might', stacks: 1, duration: 6 },
    { type: 'boon', boon: 'might', stacks: 3, duration: 6 }
  ]);
  assert.deepEqual(
    distinct.facts.map((fact) => fact.stacks),
    [1, 3]
  );
});

// Boon stack labels describe intensity only, including boons authored as generic buffs.
test('boon tooltip stack counts appear only for Might and Stability', () => {
  for (const type of ['boon', 'buff']) {
    for (const [boon, stacks, badge] of [
      ['Quickness', 1, undefined],
      ['fury', 1, undefined],
      ['Aegis', 1, undefined],
      ['Might', 3, 3],
      ['stability', 1, 1]
    ]) {
      const model = simulationEffectFacts([
        { type, [type === 'boon' ? 'boon' : 'kind']: boon, stacks, duration: 4, audience: { recipients: 'party' } }
      ]);
      assert.equal(model.facts[0].detail, '4s — party');
      assert.equal(model.facts[0].stacks, badge);
    }
  }
});

// Bad references cannot masquerade as zero bonuses, and external metadata has no path into generated facts.
test('tooltip construction rejects missing inputs and ignores external fact strings', () => {
  assert.notEqual(tooltipDecimal(0.0000064), '0');
  const context = withPatchPreview(necromancerProfession, null).balanceContextFor();
  const skill = {
    id: 'example',
    name: 'Example',
    description: 'Incorrect reference text',
    tooltipFacts: [{ name: 'Damage', detail: '999%' }],
    effects: [{ type: 'condition', condition: 'Torment', stacks: 1, duration: 3 }]
  };
  const model = describeSimulationSkill(context, skill, necromancerTooltips);
  assert.ok(!JSON.stringify(model).includes('999'));
  assert.ok(!model.description.includes('Incorrect'));
  assert.throws(() => tooltipNumber({ amount: () => 1 }, 'amount'), /Invalid tooltip number/);
  assert.throws(() => tooltipNumber({ amount: null }, 'amount'), /Invalid tooltip number/);
  assert.equal(tooltipNumber({ amount: 0 }, 'amount'), 0);
  assert.throws(
    () => describeSimulationTrait(context, { id: 'missing', name: 'Missing' }, necromancerTooltips),
    /Missing trait tooltip/
  );
});

// Handler-owned damage and self-conditions must consume the same patched packets displayed by their tooltips.
test('Necromancer condition handlers and tooltips share selected skill and profile effects', () => {
  const profession = withPatchPreview(necromancerProfession, {
    id: 'condition-tooltips',
    label: 'Condition tooltips',
    professions: {
      necromancer: {
        skills: {
          51647: {
            fields: { lifeForcePerCondition: 2 },
            effects: [
              { type: 'strike', coefficient: 2 },
              { type: 'condition', condition: 'Torment', stacks: 2, duration: 7 }
            ]
          }
        },
        balanceProfiles: {
          'necromancer.core.blood-is-power-corruption': {
            effects: [{ type: 'condition', condition: 'Bleeding', stacks: 3, duration: 9 }]
          }
        }
      }
    }
  });
  const context = profession.balanceContextFor('condition-tooltips');
  const describe = (id) => describeSimulationSkill(context, context.catalog.skillsById.get(id), necromancerTooltips);
  assert.match(describe(51647).facts.find((fact) => fact.name === 'Strike damage').detail, /^2 coefficient/);
  assert.match(describe(51647).facts.find((fact) => fact.name === 'Torment').detail, /7s.*per distinct/);
  assert.equal(describe(51647).facts.find((fact) => fact.name === 'Torment').stacks, 2);
  assert.equal(describe(51647).facts.find((fact) => fact.name === 'Life force per condition').detail, '2% life force');
  const threshold = describe(51647).facts.find((fact) => fact.name === 'Condition Threshold');
  assert.equal(threshold.detail, '5');
  assert.equal(
    threshold.icon,
    'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png'
  );
  assert.ok(
    describe(10544).facts.some(
      (fact) => fact.name === 'Bleeding' && fact.stacks === 3 && /9s.*on yourself/.test(fact.detail)
    )
  );
  const simulate = createProfessionSimulator(profession, {
    stats: { power: 2000, precision: 1000, conditionDamage: 1000, vitality: 1000 },
    target: { armor: 2597, conditions: { Chilled: true } }
  });
  const darkness = simulate('Core', ['Devouring Darkness'], {
    patchId: 'condition-tooltips',
    primaryWeapon: 'Scepter',
    initialResource: 0,
    selectedTraitIds: [801]
  });
  assert.deepEqual(darkness.warnings, []);
  assert.equal(
    darkness.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === 51647).coefficient,
    2
  );
  const torment = darkness.resolvedEvents.find((event) => event.type === 'condition' && event.skillId === 51647);
  assert.equal(torment.stacks, 2);
  assert.equal(torment.duration, 7);
  // Completion counts both the existing Chilled and the newly applied Torment, using the patched gain.
  assert.equal(darkness.planningState.profession.lifeForce, 12);
  const corruption = simulate('Core', ['Blood Is Power'], {
    patchId: 'condition-tooltips',
    selectedSkills: ['Blood Is Power']
  });
  assert.deepEqual(corruption.warnings, []);
  const selfBleed = corruption.events.find((event) => event.type === 'self_condition' && event.skillId === 10544);
  assert.equal(selfBleed.stacks, 3);
  assert.equal(selfBleed.duration, 9);
});

// Transfer limits are shared by every handler-owned tooltip and the selected combat skill.
test('condition-transfer tooltips expose the same limits used by combat', () => {
  const profession = withPatchPreview(necromancerProfession, {
    id: 'transfer-tooltip',
    label: 'Transfer tooltip',
    professions: {
      necromancer: { skills: { [ID.PLAGUE_SIGNET]: { fields: { conditionsTransferred: 1 } } } }
    }
  });
  for (const [id, count] of [
    [ID.DEATHLY_SWARM, 2],
    [ID.PLAGUE_SIGNET, 5],
    [ID.PUTRID_MARK, 3],
    [ID.SUFFER, 2]
  ]) {
    const context = profession.balanceContextFor();
    const model = describeSimulationSkill(context, context.catalog.skillsById.get(id), necromancerTooltips);
    const fact = model.facts.find((entry) => entry.name === 'Conditions Transferred');
    assert.equal(fact.detail, String(count));
    assert.equal(fact.icon, 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png');
  }

  const context = profession.balanceContextFor('transfer-tooltip');
  const model = describeSimulationSkill(context, context.catalog.skillsById.get(ID.PLAGUE_SIGNET), necromancerTooltips);
  assert.equal(model.facts.find((entry) => entry.name === 'Conditions Transferred').detail, '1');
  const simulate = createProfessionSimulator(profession, {
    stats: { power: 2000, precision: 1000, conditionDamage: 1000, vitality: 1000 },
    target: { armor: 2597 }
  });
  const result = simulate('Core', ['Blood Is Power', 'Plague Signet'], {
    patchId: 'transfer-tooltip',
    selectedSkills: ['Blood Is Power', 'Plague Signet'],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    [...new Set(result.resolvedEvents.filter((event) => event.transferredCondition).map((event) => event.condition))],
    ['Bleeding']
  );
  assert.ok(result.planningState.profession.selfConditions.some((condition) => condition.condition === 'Torment'));
});

// The selected proc profile must drive both displayed and emitted condition stacks.
test('Soulbeast condition triggers preserve the same patched stack count shown in tooltips', async () => {
  const { rangerProfession } = await import('#gw2/professions/ranger/profession.js');
  const { rangerTooltips } = await import('#gw2/professions/ranger/app/tooltips.js');
  const profession = withPatchPreview(rangerProfession, {
    id: 'stance-tooltip',
    label: 'Stance tooltip',
    professions: {
      ranger: {
        balanceProfiles: {
          'ranger.soulbeast.vulture-stance': { conditions: { Poisoned: { stacks: 3, duration: 6 } } }
        }
      }
    }
  });
  const context = profession.balanceContextFor('stance-tooltip');
  const tooltip = describeSimulationSkill(context, context.catalog.skillsById.get(40498), rangerTooltips);
  assert.match(tooltip.facts.find((fact) => fact.name === 'Poisoned').detail, /6s.*per trigger/);
  assert.equal(tooltip.facts.find((fact) => fact.name === 'Poisoned').stacks, 3);
  const simulate = createProfessionSimulator(profession, {
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597 }
  });
  const result = simulate('Soulbeast', ['Vulture Stance', 'Maul'], {
    patchId: 'stance-tooltip',
    primaryWeapon: 'Greatsword',
    selectedSkills: ['Vulture Stance']
  });
  assert.deepEqual(result.warnings, []);
  const poison = result.resolvedEvents.find((event) => event.type === 'condition' && event.skillId === 40498);
  assert.equal(poison?.stacks, 3);
  assert.equal(poison.duration, 6);
});

// Complete profession coverage includes handler-owned actions, not only skills with direct effect arrays.
test('completed profession skill declarations cover ordinary and handler-driven actions', async () => {
  for (const name of [
    'necromancer',
    'warrior',
    'guardian',
    'elementalist',
    'ranger',
    'mesmer',
    'revenant',
    'thief',
    'engineer'
  ]) {
    const { [`${name}Profession`]: profession } = await import(`#gw2/professions/${name}/profession.js`);
    const { [`${name}Tooltips`]: presentation } = await import(`#gw2/professions/${name}/app/tooltips.js`);
    const context = withPatchPreview(profession, null).balanceContextFor();
    for (const skill of context.catalog.skills) {
      const tooltip = describeSimulationSkill(context, skill, presentation);
      assert.ok(tooltip.description, skill.name);
      assert.ok(!tooltip.incomplete, skill.name);
      assert.doesNotMatch(JSON.stringify(tooltip), /NaN|Infinity|undefined/, skill.name);
    }
  }
});

// Extracted spear tuning must update the displayed variant and the resolver's emitted packet together.
test('Engineer spear resolver and tooltip use the same selected packet profile', async () => {
  const { engineerProfession } = await import('#gw2/professions/engineer/profession.js');
  const { engineerTooltips } = await import('#gw2/professions/engineer/app/tooltips.js');
  const { handleElectricArtillery } = await import('#gw2/professions/engineer/core/mechanics/event-handlers.js');
  const profession = withPatchPreview(engineerProfession, {
    id: 'spear-tooltip',
    label: 'Spear tooltip',
    professions: {
      engineer: {
        balanceProfiles: {
          'engineer.core.focused-electric-artillery': {
            coefficient: 2,
            conditions: { Burning: { stacks: 3, duration: 5 } }
          }
        }
      }
    }
  });
  const selected = profession.balanceContextFor('spear-tooltip');
  const skill = selected.catalog.skillsByName.get('Electric Artillery');
  const model = describeSimulationSkill(selected, skill, engineerTooltips);
  assert.ok(
    model.facts.some((fact) => fact.name === 'Strike damage' && /2 coefficient.*while Focused/.test(fact.detail))
  );
  assert.ok(
    model.facts.some((fact) => fact.name === 'Burning' && fact.stacks === 3 && /5s.*while Focused/.test(fact.detail))
  );
  const packets = [];
  handleElectricArtillery(
    {
      catalog: selected.catalog,
      profession: { core: { focusedUntil: 20 } },
      queue: {
        enqueue: (event) => {
          packets.push(event);
          return event;
        }
      },
      applyCondition: (event) => packets.push(event)
    },
    { at: 10, skillId: skill.id, skillName: skill.name, charges: 2 }
  );
  assert.ok(packets.some((packet) => packet.coefficient === 2));
  // Burning resolves as separate single-stack applications whose total matches the selected profile.
  const burning = packets.filter((packet) => packet.condition === 'Burning');
  assert.equal(
    burning.reduce((total, packet) => total + packet.stacks, 0),
    3
  );
  assert.ok(burning.every((packet) => packet.duration === 6));
});

// Selected strain packets must agree across tooltips, both activation routes, and the mechanic's lifetime.
test('Amalgam strain tooltips and activation use the same patched Stability packet', async () => {
  const { engineerProfession } = await import('#gw2/professions/engineer/profession.js');
  const { engineerTooltips } = await import('#gw2/professions/engineer/app/tooltips.js');
  const { ENGINEER_SKILL_IDS: skills, ENGINEER_TRAIT_IDS: traits } =
    await import('#gw2/professions/engineer/data/ids.js');
  const profession = withPatchPreview(engineerProfession, {
    id: 'strain-tooltip',
    label: 'Strain tooltip',
    professions: {
      engineer: {
        balanceProfiles: {
          'engineer.amalgam.strains': {
            effects: [{ type: 'boon', name: 'Berserker Strain', stacks: 3, duration: 4 }]
          }
        }
      }
    }
  });
  const simulate = createProfessionSimulator(profession, {
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597 }
  });
  for (const [patchId, stacks, duration] of [
    ['current', 5, 8],
    ['strain-tooltip', 3, 4]
  ]) {
    const context = profession.balanceContextFor(patchId);
    for (const [skillId, selectedTraitIds] of [
      [skills.EVOLVE_BASE, []],
      [skills.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954, [traits.SILVER_LINING]]
    ]) {
      const model = describeSimulationSkill(context, context.catalog.skillsById.get(skillId), engineerTooltips);
      const fact = model.facts.find((fact) => fact.name === 'Stability' && fact.detail.includes('Berserker Strain'));
      assert.equal(fact?.stacks, stacks);
      assert.ok(fact.detail.startsWith(`${duration}s`));
      const result = simulate('Amalgam', [skillId], {
        patchId,
        selectedMorphSkillIds: [77103, 77203, skills.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954],
        selectedTraitIds
      });
      assert.deepEqual(result.warnings, []);
      const buff = result.events.find((event) => event.type === 'buff' && event.skillName === 'Berserker Strain');
      assert.equal(buff?.stacks, stacks);
      assert.equal(buff.duration, duration);
      assert.equal(result.planningState.profession.berserkerUntil, buff.at + duration);
    }
  }
});

// Every registered trait must resolve real declarations, including traits backed by separately named profiles.
test('profession trait declarations resolve without missing references or invalid numeric facts', async () => {
  for (const name of [
    'necromancer',
    'warrior',
    'guardian',
    'engineer',
    'revenant',
    'thief',
    'mesmer',
    'ranger',
    'elementalist'
  ]) {
    const { default: source } = await import(`#gw2/professions/${name}/profession.js`);
    const declarations = (await import(`#gw2/professions/${name}/app/tooltips.js`))[`${name}Tooltips`];
    const context = withPatchPreview(source, null).balanceContextFor();
    for (const entity of context.catalog.traits) {
      const model = describeSimulationTrait(context, entity, declarations);
      assert.ok(model.description, `${name}: ${entity.name}`);
      assert.ok(!model.incomplete, `${name}: ${entity.name}`);
      assert.doesNotMatch(JSON.stringify(model), /NaN|undefined|Infinity/, `${name}: ${entity.name}`);
    }
  }
});

// Profile packets may be alternatives or per-hit inputs; local adapters must preserve those engine contracts.
test('handler-owned profiles retain per-hit coefficients and alternative conditions', async () => {
  const { default: engineer } = await import('#gw2/professions/engineer/profession.js');
  const { engineerTooltips } = await import('#gw2/professions/engineer/app/tooltips.js');
  const engineerContext = withPatchPreview(engineer, null).balanceContextFor();
  const grenadier = describeSimulationTrait(engineerContext, { id: 514, name: 'Grenadier' }, engineerTooltips);
  assert.match(grenadier.facts.find((fact) => fact.name === 'Strike damage').detail, /3 coefficient total · 6 hits/);

  const { default: warrior } = await import('#gw2/professions/warrior/profession.js');
  const { warriorTooltips } = await import('#gw2/professions/warrior/app/tooltips.js');
  const warriorContext = withPatchPreview(warrior, null).balanceContextFor();
  const sundering = describeSimulationTrait(warriorContext, { id: 1316, name: 'Sundering Burst' }, warriorTooltips);
  assert.equal(sundering.facts.find((fact) => fact.detail.includes('noncritical')).stacks, 5);
  assert.equal(sundering.facts.find((fact) => /— critical hit/.test(fact.detail)).stacks, 10);

  const variants = simulationEffectFacts([
    {
      type: 'strike',
      coefficient: 1,
      coefficientModifiers: [
        { kind: 'target-health-below', threshold: 0.25, multiplier: 2 },
        { kind: 'target-health-below', threshold: 0.5, multiplier: 1.5 }
      ]
    },
    {
      type: 'buff',
      kind: 'nightmare-weapon',
      stacks: 5,
      allyStacks: 3,
      duration: 10,
      audience: { recipients: 'party' }
    }
  ]);
  assert.match(variants.facts[1].detail, /2× below 25% target health; lowest matching threshold applies/);
  assert.match(variants.facts.at(-1).detail, /5 on yourself · 3 on each ally/);
  assert.equal(variants.facts.at(-1).stacks, 5);
});
