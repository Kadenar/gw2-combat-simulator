/**
 * A modifier and the simulation configuration produced by omitting it.
 *
 * @typedef {Object} ModifierComparison
 * @property {{id: string, label: string}} modifier Display metadata.
 * @property {*} config Simulation configuration without the modifier.
 */

/**
 * A modifier's calculated contribution to baseline DPS.
 *
 * @typedef {Object} ModifierContribution
 * @property {string} id Stable modifier identifier.
 * @property {string} name Display label.
 * @property {number} dpsIncrease Absolute DPS difference.
 * @property {number} pctIncrease DPS difference as a percentage of the
 * simulation without the modifier.
 */

/**
 * Calculates the DPS contribution of each modifier by comparing a baseline
 * simulation with simulations that omit one modifier at a time.
 *
 * Contributions that round to zero DPS are omitted. The remaining entries are
 * sorted from highest to lowest DPS increase.
 *
 * @param {Object} request Comparison inputs.
 * @param {*[]} request.rotation Rotation passed to every simulation.
 * @param {*} request.baseConfig Configuration for the baseline simulation.
 * @param {ModifierComparison[]} request.comparisons Configurations with
 * individual modifiers omitted.
 * @param {(rotation: *[], config: *) => {dps: number}} simulateBuild
 * Profession-specific simulation function.
 * @returns {ModifierContribution[]} Modifier contributions sorted by
 * descending DPS increase.
 * @throws {TypeError} When `simulateBuild` is not a function.
 */
export function calculateContributionComparisons(
  { rotation, baseConfig, comparisons },
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
      pctIncrease: without.dps > 0 ? (dpsIncrease / without.dps) * 100 : 0,
    });
  }
  return contributions.sort(
    (left, right) => right.dpsIncrease - left.dpsIncrease,
  );
}
