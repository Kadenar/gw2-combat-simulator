import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  traitSkillTooltip,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { requireEffect, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { resourceTooltip } from '#gw2/professions/warrior/app/tooltips/shared.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Describe spellbreaker tooltips from the selected balance data. */
export const spellbreakerTooltips = {
  skills: {
    [ID.EARTHSHAKER_ID_40601]: resourceTooltip,
    [ID.SKULL_CRACK_ID_41110]: resourceTooltip,
    [ID.ARCING_SLICE_ID_42707]: resourceTooltip,
    [ID.COMBUSTIVE_SHOT_ID_42803]: resourceTooltip,
    [ID.EVISCERATE_ID_43566]: resourceTooltip,
    [ID.PATH_TO_VICTORY_ID_72089]: resourceTooltip,
    [ID.HARRIERS_TOSS_ID_73014]: resourceTooltip,
    [ID.FULL_COUNTER]: () => ({
      description:
        'Spend adrenaline to prepare Full Counter. Incoming attacks are outside simulation scope, so its counterattack and control do not trigger.',
      facts: []
    })
  },
  traits: {
    [TRAIT.SPELLBREAKERS_CONVICTION]: traitTooltip('Unlock Full Counter and the Spellbreaker adrenaline limit.'),
    [TRAIT.DISPELLING_FORCE]: outsideScopeTooltip,
    [TRAIT.ATTACKERS_INSIGHT]: traitTooltip(
      'Player control effects grant stacking power, precision, and ferocity. Kick grants additional stacks against a defiant target.',
      [
        ['attributePerStack', 'Each attribute per stack'],
        ['maximumStacks', 'Maximum stacks']
      ]
    ),
    [TRAIT.PURE_STRIKE]: traitTooltip(
      'Critical strikes deal increased damage. Target boons are absent in this simulation.',
      [['criticalDamage', 'Critical damage', tooltipFactorChange]]
    ),
    [TRAIT.GUARD_COUNTER]: outsideScopeTooltip,
    [TRAIT.NO_ESCAPE]: traitTooltip('Player daze and stun applications also immobilize.'),
    [TRAIT.LOSS_AVERSION]: outsideScopeTooltip,
    [TRAIT.RESILIENT_COUNTER]: outsideScopeTooltip,
    [TRAIT.SUN_AND_MOON_STYLE]: traitTooltip('Deal increased strike damage while wielding a main-hand dagger.', [
      fromProfile(TRAIT.SUN_AND_MOON_STYLE, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.ENCHANTMENT_COLLAPSE]: outsideScopeTooltip,
    [TRAIT.RESOLUTE_COUNTER]: outsideScopeTooltip,
    [TRAIT.MAGEBANE_TETHER]: traitSkillTooltip(
      [ID.MAGEBANE_TETHER],
      'Qualifying burst hits tether the target, increasing strike damage while the tether lasts. Alacrity shortens its recharge.',
      (context) => {
        // Tether's strike bonus is local; other buff fields may describe narrower damage categories.
        const effect = requireEffect(requireSkillFromContext(context, ID.MAGEBANE_TETHER), 'buff', 'magebane-tether');
        return effect
          ? [
              {
                name: 'Strike damage while tethered',
                detail: tooltipPercent(tooltipNumber(effect, 'damageIncreasePerStack'))
              }
            ]
          : [];
      }
    )
  }
} satisfies ProfessionTooltips;
