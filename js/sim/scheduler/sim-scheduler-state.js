// Initialize scheduler state machine
// Tracks cooldowns, ammo, clones, pending resources, active weapon set, instruments
// Also tracks special mechanics like Continuum Split, counterspell availability, blade/note generation

export function createSchedulerState({
  infiniteForge = false,
  startingTime = 0,
} = {}) {
  return {
    time: startingTime,
    cooldowns: new Map(),
    ammo: new Map(),
    numericResource: 0,
    clones: [],
    pendingResources: [],
    pendingCombatIntents: [],
    activeWeaponSet: 1,
    skillUses: new Map(),
    instruments: new Map(),
    lastInstrument: "",
    continuum: null,
    counterspellAvailable: false,
    availableFlips: new Map(),
    autoattackChains: new Map(),
    nextForgeAt: infiniteForge ? 3 : Infinity,
    bloodsongProgress: 0,
    sharperImagesProgress: 0,
    hasExplicitCombatStart: false,
    combatStartTime: 0,
    clarityUntil: 0,
    ambushUntil: 0,
    ambushSource: "",
    cloneAmbushUntil: 0,
    riddleOfSandReady: false,
  };
}
