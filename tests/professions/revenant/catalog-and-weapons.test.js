import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { renderSkills } from '#gw2/app/build/panels/skills.js';
import {
  displayedSkillTiles,
  paletteView,
  rotationSelectedSlotSkills,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';
import { paletteSkillView, renderPalette } from '#gw2/app/rotation/palette/view.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { skillBreakdownRows } from '#gw2/app/presentation/results/result-tables.js';
import { createRevenantBuildDefaults } from '#gw2/professions/revenant/build/build.js';
import { applyRevenantBuildAttributeRules } from '#gw2/professions/revenant/build/attributes.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { REVENANT_SUPPLEMENTAL_SKILLS } from '#gw2/professions/revenant/data/revenant-supplemental-skills.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

// Attribute assertions use the same calculator composed into the Revenant adapter.
const calculateRevenantAttributes = createCalculateAttributes(applyRevenantBuildAttributeRules);

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

const simulate = createProfessionSimulator(revenantProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

const strikeCoefficient = (effect) =>
  effect.ticks?.reduce((total, tick) => total + Number(tick.coefficient), 0) ?? Number(effect.coefficient);

const authoringRevenantProfession = withActivePatchPreview(revenantProfession);

test('Revenant catalog retains reviewed timing and packet mechanics', () => {
  const echoingEruption = revenantCatalog.skillsById.get(SKILL.ECHOING_ERUPTION);

  assert.equal(echoingEruption.cooldown, 8);
  assert.equal(echoingEruption.ammo, 0);
  assert.equal(echoingEruption.ammoRecharge, 0);
  assert.equal(echoingEruption.comboFinishers[0].ownerId, 'revenant');
  assert.equal(echoingEruption.comboFinishers[0].finisherType, 'Blast');
  assert.deepEqual(
    echoingEruption.effects
      .filter((effect) => effect.type === 'strike')
      .map((effect) => [strikeCoefficient(effect), effect.ticks?.length ?? effect.hits]),
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
      .map((effect) => [strikeCoefficient(effect), effect.ticks.map((tick) => tick.atMs)]),
    [[0.75, [1480, 2480, 3480]]]
  );
  const hammerBolt = revenantCatalog.skillsById.get(SKILL.HAMMER_BOLT);

  assert.equal(strikeCoefficient(hammerBolt.effects[0]), 0.9);
  assert.equal(hammerBolt.effects[0].comboFinishers[0].finisherType, 'Projectile');
  assert.equal(hammerBolt.effects[0].comboFinishers[0].chance, 1);
  const coalescence = revenantCatalog.skillsById.get(SKILL.COALESCENCE_OF_RUIN);

  assert.equal(coalescence.cooldown, 4);
  assert.equal(coalescence.energyCost, 5);
  assert.equal(strikeCoefficient(coalescence.effects[0]), 3.5);
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
  assert.equal(strikeCoefficient(fieldOfTheMists.effects[0]), 1.8);
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
  assert.equal(strikeCoefficient(dropTheHammer.effects[0]), 3.2);
  assert.equal(dropTheHammer.effects[0].comboFinishers[0].finisherType, 'Blast');
  assert.equal(dropTheHammer.effects[1].duration, 3);
  const manifestToxin = revenantCatalog.skillsById.get(SKILL.MANIFEST_TOXIN);

  assert.deepEqual(
    manifestToxin.effects
      .filter((effect) => effect.type === 'strike')
      .map((effect) => [strikeCoefficient(effect), effect.ticks?.length ?? effect.hits]),
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
  const deathDropStrike = revenantCatalog.skillsById
    .get(SKILL.DEATH_DROP)
    .effects.find((effect) => effect.type === 'strike');

  assert.deepEqual(
    { coefficient: strikeCoefficient(deathDropStrike), hits: deathDropStrike.ticks?.length ?? deathDropStrike.hits },
    { coefficient: 3.3, hits: 1 }
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

test('Elemental Blast keeps packet timing runtime-only while exposing packet values', () => {
  const herald = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Herald');
  const elementalBlast = herald.skills.find((skill) => skill.id === SKILL.ELEMENTAL_BLAST).skill;
  const runtimeElementalBlast = revenantCatalog.skillsById.get(SKILL.ELEMENTAL_BLAST);
  const [strike, conditions] = elementalBlast.effects;

  assert.equal(elementalBlast.handlerId, 'revenant.facet-consume');
  assert.deepEqual(
    strike.ticks.map((tick) => tick.coefficient),
    [1.5, 1.5, 1.5]
  );
  assert.deepEqual(
    conditions.ticks.map((tick) => [tick.condition, tick.stacks, tick.duration]),
    [
      ['Weakness', 1, 5],
      ['Chilled', 1, 3],
      ['Burning', 2, 4]
    ]
  );
  assert.deepEqual(
    runtimeElementalBlast.effects[0].ticks.map((tick) => tick.atMs),
    [280, 1280, 2280]
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

test('Beguiling Haze keeps runtime cast timing out of profile authoring metadata', () => {
  const conduit = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Conduit');
  const profile = (id) => conduit.skillVariants.find((entry) => entry.id === id);
  const mainExtension = profile(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension);
  const followUp = profile(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp);
  const runtimeMain = revenantCatalog.balanceProfilesById.get(
    CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension
  );
  const runtimeFollowUp = revenantCatalog.balanceProfilesById.get(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp);

  assert.equal(runtimeMain.castTimeMs, 400);
  assert.equal(runtimeMain.quicknessCastMultiplier, 0.9);
  assert.equal(runtimeFollowUp.castTimeMs, 250);
  assert.equal(runtimeFollowUp.quicknessCastMultiplier, 0.96);
  assert.equal(mainExtension, undefined);
  assert.equal(followUp.profile.castTimeMs, undefined);
  assert.equal(followUp.profile.quicknessCastMultiplier, undefined);
  assert.equal(followUp.patchableFields.castTimeMs, undefined);
  assert.equal(followUp.patchableFields.quicknessCastMultiplier, undefined);
  assert.equal(Object.hasOwn(followUp.profile, 'mainCastExtensionMs'), false);
  assert.equal(Object.hasOwn(followUp.profile, 'mainQuicknessCastMultiplier'), false);

  assert.throws(
    () =>
      applyRevenantPatch({
        balanceProfiles: {
          [CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension]: {
            fields: {
              castTimeMs: { from: 400, to: 450 }
            }
          }
        }
      }),
    /unsupported patch field castTimeMs/
  );
});

test('Herald invocation effects use patch-authorable skill declarations', () => {
  const herald = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Herald');
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
  const renegade = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Renegade');
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
  const renegade = authoringRevenantProfession.patchAuthoring.modules.find((module) => module.id === 'Renegade');
  const skill = (id) => renegade.skills.find((entry) => entry.id === id);
  const named = (name) => renegade.skills.find((entry) => entry.name === name);
  const namedProfile = (name) =>
    [...renegade.balanceProfiles, ...renegade.skillVariants].find((entry) => entry.name === name);
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
    baseIcerazor.skill.effects[0].ticks.map((tick) => tick.coefficient),
    [2, 2, 2]
  );
  assert.deepEqual(
    revenantCatalog.skillsById.get(SKILL.ICERAZORS_IRE).effects[0].ticks.map((tick) => tick.atMs),
    [500, 661, 822]
  );
  assert.equal(enhancedIcerazor.skill.simulatorExcluded, true);
  assert.deepEqual(
    enhancedIcerazor.skill.effects[0].ticks.map((tick) => tick.coefficient),
    [2, 2, 2]
  );
  assert.deepEqual(
    revenantCatalog.skillsById.get(SKILL.ICERAZORS_IRE_ID_72359).effects[0].ticks.map((tick) => tick.atMs),
    [1200, 1361, 1522]
  );
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
  const [ids, coreSkills, coreProfiles, renegadeSkills, renegadeProfiles, catalog, modules] = await Promise.all([
    readFile(new URL('../../../js/games/gw2/professions/revenant/data/ids.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../js/games/gw2/professions/revenant/core/skills/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../js/games/gw2/professions/revenant/core/profiles.ts', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../js/games/gw2/professions/revenant/specializations/renegade/skills/index.ts', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../../../js/games/gw2/professions/revenant/specializations/renegade/profiles.ts', import.meta.url),
      'utf8'
    ),
    readFile(new URL('../../../js/games/gw2/professions/revenant/catalog.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../js/games/gw2/professions/revenant/modules.ts', import.meta.url), 'utf8')
  ]);

  assert.doesNotMatch(ids, /^import\b/m);
  assert.match(ids, /REVENANT_SKILL_IDS = Object\.freeze/);
  assert.match(coreSkills, /REVENANT_CORE_BASE_SKILL_MECHANICS/);
  assert.doesNotMatch(coreSkills, /REVENANT_CORE_BALANCE_PROFILES/);
  assert.match(coreProfiles, /REVENANT_CORE_BALANCE_PROFILES/);
  assert.match(renegadeSkills, /RENEGADE_BASE_SKILL_MECHANICS/);
  assert.doesNotMatch(renegadeSkills, /RENEGADE_PROFILE_IDS|RENEGADE_BALANCE_PROFILES/);
  assert.match(renegadeProfiles, /RENEGADE_PROFILE_IDS/);
  assert.match(renegadeProfiles, /RENEGADE_BALANCE_PROFILES/);
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
    '9.00s'
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
  assert.match(palette.innerHTML, /data-skill="Swap Legends"[\s\S]*?<span class="pal-cd">10\.00s<\/span>/);
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
  assert.equal(result.endState.profession.autoattackChains[SKILL.MISERY_SWIPE], SKILL.MANIFEST_TOXIN);
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
  assert.equal(result.endState.profession.autoattackChains[SKILL.PREPARATION_THRUST], SKILL.RIFT_SLASH);
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
  assert.equal(strikeCoefficient(spiritcrush.effects[1]), 0.75);
  assert.equal(spiritcrush.effects[1].ticks.length, 3);
  assert.equal(spiritcrush.effects[2].ticks.length, 4);
  assert.equal(spiritcrush.effects[2].ticks[0].atMs, 1320);
  assert.equal(spiritcrush.effects[3].ticks.length, 4);
  assert.equal(spiritcrush.effects[3].ticks[0].atMs, 1320);

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

    if (skillId === SKILL.MANIFEST_TOXIN) {
      // Both launched packets outlive a later animation cancel in EVTC replay.
      assert.ok(skill.effects.every((effect) => effect.persistsAfterInterrupt === true));
    }

    assert.equal(damageCount(commitMs - 1), 0, `${skill.name} before commit`);
    assert.equal(damageCount(commitMs), packetCount, `${skill.name} at commit`);
  }

  const committedShattershot = simulate(
    'Herald',
    [{ name: 'Shattershot', interruptMs: 400 }],
    { ...baseHeraldConfig, primaryWeapon: 'Shortbow', secondaryWeapon: '' },
    observationTail(4000)
  );
  const committedBleeds = committedShattershot.events.filter(
    (event) => event.type === 'condition' && event.skillId === SKILL.SHATTERSHOT && event.condition === 'Bleeding'
  );

  // A committed projectile retains every on-hit packet even when its remaining animation is canceled.
  assert.equal(committedBleeds.length, 1);
  assert.equal(committedBleeds[0].at, 0.4);
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
