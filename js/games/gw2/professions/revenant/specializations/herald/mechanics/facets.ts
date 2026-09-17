import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const HERALD_MECHANICS = freeze({
  // Maps each facet's upkeep skill to its consume (flip) skill; this is the forward direction used when activating the flip.
  facetConsumeBySkillId: freeze({
    [ID.FACET_OF_LIGHT]: ID.INFUSE_LIGHT,
    [ID.FACET_OF_STRENGTH]: ID.BURST_OF_STRENGTH,
    [ID.FACET_OF_ELEMENTS]: ID.ELEMENTAL_BLAST,
    [ID.FACET_OF_DARKNESS]: ID.GAZE_OF_DARKNESS,
    [ID.FACET_OF_CHAOS]: ID.CHAOTIC_RELEASE,
    // FACET_OF_NATURE is a special case: the actual consume ID depends on the active legend (see trueNatureConsumeByLegendId).
    [ID.FACET_OF_NATURE]: ID.TRUE_NATURE_ASSASSIN
  }),
  // Facet of Nature has five distinct True Nature skill IDs, one per active legend, while all variants share the parent Facet cooldown.
  trueNatureConsumeByLegendId: freeze({
    [LEGEND.ASSASSIN]: ID.TRUE_NATURE_ASSASSIN,
    [LEGEND.DWARF]: ID.TRUE_NATURE_DWARF,
    [LEGEND.DRAGON]: ID.TRUE_NATURE_DRAGON,
    [LEGEND.CENTAUR]: ID.TRUE_NATURE_CENTAUR,
    [LEGEND.DEMON]: ID.TRUE_NATURE_DEMON
  }),
  // Reverse lookup used by consumeRevenantFacet to find the parent upkeep skill that must be torn down; all True Nature variants map back to the same FACET_OF_NATURE upkeep.
  facetSkillByConsumeId: freeze({
    [ID.INFUSE_LIGHT]: ID.FACET_OF_LIGHT,
    [ID.BURST_OF_STRENGTH]: ID.FACET_OF_STRENGTH,
    [ID.ELEMENTAL_BLAST]: ID.FACET_OF_ELEMENTS,
    [ID.GAZE_OF_DARKNESS]: ID.FACET_OF_DARKNESS,
    [ID.CHAOTIC_RELEASE]: ID.FACET_OF_CHAOS,
    [ID.TRUE_NATURE_ASSASSIN]: ID.FACET_OF_NATURE,
    [ID.TRUE_NATURE_DWARF]: ID.FACET_OF_NATURE,
    [ID.TRUE_NATURE_DRAGON]: ID.FACET_OF_NATURE,
    [ID.TRUE_NATURE_CENTAUR]: ID.FACET_OF_NATURE,
    [ID.TRUE_NATURE_DEMON]: ID.FACET_OF_NATURE
  })
});
