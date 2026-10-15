import {
  fromProfile,
  outsideScopeTooltip,
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
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { VINDICATOR_DODGE_AUTO_ACTION } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { vindicatorDodgeTooltip } from '#gw2/professions/revenant/app/tooltips/shared.js';

/** Describe vindicator tooltips from the selected balance data. */
export const vindicatorTooltips = {
  skills: {
    [VINDICATOR_JUMP_SKILL.id]: vindicatorDodgeTooltip,
    [VINDICATOR_DODGE_AUTO_ACTION]: () => ({
      description:
        'Start a Vindicator dodge and the current autoattack together. Endurance is spent at takeoff; the grandmaster-selected landing occurs after the airborne phase.',
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
    [TRAIT.BALANCE_IN_DISCORD]: outsideScopeTooltip,
    [TRAIT.EMPIRE_DIVIDED]: traitTooltip('Gain power at the full player health used by combat simulations.', [
      ['attributeBonus', 'Power', (value) => '+' + tooltipDecimal(value)]
    ]),
    [TRAIT.LEVIATHAN_STRENGTH]: traitTooltip(
      'Player-owned strikes deal increased damage while endurance is below full.',
      [
        fromProfile(
          TRAIT.LEVIATHAN_STRENGTH,
          'damageMultiplier',
          'Strike damage below full endurance',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.AMNESTY_OF_SHING_JEA]: outsideScopeTooltip,
    [TRAIT.REDEMPTORS_SERMON]: outsideScopeTooltip,
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
    // Grandmaster tooltips expose their landing payload directly from the same skill definitions as dodge.
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
