import { createCalculateAttributes } from "../platform/gw2/attributes.js";
import { createGw2AppAdapter } from "./create-app-adapter.js";
import { createProfessionRuntime } from "./create-profession-runtime.js";

/**
 * Default availability rule for shared-shell profession skill selectors.
 */
export function defaultIsSkillAvailable(skill, { specialization } = {}) {
  if (skill.implemented === false || skill.simulatorExcluded) return false;
  if (skill.type === "Weapon") return true;
  return !skill.specialization || skill.specialization === specialization;
}

/**
 * Creates an offhand selector that prefers one weapon when it is available.
 */
export function preferOffhand(preferred) {
  return function defaultOffhand({ offHands = [] } = {}) {
    return offHands.includes(preferred) ? preferred : offHands[0] || "";
  };
}

/**
 * Composes a native profession's attribute calculator, application runtime,
 * and shared-shell adapter from one profession-level definition.
 *
 * @param {Object} options
 * @param {Object} options.profession
 * @param {Function} options.applyBuildAttributeRules
 * @param {Function} options.createDefaultTargetConditions
 * @param {Function} options.toApplicationBuild
 * @param {string} options.specializationFallback
 * @param {number} [options.storageVersion=3]
 * @param {string} [options.storageKey]
 * @param {string} [options.globalName]
 * @param {Object} [options.filenames]
 * @param {string} [options.resetPrompt]
 * @param {Object} [options.runtime]
 * @param {Function} [options.isSkillAvailable]
 * @param {Function} [options.defaultOffhand]
 * @returns {Object}
 */
export function defineProfessionApp({
  profession,
  applyBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback,
  storageVersion = 3,
  storageKey = `gw2-${profession.id}-simulator-v${storageVersion}`,
  globalName = `${profession.id}App`,
  filenames = {
    build: `${profession.id}-build.json`,
    rotation: `${profession.id}-rotation.json`,
    eventLog: `${profession.id}-event-log.csv`,
  },
  resetPrompt =
    `Reset the ${profession.name} build, skills, and rotation?`,
  runtime = {},
  isSkillAvailable = defaultIsSkillAvailable,
  defaultOffhand = ({ offHands = [] } = {}) => offHands[0] || "",
}) {
  const calculateAttributes = createCalculateAttributes(
    applyBuildAttributeRules,
  );
  const runtimeApi = createProfessionRuntime({
    profession,
    calculateAttributes,
    ...runtime,
  });
  const appAdapter = createGw2AppAdapter({
    profession,
    storageKey,
    globalName,
    filenames,
    resetPrompt,
    specializationFallback,
    createDefaultTargetConditions,
    toApplicationBuild,
    eliteSpecialization: runtimeApi.eliteSpecialization,
    recalculate: runtimeApi.recalculate,
    runSimulation: runtimeApi.runSimulation,
    modifierContributionRequest: runtimeApi.modifierContributionRequest,
    calculateModifierContributions:
      runtimeApi.calculateModifierContributions,
    randomDistributionRequest: runtimeApi.randomDistributionRequest,
    calculateRandomDistribution: runtimeApi.calculateRandomDistribution,
    isSkillAvailable,
    defaultOffhand,
  });

  return Object.freeze({
    appAdapter,
    calculateAttributes,
    ...runtimeApi,
  });
}
