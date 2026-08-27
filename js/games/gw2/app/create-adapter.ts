import { createCalculateAttributes } from '../platform/builds/attributes.js';
import { RELIC_NAMES } from '../platform/equipment/relics/catalog.js';
import { WEAPON_DATA, createProfessionWeaponData } from '../platform/equipment/weapons/data.js';
import { defaultWeaponSkillMatchesSet } from '../platform/equipment/weapons/skill-matcher.js';
import { renderRotationBuilder } from './rotation/index.js';
import { createProfessionRuntime } from './create-runtime.js';
import { gw2BuildEditor } from './build-editor.js';
import { gw2AppCapabilities } from './capabilities.js';
import { gw2SimulationPresentation, renderResults } from './presentation.js';
import type { Skill } from '../platform/engine/types.js';
import type {
  DefineProfessionAppOptions,
  ProfessionAssumptionControl,
  ProfessionDefaultOffhand,
  ProfessionOffhandContext,
  ProfessionSkillAvailabilityContext,
  Gw2AppAdapter,
  ProfessionSlotLoadout
} from './types.js';

/**
 * Default availability rule for shared-shell profession skill selectors.
 *
 * @param {Skill} skill
 * @param {ProfessionSkillAvailabilityContext} [context]
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
 *
 * @param {string} preferred
 * @returns {ProfessionDefaultOffhand}
 */
export function preferOffhand(preferred: string): ProfessionDefaultOffhand {
  return function defaultOffhand({ offHands = [] }: ProfessionOffhandContext = {}): string {
    return offHands.includes(preferred) ? preferred : offHands[0] || '';
  };
}

/**
 * Composes a native profession's attribute calculator and runtime into the
 * single shared-shell adapter consumed by the browser application.
 *
 * @param {DefineProfessionAppOptions} options
 * @returns {Readonly<Gw2AppAdapter>}
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
