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
  resolveTooltips,
  type SimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import type { DefineProfessionAppOptions, Gw2AppAdapter } from '#gw2/app/types.js';
import type { ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import { isBuildSkillAvailable } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2CanonicalBuild, ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import { RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import { createProfessionWeaponData } from '#gw2/platform/equipment/weapons/data.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
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
export function defineProfessionApp({
  profession,
  tooltips,
  createBuildContext,
  toApplicationBuild,
  storageVersion = 3,
  resetPrompt = `Reset the ${profession.name} build, skills, and rotation?`,
  isSkillAvailable,
  defaultOffhand = ({ offHands = [] } = {}) => offHands[0] || ''
}: DefineProfessionAppOptions): Readonly<Gw2AppAdapter> {
  // A typo in a tooltip registration must fail at composition rather than silently describe live behavior.
  for (const id of Object.keys(tooltips.reworks ?? {})) {
    if (!Object.hasOwn(profession.nativeDefinition.moduleVariants ?? {}, id))
      throw new TypeError(`Unknown tooltip module rework ${id}.`);
  }

  // Storage and export identities follow the profession; only the saved-build schema version varies.
  const storageKey = `gw2-${profession.id}-simulator-v${storageVersion}`;
  const globalName = `${profession.id}App`;
  const filenames = Object.freeze({
    build: `${profession.id}-build.json`,
    rotation: `${profession.id}-rotation.json`,
    eventLog: `${profession.id}-event-log.csv`
  });
  const runtimeApi = createProfessionRuntime({ profession, createBuildContext });

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
    skillTooltip: (skill: Skill, patch: ResolvedPatch, build?: Pick<Gw2CanonicalBuild, 'specializations'>) =>
      tooltip(() => {
        const context = patch.balanceContext;
        const selectedTooltips = resolveTooltips(context, tooltips);
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
        if (!selected && selectedTooltips.skills?.[skill.id])
          return selectedTooltips.skills[skill.id](context, skill, undefined, build);

        if (!selected) throw new Error(`Missing tooltip skill: ${skill.id}`);

        const model = describeSimulationSkill(context, selected, tooltips, build);
        cached.models.set(skill.id, model);
        return model;
      }, skill.name),
    traitTooltip: (trait: CatalogEntity, patch: ResolvedPatch, specialization: string) =>
      // Core traits can change their payload when an elite specialization is selected.
      tooltip(() => describeSimulationTrait(patch.balanceContext, trait, tooltips, specialization), trait.name),
    storageKey,
    globalName,
    filenames,
    resetPrompt,
    weaponData: createProfessionWeaponData(profession.catalog),
    relicNames: RELIC_NAMES,
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
    slotLoadout: profession.ui.slotLoadout,
    assumptionControls: (profession.ui.assumptionControls ||
      Object.freeze([])) as readonly ProfessionAssumptionControl[],
    weaponSkillMatchesSet: profession.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet,
    // Profession filters may add restrictions, but cannot bypass shared build eligibility.
    isSkillAvailable: (skill: Skill, context: ProfessionSkillAvailabilityContext) =>
      isBuildSkillAvailable(skill, context) && (isSkillAvailable?.(skill, context) ?? true),
    defaultOffhand
  });
}
