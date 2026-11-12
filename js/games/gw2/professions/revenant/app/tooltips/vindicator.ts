import {
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_DODGE_AUTO_ACTION } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';

/** Describe vindicator tooltips from the selected balance data. */
export const vindicatorTooltips = {
  skills: {
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
          (balanceContext, entity) => [
            { name: 'Base endurance restored', detail: tooltipDecimal(tooltipNumber(entity, 'resourceGain')) },
            profileFact(
              balanceContext,
              TRAIT.SONG_OF_ARBOREUM,
              'resourceGain',
              'Endurance with Song of Arboreum instead'
            ),
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, TRAIT.SONG_OF_ARBOREUM).effects,
              'with Song of Arboreum'
            ).facts
          ]
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
      'Deferred: the trigger requires two faction skills in combat in PvE. Counter reset and refund consumption rules still need confirmation before implementing the counters, Tactics recharge, and opposite-faction energy refunds.'
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
      'Dodge with Death Drop, then gain a temporary player strike-damage bonus after the landing damage resolves.',
      (context) => [
        ...simulationEffectFacts(context.catalog.skillsById.get(ID.DEATH_DROP)!.effects, 'Death Drop').facts,
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
      'Dodge with Imperial Impact, striking and chilling foes while granting might and protection to nearby allies.',
      (context) =>
        simulationEffectFacts(context.catalog.skillsById.get(ID.IMPERIAL_IMPACT)!.effects, 'Imperial Impact').facts
    ),
    [TRAIT.SAINT_OF_ZU_HELTZER]: traitTooltip(
      "Dodge with Saint's Shield, granting alacrity to nearby allies. Incoming damage and healing are outside combat simulation scope.",
      (context) =>
        simulationEffectFacts(context.catalog.skillsById.get(ID.SAINTS_SHIELD)!.effects, "Saint's Shield").facts
    )
  }
} satisfies ProfessionTooltips;
