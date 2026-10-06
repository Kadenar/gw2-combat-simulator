/** Display-only assets keep benchmark inspection independent of profession runtime modules. */
export interface PreviewIcon {
  readonly name: string;
  readonly icon?: string;
}

export interface BenchmarkPreviewData {
  readonly build: string;
  readonly equipment: readonly { label: string; value: string }[];
  readonly specializations: readonly (PreviewIcon & {
    readonly majorTraits: readonly (readonly (PreviewIcon & { selected: boolean })[])[];
  })[];
  readonly skills: readonly PreviewIcon[];
}

/** Mirror canonical preset paths under a generated directory, including on subpath deployments. */
export function benchmarkPreviewPath(build: string): string {
  if (!/^data\/gw2\/builds\/[a-z]+\/[a-zA-Z0-9_-]+\.json$/.test(build)) {
    throw new Error('Invalid benchmark build path');
  }

  return build.replace('data/gw2/builds/', 'data/gw2/benchmark-previews/');
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function icon(value: unknown): value is PreviewIcon {
  return (
    record(value) && typeof value.name === 'string' && (value.icon === undefined || typeof value.icon === 'string')
  );
}

/** Reject incomplete or mismatched assets before rendering; failures remain retryable by the loader. */
export function validateBenchmarkPreview(value: unknown, build: string): BenchmarkPreviewData {
  if (
    !record(value) ||
    value.build !== build ||
    !Array.isArray(value.equipment) ||
    !value.equipment.every(
      (field: unknown) => record(field) && typeof field.label === 'string' && typeof field.value === 'string'
    ) ||
    !Array.isArray(value.specializations) ||
    !value.specializations.every(
      (spec: unknown) =>
        record(spec) &&
        icon(spec) &&
        Array.isArray(spec.majorTraits) &&
        spec.majorTraits.every(
          (tier: unknown) =>
            Array.isArray(tier) &&
            tier.every((trait: unknown) => record(trait) && icon(trait) && typeof trait.selected === 'boolean')
        )
    ) ||
    !Array.isArray(value.skills) ||
    !value.skills.every(icon)
  )
    throw new Error('Invalid benchmark preview');
  return value as unknown as BenchmarkPreviewData;
}
