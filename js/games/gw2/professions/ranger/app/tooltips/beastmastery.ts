import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { traitSkillTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Describes Beastmastery from its active balance profiles without owning simulation behavior. */
export const rangerBeastmasteryTooltips = {
  [TRAIT.PACK_ALPHA]: traitTooltip(
    'Your pet gains power, precision, toughness, vitality, and condition damage. Beastmode grants the smaller player bonus. Pet skills recharge faster.',
    [
      ['weaponAttributeBonus', 'Pet bonus to each attribute'],
      ['attributeBonus', 'Player bonus to each attribute in Beastmode'],
      ['rechargeMultiplier', 'Pet skill recharge', tooltipFactorChange]
    ]
  ),
  [TRAIT.LOUD_WHISTLE]: traitTooltip(
    'Your pet deals increased strike damage. Beastmode grants a separate personal strike-damage bonus.',
    [
      fromProfile(TRAIT.LOUD_WHISTLE, 'damageMultiplier', 'Pet strike damage', tooltipFactorChange),
      fromProfile(
        TRAIT.LOUD_WHISTLE,
        'playerDamageMultiplier',
        'Player strike damage in Beastmode',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.PETS_PROWESS]: traitTooltip('Your pet gains ferocity. The bonus also applies to you in Beastmode.', [
    ['attributeBonus', 'Ferocity']
  ]),
  [TRAIT.GO_FOR_THE_EYES]: traitTooltip('The first hit of your merged Beast Ability blinds the target.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.NATURAL_HEALING]: outsideScopeTooltip,
  [TRAIT.RESOUNDING_TIMBRE]: traitTooltip(
    'Completing a command copies your current boons to the active pet. In Beastmode, commands extend your boons instead.',
    [['duration', 'Beastmode boon extension', tooltipSeconds]]
  ),
  [TRAIT.WILTING_STRIKE]: traitTooltip('The first hit of your merged Beast Ability weakens the target.'),
  [TRAIT.BESTIAL_RAGE]: traitTooltip('Control effects while playing Soulbeast grant might and fury.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.HONED_AXES]: traitTooltip(
    'You and your pet gain ferocity. Wielding an axe increases your bonus. Axe skills recharge faster.',
    [
      ['attributeBonus', 'Base ferocity'],
      ['weaponAttributeBonus', 'Ferocity while wielding an axe'],
      ['rechargeMultiplier', 'Axe recharge', tooltipFactorChange]
    ]
  ),
  [TRAIT.BEASTLY_WARDEN]: traitTooltip('Ursine and porcine pets deal increased strike damage.', [
    ['damageMultiplier', 'Pet strike damage', tooltipFactorChange]
  ]),
  [TRAIT.ZEPHYRS_SPEED]: outsideScopeTooltip,
  [TRAIT.GO_FOR_THE_THROAT]: traitSkillTooltip(
    [ID.LESSER_SIC_EM],
    'Beast skill hits invoke Lesser Sic Em for the pet, or the player while merged.',
    (context) => {
      const skill = context.catalog.skillsById.get(ID.LESSER_SIC_EM)!;
      return [
        {
          name: 'Pet strike damage',
          detail: tooltipFactorChange(
            1 + Number(requireEffect(skill, 'buff', 'lesser-sic-em-pet')?.damageIncreasePerStack ?? 0)
          )
        },
        {
          name: 'Merged player strike damage',
          detail: tooltipFactorChange(
            1 + Number(requireEffect(skill, 'buff', 'lesser-sic-em')?.damageIncreasePerStack ?? 0)
          )
        }
      ];
    }
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
