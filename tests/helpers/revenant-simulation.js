import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { observeGw2Runtime } from '#tests/helpers/live-runtime.js';

export const REVENANT_TEST_CONFIG = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  selectedTraitIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
});

/**
 * Runs a focused Revenant scenario on the registered live owners. Fixtures may seed live state or queue actual
 * events during initialization; a catalog transform supplies test-only data overrides.
 */
export function runRevenant(
  rotation,
  overrides = {},
  { initialize = () => {}, catalog, output, observation, combatStartTime, extend = () => ({}) } = {}
) {
  const config = { specialization: 'Core', ...REVENANT_TEST_CONFIG, ...overrides };
  const native = revenantProfession.liveRuntimeFor(config);
  return observeGw2Runtime({
    profession: {
      ...native,
      ...(catalog ? { catalog: catalog(native.catalog) } : {}),
      // Engine-contract probes may wrap a composed hook while still delegating to the registered owners.
      ...extend(native),
      initialize(runtime) {
        native.initialize(runtime);
        initialize(runtime);
      }
    },
    config,
    rotation,
    output,
    observation,
    combatStartTime
  });
}

/** A landed-eligible player strike that resolves through the actual hit reactions. */
export function revenantHit(at, fields = {}) {
  return {
    type: 'damage',
    at,
    source: 'fixture',
    sourceId: SKILL.PHASE_TRAVERSAL,
    skillId: SKILL.PHASE_TRAVERSAL,
    skillName: 'Phase Traversal',
    actorType: 'player',
    coefficient: 1,
    weaponStrengthProfileId: 'weapon.sword',
    ...fields
  };
}
