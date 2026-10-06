import { professionRegistry } from '#gw2/profession-registry.js';
import { escapeHtml as html } from '#ui/shared/html.js';
import type { ProfessionSpecialization } from '#gw2/app/build/types.js';
import type { CatalogEntity } from '#gw2/platform/skills/types.js';
import type { Benchmark } from '#gw2/app/page/benchmarks.js';

const previews = new Map<string, Promise<string>>();

/** Read the saved loadout through its profession codec without applying it to the active workspace. */
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

function icon(entity: CatalogEntity | undefined, label: string): string {
  return entity && typeof entity.icon === 'string'
    ? `<img src="${html(entity.icon)}" alt="${html(label)}" title="${html(label)}" width="28" height="28">`
    : `<span class="benchmark-preview-icon" title="${html(label)}">${html(label)}</span>`;
}

async function loadPreview(row: Benchmark): Promise<string> {
  const entry = professionRegistry.find(({ id }) => id === row.profession);
  if (!entry) throw new Error('Unknown profession');
  const [adapter, response] = await Promise.all([entry.loadAppAdapter(), fetch(row.build)]);
  if (!response.ok) throw new Error('Build unavailable');
  const build = adapter.toApplicationBuild(await response.json());
  const catalog = adapter.profession.catalog;
  const specializations = catalog.specializations as readonly ProfessionSpecialization[];
  const field = (label: string, value: string): string =>
    value ? `<div><dt>${label}</dt><dd>${html(value)}</dd></div>` : '';
  const weapons = [build.weapons, build.alternateWeapons]
    .map((set) => set.filter(Boolean).join(' / '))
    .filter(Boolean)
    .join(' · ');
  const prefixes = [...new Set([...Object.values(build.gear), ...build.alternateWeaponPrefixes].filter(Boolean))];
  const traits = build.specializations
    .map((selection) => {
      const specialization = specializations.find(({ name }) => name === selection.name);
      const picks = selection.traits.split('-').map(Number);
      // Mirror the editor's three trait tiers so selected choices are recognizable without numeric codes.
      return `<div class="benchmark-preview-traits"><div class="benchmark-preview-spec-name">${icon(specialization, selection.name)}<span>${html(selection.name)}</span></div><div class="benchmark-preview-trait-grid">${specialization?.majorTraits.map((tier, tierIndex) => `<div>${tier.map((trait, choice) => `<span class="benchmark-preview-trait ${picks[tierIndex] === choice + 1 ? 'is-picked' : ''}">${icon(trait, `${trait.name}${picks[tierIndex] === choice + 1 ? ' (selected)' : ''}`)}</span>`).join('')}</div>`).join('') ?? ''}</div></div>`;
    })
    .join('');
  const skills = Object.entries(build.selectedSkillIds)
    .flatMap(([slot, id]) => {
      if (id === null) return [];
      const skill = catalog.skillsById.get(id);
      return [`<span>${icon(skill, skill?.name ?? slot)}<small>${html(skill?.name ?? slot)}</small></span>`];
    })
    .join('');
  return `<dl class="benchmark-preview-equipment">${field('Weapons', weapons)}${field('Stats', prefixes.join(' / '))}${field('Rune / relic', [build.rune, build.relic].filter(Boolean).join(' / '))}${field(
    'Sigils',
    build.weaponSigils
      .map((set) => set.filter(Boolean).join(' / '))
      .filter((value, index, sets) => value && sets.indexOf(value) === index)
      .join(' · ')
  )}${field('Legends', build.selectedLegends?.join(' / ') ?? '')}${field('Pets', [build.selectedPet, build.selectedPet2].filter(Boolean).join(' / '))}</dl><div class="benchmark-preview-specializations" aria-label="Specializations and selected traits">${traits}</div>${skills ? `<div class="benchmark-preview-skills" aria-label="Selected skills">${skills}</div>` : ''}`;
}
