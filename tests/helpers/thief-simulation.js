import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { observeGw2Runtime } from '#tests/helpers/live-runtime.js';

export const THIEF_TEST_CONFIG = Object.freeze({
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  selectedTraitIds: [],
  selectedSkills: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
});

/**
 * Runs a focused Thief scenario on the registered live owners. Fixtures may seed live state or queue actual events
 * during initialization; a catalog transform supplies test-only data overrides. Each probe `[at, observe]` runs as
 * queued work after the other same-instant work, so it observes exactly the state the live runtime holds there.
 */
export function runThief(
  rotation,
  overrides = {},
  {
    initialize = () => {},
    catalog,
    output,
    observation,
    combatStartTime,
    extend = () => ({}),
    profession = thiefProfession,
    probes = []
  } = {}
) {
  const config = { specialization: 'Core', ...THIEF_TEST_CONFIG, ...overrides };
  const native = profession.liveRuntimeFor(config);
  const extension = extend(native);
  return observeGw2Runtime({
    profession: {
      ...native,
      ...(catalog ? { catalog: catalog(native.catalog) } : {}),
      // Engine-contract probes may wrap a composed hook while still delegating to the registered owners.
      ...extension,
      tasks: {
        ...(extension.tasks ?? native.tasks),
        'test.probe': (runtime, data) => probes[data.index][1](runtime)
      },
      initialize(runtime) {
        native.initialize(runtime);
        initialize(runtime);
        for (const [index, [at]] of probes.entries()) runtime.schedule('test.probe', at, { index }, undefined, 100);
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
export function thiefHit(at, fields = {}) {
  return {
    type: 'damage',
    at,
    source: 'fixture',
    sourceId: ID.DOUBLE_STRIKE,
    skillId: ID.DOUBLE_STRIKE,
    skillName: 'Double Strike',
    actorType: 'player',
    coefficient: 1,
    weaponStrengthProfileId: 'weapon.dagger',
    ...fields
  };
}
