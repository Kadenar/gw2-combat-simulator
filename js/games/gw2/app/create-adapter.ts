import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createDefaultTargetConditions as createSharedDefaultTargetConditions } from '#gw2/platform/builds/default-target-conditions.js';
import { RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import { WEAPON_DATA, createProfessionWeaponData } from '#gw2/platform/equipment/weapons/data.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { renderRotationBuilder } from '#gw2/app/rotation/index.js';
import { createProfessionRuntime } from '#gw2/app/create-runtime.js';
import { gw2BuildEditor } from '#gw2/app/build-editor.js';
import { gw2AppCapabilities } from '#gw2/app/capabilities.js';
import { gw2SimulationPresentation, renderResults } from '#gw2/app/presentation.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type {
  DefineProfessionAppOptions,
  ProfessionDefaultOffhand,
  ProfessionOffhandContext,
  ProfessionSkillAvailabilityContext,
  Gw2AppAdapter,
  ProfessionSlotLoadout
} from '#gw2/app/types.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';

/**
 * Default availability rule for shared-shell profession skill selectors.
 */
export function defaultIsSkillAvailable(
  skill: Skill,
  { specialization }: ProfessionSkillAvailabilityContext = {}
): boolean {
  if (skill.implemented === false || skill.simulatorExcluded) return false;
  if (skill.type === 'Weapon') return true;
  return !skill.specialization || skill.specialization === specialization;
}

/**
 * Creates an offhand selector that prefers one weapon when it is available.
 */
export function preferOffhand(preferred: string): ProfessionDefaultOffhand {
  return function defaultOffhand({ offHands = [] }: ProfessionOffhandContext = {}): string {
    return offHands.includes(preferred) ? preferred : offHands[0] || '';
  };
}

/**
 * Composes a native profession's attribute calculator and runtime into the
 * single shared-shell adapter consumed by the browser application.
 * Shared GW2 target conditions are used unless a profession overrides them.
 */
export function defineProfessionApp({
  profession,
  applyBuildAttributeRules,
  createDefaultTargetConditions = createSharedDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback,
  storageVersion = 3,
  storageKey = `gw2-${profession.id}-simulator-v${storageVersion}`,
  globalName = `${profession.id}App`,
  filenames = {
    build: `${profession.id}-build.json`,
    rotation: `${profession.id}-rotation.json`,
    eventLog: `${profession.id}-event-log.csv`
  },
  resetPrompt = `Reset the ${profession.name} build, skills, and rotation?`,
  runtime = {},
  isSkillAvailable = defaultIsSkillAvailable,
  defaultOffhand = ({ offHands = [] } = {}) => offHands[0] || ''
}: DefineProfessionAppOptions): Readonly<Gw2AppAdapter> {
  const calculateAttributes = createCalculateAttributes(applyBuildAttributeRules);
  const runtimeApi = createProfessionRuntime({
    profession,
    calculateAttributes,
    ...runtime
  });

  return Object.freeze({
    gameId: 'gw2',
    contentId: profession.id,
    id: profession.id,
    name: profession.name,
    profession,
    storageKey,
    globalName,
    filenames: Object.freeze({ ...filenames }),
    resetPrompt,
    specializationFallback,
    specializations: profession.catalog.specializations,
    weaponData: createProfessionWeaponData(profession.catalog, {
      weaponData: WEAPON_DATA
    }),
    relicNames: RELIC_NAMES,
    createDefaultTargetConditions,
    toApplicationBuild,
    ...runtimeApi,
    renderResults,
    renderRotationBuilder,
    buildEditor: gw2BuildEditor,
    presentation: gw2SimulationPresentation,
    capabilities: gw2AppCapabilities,
    slotLoadout: profession.ui.slotLoadout ? (profession.ui.slotLoadout as unknown as ProfessionSlotLoadout) : null,
    assumptionControls: (profession.ui.assumptionControls ||
      Object.freeze([])) as readonly ProfessionAssumptionControl[],
    weaponSkillMatchesSet: profession.ui.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet,
    isSkillAvailable,
    defaultOffhand
  });
}
