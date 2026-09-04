/**
 * Profession UI composition. Combines Core, active-specialization, and family
 * UI slices without leaking runtime ownership policy into the application.
 */
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionModuleDefinition,
  ProfessionUiContract,
  SchedulerRecord,
  Skill
} from '#gw2/platform/engine/types.js';
import type { NamedModule } from '#gw2/platform/engine/profession/module.js';
import {
  everyUiSlice,
  firstUiMatch,
  mergeUiList,
  someUiSlice
} from '#gw2/platform/engine/profession/ui-combinators.js';

const UI_LIST_CALLBACK_NAMES = Object.freeze([
  'effectPresentations',
  'paletteGroups',
  'resourceViews',
  'skillBarGroups',
  'startControls',
  'targetHealthThresholds',
  'rotationStateSnapshot'
]);
const UI_SINGLE_CALLBACK_NAMES = Object.freeze(['weaponSkillMatchesSet']);

export function singleOwnerValue(
  modules: readonly NamedModule<object>[],
  select: (module: ProfessionModuleDefinition<any>) => unknown,
  label: string
): unknown {
  const owners = modules.filter((entry) => select(entry.module) != null);
  if (owners.length > 1) {
    throw new TypeError(`${label} has multiple owners: ${owners.map((entry) => entry.name).join(', ')}.`);
  }

  return owners.length ? select(owners[0].module) : undefined;
}

export function composeModuleUi(
  modules: readonly NamedModule<object>[],
  familyUi: Partial<ProfessionUiContract> | undefined = undefined
): Partial<ProfessionUiContract> & SchedulerRecord {
  const ui: SchedulerRecord = {};
  const slices = modules.map((entry) => entry.module.ui).filter((slice) => slice != null) as UiSlice[];
  // Only callbacks whose policy gives the active elite precedence use this.
  const reversed = slices.slice().reverse();
  const owns = (name: string): boolean => slices.some((slice) => typeof slice[name] === 'function');

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
    ui[name] = (context: SchedulerRecord, skills: readonly Skill[]) =>
      slices.reduce(
        (current, slice) => (typeof slice[name] === 'function' ? slice[name](context, current) : current),
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

  for (const name of UI_SINGLE_CALLBACK_NAMES) {
    const familyCallback = (familyUi as SchedulerRecord | undefined)?.[name];
    const callback = familyCallback ?? singleOwnerValue(modules, (module) => module.ui?.[name], `ui.${name}`);
    if (callback != null) ui[name] = callback;
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

  return ui;
}

type UiSlice = Partial<ProfessionUiContract> & SchedulerRecord;

export interface ProfessionFamilyUiDefinition {
  readonly catalog: CanonicalCatalog;
  readonly core: UiSlice;
  readonly specializations: Readonly<Record<string, UiSlice>>;
  readonly family?: UiSlice;
}

function uiSpecialization(context: unknown): string {
  if (!context || typeof context !== 'object') return 'Core';
  const candidate = context as SchedulerRecord;
  const config = candidate.config as SchedulerRecord | undefined;
  const build = candidate.build as SchedulerRecord | undefined;
  return String(candidate.specialization || config?.specialization || build?.specialization || 'Core').trim() || 'Core';
}

function explicitUiSpecialization(context: unknown): string | null {
  if (!context || typeof context !== 'object') return null;
  const candidate = context as SchedulerRecord;
  const config = candidate.config as SchedulerRecord | undefined;
  const build = candidate.build as SchedulerRecord | undefined;
  const value = candidate.specialization ?? config?.specialization ?? build?.specialization;
  if (value == null || !String(value).trim()) return null;
  return String(value).trim();
}

function normalizedCoreUiContext(context: unknown): SchedulerRecord {
  if (!context || typeof context !== 'object') {
    return { specialization: 'Core', config: { specialization: 'Core' } };
  }

  const candidate = context as SchedulerRecord;
  return {
    ...candidate,
    specialization: 'Core',
    config: {
      ...((candidate.config as SchedulerRecord | undefined) || {}),
      specialization: 'Core'
    }
  };
}

function deduplicateUiEntries(values: readonly unknown[], callbackName: string): unknown[] {
  const keys = new Set<string>();
  return values.filter((value, index) => {
    if (!value || typeof value !== 'object') return true;
    const candidate = value as SchedulerRecord;
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
          const leftOrder = Number((left.value as SchedulerRecord | null)?.order ?? 0);
          const rightOrder = Number((right.value as SchedulerRecord | null)?.order ?? 0);
          return leftOrder - rightOrder || left.index - right.index;
        })
        .map(({ value }) => value)
    : [...values];
  if (callbackName !== 'paletteGroups') {
    return deduplicateUiEntries(orderedValues, callbackName);
  }

  const groups = orderedValues;
  const anchorIndexes = groups.flatMap((value, index) =>
    value && typeof value === 'object' && (value as SchedulerRecord).resourceAnchor ? [index] : []
  );
  if (anchorIndexes.length > 1) {
    const firstIndex = anchorIndexes[0];
    const lastIndex = anchorIndexes.at(-1) as number;
    const first = groups[firstIndex] as SchedulerRecord;
    const last = groups[lastIndex] as SchedulerRecord;
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
  const active = (context: unknown): { readonly context: SchedulerRecord; readonly slices: UiSlice[] } => {
    const requested = uiSpecialization(context);
    const specialization = definition.specializations[requested];
    if (specialization && eliteNames.has(requested)) {
      return {
        context: context as SchedulerRecord,
        slices: [definition.core, specialization]
      };
    }

    return {
      context: requested === 'Core' ? (context as SchedulerRecord) : normalizedCoreUiContext(context),
      slices: [definition.core]
    };
  };

  const allSlices = [definition.core, ...Object.values(definition.specializations)];
  const scalarSlices = (
    context: unknown,
    skill?: Skill
  ): { readonly context: SchedulerRecord; readonly slices: UiSlice[] } => {
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
        context: context as SchedulerRecord,
        slices: [definition.core, specialization, family]
      };
    }

    return {
      context: context as SchedulerRecord,
      slices: [...allSlices, family]
    };
  };

  const ui: SchedulerRecord = {
    assumptionControls: Object.freeze(
      deduplicateUiEntries(
        [...(family.assumptionControls || []), ...allSlices.flatMap((slice) => slice.assumptionControls || [])],
        'assumptionControls'
      ) as SchedulerRecord[]
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

  ui.eventLogRow = (
    context: SchedulerRecord,
    event: Parameters<NonNullable<ProfessionUiContract['eventLogRow']>>[1]
  ) => {
    const selected = active(context);
    return firstUiMatch(
      [...selected.slices, family],
      'eventLogRow',
      [selected.context, event],
      (result) => result !== undefined,
      undefined
    );
  };

  ui.chargeReleaseProjection = (context: SchedulerRecord) => {
    const selected = scalarSlices(context, context.skill as Skill);
    return firstUiMatch(
      selected.slices,
      'chargeReleaseProjection',
      [selected.context],
      (result) => result !== undefined && result !== null,
      null
    );
  };

  ui.isPaletteSkillInstant = (context: SchedulerRecord, skill: Skill) => {
    const selected = scalarSlices(context, skill);
    return someUiSlice(
      selected.slices,
      'isPaletteSkillInstant',
      [selected.context, skill],
      (result) => result === true
    );
  };

  ui.isSlotSkillSelectable = (context: SchedulerRecord, skill: Skill) => {
    const selected = scalarSlices(context, skill);
    return everyUiSlice(
      selected.slices,
      'isSlotSkillSelectable',
      [selected.context, skill],
      (result) => result !== false
    );
  };

  for (const name of ['paletteActionSkills', 'paletteWeaponSkills'] as const) {
    ui[name] = (context: SchedulerRecord, skills: readonly Skill[]) => {
      const selected = active(context);
      return [...selected.slices, family].reduce(
        (current, slice) => (typeof slice[name] === 'function' ? slice[name](selected.context, current) : current),
        [...skills]
      );
    };
  }

  ui.renderWeaponPalette = (context: SchedulerRecord) => {
    const selected = active(context);
    return firstUiMatch(
      [...selected.slices.slice().reverse(), family],
      'renderWeaponPalette',
      [selected.context],
      (result) => result != null,
      null
    );
  };

  ui.resolvePaletteAction = (
    context: SchedulerRecord,
    action: Parameters<ProfessionUiContract['resolvePaletteAction']>[1]
  ) => {
    const selected = active(context);
    return firstUiMatch(
      [...selected.slices.slice().reverse(), family],
      'resolvePaletteAction',
      [selected.context, action],
      (result) => result !== undefined,
      undefined
    ) as ReturnType<ProfessionUiContract['resolvePaletteAction']>;
  };

  ui.updatePaletteControl = (context: SchedulerRecord, controlId: string) => {
    const selected = active(context);
    return someUiSlice(
      [...selected.slices.slice().reverse(), family],
      'updatePaletteControl',
      [selected.context, controlId],
      (result) => Boolean(result)
    );
  };

  ui.updateSkillBarSelection = (context: SchedulerRecord, selection: SchedulerRecord) => {
    const selected = active(context);
    return someUiSlice(
      [...selected.slices.slice().reverse(), family],
      'updateSkillBarSelection',
      [selected.context, selection],
      (result) => Boolean(result)
    );
  };

  for (const name of ['timelineWeaponLineTransition', 'timelineSkillIcon'] as const) {
    ui[name] = (context: SchedulerRecord) => {
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

  const weaponMatcher =
    family.weaponSkillMatchesSet ||
    singleOwnerValue(
      allSlices.map((slice, index) => ({
        name: index === 0 ? 'Core' : `Specialization ${index}`,
        module: { id: `ui-${index}`, ui: slice }
      })),
      (module) => module.ui?.weaponSkillMatchesSet,
      'ui.weaponSkillMatchesSet'
    );
  if (weaponMatcher != null) ui.weaponSkillMatchesSet = weaponMatcher;
  return Object.freeze(ui) as UiSlice;
}
