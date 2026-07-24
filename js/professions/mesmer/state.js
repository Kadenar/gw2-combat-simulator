export function createMesmerState(config = {}) {
  return {
    clones: [],
    numericResource: 0,
    pendingResources: [],
    pendingExpectedProcs: [],
    trackedSkillHits: new Map(),
    traitReadyAt: new Map(),
    instruments: new Map(),
    lastInstrument: "",
    continuum: null,
    counterspellAvailable: false,
    availableFlips: new Map(),
    autoattackChains: new Map(),
    nextForgeAt: config.infiniteForge ? 3 : Infinity,
    bloodsongProgress: 0,
    sharperImagesProgress: 0,
    ineptitudeReadyAt: 0,
    clarityUntil: 0,
    ambushUntil: 0,
    ambushSource: "",
    cloneAmbushUntil: 0,
    riddleOfSandReady: false,
    timeBombUntil: 0,
  };
}

export function snapshotMesmerState(state) {
  return {
    cloneCount: state.clones.length,
    numericResource: state.numericResource,
    instruments: [...state.instruments.entries()],
    continuumActive: Boolean(state.continuum),
    counterspellAvailable: state.counterspellAvailable,
    availableFlips: [...state.availableFlips.entries()],
    autoattackChains: [...state.autoattackChains.entries()],
    nextForgeAt: state.nextForgeAt,
    bloodsongProgress: state.bloodsongProgress,
    sharperImagesProgress: state.sharperImagesProgress,
    ineptitudeReadyAt: state.ineptitudeReadyAt,
    clarityUntil: state.clarityUntil,
    ambushUntil: state.ambushUntil,
    riddleOfSandReady: state.riddleOfSandReady,
    timeBombUntil: state.timeBombUntil,
  };
}
