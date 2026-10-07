import { templateBoon, templateCategory } from '#gw2/app/build/library/model.js';
import type { BuildTemplatePreset } from '#gw2/app/build/types.js';

export interface Benchmark extends BuildTemplatePreset {
  readonly profession: string;
  readonly professionName: string;
  readonly specialization: string;
  readonly benchmarkDps: number;
}

export interface BenchmarkFilters {
  readonly professions: ReadonlySet<string>;
  readonly query: string;
  readonly damage: string;
  readonly role: string;
  readonly includeOutdated: boolean;
}

/** Shade each profession's accent from the full catalog so filtering and sorting never recolor a build. */
export function benchmarkColors(
  rows: readonly Benchmark[],
  professionColors: ReadonlyMap<string, string>
): ReadonlyMap<Benchmark, string> {
  const colors = new Map<Benchmark, string>();
  const professionIndices = new Map<string, number>();
  const ordered = [...rows].sort((a, b) =>
    JSON.stringify([a.profession, a.specialization, a.build, a.rotation, a.label]).localeCompare(
      JSON.stringify([b.profession, b.specialization, b.build, b.rotation, b.label])
    )
  );
  ordered.forEach((row) => {
    const index = professionIndices.get(row.profession) ?? 0;
    professionIndices.set(row.profession, index + 1);
    // Small alternating tints and shades distinguish builds while retaining the profession's hue.
    const accentPercent = index === 0 ? 100 : 92 - ((Math.floor(index / 2) * 0.618034) % 1) * 14;
    colors.set(
      row,
      `color-mix(in srgb, ${professionColors.get(row.profession)} ${accentPercent.toFixed(3)}%, ${index % 2 ? 'black' : 'white'})`
    );
  });
  return colors;
}

/** Read canonical manifest sections; missing DPS is omitted rather than represented as zero damage. */
export function readBenchmarks(profession: { id: string; name: string }, manifest: unknown): Benchmark[] {
  if (!Array.isArray(manifest)) throw new Error('Invalid benchmark manifest');
  return manifest.flatMap((section) => {
    if (!section || typeof section.section !== 'string' || !Array.isArray(section.presets)) {
      throw new Error('Invalid benchmark section');
    }

    return section.presets.flatMap((preset: BuildTemplatePreset) => {
      if (!preset || typeof preset.label !== 'string' || typeof preset.build !== 'string') {
        throw new Error('Invalid benchmark preset');
      }

      if (
        typeof preset.benchmarkDps !== 'number' ||
        !Number.isFinite(preset.benchmarkDps) ||
        preset.benchmarkDps <= 0
      ) {
        return [];
      }

      return [
        {
          ...preset,
          benchmarkDps: preset.benchmarkDps,
          profession: profession.id,
          professionName: profession.name,
          specialization: section.section
        }
      ];
    });
  });
}

/** Both chart levels use the same filtered population and a zero-based scale for honest comparisons. */
export function filterBenchmarks(rows: readonly Benchmark[], filters: BenchmarkFilters): Benchmark[] {
  const query = filters.query.trim().toLowerCase();
  return rows
    .filter(
      (row) =>
        filters.professions.has(row.profession) &&
        (filters.includeOutdated || row.upToDate !== false) &&
        (filters.damage === 'all' || templateCategory(row) === filters.damage) &&
        (filters.role === 'all' || templateBoon(row) === filters.role) &&
        `${row.professionName} ${row.specialization} ${row.label}`.toLowerCase().includes(query)
    )
    .sort((a, b) => b.benchmarkDps - a.benchmarkDps || a.label.localeCompare(b.label));
}

export function benchmarkScale(rows: readonly Benchmark[]): number {
  return Math.max(10000, Math.ceil(Math.max(0, ...rows.map((row) => row.benchmarkDps)) / 10000) * 10000);
}

/** Fit comparison axes to visible measurements, with padding appropriate to the metric and readable ticks. */
export function benchmarkComparisonAxis(
  values: readonly number[],
  minimumPadding: number
): { min: number; max: number; ticks: number[] } {
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;
  const padding = Math.max((maximum - minimum) * 0.05, maximum * 0.01, minimumPadding);
  const lower = Math.max(0, minimum - padding);
  const upper = maximum + padding;
  const desiredStep = (upper - lower) / 6;
  const magnitude = 10 ** Math.floor(Math.log10(desiredStep));
  const fraction = desiredStep / magnitude;
  const step = (fraction < 1.5 ? 1 : fraction < 3.5 ? 2 : fraction < 7.5 ? 5 : 10) * magnitude;
  const min = Math.floor(lower / step) * step;
  const max = Math.ceil(upper / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => max - index * step);
  return { min, max, ticks };
}

/** Missing APM is distinct from a valid zero-input benchmark and never gets plotted as zero. */
export function hasBenchmarkApm(row: Benchmark): row is Benchmark & { benchmarkApm: number } {
  return typeof row.benchmarkApm === 'number' && Number.isFinite(row.benchmarkApm) && row.benchmarkApm >= 0;
}

export function benchmarkApmScale(rows: readonly Benchmark[]): number {
  return Math.max(20, Math.ceil(Math.max(0, ...rows.filter(hasBenchmarkApm).map((row) => row.benchmarkApm)) / 20) * 20);
}
