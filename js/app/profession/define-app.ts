import { createCalculateAttributes } from "../../platform/gw2/attributes.js";
import { createGw2AppAdapter } from "./create-adapter.js";
import { createProfessionRuntime } from "./create-runtime.js";
import type { Skill } from "../../platform/engine/types.js";
import type {
  DefineProfessionAppOptions,
  ProfessionAppDefinition,
  ProfessionDefaultOffhand,
  ProfessionOffhandContext,
  ProfessionSkillAvailabilityContext,
} from "./types.js";

/**
 * Default availability rule for shared-shell profession skill selectors.
 *
 * @param {Skill} skill
 * @param {ProfessionSkillAvailabilityContext} [context]
 */
export function defaultIsSkillAvailable(
  skill: Skill,
  { specialization }: ProfessionSkillAvailabilityContext = {},
): boolean {
  if (skill.implemented === false || skill.simulatorExcluded) return false;
  if (skill.type === "Weapon") return true;
  return !skill.specialization || skill.specialization === specialization;
}

/**
 * Creates an offhand selector that prefers one weapon when it is available.
 *
 * @param {string} preferred
 * @returns {ProfessionDefaultOffhand}
 */
export function preferOffhand(
  preferred: string,
): ProfessionDefaultOffhand {
  return function defaultOffhand(
    { offHands = [] }: ProfessionOffhandContext = {},
  ): string {
    return offHands.includes(preferred) ? preferred : offHands[0] || "";
  };
}

/**
 * Composes a native profession's attribute calculator, application runtime,
 * and shared-shell adapter from one profession-level definition.
 *
 * @param {DefineProfessionAppOptions} options
 * @returns {Readonly<ProfessionAppDefinition>}
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
  resetPrompt = `Reset the ${profession.name} build, skills, and rotation?`,
  runtime = {},
  isSkillAvailable = defaultIsSkillAvailable,
  defaultOffhand = ({ offHands = [] } = {}) => offHands[0] || "",
}: DefineProfessionAppOptions): Readonly<ProfessionAppDefinition> {
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
    calculateModifierContributions: runtimeApi.calculateModifierContributions,
    randomDistributionRequest: runtimeApi.randomDistributionRequest,
    calculateRandomDistribution: runtimeApi.calculateRandomDistribution,
    isSkillAvailable,
    defaultOffhand,
  });

  const definition: ProfessionAppDefinition = {
    appAdapter,
    calculateAttributes,
    ...runtimeApi,
  };
  return Object.freeze(definition);
}
