export function createSchedulerState({
  profession,
  config = {},
  startingTime = 0,
} = {}) {
  if (!profession || typeof profession.createProfessionState !== "function") {
    throw new TypeError("Scheduler state requires a profession contract.");
  }
  return {
    time: Number(startingTime || 0),
    cooldowns: new Map(),
    ammo: new Map(),
    activeWeaponSet: 1,
    skillUses: new Map(),
    pendingEvents: [],
    profession: profession.createProfessionState(config),
  };
}
