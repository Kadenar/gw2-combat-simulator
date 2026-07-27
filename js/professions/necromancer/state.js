import { NECROMANCER_TRAIT_IDS } from "./data/ids.js";

export function selectedNecromancerTraits(config = {}) {
  return new Set(
    [
      ...(config.traitIds || []),
      ...(config.selectedTraitIds || []),
      ...(config.selectedTraits || []),
    ].map((value) => (Number.isFinite(Number(value)) ? Number(value) : value)),
  );
}

export function hasNecromancerTrait(configOrTraits, traitId) {
  const traits =
    configOrTraits instanceof Set
      ? configOrTraits
      : selectedNecromancerTraits(configOrTraits);
  return traits.has(traitId) || traits.has(String(traitId));
}

export function syncNecromancerResources(state) {
  state.lifeForce = Math.max(
    0,
    Math.min(
      Number(state.maximumLifeForce || 100),
      Number(state.lifeForce || 0),
    ),
  );
  state.resource = state.lifeForce;
  state.blightExpiries = (state.blightExpiries || [])
    .sort((left, right) => left - right)
    .slice(-25);
  state.blight = state.blightExpiries.length;
  return state;
}

export function createNecromancerState(config = {}) {
  const traits = selectedNecromancerTraits(config);
  const maximumLifeForce = hasNecromancerTrait(
    traits,
    NECROMANCER_TRAIT_IDS.SOUL_BATTERY,
  )
    ? 120
    : 100;
  const configuredLifeForce = Number(config.initialResource ?? 100);
  const lifeForce =
    maximumLifeForce === 120 && configuredLifeForce === 100
      ? 120
      : configuredLifeForce;
  const initialBlight = Math.max(
    0,
    Math.min(25, Math.trunc(Number(config.initialBlight || 0))),
  );
  const blightExpiries = Array.from({ length: initialBlight }, () => 25);
  return syncNecromancerResources({
    lifeForce,
    resource: lifeForce,
    maximumLifeForce,
    activeShroud: "",
    shroudEnteredAt: 0,
    lastResourceAt: 0,
    nextBlightAt: Number.POSITIVE_INFINITY,
    blight: initialBlight,
    blightExpiries,
    shades: [],
    activeMinions: {},
    activeSpirits: {},
    availableFlips: {},
    autoattackChains: {},
    lichEndsAt: 0,
    soulTwistingAvailable: false,
    signetNextLifeForceAt: 3,
    vampirismNextAt: 3,
    cascadingCorruptionStacks: 0,
    meltdownUntil: 0,
    targetChilledUntil: 0,
    dreadUntil: 0,
    fearOfDeathReadyAt: 0,
    vampiricPresenceReadyAt: 0,
    barbedPrecisionProgress: 0,
    demonicLoreReadyAt: 0,
    traitProcReadyAt: {},
  });
}

// The Necromancer resolver starts from a fresh *full* state rather than a minimal
// one. Although the resolver reactions only mutate barbedPrecisionProgress,
// vampiricPresenceReadyAt, demonicLoreReadyAt and dreadUntil, the resolver also:
//   - reads shroud/blight/spirits/shades/meltdown off the profession state in
//     attribute-rules.js (e.g. Wicked Corruption scales with `blight`), which
//     must reflect config.initialBlight etc. before the first state event, and
//   - replays `necromancer.state` events that wipe and re-Object.assign the whole
//     state shape (mechanics/handlers.js), preserving only the resolver-owned
//     fields.
// Recreating the full state is the cheapest correct way to guarantee every field
// exists and starts clean; a minimal shape would zero `blight` (and friends)
// before the first state replay and change DPS on builds that seed them.
export function createNecromancerResolverState(config = {}) {
  return createNecromancerState(config);
}

export function snapshotNecromancerState(state) {
  return structuredClone(syncNecromancerResources(state));
}
