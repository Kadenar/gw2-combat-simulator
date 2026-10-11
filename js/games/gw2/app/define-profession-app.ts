import { gw2BuildEditor } from '#gw2/app/build/editor.js';
import type {
  ProfessionDefaultOffhand,
  ProfessionOffhandContext,
  ProfessionSkillAvailabilityContext
} from '#gw2/app/build/types.js';
import { createProfessionRuntime } from '#gw2/app/create-runtime.js';
import { renderGearOptimizerView } from '#gw2/app/optimizer/view.js';
import { gw2SimulationPresentation } from '#gw2/app/results/view.js';
import { renderRotationBuilder } from '#gw2/app/rotation/builder.js';
import {
  describeSimulationSkill,
  describeSimulationTrait,
  type SimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import type { DefineProfessionAppOptions, Gw2AppAdapter } from '#gw2/app/types.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { isBuildSkillAvailable } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2Build, Gw2CanonicalBuild, ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import { RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import { WEAPON_DATA, createProfessionWeaponData } from '#gw2/platform/equipment/weapons/data.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';
import type { CatalogEntity, Skill, SkillId } from '#gw2/platform/skills/types.js';

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
 */
export function defineProfessionApp<
  const TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build
>({
  profession: nativeProfession,
  tooltips,
  applyBuildAttributeRules,
  toApplicationBuild,
  rotationImportLookup = (app) => app.activeCatalog,
  storageVersion = 3,
  storageKey = `gw2-${nativeProfession.id}-simulator-v${storageVersion}`,
  globalName = `${nativeProfession.id}App`,
  filenames = {
    build: `${nativeProfession.id}-build.json`,
    rotation: `${nativeProfession.id}-rotation.json`,
    eventLog: `${nativeProfession.id}-event-log.csv`
  },
  resetPrompt = `Reset the ${nativeProfession.name} build, skills, and rotation?`,
  runtime = {},
  isSkillAvailable,
  defaultOffhand = ({ offHands = [] } = {}) => offHands[0] || ''
}: Omit<DefineProfessionAppOptions, 'profession'> & {
  readonly profession: NativeProfessionContract<TModules, TPresentation, TBuild>;
}): Readonly<Gw2AppAdapter> {
  // Apply previews before capturing catalogs and runtime behavior so every browser adapter uses the same patch.
  const profession = withActivePatchPreview(nativeProfession);
  const calculateAttributes = createCalculateAttributes(applyBuildAttributeRules, profession.attributeContributions);
  const runtimeApi = createProfessionRuntime({
    profession,
    calculateAttributes,
    ...runtime
  });

  // Repeated timeline skills share a model; replacing balance declarations naturally selects a fresh cache.
  const skillTooltips = new WeakMap<
    ProfessionBalanceContext,
    { selection: string; models: Map<SkillId, SimulationTooltip> }
  >();

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
    skillTooltip: (skill: Skill, patchId: string, build?: Pick<Gw2CanonicalBuild, 'specializations'>) =>
      tooltip(() => {
        const context = profession.balanceContextFor(patchId);
        // Trait changes invalidate cached payloads even when the selected balance patch stays the same.
        const selection = JSON.stringify(build?.specializations ?? []);
        let cached = skillTooltips.get(context);
        if (cached?.selection !== selection) {
          cached = { selection, models: new Map() };
          skillTooltips.set(context, cached);
        }

        const existing = cached.models.get(skill.id);
        if (existing) return existing;
        const selected = context.catalog.skillsById.get(skill.id);
        // Palette-only actions have explicit local descriptions but no combat catalog entry.
        if (!selected && tooltips.skills?.[skill.id])
          return tooltips.skills[skill.id](context, skill, undefined, build);
        if (!selected) throw new Error(`Missing tooltip skill: ${skill.id}`);
        const model = describeSimulationSkill(context, selected, tooltips, build);
        cached.models.set(skill.id, model);
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
    specializations: profession.catalog.specializations,
    weaponData: createProfessionWeaponData(profession.catalog, {
      weaponData: WEAPON_DATA
    }),
    relicNames: RELIC_NAMES,
    toApplicationBuild,
    rotationImportLookup,
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
    slotLoadout: profession.ui.slotLoadout,
    assumptionControls: (profession.ui.assumptionControls ||
      Object.freeze([])) as readonly ProfessionAssumptionControl[],
    weaponSkillMatchesSet: profession.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet,
    // Profession filters may add restrictions, but cannot bypass shared build eligibility.
    isSkillAvailable: (skill: Skill, context: ProfessionSkillAvailabilityContext = {}) =>
      isBuildSkillAvailable(skill, context) && (isSkillAvailable?.(skill, context) ?? true),
    defaultOffhand
  });
}
