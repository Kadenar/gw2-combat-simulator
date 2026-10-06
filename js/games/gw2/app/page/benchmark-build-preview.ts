import { escapeHtml as html } from '#ui/shared/html.js';
import {
  benchmarkPreviewPath,
  validateBenchmarkPreview,
  type PreviewIcon
} from '#gw2/app/page/benchmark-preview-data.js';
import type { Benchmark } from '#gw2/app/page/benchmarks.js';

const previews = new Map<string, Promise<string>>();

/** Share generated previews across charts without loading profession code or changing the active workspace. */
export function benchmarkBuildPreview(row: Benchmark): Promise<string> {
  const key = `${row.profession}:${row.build}`;
  const cached = previews.get(key);
  if (cached) return cached;
  const pending = loadPreview(row).catch((error: unknown) => {
    previews.delete(key);
    throw error;
  });
  previews.set(key, pending);
  return pending;
}

function icon(entity: PreviewIcon, label = entity.name): string {
  return entity.icon
    ? `<img src="${html(entity.icon)}" alt="${html(label)}" title="${html(label)}" width="28" height="28">`
    : `<span class="benchmark-preview-icon" title="${html(label)}">${html(label)}</span>`;
}

async function loadPreview(row: Benchmark): Promise<string> {
  const response = await fetch(benchmarkPreviewPath(row.build));
  if (!response.ok) throw new Error('Build preview unavailable');
  const preview = validateBenchmarkPreview(await response.json(), row.build);
  const equipment = preview.equipment
    .map(({ label, value }) => `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`)
    .join('');
  // Preserve the editor's three trait tiers and chosen slots using precomputed display data.
  const traits = preview.specializations
    .map(
      (spec) =>
        `<div class="benchmark-preview-traits"><div class="benchmark-preview-spec-name">${icon(spec)}<span>${html(spec.name)}</span></div><div class="benchmark-preview-trait-grid">${spec.majorTraits.map((tier) => `<div>${tier.map((trait) => `<span class="benchmark-preview-trait ${trait.selected ? 'is-picked' : ''}">${icon(trait, `${trait.name}${trait.selected ? ' (selected)' : ''}`)}</span>`).join('')}</div>`).join('')}</div></div>`
    )
    .join('');
  const skills = preview.skills
    .map((skill) => `<span>${icon(skill)}<small>${html(skill.name)}</small></span>`)
    .join('');
  return `<dl class="benchmark-preview-equipment">${equipment}</dl><div class="benchmark-preview-specializations" aria-label="Specializations and selected traits">${traits}</div>${skills ? `<div class="benchmark-preview-skills" aria-label="Selected skills">${skills}</div>` : ''}`;
}
