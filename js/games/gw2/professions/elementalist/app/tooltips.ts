import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { elementalistCoreTooltips } from '#gw2/professions/elementalist/app/tooltips/core.js';
import { tempestTooltips } from '#gw2/professions/elementalist/app/tooltips/tempest.js';
import { weaverTooltips } from '#gw2/professions/elementalist/app/tooltips/weaver.js';
import { catalystTooltips } from '#gw2/professions/elementalist/app/tooltips/catalyst.js';
import { evokerTooltips } from '#gw2/professions/elementalist/app/tooltips/evoker.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const elementalistTooltips: ProfessionTooltips = {
  skillFacts: elementalistCoreTooltips.skillFacts,
  skills: {
    ...elementalistCoreTooltips.skills,
    ...tempestTooltips.skills,
    ...weaverTooltips.skills,
    ...catalystTooltips.skills,
    ...evokerTooltips.skills
  },
  traits: {
    ...elementalistCoreTooltips.traits,
    ...tempestTooltips.traits,
    ...weaverTooltips.traits,
    ...catalystTooltips.traits,
    ...evokerTooltips.traits
  }
};
