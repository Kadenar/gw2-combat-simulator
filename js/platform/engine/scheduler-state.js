export function createSchedulerState({
  profession,
  config = {},
  startingTime = 0,
  activeWeaponSet = 1,
} = {}) {
  if (!profession || typeof profession.createProfessionState !== "function") {
    throw new TypeError("Scheduler state requires a profession contract.");
  }
  return {
    time: Number(startingTime || 0),
    cooldowns: new Map(),
    ammo: new Map(),
    activeWeaponSet: Math.max(1, Number(activeWeaponSet || 1)),
    skillUses: new Map(),
    pendingEvents: [],
    profession: profession.createProfessionState(config),
  };
}
