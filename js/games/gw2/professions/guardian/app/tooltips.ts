import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { guardianCoreTooltips } from '#gw2/professions/guardian/app/tooltips/core.js';
import { dragonhunterTooltips } from '#gw2/professions/guardian/app/tooltips/dragonhunter.js';
import { firebrandTooltips } from '#gw2/professions/guardian/app/tooltips/firebrand.js';
import { luminaryTooltips } from '#gw2/professions/guardian/app/tooltips/luminary.js';
import { guardianModifierDescriptions } from '#gw2/professions/guardian/app/tooltips/modifiers.js';
import { willbenderTooltips } from '#gw2/professions/guardian/app/tooltips/willbender.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const guardianTooltips: ProfessionTooltips = {
  modifiers: guardianModifierDescriptions,
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
