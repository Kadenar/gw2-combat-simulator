import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  fromSkill,
  fromModifier,
  tooltipFactorChange,
  tooltipSeconds,
  skillTooltip,
  skillFact,
  modifierFact,
  tooltipDecimal,
  simulationEffectFacts,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';
import { rangerMarksmanshipTooltips } from '#gw2/professions/ranger/app/tooltips/marksmanship.js';
import { rangerNatureMagicTooltips } from '#gw2/professions/ranger/app/tooltips/nature-magic.js';
import { rangerSkirmishingTooltips } from '#gw2/professions/ranger/app/tooltips/skirmishing.js';
import { rangerBeastmasteryTooltips } from '#gw2/professions/ranger/app/tooltips/beastmastery.js';
import { rangerWildernessSurvivalTooltips } from '#gw2/professions/ranger/app/tooltips/wilderness-survival.js';

/** Spirit prose describes its slam marker; ordinary boon and combo facts still come from the selected catalog. */
function spiritTooltip(description: string): DescribeSimulationTooltip {
  return (context, entity) => {
    const skill = context.catalog.skillsById.get(entity.id);

    if (!skill) throw new Error(`Missing tooltip skill: ${entity.id}`);

    const effects = (skill.effects ?? []).filter(
      (effect) =>
        !(
          effect.type === 'custom' &&
          effect.eventType === 'marker' &&
          effect.metadata?.packetKind === 'ranger.spirit-slam'
        )
    );
    return { ...simulationEffectFacts(effects), description };
  };
}

/** Compose core skill and trait-line descriptions using the selected catalog's balance data. */
export const rangerCoreTooltips = {
  skillFacts: (balanceContext, entity) => [
    ...(entity.id === ID.ENDURING_SWING
      ? [skillFact(balanceContext, ID.ENDURING_SWING, 'resourceGain', 'Endurance gained')]
      : []),
    // Some weapon packets opt into conditional rules through damageKind rather than a custom handler.
    ...(entity.effects?.some((effect) => String(effect.damageKind).startsWith('ranger-unleashed-disabled'))
      ? [
          modifierFact(
            balanceContext,
            'ranger.disabled-skill-bonus',
            'factor',
            'Strike damage against defiant targets',
            tooltipFactorChange
          )
        ]
      : []),
    ...(entity.effects?.some((effect) => effect.damageKind === 'ranger-unleashed-disabled-condition-count')
      ? [
          modifierFact(
            balanceContext,
            'ranger.condition-count-skill-bonus',
            'damagePerCondition',
            'Additional strike damage per target condition'
          )
        ]
      : []),
    ...(entity.effects?.some((effect) => effect.damageKind === 'ranger-pounce-defiant')
      ? [
          modifierFact(
            balanceContext,
            'ranger.pounce-defiant',
            'factor',
            'Strike damage against defiant targets',
            tooltipFactorChange
          )
        ]
      : []),
    // Spear leap health bonuses are rendered from their strike coefficient modifiers by the shared tooltip.
    ...(entity.id === ID.FALCONS_STOOP
      ? [
          modifierFact(
            balanceContext,
            'ranger.falcons-stoop-disabled',
            'factor',
            'Strike damage against defiant or immobilized targets',
            tooltipFactorChange
          )
        ]
      : []),
    ...(entity.id === ID.CONSUMING_BITE
      ? [
          modifierFact(
            balanceContext,
            'ranger.consuming-bite-condition-count',
            'coefficientPerCondition',
            'Additional coefficient per target condition',
            tooltipDecimal
          ),
          modifierFact(
            balanceContext,
            'ranger.consuming-bite-condition-count',
            'maximumConditions',
            'Maximum target conditions counted',
            tooltipDecimal
          )
        ]
      : [])
  ],
  skills: {
    [SHARED_SKILL_IDS.DODGE]: skillTooltip(
      'Spend endurance to dodge and trigger applicable dodge traits. Incoming damage is outside combat simulation scope.',
      () => [{ name: 'Endurance spent', detail: String(ENDURANCE.dodgeCost) }]
    ),
    [ID.PET_SWAP]: skillTooltip(
      'Switch to the other selected pet, update its command skills, and trigger pet-swap traits. The new pet receives a fresh Opening Strike opportunity.'
    ),
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: skillTooltip('Swap weapon sets and trigger applicable weapon-swap effects.'),
    [ID.HILT_BASH]: skillTooltip(
      "Strike and daze the target, or stun it if it is defiant. Completing the cast resets Maul's recharge."
    ),
    [ID.WINTERS_BITE]: skillTooltip(
      "Strike and chill the target. Arm Weakness for a later qualifying hit through Soulbeast's Winter's Bite reaction.",
      (balanceContext) =>
        simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.WINTERS_BITE), 'beastmode-weakness').effects,
          'armed follow-up'
        ).facts
    ),
    [ID.SUN_SPIRIT]: skillTooltip(
      "Apply the spirit's effects and trigger Solar Flare Burning.",
      (balanceContext) =>
        simulationEffectFacts(balanceContext.catalog.skillsById.get(ID.SOLAR_FLARE)?.effects, 'Solar Flare').facts
    ),
    [ID.SHARPENING_STONE]: skillTooltip(
      'Arm bleeding charges for your qualifying strikes. Each hit consumes the charge with the earliest expiry.',
      (balanceContext) => [
        skillFact(balanceContext, ID.SHARPENING_STONE, 'charges', 'Bleeding charges'),
        skillFact(balanceContext, ID.SHARPENING_STONE, 'duration', 'Charge lifetime', tooltipSeconds),
        ...simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.SHARPENING_STONE), 'sharpening-stone').effects,
          'per charge consumed'
        ).facts
      ]
    ),
    [ID.DOUBLE_ARC]: skillTooltip(
      "Strike and arm Poisonous Strikes. Your pet's qualifying hits consume the charges; while merged in Beastmode, your hits consume the same charges instead.",
      (balanceContext) => [
        skillFact(balanceContext, ID.DOUBLE_ARC, 'charges', 'Poison charges'),
        skillFact(balanceContext, ID.DOUBLE_ARC, 'duration', 'Charge lifetime', tooltipSeconds),
        ...simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.DOUBLE_ARC), 'poisonous-strikes').effects,
          'per charge consumed'
        ).facts
      ]
    ),
    [ID.CRIPPLING_SHOT]: skillTooltip(
      'Cripple the target and arm Blood Thirst. Subsequent qualifying hits consume its bleeding charges; the arming skill cannot spend them.',
      (balanceContext) => [
        skillFact(balanceContext, ID.CRIPPLING_SHOT, 'charges', 'Bleeding charges'),
        skillFact(balanceContext, ID.CRIPPLING_SHOT, 'duration', 'Charge lifetime', tooltipSeconds),
        ...simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.CRIPPLING_SHOT), 'blood-thirst').effects,
          'per charge consumed'
        ).facts
      ]
    ),
    [ID.SIC_EM]: skillTooltip(
      "Temporarily increase your active pet's strike damage. Soulbeast applies the separate player bonus while merged.",
      [
        fromSkill(ID.SIC_EM, 'duration', 'Base duration', tooltipSeconds),
        fromModifier('ranger.sic-em-pet', 'factor', 'Pet strike damage', tooltipFactorChange),
        fromModifier('ranger.sic-em-player', 'factor', 'Merged player strike damage', tooltipFactorChange)
      ]
    ),
    [ID.LESSER_CALL_OF_THE_WILD]: (context, entity) => ({
      // The shared skill tooltip renders the custom packet's finisher alongside these boon and condition facts.
      ...simulationEffectFacts(
        context.catalog.skillsById.get(entity.id)!.effects?.filter((effect) => effect.type !== 'custom')
      ),
      description:
        'Clarion Bond invokes this skill after a pet swap, granting party boons, weakening the target, and performing a blast finisher.'
    }),
    [ID.FROST_SPIRIT]: spiritTooltip(
      "Grant resistance on summon, perform Cold Snap's blast finisher, then grant resolution with four shakes. Nature's Vengeance repeats the slam after the final shake. Condition cleansing is outside combat simulation scope."
    ),
    [ID.WATER_SPIRIT]: spiritTooltip(
      "Summon a water spirit and grant vigor with four shakes. Aqua Surge's slam is recorded and repeats after the final shake with Nature's Vengeance. Healing is outside combat simulation scope."
    ),
    [ID.SPIRIT_OF_NATURE]: spiritTooltip(
      "Summon a spirit of nature and grant regeneration with four shakes. Nature's Renewal's slam is recorded and repeats after the final shake with Nature's Vengeance. Condition conversion and revival are outside combat simulation scope."
    ),
    [ID.CRIPPLING_ANGUISH_PET]: skillTooltip(
      'The pet applies confusion and torment. Quickness uses a separate autonomous recharge.',
      [
        fromSkill(
          ID.CRIPPLING_ANGUISH_PET,
          'quicknessAutonomousRecharge',
          'Pet recharge with quickness before Alacrity',
          tooltipSeconds
        )
      ]
    ),
    ...Object.fromEntries(
      [ID.MAUL_SOULBEAST, ID.MAUL_BASE].map((id) => [
        id,
        skillTooltip(
          id === ID.MAUL_SOULBEAST
            ? 'Strike and grant yourself Attack of Opportunity after the impact while merged. It empowers your next direct attack. Trait and stance damage cannot consume it.'
            : "Strike and grant your pet Attack of Opportunity after the impact. It empowers your pet's next direct attack. Trait and stance damage cannot consume it.",
          [
            fromSkill(id, 'duration', 'Next-attack window', tooltipSeconds),
            fromModifier(
              'ranger.attack-of-opportunity',
              id === ID.MAUL_SOULBEAST ? 'playerFactor' : 'petFactor',
              id === ID.MAUL_SOULBEAST ? 'Player next-attack damage' : 'Pet next-attack damage',
              tooltipFactorChange
            )
          ]
        )
      ])
    ),
    ...Object.fromEntries(
      [ID.PATH_OF_SCARS, ID.PATH_OF_SCARS_MAX_RANGE].map((id) => [
        id,
        skillTooltip(
          "Strike on the axe's outward and returning paths. The normal and maximum-range variants share their recharge."
        )
      ])
    ),
    ...Object.fromEntries(
      Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT).map((id) => [
        id,
        skillTooltip(
          "Use an empowered spear attack available through stealth or Hunter's Prowess. Starting it consumes the choice, ends stealth, and applies Revealed. Spear slots two through four share recharge with their ordinary versions."
        )
      ])
    ),
    [ID.PANTHERS_PROWL]: skillTooltip(
      "Gain stealth and Hunter's Prowess, temporarily enabling an empowered spear attack even while Revealed. Starting an empowered attack consumes the choice."
    ),
    [ID.COUNTERATTACK]: skillTooltip(
      'Unlock the counterattack follow-up. Incoming attacks and blocking are outside combat simulation scope.'
    ),
    [ID.WE_HEAL_AS_ONE]: skillTooltip(
      "Copy your pet's current boons to yourself and your boons to the pet, using this skill's copy durations. While merged, copy your own boons to yourself. Healing is outside combat simulation scope."
    ),
    [ID.STRENGTH_OF_THE_PACK]: skillTooltip(
      'Grant the listed boons and arm might generation for your active pet. While the buff lasts, your qualifying strikes grant might to that pet.',
      (balanceContext) =>
        simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.STRENGTH_OF_THE_PACK), 'triggered-might')
            .effects,
          'to your active pet per qualifying player hit'
        ).facts
    ),
    [ID.SIGNET_OF_THE_WILD]: skillTooltip(
      'Gain passive ferocity while the signet is ready. Activating the signet applies its listed effects and suspends the passive until recharge finishes.',
      [fromSkill(ID.SIGNET_OF_THE_WILD, 'attributeBonuses.ferocity', 'Passive ferocity')]
    ),
    [ID.STALKERS_STRIKE]: skillTooltip(
      'Strike and poison your target. Against a movement-impaired target, the strike deals increased damage and adds further poison.',
      (balanceContext) => [
        skillFact(
          balanceContext,
          ID.STALKERS_STRIKE,
          'impairedDamageMultiplier',
          'Strike damage against movement-impaired targets',
          tooltipFactorChange
        ),
        ...simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.STALKERS_STRIKE), 'impaired-poison').effects
        ).facts
      ]
    ),
    [ID.FROST_TRAP]: skillTooltip(
      'Lay a trap that strikes and chills in an ice field. When precast before an explicit combat start, the trap remains armed and releases its full pulse sequence when combat begins.'
    )
  },
  traits: {
    ...rangerMarksmanshipTooltips,
    ...rangerNatureMagicTooltips,
    ...rangerSkirmishingTooltips,
    ...rangerBeastmasteryTooltips,
    ...rangerWildernessSurvivalTooltips
  }
} satisfies ProfessionTooltips;
