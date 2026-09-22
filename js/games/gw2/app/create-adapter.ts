import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import {
  describeSimulationSkill,
  describeSimulationTrait,
  type SimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { createDefaultTargetConditions as createSharedDefaultTargetConditions } from '#gw2/platform/builds/default-target-conditions.js';
import { RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import { WEAPON_DATA, createProfessionWeaponData } from '#gw2/platform/equipment/weapons/data.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { renderRotationBuilder } from '#gw2/app/rotation/builder.js';
import { createProfessionRuntime } from '#gw2/app/create-runtime.js';
import { gw2BuildEditor } from '#gw2/app/build/editor.js';
import { gw2AppCapabilities } from '#gw2/app/capabilities.js';
import { gw2SimulationPresentation } from '#gw2/app/results/view.js';
import { renderGearOptimizerView } from '#gw2/app/simulation/optimizer-view.js';
import { isBuildSkillAvailable } from '#gw2/platform/builds/skill-eligibility.js';
import type { CatalogEntity, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type { DefineProfessionAppOptions, Gw2AppAdapter } from '#gw2/app/types.js';
import type {
  ProfessionDefaultOffhand,
  ProfessionOffhandContext,
  ProfessionSkillAvailabilityContext,
  ProfessionSlotLoadout
} from '#gw2/app/build/types.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';

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
  tooltips,
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
  isSkillAvailable,
  defaultOffhand = ({ offHands = [] } = {}) => offHands[0] || ''
}: DefineProfessionAppOptions): Readonly<Gw2AppAdapter> {
  const calculateAttributes = createCalculateAttributes(applyBuildAttributeRules);
  const runtimeApi = createProfessionRuntime({
    profession,
    calculateAttributes,
    ...runtime
  });

  // Repeated timeline skills share a model; replacing balance declarations naturally selects a fresh cache.
  const skillTooltips = new WeakMap<ProfessionBalanceContext, Map<SkillId, SimulationTooltip>>();

  // A malformed presentation must not prevent selecting a skill or trait; validation reports its source separately.
  const tooltip = (describe: () => SimulationTooltip, name: string): SimulationTooltip => {
    try {
      return describe();
    } catch (error) {
      console.error(`Unable to describe ${profession.id} tooltip ${name}`, error);
      return { description: 'Simulation details are unavailable.', facts: [], incomplete: true };
    }
  };

  return Object.freeze({
    gameId: 'gw2',
    contentId: profession.id,
    id: profession.id,
    name: profession.name,
    profession,
    skillTooltip: (skill: Skill, patchId: string) =>
      tooltip(() => {
        const context = profession.balanceContextFor(patchId);
        let cached = skillTooltips.get(context);
        const existing = cached?.get(skill.id);
        if (existing) return existing;
        const selected = context.catalog.skillsById.get(skill.id);
        // Palette-only actions have explicit local descriptions but no combat catalog entry.
        if (!selected && tooltips.skills?.[skill.id]) return tooltips.skills[skill.id](context, skill);
        if (!selected) throw new Error(`Missing tooltip skill: ${skill.id}`);
        const model = describeSimulationSkill(context, selected, tooltips);
        if (!cached) {
          cached = new Map();
          skillTooltips.set(context, cached);
        }

        cached.set(skill.id, model);
        return model;
      }, skill.name),
    traitTooltip: (trait: CatalogEntity, patchId: string, specialization: string) =>
      // Core traits can change their payload when an elite specialization is selected.
      tooltip(
        () => describeSimulationTrait(profession.balanceContextFor(patchId), trait, tooltips, specialization),
        trait.name
      ),
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
    renderRotationBuilder,
    buildEditor: gw2BuildEditor,
    // Coordinate independent result and optimizer views when simulation state changes.
    presentation: Object.freeze<Gw2AppAdapter['presentation']>({
      ...gw2SimulationPresentation,
      render(app, viewModel) {
        renderGearOptimizerView(app);
        gw2SimulationPresentation.render(app, viewModel);
      }
    }),
    capabilities: gw2AppCapabilities,
    slotLoadout: profession.ui.slotLoadout ? (profession.ui.slotLoadout as unknown as ProfessionSlotLoadout) : null,
    assumptionControls: (profession.ui.assumptionControls ||
      Object.freeze([])) as readonly ProfessionAssumptionControl[],
    weaponSkillMatchesSet: profession.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet,
    // Profession filters may add restrictions, but cannot bypass shared build eligibility.
    isSkillAvailable: (skill: Skill, context: ProfessionSkillAvailabilityContext = {}) =>
      isBuildSkillAvailable(skill, context) && (isSkillAvailable?.(skill, context) ?? true),
    defaultOffhand
  });
}
