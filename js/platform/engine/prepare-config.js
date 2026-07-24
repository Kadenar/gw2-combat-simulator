/**
 * Creates an isolated run configuration from defaults and user overrides.
 */
export function prepareSimulationConfig(
  defaults,
  userConfig = {},
  { duration = userConfig.duration } = {},
) {
  const hasTargetConditions =
    userConfig.target
    && Object.hasOwn(userConfig.target, "conditions");

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
