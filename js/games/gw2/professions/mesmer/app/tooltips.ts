import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { chronomancerTooltips } from '#gw2/professions/mesmer/app/tooltips/chronomancer.js';
import { mesmerCoreTooltips } from '#gw2/professions/mesmer/app/tooltips/core.js';
import { mirageTooltips } from '#gw2/professions/mesmer/app/tooltips/mirage.js';
import { troubadourTooltips } from '#gw2/professions/mesmer/app/tooltips/troubadour.js';
import { virtuosoTooltips } from '#gw2/professions/mesmer/app/tooltips/virtuoso.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const mesmerTooltips: ProfessionTooltips = {
  skillFacts: mesmerCoreTooltips.skillFacts,
  skills: {
    ...mesmerCoreTooltips.skills,
    ...chronomancerTooltips.skills,
    ...mirageTooltips.skills,
    ...virtuosoTooltips.skills,
    ...troubadourTooltips.skills
  },
  traits: {
    ...mesmerCoreTooltips.traits,
    ...chronomancerTooltips.traits,
    ...mirageTooltips.traits,
    ...virtuosoTooltips.traits,
    ...troubadourTooltips.traits
  }
};
