/**
 * Shared model for profession slot skills chosen as fixed packages rather than
 * as independent skills (for example, a Revenant legend and its entire bar).
 *
 * A loadout definition supplies stable entries, the build keys that store the
 * selected and starting entries, and optional specialization restrictions.
 * The resulting model:
 *
 * - normalizes and validates persisted build selections;
 * - exposes selector and bar data for the UI and skill palette;
 * - resolves the active bar from runtime profession state, falling back to the
 *   build's starting entry; and
 * - explains when a skill belongs to a selected but inactive bar.
 *
 * Entry definitions and the returned model are frozen. `normalizeBuild`
 * returns a build patch, while `updateBuild` intentionally mutates the build
 * object supplied by the application state layer.
 *
 * @module profession-slot-loadout
 */

export interface SlotLoadoutEntryInput {
  readonly id: unknown;
  readonly name?: unknown;
  readonly compactName?: unknown;
  readonly icon?: unknown;
  readonly skillIds?: readonly unknown[];
  readonly specialization?: unknown;
}

export interface SlotLoadoutEntry {
  readonly id: string;
  readonly name: string;
  readonly compactName: string;
  readonly icon: string;
  readonly skillIds: readonly number[];
  readonly specialization: string;
}

type BuildRecord = Record<string, unknown>;

export interface SlotLoadoutContext {
  specialization?: string;
  config?: { specialization?: string; [field: string]: unknown };
  build?: BuildRecord;
  professionState?: { activeLoadoutId?: string; [field: string]: unknown };
  state?: {
    profession?: { activeLoadoutId?: string; [field: string]: unknown };
    [field: string]: unknown;
  };
  activeLoadoutId?: string;
  [field: string]: unknown;
}

export interface SlotLoadoutSelectorOption {
  value: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

export interface SlotLoadoutSelector {
  key: string;
  label: string;
  value: string | undefined;
  options: SlotLoadoutSelectorOption[];
}

export interface SlotLoadoutBar {
  id: string;
  label: string;
  compactLabel: string;
  icon: string;
  active: boolean;
  skillIds: number[];
}

export interface SlotLoadoutView {
  id: string;
  label: string;
  selectionControl: string;
  formatActiveBar: boolean;
  selectors: SlotLoadoutSelector[];
  activeBar: SlotLoadoutBar | undefined;
  inactiveBars: SlotLoadoutBar[];
  bars: SlotLoadoutBar[];
}

export interface SlotLoadoutPaletteGroup {
  id: string;
  label: string;
  skillIds: number[];
  reservedSkillIds: number[];
  active: boolean;
  color?: string;
  className?: string;
  resourceAnchor?: boolean;
}

export interface CreateFixedSlotLoadoutOptions {
  id?: string;
  label?: string;
  entryLabel?: string;
  selectionKey?: string;
  startingKey?: string;
  selectionCount?: number;
  selectionControl?: string;
  includeStartingSelector?: boolean;
  formatActiveBar?: boolean;
  entries?: readonly SlotLoadoutEntryInput[];
  defaults?: readonly unknown[];
}

export interface FixedSlotLoadout {
  readonly id: string;
  readonly label: string;
  readonly selectionKey: string;
  readonly startingKey: string;
  readonly entries: readonly SlotLoadoutEntry[];
  normalizeBuild(build: BuildRecord, context?: SlotLoadoutContext): BuildRecord;
  validateBuild(build: BuildRecord, context?: SlotLoadoutContext): string[];
  view(context?: SlotLoadoutContext): SlotLoadoutView;
  updateBuild(build: BuildRecord, selectorKey: string, value: unknown, context?: SlotLoadoutContext): BuildRecord;
  selectedSkillIds(context?: SlotLoadoutContext): number[];
  paletteGroups(context?: SlotLoadoutContext): SlotLoadoutPaletteGroup[];
  unavailableReason(skill: { readonly id: number }, context?: SlotLoadoutContext): string;
}

function stableId(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeOptions(options: { entries?: readonly SlotLoadoutEntryInput[] }): readonly SlotLoadoutEntry[] {
  const entries = (options.entries || []).map((entry) =>
    Object.freeze({
      id: stableId(entry.id),
      name: String(entry.name || entry.id),
      compactName: String(entry.compactName || entry.name || entry.id),
      icon: String(entry.icon || ''),
      skillIds: Object.freeze([...new Set((entry.skillIds || []).map(Number).filter(Number.isFinite))]),
      specialization: String(entry.specialization || '')
    })
  );
  if (entries.length < 2 || entries.some((entry) => !entry.id)) {
    throw new TypeError('A fixed slot loadout requires at least two stable entries.');
  }
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new TypeError('Fixed slot loadout entry ids must be unique.');
  }
  return Object.freeze(entries);
}

function loadoutContext(
  context: SlotLoadoutContext,
  entries: readonly SlotLoadoutEntry[]
): SlotLoadoutContext & {
  specialization: string;
  legal: SlotLoadoutEntry[];
} {
  const specialization = context.specialization || context.config?.specialization || 'Core';
  const legal = entries.filter((entry) => !entry.specialization || entry.specialization === specialization);
  return { ...context, specialization, legal };
}

/**
 * Creates the shared fixed-bar loadout model used by professions whose slot
 * skills are selected as packages rather than five independent dropdowns.
 */
export function createFixedSlotLoadout({
  id = 'fixed-slot-loadout',
  label = 'Loadout',
  entryLabel = 'Bar',
  selectionKey: selectionKeyOption,
  startingKey: startingKeyOption,
  selectionCount = 2,
  selectionControl = 'select',
  includeStartingSelector = true,
  formatActiveBar = true,
  entries: rawEntries,
  defaults
}: CreateFixedSlotLoadoutOptions = {}): FixedSlotLoadout {
  if (!selectionKeyOption || !startingKeyOption || selectionCount < 1) {
    throw new TypeError('Fixed slot loadouts require selectionKey, startingKey, and selectionCount.');
  }
  // Capture the validated keys as `const` so their narrowed `string` type
  // survives into the closures below (destructured params do not).
  const selectionKey: string = selectionKeyOption;
  const startingKey: string = startingKeyOption;
  const entries = normalizeOptions({ entries: rawEntries });
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const defaultIds = (defaults || entries.map((entry) => entry.id))
    .map(stableId)
    .filter((entryId) => byId.has(entryId))
    .slice(0, selectionCount);
  if (defaultIds.length !== selectionCount) {
    throw new TypeError('Fixed slot loadout defaults must fill every selection.');
  }

  function legalEntries(context: SlotLoadoutContext = {}): SlotLoadoutEntry[] {
    return loadoutContext(context, entries).legal;
  }

  function normalizedSelection(build: BuildRecord | undefined, context: SlotLoadoutContext = {}): string[] {
    const legal = legalEntries(context);
    const legalIds = new Set(legal.map((entry) => entry.id));
    const rawRequested = build?.[selectionKey];
    const requested = Array.isArray(rawRequested) ? rawRequested.map(stableId) : [];
    const fallback = [...defaultIds.filter((entryId) => legalIds.has(entryId)), ...legal.map((entry) => entry.id)];
    const selected: string[] = [];
    for (const candidate of [...requested, ...fallback]) {
      if (legalIds.has(candidate) && !selected.includes(candidate) && selected.length < selectionCount)
        selected.push(candidate);
    }
    return selected;
  }

  function normalizeBuild(build: BuildRecord, context: SlotLoadoutContext = {}): BuildRecord {
    const selected = normalizedSelection(build, context);
    const requestedStart = stableId(build?.[startingKey]);
    return {
      [selectionKey]: selected,
      [startingKey]: selected.includes(requestedStart) ? requestedStart : selected[0]
    };
  }

  function validateBuild(build: BuildRecord, context: SlotLoadoutContext = {}): string[] {
    const errors: string[] = [];
    const rawSelected = build?.[selectionKey];
    const selected = Array.isArray(rawSelected) ? rawSelected.map(stableId) : [];
    const legalIds = new Set(legalEntries(context).map((entry) => entry.id));
    if (
      selected.length !== selectionCount ||
      new Set(selected).size !== selectionCount ||
      selected.some((value) => !legalIds.has(value))
    ) {
      errors.push(`${selectionKey} must contain ${selectionCount} distinct legal ${entryLabel.toLowerCase()} ids.`);
    }
    if (!selected.includes(stableId(build?.[startingKey]))) {
      errors.push(`${startingKey} must be included in ${selectionKey}.`);
    }
    return errors;
  }

  function activeId(context: SlotLoadoutContext, selected: string[]): string {
    const runtimeId = stableId(
      context.professionState?.activeLoadoutId ?? context.state?.profession?.activeLoadoutId ?? context.activeLoadoutId
    );
    return selected.includes(runtimeId) ? runtimeId : stableId(context.build?.[startingKey] || selected[0]);
  }

  function view(context: SlotLoadoutContext = {}): SlotLoadoutView {
    const build = context.build || {};
    const selected = normalizedSelection(build, context);
    const active = activeId(context, selected);
    const legal = legalEntries(context);
    const options: SlotLoadoutSelectorOption[] = legal.map((entry) => ({
      value: entry.id,
      label: entry.name,
      icon: entry.icon
    }));
    const selectors: SlotLoadoutSelector[] = Array.from({ length: selectionCount }, (_, index) => ({
      key: `${selectionKey}:${index}`,
      label: `${entryLabel} ${index + 1}`,
      value: selected[index],
      options: options.map((option) => ({
        ...option,
        disabled: selected.includes(option.value) && option.value !== selected[index]
      }))
    }));
    if (includeStartingSelector) {
      selectors.push({
        key: startingKey,
        label: `Starting ${entryLabel}`,
        value: stableId(build[startingKey] || selected[0]),
        options: selected.map((value) => ({
          value,
          label: byId.get(value)?.name || value,
          icon: byId.get(value)?.icon || ''
        }))
      });
    }
    const bars: SlotLoadoutBar[] = selected.map((value) => {
      const entry = byId.get(value);
      return {
        id: value,
        label: entry?.name || value,
        compactLabel: entry?.compactName || entry?.name || value,
        icon: entry?.icon || '',
        active: value === active,
        skillIds: [...(entry?.skillIds || [])]
      };
    });
    return {
      id,
      label,
      selectionControl,
      formatActiveBar,
      selectors,
      activeBar: bars.find((bar) => bar.active) || bars[0],
      inactiveBars: bars.filter((bar) => !bar.active),
      bars
    };
  }

  function updateBuild(
    build: BuildRecord,
    selectorKey: string,
    value: unknown,
    context: SlotLoadoutContext = {}
  ): BuildRecord {
    const selected = normalizedSelection(build, context);
    if (selectorKey.startsWith(`${selectionKey}:`)) {
      const index = Number(selectorKey.split(':').at(-1));
      const next = stableId(value);
      const legalIds = new Set(legalEntries(context).map((entry) => entry.id));
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < selectionCount &&
        legalIds.has(next) &&
        !selected.some((entryId, selectedIndex) => entryId === next && selectedIndex !== index)
      ) {
        selected[index] = next;
        build[selectionKey] = selected;
        if (!selected.includes(stableId(build[startingKey]))) {
          build[startingKey] = selected[0];
        }
      }
    } else if (selectorKey === startingKey && selected.includes(stableId(value))) {
      build[startingKey] = stableId(value);
    }
    return build;
  }

  function selectedSkillIds(context: SlotLoadoutContext = {}): number[] {
    return view(context).activeBar?.skillIds || [];
  }

  function paletteGroups(context: SlotLoadoutContext = {}): SlotLoadoutPaletteGroup[] {
    return view(context).bars.map((bar) => ({
      id: `${id}:${bar.id}`,
      label: bar.compactLabel,
      skillIds: [...bar.skillIds],
      reservedSkillIds: [],
      active: bar.active
    }));
  }

  function unavailableReason(skill: { readonly id: number }, context: SlotLoadoutContext = {}): string {
    const current = view(context);
    const active = new Set(current.activeBar?.skillIds || []);
    if (active.has(skill.id)) return '';
    const owner = current.inactiveBars.find((bar) => bar.skillIds.includes(skill.id));
    return owner ? `Swap to ${owner.label} to use this skill` : '';
  }

  return Object.freeze({
    id,
    label,
    selectionKey,
    startingKey,
    entries,
    normalizeBuild,
    validateBuild,
    view,
    updateBuild,
    selectedSkillIds,
    paletteGroups,
    unavailableReason
  });
}
