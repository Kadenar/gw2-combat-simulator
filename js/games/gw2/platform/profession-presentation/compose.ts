/**
 * Combines Core, active-specialization, and family UI callbacks.
 * Runtime ownership rules remain in profession runtime composition.
 */
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { EndurancePolicy, ResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ProfessionConfig } from '#gw2/platform/profession-definition/types.js';
import type {
  PaletteOverride,
  ProfessionPaletteGroup,
  ProfessionResourceViewContext,
  ProfessionUiContract
} from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';

type UiCallbackName = {
  [K in keyof ProfessionUiContract]-?: NonNullable<ProfessionUiContract[K]> extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof ProfessionUiContract];
type UiCallback<K extends UiCallbackName> = NonNullable<ProfessionUiContract[K]>;
type UiListCallbackName = {
  [K in UiCallbackName]: Parameters<UiCallback<K>> extends [unknown]
    ? ReturnType<UiCallback<K>> extends unknown[]
      ? K
      : never
    : never;
}[UiCallbackName];

/** Selection fields composition reads from an arbitrary callback context before choosing slices. */
interface UiSelectionCandidate {
  readonly catalog?: CanonicalCatalog;
  readonly specialization?: unknown;
  readonly config?: { readonly specialization?: unknown } | null;
}

type UiSlice = Partial<ProfessionUiContract>;

interface ProfessionFamilyUiDefinition {
  readonly professionId: string;
  readonly resourcesFor?: (specialization: string) => ResourcePolicies & { readonly endurance?: EndurancePolicy };
  readonly catalog: CanonicalCatalog;
  readonly core: UiSlice;
  readonly specializations: Readonly<Record<string, UiSlice>>;
  readonly family?: UiSlice;
}

/** Presentation receives the specialization derived from canonical build selections through context or config. */
export function uiSpecialization(context: unknown): string {
  if (!context || typeof context !== 'object') return 'Core';

  const candidate = context as UiSelectionCandidate;
  const config = candidate.config;
  return String(candidate.specialization || config?.specialization || 'Core').trim() || 'Core';
}

function explicitUiSpecialization(context: unknown): string | null {
  if (!context || typeof context !== 'object') return null;

  const candidate = context as UiSelectionCandidate;
  const config = candidate.config;
  const value = candidate.specialization ?? config?.specialization;

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
  // Assumptions and preview inputs share key-based identity; conflicting owners must fail before values are saved.
  const field = callbackName === 'previewControls' || callbackName === 'assumptionControls' ? 'key' : 'id';
  // Validate identity without filtering: every entry survives unless a duplicate is rejected.
  for (const [index, value] of values.entries()) {
    if (!value || typeof value !== 'object') continue;

    const candidate = value as { readonly id?: unknown; readonly key?: unknown };
    const identity = candidate[field];
    const key = identity == null ? '' : String(identity);

    if (!key) continue;

    if (keys.has(key)) {
      throw new TypeError(`ui.${callbackName} returned duplicate ${field} ${key} at index ${index}.`);
    }

    keys.add(key);
  }

  return [...values];
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
 * Composes the application UI from Core, the selected elite, and family callbacks.
 * Unknown elite names and Core trait-line names use the Core UI. Runtime resolution rejects unknown elites.
 */
export function createProfessionFamilyUi(
  definition: ProfessionFamilyUiDefinition
): Readonly<Required<ProfessionUiContract>> {
  const family = definition.family || {};
  const eliteNames = new Set(
    definition.catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name)
  );
  const active = <T>(context: T): { readonly context: T; readonly slices: UiSlice[] } => {
    const requested = uiSpecialization(context);
    const specialization = definition.specializations[requested];

    if (specialization && eliteNames.has(requested)) {
      return {
        context,
        slices: [definition.core, specialization]
      };
    }

    return {
      context: requested === 'Core' ? context : (normalizedCoreUiContext(context) as T),
      slices: [definition.core]
    };
  };

  const allSlices = [definition.core, ...Object.values(definition.specializations)];
  const scalarSlices = <T>(context: T, skill?: Skill): { readonly context: T; readonly slices: UiSlice[] } => {
    if (explicitUiSpecialization(context)) {
      const selected = active(context);
      return {
        context: selected.context,
        slices: [...selected.slices, family]
      };
    }

    const skillSpecialization = (skill?.specialization || '').trim();
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

  // List selection, identity checks, and ordering share one path; each callback is registered in the complete contract below.
  const list =
    <K extends UiListCallbackName>(name: K) =>
    (context: Parameters<UiCallback<K>>[0]): ReturnType<UiCallback<K>> => {
      const selected = active(context);
      // Preview capacity uses selected policies and the active catalog without starting gameplay tasks.
      const policies =
        name === 'resourceViews' ? definition.resourcesFor?.(uiSpecialization(selected.context)) : undefined;
      const resourceContext = selected.context as ProfessionResourceViewContext;
      const callbackContext = policies
        ? {
            ...selected.context,
            resources: Object.fromEntries(
              Object.entries(policies)
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Optional policies may be explicitly undefined in authored module objects.
                .filter(([, policy]) => policy != null)
                .map(([key, policy]) => [
                  key,
                  {
                    maximum: policy.maximum({
                      ...selected.context,
                      config: ((selected.context as UiSelectionCandidate).config ??
                        selected.context) as ProfessionConfig,
                      helpers: resourceContext.catalog
                    } as never)
                  }
                ])
            )
          }
        : selected.context;
      // The key ties this argument tuple and the normalized entries to the callback's declared list type.
      const args = [callbackContext] as Parameters<UiCallback<K>>;
      const values = [...selected.slices, family].flatMap<unknown>((slice) => callUiSlice(slice, name, args) || []);
      return normalizeApplicationUiList(values, name) as ReturnType<UiCallback<K>>;
    };

  const transform =
    <K extends 'paletteActionSkills' | 'paletteWeaponSkills' | 'paletteSelectedSlotSkills'>(
      name: K
    ): ProfessionUiContract[K] =>
    (context, skills) => {
      const selected = active(context);
      return [...selected.slices, family].reduce(
        (current, slice) => {
          const project = slice[name];
          return typeof project === 'function' ? project(selected.context, current) : current;
        },
        [...skills]
      );
    };

  const loadoutOwners = [family, ...allSlices].filter((slice) => slice.slotLoadout != null);

  if (loadoutOwners.length > 1) throw new TypeError('ui.slotLoadout has multiple application owners.');

  // This object owns composition and defaults together. Required also checks optional contract members so new callbacks cannot be silently omitted.
  const ui: Required<ProfessionUiContract> = {
    previewControls: list('previewControls'),
    skillDamageGroups: list('skillDamageGroups'),
    chartApplications: list('chartApplications'),
    timelineMarkers: list('timelineMarkers'),
    timelineOverlays: list('timelineOverlays'),
    effectPresentations: list('effectPresentations'),
    paletteGroups: list('paletteGroups'),
    resourceViews: list('resourceViews'),
    skillBarGroups: list('skillBarGroups'),
    startControls: list('startControls'),
    targetHealthThresholds: list('targetHealthThresholds'),
    rotationStateSnapshot: list('rotationStateSnapshot'),
    assumptionControls: Object.freeze(
      deduplicateUiEntries(
        [...(family.assumptionControls || []), ...allSlices.flatMap((slice) => slice.assumptionControls || [])],
        'assumptionControls'
      ) as ProfessionAssumptionControl[]
    ),
    slotLoadout: loadoutOwners[0]?.slotLoadout ?? null,

    // Prepare only Core, the active elite, and family preview state, in the same order as their controls.
    prepareAttributePreview(context) {
      const selected = active(context);
      for (const slice of [...selected.slices, family]) slice.prepareAttributePreview?.(selected.context);
    },
    // Later slices refine the runtime fields seeded by earlier preview owners.
    prepareSkillDamagePreview(context) {
      const selected = active(context);
      return Object.assign(
        {},
        ...[...selected.slices, family].map((slice) => slice.prepareSkillDamagePreview?.(selected.context))
      );
    },
    // The elite owns its mechanics' setup, so it answers before Core; family answers last.
    skillDamageState(context, skill) {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'skillDamageState',
        [selected.context, skill],
        (result) => result != null,
        null
      );
    },
    paletteOverride(context, skill) {
      const selected = scalarSlices(context, skill);
      // Later owners refine independent fields before the completed override is validated.
      return normalizePaletteOverride(
        Object.assign({}, ...selected.slices.map((slice) => slice.paletteOverride?.(selected.context, skill))),
        definition.professionId
      );
    },
    eventLogRow(context, event) {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices, family],
        'eventLogRow',
        [selected.context, event],
        (result) => result !== undefined,
        undefined
      );
    },
    isPaletteSkillInstant(context, skill) {
      const selected = scalarSlices(context, skill);
      return selected.slices.some(
        (slice) => callUiSlice(slice, 'isPaletteSkillInstant', [selected.context, skill]) === true
      );
    },
    isSlotSkillSelectable(context, skill) {
      const selected = scalarSlices(context, skill);
      // Only an explicit rejection from an owning slice disables selection.
      return selected.slices.every(
        (slice) => callUiSlice(slice, 'isSlotSkillSelectable', [selected.context, skill]) !== false
      );
    },
    paletteActionSkills: transform('paletteActionSkills'),
    paletteWeaponSkills: transform('paletteWeaponSkills'),
    paletteSelectedSlotSkills: transform('paletteSelectedSlotSkills'),
    projectWeaponPalette(context) {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'projectWeaponPalette',
        [selected.context],
        (result) => result != null,
        null
      );
    },
    timelineAnnotation(context) {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'timelineAnnotation',
        [selected.context],
        (result) => result != null,
        null
      );
    },
    timelineOccupiedInterval(context) {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'timelineOccupiedInterval',
        [selected.context],
        (result) => result != null,
        null
      );
    },
    paletteWeaponGroups(context, skills) {
      const selected = active(context);
      // Null retains an unlabelled bar; only undefined defers to another owner.
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'paletteWeaponGroups',
        [selected.context, skills],
        (result) => result !== undefined,
        null
      );
    },
    castEditor(context, skill) {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'castEditor',
        [selected.context, skill],
        (result) => result != null,
        null
      );
    },
    resolvePaletteAction(context, action) {
      const selected = active(context);
      // Null means handled without insertion, while undefined lets another owner resolve the action.
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'resolvePaletteAction',
        [selected.context, action],
        (result) => result !== undefined,
        undefined
      );
    },
    updatePaletteControl(context, controlId) {
      const selected = active(context);
      return [...selected.slices.reverse(), family].some((slice) =>
        Boolean(callUiSlice(slice, 'updatePaletteControl', [selected.context, controlId]))
      );
    },
    updateSkillBarSelection(context, selection) {
      const selected = active(context);
      return [...selected.slices.reverse(), family].some((slice) =>
        Boolean(callUiSlice(slice, 'updateSkillBarSelection', [selected.context, selection]))
      );
    },
    timelineWeaponLineTransition(context) {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'timelineWeaponLineTransition',
        [selected.context],
        (result) => result !== undefined && result !== '',
        undefined
      );
    },
    timelineSkillIcon(context) {
      const selected = active(context);
      return firstUiMatch(
        [...selected.slices.reverse(), family],
        'timelineSkillIcon',
        [selected.context],
        (result) => result !== undefined && result !== '',
        ''
      );
    }
  };
  return Object.freeze(ui);
}

/** The key preserves the relationship between a callback's arguments and result during dynamic dispatch. */
function callUiSlice<K extends UiCallbackName>(
  slice: UiSlice,
  name: K,
  args: Parameters<UiCallback<K>>
): ReturnType<UiCallback<K>> | undefined {
  const callback = slice[name] as ((...args: Parameters<UiCallback<K>>) => ReturnType<UiCallback<K>>) | undefined;
  return typeof callback === 'function' ? callback(...args) : undefined;
}

/** Selection order and acceptance of null or undefined belong to the callback, not the dispatch helper. */
function firstUiMatch<K extends UiCallbackName>(
  slices: readonly UiSlice[],
  name: K,
  args: Parameters<UiCallback<K>>,
  isMatch: (result: ReturnType<UiCallback<K>> | undefined) => boolean,
  fallback: ReturnType<UiCallback<K>>
): ReturnType<UiCallback<K>> {
  for (const slice of slices) {
    if (typeof slice[name] !== 'function') continue;

    const result = callUiSlice(slice, name, args);

    if (isMatch(result)) return result as ReturnType<UiCallback<K>>;
  }

  return fallback;
}

/** Validate narrow presentation exceptions without inventing a runtime verdict. */
function normalizePaletteOverride(value: unknown, professionId: string): PaletteOverride | undefined {
  if (value === undefined) return undefined;

  if (!value || typeof value !== 'object')
    throw new TypeError(`${professionId} paletteOverride must return an object.`);

  const result = value as UnvalidatedFields;
  for (const key of ['available', 'tileActive', 'editorAccess']) {
    if (result[key] != null && typeof result[key] !== 'boolean')
      throw new TypeError(`${professionId} paletteOverride.${key} must be boolean.`);
  }

  return {
    ...(result.available == null ? {} : { available: result.available as boolean }),
    ...(result.tileActive == null ? {} : { tileActive: result.tileActive as boolean }),
    ...(result.editorAccess == null ? {} : { editorAccess: result.editorAccess as boolean }),
    ...(result.message == null ? {} : { message: String(result.message) })
  };
}
