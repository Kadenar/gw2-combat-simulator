import type {
  ModifierContribution,
  ModifierContributionBatchRequest,
  ModifierContributionBatchResult,
  ModifierContributionRequest,
  ProfessionModifierComparison
} from '#gw2/app/simulation/modifier-contributions/types.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

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

/** Every omission is compared with the caller's completed deterministic baseline, regardless of batch order. */
export function mergeModifierContributions(
  baselineDps: number,
  groups: readonly ModifierContributionBatchResult[]
): ModifierContribution[] {
  if (!Number.isFinite(baselineDps)) throw new Error('Modifier contributions require a finite baseline DPS.');

  if (!groups.length) return [];

  const contributions: ModifierContribution[] = [];
  for (const { scores } of groups) {
    for (const { id, name, dps } of scores) {
      const dpsIncrease = baselineDps - dps;

      // Whole-DPS reports should not retain numerical noise that renders as 0 or -0.
      if (Math.round(dpsIncrease) === 0) continue;

      contributions.push({ id, name, dpsIncrease, pctIncrease: dps > 0 ? (dpsIncrease / dps) * 100 : 0 });
    }
  }

  // Modifier identity breaks ties consistently across worker counts and main-thread execution.
  return contributions.sort((left, right) => right.dpsIncrease - left.dpsIncrease || left.id.localeCompare(right.id));
}

type SimulateForContribution = (rotation: readonly RotationCommand[], config: Gw2Config) => { readonly dps: number };

/**
 * Calculates each modifier's contribution without rerunning the caller's baseline.
 */
export function calculateContributionComparisons(
  request: Omit<ModifierContributionRequest, 'gameId' | 'contentId'>,
  simulateBuild: SimulateForContribution
): ModifierContribution[] {
  return mergeModifierContributions(request.baselineDps, [calculateContributionBatch(request, simulateBuild)]);
}

/** Each worker simulates only its assigned omissions; baseline scoring belongs to the caller. */
export function calculateContributionBatch(
  { rotation, comparisons }: Omit<ModifierContributionBatchRequest, 'gameId' | 'contentId'>,
  simulateBuild: SimulateForContribution
): ModifierContributionBatchResult {
  const scores = comparisons.map(({ modifier, config }) => {
    // Unequipped casts disappear with their active effects, resource rewards, and time cost.
    const comparisonRotation =
      modifier.type === 'Skill'
        ? rotation.filter((command) => command.type !== 'cast' || command.skillId !== modifier.skillId)
        : rotation;
    return { id: modifier.id, name: modifier.label, dps: simulateBuild(comparisonRotation, config).dps };
  });
  return { scores };
}
