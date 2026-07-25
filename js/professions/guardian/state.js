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
    radiantWeapon: "",
    // Spear "Illuminated" mechanic.
    spearIlluminatedArmed: false,
    spearLuminanceUntil: 0,
  };
}

export function snapshotGuardianState(state) {
  return structuredClone(state);
}
