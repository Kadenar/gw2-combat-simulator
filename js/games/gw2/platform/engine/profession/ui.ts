/**
 * Profession UI composition. Combines Core, active-specialization, and family
 * UI slices without leaking runtime ownership policy into the application.
 */
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  PaletteSkillAvailability,
  ProfessionChargeReleaseContext,
  ProfessionEventLogContext,
  ProfessionPaletteActionIdentity,
  ProfessionPaletteContext,
  ProfessionPaletteGroup,
  ProfessionSkillBarSelectionChange,
  ProfessionUiContract
} from '#gw2/platform/engine/profession/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import { singleOwnerValue, type NamedModule } from '#gw2/platform/engine/profession/module.js';
import {
  everyUiSlice,
  firstUiMatch,
  mergeUiList,
  someUiSlice
} from '#gw2/platform/engine/profession/ui-combinators.js';

type UiCallbackName = keyof ProfessionUiContract;

const UI_LIST_CALLBACK_NAMES = Object.freeze([
  'effectPresentations',
  'paletteGroups',
  'resourceViews',
  'skillBarGroups',
  'startControls',
  'targetHealthThresholds',
  'rotationStateSnapshot'
] as const satisfies readonly UiCallbackName[]);

/** Selection fields composition reads from an arbitrary callback context before choosing slices. */
interface UiSelectionCandidate {
  readonly specialization?: unknown;
  readonly config?: { readonly specialization?: unknown } | null;
  readonly build?: { readonly specialization?: unknown } | null;
}

export function composeModuleUi(modules: readonly NamedModule<object>[]): UiSlice {
  // Callbacks are composed by name, so the slice under construction is a dynamic record until it is returned.
  const ui: Record<string, unknown> = {};
  const slices = modules.map((entry) => entry.module.ui).filter((slice): slice is UiSlice => slice != null);
  // Only callbacks whose policy gives the active elite precedence use this.
  const reversed = slices.slice().reverse();
  const owns = (name: UiCallbackName): boolean => slices.some((slice) => typeof slice[name] === 'function');

  ui.assumptionControls = Object.freeze(slices.flatMap((slice) => slice.assumptionControls || []));
  for (const name of UI_LIST_CALLBACK_NAMES) {
    if (owns(name)) {
      ui[name] = (...args: unknown[]) => mergeUiList(slices, name, args);
    }
  }

  if (owns('paletteSkillAvailability')) {
    ui.paletteSkillAvailability = (...args: unknown[]) =>
      firstUiMatch(
        slices,
        'paletteSkillAvailability',
        args,
        (result) => (result as PaletteSkillAvailability)?.available === false,
        { available: true, message: '' }
      );
  }

  if (owns('eventLogRow')) {
    ui.eventLogRow = (...args: unknown[]) =>
      firstUiMatch(slices, 'eventLogRow', args, (result) => result !== undefined, undefined);
  }

  if (owns('isPaletteSkillInstant')) {
    ui.isPaletteSkillInstant = (...args: unknown[]) =>
      someUiSlice(slices, 'isPaletteSkillInstant', args, (result) => Boolean(result));
  }

  if (owns('isSlotSkillSelectable')) {
    ui.isSlotSkillSelectable = (...args: unknown[]) =>
      everyUiSlice(slices, 'isSlotSkillSelectable', args, (result) => Boolean(result));
  }

  for (const name of ['paletteActionSkills', 'paletteWeaponSkills'] as const) {
    if (!owns(name)) continue;
    ui[name] = (context: ProfessionPaletteContext, skills: readonly Skill[]) =>
      slices.reduce(
        (current, slice) => {
          const project = slice[name];
          return typeof project === 'function' ? project(context, current) : current;
        },
        [...skills]
      );
  }

  if (owns('renderWeaponPalette')) {
    ui.renderWeaponPalette = (...args: unknown[]) =>
      firstUiMatch(reversed, 'renderWeaponPalette', args, (result) => result != null, null);
  }

  if (owns('resolvePaletteAction')) {
    ui.resolvePaletteAction = (...args: unknown[]) =>
      firstUiMatch(reversed, 'resolvePaletteAction', args, (result) => result !== undefined, undefined);
  }

  if (owns('updatePaletteControl')) {
    ui.updatePaletteControl = (...args: unknown[]) =>
      someUiSlice(reversed, 'updatePaletteControl', args, (result) => Boolean(result));
  }

  if (owns('updateSkillBarSelection')) {
    ui.updateSkillBarSelection = (...args: unknown[]) =>
      someUiSlice(reversed, 'updateSkillBarSelection', args, (result) => Boolean(result));
  }

  for (const name of ['timelineWeaponLineTransition', 'timelineSkillIcon'] as const) {
    if (!owns(name)) continue;
    ui[name] = (...args: unknown[]) =>
      firstUiMatch(
        reversed,
        name,
        args,
        (result) => result !== undefined && result !== '',
        name === 'timelineSkillIcon' ? '' : undefined
      );
  }

  const slotLoadout = singleOwnerValue(modules, (module) => module.ui?.slotLoadout, 'ui.slotLoadout');
  if (slotLoadout != null) ui.slotLoadout = slotLoadout;
  const weaponSwapChangesSet = singleOwnerValue(
    modules,
    (module) => module.ui?.weaponSwapChangesSet,
    'ui.weaponSwapChangesSet'
  );
  if (weaponSwapChangesSet != null) {
    ui.weaponSwapChangesSet = weaponSwapChangesSet;
  }

  return ui as UiSlice;
}

type UiSlice = Partial<ProfessionUiContract>;

export interface ProfessionFamilyUiDefinition {
  readonly catalog: CanonicalCatalog;
  readonly core: UiSlice;
  readonly specializations: Readonly<Record<string, UiSlice>>;
  readonly family?: UiSlice;
}

function uiSpecialization(context: unknown): string {
  if (!context || typeof context !== 'object') return 'Core';
  const candidate = context as UiSelectionCandidate;
  const config = candidate.config;
  const build = candidate.build;
  return String(candidate.specialization || config?.specialization || build?.specialization || 'Core').trim() || 'Core';
}

function explicitUiSpecialization(context: unknown): string | null {
  if (!context || typeof context !== 'object') return null;
  const candidate = context as UiSelectionCandidate;
  const config = candidate.config;
  const build = candidate.build;
  const value = candidate.specialization ?? config?.specialization ?? build?.specialization;
  if (value == null || !String(value).trim()) return null;
  return String(value).trim();
}

function normalizedCoreUiContext(context: unknown): object {
  if (!context || typeof context !== 'object') {
    return { specialization: 'Core', config: { specialization: 'Core' } };
  }

  const candidate = context as UiSelectionCandidate;
  return {
    ...candidate,
    specialization: 'Core',
    config: {
      ...(candidate.config || {}),
      specialization: 'Core'
    }
  };
}

function deduplicateUiEntries(values: readonly unknown[], callbackName: string): unknown[] {
  const keys = new Set<string>();
  return values.filter((value, index) => {
    if (!value || typeof value !== 'object') return true;
    const candidate = value as { readonly id?: unknown };
    const key = candidate.id == null ? '' : String(candidate.id);
    if (!key) return true;
    if (keys.has(key)) {
      throw new TypeError(`ui.${callbackName} returned duplicate id ${key} at index ${index}.`);
    }

    keys.add(key);
    return true;
  });
}

function normalizeApplicationUiList(values: readonly unknown[], callbackName: string): unknown[] {
  // Preserve module ownership order by default, while allowing presentation
  // slices to place elite mechanics ahead of their core mechanic rows.
  const orderedValues = ['paletteGroups', 'skillBarGroups'].includes(callbackName)
    ? values
        .map((value, index) => ({ value, index }))
        .sort((left, right) => {
          const leftOrder = Number((left.value as { readonly order?: unknown } | null)?.order ?? 0);
          const rightOrder = Number((right.value as { readonly order?: unknown } | null)?.order ?? 0);
          return leftOrder - rightOrder || left.index - right.index;
        })
        .map(({ value }) => value)
    : [...values];
  if (callbackName !== 'paletteGroups') {
    return deduplicateUiEntries(orderedValues, callbackName);
  }

  const groups = orderedValues;
  const anchorIndexes = groups.flatMap((value, index) =>
    value && typeof value === 'object' && (value as ProfessionPaletteGroup).resourceAnchor ? [index] : []
  );
  if (anchorIndexes.length > 1) {
    const firstIndex = anchorIndexes[0];
    const lastIndex = anchorIndexes.at(-1) as number;
    const first = groups[firstIndex] as ProfessionPaletteGroup;
    const last = groups[lastIndex] as ProfessionPaletteGroup;
    groups[firstIndex] = {
      ...first,
      skillIds: last.skillIds,
      // The specialization replaces the anchored profession skills, so its
      // targeted resource layout must follow those skills into the retained group.
      ...(Object.hasOwn(last, 'resourceIds') ? { resourceIds: last.resourceIds } : {}),
      ...(Object.hasOwn(last, 'resourcePlacement') ? { resourcePlacement: last.resourcePlacement } : {})
    };
    for (const index of anchorIndexes.slice(1).reverse()) {
      groups.splice(index, 1);
    }
  }

  return deduplicateUiEntries(groups, callbackName);
}

/**
 * Composes the complete application UI from Core, the selected elite, and
 * narrowly scoped family callbacks. Unknown elite names and ordinary Core
 * trait-line names intentionally fall back to Core for application rendering;
 * runtime resolution remains strict.
 */
export function createProfessionFamilyUi(definition: ProfessionFamilyUiDefinition): UiSlice {
  const family = definition.family || {};
  const eliteNames = new Set(
    definition.catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name)
  );
  const active = (context: unknown): { readonly context: unknown; readonly slices: UiSlice[] } => {
    const requested = uiSpecialization(context);
    const specialization = definition.specializations[requested];
    if (specialization && eliteNames.has(requested)) {
      return {
        context,
        slices: [definition.core, specialization]
      };
    }

    return {
      context: requested === 'Core' ? context : normalizedCoreUiContext(context),
      slices: [definition.core]
    };
  };

  const allSlices = [definition.core, ...Object.values(definition.specializations)];
  const scalarSlices = (context: unknown, skill?: Skill): { readonly context: unknown; readonly slices: UiSlice[] } => {
    if (explicitUiSpecialization(context)) {
      const selected = active(context);
      return {
        context: selected.context,
        slices: [...selected.slices, family]
      };
    }

    const skillSpecialization = String(skill?.specialization || '').trim();
    const specialization = definition.specializations[skillSpecialization];
    if (specialization && eliteNames.has(skillSpecialization)) {
      return {
        context,
        slices: [definition.core, specialization, family]
      };
    }

    return {
      context,
      slices: [...allSlices, family]
    };
  };

  // Callbacks are composed by name, so the slice under construction is a dynamic record until it is returned.
  const ui: Record<string, unknown> = {
    assumptionControls: Object.freeze(
      deduplicateUiEntries(
        [...(family.assumptionControls || []), ...allSlices.flatMap((slice) => slice.assumptionControls || [])],
        'assumptionControls'
      ) as ProfessionAssumptionControl[]
    )
  };

  for (const name of UI_LIST_CALLBACK_NAMES) {
    ui[name] = (context: unknown) => {
      const selected = active(context);
      const values = mergeUiList([...selected.slices, family], name, [selected.context]);
      return normalizeApplicationUiList(values, name);
    };
  }

  ui.paletteSkillAvailability = (context: unknown, skill: Skill) => {
    const selected = scalarSlices(context, skill);
    return firstUiMatch(
      selected.slices,
      'paletteSkillAvailability',
      [selected.context, skill],
      (result) => (result as PaletteSkillAvailability)?.available === false,
      { available: true, message: '' }
    );
  };

  ui.eventLogRow = (context: ProfessionEventLogContext, event: SimulationEvent) => {
    const selected = active(context);
    return firstUiMatch(
      [...selected.slices, family],
      'eventLogRow',
      [selected.context, event],
      (result) => result !== undefined,
      undefined
    );
  };

  ui.chargeReleaseProjection = (context: ProfessionChargeReleaseContext) => {
    const selected = scalarSlices(context, context.skill);
    return firstUiMatch(
      selected.slices,
      'chargeReleaseProjection',
      [selected.context],
      (result) => result !== undefined && result !== null,
      null
    );
  };

  ui.isPaletteSkillInstant = (context: ProfessionPaletteContext, skill: Skill) => {
    const selected = scalarSlices(context, skill);
    return someUiSlice(
      selected.slices,
      'isPaletteSkillInstant',
      [selected.context, skill],
      (result) => result === true
    );
  };

  ui.isSlotSkillSelectable = (context: ProfessionPaletteContext, skill: Skill) => {
    const selected = scalarSlices(context, skill);
    return everyUiSlice(
      selected.slices,
      'isSlotSkillSelectable',
      [selected.context, skill],
      (result) => result !== false
    );
  };

  for (const name of ['paletteActionSkills', 'paletteWeaponSkills'] as const) {
    ui[name] = (context: ProfessionPaletteContext, skills: readonly Skill[]) => {
      const selected = active(context);
      // Core normalization keeps the caller's palette fields, so the selected context is still a palette context.
      const selectedContext = selected.context as ProfessionPaletteContext;
      return [...selected.slices, family].reduce(
        (current, slice) => {
          const project = slice[name];
          return typeof project === 'function' ? project(selectedContext, current) : current;
        },
        [...skills]
      );
    };
  }

  ui.renderWeaponPalette = (context: ProfessionPaletteContext) => {
    const selected = active(context);
    return firstUiMatch(
      [...selected.slices.slice().reverse(), family],
      'renderWeaponPalette',
      [selected.context],
      (result) => result != null,
      null
    );
  };

  ui.resolvePaletteAction = (context: ProfessionPaletteContext, action: ProfessionPaletteActionIdentity) => {
    const selected = active(context);
    return firstUiMatch(
      [...selected.slices.slice().reverse(), family],
      'resolvePaletteAction',
      [selected.context, action],
      (result) => result !== undefined,
      undefined
    ) as ReturnType<ProfessionUiContract['resolvePaletteAction']>;
  };

  ui.updatePaletteControl = (context: ProfessionPaletteContext, controlId: string) => {
    const selected = active(context);
    return someUiSlice(
      [...selected.slices.slice().reverse(), family],
      'updatePaletteControl',
      [selected.context, controlId],
      (result) => Boolean(result)
    );
  };

  ui.updateSkillBarSelection = (context: ProfessionPaletteContext, selection: ProfessionSkillBarSelectionChange) => {
    const selected = active(context);
    return someUiSlice(
      [...selected.slices.slice().reverse(), family],
      'updateSkillBarSelection',
      [selected.context, selection],
      (result) => Boolean(result)
    );
  };

  for (const name of ['timelineWeaponLineTransition', 'timelineSkillIcon'] as const) {
    ui[name] = (context: ProfessionPaletteContext) => {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices.slice().reverse(), family],
        name,
        [selected.context],
        (result) => result !== undefined && result !== '',
        name === 'timelineSkillIcon' ? '' : undefined
      );
    };
  }

  for (const name of ['slotLoadout', 'weaponSwapChangesSet'] as const) {
    const owners = [family, ...allSlices].filter((slice) => slice[name] != null);
    if (owners.length > 1) {
      throw new TypeError(`ui.${name} has multiple application owners.`);
    }

    if (owners.length) ui[name] = owners[0][name];
  }

  return Object.freeze(ui) as UiSlice;
}
