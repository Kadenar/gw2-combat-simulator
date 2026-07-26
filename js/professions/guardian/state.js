import { GUARDIAN_TRAIT_IDS } from "./data/ids.js";

export function createGuardianState(config = {}) {
  const selectedTraits = new Set(
    (config.selectedTraitIds || []).map(Number),
  );
  const traitMaximum = selectedTraits.has(
    GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS,
  ) ? 8 : 5;
  const maximumTomePages = Math.max(
    traitMaximum,
    Number(config.maximumTomePages || traitMaximum),
  );
  const tomePageInterval = selectedTraits.has(
    GUARDIAN_TRAIT_IDS.LOREMASTER,
  ) ? 6 : 8;
  const configuredInitialPages = Number(
    config.initialTomePages ?? traitMaximum,
  );
  const initialPages = (
    selectedTraits.has(GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS)
    && configuredInitialPages === 5
  ) ? traitMaximum : configuredInitialPages;
  const tomePages = Math.max(
    0,
    Math.min(
      maximumTomePages,
      initialPages,
    ),
  );
  return {
    justiceArmed: false,
    justiceActiveArmed: false,
    justiceHitCount: 0,
    justiceBurns: 0,
    justiceActiveBurns: 0,
    justicePassiveBurns: 0,
    virtueReadyAt: {
      justice: 0,
      resolve: 0,
      courage: 0,
    },
    autoattackChains: {},
    availableFlips: {},
    activeTome: "",
    tomePages,
    maximumTomePages,
    tomePageInterval,
    nextTomePageAt:
      tomePages < maximumTomePages ? tomePageInterval : Number.POSITIVE_INFINITY,
    ashesCharges: 0,
    ashesNextTriggerAt: 0,
    radiantForge: false,
    radiantForgeEndsAt: 0,
    radiantForgeEnteredAt: 0,
    radiantWeapon: "",
    radiantWeaponsUsed: {},
    empoweredArmamentsUntil: 0,
    piercingStanceUntil: 0,
    lightAuraUntil: 0,
    lightFields: [],
    furiousFocusReadyAt: 0,
    radiantJusticeArmed: false,
    radiantCourageSwordArmed: false,
    radiantCourageShieldArmed: false,
    symbolicAvengerStacks: 0,
    symbolicAvengerUntil: 0,
    zealotsResolutionReadyAt: 0,
    resolutionUntil: 0,
    righteousNextMightAt: 0,
    effulgentActiveUntil: 0,
    effulgentStacks: 0,
    // Spear "Illuminated" mechanic.
    spearIlluminatedArmed: false,
    spearLuminanceUntil: 0,
  };
}

export function snapshotGuardianState(state) {
  return structuredClone(state);
}

// The Guardian resolver *continues* from the scheduler's ending state rather than
// starting clean: its virtue/tome/radiant-forge handlers replay transitions
// computed during pass 1 (guardian.virtue-activated, guardian.tome-page-used,
// guardian.radiant-forge-*) and its damage reactions read fields such as
// tomePages, ashesCharges/ashesNextTriggerAt and justiceHitCount. Defining this
// explicitly keeps the handoff dependency visible at the defineProfession call
// instead of relying on the implicit resolverHandoff fallback in
// simulateDeclarativeGw2.
//
// The inherited *ending* counters are safe to reuse (no reset needed): the
// resolver reactions reactToJusticeHit/reactToAshesHit are the only mutators of
// justiceHitCount, so the scheduler leaves it at 0; and ashesCharges /
// ashesNextTriggerAt are set at cast time and time-gate the resolver reactions,
// so carrying their post-cast values forward is exactly what resolution expects.
export function createGuardianResolverState(_config, scheduled) {
  const state = structuredClone(
    scheduled.stream.resolverHandoff.professionState,
  );
  state.justiceHitCount = 0;
  state.symbolicAvengerStacks = 0;
  state.symbolicAvengerUntil = 0;
  state.zealotsResolutionReadyAt = 0;
  state.resolutionUntil = 0;
  state.righteousNextMightAt = 0;
  state.piercingStanceUntil = 0;
  state.effulgentActiveUntil = 0;
  state.effulgentStacks = 0;
  return state;
}
