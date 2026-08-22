import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfession, loadProfessionAppAdapter, professionRoute } from '../../../js/app/profession/registry.js';
import {
  currentAutoattackSkill,
  displayedFlipSkills,
  paletteActionSkills,
  paletteSkillIsInstant,
  rotationLoadoutPaletteGroups,
  rotationPaletteGroups,
  rotationSelectedSlotSkills,
  weaponSkills
} from '../../../js/app/rotation/palette-model.js';
import {
  paletteSkillView,
  renderPalette,
  resolvePaletteDropItem,
  suggestedPaletteInterruptMs
} from '../../../js/app/rotation/palette-view.js';
import { insertRotationItems } from '../../../js/app/rotation/actions.js';
import { simulationEventLogRows } from '../../../js/app/rotation/event-log.js';
import { simulateGw2 } from '../../../js/platform/gw2/simulate.js';
import { applyBalanceProfilePatch, applySkillPatch } from '../../../js/platform/gw2/skill-patch.js';
import { skillBreakdownRows } from '../../../js/platform/ui/result-tables.js';
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild
} from '../../../js/professions/revenant/build.js';
import { calculateAttributes as calculateRevenantAttributes } from '../../../js/professions/revenant/app/app-definition.js';
import { revenantCatalog } from '../../../js/professions/revenant/catalog.js';
import {
  VINDICATOR_DODGE_AUTO_ACTION,
  vindicatorDodgeAutoRotationEntries
} from '../../../js/professions/revenant/specializations/vindicator/ui.js';
import { DATA_SNAPSHOT } from '../../../js/professions/revenant/data/revenant-api-metadata.js';
import { REVENANT_SUPPLEMENTAL_SKILLS } from '../../../js/professions/revenant/data/revenant-supplemental-skills.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '../../../js/professions/revenant/data/ids.js';
import { REVENANT_TRAIT_COVERAGE } from '../../../js/professions/revenant/data/trait-coverage.js';
import {
  REVENANT_CORE_BALANCE_PROFILE_IDS,
  REVENANT_CORE_BASE_SKILL_MECHANICS
} from '../../../js/professions/revenant/core/skills.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '../../../js/professions/revenant/specializations/conduit/skills.js';
import { revenantProfession } from '../../../js/professions/revenant/definition.js';
import {
  legalRevenantLegendIds,
  REVENANT_CORE_LEGEND_IDS,
  REVENANT_ELITE_LEGEND_BY_SPECIALIZATION,
  REVENANT_RELEASE_POTENTIAL_BY_LEGEND
} from '../../../js/professions/revenant/legend-rules.js';
import { REVENANT_LEGENDS, revenantLegendLoadout } from '../../../js/professions/revenant/legend-loadout.js';

const revenantAttributeRules = Object.freeze({
  modifyAttributes(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyAttributes(context, value);
  },
  modifyCriticalChance(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyCriticalChance(context, value);
  },
  modifyStrikeDamage(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyStrikeDamage(context, value);
  },
  modifyConditionDamage(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyConditionDamage(context, value);
  },
  modifyConditionDuration(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyConditionDuration(context, value);
  }
});

const baseConfig = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  selectedDodge: 'Death Drop',
  allianceSide: 'luxon',
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

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: revenantProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    observationPolicy
  });
}

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

test('Revenant catalog pins API identity and explicit skill mechanics', () => {
  assert.equal(DATA_SNAPSHOT, '2026-07-28');
  assert.equal(revenantCatalog.specializations.length, 9);
  assert.equal(revenantCatalog.traits.length, 108);
  assert.ok(revenantCatalog.skills.length >= 209);
  assert.equal(REVENANT_LEGENDS.length, 8);
  assert.ok(REVENANT_LEGENDS.every((legend) => legend.skillIds.length === 5));
  assert.ok(REVENANT_LEGENDS.every((legend) => legend.icon));
  const jadeWinds = revenantCatalog.skillsById.get(28406);

  assert.equal(jadeWinds.energyCost, 35);
  assert.equal(jadeWinds.effects[0].coefficient, 3);
  assert.equal(revenantCatalog.skillsByName.has("Duelist's Preparation"), false);
  assert.equal(
    revenantCatalog.skills
      .filter((skill) => skill.weapon === 'Sword' && skill.slot === 'Weapon_4')
      .map((skill) => skill.name)
      .includes('Shackling Wave'),
    true
  );
  assert.equal(REVENANT_CORE_BASE_SKILL_MECHANICS[28406].castTimeMs, 1000);
  assert.equal(REVENANT_CORE_BASE_SKILL_MECHANICS[28406].effects[1].condition, 'Vulnerability');
  const echoingEruption = revenantCatalog.skillsById.get(SKILL.ECHOING_ERUPTION);

  assert.equal(echoingEruption.cooldown, 8);
  assert.equal(echoingEruption.ammo, 0);
  assert.equal(echoingEruption.ammoRecharge, 0);
  assert.equal(echoingEruption.comboFinishers[0].ownerId, 'revenant');
  assert.equal(echoingEruption.comboFinishers[0].finisherType, 'Blast');
  assert.deepEqual(
    echoingEruption.effects
      .filter((effect) => effect.type === 'strike')
      .map((effect) => [effect.coefficient, effect.hits]),
    [[1, 1]]
  );
  for (const [skillId, quicknessCastTimeMs] of [
    [SKILL.HEX_EATER_VORTEX, 526],
    [SKILL.FRIGID_BLITZ, 681],
    [SKILL.SEARING_FISSURE, 600],
    [SKILL.TEMPORAL_RIFT, 560],
    [SKILL.ECHOING_ERUPTION, 960],
    [SKILL.MISERY_SWIPE, 440],
    [SKILL.ANGUISH_SWIPE, 360],
    [SKILL.MANIFEST_TOXIN, 560],
    [SKILL.ABYSSAL_RAZE, 600],
    [SKILL.ABYSSAL_BLOT, 800],
    [SKILL.CALL_TO_ANGUISH, 820],
    [SKILL.RELEASE_POTENTIAL_MESMER, 440],
    [SKILL.EMBRACE_THE_DARKNESS, 440],
    [SKILL.BANISH_ENCHANTMENT, 440],
    [SKILL.UNYIELDING_IMPACT, 920],
    [SKILL.ABYSSAL_STRIKE, 520],
    [SKILL.ABYSSAL_BLITZ, 520],
    [SKILL.ABYSSAL_FORCE, 520],
    [SKILL.ELEMENTAL_BLAST, 480],
    [SKILL.BURST_OF_STRENGTH, 840],
    [SKILL.CHAOTIC_RELEASE, 600],
    [SKILL.TRUE_NATURE_ID_51696, 480]
  ]) {
    const skill = revenantCatalog.skillsById.get(skillId);

    assert.equal(skill.castTimeMs, quicknessCastTimeMs * 1.5, `${skill.name} base timing`);
    assert.equal(skill.quicknessCastTimeMs, quicknessCastTimeMs, `${skill.name} Quickness timing`);
  }

  const abyssalRaze = revenantCatalog.skillsById.get(SKILL.ABYSSAL_RAZE);

  assert.equal(abyssalRaze.ammo, 3);
  assert.equal(abyssalRaze.ammoRecharge, 15);
  assert.equal(revenantCatalog.skillsById.get(SKILL.ABYSSAL_BLITZ).cooldown, 10);
  const searingFissure = revenantCatalog.skillsById.get(SKILL.SEARING_FISSURE);

  assert.equal(searingFissure.comboFields[0].ownerId, 'revenant');
  assert.equal(searingFissure.comboFields[0].fieldType, 'Fire');
  assert.equal(searingFissure.comboFields[0].duration, 3);
  assert.deepEqual(
    searingFissure.effects
      .filter((effect) => effect.name === 'Pulsing Strikes')
      .map((effect) => [effect.coefficient, effect.hits, effect.intervalMs]),
    [[0.75, 3, 1000]]
  );
  const hammerBolt = revenantCatalog.skillsById.get(SKILL.HAMMER_BOLT);

  assert.equal(hammerBolt.effects[0].coefficient, 0.9);
  assert.equal(hammerBolt.effects[0].comboFinishers[0].finisherType, 'Projectile');
  assert.equal(hammerBolt.effects[0].comboFinishers[0].chance, 1);
  const coalescence = revenantCatalog.skillsById.get(SKILL.COALESCENCE_OF_RUIN);

  assert.equal(coalescence.cooldown, 4);
  assert.equal(coalescence.energyCost, 5);
  assert.equal(coalescence.effects[0].coefficient, 3.5);
  const phaseSmash = revenantCatalog.skillsById.get(SKILL.PHASE_SMASH);

  assert.equal(phaseSmash.cooldown, 8);
  assert.equal(phaseSmash.energyCost, 5);
  assert.equal(phaseSmash.effects[0].coefficient, 2.22);
  assert.equal(phaseSmash.effects[0].comboFinishers[0].finisherType, 'Blast');
  assert.equal(phaseSmash.effects[1].condition, 'Chilled');
  assert.equal(phaseSmash.effects[1].duration, 2);
  const fieldOfTheMists = revenantCatalog.skillsById.get(SKILL.FIELD_OF_THE_MISTS);

  assert.equal(fieldOfTheMists.cooldown, 12);
  assert.equal(fieldOfTheMists.energyCost, 10);
  assert.equal(fieldOfTheMists.effects[0].coefficient, 1.8);
  assert.equal(fieldOfTheMists.effects[1].boon, 'aegis');
  assert.equal(fieldOfTheMists.effects[1].duration, 2);
  assert.equal(fieldOfTheMists.comboFields[0].fieldType, 'Dark');
  assert.equal(fieldOfTheMists.comboFields[0].duration, 6);
  assert.equal(fieldOfTheMists.comboFields[0].startMs, 560);
  assert.equal(fieldOfTheMists.effects[0].comboFinishers[0].finisherType, 'Projectile');
  assert.equal(fieldOfTheMists.effects[0].comboFinishers[0].chance, 1);
  const dropTheHammer = revenantCatalog.skillsById.get(SKILL.DROP_THE_HAMMER);

  assert.equal(dropTheHammer.cooldown, 15);
  assert.equal(dropTheHammer.energyCost, 10);
  assert.equal(dropTheHammer.effects[0].coefficient, 3.2);
  assert.equal(dropTheHammer.effects[0].comboFinishers[0].finisherType, 'Blast');
  assert.equal(dropTheHammer.effects[1].metadata.duration, 3);
  const manifestToxin = revenantCatalog.skillsById.get(SKILL.MANIFEST_TOXIN);

  assert.deepEqual(
    manifestToxin.effects
      .filter((effect) => effect.type === 'strike')
      .map((effect) => [effect.coefficient, effect.hits]),
    [[0.6, 1]]
  );
  const twinMoonSweep = revenantCatalog.skillsById.get(SKILL.TWIN_MOON_SWEEP);

  assert.equal(twinMoonSweep.comboFinishers[0].ownerId, 'revenant');
  assert.equal(twinMoonSweep.comboFinishers[0].finisherType, 'Whirl');
  assert.equal(twinMoonSweep.comboFinishers[0].applications, 2);
  assert.equal(twinMoonSweep.comboFinishers[0].effectDelay, 0.04);
  assert.equal(revenantCatalog.skillsById.get(SKILL.ABYSSAL_FIRE).simulatorExcluded, true);
  assert.ok(
    REVENANT_SUPPLEMENTAL_SKILLS.every(
      (skill) =>
        !Object.hasOwn(skill, 'effects') &&
        !Object.hasOwn(skill, 'cooldown') &&
        !Object.hasOwn(skill, 'recharge') &&
        !Object.hasOwn(skill, 'simulatorExcluded') &&
        !Object.hasOwn(skill, 'flags')
    )
  );
  assert.match(revenantCatalog.skillsById.get(-5).icon, /\/Dodge\.png$/);
  assert.equal(SKILL.JADE_WINDS, 28406);
  assert.deepEqual(
    [...revenantCatalog.skillHandlers.keys()].sort(),
    [...new Set(revenantCatalog.skills.map((skill) => skill.handlerId).filter(Boolean))].sort()
  );
  assert.equal(revenantCatalog.skillsById.get(SKILL.SWAP_LEGENDS).resourceGain, 50);
  assert.equal(
    revenantCatalog.balanceProfilesById.get(REVENANT_CORE_BALANCE_PROFILE_IDS.resources).energyRegenerationPerSecond,
    5
  );
  assert.ok(
    revenantCatalog.skills.every(
      (skill) => !Object.hasOwn(skill, 'upkeepEffects') && !Object.hasOwn(skill, 'dodgeEffects')
    )
  );
  assert.deepEqual(
    Object.fromEntries(
      ['coefficient', 'hits'].map((field) => [
        field,
        revenantCatalog.skillsById.get(SKILL.DEATH_DROP).effects.find((effect) => effect.type === 'strike')[field]
      ])
    ),
    { coefficient: 3.3, hits: 1 }
  );
});

test('Core Revenant mechanics expose patch-authorable declarations', () => {
  const core = revenantProfession.patchAuthoring.modules.find((module) => module.id === 'Core');
  const skill = (id) => core.skills.find((entry) => entry.id === id);
  const profile = (id) => core.balanceProfiles.find((entry) => entry.id === id);
  const resources = profile(REVENANT_CORE_BALANCE_PROFILE_IDS.resources);
  const chargedMists = profile(REVENANT_CORE_BALANCE_PROFILE_IDS.chargedMists);
  const battleScars = profile(REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);

  assert.equal(skill(SKILL.DODGE).patchableFields.resourceCost, 50);
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
      [SKILL.DODGE]: {
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

  assert.equal(preview.skillsById.get(SKILL.DODGE).resourceCost, 40);
  assert.equal(
    preview.skillsById.get(SKILL.ABYSSAL_RAZE).effects.find((effect) => effect.type === 'strike')
      .damageIncreasePerStack,
    0.4
  );
  assert.equal(preview.balanceProfilesById.get(resources.id).energyRegenerationPerSecond, 6);
});

test('Elemental Blast exposes patch-authorable packet timelines', () => {
  const herald = revenantProfession.patchAuthoring.modules.find((module) => module.id === 'Herald');
  const elementalBlast = herald.skills.find((skill) => skill.id === SKILL.ELEMENTAL_BLAST).skill;
  const [strike, conditions] = elementalBlast.effects;

  assert.equal(elementalBlast.handlerId, 'revenant.facet-consume');
  assert.deepEqual(
    strike.ticks.map((tick) => [tick.atMs, tick.coefficient]),
    [
      [280, 1.5],
      [1280, 1.5],
      [2280, 1.5]
    ]
  );
  assert.deepEqual(
    conditions.ticks.map((tick) => [tick.atMs, tick.condition, tick.stacks, tick.duration]),
    [
      [280, 'Weakness', 1, 5],
      [1280, 'Chilled', 1, 3],
      [2280, 'Burning', 2, 4]
    ]
  );
});

test('Herald facets expose recurring pulse fields to patch authoring', () => {
  const herald = revenantProfession.patchAuthoring.modules.find((module) => module.id === 'Herald');
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

test('Beguiling Haze variants share the common cast timing fields', () => {
  const conduit = revenantProfession.patchAuthoring.modules.find((module) => module.id === 'Conduit');
  const profile = (id) => conduit.balanceProfiles.find((entry) => entry.id === id);
  const mainExtension = profile(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension);
  const followUp = profile(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp);

  assert.equal(mainExtension.patchableFields.castTimeMs, 400);
  assert.equal(mainExtension.patchableFields.quicknessCastMultiplier, 0.9);
  assert.equal(followUp.patchableFields.castTimeMs, 250);
  assert.equal(followUp.patchableFields.quicknessCastMultiplier, 0.96);
  assert.equal(Object.hasOwn(followUp.profile, 'mainCastExtensionMs'), false);
  assert.equal(Object.hasOwn(followUp.profile, 'mainQuicknessCastMultiplier'), false);

  const preview = applyRevenantPatch({
    balanceProfiles: {
      [CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension]: {
        fields: {
          castTimeMs: { from: 400, to: 450 },
          quicknessCastMultiplier: { from: 0.9, to: 0.85 }
        }
      },
      [CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp]: {
        fields: {
          castTimeMs: { from: 250, to: 200 },
          quicknessCastMultiplier: { from: 0.96, to: 0.9 }
        }
      }
    }
  });

  assert.equal(
    preview.balanceProfilesById.get(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension).castTimeMs,
    450
  );
  assert.equal(
    preview.balanceProfilesById.get(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp).quicknessCastMultiplier,
    0.9
  );
});

test('Herald invocation effects use patch-authorable skill declarations', () => {
  const herald = revenantProfession.patchAuthoring.modules.find((module) => module.id === 'Herald');
  const call = herald.skills.find((skill) => skill.id === SKILL.CALL_OF_THE_DRAGON);
  const spiritBoon = herald.balanceProfiles.find((profile) => profile.name === 'Spirit Boon (Dragon)');

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
  const renegade = revenantProfession.patchAuthoring.modules.find((module) => module.id === 'Renegade');
  const call = renegade.skills.find((skill) => skill.id === SKILL.CALL_OF_THE_RENEGADE);
  const spiritBoon = renegade.balanceProfiles.find((profile) => profile.name === 'Spirit Boon (Renegade)');

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
  const renegade = revenantProfession.patchAuthoring.modules.find((module) => module.id === 'Renegade');
  const skill = (id) => renegade.skills.find((entry) => entry.id === id);
  const named = (name) => renegade.skills.find((entry) => entry.name === name);
  const namedProfile = (name) => renegade.balanceProfiles.find((entry) => entry.name === name);
  const baseIcerazor = skill(SKILL.ICERAZORS_IRE);
  const enhancedIcerazor = skill(SKILL.ICERAZORS_IRE_ID_72359);
  const razorclaw = skill(SKILL.RAZORCLAWS_RAGE);
  const enhancedRazorclaw = skill(SKILL.RAZORCLAWS_RAGE_ID_72363);
  const bombardment = skill(SKILL.CITADEL_BOMBARDMENT);
  const heroic = skill(SKILL.HEROIC_COMMAND);
  const orders = skill(SKILL.ORDERS_FROM_ABOVE);
  const improvedHeroic = namedProfile('Heroic Command (Lasting Legacy)');
  const improvedOrders = namedProfile('Orders from Above (Righteous Rebel)');
  const kallasFervor = namedProfile("Kalla's Fervor");
  const soulcleaveProc = named("Soulcleave's Summit — Triggered Attack");
  const allForOne = namedProfile('All for One');

  assert.deepEqual(
    baseIcerazor.skill.effects[0].ticks.map((tick) => [tick.atMs, tick.coefficient]),
    [
      [500, 2],
      [661, 2],
      [822, 2]
    ]
  );
  assert.equal(enhancedIcerazor.skill.simulatorExcluded, true);
  assert.deepEqual(
    enhancedIcerazor.skill.effects[0].ticks.map((tick) => [tick.atMs, tick.coefficient]),
    [
      [1200, 2],
      [1361, 2],
      [1522, 2]
    ]
  );
  assert.deepEqual(
    razorclaw.skill.effects.find((effect) => effect.kind === 'razorclaws-rage'),
    {
      type: 'buff',
      kind: 'razorclaws-rage',
      duration: 5,
      durationScale: 'fixed',
      stacks: 4,
      actorType: 'player',
      recipients: 'party'
    }
  );
  assert.ok(
    enhancedRazorclaw.skill.effects.some(
      (effect) =>
        effect.type === 'condition' && effect.condition === 'Torment' && effect.stacks === 3 && effect.duration === 6
    )
  );
  assert.equal(bombardment.skill.effects[0].ticks.length, 10);
  assert.deepEqual(heroic.skill.effects[0], {
    type: 'boon',
    boon: 'might',
    duration: 8,
    stacks: 2,
    actorType: 'player'
  });
  assert.equal(improvedHeroic.profile.effects[0].stacks, 3);
  assert.deepEqual(
    [
      orders.skill.effects[0].applications,
      orders.skill.effects[0].intervalMs,
      improvedOrders.profile.effects[0].applications
    ],
    [4, 1000, 6]
  );
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
    renegade.modifierRules.find((rule) => rule.id === 'revenant.blood-fury-bleeding-duration').amount.value,
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

test('Revenant modules preserve the declarative authoring contract', async () => {
  const [ids, coreSkills, renegadeSkills, catalog, modules] = await Promise.all([
    readFile(new URL('../../../js/professions/revenant/data/ids.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../js/professions/revenant/core/skills.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../js/professions/revenant/specializations/renegade/skills.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../js/professions/revenant/catalog.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../js/professions/revenant/modules.ts', import.meta.url), 'utf8')
  ]);

  assert.doesNotMatch(ids, /^import\b/m);
  assert.match(ids, /REVENANT_SKILL_IDS = Object\.freeze/);
  assert.match(coreSkills, /REVENANT_CORE_BASE_SKILL_MECHANICS/);
  assert.match(coreSkills, /REVENANT_CORE_BALANCE_PROFILES/);
  assert.match(renegadeSkills, /RENEGADE_PROFILE_IDS/);
  assert.match(renegadeSkills, /RENEGADE_BALANCE_PROFILES/);
  assert.doesNotMatch(renegadeSkills, /RENEGADE_MECHANICS/);
  assert.doesNotMatch(catalog, /DYNAMIC_EFFECT_HANDLER_IDS/);
  assert.match(catalog, /assembleNativeApplicationCatalog/);
  assert.match(catalog, /revenantNativeModules/);
  assert.match(modules, /revenantCoreModule/);
  assert.doesNotMatch(catalog, /REVENANT_SKILL_MECHANICS/);
});

test('legend palette shows only the destination legend with the shared swap cooldown', async () => {
  const context = {
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

  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(context, destination), true);
  const cooldownContext = {
    ...context,
    time: 1,
    professionState: {
      ...context.professionState,
      legendSwapReadyAt: 10
    }
  };
  const cooldown = revenantProfession.ui.paletteSkillAvailability(cooldownContext, destination);

  assert.deepEqual(cooldown, {
    available: false,
    message: 'Legend swap is recharging',
    retryAt: 10
  });
  assert.equal(
    paletteSkillView(
      {
        results: {
          endState: {
            time: 1000,
            cooldowns: {},
            profession: cooldownContext.professionState
          }
        }
      },
      revenantCatalog.skillsById.get(SKILL.SWAP_LEGENDS),
      cooldown.available,
      cooldown.message,
      cooldown.retryAt
    ).cooldownLabel,
    '9.0s'
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
  assert.ok(revenantLegendLoadout.paletteGroups(context).every((group) => Array.isArray(group.reservedSkillIds)));
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.FACET_OF_ELEMENTS), [SKILL.ELEMENTAL_BLAST]);
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.FACET_OF_STRENGTH), [SKILL.BURST_OF_STRENGTH]);
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.CALL_TO_ANGUISH), [SKILL.UNYIELDING_IMPACT]);
  const rotationGroups = rotationPaletteGroups({ profession: revenantProfession }, context);

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

  assert.deepEqual(
    rotationLoadoutPaletteGroups(rotationApp, context).map((group) => group.label),
    ['Assassin', 'Demon']
  );
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
    skills: revenantCatalog.skills,
    skillById: revenantCatalog.skillsById,
    skillByName: revenantCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: simulate('Core', build.rotation)
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

  assert.equal((palette.innerHTML.match(/data-skill="Swap Legends"/g) || []).length, 1);
  assert.match(palette.innerHTML, /data-skill="Swap Legends"[\s\S]*?<span class="pal-cd">10s<\/span>/);
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
  assert.equal(result.steps[0].fullCastMs, 0);
  assert.equal(result.endState.activeWeaponSet, 2);
  assert.ok(result.events.some((event) => event.type === 'weapon_set' && event.weaponSet === 2));
});

test('Revenant scepter follow-ups replace and restore weapon slots 2 and 3', () => {
  const app = {
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

    return displayedFlipSkills(
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
  assert.equal(result.endState.profession.autoattackChains[SKILL.MISERY_SWIPE], SKILL.MANIFEST_TOXIN);
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
  assert.equal(result.endState.profession.autoattackChains[SKILL.PREPARATION_THRUST], SKILL.BRUTAL_BLADE);
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
  assert.equal(result.endState.profession.autoattackChains[SKILL.PREPARATION_THRUST], SKILL.BRUTAL_BLADE);
});

test('Renegade shortbow skills use supplied casts, packets, and combo data', () => {
  const expectedSkills = [
    [SKILL.SHATTERSHOT, 480, 0.65, 1],
    [SKILL.BLOODBANE_PATH, 760, 1.2, 3],
    [SKILL.SEVENSHOT, 440, 2.17, 7],
    [SKILL.SPIRITCRUSH, 400, 1.25, 1],
    [SKILL.SCORCHRAZOR, 520, 1, 1]
  ];

  for (const [skillId, castTimeMs, coefficient, hits] of expectedSkills) {
    const skill = revenantCatalog.skillsById.get(skillId);
    const strike = skill.effects[0];

    assert.equal(skill.castTimeMs, castTimeMs);
    const totalCoefficient = strike.coefficient ?? strike.ticks.reduce((sum, tick) => sum + tick.coefficient, 0);

    assert.ok(Math.abs(totalCoefficient - coefficient) < 1e-12);
    assert.equal(strike.hits ?? strike.ticks.length, hits);
  }

  for (const [skillId, quicknessCastTimeMs] of [
    [SKILL.SHATTERSHOT, 480],
    [SKILL.BLOODBANE_PATH, 760],
    [SKILL.SEVENSHOT, 440],
    [SKILL.SPIRITCRUSH, 400]
  ]) {
    const skill = revenantCatalog.skillsById.get(skillId);

    assert.equal(skill.castTimeMs, quicknessCastTimeMs);
    assert.equal(skill.quicknessCastTimeMs, undefined);
    assert.equal(skill.unaffectedByQuickness, true);
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
  assert.equal(spiritcrush.effects[1].coefficient, 0.75);
  assert.equal(spiritcrush.effects[1].hits, 3);
  assert.equal(spiritcrush.effects[2].applications, 4);
  assert.equal(spiritcrush.effects[2].atMs, 1320);
  assert.equal(spiritcrush.effects[3].applications, 4);
  assert.equal(spiritcrush.effects[3].atMs, 1320);

  const quicknessResult = simulate('Renegade', ['Shattershot', 'Bloodbane Path', 'Sevenshot', 'Spiritcrush'], {
    primaryWeapon: 'Shortbow',
    secondaryWeapon: '',
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.deepEqual(
    quicknessResult.steps.map((step) => [step.skill, step.fullCastMs]),
    [
      ['Shattershot', 480],
      ['Bloodbane Path', 760],
      ['Sevenshot', 440],
      ['Spiritcrush', 400]
    ]
  );

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

  const fieldDamage = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Spiritcrush' && event.name.includes('Fire Field')
  );

  assert.deepEqual(
    fieldDamage.map((event) => [event.at, event.coefficient]),
    [
      [4.4, 0.25],
      [5.4, 0.25],
      [6.4, 0.25]
    ]
  );
  for (const [condition, duration] of [
    ['Burning', 3],
    ['Slow', 1.5]
  ]) {
    assert.deepEqual(
      result.events
        .filter(
          (event) => event.type === 'condition' && event.skillName === 'Spiritcrush' && event.condition === condition
        )
        .map((event) => [Number(event.at.toFixed(2)), event.stacks, event.duration]),
      [
        [3.4, 1, duration],
        [4.4, 1, duration],
        [5.4, 1, duration],
        [6.4, 1, duration]
      ]
    );
  }

  assert.ok(
    result.events.some(
      (event) => event.type === 'control' && event.skillName === 'Scorchrazor' && event.controlKind === 'knockdown'
    )
  );
});

test('Condition Quickness Herald weapon packets use their measured interrupt commit cutoffs', () => {
  const baseHeraldConfig = {
    selectedLegends: [LEGEND.DRAGON, LEGEND.DEMON],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100,
    boons: { quickness: true }
  };
  const cases = [
    {
      skillId: SKILL.MISERY_SWIPE,
      castTimeMs: 440,
      commitMs: 280,
      rotation: (interruptMs) => [{ name: 'Misery Swipe', interruptMs }],
      config: { primaryWeapon: 'Mace', secondaryWeapon: 'Axe' },
      packetCount: 1
    },
    {
      skillId: SKILL.MANIFEST_TOXIN,
      castTimeMs: 560,
      commitMs: 440,
      rotation: (interruptMs) => ['Misery Swipe', 'Anguish Swipe', { name: 'Manifest Toxin', interruptMs }],
      config: { primaryWeapon: 'Mace', secondaryWeapon: 'Axe' },
      packetCount: 1
    },
    {
      skillId: SKILL.SEARING_FISSURE,
      castTimeMs: 600,
      commitMs: 480,
      rotation: (interruptMs) => [{ name: 'Searing Fissure', interruptMs }],
      config: { primaryWeapon: 'Mace', secondaryWeapon: 'Axe' },
      packetCount: 4
    },
    {
      skillId: SKILL.SHATTERSHOT,
      castTimeMs: 480,
      commitMs: 400,
      rotation: (interruptMs) => [{ name: 'Shattershot', interruptMs }],
      config: { primaryWeapon: 'Shortbow', secondaryWeapon: '' },
      packetCount: 1
    }
  ];

  // Each cutoff models projectile launch: an earlier cancel loses the skill, while the exact boundary retains it.
  for (const { skillId, castTimeMs, commitMs, rotation, config, packetCount } of cases) {
    const skill = revenantCatalog.skillsById.get(skillId);
    const damageCount = (interruptMs) =>
      simulate(
        'Herald',
        rotation(interruptMs),
        { ...baseHeraldConfig, ...config },
        observationTail(4000)
      ).events.filter((event) => event.type === 'damage' && event.skillId === skillId).length;

    assert.equal(skill.quicknessCastTimeMs ?? skill.castTimeMs, castTimeMs, `${skill.name} cast`);
    assert.equal(skill.interruptCommitMs, commitMs, `${skill.name} commit`);
    assert.equal(damageCount(commitMs - 1), 0, `${skill.name} before commit`);
    assert.equal(damageCount(commitMs), packetCount, `${skill.name} at commit`);
  }
});

test('Abyssal Strike uses 520ms Quickness timing for both spear swings', () => {
  const result = simulate('Core', ['Abyssal Strike', 'Abyssal Strike', 'Abyssal Strike', 'Abyssal Strike'], {
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    boons: { quickness: true }
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.map((step) => [step.skill, step.start, step.fullCastMs]),
    [
      ['Abyssal Strike', 0, 520],
      ['Abyssal Strike', 520, 520],
      ['Abyssal Strike', 1040, 520],
      ['Abyssal Strike', 1560, 520]
    ]
  );
  assert.ok(
    result.events.filter((event) => event.type === 'damage').every((event) => event.skillName === 'Abyssal Strike')
  );

  const paletteApp = {
    profession: revenantProfession,
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

  const hidden = simulate('Core', ['Abyssal Fire'], {
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  });

  assert.match(hidden.warnings[0], /use Abyssal Strike/);
});

test('Abyssal Strike commits with its 396ms impact', () => {
  const config = {
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    boons: { quickness: true }
  };
  const interruptAt = (interruptMs) =>
    simulate(
      'Core',
      [
        {
          name: 'Abyssal Strike',
          interruptMs
        }
      ],
      config,
      observationTail(4000)
    );
  const packets = (result) =>
    result.events.filter(
      (event) => event.skillName === 'Abyssal Strike' && (event.type === 'damage' || event.type === 'condition')
    );

  const cancelled = interruptAt(395);
  const committed = interruptAt(396);

  assert.equal(cancelled.steps[0].fullCastMs, 520);
  assert.equal(cancelled.steps[0].end, 395);
  assert.deepEqual(packets(cancelled), []);
  assert.equal(cancelled.endState.profession.abyssalStrikeSecondCast, false);

  assert.equal(committed.steps[0].fullCastMs, 520);
  assert.equal(committed.steps[0].end, 396);
  assert.equal(packets(committed).length, 3);
  assert.ok(packets(committed).every((event) => event.at === 0.396));
  assert.equal(committed.endState.profession.abyssalStrikeSecondCast, true);

  const afterCancel = simulate('Core', [{ name: 'Abyssal Strike', interruptMs: 395 }, 'Abyssal Strike'], config);

  assert.equal(afterCancel.steps[1].fullCastMs, 520);
});

test('Searing Fissure resolves its initial packet and three field pulses', () => {
  const result = simulate('Core', ['Searing Fissure', { type: 'wait', durationMs: 3500 }], {
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Axe',
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Searing Fissure')
      .map((event) => [event.at, event.coefficient]),
    [
      [0.48, 0.5],
      [1.48, 0.25],
      [2.48, 0.25],
      [3.48, 0.25]
    ]
  );
  assert.deepEqual(
    result.events
      .filter(
        (event) => event.type === 'condition' && event.skillName === 'Searing Fissure' && event.condition === 'Burning'
      )
      .map((event) => [event.at, event.stacks, event.duration]),
    [
      [0.48, 3, 3],
      [1.48, 1, 1],
      [2.48, 1, 1],
      [3.48, 1, 1]
    ]
  );

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
    [[1.82, 2, 1, 1]]
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

test('Searing Fissure commits at 480ms and an earlier cancel only starts cooldown', () => {
  const config = {
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Axe',
    initialEnergy: 100,
    boons: { quickness: true }
  };
  const interruptAt = (interruptMs) =>
    simulate(
      'Core',
      [
        {
          name: 'Searing Fissure',
          interruptMs
        }
      ],
      config,
      observationTail(4000)
    );
  const fissurePackets = (result) =>
    result.events.filter(
      (event) => event.skillName === 'Searing Fissure' && (event.type === 'damage' || event.type === 'condition')
    );

  const cancelled = interruptAt(479);
  const committed = interruptAt(480);

  assert.equal(cancelled.steps[0].end, 479);
  assert.equal(cancelled.steps[0].interrupted, true);
  assert.deepEqual(fissurePackets(cancelled), []);
  assert.equal(
    cancelled.events.find((event) => event.type === 'action' && event.skillName === 'Searing Fissure').cancelled,
    true
  );
  assert.deepEqual(cancelled.endState.cooldowns['Searing Fissure'], {
    readyAt: 3479,
    remaining: 3000
  });

  assert.equal(committed.steps[0].end, 480);
  assert.equal(committed.steps[0].interrupted, true);
  assert.deepEqual(
    fissurePackets(committed)
      .filter((event) => event.type === 'damage')
      .map((event) => [event.at, event.coefficient]),
    [
      [0.48, 0.5],
      [1.48, 0.25],
      [2.48, 0.25],
      [3.48, 0.25]
    ]
  );
  assert.deepEqual(
    fissurePackets(committed)
      .filter((event) => event.type === 'condition')
      .map((event) => [event.at, event.stacks, event.duration]),
    [
      [0.48, 3, 3],
      [1.48, 1, 1],
      [2.48, 1, 1],
      [3.48, 1, 1]
    ]
  );
  assert.deepEqual(committed.endState.cooldowns['Searing Fissure'], {
    readyAt: 3480,
    remaining: 3000
  });

  const comboConfig = {
    ...config,
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY
  };
  const comboAt = (interruptMs) =>
    simulate('Conduit', [{ name: 'Searing Fissure', interruptMs }, 'Twin Moon Sweep'], comboConfig);
  const burningBolts = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' &&
        event.comboId != null &&
        event.skillName === 'Twin Moon Sweep' &&
        event.condition === 'Burning'
    );

  assert.equal(burningBolts(comboAt(479)).length, 0);
  assert.equal(burningBolts(comboAt(480)).length, 2);
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

  assert.deepEqual(damageOffsets('Abyssal Raze'), [559]);
  assert.deepEqual(damageOffsets('Abyssal Force'), [1162]);
  assert.deepEqual(damageOffsets('Abyssal Blitz'), [560, 720, 960]);
  assert.deepEqual(damageOffsets('Abyssal Blot'), [960, 1240, 1520, 1800, 2080]);
  const rechargeProcs = result.procSteps.filter((proc) => proc.skill.endsWith('Abyssal Raze recharge'));

  assert.deepEqual(
    rechargeProcs.map((proc) => proc.detail),
    ['1s', '1s', '3s', '5s', '1.96s']
  );
  assert.deepEqual(
    rechargeProcs.map((proc) => proc.cooldownReduction),
    [1, 1, 3, 5, 1.96]
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
  const ammo = result.schedulerState.ammo.get(SKILL.ABYSSAL_RAZE);

  assert.equal(ammo.charges, 3);
  assert.equal(ammo.nextRechargeAt, null);

  const blitzMines = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Abyssal Blitz');

  assert.deepEqual(
    blitzMines.map((event) => event.coefficient),
    [0.5, 0.5, 0.5]
  );
  for (const condition of ['Slow', 'Chilled', 'Weakness']) {
    assert.equal(
      result.events.filter(
        (event) =>
          event.type === 'condition' &&
          event.skillName === 'Abyssal Blitz' &&
          event.condition === condition &&
          event.duration === 3
      ).length,
      3
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

  assert.equal(blotHits.length, 5);
  assert.ok(blotHits.every((event) => event.coefficient === 0.4));
  assert.equal(
    result.events.filter(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Abyssal Blot' &&
        event.condition === 'Poisoned' &&
        event.duration === 6
    ).length,
    5
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
    ['Abyssal Raze', 'Abyssal Raze', 'Abyssal Raze', { type: 'wait', durationMs: 9100 }, 'Abyssal Strike'],
    {
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialEnergy: 100
    }
  );

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.map((step) => [step.skill, step.start, step.end]),
    [
      ['Abyssal Raze', 0, 900],
      ['Abyssal Raze', 1900, 2800],
      ['Abyssal Raze', 3800, 4700],
      ['Wait', 4700, 13800],
      ['Abyssal Strike', 13800, 14580]
    ]
  );
  assert.equal(result.schedulerState.ammo.get(SKILL.ABYSSAL_RAZE).nextRechargeAt, 14.9);
  assert.deepEqual(result.endState.cooldowns['Abyssal Raze'], {
    readyAt: 14900,
    remaining: 320
  });
});

test('Abyssal Raze recharge reduction carries overflow into the next count', () => {
  const result = simulate(
    'Core',
    ['Abyssal Raze', 'Abyssal Raze', 'Abyssal Raze', { type: 'wait', durationMs: 10300 }, 'Abyssal Strike'],
    {
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialEnergy: 100
    }
  );

  const rechargeProc = result.procSteps.find((proc) => proc.skill.endsWith('Abyssal Raze recharge'));

  assert.equal(rechargeProc.cooldownReduction, 1);
  assert.deepEqual(result.schedulerState.ammo.get(SKILL.ABYSSAL_RAZE), {
    charges: 1,
    maximum: 3,
    rechargeDuration: 15,
    nextRechargeAt: 29.9
  });
  assert.equal(result.endState.cooldowns['Abyssal Raze'], undefined);
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
    [0, 1600, 3200]
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
  assert.deepEqual(result.endState.profession.crushingAbyss, []);
});

test('legend loadout validation requires two legal distinct legends', () => {
  const defaults = createRevenantBuildDefaults();

  assert.equal(defaults.assumptions.hitboxSize, 'small');
  assert.ok(revenantProfession.ui.assumptionControls.some((control) => control.key === 'hitboxSize'));
  assert.deepEqual(validateRevenantBuild(defaults), {
    valid: true,
    errors: []
  });
  assert.equal(
    validateRevenantBuild({
      ...defaults,
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.ASSASSIN]
    }).valid,
    false
  );
  assert.equal(
    validateRevenantBuild({
      ...defaults,
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.RENEGADE],
      startingLegend: LEGEND.RENEGADE
    }).valid,
    false
  );
  const migrated = migrateRevenantBuild({
    ...defaults,
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
    startingLegend: 'missing'
  });

  assert.equal(migrated.startingLegend, LEGEND.ASSASSIN);
  assert.equal(migrateRevenantBuild({ ...defaults, assumptions: {} }).assumptions.hitboxSize, 'small');
  assert.equal(
    validateRevenantBuild({
      ...defaults,
      assumptions: { ...defaults.assumptions, hitboxSize: 'huge' }
    }).valid,
    false
  );
});

test('legend loadout exposes core legends plus only the active elite legend', () => {
  for (const specialization of ['Core', 'Herald', 'Renegade', 'Vindicator', 'Conduit']) {
    const legal = legalRevenantLegendIds(specialization);

    assert.deepEqual(legal, [
      ...REVENANT_CORE_LEGEND_IDS,
      ...(REVENANT_ELITE_LEGEND_BY_SPECIALIZATION[specialization]
        ? [REVENANT_ELITE_LEGEND_BY_SPECIALIZATION[specialization]]
        : [])
    ]);
    const options = revenantLegendLoadout
      .view({
        specialization,
        build: baseConfig
      })
      .selectors[0].options.map((option) => option.value);

    assert.deepEqual(options, legal);
  }

  const conduit = revenantLegendLoadout.normalizeBuild(
    {
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ENTITY],
      startingLegend: LEGEND.ALLIANCE
    },
    { specialization: 'Conduit' }
  );

  assert.deepEqual(conduit.selectedLegends, [LEGEND.ENTITY, LEGEND.ASSASSIN]);
  assert.equal(conduit.startingLegend, LEGEND.ENTITY);
});

test('profession palette deduplicates actions and shows only active Conduit release', () => {
  assert.deepEqual(REVENANT_RELEASE_POTENTIAL_BY_LEGEND, {
    [LEGEND.ASSASSIN]: 'Release Potential: Assassin',
    [LEGEND.CENTAUR]: 'Release Potential: Monk',
    [LEGEND.DEMON]: 'Release Potential: Mesmer',
    [LEGEND.DWARF]: 'Release Potential: Warrior',
    [LEGEND.ENTITY]: 'Release Potential: Dervish'
  });
  const professionSkillIds = (specialization, selectedLegends, activeLegendId) =>
    revenantProfession.ui
      .paletteGroups({
        specialization,
        build: {
          ...baseConfig,
          selectedLegends,
          startingLegend: activeLegendId
        },
        professionState: {
          activeLegendId,
          activeLoadoutId: activeLegendId,
          availableFlips: {}
        }
      })
      .find((group) => group.id === 'revenant-profession').skillIds;

  const vindicatorIds = professionSkillIds('Vindicator', [LEGEND.ALLIANCE, LEGEND.ASSASSIN], LEGEND.ALLIANCE);

  assert.equal(vindicatorIds.filter((id) => revenantCatalog.skillsById.get(id)?.name === 'Energy Meld').length, 1);

  for (const activeLegendId of [...REVENANT_CORE_LEGEND_IDS, LEGEND.ENTITY]) {
    const selectedLegends =
      activeLegendId === LEGEND.ENTITY ? [LEGEND.ENTITY, LEGEND.ASSASSIN] : [activeLegendId, LEGEND.ENTITY];
    const conduitIds = professionSkillIds('Conduit', selectedLegends, activeLegendId);
    const releases = conduitIds
      .map((id) => revenantCatalog.skillsById.get(id)?.name)
      .filter((name) => name?.startsWith('Release Potential:'));

    assert.deepEqual(releases, [REVENANT_RELEASE_POTENTIAL_BY_LEGEND[activeLegendId]]);
  }
});

test('energy regenerates continuously and every skill pays its explicit cost', () => {
  const result = simulate('Core', ['Phase Traversal', { type: 'wait', durationMs: 1000 }]);

  // 50 - 30 + 2.5 during the half-second cast + 5 during the wait.
  assert.equal(result.endState.profession.energy, 27.5);
  const denied = simulate('Core', ['Jade Winds'], { initialEnergy: 34 });

  assert.match(denied.warnings[0], /requires 35 energy/);

  const utilityDenied = simulate('Core', ['Phase Traversal'], {
    initialEnergy: 29
  });

  assert.match(utilityDenied.warnings[0], /requires 30 energy/);
  const weaponDenied = simulate('Conduit', ['Chilling Isolation'], {
    initialEnergy: 4,
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY
  });

  assert.match(weaponDenied.warnings[0], /requires 5 energy/);
});

test('a cooldown-queued Revenant skill recovers Energy before its next cast', () => {
  const result = simulate('Core', ['Phase Traversal', 'Phase Traversal']);

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.map((step) => [step.skill, step.start]),
    [
      ['Phase Traversal', 0],
      ['Phase Traversal', 5500]
    ]
  );
});

test('Revenant energy regeneration stops at 50 while out of combat', () => {
  for (const specialization of ['Core', 'Renegade', 'Conduit']) {
    const legends =
      specialization === 'Core'
        ? {}
        : {
            selectedLegends: [specialization === 'Renegade' ? LEGEND.RENEGADE : LEGEND.ENTITY, LEGEND.ASSASSIN],
            startingLegend: specialization === 'Renegade' ? LEGEND.RENEGADE : LEGEND.ENTITY
          };
    const precombat = simulate(specialization, [{ type: 'wait', durationMs: 20000 }, '__combat_start'], {
      ...legends,
      initialEnergy: 0
    });

    assert.equal(precombat.endState.profession.energy, 50, specialization);

    const inCombat = simulate(
      specialization,
      [{ type: 'wait', durationMs: 20000 }, '__combat_start', { type: 'wait', durationMs: 1000 }],
      { ...legends, initialEnergy: 0 }
    );

    assert.equal(inCombat.endState.profession.energy, 55, specialization);
  }
});

test('non-damaging Revenant heals do not enter combat', () => {
  const buffOnly = simulate('Conduit', ['Enchanted Daggers', { type: 'wait', durationMs: 20000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN
  });

  assert.equal(buffOnly.totalDamage, 0);
  assert.equal(buffOnly.firstHitTime, null);
  assert.equal(buffOnly.endState.profession.combatBeganAt, null);
  assert.equal(buffOnly.endState.profession.energy, 50);

  const breakrazor = simulate('Renegade', ["Breakrazor's Bastion", { type: 'wait', durationMs: 20000 }], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE
  });

  assert.equal(breakrazor.totalDamage, 0);
  assert.equal(breakrazor.firstHitTime, null);
  assert.equal(breakrazor.endState.profession.combatBeganAt, null);
  assert.equal(breakrazor.endState.profession.energy, 50);
  assert.equal(
    breakrazor.events.some(
      (event) =>
        event.skillId === SKILL.BREAKRAZORS_BASTION && ['damage', 'condition', 'control', 'blind'].includes(event.type)
    ),
    false
  );

  const followedByDamage = simulate(
    'Conduit',
    ['Enchanted Daggers', { type: 'wait', durationMs: 20000 }, 'Phase Traversal', { type: 'wait', durationMs: 10000 }],
    {
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
      startingLegend: LEGEND.ASSASSIN
    }
  );

  assert.ok(followedByDamage.totalDamage > 0);
  assert.equal(followedByDamage.endState.profession.combatBeganAt, followedByDamage.firstHitTime);
  assert.ok(followedByDamage.endState.profession.energy > 50);
});

test('legend swap replaces the fixed bar, resets energy, and triggers sigils', () => {
  const result = simulate('Core', ['Phase Traversal', 'Swap Legends', 'Banish Enchantment']);

  assert.equal(result.warnings.length, 0);
  assert.equal(result.profession.activeLegendId, LEGEND.DEMON);
  assert.ok(result.events.some((event) => event.type === 'sigil_swap'));
  assert.ok(result.endState.profession.legendSwapReadyAt >= 10);
  assert.ok(result.totalDamage > 0);

  const precombat = simulate('Core', ['Swap Legends', 'Swap Legends']);

  assert.equal(precombat.warnings.length, 0);
  assert.deepEqual(
    precombat.steps.map((step) => step.start),
    [0, 0]
  );
  assert.equal(precombat.endState.profession.legendSwapReadyAt, 0);

  const inCombat = simulate('Core', ['__combat_start', 'Swap Legends', 'Swap Legends']);

  assert.deepEqual(
    inCombat.steps.filter((step) => step.skill === 'Swap Legends').map((step) => step.start),
    [0, 10000]
  );
  assert.equal(inCombat.endState.profession.legendSwapReadyAt, 20);

  const sigilResult = simulate('Core', ['__combat_start', 'Swap Legends'], {
    sigilSets: [
      { names: ['Hydromancy', 'Geomancy'], strike: 1, condition: 1 },
      { names: [], strike: 1, condition: 1 }
    ]
  });

  assert.deepEqual(
    sigilResult.procSteps.filter((step) => step.type === 'sigil_proc').map((step) => [step.skill, step.sourceSkill]),
    [
      ['Sigil of Hydromancy', 'Swap Legends'],
      ['Sigil of Geomancy', 'Swap Legends']
    ]
  );
});

test('legend swaps use the destination legend icon', () => {
  const rotation = ['Phase Traversal', 'Swap Legends', 'Banish Enchantment', 'Swap Legends'].map((name) => ({
    type: 'cast',
    skillId: revenantCatalog.skillsByName.get(name).id
  }));
  const build = {
    ...baseConfig,
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN
  };
  const iconAt = (index) =>
    revenantProfession.ui.timelineSkillIcon({
      entry: rotation[index],
      index,
      rotation,
      build,
      catalog: revenantCatalog,
      skill: revenantCatalog.skillsById.get(rotation[index].skillId)
    });
  const icon = (legendId) => REVENANT_LEGENDS.find((legend) => legend.id === legendId).icon;

  assert.equal(iconAt(1), icon(LEGEND.DEMON));
  assert.equal(iconAt(3), icon(LEGEND.ASSASSIN));
  assert.equal(iconAt(0), '');
});

test('Charged Mists uses the low-energy legend reset', () => {
  const normal = simulate('Core', ['Swap Legends'], { initialEnergy: 5 });

  assert.equal(normal.endState.profession.energy, 50);
  const charged = simulate('Core', ['Swap Legends'], {
    initialEnergy: 5,
    selectedTraitIds: [TRAIT.CHARGED_MISTS]
  });

  assert.equal(charged.endState.profession.energy, 75);
  const chargedFractional = simulate('Core', ['Swap Legends'], {
    initialEnergy: 10.7,
    selectedTraitIds: [TRAIT.CHARGED_MISTS]
  });

  assert.equal(chargedFractional.endState.profession.energy, 75);
  const aboveThreshold = simulate('Core', ['Swap Legends'], {
    initialEnergy: 11,
    selectedTraitIds: [TRAIT.CHARGED_MISTS]
  });

  assert.equal(aboveThreshold.endState.profession.energy, 50);
});

test('legend invocation traits resolve after swap effects', () => {
  const result = simulate(
    'Core',
    ['Swap Legends'],
    {
      selectedTraitIds: [TRAIT.INVOKING_TORMENT, TRAIT.DIABOLIC_INFERNO, TRAIT.SPIRIT_BOON, TRAIT.SONG_OF_THE_MISTS]
    },
    observationTail(1000)
  );
  const swap = result.events.find((event) => event.type === 'sigil_swap');
  const call = result.events.find((event) => event.name === 'Call of the Demon');
  const invoke = result.events.find((event) => event.type === 'damage' && event.name === 'Invoke Torment');

  assert.equal(swap.at, 0);
  assert.equal(call.at, 0);
  assert.equal(call.coefficient, 0.9);
  assert.equal(invoke.at, 0.75);
  assert.equal(invoke.coefficient, 1);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Invoke Torment')
      .map((event) => [event.condition, event.stacks, event.duration]),
    [
      ['Torment', 1, 10],
      ['Poisoned', 1, 10],
      ['Burning', 1, 4]
    ]
  );
  assert.ok(
    result.events.some((event) => event.type === 'buff' && event.kind === 'resistance' && event.duration === 2)
  );
});

test('Herald invocation traits emit their declared proc skills', () => {
  const result = simulate('Herald', ['Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.SPIRIT_BOON, TRAIT.SONG_OF_THE_MISTS]
  });
  const call = result.events.find((event) => event.type === 'damage' && event.name === 'Call of the Dragon');
  const spiritBoon = result.events.find((event) => event.type === 'buff' && event.skillName === 'Spirit Boon (Dragon)');

  assert.equal(call.skillId, SKILL.CALL_OF_THE_DRAGON);
  assert.equal(call.sourceId, TRAIT.SONG_OF_THE_MISTS);
  assert.equal(call.coefficient, 0.75);
  assert.equal(spiritBoon.sourceId, TRAIT.SPIRIT_BOON);
  assert.equal(spiritBoon.kind, 'protection');
  assert.equal(spiritBoon.duration, 3);
});

test('Renegade invocation traits emit declared proc skills and grant fervor', () => {
  const result = simulate('Renegade', ['Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.RENEGADE],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.SPIRIT_BOON, TRAIT.SONG_OF_THE_MISTS]
  });
  const call = result.events.find((event) => event.type === 'damage' && event.name === 'Call of the Renegade');
  const bleeding = result.events.find(
    (event) =>
      event.type === 'condition' && event.skillName === 'Call of the Renegade' && event.condition === 'Bleeding'
  );
  const spiritBoon = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Spirit Boon (Renegade)'
  );

  assert.equal(call.skillId, SKILL.CALL_OF_THE_RENEGADE);
  assert.equal(call.sourceId, TRAIT.SONG_OF_THE_MISTS);
  assert.equal(call.coefficient, 0.5);
  assert.equal(bleeding.stacks, 2);
  assert.equal(bleeding.duration, 8);
  assert.equal(spiritBoon.sourceId, TRAIT.SPIRIT_BOON);
  assert.equal(spiritBoon.kind, 'resolution');
  assert.equal(spiritBoon.duration, 4);
  assert.equal(result.endState.profession.kallasFervor.length, 2);
});

test('Corruption traits update attributes, duration, and chill triggers', () => {
  const build = createRevenantBuildDefaults();

  build.specializations = [
    { name: 'Corruption', traits: '1-3-1' },
    { name: 'Devastation', traits: '2-2-2' }
  ];
  build.assumptions.might = 25;
  const attributes = calculateRevenantAttributes(build).attributes;

  assert.equal(attributes['Condition Damage'].traits, 120);
  assert.equal(attributes.Power.traits, 0);
  assert.equal(attributes['Condition Duration'].traits, 15);
  assert.equal(attributes['Torment Duration'].traits, 10);
  assert.equal(attributes['Poison Duration'].traits, 10);

  const chill = simulate('Herald', ['Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.SONG_OF_THE_MISTS, TRAIT.ABYSSAL_CHILL]
  });

  assert.ok(
    chill.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Abyssal Chill' &&
        event.condition === 'Torment' &&
        event.stacks === 1 &&
        event.duration === 3
    )
  );
  assert.equal(
    revenantAttributeRules.modifyConditionDamage(
      {
        config: { traitIds: [TRAIT.ACOLYTE_OF_TORMENT] },
        event: { actorType: 'player' },
        condition: 'Torment'
      },
      1
    ),
    1.1
  );
});

test('Notoriety applies its Might conversion at runtime without negative UI attributes', async () => {
  const saved = JSON.parse(
    await readFile(new URL('../../../Builds/revenant/b-power-conduit.json', import.meta.url), 'utf8')
  );
  const attributes = calculateRevenantAttributes(migrateRevenantBuild(saved)).attributes;

  assert.equal(attributes['Condition Damage'].traits, 75);
  assert.equal(attributes['Condition Damage'].final, 75);

  const runtime = revenantAttributeRules.modifyAttributes(
    {
      config: {
        specialization: 'Core',
        traitIds: [TRAIT.NOTORIETY],
        boons: { might: 25 }
      },
      time: 0,
      runtime: { boons: new Map(), profession: {} }
    },
    {
      power: 1750,
      conditionDamage: 750
    }
  );

  assert.equal(runtime.power, 2000);
  assert.equal(runtime.conditionDamage, 500);
});

test('Retribution and Invocation traits use live combat state', () => {
  const player = { actorType: 'player' };
  const context = (traitId, extra = {}) => ({
    config: { traitIds: [traitId], ...(extra.config || {}) },
    event: player,
    time: 1,
    runtime: { totals: { strike: 0, condition: 0 }, ...(extra.runtime || {}) },
    query: {
      targetHasCondition: () => true,
      targetConditionStacks: () => 20,
      ...(extra.query || {})
    }
  });

  assert.equal(
    revenantAttributeRules.modifyStrikeDamage(
      context(TRAIT.RISING_TIDE, {
        config: { playerHealthFraction: 1 }
      }),
      1
    ),
    1.1
  );
  assert.equal(revenantAttributeRules.modifyStrikeDamage(context(TRAIT.DWARVEN_BATTLE_TRAINING), 1), 1.1);
  assert.equal(
    revenantAttributeRules.modifyConditionDamage(
      context(TRAIT.VICIOUS_REPRISAL, {
        config: { boons: { resolution: true } }
      }),
      1
    ),
    1.1
  );
  assert.equal(
    revenantAttributeRules.modifyCriticalChance(
      {
        config: {
          traitIds: [TRAIT.ROILING_MISTS],
          boons: { fury: true }
        },
        event: player,
        time: 1
      },
      0.25
    ),
    0.5
  );

  const disabled = simulate('Vindicator', ["Reaver's Rage"], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    selectedTraitIds: [TRAIT.DWARVEN_BATTLE_TRAINING],
    initialEnergy: 100
  });

  assert.ok(
    disabled.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Dwarven Battle Training' &&
        event.condition === 'Weakness' &&
        event.duration === 5
    )
  );
});

test('Devastation modifiers and Battle Scars use supplied thresholds', () => {
  const modifierContext = (traitId, { healthDamage = 0, secondaryWeapon = '', targetBoons = {} } = {}) => ({
    config: {
      traitIds: [traitId],
      secondaryWeapon,
      target: { health: 100, boons: targetBoons }
    },
    event: { actorType: 'player' },
    time: 1,
    runtime: {
      activeWeaponSet: 1,
      totals: { strike: healthDamage, condition: 0 }
    },
    query: {
      targetHasCondition: () => true,
      targetConditionStacks: () => 20
    }
  });
  const strikeCases = [
    [TRAIT.DESTRUCTIVE_IMPULSES, {}, 1.05],
    [TRAIT.DESTRUCTIVE_IMPULSES, { secondaryWeapon: 'Sword' }, 1.075],
    [TRAIT.UNSUSPECTING_STRIKES, { healthDamage: 10 }, 1.2],
    [TRAIT.TARGETED_DESTRUCTION, {}, 1.1],
    [TRAIT.BRUTALITY, { targetBoons: { protection: true } }, 1.15],
    [TRAIT.SWIFT_TERMINATION, { healthDamage: 60 }, 1.2]
  ];

  for (const [traitId, options, expected] of strikeCases) {
    assert.equal(revenantAttributeRules.modifyStrikeDamage(modifierContext(traitId, options), 1), expected);
  }

  const destructiveWithForce = modifierContext(TRAIT.DESTRUCTIVE_IMPULSES, {
    secondaryWeapon: 'Sword'
  });

  destructiveWithForce.timeline = {
    activeSigilSetAt: () => ({
      strike: 1.05,
      strikeAdd: 0.05
    })
  };
  assert.equal(revenantAttributeRules.modifyStrikeDamage(destructiveWithForce, 1.05), 1.125);

  const scars = simulate('Core', ['Enchanted Daggers', 'Phase Traversal'], {
    selectedTraitIds: [TRAIT.BATTLE_SCARRED],
    initialEnergy: 100
  });
  const siphon = scars.events.find((event) => event.name === 'Battle Scars — Life Siphon');

  assert.equal(siphon.flatStrikeBase, 117);
  assert.equal(siphon.flatStrikePowerCoeff, 0.006);
  assert.equal(scars.endState.profession.battleScars.length, 4);

  const dance = simulate('Core', ['Phase Traversal', { type: 'wait', durationMs: 5000 }, 'Phase Traversal'], {
    selectedTraitIds: [TRAIT.EXPOSE_DEFENSES, TRAIT.DANCE_OF_DEATH],
    initialEnergy: 100
  });

  assert.equal(dance.events.filter((event) => event.name === 'Battle Scars — Life Siphon').length, 1);
});

test('Devastation boon procs respect combat intervals and skill categories', () => {
  const passive = simulate('Core', ['__combat_start', { type: 'wait', durationMs: 1100 }, 'Phase Traversal'], {
    selectedTraitIds: [TRAIT.THRILL_OF_COMBAT, TRAIT.ASSASSINS_PRESENCE],
    initialEnergy: 100
  });

  assert.equal(passive.events.filter((event) => event.name === 'Battle Scars — Life Siphon').length, 1);
  assert.ok(
    passive.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === "Assassin's Presence" &&
        event.kind === 'fury' &&
        event.duration === 3
    )
  );

  const reprisal = simulate('Core', ['Unrelenting Assault'], {
    selectedTraitIds: [TRAIT.VICIOUS_REPRISAL],
    boons: { resolution: true },
    initialEnergy: 100
  });

  assert.equal(
    reprisal.events.filter((event) => event.type === 'buff' && event.skillName === 'Vicious Reprisal').length,
    1
  );

  const notoriety = simulate('Core', ['Enchanted Daggers'], {
    selectedTraitIds: [TRAIT.NOTORIETY],
    initialEnergy: 100
  });

  assert.ok(
    notoriety.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Enchanted Daggers' &&
        event.sourceId === TRAIT.NOTORIETY &&
        event.kind === 'might' &&
        event.stacks === 2 &&
        event.duration === 10
    )
  );
  const notorietyStats = revenantAttributeRules.modifyAttributes(
    {
      config: { traitIds: [TRAIT.NOTORIETY], boons: { might: 0 } },
      time: 1,
      runtime: {
        boons: new Map([['might', [{ at: 0, expiresAt: 10, stacks: 2 }]]])
      }
    },
    { power: 1060, conditionDamage: 1060 }
  );

  assert.equal(notorietyStats.power, 1080);
  assert.equal(notorietyStats.conditionDamage, 1040);

  const brutality = simulate('Core', ['Swap Weapons'], {
    selectedTraitIds: [TRAIT.BRUTALITY],
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Mace',
    weaponSet2Secondary: 'Axe'
  });

  assert.ok(
    brutality.events.some(
      (event) =>
        event.type === 'buff' && event.skillName === 'Brutality' && event.kind === 'quickness' && event.duration === 3
    )
  );
});

test('upkeep drains net energy and cancels exactly on starvation', () => {
  const draining = simulate('Core', ['Impossible Odds', { type: 'wait', durationMs: 20000 }]);

  assert.equal(draining.endState.profession.energy, 25);
  assert.equal(draining.endState.profession.activeUpkeeps.length, 1);

  const starved = simulate('Core', ['Impossible Odds', { type: 'wait', durationMs: 50000 }]);

  assert.equal(starved.endState.profession.activeUpkeeps.length, 0);
  assert.equal(starved.endState.profession.energy, 25);
});

test('Revenant palette exposes upkeep releases and enforces Energy costs', () => {
  const active = simulate('Core', ['Impossible Odds']);
  const context = {
    specialization: 'Core',
    build: baseConfig,
    professionState: active.endState.profession
  };
  const assassin = revenantLegendLoadout.paletteGroups(context).find((group) => group.label === 'Assassin');

  assert.ok(assassin.skillIds.includes(SKILL.RELINQUISH_POWER));

  const impossible = revenantCatalog.skillsByName.get('Impossible Odds');
  const relinquish = revenantCatalog.skillsByName.get('Relinquish Power');

  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(context, impossible), false);
  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(context, relinquish), true);

  const lowEnergyContext = {
    ...context,
    professionState: {
      ...context.professionState,
      energy: 4,
      activeUpkeeps: [],
      availableFlips: {}
    }
  };
  const chilling = revenantCatalog.skillsByName.get('Chilling Isolation');
  const phase = revenantCatalog.skillsByName.get('Phase Traversal');

  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(lowEnergyContext, chilling), false);
  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(lowEnergyContext, phase), false);
  assert.equal(
    revenantProfession.ui.isPaletteSkillAvailable(
      {
        ...lowEnergyContext,
        cooldowns: {
          'Phase Traversal': { readyAt: 5500, remaining: 5000 }
        }
      },
      phase
    ),
    true
  );
  assert.match(
    revenantProfession.ui.paletteSkillUnavailableMessage(lowEnergyContext, phase),
    /Requires 30 Energy; currently 4/
  );
  assert.match(paletteSkillView({ results: null }, phase).title, /Energy cost: 30/);
  assert.match(paletteSkillView({ results: null }, relinquish).title, /Energy cost: 0/);
});

test('Herald palette replaces active facets with their consume skills', () => {
  const context = {
    specialization: 'Herald',
    build: {
      ...baseConfig,
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON
    },
    professionState: {
      activeLegendId: LEGEND.DRAGON,
      activeLoadoutId: LEGEND.DRAGON,
      availableFlips: {
        [SKILL.INFUSE_LIGHT]: true,
        [SKILL.BURST_OF_STRENGTH]: true,
        [SKILL.ELEMENTAL_BLAST]: true,
        [SKILL.GAZE_OF_DARKNESS]: true,
        [SKILL.CHAOTIC_RELEASE]: true,
        [SKILL.TRUE_NATURE_ID_51696]: true
      }
    }
  };
  const dragon = revenantLegendLoadout.paletteGroups(context).find((group) => group.label === 'Dragon');

  assert.deepEqual(dragon.skillIds, [
    SKILL.INFUSE_LIGHT,
    SKILL.BURST_OF_STRENGTH,
    SKILL.ELEMENTAL_BLAST,
    SKILL.GAZE_OF_DARKNESS,
    SKILL.CHAOTIC_RELEASE
  ]);

  const professionGroups = revenantProfession.ui.paletteGroups(context);
  const profession = professionGroups.find((group) => group.id === 'revenant-profession');

  // The UI declares the complete tile family; the shared projector chooses the live legend variant.
  assert.deepEqual(profession.skillIds, [
    SKILL.FACET_OF_NATURE,
    SKILL.TRUE_NATURE,
    SKILL.TRUE_NATURE_ID_51675,
    SKILL.TRUE_NATURE_ID_51696,
    SKILL.TRUE_NATURE_ID_51713,
    SKILL.TRUE_NATURE_ID_51714
  ]);
  assert.equal(
    professionGroups.some((group) => group.id === 'revenant-facet-consumes'),
    false
  );
});

test('Call to Anguish arms Unyielding Impact in the rotation palette', () => {
  const config = {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100,
    boons: { quickness: true }
  };
  const armed = simulate('Core', ['Call to Anguish'], config);

  assert.equal(armed.steps[0].fullCastMs, 820);
  const context = {
    specialization: 'Core',
    build: { ...baseConfig, ...config },
    professionState: armed.endState.profession
  };
  const demon = revenantLegendLoadout.paletteGroups(context).find((group) => group.label === 'Demon');

  assert.ok(demon.skillIds.includes(SKILL.UNYIELDING_IMPACT));
  assert.equal(
    revenantProfession.ui.isPaletteSkillAvailable(context, revenantCatalog.skillsById.get(SKILL.CALL_TO_ANGUISH)),
    false
  );
  assert.equal(
    revenantProfession.ui.isPaletteSkillAvailable(context, revenantCatalog.skillsById.get(SKILL.UNYIELDING_IMPACT)),
    true
  );

  const consumed = simulate('Core', ['Call to Anguish', 'Unyielding Impact'], config);

  assert.deepEqual(consumed.warnings, []);
  assert.equal(consumed.endState.profession.availableFlips[SKILL.UNYIELDING_IMPACT], undefined);

  const unavailable = simulate('Core', ['Unyielding Impact'], config);

  assert.match(unavailable.warnings[0], /cast Call to Anguish first/);

  const insufficient = simulate('Core', ['Call to Anguish', 'Unyielding Impact'], { ...config, initialEnergy: 30 });

  assert.match(insufficient.warnings[0], /requires 5 energy/);
});

test('Herald facets expose and consume their active flips', () => {
  const result = simulate('Herald', ['Facet of Strength', 'Burst of Strength'], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.activeUpkeeps.length, 0);
  assert.ok(result.totalDamage > 0);
});

test('Facet of Nature exposes the consume variant for the active legend', () => {
  const result = simulate('Herald', ['Facet of Nature', { skillId: SKILL.TRUE_NATURE_ID_51696 }], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.DEMON],
    startingLegend: LEGEND.DRAGON
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.find((event) => event.type === 'action' && event.skillName === 'True Nature')?.skillId,
    SKILL.TRUE_NATURE_ID_51696
  );
});

test('Herald consume skills apply their cooldown to the parent facet', () => {
  const cases = [
    ['Facet of Light', 'Infuse Light', 30],
    ['Facet of Darkness', 'Gaze of Darkness', 15],
    ['Facet of Elements', 'Elemental Blast', 12],
    ['Facet of Strength', 'Burst of Strength', 12],
    ['Facet of Chaos', 'Chaotic Release', 20]
  ];

  for (const [facet, consume, cooldown] of cases) {
    const result = simulate('Herald', [facet, consume], {
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      initialEnergy: 100
    });
    const consumeStep = result.steps.find((step) => step.skill === consume);

    assert.deepEqual(result.warnings, [], facet);
    const readyAt = consumeStep.end + cooldown * 1000;

    assert.deepEqual(result.endState.cooldowns[facet], {
      readyAt,
      remaining: readyAt - result.endState.time
    });
  }
});

test('Herald facets pulse their boons every three seconds', () => {
  const cases = [
    ['Facet of Light', 'Infuse Light', 1, 'regeneration', 4],
    ['Facet of Darkness', 'Gaze of Darkness', 2, 'fury', 3],
    ['Facet of Elements', 'Elemental Blast', 1, 'swiftness', 3],
    ['Facet of Strength', 'Burst of Strength', 2, 'might', 12],
    ['Facet of Chaos', 'Chaotic Release', 4, 'protection', 3]
  ];

  for (const [facet, consume, upkeep, boon, duration] of cases) {
    assert.equal(revenantCatalog.skillsByName.get(facet).upkeepCost, upkeep);
    const result = simulate('Herald', [facet, { type: 'wait', durationMs: 3100 }, consume], {
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      initialEnergy: 100
    });

    assert.equal(result.warnings.length, 0);
    assert.ok(
      result.events.some(
        (event) =>
          event.type === 'buff' && event.skillName === facet && event.kind === boon && event.duration === duration
      )
    );
    assert.equal(result.endState.profession.activeUpkeeps.length, 0);
  }
});

test('Herald consume skills apply their full outgoing profiles', () => {
  const gaze = simulate('Herald', ['Facet of Darkness', 'Gaze of Darkness'], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON
  });

  assert.equal(gaze.schedulerState.cooldowns.get(revenantCatalog.skillsByName.get('Gaze of Darkness').id), 15);
  assert.ok(
    gaze.events.some(
      (event) => event.type === 'blind' && event.skillName === 'Gaze of Darkness' && event.duration === 5
    )
  );
  assert.ok(gaze.events.some((event) => event.condition === 'Revealed' && event.duration === 5));
  assert.ok(
    gaze.events.some((event) => event.condition === 'Vulnerability' && event.stacks === 10 && event.duration === 6)
  );

  const elements = simulate(
    'Herald',
    ['Facet of Elements', 'Elemental Blast'],
    {
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON
    },
    observationTail(3000)
  );

  assert.deepEqual(
    elements.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Elemental Blast')
      .map((event) => [event.at, event.coefficient]),
    [
      [0.28, 1.5],
      [1.28, 1.5],
      [2.28, 1.5]
    ]
  );
  assert.deepEqual(
    elements.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Elemental Blast')
      .map((event) => [event.condition, event.stacks, event.duration]),
    [
      ['Weakness', 1, 5],
      ['Chilled', 1, 3],
      ['Burning', 2, 4]
    ]
  );

  const strength = simulate('Herald', ['Facet of Strength', 'Burst of Strength'], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON
  });

  assert.deepEqual(
    strength.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Burst of Strength')
      .map((event) => [Number(event.at.toFixed(2)), event.coefficient]),
    [
      [0.36, 1.6],
      [0.68, 1.6]
    ]
  );
  assert.ok(
    strength.events.some(
      (event) => event.type === 'buff' && event.kind === 'burst-of-strength' && event.duration === 10
    )
  );
  const burstContext = {
    config: { specialization: 'Herald' },
    time: 5,
    event: { actorType: 'player', skillName: 'Chilling Isolation' },
    runtime: {
      boons: new Map([['burst-of-strength', [{ at: 1, expiresAt: 11, stacks: 1 }]]]),
      profession: {}
    }
  };

  assert.equal(revenantAttributeRules.modifyStrikeDamage(burstContext, 1), 1.1);
  assert.equal(revenantAttributeRules.modifyConditionDamage(burstContext, 1), 1.05);
  const reinforcedPotencyContext = {
    config: {
      specialization: 'Herald',
      selectedTraitIds: [TRAIT.REINFORCED_POTENCY],
      boons: {
        aegis: true,
        alacrity: true,
        fury: true,
        might: 25,
        protection: true,
        quickness: true,
        regeneration: true,
        resolution: true,
        swiftness: true,
        vigor: true
      }
    },
    time: 5,
    event: { actorType: 'player' },
    runtime: { boons: new Map(), profession: {} }
  };

  assert.equal(revenantAttributeRules.modifyStrikeDamage(reinforcedPotencyContext, 1), 1.1);

  const chaos = simulate('Herald', ['Facet of Chaos', 'Chaotic Release'], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON
  });

  assert.ok(
    chaos.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Chaotic Release' && event.coefficient === 4
    )
  );
  assert.ok(chaos.events.some((event) => event.type === 'control' && event.controlKind === 'knockback'));
  assert.ok(chaos.events.some((event) => event.type === 'buff' && event.kind === 'superspeed' && event.duration === 5));
});

test('Demon skills use their current projectile and condition packets', () => {
  const banish = simulate('Core', ['Banish Enchantment'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100
  });
  const banishEvents = banish.events.filter((event) => event.skillName === 'Banish Enchantment');

  assert.ok(
    banishEvents.filter((event) => event.type === 'damage').every((event) => Math.abs(event.coefficient - 0.4) < 1e-9)
  );
  assert.deepEqual(
    banishEvents.filter((event) => event.type === 'damage').map((event) => Math.round(event.at * 1000)),
    [402, 521, 640]
  );
  assert.equal(
    banishEvents.filter((event) => event.type === 'condition' && event.condition === 'Chilled' && event.duration === 1)
      .length,
    3
  );
  assert.equal(
    banishEvents.filter((event) => event.type === 'condition' && event.condition === 'Torment' && event.duration === 3)
      .length,
    3
  );

  const anguish = simulate('Core', ['Call to Anguish', 'Unyielding Impact'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100
  });

  assert.ok(
    anguish.events.some(
      (event) =>
        event.type === 'damage' &&
        event.skillName === 'Call to Anguish' &&
        event.coefficient === 1.2 &&
        event.at === 0.804
    )
  );
  assert.ok(
    anguish.events.some(
      (event) =>
        event.skillName === 'Call to Anguish' &&
        event.condition === 'Chilled' &&
        event.duration === 2 &&
        event.at === 0.804
    )
  );
  assert.ok(
    anguish.events.some(
      (event) => event.type === 'control' && event.skillName === 'Call to Anguish' && event.at === 0.804
    )
  );
  assert.ok(
    anguish.events.some(
      (event) =>
        event.type === 'damage' &&
        event.skillName === 'Unyielding Impact' &&
        event.coefficient === 1 &&
        event.at === 1.787
    )
  );
  assert.deepEqual(
    anguish.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Unyielding Impact')
      .map((event) => [event.condition, event.stacks, event.duration]),
    [
      ['Burning', 1, 3],
      ['Torment', 4, 3],
      ['Poisoned', 1, 3]
    ]
  );
});

test('Embrace the Darkness empowers only the next pulse and releases', () => {
  const baseline = simulate(
    'Core',
    ['Embrace the Darkness', { type: 'wait', durationMs: 1100 }, 'Resist the Darkness'],
    {
      selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100
    }
  );
  const baselinePulse = baseline.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Embrace the Darkness' && event.condition === 'Torment'
  );

  assert.equal(baselinePulse.stacks, 1);
  assert.equal(baselinePulse.duration, 5);
  assert.equal(baselinePulse.at, 0.362);
  assert.ok(
    baseline.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Embrace the Darkness' && event.coefficient === 0.3
    )
  );
  assert.equal(baseline.endState.profession.activeUpkeeps.length, 0);

  const empowered = simulate(
    'Core',
    ['Embrace the Darkness', 'Banish Enchantment', { type: 'wait', durationMs: 600 }, 'Resist the Darkness'],
    {
      selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100
    }
  );
  const empoweredPulses = empowered.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Embrace the Darkness' && event.condition === 'Torment'
  );

  assert.deepEqual(
    empoweredPulses.map((event) => event.stacks),
    [1, 2]
  );
  assert.equal(empowered.endState.profession.activeUpkeeps.length, 0);
});

test('Dwarf skills resolve reinforcement pulses and hammer hit rate', () => {
  const road = simulate(
    'Core',
    ['Inspiring Reinforcement'],
    {
      selectedLegends: [LEGEND.DWARF, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DWARF,
      initialEnergy: 100
    },
    observationTail(5000)
  );

  assert.ok(
    road.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Inspiring Reinforcement' && event.coefficient === 1.5
    )
  );
  assert.ok(
    road.events.some(
      (event) => event.skillName === 'Inspiring Reinforcement' && event.condition === 'Weakness' && event.duration === 6
    )
  );
  assert.deepEqual(
    road.events
      .filter(
        (event) => event.type === 'buff' && event.skillName === 'Inspiring Reinforcement' && event.kind === 'stability'
      )
      .map((event) => [event.at, event.duration]),
    [
      [0.25, 3],
      [0.75, 3],
      [1.75, 3],
      [2.75, 3],
      [3.75, 3],
      [4.75, 3]
    ]
  );

  const engagement = simulate('Core', ['Forced Engagement'], {
    selectedLegends: [LEGEND.DWARF, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DWARF,
    initialEnergy: 100
  });

  assert.ok(engagement.events.some((event) => event.type === 'damage' && event.coefficient === 0.5));
  assert.ok(
    engagement.events.some((event) => event.type === 'control' && event.controlKind === 'taunt' && event.duration === 4)
  );
  assert.ok(engagement.events.some((event) => event.condition === 'Slow' && event.duration === 4));

  const hammers = simulate(
    'Core',
    ['Vengeful Hammers', { type: 'wait', durationMs: 1100 }, 'Release Hammers', { type: 'wait', durationMs: 1000 }],
    {
      selectedLegends: [LEGEND.DWARF, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DWARF,
      initialEnergy: 100
    }
  );
  const hammerHits = hammers.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Vengeful Hammers'
  );

  assert.equal(hammerHits.length, 9);
  assert.ok(hammerHits.every((event) => event.coefficient === 0.2));
  assert.equal(hammers.endState.profession.activeUpkeeps.length, 0);
});

test('Icerazor packets use player ownership and trigger player equipment', () => {
  const result = simulate('Renegade', ["Icerazor's Ire", { type: 'wait', durationMs: 6000 }], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
    relic: 'Shackles'
  });

  assert.ok(result.totalDamage > 0);
  assert.ok(
    result.resolvedEvents
      .filter((event) => event.skillName === "Icerazor's Ire")
      .every((event) => event.actorType === 'player')
  );
  assert.deepEqual(
    result.procSteps
      .filter((proc) => proc.type === 'relic_proc' && proc.skill === 'Relic of the Shackles')
      .map((proc) => proc.detail),
    ['tethered', 'damage']
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Relic of the Shackles')
      .length,
    1
  );
  const actionStart = result.steps[0].start / 1000;
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire");

  assert.deepEqual(
    hits.map((event) => Math.round((event.at - actionStart) * 1000)),
    [1020, 1181, 1342]
  );
  assert.equal(
    result.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Torment').at,
    hits[0].at
  );
  assert.equal(
    result.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Immobilized').at,
    hits[2].at
  );
});

test('enhanced Icerazor hit traits use its replaced packet timestamps', () => {
  const result = simulate('Renegade', ["Breakrazor's Bastion", "Icerazor's Ire", { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY],
    target: { defiant: true },
    initialEnergy: 100
  });
  const hitTimes = result.events
    .filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire")
    .map((event) => event.at);
  const fervorTimes = result.events
    .filter(
      (event) => event.type === 'buff' && event.skillName === 'Ambush Commander' && event.kind === 'kallas-fervor'
    )
    .map((event) => event.at);

  assert.deepEqual(fervorTimes, hitTimes);
});

test('Citadel Orders preserve their packet, pulse, cost, and recharge profiles', () => {
  assert.deepEqual(
    [SKILL.CITADEL_BOMBARDMENT, SKILL.HEROIC_COMMAND, SKILL.ORDERS_FROM_ABOVE].map((id) => {
      const skill = revenantCatalog.skillsById.get(id);

      return [skill.energyCost, skill.cooldown, skill.castTimeMs];
    }),
    [
      [35, 15, 600],
      [10, 10, 500],
      [20, 20, 0]
    ]
  );
  const quickBombardment = simulate('Renegade', ['Citadel Bombardment'], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.equal(quickBombardment.steps[0].fullCastMs, 600);
  const bombardment = simulate(
    'Renegade',
    ['Citadel Bombardment', 'Citadel Bombardment'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      selectedTraitIds: [TRAIT.VINDICATION],
      initialEnergy: 100
    },
    observationTail(2000)
  );

  assert.deepEqual(
    bombardment.steps.map((step) => [step.start, step.fullCastMs]),
    [
      [0, 600],
      [15600, 600]
    ]
  );
  const firstBombardmentHits = bombardment.events.filter(
    (event) => event.type === 'damage' && event.skillId === SKILL.CITADEL_BOMBARDMENT && event.at < 2
  );

  assert.equal(firstBombardmentHits.length, 10);
  assert.ok(firstBombardmentHits.every((event) => event.coefficient === 0.6));
  assert.deepEqual(
    firstBombardmentHits.map((event) => Math.round(event.at * 1000)),
    [845, 959, 1073, 1159, 1245, 1360, 1447, 1559, 1675, 1796]
  );
  const firstBurns = bombardment.events.filter(
    (event) =>
      event.type === 'condition' &&
      event.skillId === SKILL.CITADEL_BOMBARDMENT &&
      event.at < 2 &&
      event.condition === 'Burning' &&
      event.stacks === 1 &&
      event.duration === 1
  );

  assert.deepEqual(
    firstBurns.map((event) => Math.round(event.at * 1000)),
    firstBombardmentHits.map((event) => Math.round(event.at * 1000))
  );
  assert.equal(
    bombardment.events.filter(
      (event) =>
        event.type === 'control' &&
        event.skillName === 'Vindication' &&
        event.controlKind === 'daze' &&
        event.duration === 1
    ).length,
    2
  );

  const impossibleBombardment = simulate(
    'Renegade',
    ['Citadel Bombardment', 'Swap Legends', 'Impossible Odds', { type: 'wait', durationMs: 2000 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    }
  );

  assert.equal(
    impossibleBombardment.resolvedEvents.filter(
      (event) =>
        event.type === 'damage' && event.skillName === 'Impossible Odds' && event.triggeredBy === 'Citadel Bombardment'
    ).length,
    4
  );

  const orders = simulate(
    'Renegade',
    ['Orders from Above'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    },
    observationTail(3000)
  );

  assert.equal(orders.steps[0].fullCastMs, 0);
  assert.deepEqual(
    orders.events
      .filter(
        (event) => event.type === 'buff' && event.skillId === SKILL.ORDERS_FROM_ABOVE && event.kind === 'alacrity'
      )
      .map((event) => [event.at, event.duration, event.stacks]),
    [
      [0, 2, 1],
      [1, 2, 1],
      [2, 2, 1],
      [3, 2, 1]
    ]
  );

  const righteous = simulate(
    'Renegade',
    ['Orders from Above'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      selectedTraitIds: [TRAIT.RIGHTEOUS_REBEL],
      initialEnergy: 100
    },
    observationTail(5000)
  );

  assert.deepEqual(
    righteous.events
      .filter(
        (event) => event.type === 'buff' && event.skillId === SKILL.ORDERS_FROM_ABOVE && event.kind === 'alacrity'
      )
      .map((event) => event.at),
    [0, 1, 2, 3, 4, 5]
  );
});

test("Kalla's Fervor stacks, refreshes, and improves with Lasting Legacy", () => {
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER],
    target: { defiant: true },
    initialEnergy: 100
  };
  const base = simulate('Renegade', ['Citadel Bombardment', 'Heroic Command'], config);

  assert.equal(base.endState.profession.kallasFervor.length, 5);
  assert.deepEqual(
    base.endState.profession.kallasFervor.map((application) => Math.round(application.expiresAt * 1000)),
    [9100, 9100, 9100, 9159, 9245]
  );
  assert.ok(
    base.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillId === SKILL.HEROIC_COMMAND &&
        event.kind === 'might' &&
        event.stacks === 6 &&
        event.duration === 8
    )
  );

  const improved = simulate('Renegade', ['Citadel Bombardment', 'Heroic Command'], {
    ...config,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY]
  });

  assert.deepEqual(
    improved.endState.profession.kallasFervor.map((application) => Math.round(application.expiresAt * 1000)),
    [13100, 13100, 13100, 13159, 13245]
  );
  assert.ok(
    improved.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillId === SKILL.HEROIC_COMMAND &&
        event.kind === 'might' &&
        event.stacks === 9 &&
        event.duration === 8
    )
  );

  const siphon = simulate(
    'Renegade',
    ['Citadel Bombardment', { type: 'wait', durationMs: 2100 }, "Soulcleave's Summit", 'Shattershot'],
    {
      ...config,
      selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY]
    }
  ).resolvedEvents.find((event) => event.skillName === "Soulcleave's Summit" && /Life Siphon/.test(event.name));

  assert.equal(siphon.flatStrikeMultiplier, 1.15);

  const nourishment = simulate('Renegade', ['Citadel Bombardment', { type: 'wait', durationMs: 2100 }, 'Shattershot'], {
    ...config,
    food: 'Cilantro Lime Sous-Vide Steak',
    stats: { precision: 3100 },
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY]
  })
    .resolvedEvents.filter((event) => event.skillName === 'Nourishment')
    .at(-1);

  // The deterministic food proc occurs on Citadel Bombardment's second hit,
  // while two Kalla's Fervor stacks are active. The direct modifier checks
  // below cover the fully stacked Lasting Legacy multiplier.
  assert.equal(nourishment.flatStrikeMultiplier, 1.06);
  assert.ok(Math.abs(nourishment.damage - 344.5) < 1e-9);

  const modifierContext = (traitIds, condition = null) => ({
    config: { specialization: 'Renegade', traitIds, boons: {} },
    event: { actorType: 'player' },
    condition,
    time: 1,
    runtime: {
      profession: {
        core: {
          endurance: 100,
          maximumEndurance: 100
        },
        specialization: {
          kind: 'Renegade',
          state: {
            kallasFervorMaximumStacks: 5,
            kallasFervor: Array.from({ length: 6 }, () => ({
              at: 0,
              expiresAt: 10
            }))
          }
        }
      },
      boons: new Map()
    },
    query: {
      targetHasCondition: () => false,
      targetConditionStacks: () => 0
    }
  });

  assert.equal(revenantAttributeRules.modifyStrikeDamage(modifierContext([]), 1), 1.1);
  assert.equal(revenantAttributeRules.modifyConditionDamage(modifierContext([], 'Burning'), 1), 1.1);
  assert.equal(revenantAttributeRules.modifyStrikeDamage(modifierContext([TRAIT.LASTING_LEGACY]), 1), 1.25);
  assert.equal(
    revenantAttributeRules.modifyConditionDamage(modifierContext([TRAIT.LASTING_LEGACY], 'Burning'), 1),
    1.15
  );
  const additiveContext = modifierContext([
    TRAIT.DESTRUCTIVE_IMPULSES,
    TRAIT.FEROCIOUS_AGGRESSION,
    TRAIT.LASTING_LEGACY
  ]);

  additiveContext.config.boons.fury = true;
  additiveContext.config.secondaryWeapon = 'Sword';
  additiveContext.timeline = {
    activeSigilSetAt: () => ({
      strike: 1.05,
      strikeAdd: 0.05,
      condition: 1.05,
      conditionAdd: 0.05
    })
  };
  assert.equal(revenantAttributeRules.modifyStrikeDamage(additiveContext, 1.05), 1.475);
  additiveContext.condition = 'Burning';
  assert.ok(Math.abs(revenantAttributeRules.modifyConditionDamage(additiveContext, 1.05) - 1.375) < 1e-12);
});

test('Renegade critical traits and Blood Fury use their supplied intervals', () => {
  const critical = simulate('Renegade', ['Phase Traversal'], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.ENDLESS_ENMITY, TRAIT.BLOOD_FURY],
    target: { defiant: false },
    boons: { fury: false },
    stats: { precision: 4000 },
    initialEnergy: 100
  });

  assert.equal(critical.endState.profession.kallasFervor.length, 2);
  assert.ok(
    critical.events.some(
      (event) =>
        event.type === 'buff' && event.skillName === 'Endless Enmity' && event.kind === 'fury' && event.duration === 4
    )
  );

  const bleeding = simulate('Renegade', ['Shattershot'], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.BLOOD_FURY],
    boons: { fury: true }
  }).resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Shattershot' && event.condition === 'Bleeding'
  );

  assert.ok(Math.abs(bleeding.naturalExpiresAt - bleeding.at - 3.75) < 1e-9);
  assert.equal(
    revenantAttributeRules.modifyConditionDuration(
      {
        config: {
          specialization: 'Renegade',
          traitIds: [TRAIT.PACT_OF_PAIN, TRAIT.YEARNING_EMPOWERMENT, TRAIT.BLOOD_FURY],
          boons: { fury: true }
        },
        condition: 'Bleeding',
        time: 1,
        runtime: { boons: new Map() }
      },
      1.2
    ),
    1.7
  );
  assert.equal(
    revenantAttributeRules.modifyConditionDuration(
      {
        config: {
          specialization: 'Renegade',
          traitIds: [TRAIT.PACT_OF_PAIN],
          attributeProvenance: {
            professionStaticRulesApplied: true
          }
        },
        condition: 'Torment',
        time: 1,
        runtime: { boons: new Map() }
      },
      1.15
    ),
    1.15
  );
});

test('Renegade critical traits consume seeded critical outcomes', () => {
  const run = (seed) =>
    simulate('Renegade', ['Phase Traversal'], {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ASSASSIN,
      selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.ENDLESS_ENMITY],
      target: { defiant: false },
      boons: { fury: false },
      stats: { precision: 1945 },
      initialEnergy: 100,
      randomness: { mode: 'stochastic', seed }
    });
  const signature = (result) => {
    const hit = result.events.find((event) => event.type === 'damage' && event.skillName === 'Phase Traversal');
    const ambushCommander = result.events.some(
      (event) => event.type === 'buff' && event.skillName === 'Ambush Commander'
    );
    const endlessEnmity = result.events.some((event) => event.type === 'buff' && event.skillName === 'Endless Enmity');

    assert.equal(ambushCommander, hit.didCrit);
    assert.equal(endlessEnmity, hit.didCrit);

    return [hit.didCrit, ambushCommander, endlessEnmity];
  };

  assert.deepEqual(signature(run(7)), signature(run(7)));
  const criticalOutcomes = new Set();

  for (let seed = 1; seed <= 32; seed += 1) {
    criticalOutcomes.add(signature(run(seed))[0]);
  }

  assert.deepEqual([...criticalOutcomes].sort(), [false, true]);
});

test('Heartpiercer and Brutal Momentum apply multiplicative combat bonuses', () => {
  const context = (traitId, extra = {}) => ({
    config: {
      specialization: 'Renegade',
      traitIds: [traitId],
      boons: {},
      ...(extra.config || {})
    },
    event: { actorType: 'player' },
    condition: extra.condition,
    time: 1,
    runtime: {
      profession: {},
      boons: new Map(),
      ...(extra.runtime || {})
    },
    query: {
      targetHasCondition: () => true,
      targetConditionStacks: () => 1
    }
  });

  assert.equal(revenantAttributeRules.modifyStrikeDamage(context(TRAIT.HEARTPIERCER), 1), 1.15);
  assert.equal(
    revenantAttributeRules.modifyConditionDamage(context(TRAIT.HEARTPIERCER, { condition: 'Bleeding' }), 1),
    1.25
  );
  assert.equal(
    revenantAttributeRules.modifyCriticalChance(
      context(TRAIT.BRUTAL_MOMENTUM, {
        runtime: {
          profession: { endurance: 100, maximumEndurance: 100 }
        }
      }),
      0.2
    ),
    0.53
  );
  assert.ok(
    Math.abs(
      revenantAttributeRules.modifyCriticalChance(
        context(TRAIT.BRUTAL_MOMENTUM, {
          runtime: {
            profession: { endurance: 50, maximumEndurance: 100 }
          }
        }),
        0.2
      ) - 0.3
    ) < 1e-9
  );
});

test('Band Together makes the next Renegade summon instant and enhanced', () => {
  const base = simulate(
    'Renegade',
    ["Icerazor's Ire"],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    },
    observationTail(3000)
  );

  assert.equal(base.steps[0].fullCastMs, 520);
  const quickBase = simulate('Renegade', ["Icerazor's Ire"], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.equal(quickBase.steps[0].fullCastMs, 520);
  assert.deepEqual(
    base.events
      .filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire")
      .map((event) => event.coefficient),
    [2, 2, 2]
  );
  assert.ok(base.events.some((event) => event.condition === 'Immobilized' && event.duration === 2));
  assert.equal(
    base.events.some((event) => event.condition === 'Chilled'),
    false
  );

  const darkrazor = simulate('Renegade', ["Darkrazor's Daring", { type: 'wait', durationMs: 1600 }], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.equal(darkrazor.steps[0].fullCastMs, 500);
  assert.deepEqual(
    darkrazor.events
      .filter(
        (event) => event.skillName === "Darkrazor's Daring" && (event.type === 'damage' || event.type === 'control')
      )
      .map((event) => [event.type, Math.round((event.at - darkrazor.steps[0].end / 1000) * 1000), event.actorType]),
    [
      ['damage', 1000, 'player'],
      ['control', 1000, 'player']
    ]
  );
  assert.deepEqual(
    darkrazor.events
      .filter(
        (event) => event.skillName === "Darkrazor's Daring" && event.type === 'buff' && event.kind === 'stability'
      )
      .map((event) => [
        event.duration,
        event.stacks,
        event.recipients,
        Math.round((event.at - darkrazor.steps[0].end / 1000) * 1000)
      ]),
    [
      [1, 1, 'self', 0],
      [6, 3, 'allies', 1000]
    ]
  );

  const enhancedRazorclaw = simulate(
    'Renegade',
    ["Icerazor's Ire", "Razorclaw's Rage", { type: 'wait', durationMs: 1000 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    }
  );

  assert.equal(
    enhancedRazorclaw.events.find(
      (event) => event.skillName === "Razorclaw's Rage" && event.type === 'condition' && event.condition === 'Torment'
    )?.actorType,
    'player'
  );

  const enhanced = simulate(
    'Renegade',
    ["Razorclaw's Rage", "Icerazor's Ire", "Darkrazor's Daring", { type: 'wait', durationMs: 1100 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    }
  );

  assert.deepEqual(
    enhanced.steps.slice(0, 3).map((step) => step.fullCastMs),
    [500, 0, 500]
  );
  assert.ok(
    enhanced.events.some(
      (event) => event.skillName === "Icerazor's Ire" && event.condition === 'Chilled' && event.duration === 1.5
    )
  );

  const quickEnhanced = simulate(
    'Renegade',
    ["Razorclaw's Rage", "Icerazor's Ire", { type: 'wait', durationMs: 1000 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      boons: { quickness: true }
    },
    observationTail(1000)
  );
  const quickIcerazorHits = quickEnhanced.events.filter(
    (event) => event.type === 'damage' && event.skillName === "Icerazor's Ire"
  );

  assert.deepEqual(
    quickIcerazorHits.map((event) => Math.round((event.at - quickEnhanced.steps[1].start / 1000) * 1000)),
    [1200, 1361, 1522]
  );
  assert.ok(
    quickEnhanced.events
      .filter((event) => event.skillName === "Icerazor's Ire" && event.type === 'condition')
      .every((event) => event.actorType === 'player')
  );
  assert.equal(
    quickEnhanced.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Torment').at,
    quickIcerazorHits[0].at
  );
  assert.equal(
    quickEnhanced.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Immobilized').at,
    quickIcerazorHits[2].at
  );
  assert.deepEqual(
    quickEnhanced.events
      .filter((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Chilled')
      .map((event) => Math.round((event.at - quickEnhanced.steps[1].start / 1000) * 1000)),
    [1200, 1361, 1522]
  );

  const enhancedDarkrazor = simulate(
    'Renegade',
    ["Icerazor's Ire", "Darkrazor's Daring", { type: 'wait', durationMs: 1100 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    }
  );

  assert.deepEqual(
    enhancedDarkrazor.steps.slice(0, 2).map((step) => step.fullCastMs),
    [520, 0]
  );
  assert.ok(
    enhancedDarkrazor.events.some(
      (event) =>
        event.skillName === "Darkrazor's Daring" &&
        event.type === 'control' &&
        event.duration === 2 &&
        event.breakbar === 600 &&
        event.bonusDefianceBreak === 400
    )
  );
  assert.deepEqual(
    enhancedDarkrazor.events
      .filter((event) => event.skillName === "Darkrazor's Daring" && event.type === 'buff')
      .map((event) => [event.kind, event.duration, event.stacks, event.recipients]),
    [
      ['stability', 1, 1, 'self'],
      ['resistance', 4, 1, 'allies'],
      ['protection', 4, 1, 'allies'],
      ['stability', 6, 3, 'allies']
    ]
  );

  const concurrent = simulate('Renegade', ["Icerazor's Ire", { name: "Razorclaw's Rage", offset: 100 }], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100
  });

  assert.deepEqual(
    concurrent.steps.map((step) => [step.start, step.fullCastMs]),
    [
      [0, 520],
      [100, 0]
    ]
  );

  const primed = simulate('Renegade', ["Icerazor's Ire"], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100
  });
  const razorclaw = revenantCatalog.skillsByName.get("Razorclaw's Rage");

  assert.equal(
    paletteSkillIsInstant(
      { profession: revenantProfession },
      {
        professionState: primed.endState.profession,
        time: primed.endState.time / 1000
      },
      razorclaw
    ),
    true
  );
});

test('enhanced Renegade summons do not rearm Band Together', () => {
  const result = simulate(
    'Renegade',
    ["Breakrazor's Bastion", "Icerazor's Ire", 'Swap Legends', 'Swap Legends', "Icerazor's Ire"],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    }
  );

  assert.deepEqual([result.steps[1].fullCastMs, result.steps[4].fullCastMs], [0, 520]);
});

test('Band Together expires four seconds after the priming summon', () => {
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100
  };
  const withinWindow = simulate(
    'Renegade',
    ["Icerazor's Ire", { type: 'wait', durationMs: 3999 }, "Darkrazor's Daring"],
    config
  );
  const atExpiry = simulate(
    'Renegade',
    ["Icerazor's Ire", { type: 'wait', durationMs: 4000 }, "Darkrazor's Daring"],
    config
  );

  assert.equal(withinWindow.steps[2].fullCastMs, 0);
  assert.equal(atExpiry.steps[2].fullCastMs, 500);
});

test('All for One refunds Energy and halves enhanced-skill recharge', () => {
  const result = simulate('Renegade', ["Razorclaw's Rage", "Icerazor's Ire", "Icerazor's Ire"], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.ALL_FOR_ONE],
    initialEnergy: 100
  });

  assert.equal(result.steps[2].start, 5500);
  const refunds = result.events.filter((event) => event.type === 'revenant.state' && event.reason === 'all-for-one');

  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].state.energy, 65);
});

test("Razorclaw models party procs with the Revenant's condition stats", () => {
  const result = simulate(
    'Renegade',
    ["Razorclaw's Rage"],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      allies: { count: 4, strikesPerSecond: 1 },
      stats: { conditionDamage: 1500, expertise: 300 }
    },
    observationTail(5000)
  );
  const partyBuff = result.events.find((event) => event.type === 'buff' && event.kind === 'razorclaws-rage');

  assert.equal(partyBuff.stacks, 4);
  assert.equal(partyBuff.duration, 5);
  assert.equal(partyBuff.recipientCount, 5);
  const personalPackets = result.resolvedEvents.filter(
    (event) =>
      event.skillName === "Razorclaw's Rage" &&
      !event.triggeredByAlly &&
      (event.type === 'damage' || event.type === 'condition')
  );

  assert.ok(personalPackets.length > 0);
  assert.ok(personalPackets.every((event) => event.actorType === 'player'));
  const allyBleeds = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === "Razorclaw's Rage" && event.triggeredByAlly
  );

  assert.equal(allyBleeds.length, 16);
  assert.ok(
    allyBleeds.every((event) => event.stacks === 1 && Math.abs(event.naturalExpiresAt - event.at - 3.6) < 1e-9)
  );
});

test('Soulcleave procs both damage packets and recharges from dismissal', () => {
  const result = simulate(
    'Renegade',
    [
      "Soulcleave's Summit",
      "Icerazor's Ire",
      { type: 'wait', durationMs: 1100 },
      'Dismiss Lieutenant Soulcleave',
      "Soulcleave's Summit"
    ],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      allies: { count: 2, strikesPerSecond: 1 }
    }
  );
  const procs = result.resolvedEvents.filter(
    (event) => event.skillName === "Soulcleave's Summit" && /Additional Strike|Life Siphon/.test(event.name)
  );

  assert.ok(procs.some((event) => event.coefficient === 0.8));
  assert.ok(procs.some((event) => event.flatStrikePowerCoeff === 0.1));
  const dismiss = result.steps.find((step) => step.skill === 'Dismiss Lieutenant Soulcleave');

  assert.equal(result.steps.at(-1).start, dismiss.end + 3000);
});

test('Assassin buffs trigger on hit and upkeep releases own their cooldowns', () => {
  const daggers = simulate('Core', ['Enchanted Daggers', 'Phase Traversal', { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });
  const siphon = daggers.resolvedEvents.find((event) => event.skillName === 'Enchanted Daggers');

  assert.equal(siphon.at, 1.5);
  assert.equal(siphon.flatStrikeBase, 1028);
  assert.equal(siphon.flatStrikePowerCoeff, 0.06);
  assert.equal(daggers.endState.profession.enchantedDaggers.charges, 5);

  const odds = simulate('Core', ['Impossible Odds', 'Phase Traversal', 'Relinquish Power', 'Impossible Odds'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(odds.steps.at(-1).start, 1500);
  assert.ok(
    odds.resolvedEvents.some(
      (event) => event.skillName === 'Impossible Odds' && event.coefficient === 0.65 && event.at === 0.75
    )
  );

  const oddsWithAir = simulate('Core', ['Impossible Odds', 'Phase Traversal', { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100,
    stats: {
      precision: 1000,
      criticalChanceBonus: 45
    },
    sigilSets: [
      { names: ['Air'], strike: 1, condition: 1 },
      { names: [], strike: 1, condition: 1 }
    ]
  });

  assert.deepEqual(
    oddsWithAir.resolvedEvents
      .filter((event) => event.skillName === 'Impossible Odds')
      .map((event) => [event.at, event.triggeredBy]),
    [
      [0.75, 'Phase Traversal'],
      [1, 'Sigil of Air']
    ]
  );
  assert.ok(
    oddsWithAir.resolvedEvents.some(
      (event) => event.skillName === 'Sigil of Air' && event.triggeredBy === 'Impossible Odds'
    )
  );

  const starved = simulate('Core', ['Impossible Odds', { type: 'wait', durationMs: 1100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 6
  });
  const impossible = revenantCatalog.skillsByName.get('Impossible Odds');

  assert.equal(starved.schedulerState.cooldowns.get(impossible.id), 5);
  assert.equal(starved.endState.profession.activeUpkeeps.length, 0);

  const jade = revenantCatalog.skillsByName.get('Jade Winds');

  assert.equal(jade.effects[0].coefficient, 3);
  assert.equal(jade.effects[1].stacks, 6);
  assert.equal(jade.energyCost, 35);
  assert.equal(jade.cooldown, 10);
});

test('Alliance Tactics switches the legal Vindicator skill side', () => {
  const result = simulate('Vindicator', ["Nomad's Advance", 'Alliance Tactics', 'Tree Song'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.allianceSide, 'kurzick');
});

test('Vindicator Luxon skills use supplied combat mechanics', () => {
  const skill = (name) => revenantCatalog.skillsByName.get(name);
  const nomad = skill("Nomad's Advance");

  assert.equal(nomad.cooldown, 3);
  assert.equal(nomad.energyCost, 10);
  assert.equal(nomad.castTimeMs, 960);
  assert.equal(nomad.quicknessCastTimeMs, undefined);
  assert.equal(nomad.unaffectedByQuickness, true);
  assert.equal(nomad.effects[0].coefficient, 4);
  assert.deepEqual(
    nomad.effects.slice(1).map((effect) => [effect.boon, effect.stacks, effect.duration]),
    [['might', 1, 6]]
  );

  const scavenger = skill('Scavenger Burst');

  assert.equal(scavenger.cooldown, 3);
  assert.equal(scavenger.energyCost, 15);
  assert.equal(scavenger.effects[0].coefficient, 2.25);
  assert.deepEqual(
    scavenger.effects.slice(1).map((effect) => [effect.condition ?? effect.boon, effect.stacks, effect.duration]),
    [
      ['Burning', 2, 5],
      ['quickness', 1, 5],
      ['fury', 1, 5]
    ]
  );

  const rage = skill("Reaver's Rage");

  assert.equal(rage.cooldown, 10);
  assert.equal(rage.energyCost, 15);
  assert.equal(rage.effects[0].coefficient, 2.22);
  assert.deepEqual(
    rage.effects.filter((effect) => effect.boon === 'stability').map((effect) => [effect.stacks, effect.duration]),
    [
      [1, 1],
      [1, 6]
    ]
  );
  assert.equal(rage.effects.at(-1).metadata.controlKind, 'daze');

  const spear = skill('Spear of Archemorus');

  assert.equal(spear.cooldown, 12);
  assert.equal(spear.energyCost, 20);
  assert.equal(spear.castTimeMs, 720);
  assert.equal(spear.quicknessCastTimeMs, 480);
  assert.equal(spear.effects[0].coefficient, 5);
  assert.equal(spear.effects[0].atMs, 2960);
  assert.equal(spear.effects[0].timingAnchor, 'castEnd');
  assert.equal(spear.effects[1].condition, 'Torment');
  assert.equal(spear.effects[1].stacks, 5);

  const normal = simulate('Vindicator', ['Spear of Archemorus', { name: '__wait', waitMs: 4000 }], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100
  });
  const quick = simulate('Vindicator', ['Spear of Archemorus'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.equal(normal.steps[0].fullCastMs, 720);
  assert.equal(quick.steps[0].fullCastMs, 480);
  assert.ok(
    Math.abs(
      normal.events.find((event) => event.type === 'damage' && event.skillName === 'Spear of Archemorus')?.at - 3.68
    ) < 1e-12
  );
});

test('Vindicator dodge traits apply current endurance and damage behavior', () => {
  const config = {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    selectedTraitIds: [TRAIT.LEVIATHAN_STRENGTH, TRAIT.REAVERS_CURSE, TRAIT.FORERUNNER_OF_DEATH],
    initialEnergy: 100,
    boons: { quickness: true, alacrity: true, vigor: true }
  };
  const result = simulate('Vindicator', ['Dodge', 'Energy Meld', 'Dodge'], config);
  const dodges = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Death Drop');
  const meld = result.steps.find((step) => step.skill === 'Energy Meld');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    dodges.map((event) => event.coefficient),
    [3.3, 6.6]
  );
  assert.deepEqual(
    dodges.map((event) => event.at),
    [0.16, 0.8]
  );
  assert.equal(
    revenantAttributeRules.modifyStrikeDamage(
      {
        config: {
          specialization: 'Vindicator',
          traitIds: [TRAIT.FEROCIOUS_AGGRESSION, TRAIT.FORERUNNER_OF_DEATH],
          boons: { fury: true }
        },
        event: {
          actorType: 'player',
          forerunnerOfDeathActive: true
        },
        time: 1,
        runtime: { profession: {} }
      },
      1
    ),
    1.35
  );
  assert.equal(result.steps[0].fullCastMs, 200);
  assert.equal(meld.fullCastMs, 440);
  assert.equal(result.endState.cooldowns['Energy Meld'].readyAt, meld.end + 8000);
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.kind === 'forerunner-of-death' && event.duration === 10
    )
  );
});

test('Vindicator Dodge waits for the exact endurance recharge time', () => {
  const withoutVigor = simulate('Vindicator', ['Dodge', 'Dodge', 'Dodge'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    boons: { vigor: false }
  });
  const withVigor = simulate('Vindicator', ['Dodge', 'Dodge', 'Dodge'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    boons: { vigor: true }
  });

  assert.deepEqual(withoutVigor.warnings, []);
  assert.deepEqual(
    withoutVigor.steps.map((step) => step.start),
    [0, 200, 10000]
  );
  assert.deepEqual(withVigor.warnings, []);
  assert.deepEqual(
    withVigor.steps.map((step) => step.start),
    [0, 200, 6667]
  );
});

test('Vindicator resource display includes live endurance', () => {
  const core = revenantProfession.ui.resourceViews({
    specialization: 'Core',
    professionState: { energy: 40, endurance: 25, maximumEndurance: 100 }
  });
  const conduit = revenantProfession.ui.resourceViews({
    specialization: 'Conduit',
    professionState: { energy: 40, affinity: 3 }
  });
  const vindicator = revenantProfession.ui.resourceViews({
    specialization: 'Vindicator',
    professionState: { energy: 40, endurance: 25, maximumEndurance: 100 }
  });

  assert.deepEqual(
    core.map((view) => view.id),
    ['energy']
  );
  assert.deepEqual(
    conduit.map((view) => view.id),
    ['energy', 'affinity']
  );
  assert.deepEqual(
    conduit.find((view) => view.id === 'affinity'),
    {
      id: 'affinity',
      singular: 'affinity',
      plural: 'affinity',
      maximum: 5,
      value: 3,
      canStart: false,
      step: 1,
      displayMode: 'pips',
      pipStyle: 'revenant-affinity',
      shortLabel: 'Aff',
      statusLabel: 'Current'
    }
  );
  assert.deepEqual(
    vindicator.map((view) => view.id),
    ['energy', 'endurance']
  );
  assert.deepEqual(
    vindicator.find((view) => view.id === 'endurance'),
    {
      id: 'endurance',
      singular: 'endurance',
      plural: 'endurance',
      maximum: 100,
      value: 25,
      canStart: false,
      step: 1,
      displayMode: 'bar',
      pipStyle: 'endurance',
      paletteSkillId: -5,
      shortLabel: 'End',
      statusLabel: 'Current'
    }
  );
});

test('Vindicator dodges reset interrupted autoattack chains', () => {
  const result = simulate('Vindicator', ['Preparation Thrust', 'Dodge', 'Preparation Thrust'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ASSASSIN,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    boons: { vigor: true }
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Preparation Thrust', 'Dodge', 'Preparation Thrust']
  );
});

test('Sigil of Energy restores 50 endurance on Revenant legend swap', () => {
  const result = simulate('Vindicator', ['__combat_start', 'Dodge', 'Swap Legends', 'Dodge'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ALLIANCE],
    startingLegend: LEGEND.ASSASSIN,
    sigilSets: [{ names: ['Energy'] }, { names: [] }]
  });
  const energyProc = result.events.find((event) => event.type === 'proc' && event.name === 'Sigil of Energy');
  const enduranceGain = result.events.find((event) => event.type === 'resource' && event.sourceId === 'sigil.energy');
  const dodgeStates = result.events.filter((event) => event.type === 'revenant.state' && event.reason === 'dodge');

  assert.deepEqual(result.warnings, []);
  assert.equal(energyProc.sourceSkill, 'Swap Legends');
  assert.equal(enduranceGain.amount, 50);
  assert.equal(dodgeStates.length, 2);
  assert.equal(dodgeStates[1].state.endurance, 50);
});

test('Call of the Alliance grants five endurance plus three per hit', () => {
  const result = simulate('Vindicator', ['Dodge', 'Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ALLIANCE],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.SONG_OF_THE_MISTS]
  });
  const swapState = result.events.find((event) => event.type === 'revenant.state' && event.reason === 'legend-swap');

  const call = revenantCatalog.skillsById.get(SKILL.CALL_OF_THE_ALLIANCE);

  assert.equal(call.resourceGain, 8);
  assert.equal(call.effects[0].coefficient, 0.93);
  assert.ok(result.events.some((event) => event.type === 'damage' && event.name === 'Call of the Alliance'));
  assert.equal(swapState.state.endurance, 59);
});

test('Vindicator Dodge + Auto palette action uses the current chain step', () => {
  let changeCount = 0;
  const app = {
    profession: revenantProfession,
    skills: revenantCatalog.skills,
    skillById: revenantCatalog.skillsById,
    skillByName: revenantCatalog.skillsByName,
    results: {
      endState: {
        activeWeaponSet: 1,
        profession: { autoattackChains: {} }
      }
    },
    build: {
      weapons: ['Sword', 'Sword'],
      alternateWeapons: ['Greatsword', ''],
      startingWeaponSet: 1,
      rotation: []
    },
    adapter: {
      eliteSpecialization: () => 'Vindicator',
      isSkillAvailable: () => true
    },
    changed: () => {
      changeCount += 1;
    }
  };

  assert.equal(currentAutoattackSkill(app).name, 'Preparation Thrust');
  const paletteSkill = paletteActionSkills(app, 'Vindicator').find(
    (skill) => skill.name === VINDICATOR_DODGE_AUTO_ACTION
  );

  assert.equal(paletteSkill.name, VINDICATOR_DODGE_AUTO_ACTION);
  assert.equal(paletteSkillView(app, paletteSkill).draggable, true);
  assert.deepEqual(
    vindicatorDodgeAutoRotationEntries({
      specialization: 'Vindicator',
      activeAutoattack: currentAutoattackSkill(app)
    }),
    [
      {
        type: 'cast',
        skillId: SKILL.PREPARATION_THRUST
      },
      {
        type: 'cast',
        skillId: -5,
        concurrentOffsetMs: 0
      }
    ]
  );
  const firstInsertion = resolvePaletteDropItem(app, VINDICATOR_DODGE_AUTO_ACTION);

  assert.deepEqual(firstInsertion, [
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST
    },
    {
      type: 'cast',
      skillId: -5,
      concurrentOffsetMs: 0
    }
  ]);
  assert.equal(insertRotationItems(app, firstInsertion), true);
  assert.deepEqual(app.build.rotation, [
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST
    },
    {
      type: 'cast',
      skillId: -5,
      concurrentOffsetMs: 0
    }
  ]);
  assert.equal(changeCount, 1);

  app.build.rotation = [{ type: 'cast', skillId: 'Tail' }];
  app.rotationInsertionIndex = 0;
  const secondInsertion = resolvePaletteDropItem(app, VINDICATOR_DODGE_AUTO_ACTION);

  assert.equal(insertRotationItems(app, secondInsertion), true);
  assert.deepEqual(app.build.rotation, [
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST
    },
    {
      type: 'cast',
      skillId: -5,
      concurrentOffsetMs: 0
    },
    { type: 'cast', skillId: 'Tail' }
  ]);
  assert.equal(app.rotationInsertionIndex, 2);
  assert.equal(changeCount, 2);

  app.results.endState.profession.autoattackChains[SKILL.PREPARATION_THRUST] = SKILL.BRUTAL_BLADE;
  assert.equal(currentAutoattackSkill(app).name, 'Brutal Blade');

  const combined = simulate(
    'Vindicator',
    ['Preparation Thrust', 'Brutal Blade', { name: 'Dodge', skillId: -5, offset: 0 }],
    {
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ASSASSIN,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword'
    }
  );

  assert.deepEqual(combined.warnings, []);
  assert.equal(combined.steps[1].start, combined.steps[2].start);
});

test('Vindicator legend skills preserve the Greatsword autoattack chain', () => {
  const result = simulate('Vindicator', ['Mist Swing', 'Mist Slash', 'Spear of Archemorus', 'Arcing Mists'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    primaryWeapon: 'Greatsword',
    secondaryWeapon: '',
    initialEnergy: 100
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Mist Swing', 'Mist Slash', 'Spear of Archemorus', 'Arcing Mists']
  );
});

test('Imperial Guard is ordered before True Strike and defaults to an 80ms cancel', () => {
  const paletteApp = {
    profession: revenantProfession,
    skills: revenantCatalog.skills,
    build: {
      weapons: ['Greatsword', ''],
      alternateWeapons: ['Sword', 'Sword']
    },
    adapter: {
      eliteSpecialization: () => 'Vindicator',
      isSkillAvailable: () => true
    }
  };

  assert.deepEqual(
    weaponSkills(paletteApp)
      .filter((skill) => skill.slot === 'Weapon_4')
      .map((skill) => skill.name),
    ['Imperial Guard', 'True Strike']
  );

  const config = {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100,
    primaryWeapon: 'Greatsword',
    secondaryWeapon: ''
  };
  const canceledIntoStrike = simulate('Vindicator', ['Imperial Guard', 'True Strike'], config);

  assert.deepEqual(canceledIntoStrike.warnings, []);
  assert.equal(canceledIntoStrike.steps[0].fullCastMs, 2000);
  assert.equal(canceledIntoStrike.steps[0].end, 80);
  assert.equal(canceledIntoStrike.steps[0].interrupted, true);
  assert.equal(canceledIntoStrike.steps[1].start, 80);
  assert.equal(
    canceledIntoStrike.events.find((event) => event.skillName === 'Imperial Guard' && event.kind === 'blocking')
      .duration,
    0.08
  );
  assert.equal(
    canceledIntoStrike.events.find((event) => event.skillName === 'True Strike' && event.type === 'damage').coefficient,
    1.5
  );

  const completedChannel = simulate(
    'Vindicator',
    [{ name: 'Imperial Guard', interruptMs: 2000 }, 'True Strike'],
    config
  );

  assert.deepEqual(completedChannel.warnings, []);
  assert.equal(completedChannel.steps[0].interrupted, false);
  assert.equal(completedChannel.steps[1].start, 2000);
  assert.equal(
    completedChannel.events.find((event) => event.skillName === 'Imperial Guard' && event.kind === 'blocking').duration,
    2
  );
});

test('Deathstrike weapon palette keeps the primary skill timing on cooldown', () => {
  const app = {
    profession: revenantProfession,
    skills: revenantCatalog.skills,
    results: {
      endState: {
        time: 720,
        cooldowns: {
          Deathstrike: { readyAt: 12420, remaining: 11700 }
        }
      }
    },
    build: {
      weapons: ['Sword', 'Sword'],
      alternateWeapons: ['', '']
    },
    adapter: {
      eliteSpecialization: () => 'Conduit',
      isSkillAvailable: () => true
    }
  };
  const deathstrike = weaponSkills(app).find((skill) => skill.name === 'Deathstrike');

  assert.equal(deathstrike.id, SKILL.DEATHSTRIKE);
  assert.match(paletteSkillView(app, deathstrike).title, /Cast: 1\.08s/);
  assert.doesNotMatch(paletteSkillView(app, deathstrike).title, /Instant cast/);
});

test('Power Conduit skill profiles retain their impact timing, coefficients, and cooldowns', () => {
  const skill = (name) => revenantCatalog.skillsByName.get(name);
  const cooldowns = {
    Deathstrike: 15,
    'Shackling Wave': 15,
    'Chilling Isolation': 5,
    'Twin Moon Sweep': 3,
    'Beguiling Haze': 10,
    'Release Potential: Dervish': 10,
    "Gladiator's Defense": 5,
    'Release Potential: Assassin': 10,
    "Eternity's Requiem": 15,
    "Phantom's Onslaught": 8,
    'Mist Unleashed': 3,
    'Cosmic Wisdom': 20
  };

  for (const [name, cooldown] of Object.entries(cooldowns)) {
    assert.equal(skill(name).cooldown, cooldown, name);
  }

  for (const [name, castTimeMs, coefficient] of [
    ['Preparation Thrust', 540, 0.75],
    ['Brutal Blade', 840, 0.8],
    ['Mist Swing', 400, 0.7],
    ['Mist Slash', 600, 0.8],
    ['Arcing Mists', 680, 1.2],
    ['Mist Unleashed', 780, 1.6],
    ["Phantom's Onslaught", 657, 1.6]
  ]) {
    assert.equal(skill(name).castTimeMs, castTimeMs, name);
    assert.equal(skill(name).effects.find((effect) => effect.type === 'strike').coefficient, coefficient, name);
  }

  for (const [name, castTimeMs] of [
    ['Mist Swing', 400],
    ['Mist Slash', 600],
    ['Arcing Mists', 680]
  ]) {
    assert.equal(skill(name).castTimeMs, castTimeMs, `${name} cast timing`);
    assert.equal(skill(name).quicknessCastTimeMs, undefined, name);
    assert.equal(skill(name).unaffectedByQuickness, true, name);
  }

  for (const [name, quicknessCastTimeMs] of [
    ['Release Potential: Dervish', 680],
    ['Shackling Wave', 800],
    ['Deathstrike', 720],
    ['Twin Moon Sweep', 920],
    ['Preparation Thrust', 360],
    ['Brutal Blade', 560],
    ['Rift Slash', 480],
    ["Eternity's Requiem", 840],
    ["Phantom's Onslaught", 438],
    ['Mist Unleashed', 520],
    ['Release Potential: Assassin', 740]
  ]) {
    assert.equal(skill(name).quicknessCastTimeMs, quicknessCastTimeMs, name);
  }

  assert.equal(skill('Chilling Isolation').castTimeMs, 680);
  assert.equal(skill('Chilling Isolation').quicknessCastTimeMs, undefined);
  assert.equal(skill('Chilling Isolation').unaffectedByQuickness, true);
  assert.equal(skill('Chilling Isolation').defaultInterruptMs, undefined);
  assert.equal(skill('Chilling Isolation').paletteInterruptMs, 480);
  assert.equal(suggestedPaletteInterruptMs(skill('Chilling Isolation')), 480);
  assert.equal(skill('Deathstrike').rechargeAnchor, 'castStart');
  assert.equal(skill('Deathstrike').rechargeOffsetMs, 420);
  assert.equal(skill("Phantom's Onslaught").dashTimeMs, 38);
  assert.equal(skill("Phantom's Onslaught").hitDelayMs, 400);
  assert.equal(skill("Phantom's Onslaught").rechargeAnchor, 'castStart');
  assert.equal(skill("Phantom's Onslaught").rechargeOffsetMs, 420);
  assert.equal(
    revenantCatalog.balanceProfilesById
      .get(CONDUIT_BALANCE_PROFILE_IDS.enhancedEmbodiment)
      .effects.find((effect) => effect.kind === 'cosmic-wisdom-extension').duration,
    1
  );
  assert.equal(
    revenantCatalog.skillsById.get(SKILL.FORM_OF_THE_DERVISH_ATTACK).effects.find((effect) => effect.type === 'strike')
      .coefficient,
    0.8
  );
  assert.equal(
    revenantCatalog.skillsById.get(SKILL.GLADIATORS_DEFENSE).effects.find((effect) => effect.type === 'strike')
      .coefficient,
    1.5
  );
  assert.equal(
    revenantCatalog.skillsById.get(SKILL.RELEASE_POTENTIAL_ASSASSIN).effects.find((effect) => effect.type === 'strike')
      .ticks[0].coefficient,
    0.6
  );

  const config = {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    boons: { quickness: true, alacrity: true }
  };
  const damageTimeline = (result, skillName) =>
    result.events
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .map((event) => [Math.round(event.at * 1000), event.name, event.coefficient]);

  const deathstrike = simulate('Conduit', ['Deathstrike'], config);

  assert.deepEqual(damageTimeline(deathstrike, 'Deathstrike'), [
    [320, 'Initial Damage', 0.45],
    [600, 'Final Damage', 2.67]
  ]);
  assert.deepEqual(deathstrike.endState.cooldowns.Deathstrike, {
    readyAt: 12420,
    remaining: 11700
  });
  assert.deepEqual(
    damageTimeline(simulate('Conduit', ['Shackling Wave'], config, observationTail(1000)), 'Shackling Wave'),
    [
      [640, 'Initial Damage', 1.2],
      [720, 'Additional Strikes', 0.4],
      [800, 'Additional Strikes', 0.4],
      [880, 'Additional Strikes', 0.4],
      [960, 'Additional Strikes', 0.4],
      [1040, 'Additional Strikes', 0.4]
    ]
  );
  const combined = simulate('Conduit', ['Deathstrike', 'Shackling Wave'], config);
  const combinedRows = skillBreakdownRows(combined);

  for (const skillName of ['Deathstrike', 'Shackling Wave']) {
    const resolvedDamage = combined.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .reduce((sum, event) => sum + event.damage, 0);

    assert.ok(Math.abs(combinedRows.find((row) => row.name === skillName).strike - resolvedDamage) < 1e-9, skillName);
  }

  const chilling = simulate('Conduit', ['Chilling Isolation'], config);

  assert.equal(chilling.steps[0].fullCastMs, 680);
  assert.equal(chilling.steps[0].end, 680);
  assert.equal(chilling.steps[0].interrupted, false);
  assert.deepEqual(damageTimeline(chilling, 'Chilling Isolation'), [
    [280, 'Chilling Isolation — Packet 1', 0.8],
    [480, 'Isolated Damage', 1.6]
  ]);

  const paletteChilling = simulate(
    'Conduit',
    [
      {
        name: 'Chilling Isolation',
        interruptMs: skill('Chilling Isolation').paletteInterruptMs
      }
    ],
    config,
    observationTail(1000)
  );

  assert.equal(paletteChilling.steps[0].end, 480);
  assert.equal(paletteChilling.steps[0].interrupted, true);
  const interruptedChilling = simulate(
    'Conduit',
    [
      {
        name: 'Chilling Isolation',
        interruptMs: 420
      }
    ],
    config,
    observationTail(1000)
  );

  assert.equal(interruptedChilling.steps[0].end, 420);
  assert.equal(interruptedChilling.steps[0].interrupted, true);
  assert.deepEqual(damageTimeline(interruptedChilling, 'Chilling Isolation'), [
    [280, 'Chilling Isolation — Packet 1', 0.8],
    [480, 'Isolated Damage', 1.6]
  ]);

  const earlyChilling = simulate('Conduit', [{ name: 'Chilling Isolation', interruptMs: 419 }], config);

  assert.deepEqual(damageTimeline(earlyChilling, 'Chilling Isolation'), []);

  const fullChilling = simulate('Conduit', [{ name: 'Chilling Isolation', interruptMs: 680 }], config);

  assert.equal(fullChilling.steps[0].end, 680);
  assert.equal(fullChilling.steps[0].interrupted, false);
  assert.deepEqual(damageTimeline(fullChilling, 'Chilling Isolation'), [
    [280, 'Chilling Isolation — Packet 1', 0.8],
    [480, 'Isolated Damage', 1.6]
  ]);

  const swordAutos = simulate('Conduit', ['Preparation Thrust', 'Brutal Blade'], config);

  assert.deepEqual(
    swordAutos.events
      .filter((event) => event.type === 'damage' && ['Preparation Thrust', 'Brutal Blade'].includes(event.skillName))
      .map((event) => [event.skillName, Math.round(event.at * 1000)]),
    [
      ['Preparation Thrust', 320],
      ['Brutal Blade', 840]
    ]
  );

  for (const [name, impactMs] of [
    ['Mist Slash', 400],
    ['Arcing Mists', 440]
  ]) {
    assert.equal(skill(name).effects.find((effect) => effect.type === 'strike').atMs, impactMs, `${name} impact`);
  }

  for (const [name, impactMs] of [
    ['Hammer Bolt', 481],
    ['Coalescence of Ruin', 561],
    ['Field of the Mists', 560],
    ['Drop the Hammer', 1639]
  ]) {
    assert.equal(skill(name).effects.find((effect) => effect.type === 'strike').atMs, impactMs, `${name} impact`);
  }

  const onslaught = simulate('Vindicator', ["Phantom's Onslaught"], {
    ...config,
    specialization: 'Vindicator',
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    primaryWeapon: 'Greatsword',
    secondaryWeapon: ''
  });

  assert.equal(onslaught.steps[0].fullCastMs, 438);
  assert.equal(
    Math.round(
      onslaught.events.find((event) => event.type === 'damage' && event.skillName === "Phantom's Onslaught").at * 1000
    ),
    438
  );
  assert.deepEqual(onslaught.endState.cooldowns["Phantom's Onslaught"], {
    readyAt: 6820,
    remaining: 6382
  });

  const rift = damageTimeline(
    simulate('Conduit', ['Preparation Thrust', 'Brutal Blade', 'Rift Slash'], config, observationTail(1000)),
    'Rift Slash'
  );

  assert.deepEqual(
    rift.map((event) => event.slice(1)),
    [
      ['Rift Slash — Packet 1', 0.9],
      ['Rift Damage', 0.2175]
    ]
  );
  assert.equal(rift[1][0] - rift[0][0], 1000);
  assert.deepEqual(
    rift.map((event) => event[0]),
    [1320, 2320]
  );

  const impossibleRift = simulate(
    'Conduit',
    ['Impossible Odds', 'Preparation Thrust', 'Brutal Blade', 'Rift Slash', { type: 'wait', durationMs: 1500 }],
    {
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
      startingLegend: LEGEND.ASSASSIN,
      initialEnergy: 100,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      boons: { quickness: true }
    }
  );

  assert.equal(
    impossibleRift.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Impossible Odds' && event.triggeredBy === 'Rift Slash'
    ).length,
    2
  );

  const requiem = simulate(
    'Conduit',
    ["Eternity's Requiem"],
    {
      ...config,
      primaryWeapon: 'Greatsword',
      secondaryWeapon: ''
    },
    observationTail(2000)
  );

  assert.deepEqual(damageTimeline(requiem, "Eternity's Requiem"), [
    [1163, "Eternity's Requiem", 1],
    [1241, "Eternity's Requiem", 0.9],
    [1361, "Eternity's Requiem", 0.8],
    [1445, "Eternity's Requiem", 0.7],
    [1486, "Eternity's Requiem", 0.6],
    [1562, "Eternity's Requiem", 0.5],
    [1678, "Eternity's Requiem", 0.4],
    [1762, "Eternity's Requiem", 0.3]
  ]);
});

test('large Revenant hitboxes add the second Coalescence cascade and all Requiem impacts', () => {
  const hammerConfig = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
    primaryWeapon: 'Hammer',
    secondaryWeapon: ''
  };
  const greatswordConfig = {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    primaryWeapon: 'Greatsword',
    secondaryWeapon: ''
  };
  const hitCounts = (specialization, skill, config, tailMs) =>
    Object.fromEntries(
      ['small', 'large'].map((hitboxSize) => {
        const result = simulate(
          specialization,
          [skill],
          { ...config, professionAssumptions: { hitboxSize } },
          observationTail(tailMs)
        );

        return [
          hitboxSize,
          result.events.filter((event) => event.type === 'damage' && event.skillName === skill).length
        ];
      })
    );

  assert.deepEqual(hitCounts('Renegade', 'Coalescence of Ruin', hammerConfig, 2000), {
    small: 1,
    large: 2
  });
  assert.deepEqual(hitCounts('Vindicator', "Eternity's Requiem", greatswordConfig, 2500), {
    small: 8,
    large: 14
  });

  const largeHammer = simulate(
    'Renegade',
    ['Coalescence of Ruin'],
    { ...hammerConfig, professionAssumptions: { hitboxSize: 'large' } },
    observationTail(2000)
  );

  assert.deepEqual(
    largeHammer.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Coalescence of Ruin')
      .map((event) => Math.round(event.at * 1000)),
    [561, 1521]
  );

  const largeRequiem = simulate(
    'Vindicator',
    ["Eternity's Requiem"],
    { ...greatswordConfig, professionAssumptions: { hitboxSize: 'large' } },
    observationTail(2500)
  );

  assert.deepEqual(
    largeRequiem.events
      .filter((event) => event.type === 'damage' && event.skillName === "Eternity's Requiem")
      .map((event) => event.coefficient),
    [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, ...Array(7).fill(0.3)]
  );
});

test('Drop the Hammer resets Coalescence of Ruin when its delayed hit lands', () => {
  const result = simulate(
    'Renegade',
    ['Drop the Hammer', 'Coalescence of Ruin', { name: '__wait', waitMs: 400 }, 'Coalescence of Ruin'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      primaryWeapon: 'Hammer',
      secondaryWeapon: '',
      professionAssumptions: { hitboxSize: 'small' }
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.filter((step) => step.skill === 'Coalescence of Ruin').map((step) => step.start),
    [500, 1650]
  );
  assert.equal(
    result.events.filter((event) => event.type === 'damage' && event.skillName === 'Coalescence of Ruin').length,
    2
  );
});

test('Conduit affinity scales Release Potential and Cosmic Wisdom state', () => {
  const result = simulate('Conduit', ['Phase Traversal', 'Release Potential: Assassin', 'Cosmic Wisdom'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.affinity, 2);
  assert.equal(result.endState.profession.conduitForm, 'Assassin');
  assert.ok(result.endState.profession.cosmicWisdomUntil > 0);

  for (const [legend, generator, release, expectedAffinity] of [
    [LEGEND.ASSASSIN, 'Phase Traversal', 'Release Potential: Assassin', 2],
    [LEGEND.DEMON, 'Pain Absorption', 'Release Potential: Mesmer', 2],
    [LEGEND.ENTITY, "Gladiator's Defense", 'Release Potential: Dervish', 1],
    [LEGEND.CENTAUR, 'Natural Harmony', 'Release Potential: Monk', 1],
    [LEGEND.DWARF, 'Inspiring Reinforcement', 'Release Potential: Warrior', 2]
  ]) {
    const variant = simulate('Conduit', [generator, release], {
      selectedLegends: [legend, LEGEND.ENTITY],
      startingLegend: legend,
      initialEnergy: 100
    });

    assert.equal(variant.warnings.length, 0, release);
    assert.equal(variant.endState.profession.affinity, expectedAffinity, release);
  }
});

test('Form of the Mesmer modifies Demon skill costs and Banish cooldown', () => {
  const blocked = simulate('Conduit', ['Cosmic Wisdom', 'Banish Enchantment'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 4
  });

  assert.match(blocked.warnings[0], /requires 5 energy/);

  const result = simulate('Conduit', ['Cosmic Wisdom', 'Banish Enchantment', 'Banish Enchantment'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 5
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.filter((step) => step.skill === 'Banish Enchantment').map((step) => step.start),
    [0, 5440]
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'action' && event.skillName === 'Banish Enchantment')
      .map((event) => Number((event.rechargeReadyAt - event.fullEndsAt).toFixed(6))),
    [5, 5]
  );

  const expiringDuringCast = simulate(
    'Conduit',
    [
      'Cosmic Wisdom',
      'Banish Enchantment',
      { type: 'wait', durationMs: 6300 },
      'Banish Enchantment',
      'Banish Enchantment'
    ],
    {
      selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100,
      boons: { quickness: true }
    }
  );

  assert.equal(expiringDuringCast.warnings.length, 0);
  assert.deepEqual(
    expiringDuringCast.steps.filter((step) => step.skill === 'Banish Enchantment').map((step) => step.start),
    [0, 6740, 12180]
  );
  assert.deepEqual(
    expiringDuringCast.events
      .filter((event) => event.type === 'action' && event.skillName === 'Banish Enchantment')
      .map((event) => event.rechargeReadyAt),
    [5.44, 12.18, null]
  );

  const blockedAnguish = simulate('Conduit', ['Cosmic Wisdom', 'Call to Anguish'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 9
  });

  assert.match(blockedAnguish.warnings[0], /requires 10 energy/);

  const anguish = simulate('Conduit', ['Cosmic Wisdom', 'Call to Anguish', 'Unyielding Impact'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 10
  });

  assert.equal(anguish.warnings.length, 0);
  assert.deepEqual(
    anguish.steps
      .filter((step) => ['Call to Anguish', 'Unyielding Impact'].includes(step.skill))
      .map((step) => step.start),
    [0, 820]
  );

  const normalEmbrace = simulate('Core', ['Embrace the Darkness'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 0
  });

  assert.match(normalEmbrace.warnings[0], /requires 5 energy/);

  const cosmicEmbrace = simulate('Conduit', ['Cosmic Wisdom', 'Embrace the Darkness'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 0
  });

  assert.equal(cosmicEmbrace.warnings.length, 0);
  assert.equal(cosmicEmbrace.steps.at(-1).skill, 'Embrace the Darkness');
});

test('Form of the Assassin fires daggers on skills and Impossible Odds pulses', () => {
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', { type: 'wait', durationMs: 3100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  const daggers = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Lesser Enchanted Daggers'
  );

  assert.deepEqual(
    daggers.map((event) => event.at),
    [0, 1, 2, 3]
  );
  assert.ok(daggers.every((event) => event.coefficient === 0.06));
  assert.ok(daggers.every((event) => event.triggeredBy === 'Impossible Odds'));
});

test('Form of the Dervish follows every Entity skill and doubles Twin Moon', () => {
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Shielding Hands', 'Hex-Eater Vortex', 'Twin Moon Sweep'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  const scythes = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Form of the Dervish');

  assert.deepEqual(
    scythes.map((event) => event.triggeredBy),
    ['Shielding Hands', 'Hex-Eater Vortex', 'Twin Moon Sweep', 'Twin Moon Sweep']
  );
  assert.ok(scythes.every((event) => event.coefficient === 0.8));
});

test('Conduit entity skills apply follow-ups and Shared Wisdom effects', () => {
  const beguiling = simulate('Conduit', ['Beguiling Haze', 'Beguiling Haze', 'Beguiling Haze'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    traitIds: [TRAIT.SHARED_WISDOM]
  });

  assert.equal(beguiling.warnings.length, 0);
  assert.deepEqual(
    beguiling.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Beguiling Haze')
      .map((event) => [Math.round(event.at * 1000), event.coefficient]),
    [
      [522, 2.2],
      [850, 0.6],
      [1100, 0.6]
    ]
  );
  assert.deepEqual(
    beguiling.steps.map((step) => step.fullCastMs),
    [650, 250, 250]
  );
  assert.equal(beguiling.endState.profession.beguilingHazeCharges, 0);
  const beguilingAmmo = beguiling.schedulerState.ammo.get(revenantCatalog.skillsByName.get('Beguiling Haze').id);

  assert.equal(beguilingAmmo.maximum, 1);
  assert.equal(beguilingAmmo.charges, 0);
  assert.equal(beguilingAmmo.nextRechargeAt, beguiling.endState.profession.beguilingHazeReadyAt);
  assert.ok(Math.abs(beguiling.endState.profession.energy - 83.14) < 1e-9);

  const recharged = simulate(
    'Conduit',
    ['Beguiling Haze', 'Beguiling Haze', 'Beguiling Haze', { type: 'wait', durationMs: 20000 }],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100
    }
  );
  const rechargedAmmo = recharged.schedulerState.ammo.get(revenantCatalog.skillsByName.get('Beguiling Haze').id);

  assert.equal(recharged.endState.profession.beguilingHazeCharges, 0);
  assert.equal(rechargedAmmo.maximum, 1);
  assert.equal(rechargedAmmo.charges, 1);
  assert.equal(rechargedAmmo.nextRechargeAt, null);
  assert.equal(beguiling.events.filter((event) => event.type === 'buff' && event.kind === 'fury').length, 3);
  assert.equal(beguiling.events.filter((event) => event.type === 'buff' && event.kind === 'swiftness').length, 3);

  const defense = simulate('Conduit', ["Gladiator's Defense"], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    traitIds: [TRAIT.SHARED_WISDOM]
  });

  assert.equal(defense.steps[0].fullCastMs, 40);
  assert.deepEqual(
    defense.events
      .filter((event) => event.type === 'buff')
      .map((event) => event.kind)
      .sort(),
    ['resistance', 'resolution', 'stability', 'swiftness']
  );

  const vortex = simulate(
    'Conduit',
    ['Hex-Eater Vortex'],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100,
      traitIds: [TRAIT.SHARED_WISDOM]
    },
    observationTail(1000)
  );

  assert.equal(
    vortex.events.filter(
      (event) => event.type === 'condition' && event.skillName === 'Hex-Eater Vortex' && event.condition === 'Torment'
    ).length,
    6
  );
  assert.deepEqual(
    vortex.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Hex-Eater Vortex')
      .map((event) => [Math.round(event.at * 1000), event.coefficient]),
    [443, 562, 682, 802, 920, 1039].map((at) => [at, 0.2])
  );
  assert.ok(
    vortex.events.some((event) => event.type === 'buff' && event.kind === 'resolution' && event.duration === 3)
  );
});

test('Twin Moon Sweep resolves both attackers and legend resonance', () => {
  const assassin = simulate('Conduit', ['Twin Moon Sweep'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });
  const strikes = assassin.events.filter((event) => event.type === 'damage' && event.skillName === 'Twin Moon Sweep');

  assert.deepEqual(
    strikes.map((event) => event.coefficient),
    [2.5, 2.5]
  );
  assert.deepEqual(
    strikes.map((event) => event.actorType),
    ['player', 'player']
  );
  assert.deepEqual(
    strikes.map((event) => event.at),
    [0.88, 0.88]
  );
  assert.equal(
    assassin.events.filter((event) => event.condition === 'Bleeding').reduce((sum, event) => sum + event.stacks, 0),
    4
  );
  assert.ok(assassin.events.some((event) => event.condition === 'Immobilized' && event.duration === 2));
  assert.equal(assassin.endState.profession.affinity, 2);

  const demon = simulate(
    'Conduit',
    ['Twin Moon Sweep'],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100
    },
    observationTail(1000)
  );

  assert.deepEqual(
    demon.events
      .filter((event) => event.type === 'damage' && /Shatter/.test(event.name))
      .map((event) => [event.at, event.coefficient]),
    [
      [1.402, 0.2],
      [1.402, 0.2]
    ]
  );
  assert.equal(
    demon.events.filter((event) => event.condition === 'Confusion').reduce((sum, event) => sum + event.stacks, 0),
    6
  );

  const swappedBeforeImpact = simulate('Conduit', ['Twin Moon Sweep', { name: 'Swap Legends', offset: 100 }], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    boons: { quickness: true }
  });
  const affinityAtImpact = swappedBeforeImpact.events.find(
    (event) => event.type === 'revenant.state' && event.reason === 'enigmatic-connection-hit'
  );

  assert.equal(swappedBeforeImpact.steps[1].start, 100);
  assert.equal(affinityAtImpact.at, 0.88);
  assert.equal(affinityAtImpact.state.activeLegendId, LEGEND.ASSASSIN);
  assert.equal(affinityAtImpact.state.affinity, 2);
  assert.equal(swappedBeforeImpact.endState.profession.affinity, 2);
});

test('Revenant Peitha triggers resolve at the observed projectile impact', () => {
  for (const {
    specialization,
    rotation,
    selectedLegends,
    startingLegend,
    sourceSkill,
    sourceName,
    delay,
    weapons = {}
  } of [
    {
      specialization: 'Conduit',
      rotation: ['Deathstrike', { name: '__wait', waitMs: 1000 }],
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
      startingLegend: LEGEND.ASSASSIN,
      sourceSkill: 'Deathstrike',
      sourceName: 'Initial Damage',
      delay: 0.24
    },
    {
      specialization: 'Conduit',
      rotation: ['Beguiling Haze', { name: '__wait', waitMs: 1000 }],
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      sourceSkill: 'Beguiling Haze',
      sourceName: 'Beguiling Haze',
      delay: 0.32
    },
    {
      specialization: 'Vindicator',
      rotation: ["Phantom's Onslaught", { name: '__wait', waitMs: 1000 }],
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ALLIANCE,
      sourceSkill: "Phantom's Onslaught",
      sourceName: "Phantom's Onslaught",
      delay: 0.68,
      weapons: {
        primaryWeapon: 'Greatsword',
        secondaryWeapon: ''
      }
    },
    {
      specialization: 'Renegade',
      rotation: ['Phase Smash', { name: '__wait', waitMs: 1000 }],
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      sourceSkill: 'Phase Smash',
      sourceName: 'Phase Smash',
      delay: 0,
      weapons: {
        primaryWeapon: 'Hammer',
        secondaryWeapon: ''
      }
    }
  ]) {
    const result = simulate(specialization, rotation, {
      selectedLegends,
      startingLegend,
      relic: 'Peitha',
      initialEnergy: 100,
      ...weapons
    });
    const source = result.events.find(
      (event) => event.type === 'damage' && event.skillName === sourceSkill && event.name === sourceName
    );
    const peitha = result.events.find((event) => event.type === 'peitha' && event.skillName === sourceSkill);
    const torment = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Relic of Peitha'
    );

    assert.ok(source, `${sourceSkill} source`);
    assert.ok(peitha, `${sourceSkill} Peitha event`);
    assert.ok(torment, `${sourceSkill} Peitha torment`);
    assert.ok(Math.abs(peitha.at - source.at - delay) < 1e-9, `${sourceSkill} impact delay`);
    assert.equal(torment.at, peitha.at, `${sourceSkill} torment timing`);
  }
});

test('Conduit form attacks carry usable icons into skill breakdowns', () => {
  const dervish = simulate('Conduit', ['Cosmic Wisdom', "Gladiator's Defense"], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });
  const expectedIcon = revenantCatalog.skillsById.get(SKILL.FORM_OF_THE_DERVISH_ATTACK).icon;
  const attack = dervish.events.find((event) => event.type === 'damage' && event.skillName === 'Form of the Dervish');
  const row = skillBreakdownRows(dervish).find((entry) => entry.name === 'Form of the Dervish');

  assert.match(expectedIcon, /^https:\/\/render\.guildwars2\.com\//);
  assert.equal(attack.icon, expectedIcon);
  assert.equal(row.icon, expectedIcon);

  const assassin = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', { type: 'wait', durationMs: 1100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });
  const expectedDaggersIcon = revenantCatalog.skillsById.get(SKILL.LESSER_ENCHANTED_DAGGERS).icon;
  const daggers = assassin.events.find(
    (event) => event.type === 'damage' && event.skillName === 'Lesser Enchanted Daggers'
  );
  const daggersRow = skillBreakdownRows(assassin).find((entry) => entry.name === 'Lesser Enchanted Daggers');

  assert.match(expectedDaggersIcon, /^https:\/\/render\.guildwars2\.com\//);
  assert.equal(daggers.icon, expectedDaggersIcon);
  assert.equal(daggersRow.icon, expectedDaggersIcon);
});

test('Release Potential variants use affinity and equipped-legend effects', () => {
  for (const [legend, name, expected] of [
    [LEGEND.DEMON, 'Release Potential: Mesmer', [280]],
    [LEGEND.ENTITY, 'Release Potential: Dervish', [560]],
    [LEGEND.ASSASSIN, 'Release Potential: Assassin', [160, 480, 800]]
  ]) {
    const timing = simulate(
      'Conduit',
      [name],
      {
        selectedLegends: legend === LEGEND.ENTITY ? [LEGEND.ENTITY, LEGEND.ASSASSIN] : [legend, LEGEND.ENTITY],
        startingLegend: legend,
        initialEnergy: 100,
        boons: { quickness: true }
      },
      observationTail(1000)
    );

    assert.deepEqual(
      timing.events
        .filter((event) => event.type === 'damage' && event.skillName === name)
        .map((event) => Math.round(event.at * 1000)),
      expected,
      name
    );
  }

  const mesmer = simulate('Conduit', ['Pain Absorption', 'Banish Enchantment', 'Release Potential: Mesmer'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100
  });
  const enemyTorment = mesmer.events.find(
    (event) =>
      event.type === 'condition' && event.skillName === 'Release Potential: Mesmer' && event.condition === 'Torment'
  );

  assert.ok(Math.abs(enemyTorment.duration - 3.9) < 1e-9);
  assert.equal(mesmer.endState.profession.selfConditions.length, 1);
  assert.ok(
    Math.abs(
      mesmer.endState.profession.selfConditions[0].expiresAt - mesmer.endState.profession.selfConditions[0].at - 4.4
    ) < 1e-9
  );
  assert.ok(
    mesmer.events.some((event) => event.type === 'control' && event.controlKind === 'daze' && event.duration === 2)
  );

  const dervishDemon = simulate('Conduit', ["Gladiator's Defense", 'Release Potential: Dervish'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });

  assert.ok(
    dervishDemon.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.condition === 'Bleeding' &&
        event.stacks === 3 &&
        event.duration === 6
    )
  );

  const dervishAllEffects = simulate(
    'Conduit',
    ['Twin Moon Sweep', "Gladiator's Defense", 'Release Potential: Dervish'],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100
    }
  );

  assert.equal(dervishAllEffects.endState.profession.affinity, 3);
  assert.ok(
    dervishAllEffects.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.condition === 'Bleeding' &&
        event.stacks === 3 &&
        event.duration === 6
    )
  );
  assert.ok(
    dervishAllEffects.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.kind === 'might' &&
        event.stacks === 10 &&
        event.duration === 8
    )
  );

  const dervishCentaur = simulate('Conduit', ["Gladiator's Defense", 'Release Potential: Dervish'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.CENTAUR],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });

  assert.ok(
    dervishCentaur.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.kind === 'might' &&
        event.stacks === 10 &&
        event.duration === 8
    )
  );
  assert.ok(
    dervishCentaur.events.some(
      (event) => event.skillName === 'Release Potential: Dervish' && event.kind === 'fury' && event.duration === 8
    )
  );
});

test('Conduit affinity traits distinguish legend and weapon energy costs', () => {
  const enigmatic = simulate('Conduit', ['Pain Absorption', 'Banish Enchantment'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100
  });

  assert.equal(enigmatic.endState.profession.affinity, 3);

  const withoutConductive = simulate('Conduit', ['Chilling Isolation'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });
  const withConductive = simulate('Conduit', ['Chilling Isolation'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    traitIds: [TRAIT.CONDUCTIVE_ARMAMENTS]
  });

  assert.equal(withoutConductive.endState.profession.affinity, 0);
  assert.equal(withConductive.endState.profession.affinity, 1);

  const reset = simulate('Conduit', ['Phase Traversal', 'Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(reset.endState.profession.affinity, 0);

  const lingering = simulate('Conduit', ['__combat_start', 'Phase Traversal', 'Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100,
    traitIds: [TRAIT.LINGERING_DETERMINATION]
  });

  assert.equal(lingering.endState.profession.affinity, 2);

  const upkeep = simulate('Conduit', ['Impossible Odds', { type: 'wait', durationMs: 3100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(upkeep.endState.profession.affinity, 2);

  const expandedRotation = ['Phase Traversal', 'Jade Winds', 'Impossible Odds'];
  const ordinary = simulate('Conduit', expandedRotation, {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });
  const expanded = simulate('Conduit', expandedRotation, {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100,
    traitIds: [TRAIT.EXPANDED_CONSCIOUSNESS]
  });

  assert.equal(expanded.endState.profession.affinity, 5);
  assert.ok(Math.abs(expanded.endState.profession.energy - ordinary.endState.profession.energy - 15) < 1e-9);
});

test('Conduit grandmasters alter release, invocation, and Cosmic Wisdom', () => {
  const kinetic = simulate('Conduit', ['Release Potential: Warrior'], {
    selectedLegends: [LEGEND.DWARF, LEGEND.ENTITY],
    startingLegend: LEGEND.DWARF,
    traitIds: [TRAIT.KINETIC_INSIGHT]
  });

  assert.equal(
    kinetic.schedulerState.cooldowns.get(revenantCatalog.skillsByName.get('Release Potential: Warrior').id),
    8.75
  );

  const cosmic = simulate('Conduit', ['__combat_start', 'Cosmic Wisdom', 'Swap Legends', 'Release Potential: Mesmer'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    traitIds: [TRAIT.ENHANCED_EMBODIMENT, TRAIT.FOUND_PURPOSE, TRAIT.LINGERING_DETERMINATION, TRAIT.MISTFIRE]
  });

  assert.equal(cosmic.endState.profession.legendSwapReadyAt, 6);
  assert.equal(cosmic.endState.profession.cosmicWisdomUntil, 8);
  assert.ok(
    cosmic.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Mistfire' && event.coefficient === 0.6
    )
  );
  assert.ok(
    cosmic.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Mistfire' &&
        event.condition === 'Burning' &&
        event.duration === 6
    )
  );
  assert.equal(
    cosmic.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Swap Legends' && event.recipients === 'allies'
    ).length,
    3
  );

  const disable = simulate('Conduit', ['Abyssal Blot', { name: 'Call to Anguish', offset: 100 }], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    initialEnergy: 100,
    traitIds: [TRAIT.MISTFIRE]
  });
  const disableProcs = disable.events.filter((event) => event.skillName === 'Mistfire');

  assert.equal(
    disableProcs.filter((event) => event.type === 'condition' && event.condition === 'Burning' && event.stacks === 1)
      .length,
    1
  );
  assert.equal(disableProcs.filter((event) => event.type === 'damage').length, 0);
});

test('Bolstered Bonds and Kinetic Insight modify runtime attributes and damage', () => {
  const context = {
    config: {
      specialization: 'Conduit',
      traitIds: [TRAIT.KINETIC_INSIGHT]
    },
    time: 1,
    event: { skillName: 'Release Potential: Warrior', actorType: 'player' },
    runtime: {
      profession: {
        affinity: 3,
        cosmicWisdomUntil: 7,
        selectedLegendIds: [LEGEND.ASSASSIN, LEGEND.ENTITY]
      }
    }
  };
  const attributes = revenantAttributeRules.modifyAttributes(context, {
    power: 1000,
    precision: 1000,
    toughness: 1000,
    vitality: 1000,
    ferocity: 0,
    conditionDamage: 0,
    expertise: 0,
    concentration: 0,
    healingPower: 0
  });

  assert.equal(attributes.power, 1300);
  assert.equal(attributes.ferocity, 300);
  assert.equal(attributes.precision, 1150);
  assert.equal(attributes.conditionDamage, 150);
  assert.equal(revenantAttributeRules.modifyStrikeDamage(context, 1), 1.75);

  const numinousContext = {
    ...context,
    config: {
      specialization: 'Conduit',
      attributeProvenance: {
        professionStaticRulesApplied: true
      },
      traitIds: [
        TRAIT.DETERMINED_RESOLUTION,
        TRAIT.SERENE_REJUVENATION,
        TRAIT.CONTAINED_TEMPER,
        TRAIT.YEARNING_EMPOWERMENT,
        TRAIT.NUMINOUS_GIFT
      ]
    }
  };
  const numinousAttributes = revenantAttributeRules.modifyAttributes(numinousContext, {
    conditionDurationBonuses: {
      Poisoned: 10,
      Torment: 10
    }
  });

  assert.deepEqual(numinousAttributes.conditionDurationBonuses, {
    Poisoned: 10,
    Torment: 10
  });
  assert.equal(
    revenantAttributeRules.modifyConditionDuration(
      {
        ...numinousContext,
        condition: 'Poisoned'
      },
      0.6
    ),
    0.6
  );
  assert.equal(numinousAttributes.strikeDamageReduction, 0.05);
  assert.equal(numinousAttributes.healingEffectiveness, 0.05);
  assert.equal(numinousAttributes.containedTemperEnergyGainBonus, 5);
});

test("Conduit runtime rejects Vindicator's Alliance legend", () => {
  const result = simulate('Conduit', ['Swap Legends'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ENTITY],
    startingLegend: LEGEND.ALLIANCE
  });

  assert.deepEqual(result.endState.profession.selectedLegendIds, [LEGEND.ENTITY, LEGEND.ASSASSIN]);
  assert.equal(result.endState.profession.activeLegendId, LEGEND.ASSASSIN);
});

test('Alacrity changes cooldowns but never passive energy regeneration', () => {
  const rotation = [{ type: 'wait', durationMs: 5000 }];
  const without = simulate('Core', rotation, {
    initialEnergy: 0,
    boons: { alacrity: false }
  });
  const withAlacrity = simulate('Core', rotation, {
    initialEnergy: 0,
    boons: { alacrity: true }
  });

  assert.equal(without.endState.profession.energy, 25);
  assert.equal(withAlacrity.endState.profession.energy, 25);
});

test('Alacrity does not reduce Revenant legend or weapon swap cooldowns', () => {
  const config = {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Mace',
    weaponSet2Secondary: 'Axe',
    boons: { alacrity: true }
  };
  const legends = simulate('Core', ['__combat_start', 'Swap Legends', 'Swap Legends'], config);

  assert.deepEqual(
    legends.steps.filter((step) => step.skill === 'Swap Legends').map((step) => step.start),
    [0, 10000]
  );

  const weapons = simulate('Core', ['__combat_start', 'Swap Weapons', 'Swap Weapons'], config);

  assert.deepEqual(
    weapons.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
    [0, 10000]
  );
});

test('trait-coverage manifest covers all Revenant traits', () => {
  assert.equal(REVENANT_TRAIT_COVERAGE.length, revenantCatalog.traits.length);
  assert.ok(REVENANT_TRAIT_COVERAGE.every((entry) => entry.effects.length > 0));
});

test('Revenant state events use the shared event-log row contract', () => {
  const rows = simulationEventLogRows(
    {
      events: [
        {
          type: 'revenant.state',
          at: 1.02,
          reason: 'kallas-fervor',
          state: { energy: 30 }
        }
      ],
      resolvedEvents: [],
      endState: { profession: {} }
    },
    null,
    revenantProfession
  );

  assert.deepEqual(rows, [
    {
      at: 1.02,
      type: 'revenant.state',
      description: 'kallas-fervor - Energy 30.0',
      className: 'resource',
      phantasmClone: false
    }
  ]);
});

test('Revenant is a loadable native fixed-bar application', async () => {
  assert.equal(professionRoute('revenant'), 'revenant.html');
  assert.equal((await loadProfession('revenant')).id, 'revenant');
  const adapter = await loadProfessionAppAdapter('revenant');

  assert.equal(adapter.profession.id, 'revenant');
  assert.equal(adapter.slotLoadout.id, 'revenant-legends');
  const html = await readFile(new URL('../../../revenant.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="revenant"/);
});
