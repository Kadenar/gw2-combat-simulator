import type {
  ModifierContribution,
  ModifierContributionRequest,
  ProfessionModifierComparison
} from '../../../../app/profession/types.js';
import type { Gw2Config } from '../../platform/simulation/config.js';
import type { RotationCommand } from '../../platform/engine/types.js';

export const MAX_MODIFIER_CONTRIBUTION_WORKERS = 3;

export function modifierContributionWorkerCount(comparisonCount: unknown, hardwareConcurrency = 0): number {
  const comparisons = Math.max(0, Math.trunc(Number(comparisonCount) || 0));
  if (!comparisons) return 0;
  const hardware = Math.trunc(Number(hardwareConcurrency) || 0);
  const availableWorkers = hardware > 0 ? Math.max(1, hardware - 1) : MAX_MODIFIER_CONTRIBUTION_WORKERS;
  return Math.min(comparisons, MAX_MODIFIER_CONTRIBUTION_WORKERS, availableWorkers);
}

export function partitionModifierComparisons(
  comparisons: readonly ProfessionModifierComparison[],
  workerCount: unknown
): ProfessionModifierComparison[][] {
  const values: readonly ProfessionModifierComparison[] = Array.isArray(comparisons) ? comparisons : [];
  const count = Math.min(values.length, Math.max(0, Math.trunc(Number(workerCount) || 0)));
  if (!count) return [];
  const batches: ProfessionModifierComparison[][] = Array.from({ length: count }, () => []);
  values.forEach((comparison, index) => {
    batches[index % count].push(comparison);
  });
  return batches;
}

export function mergeModifierContributions(
  groups: readonly (readonly ModifierContribution[])[]
): ModifierContribution[] {
  const values: readonly (readonly ModifierContribution[])[] = Array.isArray(groups) ? groups : [];
  return values.flat().sort((left, right) => right.dpsIncrease - left.dpsIncrease);
}

type SimulateForContribution = (rotation: readonly RotationCommand[], config: Gw2Config) => { readonly dps: number };

/**
 * Calculates the DPS contribution of each modifier by comparing a baseline
 * simulation with simulations that omit one modifier at a time.
 */
export function calculateContributionComparisons(
  { rotation, baseConfig, comparisons }: Omit<ModifierContributionRequest, 'gameId' | 'contentId'>,
  simulateBuild: SimulateForContribution
): ModifierContribution[] {
  if (typeof simulateBuild !== 'function') {
    throw new TypeError('A simulation function is required.');
  }

  const baseline = simulateBuild(rotation, baseConfig);
  const contributions: ModifierContribution[] = [];
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
      pctIncrease: without.dps > 0 ? (dpsIncrease / without.dps) * 100 : 0
    });
  }

  return contributions.sort((left, right) => right.dpsIncrease - left.dpsIncrease);
}
