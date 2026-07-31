import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
} from "../../data/ids.js";

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const HERALD_MECHANICS = freeze({
  legendInvocation: freeze({
    spiritBoon: freeze({
      kind: "protection",
      duration: 3,
      stacks: 1,
    }),
    song: freeze({
      name: "Call of the Dragon",
      coefficient: 0.75,
      conditions: freeze([
        freeze(["Burning", 2, 3]),
        freeze(["Chilled", 1, 3]),
      ]),
      boons: freeze([]),
    }),
  }),
  facetPulseInterval: 3,
  facetPulseBySkillId: freeze({
    [ID.FACET_OF_LIGHT]: freeze({
      kind: "regeneration",
      duration: 4,
      stacks: 1,
    }),
    [ID.FACET_OF_STRENGTH]: freeze({
      kind: "might",
      duration: 12,
      stacks: 1,
    }),
    [ID.FACET_OF_ELEMENTS]: freeze({
      kind: "swiftness",
      duration: 3,
      stacks: 1,
    }),
    [ID.FACET_OF_DARKNESS]: freeze({
      kind: "fury",
      duration: 3,
      stacks: 1,
    }),
    [ID.FACET_OF_CHAOS]: freeze({
      kind: "protection",
      duration: 3,
      stacks: 1,
    }),
  }),
  facetConsumeBySkillId: freeze({
    [ID.FACET_OF_LIGHT]: ID.INFUSE_LIGHT,
    [ID.FACET_OF_STRENGTH]: ID.BURST_OF_STRENGTH,
    [ID.FACET_OF_ELEMENTS]: ID.ELEMENTAL_BLAST,
    [ID.FACET_OF_DARKNESS]: ID.GAZE_OF_DARKNESS,
    [ID.FACET_OF_CHAOS]: ID.CHAOTIC_RELEASE,
    [ID.FACET_OF_NATURE]: ID.TRUE_NATURE,
  }),
  trueNatureConsumeByLegendId: freeze({
    [LEGEND.ASSASSIN]: ID.TRUE_NATURE,
    [LEGEND.DWARF]: ID.TRUE_NATURE_ID_51675,
    [LEGEND.DRAGON]: ID.TRUE_NATURE_ID_51696,
    [LEGEND.CENTAUR]: ID.TRUE_NATURE_ID_51713,
    [LEGEND.DEMON]: ID.TRUE_NATURE_ID_51714,
  }),
  facetSkillByConsumeId: freeze({
    [ID.INFUSE_LIGHT]: ID.FACET_OF_LIGHT,
    [ID.BURST_OF_STRENGTH]: ID.FACET_OF_STRENGTH,
    [ID.ELEMENTAL_BLAST]: ID.FACET_OF_ELEMENTS,
    [ID.GAZE_OF_DARKNESS]: ID.FACET_OF_DARKNESS,
    [ID.CHAOTIC_RELEASE]: ID.FACET_OF_CHAOS,
    [ID.TRUE_NATURE]: ID.FACET_OF_NATURE,
    [ID.TRUE_NATURE_ID_51675]: ID.FACET_OF_NATURE,
    [ID.TRUE_NATURE_ID_51696]: ID.FACET_OF_NATURE,
    [ID.TRUE_NATURE_ID_51713]: ID.FACET_OF_NATURE,
    [ID.TRUE_NATURE_ID_51714]: ID.FACET_OF_NATURE,
  }),
  elementalBlast: freeze({
    coefficientPerPulse: 1.5,
    firstImpactDelay: 0.28,
    pulseInterval: 1,
    conditions: freeze([
      freeze(["Weakness", 1, 5]),
      freeze(["Chilled", 1, 3]),
      freeze(["Burning", 2, 4]),
    ]),
  }),
});
