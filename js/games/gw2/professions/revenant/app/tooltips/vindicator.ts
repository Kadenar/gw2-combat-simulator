import {
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipHasTrait,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { vindicatorDodgeTooltip } from '#gw2/professions/revenant/app/tooltips/shared.js';
import { allianceSlots } from '#gw2/professions/revenant/data/alliance.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_DODGE_INPUT } from '#gw2/professions/revenant/data/vindicator-dodge.js';
import { VINDICATOR_DODGE_AUTO_ACTION } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** The trait identifies the landing; its facts retain payload details without repeating that skill name. */
function dodgeTraitFacts(skill: Skill) {
  return simulationEffectFacts(
    skill.effects?.map((effect) => (effect.name === skill.name ? { ...effect, name: undefined } : effect))
  ).facts;
}

/** Describe vindicator tooltips from the selected balance data. */
export const vindicatorTooltips = {
  // Show what this cast can earn or refund without assuming the player has already earned it.
  skillFacts(context, skill, build) {
    if (!tooltipHasTrait(context, build, TRAIT.HEATED_RIVALRY) || skill.id === ID.DROP_URN_OF_SAINT_VIKTOR) return [];

    const faction = allianceSlots(context.catalog.skillsById).factionBySkill.get(skill.id);

    if (!faction) return [];

    const cost = skill.energyCost ?? 0;
    return [
      { name: 'Heated Rivalry', detail: 'Counts as a ' + faction + ' skill' },
      ...(cost > 0 ? [{ name: 'Energy refunded with Heated Rivalry ready', detail: tooltipDecimal(cost) }] : [])
    ];
  },
  skills: {
    [VINDICATOR_DODGE_INPUT.id]: vindicatorDodgeTooltip,
    [ID.LEGENDARY_ALLIANCE_STANCE_ID_62749]: skillTooltip('Invoke the Alliance to use its Luxon and Kurzick skills.'),
    [ID.LEGENDARY_ALLIANCE_STANCE]: skillTooltip('Invoke the Alliance to use its Luxon and Kurzick skills.'),
    [ID.ARCHEMORUS_STRIKE]: skillTooltip(
      'Strike nearby foes, knock them down for 3 seconds, and finish a combo with a blast. Requires Friend of the Luxons and works with any equipped legends.'
    ),
    [ID.ALLIANCE_TACTICS]: skillTooltip(
      'Switch between Luxon and Kurzick skills without swapping legends. Balance in Discord grants endurance in combat. Each faction keeps its own cooldowns.',
      (_context, skill) => [
        { name: 'Endurance with Balance in Discord', detail: tooltipDecimal(tooltipNumber(skill, 'resourceGain')) }
      ]
    ),
    [ID.SELFLESS_SPIRIT]: skillTooltip('Spend Energy to heal nearby allies. Healing is outside simulation scope.'),
    [ID.BATTLE_DANCE]: skillTooltip('Evade backward and grant resistance and regeneration to nearby allies.'),
    [ID.TREE_SONG]: skillTooltip(
      'Grant regeneration and gain endurance for affecting the player. Additional allies, condition cleansing, and healing are outside simulation scope.'
    ),
    [ID.AWAKENING]: skillTooltip(
      'Grant protection to nearby allies and initial stability to yourself. Incoming stuns are outside simulation scope.'
    ),
    [ID.URN_OF_SAINT_VIKTOR]: skillTooltip(
      'Maintain the Urn with Energy upkeep until released, starved of Energy, or a legend swap. Healing and self-damage are outside simulation scope.'
    ),
    [ID.DROP_URN_OF_SAINT_VIKTOR]: skillTooltip(
      'End the Urn upkeep. Player health is fixed at full, so no health-threshold boons apply.'
    ),
    [VINDICATOR_DODGE_AUTO_ACTION]: () => ({
      description:
        'Start a Vindicator dodge and the current autoattack together. Endurance is spent at takeoff; the trait-selected landing occurs after the airborne phase.',
      facts: []
    }),
    ...Object.fromEntries(
      [ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058].map((id) => [
        id,
        skillTooltip(
          "Restore endurance. Song of Arboreum replaces the base refund and grants vigor. Reaver's Curse empowers the next landing; Angsiyan's Trust also restores energy when used in combat.",
          (context, skill, build) => {
            const song = tooltipHasTrait(context, build, TRAIT.SONG_OF_ARBOREUM);
            return [
              song
                ? profileFact(context, TRAIT.SONG_OF_ARBOREUM, 'resourceGain', 'Endurance restored')
                : { name: 'Endurance restored', detail: tooltipDecimal(tooltipNumber(skill, 'resourceGain')) },
              ...(song ? simulationEffectFacts(tooltipProfile(context, TRAIT.SONG_OF_ARBOREUM).effects).facts : []),
              ...(tooltipHasTrait(context, build, TRAIT.ANGSIYANS_TRUST)
                ? [profileFact(context, TRAIT.ANGSIYANS_TRUST, 'resourceGain', 'Energy gained in combat')]
                : [])
            ];
          }
        )
      ])
    )
  },
  traits: {
    [TRAIT.TENACIOUS_RUIN]: traitTooltip('Replace the ordinary dodge with the selected Vindicator dodge attack.'),
    [TRAIT.BALANCE_IN_DISCORD]: traitTooltip(
      'Gain endurance on successful legend swaps in combat. Alliance Tactics grants its separate endurance reward in combat.',
      [['resourceGain', 'Endurance per combat legend swap']]
    ),
    [TRAIT.RISE_TO_THE_OCCASION]: traitTooltip(
      'Player-owned strikes deal increased damage while endurance is below full. Outgoing healing is outside simulation scope.',
      [['damageIncrease', 'Strike damage below full endurance', tooltipPercent]]
    ),
    [TRAIT.FRIEND_OF_THE_LUXONS]: traitTooltip(
      "Unlock Archemorus's Strike with any equipped legends. Completing a Luxon skill grants a temporary player strike-damage bonus. Further Luxon skills refresh the bonus.",
      [['damageIncrease', 'Strike damage during the bonus', tooltipPercent]]
    ),
    [TRAIT.HEATED_RIVALRY]: traitTooltip(
      'Complete skills from one Alliance faction in combat to recharge Alliance Tactics. Your next energy-spending skill from the other faction refunds its cost and counts toward the next reset. Raising the Urn counts as a Kurzick skill and preserves a ready refund.',
      [['minimumStacks', 'Faction skills required']]
    ),
    [TRAIT.FRIEND_OF_THE_KURZICKS]: traitTooltip(
      'Healing after Kurzick skills, ally barrier, and projectile blocking are outside simulation scope. Shield of Saint Viktor and its light combo field are not implemented.'
    ),
    [TRAIT.REAVERS_CURSE]: traitTooltip(
      'Energy Meld recharges faster and empowers the next dodge that lands within its buff window.',
      [
        ['rechargeMultiplier', 'Energy Meld recharge duration', tooltipFactorChange],
        ['damageMultiplier', 'Empowered dodge damage', tooltipFactorChange]
      ]
    ),
    [TRAIT.ANGSIYANS_TRUST]: traitTooltip('Energy Meld costs no energy and grants energy during combat.', [
      ['resourceGain', 'Energy gained']
    ]),
    [TRAIT.SONG_OF_ARBOREUM]: traitTooltip('Energy Meld grants increased endurance and vigor.', [
      ['resourceGain', 'Endurance gained']
    ]),
    // Dodge traits expose their landing payload directly from the same skill definitions as dodge.
    [TRAIT.FORERUNNER_OF_DEATH]: traitTooltip(
      'Dodge to strike nearby foes, then gain a temporary strike-damage bonus after landing.',
      (context) => [
        ...dodgeTraitFacts(context.catalog.skillsById.get(ID.DEATH_DROP)!),
        profileFact(
          context,
          TRAIT.FORERUNNER_OF_DEATH,
          'damageIncrease',
          'Strike damage during the bonus',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.VASSALS_OF_THE_EMPIRE]: traitTooltip(
      'Dodge to strike and chill foes while granting might and protection to nearby allies.',
      (context) => dodgeTraitFacts(context.catalog.skillsById.get(ID.IMPERIAL_IMPACT)!)
    ),
    [TRAIT.SAINT_OF_ZU_HELTZER]: traitTooltip(
      'Dodge to grant alacrity to nearby allies. Incoming damage and healing are outside combat simulation scope.',
      (context) => dodgeTraitFacts(context.catalog.skillsById.get(ID.SAINTS_SHIELD)!)
    )
  }
} satisfies ProfessionTooltips<RevenantSkill>;
