export function calculateContributionComparisons(
  {
    rotation,
    baseConfig,
    comparisons,
  },
  simulateSequence,
) {
  if (typeof simulateSequence !== "function") {
    throw new TypeError("A simulation function is required.");
  }

  const baseline = simulateSequence(rotation, baseConfig);
  const contributions = [];
  for (const { modifier, config } of comparisons) {
    const without = simulateSequence(rotation, config);
    const dpsIncrease = baseline.dps - without.dps;
    if (Math.abs(dpsIncrease) < 0.005) continue;
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
