import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { necromancerCoreTooltips } from '#gw2/professions/necromancer/app/tooltips/core.js';
import { harbingerTooltips } from '#gw2/professions/necromancer/app/tooltips/harbinger.js';
import { necromancerModifierDescriptions } from '#gw2/professions/necromancer/app/tooltips/modifiers.js';
import { reaperTooltips } from '#gw2/professions/necromancer/app/tooltips/reaper.js';
import { ritualistTooltips } from '#gw2/professions/necromancer/app/tooltips/ritualist.js';
import { scourgeTooltips } from '#gw2/professions/necromancer/app/tooltips/scourge.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const necromancerTooltips: ProfessionTooltips = {
  modifiers: necromancerModifierDescriptions,
  // The greater shade uses its own capacity and recharge penalty.
  skillCosts(_context, skill, selection) {
    if (skill.id !== ID.MANIFEST_SAND_SHADE || !selection.hasTrait(TRAIT.SAND_SAVANT)) return;

    const profile = selection.requireBalanceProfile(TRAIT.SAND_SAVANT);
    return {
      ammo: balanceProfileNumber(profile, 'maximumStacks'),
      cooldown: (skill.cooldown ?? 0) * balanceProfileNumber(profile, 'rechargePenalty')
    };
  },
  skillFacts: necromancerCoreTooltips.skillFacts,
  skills: {
    ...necromancerCoreTooltips.skills,
    ...reaperTooltips.skills,
    ...scourgeTooltips.skills,
    ...harbingerTooltips.skills,
    ...ritualistTooltips.skills
  },
  traits: {
    ...necromancerCoreTooltips.traits,
    ...reaperTooltips.traits,
    ...scourgeTooltips.traits,
    ...harbingerTooltips.traits,
    ...ritualistTooltips.traits
  }
};
