import { GUARDIAN_TRAIT_IDS } from "../../data/ids.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type {
  GuardianConfig,
  GuardianFirebrandState,
} from "../../types.js";

export function createFirebrandState(
  config: GuardianConfig = {},
): GuardianFirebrandState {
  const selectedTraits = new Set((config.selectedTraitIds || []).map(Number));
  const traitMaximum = selectedTraits.has(
    GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS,
  )
    ? 8
    : 5;
  const maximumTomePages = Math.max(
    traitMaximum,
    Number(config.maximumTomePages || traitMaximum),
  );
  const tomePageInterval = selectedTraits.has(GUARDIAN_TRAIT_IDS.LOREMASTER)
    ? 5
    : 8;
  const configuredInitialPages = Number(config.initialTomePages ?? traitMaximum);
  const initialPages =
    selectedTraits.has(GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS) &&
    configuredInitialPages === 5
      ? traitMaximum
      : configuredInitialPages;
  const tomePages = Math.max(0, Math.min(maximumTomePages, initialPages));
  return {
    activeTome: "",
    tomePages,
    maximumTomePages,
    tomePageInterval,
    nextTomePageAt:
      tomePages < maximumTomePages
        ? tomePageInterval
        : Number.POSITIVE_INFINITY,
    ashesCharges: 0,
    ashesNextTriggerAt: 0,
    ashesExpiresAt: 0,
    nextCourageAegisAt: 0,
    swiftScholarTome: "",
    swiftScholarCount: 0,
    liberatorsVowReadyAt: 0,
    stalwartSpeedReadyAt: 0,
    quickfireReadyAt: 0,
  };
}

export const firebrandState = defineProfessionSpecializationState(
  "Firebrand",
  createFirebrandState,
);
