export function calculateContributionComparisons(
  {
    rotation,
    baseConfig,
    comparisons,
  },
  simulateBuild,
) {
  if (typeof simulateBuild !== "function") {
    throw new TypeError("A simulation function is required.");
  }

  const baseline = simulateBuild(rotation, baseConfig);
  const contributions = [];
  for (const { modifier, config } of comparisons) {
    const without = simulateBuild(rotation, config);
    const dpsIncrease = baseline.dps - without.dps;
    // Contributions are displayed as whole DPS. Do not retain numerical noise
    // that can only render as 0 or -0 in the report.
    if (Math.round(dpsIncrease) === 0) continue;
    contributions.push({
      id: modifier.id,
      name: modifier.label,
      dpsIncrease,
      pctIncrease: without.dps > 0
        ? (dpsIncrease / without.dps) * 100
        : 0,
    });
  }
  return contributions.sort((left, right) =>
    right.dpsIncrease - left.dpsIncrease);
}
