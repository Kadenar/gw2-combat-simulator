import type { ComparisonWindowMode } from '#gw2/app/rotation/comparison-state.js';
import type { Gw2SimulationDiagnostic } from '#gw2/platform/results/diagnostics.js';

export type FindingCategory = 'skill-output' | 'cancellation' | 'idle' | 'buff' | 'proc' | 'entry-delay';

export interface ComparisonMetric {
  readonly id: string;
  readonly unit: 'damage' | 'seconds' | 'count' | 'ratio' | 'stacks';
  readonly current: number;
  readonly reference: number;
  readonly delta: number;
}

/** Only aggregate differences used by the insights view are retained. */
export interface RotationFinding {
  readonly id: string;
  readonly category: FindingCategory;
  readonly label: string;
  readonly metrics: readonly ComparisonMetric[];
  readonly effect?: {
    readonly kind: string;
    readonly name?: string;
    readonly origin: string;
    readonly recipient: string;
  };
  readonly damageDifference?: number;
  readonly material: boolean;
}

export interface RotationInsights {
  readonly window: {
    readonly mode: ComparisonWindowMode;
    readonly currentDuration: number;
    readonly referenceDuration: number;
  };
  readonly runs: Readonly<
    Record<
      'current' | 'reference',
      {
        readonly windowDamage: number;
        readonly warnings: readonly Gw2SimulationDiagnostic[];
      }
    >
  >;
  readonly status: 'ready' | 'incompatible' | 'unavailable';
  readonly findings: readonly RotationFinding[];
}
