import type {
  ModifierContribution,
  ModifierContributionBatchRequest,
  ModifierContributionBatchResult,
  ModifierContributionRequest,
  ProfessionModifierComparison
} from '#gw2/app/simulation/modifier-contributions/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';

const MAX_MODIFIER_CONTRIBUTION_WORKERS = 3;

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

/** All worker scores use the one deterministic baseline, regardless of completion order. */
export function mergeModifierContributions(groups: readonly ModifierContributionBatchResult[]): ModifierContribution[] {
  if (!groups.length) return [];

  const baselineDps = groups.find((group) => group.baselineDps !== null)?.baselineDps;

  if (baselineDps == null) throw new Error('Modifier comparisons are missing their baseline.');

  const contributions: ModifierContribution[] = [];
  for (const { scores } of groups) {
    for (const { id, name, dps } of scores) {
      const dpsIncrease = baselineDps - dps;

      // Whole-DPS reports should not retain numerical noise that renders as 0 or -0.
      if (Math.round(dpsIncrease) === 0) continue;

      contributions.push({ id, name, dpsIncrease, pctIncrease: dps > 0 ? (dpsIncrease / dps) * 100 : 0 });
    }
  }

  return contributions.sort((left, right) => right.dpsIncrease - left.dpsIncrease);
}

type SimulateForContribution = (rotation: readonly RotationCommand[], config: Gw2Config) => { readonly dps: number };

/**
 * Calculates the DPS contribution of each modifier by comparing a baseline
 * simulation with simulations that omit one modifier at a time.
 */
export function calculateContributionComparisons(
  request: Omit<ModifierContributionRequest, 'gameId' | 'contentId'>,
  simulateBuild: SimulateForContribution
): ModifierContribution[] {
  return mergeModifierContributions([calculateContributionBatch(request, simulateBuild)]);
}

/** Each worker simulates its omissions; the designated baseline batch also scores the unmodified build once. */
export function calculateContributionBatch(
  { rotation, baseConfig, comparisons }: Omit<ModifierContributionBatchRequest, 'gameId' | 'contentId'>,
  simulateBuild: SimulateForContribution
): ModifierContributionBatchResult {
  const baselineDps = baseConfig === null ? null : simulateBuild(rotation, baseConfig).dps;
  const scores = comparisons.map(({ modifier, config }) => {
    // Unequipped casts disappear with their active effects, resource rewards, and time cost.
    const comparisonRotation =
      modifier.type === 'Skill'
        ? rotation.filter((command) => command.type !== 'cast' || command.skillId !== modifier.skillId)
        : rotation;
    return { id: modifier.id, name: modifier.label, dps: simulateBuild(comparisonRotation, config).dps };
  });
  return { baselineDps, scores };
}
