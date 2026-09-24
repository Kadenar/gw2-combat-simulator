import type { SchedulerConfig, SchedulerContext } from '#gw2/platform/execution/types.js';
import type { ResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
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
} from '#gw2/platform/profession-presentation/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { ProfessionResourceDefinition } from '#gw2/platform/engine/profession/types.js';

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
  readonly catalog?: CanonicalCatalog;
  readonly specialization?: unknown;
  readonly config?: { readonly specialization?: unknown } | null;
  readonly build?: { readonly specialization?: unknown } | null;
}

type UiSlice = Partial<ProfessionUiContract>;

export interface ProfessionFamilyUiDefinition {
  readonly resourcesFor?: (
    specialization: string
  ) => Pick<ProfessionResourceDefinition, 'endurance'> & ResourcePolicies;
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
      // Preview capacity uses selected policies and the active catalog without starting gameplay tasks.
      const policies =
        name === 'resourceViews' ? definition.resourcesFor?.(uiSpecialization(selected.context)) : undefined;
      const callbackContext = policies
        ? {
            ...(selected.context as object),
            resources: Object.fromEntries(
              Object.entries(policies)
                .filter(([, policy]) => policy != null)
                .map(([key, policy]) => [
                  key,
                  {
                    maximum: policy!.maximum({
                      ...(selected.context as object),
                      config: ((selected.context as UiSelectionCandidate).config ??
                        selected.context) as SchedulerConfig,
                      catalog: (selected.context as UiSelectionCandidate).catalog ?? definition.catalog
                    } as SchedulerContext)
                  }
                ])
            )
          }
        : selected.context;
      const values = mergeUiList([...selected.slices, family], name, [callbackContext]);
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

/**
 * Private slice-merge helpers for application UI composition. Each helper is order-
 * agnostic and only knows how to combine an ordered list of UI slices for one
 * callback; the selection strategy (which slices, in what order, and any
 * post-processing) stays with each caller.
 */
type UiSliceLike = Readonly<Record<string, unknown>>;

type UiCallback = (...args: unknown[]) => unknown;

/** Concatenates every slice's list result for `name`, skipping non-owners. */
function mergeUiList(slices: readonly UiSliceLike[], name: string, args: readonly unknown[]): unknown[] {
  return slices.flatMap((slice) => {
    const callback = slice[name];
    return typeof callback === 'function' ? ((callback as UiCallback)(...args) as unknown[]) || [] : [];
  });
}

/**
 * Returns the first slice result that satisfies `isMatch`, or `fallback` when
 * no owner matches. Callers pass already-reversed slices when later slices win.
 */
function firstUiMatch(
  slices: readonly UiSliceLike[],
  name: string,
  args: readonly unknown[],
  isMatch: (result: unknown) => boolean,
  fallback: unknown
): unknown {
  for (const slice of slices) {
    const callback = slice[name];
    if (typeof callback !== 'function') continue;
    const result = (callback as UiCallback)(...args);
    if (isMatch(result)) return result;
  }

  return fallback;
}

/** True when any owning slice's result satisfies `isTrue`. */
function someUiSlice(
  slices: readonly UiSliceLike[],
  name: string,
  args: readonly unknown[],
  isTrue: (result: unknown) => boolean
): boolean {
  return slices.some((slice) => {
    const callback = slice[name];
    return typeof callback === 'function' && isTrue((callback as UiCallback)(...args));
  });
}

/** True unless some owning slice's result fails `isAllowed`. Non-owners pass. */
function everyUiSlice(
  slices: readonly UiSliceLike[],
  name: string,
  args: readonly unknown[],
  isAllowed: (result: unknown) => boolean
): boolean {
  return slices.every((slice) => {
    const callback = slice[name];
    return typeof callback !== 'function' || isAllowed((callback as UiCallback)(...args));
  });
}
