import type {
  MesmerConfig,
  MesmerCoreState,
  MesmerResolverState,
  MesmerResourceDefinition,
  MesmerStateSnapshot,
} from "../types.js";

export function mesmerResourceDefinition(
  specialization: string,
): MesmerResourceDefinition {
  if (specialization === "Virtuoso") {
    return { singular: "blade", plural: "blades", maximum: 5 };
  }
  if (specialization === "Troubadour") {
    return { singular: "note", plural: "notes", maximum: 3 };
  }
  return { singular: "clone", plural: "clones", maximum: 3 };
}

export function createMesmerCoreState(
  _config: Partial<MesmerConfig> = {},
): MesmerCoreState {
  return {
    clones: [],
    pendingResources: [],
    trackedSkillHits: {},
    traitReadyAt: {},
    counterspellAvailable: false,
    availableFlips: {},
    autoattackChains: {},
    sharperImagesProgress: 0,
    ineptitudeReadyAt: 0,
    clarityUntil: 0,
    hasExplicitCombatStart: false,
    combatStartTime: 0,
  };
}

export function createMesmerCoreResolverState(): MesmerResolverState {
  return {
    ineptitudeReadyAt: 0,
  };
}

export function snapshotMesmerState(
  state: Partial<MesmerCoreState> & Record<string, unknown>,
): MesmerStateSnapshot {
  const clones = Array.isArray(state.clones) ? state.clones : [];
  const instruments =
    state.instruments && typeof state.instruments === "object"
      ? state.instruments as Record<string, number>
      : {};
  const availableFlips =
    state.availableFlips && typeof state.availableFlips === "object"
      ? state.availableFlips as MesmerCoreState["availableFlips"]
      : {};
  const autoattackChains =
    state.autoattackChains && typeof state.autoattackChains === "object"
      ? state.autoattackChains as MesmerCoreState["autoattackChains"]
      : {};
  return {
    cloneCount: clones.length,
    numericResource: Number(state.numericResource || 0),
    instruments: Object.entries(instruments),
    continuumActive: Boolean(state.continuum),
    counterspellAvailable: Boolean(state.counterspellAvailable),
    availableFlips: Object.entries(availableFlips),
    autoattackChains: Object.entries(autoattackChains),
    nextForgeAt: Number(state.nextForgeAt ?? Infinity),
    bloodsongProgress: Number(state.bloodsongProgress || 0),
    sharperImagesProgress: Number(state.sharperImagesProgress || 0),
    ineptitudeReadyAt: Number(state.ineptitudeReadyAt || 0),
    clarityUntil: Number(state.clarityUntil || 0),
    ambushUntil: Number(state.ambushUntil || 0),
    riddleOfSandReady: Boolean(state.riddleOfSandReady),
    timeBombUntil: Number(state.timeBombUntil || 0),
  };
}
