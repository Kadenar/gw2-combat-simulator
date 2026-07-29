/**
 * Merges simulation defaults with user overrides while preserving nested object
 * boundaries that callers routinely patch (`stats`, `boons`, and `target`).
 * Target conditions are replaced as a unit when explicitly provided so stale
 * assumptions do not leak in from defaults.
 */
export function prepareSimulationConfig(
  defaults,
  userConfig = {},
  { duration = userConfig.duration } = {},
) {
  const hasTargetConditions =
    userConfig.target && Object.hasOwn(userConfig.target, "conditions");

  return {
    ...defaults,
    ...userConfig,
    ...(duration == null ? {} : { duration }),
    stats: { ...defaults.stats, ...(userConfig.stats || {}) },
    boons: { ...defaults.boons, ...(userConfig.boons || {}) },
    target: {
      ...defaults.target,
      ...(userConfig.target || {}),
      conditions: hasTargetConditions
        ? { ...(userConfig.target.conditions || {}) }
        : { ...defaults.target.conditions },
    },
  };
}
