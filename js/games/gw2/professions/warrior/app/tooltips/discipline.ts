import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Describe discipline tooltips from the selected balance data. */
export const warriorDisciplineTooltips = {
  [TRAIT.VERSATILE_RAGE]: traitTooltip('Weapon swapping grants adrenaline.', [
    ['resourceGain', 'Adrenaline per weapon swap']
  ]),
  [TRAIT.FAST_HANDS]: outsideScopeTooltip,
  [TRAIT.VERSATILE_POWER]: traitTooltip('Burst skills recharge faster.', [
    ['rechargeMultiplier', 'Burst recharge reduction', (value) => tooltipPercent(1 - value)]
  ]),
  [TRAIT.CRACK_SHOT]: traitTooltip(
    'Enhance rifle and longbow autoattacks: Fierce Shot deals increased strike damage, and each Dual Shot arrow inflicts burning.',
    [fromProfile(TRAIT.CRACK_SHOT, 'damageMultiplier', 'Fierce Shot damage', tooltipFactorChange)],
    'per Dual Shot arrow'
  ),
  [TRAIT.WARRIORS_SPRINT]: traitTooltip('Deal increased strike damage while you have swiftness.', [
    fromProfile(TRAIT.WARRIORS_SPRINT, 'damageIncrease', 'Strike damage with swiftness', tooltipPercent)
  ]),
  [TRAIT.STALWART_FOCUS]: outsideScopeTooltip,
  [TRAIT.DOUBLED_STANDARDS]: outsideScopeTooltip,
  [TRAIT.DESTRUCTION_OF_THE_EMPOWERED]: outsideScopeTooltip,
  [TRAIT.BRAWLERS_RECOVERY]: outsideScopeTooltip,
  [TRAIT.AXE_MASTERY]: traitTooltip(
    'Gain ferocity, with an additional bonus while wielding an axe. Eligible axe critical hits grant adrenaline.',
    [
      ['attributeBonuses.ferocity', 'Ferocity'],
      ['conditionalAttributeBonuses.ferocity', 'Total ferocity while wielding an axe'],
      ['rechargeMultiplier', 'Axe recharge reduction', (value) => tooltipPercent(1 - value)],
      ['resourceGain', 'Adrenaline per axe critical hit']
    ]
  ),
  [TRAIT.HEIGHTENED_FOCUS]: traitTooltip(
    "A qualifying strike below the target's half-health threshold grants quickness and recharges every burst skill. Adrenaline-scaled outgoing healing is not simulated.",
    [['internalCooldown', 'Trigger cooldown', tooltipSeconds]]
  ),
  [TRAIT.BURST_MASTERY]: traitTooltip(
    'Bursts deal increased strike damage. Completing a burst refunds part of the resource spent and grants swiftness.',
    [
      fromProfile(TRAIT.BURST_MASTERY, 'damageMultiplier', 'Burst strike damage', tooltipFactorChange),
      ['resourceGain', 'Resource refunded', tooltipPercent]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
