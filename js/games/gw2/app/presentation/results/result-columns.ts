import type { ResultColumn } from '#gw2/app/presentation/results/rotation-results.js';

/** Defines the shared damage-table columns without loading the React result renderer in simulation workers. */
export const SKILL_COLS: readonly ResultColumn[] = [
  { key: 'name', label: 'Skill', numeric: false },
  { key: 'strike', label: 'Strike', numeric: true },
  { key: 'condition', label: 'Condition', numeric: true, className: 'condi' },
  { key: 'total', label: 'Total', numeric: true, className: 'total' },
  { key: 'dps', label: 'DPS', numeric: true, className: 'dps' },
  { key: 'average', label: 'Avg/Cast', numeric: true },
  { key: 'dct', label: 'DCT', numeric: true },
  { key: 'casts', label: 'Casts', numeric: true },
  { key: 'hits', label: 'Hits', numeric: true },
  {
    key: 'critChance',
    label: 'Exp. Crit %',
    numeric: true,
    format: (value) => (value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`),
    title: (_value, row) => {
      const eligible = Number(row.critEligibleHits || 0);
      if (eligible <= 0) return '';
      const critHits = Number(row.critHits || 0);
      const fractional = Math.abs(critHits - Math.round(critHits)) > 1e-6;
      const critLabel = fractional ? `~${critHits.toFixed(1)}` : String(Math.round(critHits));
      return `${critLabel} of ${eligible} strike hits critical`;
    }
  }
];
