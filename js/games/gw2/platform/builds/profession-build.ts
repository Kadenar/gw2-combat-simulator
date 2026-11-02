import type { ProfessionBuildDefinition, UnvalidatedBuild } from '#gw2/platform/builds/types.js';

/** Normalizes storage callbacks independently of the executable profession contract. */
export function normalizeProfessionBuild<TBuild extends object>(
  professionId: string,
  build: ProfessionBuildDefinition<TBuild> = {}
) {
  return Object.freeze({
    createBuildDefaults:
      build.createBuildDefaults ||
      (() =>
        ({
          schemaVersion: 3,
          profession: professionId
        }) as unknown as TBuild),
    migrateRotation: build.migrateRotation,
    migrateBuild: build.migrateBuild || ((saved: UnvalidatedBuild) => saved as TBuild),
    validateBuild: build.validateBuild || (() => ({ valid: true, errors: [] }))
  });
}
