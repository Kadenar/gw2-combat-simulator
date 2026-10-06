import type { ChartSeries } from '#gw2/app/results/charts/time-series-model.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import type { SkillBreakdownRow } from '#gw2/app/results/skill-breakdown.js';

export interface ResultRow {
  readonly name: string;
  readonly total?: unknown;
  readonly group?: string;
  readonly procDamage?: SkillBreakdownRow['procDamage'];
  readonly [field: string]: unknown;
}

export interface ResultColumn {
  readonly key: string;
  readonly label?: string;
  readonly numeric?: boolean;
  readonly className?: string;
  readonly format?: (value: unknown) => unknown;
  // Optional hover tooltip for the cell. Returns plain text (escaped by the
  // renderer); an empty string omits the title attribute.
  readonly title?: (value: unknown, row: ResultRow) => string;
}

export type ResultSortDirection = 'asc' | 'desc' | null;

export interface ResultSortState {
  readonly column: string | null;
  readonly direction: ResultSortDirection;
}

export interface ResultCondition {
  readonly name: string;
  readonly damage: number;
  readonly dps: number;
  readonly averageStacks: number;
}

export interface ResultConditionTotal {
  readonly label?: string;
  readonly damage: number;
  readonly dps: number;
}

/** Carries only damage rows and the observation data needed by their inspectors. */
export interface DamageBreakdownModel {
  readonly skillRows: readonly ResultRow[];
  readonly skillColumns: readonly ResultColumn[];
  readonly conditions: readonly ResultCondition[];
  readonly conditionTotal?: ResultConditionTotal | null;
  readonly chartSeries?: ChartSeries | null;
  /** Activation times already use the same DPS clock as the chart series. */
  readonly procSteps?: readonly Pick<Gw2ProcStep, 'start' | 'skill' | 'sourceSkill'>[];
}

// Default column schema shared by the renderer and profession adapters.
export const SKILL_COLS: readonly ResultColumn[] = [
  { key: 'name', label: 'Skill', numeric: false },
  { key: 'strike', label: 'Strike', numeric: true },
  { key: 'condition', label: 'Condition', numeric: true, className: 'condi' },
  { key: 'total', label: 'Total', numeric: true, className: 'total' },
  // Share includes strike and condition damage as a percentage of damage across all skill rows.
  { key: 'damagePercent', label: 'Share', numeric: true, format: (value) => `${Number(value).toFixed(2)}%` },
  { key: 'dps', label: 'DPS', numeric: true, className: 'dps' },
  { key: 'average', label: 'Avg/Cast', numeric: true },
  { key: 'dct', label: 'DCT', numeric: true },
  { key: 'casts', label: 'Casts', numeric: true },
  {
    key: 'hits',
    label: 'Hits',
    numeric: true,
    title: (_value, row) =>
      Number(row.procCount) > 0 && !Number(row.strike)
        ? 'Proc activations, excluding condition ticks and stack counts.'
        : 'Strike hits.'
  },
  {
    key: 'critChance',
    label: 'Crit %',
    numeric: true,
    format: (value) => (value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`),
    title: (_value, row) => {
      const eligible = Number(row.critEligibleHits || 0);
      if (eligible <= 0) return '';
      const critHits = Number(row.critHits || 0);
      // Both modes count the seeded critical outcomes used by proc reactions.
      return `${critHits} of ${eligible} strike hits critical`;
    }
  }
];

export function nextResultSortState(
  currentColumn: string | null,
  currentDirection: ResultSortDirection,
  column: string
): ResultSortState {
  // Repeated clicks cycle descending -> ascending -> default total ordering.
  if (currentColumn !== column) {
    return { column, direction: 'desc' };
  }

  const direction: ResultSortDirection =
    currentDirection === 'desc' ? 'asc' : currentDirection === 'asc' ? null : 'desc';
  return {
    column: direction ? column : null,
    direction
  };
}

export function sortResultRows(
  rows: readonly ResultRow[],
  columns: readonly ResultColumn[],
  column: string | null,
  direction: ResultSortDirection
): ResultRow[] {
  // Never mutate the model supplied by the simulation/result transformer.
  const sorted = [...rows];
  if (!column || !direction) {
    // "Unsorted" means the useful default of highest total damage first.
    return sorted.sort((left, right) => Number(right.total || 0) - Number(left.total || 0));
  }

  const definition = columns.find((candidate) => candidate.key === column);
  if (definition?.numeric) {
    return sorted.sort((left, right) => {
      const leftValue = left[column] ?? -Infinity;
      const rightValue = right[column] ?? -Infinity;
      return direction === 'asc' ? Number(leftValue) - Number(rightValue) : Number(rightValue) - Number(leftValue);
    });
  }

  return sorted.sort((left, right) =>
    direction === 'asc'
      ? String(left[column] ?? '').localeCompare(String(right[column] ?? ''))
      : String(right[column] ?? '').localeCompare(String(left[column] ?? ''))
  );
}

/** Uses all damage sources as one denominator without double-counting the condition breakdown. */
export function prepareDamageBreakdown(model: DamageBreakdownModel) {
  const totalDamage = model.skillRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const share = (damage: number): number => (totalDamage > 0 ? (damage / totalDamage) * 100 : 0);
  const skillRows = model.skillRows.map((row) => ({ ...row, damagePercent: share(Number(row.total || 0)) }));
  const conditions = model.conditions.map((condition) => ({
    ...condition,
    damagePercent: share(condition.damage),
    averageDamagePerStack: condition.averageStacks > 0 ? condition.dps / condition.averageStacks : 0
  }));
  const conditionGroups = [
    {
      label: 'Damaging Conditions',
      damaging: true,
      conditions: conditions.filter((condition) => condition.damage > 0)
    },
    { label: 'Other Conditions', damaging: false, conditions: conditions.filter((condition) => condition.damage <= 0) }
  ].filter((group) => group.conditions.length);
  return { skillRows, conditionGroups, conditionTotalShare: share(model.conditionTotal?.damage || 0) };
}
