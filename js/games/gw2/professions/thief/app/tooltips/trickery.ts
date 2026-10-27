import {
  fromProfile,
  profileFact,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { INITIATIVE } from '#gw2/professions/thief/core/mechanics/resources.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Describe trickery tooltips from the selected balance data. */
export const thiefTrickeryTooltips = {
  [TRAIT.KLEPTOMANIAC]: traitTooltip('Stealing restores initiative.', [['resourceGain', 'Initiative restored']]),
  // Only the traited capacity varies with the patch; the baseline is the shared initiative rule.
  [TRAIT.PREPAREDNESS]: traitTooltip('Increase maximum initiative and gain expertise.', (context, id) => [
    profileFact(context, id, 'attributeBonus', 'Expertise'),
    profileFact(context, id, 'maximumStacks', 'Maximum initiative with Preparedness'),
    { name: 'Maximum initiative without Preparedness', detail: String(INITIATIVE.maximum) }
  ]),
  [TRAIT.LEAD_ATTACKS]: traitTooltip('Spending initiative grants temporary damage stacks. Steal recharges faster.', [
    ['damageIncreasePerStack', 'Strike and condition damage per stack', tooltipPercent],
    ['maximumStacks', 'Maximum stacks'],
    ['duration', 'Stack duration', tooltipSeconds],
    ['rechargeMultiplier', 'Steal recharge', tooltipFactorChange]
  ]),
  // Triggered skill tooltips read the selected skill patch, just like their trait consumers.
  [TRAIT.UNCATCHABLE]: (context, entity, specialization) =>
    skillTooltip('Dodging drops Lesser Caltrops, repeatedly inflicting bleeding and cripple.', (_context, skill) =>
      (skill.effects ?? []).flatMap((effect) =>
        effect.intervalMs == null
          ? []
          : [{ name: `${effect.name} pulse interval`, detail: tooltipSeconds(effect.intervalMs / 1000) }]
      )
    )(context, { ...entity, id: ID.LESSER_CALTROPS }, specialization),
  [TRAIT.BURST_OF_AGILITY]: (context, entity, specialization) =>
    skillTooltip(
      'Landing an attack against a defiant target triggers Lesser Haste, granting quickness, fury, and swiftness to yourself.',
      (_context, skill) => [{ name: 'Base skill recharge', detail: tooltipSeconds(Number(skill.cooldown)) }]
    )(context, { ...entity, id: ID.LESSER_HASTE }, specialization),
  [TRAIT.THRILL_OF_THE_CRIME]: traitTooltip('Stealing grants fury, might, and swiftness to yourself.'),
  [TRAIT.BOUNTIFUL_THEFT]: traitTooltip(
    'Stealing grants vigor and might to yourself. The simulated target has no boons to steal.'
  ),
  [TRAIT.TRICKSTER]: outsideScopeTooltip,
  [TRAIT.PRESSURE_STRIKING]: outsideScopeTooltip,
  [TRAIT.QUICK_POCKETS]: traitTooltip('Weapon swapping restores initiative.', [
    ['resourceGain', 'Initiative restored'],
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.SLEIGHT_OF_HAND]: traitTooltip('Stealing dazes the target and recharges faster.', [
    ['rechargeMultiplier', 'Steal recharge', tooltipFactorChange]
  ]),
  [TRAIT.DEADLY_AMBUSH]: traitTooltip('Stealing inflicts bleeding. Bleeding deals increased damage.', [
    fromProfile(TRAIT.DEADLY_AMBUSH, 'conditionDamageMultiplier', 'Bleeding damage', tooltipFactorChange)
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
