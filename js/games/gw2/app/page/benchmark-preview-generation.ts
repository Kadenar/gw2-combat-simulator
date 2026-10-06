import type { Gw2AppAdapter } from '#gw2/app/types.js';
import type { ProfessionSpecialization } from '#gw2/app/build/types.js';
import type { CatalogEntity } from '#gw2/platform/skills/types.js';
import type { BenchmarkPreviewData, PreviewIcon } from '#gw2/app/page/benchmark-preview-data.js';

function displayIcon(entity: CatalogEntity | undefined, name: string): PreviewIcon {
  return { name, ...(typeof entity?.icon === 'string' ? { icon: entity.icon } : {}) };
}

/** Run the canonical codec during asset generation so derived loadouts (including legends) stay authoritative. */
export function createBenchmarkPreview(
  adapter: Gw2AppAdapter,
  candidate: unknown,
  buildPath: string
): BenchmarkPreviewData {
  const build = adapter.toApplicationBuild(candidate);
  const catalog = adapter.profession.catalog;
  const specializations = catalog.specializations as readonly ProfessionSpecialization[];
  const weapons = [build.weapons, build.alternateWeapons]
    .map((set) => set.filter(Boolean).join(' / '))
    .filter(Boolean)
    .join(' · ');
  const prefixes = [...new Set([...Object.values(build.gear), ...build.alternateWeaponPrefixes].filter(Boolean))];
  return {
    build: buildPath,
    equipment: [
      { label: 'Weapons', value: weapons },
      { label: 'Stats', value: prefixes.join(' / ') },
      { label: 'Rune / relic', value: [build.rune, build.relic].filter(Boolean).join(' / ') },
      {
        label: 'Sigils',
        value: build.weaponSigils
          .map((set) => set.filter(Boolean).join(' / '))
          .filter((value, index, sets) => value && sets.indexOf(value) === index)
          .join(' · ')
      },
      { label: 'Legends', value: build.selectedLegends?.join(' / ') ?? '' },
      { label: 'Pets', value: [build.selectedPet, build.selectedPet2].filter(Boolean).join(' / ') }
    ].filter(({ value }) => value),
    specializations: build.specializations.map((selection) => {
      const specialization = specializations.find(({ name }) => name === selection.name);
      if (!specialization) throw new Error(`Unknown preview specialization: ${selection.name}`);
      const picks = selection.traits.split('-').map(Number);
      return {
        ...displayIcon(specialization, selection.name),
        majorTraits: specialization.majorTraits.map((tier, tierIndex) =>
          tier.map((trait, choice) => ({
            ...displayIcon(trait, trait.name),
            selected: picks[tierIndex] === choice + 1
          }))
        )
      };
    }),
    skills: Object.entries(build.selectedSkillIds).flatMap(([slot, id]) => {
      if (id === null) return [];
      const skill = catalog.skillsById.get(id);
      return [displayIcon(skill, skill?.name ?? slot)];
    })
  };
}
