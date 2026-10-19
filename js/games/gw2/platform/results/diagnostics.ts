import type { SimulationStep } from '#gw2/platform/results/types.js';

/**
 * One simulation notice. Location travels as data beside the wording, so presentation can link a notice to its source
 * without parsing message text, and rewording a notice never changes where it points.
 */
export interface Gw2SimulationDiagnostic {
  /** User-facing text without the occurrence time; consumers place `at` on their own clock. */
  readonly message: string;
  /** Absolute simulation time in seconds, when the notice occurred at a specific instant. */
  readonly at?: number;
  /** Authored rotation index of the affected command, when the owner knows it directly. */
  readonly rotationIndex?: number;
  /** Activation behind a delayed notice; detailed results resolve it to `rotationIndex` through reported steps. */
  readonly activationId?: string;
}

/**
 * Equal wording at the same displayed millisecond is one notice; the first keeps its location for navigation.
 * Retained records are copied so score consumers cannot edit the resolver's live diagnostics.
 */
export function uniqueDiagnostics(diagnostics: readonly Gw2SimulationDiagnostic[]): Gw2SimulationDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.flatMap((diagnostic) => {
    const key = `${diagnostic.at == null ? '' : diagnostic.at.toFixed(3)}|${diagnostic.message}`;

    if (seen.has(key)) return [];

    seen.add(key);
    return [{ ...diagnostic }];
  });
}

/** Resolves activation-owned notices to their authored step; activations without exactly one step stay unlinked. */
export function locateDiagnostics(
  diagnostics: readonly Gw2SimulationDiagnostic[],
  steps: readonly SimulationStep[]
): Gw2SimulationDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    if (diagnostic.rotationIndex != null || diagnostic.activationId == null) return { ...diagnostic };

    const indices = new Set(
      steps.filter((step) => step.ri >= 0 && step.activationId === diagnostic.activationId).map((step) => step.ri)
    );
    return indices.size === 1 ? { ...diagnostic, rotationIndex: [...indices][0] } : { ...diagnostic };
  });
}

/** Plain-text form for consumers without a timeline clock, such as scores, comparisons, and scripts. */
export function formatSimulationDiagnostic(diagnostic: Gw2SimulationDiagnostic): string {
  return diagnostic.at == null ? diagnostic.message : `[${diagnostic.at.toFixed(3)}s] ${diagnostic.message}`;
}
