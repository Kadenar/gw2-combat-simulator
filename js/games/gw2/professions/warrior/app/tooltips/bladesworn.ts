import {
  fromProfile,
  outsideScopeTooltip,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as BLADESWORN } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';

const artillerySlashTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const sharp = entity.id === ID.SHARP_ARTILLERY_SLASH;
  const profile = tooltipProfile(balanceContext, sharp ? BLADESWORN.sharpArtillerySlash : BLADESWORN.artillerySlash);
  return {
    description:
      'Consume all available ammunition for an explosive attack. ' +
      (sharp
        ? 'Sharp as the Wind applies Bleeding, increasing it with more rounds spent; consuming both rounds upgrades daze to stun.'
        : 'Consuming both rounds increases strike damage. The attack also dazes.'),
    facts: sharp
      ? simulationEffectFacts(profile.effects).facts
      : (profile.effects || []).flatMap(
          (effect) =>
            simulationEffectFacts(
              [effect],
              effect.type === 'strike' ? (effect.name === 'One round' ? 'one round spent' : 'two rounds spent') : ''
            ).facts
        )
  };
};

const dragonSlashTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);
  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);
  return {
    description:
      'Consume your Dragon charges and leave Dragon Trigger to release an explosive burst. Strike damage scales linearly from the minimum to the maximum charge value. Sharp as the Wind variants also scale Burning with charges.',
    facts: [
      ...simulationEffectFacts(
        [{ type: 'strike', coefficient: tooltipNumber(selected, 'dragonSlashMinimumCoefficient') }],
        'minimum charge'
      ).facts,
      ...simulationEffectFacts(
        [{ type: 'strike', coefficient: tooltipNumber(selected, 'dragonSlashMaximumCoefficient') }],
        'maximum charges'
      ).facts,
      ...(Number(selected.dragonSlashMinimumBurningDuration) > 0
        ? [
            {
              name: 'Burning duration at minimum charge',
              detail: tooltipSeconds(tooltipNumber(selected, 'dragonSlashMinimumBurningDuration'))
            },
            {
              name: 'Burning duration at maximum charges',
              detail: tooltipSeconds(tooltipNumber(selected, 'dragonSlashMaximumBurningDuration'))
            }
          ]
        : [])
    ]
  };
};

/** Describe bladesworn tooltips from the selected balance data. */
export const bladeswornTooltips = {
  skills: {
    [ID.ARTILLERY_SLASH]: artillerySlashTooltip,
    [ID.SHARP_ARTILLERY_SLASH]: artillerySlashTooltip,
    [ID.UNSHEATHE_GUNSABER]: skillTooltip(
      'Draw your Gunsaber, replace your weapon skills, and trigger applicable weapon-swap and Gunsaber-entry effects.'
    ),
    [ID.SHEATHE_GUNSABER]: skillTooltip(
      'Sheathe your Gunsaber and restore your weapon skills. End an active Dragon Trigger and trigger applicable weapon-swap effects.'
    ),
    [ID.DRAGON_TRIGGER]: skillTooltip(
      'Enter Dragon Trigger, drawing the Gunsaber if needed. Spend Flow at each charging opportunity to build Dragon charges. Release with a Dragon Slash; recharge begins when you leave the trigger. Tactical Reload increases charges gained per opportunity.',
      [
        fromProfile(BLADESWORN.dragonTrigger, 'maximumStacks', 'Maximum Dragon charges'),
        fromProfile(BLADESWORN.dragonTrigger, 'minimumStacks', 'Maximum charges with Daring Dragon'),
        fromProfile(BLADESWORN.dragonTrigger, 'resourceCost', 'Base Flow cost per charge opportunity'),
        fromProfile(BLADESWORN.dragonTrigger, 'cooldown', 'Maximum trigger duration', tooltipSeconds)
      ]
    ),
    [ID.DRAGON_SLASH_FORCE]: dragonSlashTooltip,
    [ID.DRAGON_SLASH_BOOST]: dragonSlashTooltip,
    [ID.DRAGON_SLASH_REACH]: dragonSlashTooltip,
    [ID.SHARP_DRAGON_SLASH_FORCE]: dragonSlashTooltip,
    [ID.SHARP_DRAGON_SLASH_BOOST]: dragonSlashTooltip,
    [ID.SHARP_DRAGON_SLASH_REACH]: dragonSlashTooltip,
    [ID.OVERCHARGED_CARTRIDGES]: (balanceContext) => {
      const profile = tooltipProfile(balanceContext, BLADESWORN.overchargedCartridges);
      return {
        description:
          'Empower your explosions and add Burning to qualifying player explosions. Casting again during the ordinary window replaces it with Supercharged Cartridges. Further casts while supercharged spend ammunition without extending the window.',
        facts: [
          ...simulationEffectFacts(
            profile.effects?.filter((effect) =>
              ['overcharged-cartridges', 'Overcharged Burning'].includes(String(effect.name))
            ),
            'ordinary cartridges; Burning per explosion'
          ).facts,
          ...simulationEffectFacts(
            profile.effects?.filter((effect) =>
              ['supercharged-cartridges', 'Supercharged Burning'].includes(String(effect.name))
            ),
            'supercharged; replaces ordinary cartridges'
          ).facts,
          ...(profile.effects
            ?.filter((effect) => effect.type === 'buff')
            .map((effect) => ({
              name: `${effect.kind === 'supercharged-cartridges' ? 'Supercharged' : 'Ordinary'} explosion damage`,
              detail: tooltipPercent(tooltipNumber(effect, 'damageIncreasePerStack'))
            })) || [])
        ]
      };
    },
    [ID.TACTICAL_RELOAD]: skillTooltip(
      'Restore ammunition to Bladesworn skills and prepare a bonus to charge gain for your next Dragon Trigger. Entering Dragon Trigger consumes the bonus.'
    ),
    [ID.DRAGONSPIKE_MINE]: skillTooltip("Apply the listed effects and reset Dragon Trigger's recharge."),
    [ID.FLOW_STABILIZER]: skillTooltip(
      'Gain Fury and a temporary increase to passive Flow generation. If Fury was already active before this cast, also gain Flow immediately.',
      [fromProfile(BLADESWORN.resources, 'attributePerStack', 'Additional Flow per second per Positive Flow stack')]
    )
  },
  traits: {
    [TRAIT.GUN_X_SWORD]: traitTooltip(
      'Replace adrenaline with flow. Unlock the gunsaber, Dragon Trigger, and charged Dragon Slash attacks.'
    ),
    [TRAIT.DRAGONSCALE_DEFENSE]: traitTooltip('Entering Dragon Trigger grants stability.'),
    [TRAIT.GUNS_AND_GLORY]: traitTooltip(
      'Qualifying explosions extend a temporary ferocity bonus, up to its duration cap.',
      [
        ['attributeBonus', 'Ferocity'],
        ['resourceGain', 'Duration added per explosion', tooltipSeconds],
        ['maximumStacks', 'Maximum remaining duration', tooltipSeconds]
      ]
    ),
    [TRAIT.UNSEEN_SWORD]: traitTooltip(
      'Entering gunsaber in combat strikes the target and opens a positive-flow window.',
      [['internalCooldown', 'Entry-trait cooldown', tooltipSeconds]]
    ),
    [TRAIT.SHARP_AS_THE_WIND]: traitTooltip(
      'Entering gunsaber in combat inflicts burning and grants positive flow. Supported gunsaber and Dragon Slash skills use their burning variants.',
      [['internalCooldown', 'Entry-trait cooldown', tooltipSeconds]]
    ),
    [TRAIT.RIVERS_FLOW]: traitTooltip(
      'Entering gunsaber in combat grants might to the party and opens a positive-flow window.',
      [['internalCooldown', 'Entry-trait cooldown', tooltipSeconds]]
    ),
    [TRAIT.UNSHAKABLE_MOUNTAIN]: outsideScopeTooltip,
    [TRAIT.FIERCE_AS_FIRE]: traitTooltip('Spending ammunition grants damage-bonus stacks, one per round spent.', [
      ['damageIncreasePerStack', 'Strike and condition damage per stack', tooltipPercent],
      ['maximumStacks', 'Maximum stacks', tooltipDecimal]
    ]),
    [TRAIT.LUSH_FOREST]: traitTooltip(
      'Spending ammunition from a fully loaded skill reduces eligible active-bar cooldowns. Gunsaber swaps, Dragon Trigger, and Artillery Slash are excluded.',
      [['rechargeReduction', 'Recharge reduction', tooltipSeconds]]
    ),
    [TRAIT.IMMORTAL_DRAGON]: outsideScopeTooltip,
    [TRAIT.UNYIELDING_DRAGON]: traitTooltip(
      'Dragon Slash applies a stun control event, triggering supported control-dependent traits.'
    ),
    [TRAIT.DARING_DRAGON]: traitTooltip(
      'Dragon Trigger charges with fewer bullets and spends more flow per bullet. Releasing Dragon Slash grants alacrity to the party. Force uses a provisional maximum damage coefficient estimated from the power alacrity benchmark; its partial-charge curve and the other Slash variants remain unverified.',
      [
        fromProfile(BLADESWORN.dragonTrigger, 'minimumStacks', 'Maximum Dragon Trigger charges with Daring Dragon'),
        fromProfile(BLADESWORN.dragonTrigger, 'maximumStacks', 'Maximum Dragon Trigger charges without Daring Dragon'),
        ['resourceCostMultiplier', 'Flow cost per charge multiplier', (value) => `${tooltipDecimal(value)}×`],
        [
          'coefficientMultiplier',
          'Force maximum coefficient multiplier (estimated)',
          (value) => `${tooltipDecimal(value)}×`
        ]
      ]
    )
  }
} satisfies ProfessionTooltips;
