import {
  fromSkill,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipSeconds,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext, skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { guardianHonorTooltips } from '#gw2/professions/guardian/app/tooltips/honor.js';
import { guardianRadianceTooltips } from '#gw2/professions/guardian/app/tooltips/radiance.js';
import { virtueTooltip } from '#gw2/professions/guardian/app/tooltips/shared.js';
import { guardianValorTooltips } from '#gw2/professions/guardian/app/tooltips/valor.js';
import { guardianVirtuesTooltips } from '#gw2/professions/guardian/app/tooltips/virtues.js';
import { guardianZealTooltips } from '#gw2/professions/guardian/app/tooltips/zeal.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

const renewedFocusTooltip: DescribeSimulationTooltip = skillTooltip(
  'Complete the channel to refresh virtue recharges, restore virtue ammunition, and ready virtue passives. Invulnerability is outside combat simulation scope.'
);

const weaponSwapTooltip: DescribeSimulationTooltip = skillTooltip(
  'Swap to your other weapon set and trigger applicable weapon-swap effects.'
);

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const guardianCoreTooltips = {
  skills: {
    [ID.RENEWED_FOCUS]: renewedFocusTooltip,
    ...Object.fromEntries([ID.COURAGE, ID.RESOLVE].map((id) => [id, virtueTooltip])),
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: weaponSwapTooltip,
    [ID.HELIO_RUSH]: skillTooltip(
      'Rush through your target and strike. An Illuminated charge or an active Symbol of Luminance empowers the impact. The attack then arms a new Illuminated charge for another eligible spear attack.',
      [fromSkill(ID.HELIO_RUSH, 'illuminatedDamageMultiplier', 'Strike damage while Illuminated', tooltipFactorChange)]
    ),
    [ID.GLEAMING_DISC]: skillTooltip(
      'Strike with a disc and its shockwave. Illumination increases the shockwave damage by the listed share of the base total coefficient. The attack then arms a new Illuminated charge for another eligible spear attack.',
      [
        fromSkill(
          ID.GLEAMING_DISC,
          'illuminatedDamageMultiplier',
          'Additional share of base total coefficient while Illuminated',
          tooltipFactorChange
        )
      ]
    ),
    [ID.SOLAR_STORM]: skillTooltip(
      'Strike with a volley of projectiles. Illumination adds the extra projectiles listed separately. The attack then arms a new Illuminated charge for another eligible spear attack.',
      (balanceContext) =>
        simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.SOLAR_STORM), 'illumination').effects,
          'additional while Illuminated'
        ).facts
    ),
    [ID.SYMBOL_OF_LUMINANCE]: skillTooltip(
      'Create a damaging symbol. During its luminance window, eligible spear attacks receive their Illuminated effects without spending an armed charge.',
      (balanceContext) =>
        simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.SYMBOL_OF_LUMINANCE), 'illumination').effects
        ).facts
    ),
    [ID.SYMBOL_OF_IGNITION]: skillTooltip(
      'Create a damaging symbol and an ignition field. Other qualifying player strikes, torch pulses, and fire-whirl bolts trigger additional Burning while the field is active. Projectile and nonprojectile triggers have independent cooldowns.',
      (balanceContext) => [
        ...simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.SYMBOL_OF_IGNITION), 'ignition').effects,
          'ignition field; Burning is per trigger'
        ).facts,
        {
          name: 'Ignition interval per trigger group',
          detail: tooltipSeconds(skillNumberFromContext(balanceContext, ID.SYMBOL_OF_IGNITION, 'internalCooldown'))
        }
      ]
    ),
    [ID.BANE_SIGNET]: skillTooltip(
      'Passively gain power while this signet is ready. Activate to knock down the target. Perfect Inscriptions strengthens the passive and keeps it active during recharge.',
      (context) => [
        {
          name: 'Base passive power',
          detail: tooltipDecimal(skillNumberFromContext(context, ID.BANE_SIGNET, 'attributeBonuses.power'))
        }
      ]
    ),
    [ID.SIGNET_OF_WRATH]: skillTooltip(
      'Passively gain condition damage while this signet is ready. Activate to immobilize the target. Perfect Inscriptions strengthens the passive and keeps it active during recharge.',
      (context) => [
        {
          name: 'Base passive condition damage',
          detail: tooltipDecimal(
            skillNumberFromContext(context, ID.SIGNET_OF_WRATH, 'attributeBonuses.conditionDamage')
          )
        }
      ]
    ),
    [ID.ZEALOTS_FLAME]: skillTooltip(
      "Apply pulsing Burning and temporarily unlock Zealot's Fire. Radiant Fire changes its ammunition, recharge, Burning duration, and follow-up window."
    ),
    [ID.ZEALOTS_FIRE]: skillTooltip(
      "Consume the Zealot's Flame follow-up to strike and burn your target. Its temporary reuse restriction ends when you perform another combat action."
    ),
    [ID.BINDING_BLADE]: skillTooltip('Strike and tether your target, then temporarily unlock the pull follow-up.'),
    [ID.SHIELD_OF_ABSORPTION]: skillTooltip(
      'Knock back the target and temporarily unlock the shield follow-up. Projectile absorption and healing are outside combat simulation scope.'
    ),
    [ID.SHIELD_OF_ABSORPTION_ID_DETONATE]: skillTooltip(
      'Consume the Shield of Absorption follow-up. Its healing adds no damage or status effect within combat simulation scope.'
    ),
    [ID.JUSTICE]: skillTooltip(
      'Activate Justice to arm Burning on your next qualifying hit. While its passive is ready, qualifying hits periodically burn the target; activation and the passive use their listed alternatives.',
      (balanceContext) => [
        skillFact(balanceContext, ID.JUSTICE, 'threshold', 'Base qualifying hits per passive trigger'),
        ...simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(balanceContext, ID.JUSTICE), 'justice').effects
        ).facts
      ]
    ),
    [ID.BANISH]: skillTooltip("Strike and knock back your target. A completed cast resets Mighty Blow's recharge.")
  },
  traits: {
    ...guardianZealTooltips,
    ...guardianRadianceTooltips,
    ...guardianValorTooltips,
    ...guardianHonorTooltips,
    ...guardianVirtuesTooltips
  }
} satisfies ProfessionTooltips;
