import { renderSkills } from '#gw2/app/build/panels/skills.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import {
  displayedSkillTiles,
  paletteSkillView,
  paletteView,
  rotationSelectedSlotSkills,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { loadProfessionAppAdapter } from '#gw2/profession-registry.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { applyRevenantBuildAttributeRules } from '#gw2/professions/revenant/build/attributes.js';
import { createRevenantBuildDefaults } from '#gw2/professions/revenant/build/build.js';
import { revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS,
  REVENANT_SKILL_IDS as SKILL
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_SUPPLEMENTAL_SKILLS } from '#gw2/professions/revenant/data/revenant-supplemental-skills.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Attribute assertions use the same calculator composed into the Revenant adapter.
const calculateRevenantAttributes = createCalculateAttributes(
  applyRevenantBuildAttributeRules,
  revenantProfession.traitBuildAttributes
);

const baseConfig = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: { armor: 2597, conditions: { Vulnerability: 25 } }
});

const applyRevenantPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(revenantCatalog, patch), patch);

const simulate = createObservedProfessionSimulator(revenantProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

const strikeCoefficient = (effect) =>
  effect.ticks?.reduce((total, tick) => total + Number(tick.coefficient), 0) ?? Number(effect.coefficient);

const authoringRevenantProfession = withActivePatchPreview(revenantProfession);

// Supplemental identities must not shadow the mechanics consumed by the runtime.
test('Revenant supplemental identities leave simulation mechanics to their owners', () => {
  assert.ok(
    REVENANT_SUPPLEMENTAL_SKILLS.every((skill) =>
      ['effects', 'cooldown', 'recharge', 'simulatorExcluded', 'flags'].every((field) => !Object.hasOwn(skill, field))
    )
  );
});

test('modifier contribution candidates include every active Revenant trait', () => {
  const build = createRevenantBuildDefaults();
  const app = {
    build,
    attributeData: calculateRevenantAttributes(build, []),
    attributeWeaponSet: 1,
    skillByName: revenantCatalog.skillsByName
  };
  const activeTraitNames = app.attributeData.activeTraits.map((trait) => trait.name).sort();
  const candidateNames = revenantAppAdapter
    .modifierContributionRequest(app)
    .comparisons.map(({ modifier }) => modifier)
    .filter((candidate) => candidate.type === 'Trait')
    .map((candidate) => candidate.name)
    .sort();

  assert.deepEqual(candidateNames, activeTraitNames);
});

test('Core Revenant mechanics expose patch-authorable declarations', () => {
  const core = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Core');
  const skill = (id) => core.skills.find((entry) => entry.id === id);
  const profile = (id) => core.balanceProfiles.find((entry) => entry.id === id);
  const resources = profile(REVENANT_CORE_BALANCE_PROFILE_IDS.resources);
  const chargedMists = profile(REVENANT_TRAIT_IDS.CHARGED_MISTS);
  const battleScars = profile(REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);

  assert.equal(skill(SHARED_SKILL_IDS.DODGE).patchableFields.resourceCost, 50);
  assert.equal(skill(SKILL.SWAP_LEGENDS).patchableFields.resourceGain, 50);
  assert.equal(skill(SKILL.ANCIENT_ECHO).patchableFields.resourceGain, 25);
  assert.deepEqual(resources.patchableFields, {
    energyRegenerationPerSecond: 5,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5
  });
  assert.deepEqual(chargedMists.patchableFields, {
    resourceGain: 75,
    threshold: 10
  });
  assert.equal(battleScars.profile.effects[1].flatStrikeBase, 117);
  assert.equal(
    skill(SKILL.ABYSSAL_RAZE).skill.effects.find((effect) => effect.type === 'strike').damageIncreasePerStack,
    0.33
  );

  const preview = applyRevenantPatch({
    skills: {
      [SHARED_SKILL_IDS.DODGE]: {
        fields: { resourceCost: { from: 50, to: 40 } }
      },
      [SKILL.ABYSSAL_RAZE]: {
        effects: [
          {
            effectIndex: 0,
            damageIncreasePerStack: { from: 0.33, to: 0.4 }
          }
        ]
      }
    },
    balanceProfiles: {
      [resources.id]: {
        fields: {
          energyRegenerationPerSecond: { from: 5, to: 6 }
        }
      }
    }
  });

  assert.equal(preview.skillsById.get(SHARED_SKILL_IDS.DODGE).resourceCost, 40);
  assert.equal(
    preview.skillsById.get(SKILL.ABYSSAL_RAZE).effects.find((effect) => effect.type === 'strike')
      .damageIncreasePerStack,
    0.4
  );
  assert.equal(preview.balanceProfilesById.get(resources.id).energyRegenerationPerSecond, 6);
});

test('Elemental Blast keeps packet timing runtime-only while exposing packet values', () => {
  const herald = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Herald');
  const elementalBlast = herald.skills.find((skill) => skill.id === SKILL.ELEMENTAL_BLAST).skill;
  const [, conditions] = elementalBlast.effects;

  assert.equal(elementalBlast.consume, true);
  assert.deepEqual(
    conditions.ticks.map((tick) => [tick.condition, tick.stacks, tick.duration]),
    [
      ['Weakness', 1, 5],
      ['Chilled', 1, 3],
      ['Burning', 2, 4]
    ]
  );
});

test('Herald facets expose recurring pulse fields to patch authoring', () => {
  const herald = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Herald');
  const strength = herald.skills.find((skill) => skill.id === SKILL.FACET_OF_STRENGTH);

  assert.deepEqual(
    Object.fromEntries(
      ['upkeepCost', 'upkeepPulse.duration', 'upkeepPulse.stacks', 'pulseInterval'].map((field) => [
        field,
        strength.patchableFields[field]
      ])
    ),
    {
      upkeepCost: 2,
      'upkeepPulse.duration': 12,
      'upkeepPulse.stacks': 1,
      pulseInterval: 3
    }
  );

  const preview = applyRevenantPatch({
    skills: {
      [SKILL.FACET_OF_STRENGTH]: {
        fields: {
          upkeepCost: { from: 2, to: 3 },
          'upkeepPulse.duration': { from: 12, to: 15 },
          'upkeepPulse.stacks': { from: 1, to: 2 },
          pulseInterval: { from: 3, to: 2 }
        }
      }
    }
  });
  const patchedStrength = preview.skillsById.get(SKILL.FACET_OF_STRENGTH);

  assert.equal(patchedStrength.upkeepCost, 3);
  assert.deepEqual(patchedStrength.upkeepPulse, {
    kind: 'might',
    duration: 15,
    stacks: 2
  });
  assert.equal(patchedStrength.pulseInterval, 2);
});

test('Herald invocation effects use patch-authorable skill declarations', () => {
  const herald = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Herald');
  const call = herald.skills.find((skill) => skill.id === SKILL.CALL_OF_THE_DRAGON);
  const spiritBoon = authoringRevenantProfession.patchAuthoring.modules
    .find((module) => module.id === 'Core')
    .balanceProfiles.find((profile) => profile.name === 'Spirit Boon (Dragon)');

  assert.deepEqual(
    call.skill.effects.map((effect) => [
      effect.type,
      effect.coefficient,
      effect.condition,
      effect.stacks,
      effect.duration
    ]),
    [
      ['strike', 0.75, undefined, undefined, undefined],
      ['condition', undefined, 'Burning', 2, 3],
      ['condition', undefined, 'Chilled', 1, 3]
    ]
  );
  assert.deepEqual(spiritBoon.profile.effects, [
    {
      type: 'boon',
      boon: 'protection',
      duration: 3,
      stacks: 1,
      actorType: 'player'
    }
  ]);

  const preview = applyRevenantPatch({
    skills: {
      [SKILL.CALL_OF_THE_DRAGON]: {
        effects: [
          {
            effectIndex: 0,
            coefficient: { from: 0.75, to: 1 }
          }
        ]
      }
    },
    balanceProfiles: {
      [spiritBoon.id]: {
        effects: [
          {
            effectIndex: 0,
            duration: { from: 3, to: 4 }
          }
        ]
      }
    }
  });

  assert.equal(preview.skillsById.get(SKILL.CALL_OF_THE_DRAGON).effects[0].coefficient, 1);
  assert.equal(preview.balanceProfilesById.get(spiritBoon.id).effects[0].duration, 4);
});

test('Renegade invocation effects use patch-authorable skill declarations', () => {
  const renegade = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Renegade');
  const call = renegade.skills.find((skill) => skill.id === SKILL.CALL_OF_THE_RENEGADE);
  const spiritBoon = authoringRevenantProfession.patchAuthoring.modules
    .find((module) => module.id === 'Core')
    .balanceProfiles.find((profile) => profile.name === 'Spirit Boon (Renegade)');

  assert.deepEqual(
    call.skill.effects.map((effect) => [
      effect.type,
      effect.coefficient,
      effect.condition,
      effect.stacks,
      effect.duration
    ]),
    [
      ['strike', 0.5, undefined, undefined, undefined],
      ['condition', undefined, 'Bleeding', 2, 8]
    ]
  );
  assert.deepEqual(spiritBoon.profile.effects, [
    {
      type: 'boon',
      boon: 'resolution',
      duration: 4,
      stacks: 1,
      actorType: 'player'
    }
  ]);

  const preview = applyRevenantPatch({
    skills: {
      [SKILL.CALL_OF_THE_RENEGADE]: {
        effects: [
          {
            effectIndex: 1,
            stacks: { from: 2, to: 3 }
          }
        ]
      }
    },
    balanceProfiles: {
      [spiritBoon.id]: {
        effects: [
          {
            effectIndex: 0,
            duration: { from: 4, to: 5 }
          }
        ]
      }
    }
  });

  assert.equal(preview.skillsById.get(SKILL.CALL_OF_THE_RENEGADE).effects[1].stacks, 3);
  assert.equal(preview.balanceProfilesById.get(spiritBoon.id).effects[0].duration, 5);
});

test('Renegade mechanics use authorable skills and modifier parameters', () => {
  const renegade = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Renegade');
  const skill = (id) => renegade.skills.find((entry) => entry.id === id);
  const named = (name) => renegade.skills.find((entry) => entry.name === name);
  const namedProfile = (name) =>
    [...renegade.balanceProfiles, ...renegade.skillVariants].find((entry) => entry.name === name);
  const enhancedIcerazor = skill(SKILL.ICERAZORS_IRE_ID_72359);
  const razorclaw = skill(SKILL.RAZORCLAWS_RAGE);
  const enhancedRazorclaw = skill(SKILL.RAZORCLAWS_RAGE_ID_72363);
  const heroic = skill(SKILL.HEROIC_COMMAND);
  const improvedHeroic = namedProfile('Heroic Command (Lasting Legacy)');
  const kallasFervor = namedProfile("Kalla's Fervor");
  const soulcleaveProc = named("Soulcleave's Summit — Triggered Attack");
  const allForOne = namedProfile('All for One');
  assert.equal(enhancedIcerazor.skill.simulatorExcluded, true);
  assert.deepEqual(
    razorclaw.skill.effects.find((effect) => effect.kind === 'razorclaws-rage'),
    {
      type: 'buff',
      kind: 'razorclaws-rage',
      duration: 5,
      stacks: 4,
      actorType: 'player',
      audience: { recipients: 'party' }
    }
  );
  assert.ok(
    enhancedRazorclaw.skill.effects.some(
      (effect) =>
        effect.type === 'condition' && effect.condition === 'Torment' && effect.stacks === 3 && effect.duration === 6
    )
  );
  assert.deepEqual(heroic.skill.effects[0], {
    name: 'might',
    type: 'boon',
    boon: 'might',
    duration: 8,
    stacks: 2,
    actorType: 'player'
  });
  assert.equal(improvedHeroic.profile.effects[0].stacks, 3);
  assert.deepEqual(
    [
      soulcleaveProc.skill.cooldown,
      soulcleaveProc.skill.effects[0].coefficient,
      soulcleaveProc.skill.effects[1].flatStrikeBase,
      soulcleaveProc.skill.effects[1].flatStrikePowerCoeff
    ],
    [1, 0.8, 325, 0.1]
  );
  assert.deepEqual(
    Object.fromEntries(
      ['resourceGain', 'rechargeMultiplier'].map((field) => [field, allForOne.patchableFields[field]])
    ),
    { resourceGain: 10, rechargeMultiplier: 0.5 }
  );
  assert.deepEqual(renegade.modifierRules.find((rule) => rule.id === 'revenant.kallas-fervor-strike').parameters, {
    damagePerStack: 0.02,
    improvedDamagePerStack: 0.05
  });
  assert.equal(
    renegade.balanceProfiles.find((entry) => entry.id === 'revenant.renegade.blood-fury').patchableFields
      .conditionDurationBonus,
    0.25
  );

  const preview = applyRevenantPatch({
    skills: {
      [SKILL.ICERAZORS_IRE_ID_72359]: {
        effects: [
          {
            effectIndex: 0,
            tickIndex: 0,
            coefficient: { from: 2, to: 2.5 }
          }
        ]
      },
      [SKILL.ORDERS_FROM_ABOVE]: {
        effects: [
          {
            effectIndex: 0,
            applications: { from: 4, to: 5 },
            intervalMs: { from: 1000, to: 750 }
          }
        ]
      },
      [soulcleaveProc.id]: {
        effects: [
          {
            effectIndex: 1,
            flatStrikeBase: { from: 325, to: 400 }
          }
        ]
      }
    },
    balanceProfiles: {
      [kallasFervor.id]: {
        fields: {
          maximumStacks: { from: 5, to: 6 }
        }
      }
    }
  });

  assert.equal(preview.skillsById.get(SKILL.ICERAZORS_IRE_ID_72359).effects[0].ticks[0].coefficient, 2.5);
  assert.deepEqual(
    [
      preview.skillsById.get(SKILL.ORDERS_FROM_ABOVE).effects[0].applications,
      preview.skillsById.get(SKILL.ORDERS_FROM_ABOVE).effects[0].intervalMs
    ],
    [5, 750]
  );
  assert.equal(preview.skillsById.get(soulcleaveProc.id).effects[1].flatStrikeBase, 400);
  assert.equal(preview.balanceProfilesById.get(kallasFervor.id).maximumStacks, 6);
});

test('legend palette shows only the destination legend with the shared swap cooldown', async () => {
  const context = {
    catalog: revenantCatalog,
    build: baseConfig,
    specialization: 'Core',
    professionState: {
      activeLegendId: LEGEND.ASSASSIN,
      activeLoadoutId: LEGEND.ASSASSIN,
      availableFlips: {}
    }
  };
  const group = revenantProfession.ui
    .paletteGroups(context)
    .find((candidate) => candidate.id === 'revenant-profession');

  assert.deepEqual(
    group.skillEntries.map((entry) => entry.paletteLegendId),
    [LEGEND.DEMON]
  );
  assert.ok(group.skillEntries.every((entry) => entry.skillId === -4 && entry.icon));
  assert.ok(group.skillEntries.every((entry) => !/Legendary|Stance/.test(entry.displayName)));
  const [destination] = group.skillEntries;

  assert.notEqual(revenantProfession.ui.paletteOverride(context, destination).available, false);
  const cooldownContext = {
    ...context,
    time: 1,
    cooldowns: { [SKILL.SWAP_LEGENDS]: { readyAt: 10000, remaining: 9000 } }
  };

  assert.equal(
    paletteSkillView(
      {
        adapter: revenantAppAdapter,
        results: {
          planningState: {
            availability: {},
            atSeconds: 1,
            ammoBySkillId: {},
            cooldowns: cooldownContext.cooldowns,
            profession: cooldownContext.professionState
          }
        }
      },
      revenantCatalog.skillsById.get(SKILL.SWAP_LEGENDS),
      true
    ).cooldownLabel,
    '9.000s'
  );
  const swappedGroup = revenantProfession.ui
    .paletteGroups({
      ...context,
      professionState: {
        ...context.professionState,
        activeLegendId: LEGEND.DEMON,
        activeLoadoutId: LEGEND.DEMON
      }
    })
    .find((candidate) => candidate.id === 'revenant-profession');

  assert.deepEqual(
    swappedGroup.skillEntries.map((entry) => entry.paletteLegendId),
    [LEGEND.ASSASSIN]
  );
  const loadout = revenantLegendLoadout.view(context);

  assert.equal(loadout.selectionControl, 'icons');
  assert.equal(loadout.formatActiveBar, false);
  assert.equal(loadout.selectors.length, 2);
  assert.ok(loadout.bars.every((bar) => bar.icon));
  assert.ok(loadout.bars.every((bar) => !/Legendary|Stance/.test(bar.compactLabel)));
  const legendGroups = revenantLegendLoadout.paletteGroups(context);

  assert.deepEqual(
    legendGroups.map((group) => group.label),
    ['Assassin', 'Demon']
  );
  assert.equal(legendGroups[0].resourceAnchor, true);
  assert.match(legendGroups[0].className, /compact-resource-palette/);
  assert.equal(legendGroups[1].resourceAnchor, false);
  assert.equal(legendGroups[1].className, 'revenant-legend-skills-inactive');
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.FACET_OF_ELEMENTS), [SKILL.ELEMENTAL_BLAST]);
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.FACET_OF_STRENGTH), [SKILL.BURST_OF_STRENGTH]);
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.CALL_TO_ANGUISH), [SKILL.UNYIELDING_IMPACT]);
  const rotationGroups = paletteView(revenantProfession, context);

  assert.deepEqual(
    rotationGroups.map((group) => group.id),
    ['revenant-profession']
  );
  assert.equal(revenantLegendLoadout.palettePlacement, 'after-actions');
  const rotationApp = {
    profession: revenantProfession,
    adapter: { slotLoadout: revenantLegendLoadout },
    build: context.build,
    skillByName: revenantCatalog.skillsByName
  };

  assert.deepEqual(rotationSelectedSlotSkills(rotationApp), []);

  const adapter = await loadProfessionAppAdapter('revenant');
  const canonicalBuild = createRevenantBuildDefaults();

  canonicalBuild.selectedLegends = [LEGEND.ASSASSIN, LEGEND.DEMON];
  canonicalBuild.startingLegend = LEGEND.ASSASSIN;
  const build = adapter.toApplicationBuild(canonicalBuild);

  build.rotation = ['__combat_start', 'Swap Legends'];
  const app = {
    build,
    adapter,
    profession: revenantProfession,
    activeCatalog: revenantCatalog,
    skills: revenantCatalog.skills,
    skillById: revenantCatalog.skillsById,
    skillByName: revenantCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: simulate('Core', build.rotation)
  };
  const palette = { innerHTML: '', querySelectorAll: () => [] };
  const skillBar = { innerHTML: '', classList: { remove() {} }, querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : id === 'skill-bar' ? skillBar : null)
  };
  try {
    renderSkills(app);
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(skillBar.innerHTML, /data-loadout-toggle/);
  assert.match(skillBar.innerHTML, /data-loadout-key="selectedLegends:[01]"/);
  assert.doesNotMatch(skillBar.innerHTML, /fixed-loadout-selector-label/);
  assert.doesNotMatch(skillBar.innerHTML, /skill-bar-key/);
  assert.doesNotMatch(skillBar.innerHTML, /skill-bar-type/);
  assert.equal((palette.innerHTML.match(/data-skill="Swap Legends"/g) || []).length, 1);
  assert.match(palette.innerHTML, /data-skill="Swap Legends"[\s\S]*?<span class="pal-cd">10\.000s<\/span>/);
});

test('Revenant utilities and Conduit resources render by their related skills', async () => {
  const adapter = await loadProfessionAppAdapter('revenant');
  const canonicalBuild = createRevenantBuildDefaults();

  canonicalBuild.specializations[2] = {
    name: 'Conduit',
    traits: '1-1-1'
  };
  canonicalBuild.selectedLegends = [LEGEND.ENTITY, LEGEND.ASSASSIN];
  canonicalBuild.startingLegend = LEGEND.ENTITY;
  const build = adapter.toApplicationBuild(canonicalBuild);
  const app = {
    build,
    adapter,
    profession: revenantProfession,
    activeCatalog: revenantCatalog,
    skills: revenantCatalog.skills,
    skillById: revenantCatalog.skillsById,
    skillByName: revenantCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: null
  };
  const palette = { innerHTML: '', querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  const html = palette.innerHTML;
  const profession = html.indexOf('revenant-f-skills');
  const affinityGroup = html.indexOf('profession-palette-resource-group resource-above');
  const state = html.indexOf('data-role="profession-resource-stack"');
  const combat = html.indexOf('data-role="weapon-palette-section"');
  const utility = html.indexOf('data-role="loadout-utility-palette-group"');
  const legends = html.indexOf('data-role="loadout-palette-stack"');
  const energy = html.indexOf('data-resource-id="energy"');
  const affinity = html.indexOf('data-resource-id="affinity"');
  const tools = html.indexOf('data-role="timeline-tools-palette-stack"');

  assert.ok(affinityGroup >= 0);
  assert.ok(affinity > affinityGroup);
  assert.ok(profession > affinity);
  assert.ok(profession >= 0);
  assert.ok(combat > profession);
  assert.ok(utility > combat);
  assert.ok(state > utility);
  assert.ok(legends > state);
  assert.ok(energy > legends);
  assert.ok(tools > energy);
  assert.equal(html.match(/data-resource-id="energy"/g)?.length, 1);
  assert.equal(html.match(/data-resource-id="affinity"/g)?.length, 1);
  assert.match(html, /compact-resource-palette revenant-legend-skills/);
  assert.match(html, /compact-profession-resource-revenant-energy/);
  assert.match(html, /<strong>50\/100<\/strong>/);
  const weaponSwap = html.indexOf('data-skill="Swap Weapons"');
  const weaponSwapGroup = html.lastIndexOf('<div class="pal-group', weaponSwap);

  assert.ok(weaponSwap >= 0);
  assert.match(html.slice(weaponSwapGroup, weaponSwap), /class="pal-label"[^>]*>W[12]<\/div>/);
  assert.match(html, /action-palette-group/);
  assert.match(html, /timeline-tools-palette-stack[\s\S]*__combat_start/);
  assert.match(html, /timeline-tools-palette-stack[\s\S]*__cooldown_reset/);
  assert.match(html, /timeline-tools-palette-stack[\s\S]*__wait/);
});

test('Swift Termination exposes the 50% target-health timeline marker', () => {
  assert.deepEqual(
    revenantProfession.ui.targetHealthThresholds({
      build: {
        specializations: [{ name: 'Devastation', traits: '1-1-2' }]
      }
    }),
    [0.5]
  );
  assert.deepEqual(
    revenantProfession.ui.targetHealthThresholds({
      build: {
        specializations: [{ name: 'Devastation', traits: '1-1-1' }]
      }
    }),
    []
  );
});

test('weapon swap changes the active Revenant weapon set', () => {
  const result = simulate('Core', ['Swap Weapons'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Mace',
    weaponSet2Secondary: 'Axe'
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.planningState.activeWeaponSet, 2);
  assert.ok(result.events.some((event) => event.type === 'weapon_set' && event.weaponSet === 2));
});

test('Revenant scepter follow-ups replace and restore weapon slots 2 and 3', () => {
  const app = {
    activeCatalog: revenantCatalog,
    skills: revenantCatalog.skills,
    skillById: revenantCatalog.skillsById,
    profession: revenantProfession,
    results: null
  };
  const paletteAfter = (rotation, names) => {
    app.results = simulate('Core', rotation, {
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    });

    return displayedSkillTiles(
      app,
      names.map((name) => revenantCatalog.skillsByName.get(name))
    ).map((skill) => skill.name);
  };

  assert.match(
    simulate('Core', ['Detonate Blossoming Aura'], {
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    }).warnings.join(' '),
    /use Blossoming Aura first/
  );
  assert.deepEqual(paletteAfter([], ['Blossoming Aura']), ['Blossoming Aura']);
  assert.deepEqual(paletteAfter(['Blossoming Aura'], ['Blossoming Aura']), ['Detonate Blossoming Aura']);
  assert.deepEqual(paletteAfter(['Blossoming Aura', 'Detonate Blossoming Aura'], ['Blossoming Aura']), [
    'Blossoming Aura'
  ]);
  assert.deepEqual(paletteAfter(['Otherworldly Bond'], ['Otherworldly Bond']), ['Deactivate Otherworldly Bond']);
  assert.deepEqual(paletteAfter(['Otherworldly Bond', 'Deactivate Otherworldly Bond'], ['Otherworldly Bond']), [
    'Otherworldly Bond'
  ]);
});

test('Temporal Rift preserves the Mace autoattack chain', () => {
  const result = simulate('Core', ['Misery Swipe', 'Temporal Rift', 'Anguish Swipe'], {
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Axe'
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Misery Swipe', 'Temporal Rift', 'Anguish Swipe']
  );
  assert.equal(result.planningState.profession.autoattackChains[SKILL.MISERY_SWIPE], SKILL.MANIFEST_TOXIN);
});

test('Temporal Rift preserves the Sword autoattack chain until its delayed hit', () => {
  const result = simulate('Core', ['Preparation Thrust', 'Temporal Rift', 'Brutal Blade'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Axe'
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Preparation Thrust', 'Temporal Rift', 'Brutal Blade']
  );
  assert.equal(result.planningState.profession.autoattackChains[SKILL.PREPARATION_THRUST], SKILL.RIFT_SLASH);
});

test('Beguiling Haze resets the Sword autoattack chain', () => {
  const result = simulate('Conduit', ['Preparation Thrust', 'Brutal Blade', 'Beguiling Haze', 'Preparation Thrust'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Preparation Thrust', 'Brutal Blade', 'Beguiling Haze', 'Preparation Thrust']
  );
  assert.equal(result.planningState.profession.autoattackChains[SKILL.PREPARATION_THRUST], SKILL.BRUTAL_BLADE);
});

test('Citadel Bombardment resets the Renegade autoattack chain', () => {
  const result = simulate(
    'Renegade',
    ['Preparation Thrust', 'Brutal Blade', 'Citadel Bombardment', 'Preparation Thrust'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword'
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Preparation Thrust', 'Brutal Blade', 'Citadel Bombardment', 'Preparation Thrust']
  );
  assert.equal(result.planningState.profession.autoattackChains[SKILL.PREPARATION_THRUST], SKILL.BRUTAL_BLADE);
});

test('Renegade shortbow skills expose coefficients, combos, and control', () => {
  const expectedSkills = [
    [SKILL.SHATTERSHOT, 0.65],
    [SKILL.BLOODBANE_PATH, 1.2],
    [SKILL.SEVENSHOT, 2.17],
    [SKILL.SPIRITCRUSH, 1.25],
    [SKILL.SCORCHRAZOR, 1]
  ];

  for (const [skillId, coefficient] of expectedSkills) {
    const skill = revenantCatalog.skillsById.get(skillId);
    const strike = skill.effects[0];
    const totalCoefficient = strike.coefficient ?? strike.ticks.reduce((sum, tick) => sum + tick.coefficient, 0);

    assert.ok(Math.abs(totalCoefficient - coefficient) < 1e-12);
  }

  for (const skillId of [SKILL.SHATTERSHOT, SKILL.SEVENSHOT]) {
    const skill = revenantCatalog.skillsById.get(skillId);

    assert.equal(skill.comboFinishers[0].ownerId, 'revenant');
    assert.equal(skill.comboFinishers[0].finisherType, 'Projectile');
    assert.equal(skill.comboFinishers[0].chance, 0.2);
  }

  const spiritcrush = revenantCatalog.skillsById.get(SKILL.SPIRITCRUSH);

  assert.equal(spiritcrush.comboFields[0].ownerId, 'revenant');
  assert.equal(spiritcrush.comboFields[0].fieldType, 'Fire');
  assert.equal(spiritcrush.comboFields[0].duration, 3);
  assert.equal(strikeCoefficient(spiritcrush.effects[1]), 0.75);

  const result = simulate(
    'Renegade',
    ['Shattershot', 'Bloodbane Path', 'Sevenshot', 'Spiritcrush', 'Scorchrazor'],
    {
      primaryWeapon: 'Shortbow',
      secondaryWeapon: '',
      initialEnergy: 100
    },
    observationTail(4000)
  );

  assert.equal(result.warnings.length, 0);
  assert.ok(
    result.events.some(
      (event) => event.type === 'control' && event.skillName === 'Scorchrazor' && event.controlKind === 'knockdown'
    )
  );
});

test('Bloodbane Path keeps Bleeding aligned with landed projectile packets', () => {
  const result = simulate(
    'Renegade',
    [{ type: 'cast', skillId: SKILL.BLOODBANE_PATH, interruptAfterMs: 750 }],
    {
      primaryWeapon: 'Shortbow',
      secondaryWeapon: '',
      initialEnergy: 100
    },
    observationTail(2000)
  );
  const packetTimes = (type) =>
    result.events
      .filter((event) => event.type === type && event.skillName === 'Bloodbane Path')
      .map((event) => event.at);

  assert.deepEqual(packetTimes('condition'), packetTimes('damage'));
  assert.equal(packetTimes('condition').length, 2);
});

// Repeated spear swings share one selectable action instead of adding a synthetic palette entry.
test('Abyssal Strike repeats without exposing a separate second-swing palette tile', () => {
  const result = simulate('Core', ['Abyssal Strike', 'Abyssal Strike', 'Abyssal Strike', 'Abyssal Strike'], {
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    boons: { quickness: true }
  });

  assert.equal(result.warnings.length, 0);

  assert.ok(
    result.events.filter((event) => event.type === 'damage').every((event) => event.skillName === 'Abyssal Strike')
  );

  const paletteApp = {
    profession: revenantProfession,
    activeCatalog: revenantCatalog,
    skills: revenantCatalog.skills,
    build: {
      weapons: ['Spear', ''],
      alternateWeapons: ['Sword', 'Sword']
    },
    adapter: {
      eliteSpecialization: () => 'Core',
      isSkillAvailable: (skill) => !skill.simulatorExcluded
    }
  };

  assert.deepEqual(
    weaponSkills(paletteApp)
      .filter((skill) => skill.slot === 'Weapon_1')
      .map((skill) => skill.name),
    ['Abyssal Strike']
  );
});

test('Searing Fissure enables Fire whirl combos only while its field is present', () => {
  const result = simulate('Core', ['Searing Fissure', { type: 'wait', durationMs: 3500 }], {
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Axe',
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);

  const combo = simulate('Conduit', ['Searing Fissure', 'Twin Moon Sweep'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Axe',
    initialEnergy: 100
  });

  assert.deepEqual(
    combo.resolvedEvents
      .filter(
        (event) =>
          event.type === 'combo' &&
          event.skillName === 'Twin Moon Sweep' &&
          event.fieldType === 'Fire' &&
          event.finisherType === 'Whirl'
      )
      .map((event) => [event.at, event.applicationCount, event.outcome.stacks, event.outcome.duration]),
    [[1.52, 2, 1, 1]]
  );

  const noField = simulate('Conduit', ['Twin Moon Sweep'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });

  assert.equal(
    noField.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === 'Twin Moon Sweep' &&
        event.fieldType === 'Fire' &&
        event.finisherType === 'Whirl'
    ).length,
    0
  );
});

test('Revenant spear packets reduce Abyssal Raze count recharge on hit', () => {
  const result = simulate(
    'Core',
    [
      'Abyssal Raze',
      'Abyssal Strike',
      'Abyssal Strike',
      'Abyssal Force',
      'Abyssal Blitz',
      'Abyssal Blot',
      { type: 'wait', durationMs: 2500 }
    ],
    {
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialEnergy: 100,
      boons: { quickness: true }
    }
  );

  assert.equal(result.warnings.length, 0);
  const damageOffsets = (skillName) => {
    const start = result.steps.find((step) => step.skill === skillName).start;

    return result.events
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .map((event) => Math.round(event.at * 1000 - start));
  };

  assert.deepEqual(damageOffsets('Abyssal Raze'), [560]);
  assert.deepEqual(damageOffsets('Abyssal Force'), [1160]);
  assert.deepEqual(damageOffsets('Abyssal Blitz'), [560, 720, 960]);
  assert.deepEqual(damageOffsets('Abyssal Blot'), [960, 1240, 1520, 1800, 2080]);
  const rechargeProcs = result.procSteps.filter((proc) => proc.skill.endsWith('Abyssal Raze recharge'));

  assert.deepEqual(
    rechargeProcs.map((proc) => proc.detail),
    ['0.8s', '0.8s', '2.4s', '4s', '0.96s']
  );
  assert.deepEqual(
    rechargeProcs.map((proc) => proc.cooldownReduction),
    [0.8, 0.8, 2.4, 4, 0.96]
  );
  assert.deepEqual(
    rechargeProcs.map((proc) => [proc.sourceSkill, proc.icon]),
    [SKILL.ABYSSAL_STRIKE, SKILL.ABYSSAL_STRIKE, SKILL.ABYSSAL_BLITZ, SKILL.ABYSSAL_FORCE, SKILL.ABYSSAL_BLOT].map(
      (skillId) => {
        const skill = revenantCatalog.skillsById.get(skillId);

        return [skill.name, skill.icon];
      }
    )
  );
  const ammo = observedRuntime(result).cooldownController.readAmmo(SKILL.ABYSSAL_RAZE);

  assert.equal(ammo.charges, 3);
  assert.equal(ammo.nextRechargeAt, null);

  const blitzMines = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Abyssal Blitz');

  assert.deepEqual(
    blitzMines.map((event) => event.coefficient),
    [0.5, 0.5, 0.5]
  );
  for (const condition of ['Slow', 'Chilled', 'Weakness']) {
    assert.ok(
      result.events.filter(
        (event) =>
          event.type === 'condition' &&
          event.skillName === 'Abyssal Blitz' &&
          event.condition === condition &&
          event.duration === 3
      ).length > 0
    );
  }

  assert.ok(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Abyssal Force' &&
        event.condition === 'Burning' &&
        event.duration === 8
    )
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Abyssal Force' &&
        event.condition === 'Chilled' &&
        event.duration === 2
    )
  );

  const blotHits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Abyssal Blot');
  assert.ok(blotHits.length > 0);
  assert.ok(blotHits.every((event) => event.coefficient === 0.4));
  assert.ok(
    result.events.filter(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Abyssal Blot' &&
        event.condition === 'Poisoned' &&
        event.duration === 6
    ).length > 0
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Abyssal Blot' &&
        event.condition === 'Chilled' &&
        event.duration === 2
    )
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'control' && event.skillName === 'Abyssal Blot' && event.controlKind === 'pull'
    )
  );
});

test('spear reductions advance base Raze recharge once per activation at its recharge rate', () => {
  // Test the proposed base-progress model with and without Alacrity, observing all delayed pulses.
  for (const alacrity of [false, true]) {
    for (const [skill, seconds] of [
      ['Abyssal Strike', 1],
      ['Abyssal Force', 5],
      ['Abyssal Blitz', 3],
      ['Abyssal Blot', 3]
    ]) {
      const result = simulate('Core', ['Abyssal Raze', skill, { type: 'wait', durationMs: 2500 }], {
        primaryWeapon: 'Spear',
        secondaryWeapon: '',
        initialEnergy: 100,
        boons: { alacrity }
      });
      const reductions = result.procSteps.filter((proc) => proc.skill.endsWith('Abyssal Raze recharge'));
      const rate = 1.25;
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(
        reductions.map((proc) => proc.cooldownReduction),
        [seconds / rate],
        skill
      );
      const expectedReadyAt = result.steps[0].end / 1000 + (15 - seconds) / rate;
      assert.ok(
        Math.abs(
          observedRuntime(result).cooldownController.readAmmo(SKILL.ABYSSAL_RAZE).nextRechargeAt - expectedReadyAt
        ) < 1e-9,
        skill
      );
    }
  }
});

test('Abyssal Raze blasts Abyssal Blot for Dark Aura without Leeching Bolts', () => {
  const result = simulate('Core', ['Abyssal Blot', 'Abyssal Raze'], {
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    initialEnergy: 100,
    boons: { quickness: true }
  });
  const combo = result.resolvedEvents.find(
    (event) => event.type === 'combo' && event.skillName === 'Abyssal Raze' && event.fieldType === 'Dark'
  );

  // Dark blasts grant Dark Aura; only dark whirl finishers own Leeching Bolts damage.
  assert.equal(combo?.finisherType, 'Blast');
  assert.equal(combo?.name, 'Dark Aura');
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'aura' && event.name === 'Dark Aura' && event.skillName === 'Abyssal Raze'
    )
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Leeching Bolts'),
    false
  );
  assert.equal(skillBreakdownRows(result).find((row) => row.name === 'Abyssal Raze')?.hits, 1);
});

test("Abyssal Strike reduces Raze's displayed cooldown with no charges", () => {
  const result = simulate(
    'Core',
    ['Abyssal Raze', 'Abyssal Raze', 'Abyssal Raze', { type: 'wait', durationMs: 7100 }, 'Abyssal Strike'],
    {
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialEnergy: 100
    }
  );

  assert.equal(result.warnings.length, 0);

  assert.equal(observedRuntime(result).cooldownController.readAmmo(SKILL.ABYSSAL_RAZE).nextRechargeAt, 11.8);
  assert.deepEqual(result.planningState.cooldowns[SKILL.ABYSSAL_RAZE], {
    readyAt: 11800,
    remaining: 780
  });
});

test('Abyssal Raze recharge reduction carries only excess work into the next queued charge', () => {
  const result = simulate(
    'Core',
    ['Abyssal Raze', 'Abyssal Raze', 'Abyssal Raze', { type: 'wait', durationMs: 8100 }, 'Abyssal Strike'],
    {
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialEnergy: 100
    }
  );

  const rechargeProc = result.procSteps.find((proc) => proc.skill.endsWith('Abyssal Raze recharge'));

  assert.equal(rechargeProc.cooldownReduction, 0.8);
  // Completing the front charge carries only the unused reduction into the next, leaving later work intact.
  const runtime = observedRuntime(result);
  const ammo = runtime.cooldownController.readAmmo(SKILL.ABYSSAL_RAZE);
  const casts = result.events.filter((event) => event.type === 'action' && event.skillId === SKILL.ABYSSAL_RAZE);
  const remainingWork = 15 - (rechargeProc.start / 1000 - casts[0].rechargeProgress.startedAt) * 1.25;
  const overflow = 1 - remainingWork;
  assert.equal(ammo.charges, 1);
  assert.equal(ammo.recharges.length, 2);
  assert.ok(overflow > 0 && overflow < 1);
  assert.ok(Math.abs(ammo.recharges[0].work - (15 - overflow)) < 1e-9);
  assert.equal(ammo.recharges[1].work, 15);
  assert.equal(result.planningState.cooldowns[SKILL.ABYSSAL_RAZE], undefined);
});

test('Crushing Abyss scales Raze and triggers at three stacks on weapon swap', () => {
  const result = simulate('Core', ['Abyssal Raze', 'Abyssal Raze', 'Abyssal Raze', 'Swap Weapons'], {
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    weaponSet2Primary: 'Sword',
    weaponSet2Secondary: 'Sword',
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.filter((step) => step.skill === 'Abyssal Raze').map((step) => step.start),
    [0, 1400, 2800]
  );
  const razes = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Abyssal Raze');

  assert.deepEqual(
    razes.map((event) => event.coefficient),
    [1, 1.33, 1.6600000000000001, 1]
  );
  assert.ok(
    result.events
      .filter(
        (event) => event.type === 'condition' && event.skillName === 'Abyssal Raze' && event.condition === 'Torment'
      )
      .every((event) => event.duration === 5)
  );
  assert.equal(razes.at(-1).triggeredBy, 'Swap Weapons');
  assert.equal(
    result.events.filter((event) => event.type === 'buff' && event.kind === 'crushing-abyss' && event.duration === 10)
      .length,
    3
  );
  const abyssalRaze = revenantCatalog.skillsById.get(SKILL.ABYSSAL_RAZE);
  const crushingAbyssEffect = abyssalRaze.effects.find(
    (effect) => effect.type === 'buff' && effect.kind === 'crushing-abyss'
  );

  assert.equal(crushingAbyssEffect.sourceId, 72962);
  assert.deepEqual(
    result.procSteps
      .filter((proc) => proc.skill === 'Crushing Abyss')
      .map((proc) => [proc.sourceSkill, proc.detail, proc.icon]),
    ['1/3 stacks', '2/3 stacks', '3/3 stacks'].map((detail) => ['Abyssal Raze', detail, abyssalRaze.icon])
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'condition' && event.name === 'Abyssal Raze — Crushing Abyss Torment')
      .map((event) => [event.stacks, event.duration]),
    [
      [2, 5],
      [4, 5],
      [6, 5]
    ]
  );
  assert.deepEqual(result.planningState.profession.crushingAbyss, []);
});
