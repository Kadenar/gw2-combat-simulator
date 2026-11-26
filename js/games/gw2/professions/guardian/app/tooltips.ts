import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { guardianCoreTooltips } from '#gw2/professions/guardian/app/tooltips/core.js';
import { dragonhunterTooltips } from '#gw2/professions/guardian/app/tooltips/dragonhunter.js';
import { firebrandTooltips } from '#gw2/professions/guardian/app/tooltips/firebrand.js';
import { luminaryTooltips } from '#gw2/professions/guardian/app/tooltips/luminary.js';
import { guardianModifierDescriptions } from '#gw2/professions/guardian/app/tooltips/modifiers.js';
import { willbenderTooltips } from '#gw2/professions/guardian/app/tooltips/willbender.js';
import { radiantFireMaximumAmmo } from '#gw2/professions/guardian/core/traits/radiance/index.js';
import { eternalArmoryMaximumAmmo } from '#gw2/professions/guardian/core/traits/zeal/index.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const guardianTooltips: ProfessionTooltips = {
  modifiers: guardianModifierDescriptions,
  // Reuse combat charge limits and show torch recharge before Alacrity.
  skillCosts(_context, skill, selection) {
    const ammo = eternalArmoryMaximumAmmo(selection, skill, radiantFireMaximumAmmo(selection, skill, skill.ammo ?? 0));
    const cooldown =
      skill.weapon === 'Torch' && skill.cooldown && selection.hasTrait(TRAIT.RADIANT_FIRE)
        ? skill.cooldown *
          balanceProfileNumber(selection.requireBalanceProfile(TRAIT.RADIANT_FIRE), 'rechargeMultiplier')
        : undefined;
    return { ammo, cooldown };
  },
  skillFacts: firebrandTooltips.skillFacts,
  skills: {
    ...guardianCoreTooltips.skills,
    ...dragonhunterTooltips.skills,
    ...firebrandTooltips.skills,
    ...willbenderTooltips.skills,
    ...luminaryTooltips.skills
  },
  traits: {
    ...guardianCoreTooltips.traits,
    ...dragonhunterTooltips.traits,
    ...firebrandTooltips.traits,
    ...willbenderTooltips.traits,
    ...luminaryTooltips.traits
  }
};
