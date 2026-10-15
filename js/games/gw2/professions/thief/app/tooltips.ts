import type { ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { thiefCoreTooltips } from '#gw2/professions/thief/app/tooltips/core.js';
import { daredevilTooltips } from '#gw2/professions/thief/app/tooltips/daredevil.js';
import { deadeyeTooltips } from '#gw2/professions/thief/app/tooltips/deadeye.js';
import { specterTooltips } from '#gw2/professions/thief/app/tooltips/specter.js';
import { antiquaryTooltips } from '#gw2/professions/thief/app/tooltips/antiquary.js';

/** Combine owner-local descriptions while keeping presentation separate from runtime behavior. */
export const thiefTooltips: ProfessionTooltips = {
  skillFacts: thiefCoreTooltips.skillFacts,
  skills: {
    ...thiefCoreTooltips.skills,
    ...daredevilTooltips.skills,
    ...deadeyeTooltips.skills,
    ...specterTooltips.skills,
    ...antiquaryTooltips.skills
  },
  traits: {
    ...thiefCoreTooltips.traits,
    ...daredevilTooltips.traits,
    ...deadeyeTooltips.traits,
    ...specterTooltips.traits,
    ...antiquaryTooltips.traits
  }
};
