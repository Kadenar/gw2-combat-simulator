function stableId(value) {
  return String(value ?? "").trim();
}

function normalizeOptions(options) {
  const entries = (options.entries || []).map(entry => Object.freeze({
    id: stableId(entry.id),
    name: String(entry.name || entry.id),
    icon: String(entry.icon || ""),
    skillIds: Object.freeze(
      [...new Set((entry.skillIds || []).map(Number).filter(Number.isFinite))],
    ),
    specialization: String(entry.specialization || ""),
  }));
  if (entries.length < 2 || entries.some(entry => !entry.id)) {
    throw new TypeError("A fixed slot loadout requires at least two stable entries.");
  }
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) {
    throw new TypeError("Fixed slot loadout entry ids must be unique.");
  }
  return Object.freeze(entries);
}

function loadoutContext(context, entries) {
  const specialization =
    context.specialization
    || context.config?.specialization
    || "Core";
  const legal = entries.filter(entry =>
    !entry.specialization || entry.specialization === specialization);
  return { ...context, specialization, legal };
}

/**
 * Creates the shared fixed-bar loadout model used by professions whose slot
 * skills are selected as packages rather than five independent dropdowns.
 */
export function createFixedSlotLoadout({
  id = "fixed-slot-loadout",
  label = "Loadout",
  entryLabel = "Bar",
  selectionKey,
  startingKey,
  selectionCount = 2,
  entries: rawEntries,
  defaults,
} = {}) {
  if (!selectionKey || !startingKey || selectionCount < 1) {
    throw new TypeError(
      "Fixed slot loadouts require selectionKey, startingKey, and selectionCount.",
    );
  }
  const entries = normalizeOptions({ entries: rawEntries });
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const defaultIds = (defaults || entries.map(entry => entry.id))
    .map(stableId)
    .filter(id => byId.has(id))
    .slice(0, selectionCount);
  if (defaultIds.length !== selectionCount) {
    throw new TypeError("Fixed slot loadout defaults must fill every selection.");
  }

  function legalEntries(context = {}) {
    return loadoutContext(context, entries).legal;
  }

  function normalizedSelection(build, context = {}) {
    const legal = legalEntries(context);
    const legalIds = new Set(legal.map(entry => entry.id));
    const requested = Array.isArray(build?.[selectionKey])
      ? build[selectionKey].map(stableId)
      : [];
    const fallback = [
      ...defaultIds.filter(id => legalIds.has(id)),
      ...legal.map(entry => entry.id),
    ];
    const selected = [];
    for (const candidate of [...requested, ...fallback]) {
      if (
        legalIds.has(candidate)
        && !selected.includes(candidate)
        && selected.length < selectionCount
      ) selected.push(candidate);
    }
    return selected;
  }

  function normalizeBuild(build, context = {}) {
    const selected = normalizedSelection(build, context);
    const requestedStart = stableId(build?.[startingKey]);
    return {
      [selectionKey]: selected,
      [startingKey]: selected.includes(requestedStart)
        ? requestedStart
        : selected[0],
    };
  }

  function validateBuild(build, context = {}) {
    const errors = [];
    const selected = Array.isArray(build?.[selectionKey])
      ? build[selectionKey].map(stableId)
      : [];
    const legalIds = new Set(legalEntries(context).map(entry => entry.id));
    if (
      selected.length !== selectionCount
      || new Set(selected).size !== selectionCount
      || selected.some(value => !legalIds.has(value))
    ) {
      errors.push(
        `${selectionKey} must contain ${selectionCount} distinct legal ${entryLabel.toLowerCase()} ids.`,
      );
    }
    if (!selected.includes(stableId(build?.[startingKey]))) {
      errors.push(`${startingKey} must be included in ${selectionKey}.`);
    }
    return errors;
  }

  function activeId(context, selected) {
    const runtimeId = stableId(
      context.professionState?.activeLoadoutId
      ?? context.state?.profession?.activeLoadoutId
      ?? context.activeLoadoutId,
    );
    return selected.includes(runtimeId)
      ? runtimeId
      : stableId(context.build?.[startingKey] || selected[0]);
  }

  function view(context = {}) {
    const build = context.build || {};
    const selected = normalizedSelection(build, context);
    const active = activeId(context, selected);
    const legal = legalEntries(context);
    const options = legal.map(entry => ({
      value: entry.id,
      label: entry.name,
      icon: entry.icon,
    }));
    const selectors = Array.from({ length: selectionCount }, (_, index) => ({
      key: `${selectionKey}:${index}`,
      label: `${entryLabel} ${index + 1}`,
      value: selected[index],
      options: options.map(option => ({
        ...option,
        disabled:
          selected.includes(option.value)
          && option.value !== selected[index],
      })),
    }));
    selectors.push({
      key: startingKey,
      label: `Starting ${entryLabel}`,
      value: stableId(build[startingKey] || selected[0]),
      options: selected.map(value => ({
        value,
        label: byId.get(value)?.name || value,
        icon: byId.get(value)?.icon || "",
      })),
    });
    const bars = selected.map(value => {
      const entry = byId.get(value);
      return {
        id: value,
        label: entry?.name || value,
        active: value === active,
        skillIds: [...(entry?.skillIds || [])],
      };
    });
    return {
      id,
      label,
      selectors,
      activeBar: bars.find(bar => bar.active) || bars[0],
      inactiveBars: bars.filter(bar => !bar.active),
      bars,
    };
  }

  function updateBuild(build, selectorKey, value, context = {}) {
    const selected = normalizedSelection(build, context);
    if (selectorKey.startsWith(`${selectionKey}:`)) {
      const index = Number(selectorKey.split(":").at(-1));
      const next = stableId(value);
      const legalIds = new Set(legalEntries(context).map(entry => entry.id));
      if (
        Number.isInteger(index)
        && index >= 0
        && index < selectionCount
        && legalIds.has(next)
        && !selected.some((id, selectedIndex) =>
          id === next && selectedIndex !== index)
      ) {
        selected[index] = next;
        build[selectionKey] = selected;
        if (!selected.includes(stableId(build[startingKey]))) {
          build[startingKey] = selected[0];
        }
      }
    } else if (
      selectorKey === startingKey
      && selected.includes(stableId(value))
    ) {
      build[startingKey] = stableId(value);
    }
    return build;
  }

  function selectedSkillIds(context = {}) {
    return view(context).activeBar?.skillIds || [];
  }

  function paletteGroups(context = {}) {
    return view(context).bars.map(bar => ({
      id: `${id}:${bar.id}`,
      label: bar.label,
      skillIds: [...bar.skillIds],
      active: bar.active,
    }));
  }

  function unavailableReason(skill, context = {}) {
    const current = view(context);
    const active = new Set(current.activeBar?.skillIds || []);
    if (active.has(skill.id)) return "";
    const owner = current.inactiveBars.find(bar => bar.skillIds.includes(skill.id));
    return owner ? `Swap to ${owner.label} to use this skill` : "";
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
    unavailableReason,
  });
}

