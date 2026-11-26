import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';

/** Use the first equipped elite in build order, or Core when the build has none. */
export function equippedEliteSpecialization(
  catalog: Pick<CanonicalCatalog, 'specializations'>,
  build?: Pick<Gw2CanonicalBuild, 'specializations'>
): string {
  return (
    build?.specializations.find(({ name }) => catalog.specializations.some((spec) => spec.elite && spec.name === name))
      ?.name ?? 'Core'
  );
}
