import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { guardianCoreTooltips } from '#gw2/professions/guardian/app/tooltips/core.js';
import { dragonhunterTooltips } from '#gw2/professions/guardian/app/tooltips/dragonhunter.js';
import { firebrandReworkTooltips, firebrandTooltips } from '#gw2/professions/guardian/app/tooltips/firebrand.js';
import { luminaryTooltips } from '#gw2/professions/guardian/app/tooltips/luminary.js';
import { willbenderTooltips } from '#gw2/professions/guardian/app/tooltips/willbender.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const guardianTooltips: ProfessionTooltips = {
  reworks: { 'firebrand-rework': firebrandReworkTooltips },
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
