import {
  createElementalistBuildDefaults as createNativeDefaults,
  migrateElementalistBuild as migrateNativeBuild,
  validateElementalistBuild,
} from "../build.js";

function withLegacySigils(build) {
  return {
    ...build,
    sigils: [...(build.sigils || build.weaponSigils?.[0] || [])],
  };
}

export function createElementalistBuildDefaults() {
  return withLegacySigils(createNativeDefaults());
}

export function migrateElementalistBuild(candidate) {
  return withLegacySigils(migrateNativeBuild(candidate));
}

export { validateElementalistBuild };
