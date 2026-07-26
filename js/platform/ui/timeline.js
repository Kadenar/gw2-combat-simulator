export function clearTimelineDropIndicators(root) {
  if (!root) return;
  root.classList.remove(
    "drag-over",
    "drag-over-empty",
    "drag-insert-before",
    "drag-insert-after",
  );
  root
    .querySelectorAll(
      ".drag-over, .drag-over-empty, .drag-insert-before, .drag-insert-after",
    )
    .forEach(element => element.classList.remove(
      "drag-over",
      "drag-over-empty",
      "drag-insert-before",
      "drag-insert-after",
    ));
}

export function formatTimelineCastDetails(step, formatTime) {
  const start = Number(step?.start);
  const end = Number(step?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  const castSeconds = Math.max(0, end - start) / 1000;
  return `Cast: ${formatTime(start)} → ${formatTime(end)}\nCast time: ${castSeconds.toFixed(2)}s`;
}

export function getSkillDropInsertionIndex(skillElement, clientX) {
  const rawIndex = skillElement?.dataset?.idx;
  if (rawIndex == null || String(rawIndex).trim() === "") return null;
  const index = Number(rawIndex);
  if (!Number.isInteger(index)) return null;
  const rect = skillElement.getBoundingClientRect();
  return clientX < rect.left + rect.width / 2 ? index : index + 1;
}

export function updateSkillDropIndicator(skillElement, clientX) {
  skillElement.classList.remove("drag-insert-before", "drag-insert-after");
  const rect = skillElement.getBoundingClientRect();
  skillElement.classList.add(
    clientX < rect.left + rect.width / 2
      ? "drag-insert-before"
      : "drag-insert-after",
  );
}

export function moveRotationEntry(rotation, fromIndex, toIndex) {
  if (
    !Array.isArray(rotation)
    || !Number.isInteger(fromIndex)
    || !Number.isInteger(toIndex)
    || fromIndex < 0
    || fromIndex >= rotation.length
  ) {
    return false;
  }

  const boundedTarget = Math.max(0, Math.min(toIndex, rotation.length));
  const insertAt = fromIndex < boundedTarget ? boundedTarget - 1 : boundedTarget;
  if (insertAt === fromIndex) return false;

  const [entry] = rotation.splice(fromIndex, 1);
  rotation.splice(insertAt, 0, entry);
  return true;
}

export function rotationEntryName(entry) {
  return typeof entry === "string" ? entry : String(entry?.name || "");
}

export function updateRotationEntry(entry, changes = {}) {
  const updated = typeof entry === "string"
    ? { name: entry }
    : { ...(entry || {}) };
  for (const [key, value] of Object.entries(changes || {})) {
    if (key === "name") {
      updated.name = String(value || "");
    } else if (value === undefined) {
      delete updated[key];
    } else {
      updated[key] = value;
    }
  }
  const keys = Object.keys(updated);
  return keys.length === 1 && keys[0] === "name" ? updated.name : updated;
}

export function removeRotationEntryOptions(entry, keys = []) {
  return updateRotationEntry(
    entry,
    Object.fromEntries((keys || []).map(key => [key, undefined])),
  );
}

export function insertRotationEntry(rotation, entry, index) {
  if (
    !Array.isArray(rotation)
    || entry == null
    || !Number.isInteger(index)
  ) {
    return false;
  }
  const boundedIndex = Math.max(0, Math.min(index, rotation.length));
  rotation.splice(boundedIndex, 0, entry);
  return true;
}

export function timelineRows(
  rotation = [],
  { startingWeaponSet = 1, isWeaponSwap = () => false } = {},
) {
  const rows = [{ weaponSet: startingWeaponSet, skills: [] }];
  let weaponSet = startingWeaponSet;
  rotation.forEach((entry, index) => {
    rows.at(-1).skills.push({ entry, index });
    if (!isWeaponSwap(entry)) return;
    weaponSet = weaponSet === 1 ? 2 : 1;
    if (index < rotation.length - 1) rows.push({ weaponSet, skills: [] });
  });
  return rows;
}

export function eventTimelineMarkers(
  result,
  rotationLength,
  predicate = event => event.type === "marker",
) {
  const steps = (result?.steps || [])
    .filter(step => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  return (result?.events || [])
    .filter(predicate)
    .map(event => {
      const start = Math.round(Number(event.at || 0) * 1000);
      const next = steps.find(step => step.start >= start);
      return {
        insertionIndex: next?.ri ?? rotationLength,
        skill: event.name,
        start,
        detail: event.detail,
      };
    })
    .sort((left, right) => left.start - right.start);
}

/**
 * Binds interaction behavior to rendered timeline markup.
 *
 * Expected selectors:
 * - `.rot-skill[data-idx]` with optional `.rot-x`
 * - `.rot-row-skills[data-insert-idx]`
 * - `.rot-offset-badge`, `.rot-interrupt-badge`, `.rot-wait-badge`
 * - `.rot-injected` for non-draggable generated markers
 */
export function bindTimelineInteractions(root, options = {}) {
  if (!root) return;
  const rotation = options.rotation || [];
  const getDragState = options.getDragState || (() => null);
  const setDragState = options.setDragState || (() => {});
  const changed = () => options.onChanged?.();

  const applyDrop = insertAt => {
    const drag = getDragState();
    if (!drag) return false;
    setDragState(null);
    if (drag.source === "timeline") {
      const fromIndex = Number(drag.index ?? drag.idx);
      if (!moveRotationEntry(rotation, fromIndex, insertAt)) return false;
      changed();
      return true;
    }
    if (drag.source === "palette") {
      const name = drag.name ?? drag.skillName;
      const entry = options.resolvePaletteEntry?.(name);
      if (!insertRotationEntry(rotation, entry, insertAt)) return false;
      changed();
      return true;
    }
    return false;
  };

  const cleanup = element => {
    element?.classList?.remove("dragging");
    setDragState(null);
    clearTimelineDropIndicators(root);
  };

  for (const item of root.querySelectorAll?.(
    ".rot-skill[data-idx]:not(.rot-injected)",
  ) || []) {
    const index = Number(item.dataset.idx);
    const remove = item.querySelector?.(".rot-x");
    if (remove) {
      remove.setAttribute("draggable", "false");
      remove.onmousedown = event => {
        event.preventDefault();
        event.stopPropagation();
      };
      remove.ondragstart = event => {
        event.preventDefault();
        event.stopPropagation();
      };
      remove.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        if (!Number.isInteger(index)) return;
        if (event.shiftKey) {
          if (options.onTruncate) options.onTruncate(index);
          else rotation.splice(index);
        } else if (options.onRemove) {
          options.onRemove(index);
        } else {
          rotation.splice(index, 1);
        }
        changed();
      };
    }
    item.ondragstart = event => {
      if (!Number.isInteger(index)) {
        event.preventDefault();
        return;
      }
      setDragState({ source: "timeline", index });
      item.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    };
    item.ondragend = () => cleanup(item);
    item.ondragover = event => {
      if (!getDragState()) return;
      event.preventDefault();
      clearTimelineDropIndicators(root);
      updateSkillDropIndicator(item, event.clientX);
    };
    item.ondragleave = () => {
      item.classList.remove("drag-insert-before", "drag-insert-after");
    };
    item.ondrop = event => {
      if (!getDragState()) return;
      event.preventDefault();
      event.stopPropagation();
      const insertAt = getSkillDropInsertionIndex(item, event.clientX);
      clearTimelineDropIndicators(root);
      if (insertAt != null) applyDrop(insertAt);
    };
  }

  for (const row of root.querySelectorAll?.(
    ".rot-row:not(.rot-procs-row) > .rot-row-skills",
  ) || []) {
    row.ondragover = event => {
      if (!getDragState() || event.target.closest?.(".rot-skill")) return;
      event.preventDefault();
      clearTimelineDropIndicators(root);
      row.classList.add("drag-over");
    };
    row.ondragleave = event => {
      if (event.target === row) row.classList.remove("drag-over");
    };
    row.ondrop = event => {
      if (!getDragState() || event.target.closest?.(".rot-skill")) return;
      event.preventDefault();
      event.stopPropagation();
      const insertAt = Number(row.dataset.insertIdx);
      clearTimelineDropIndicators(root);
      if (Number.isInteger(insertAt)) applyDrop(insertAt);
    };
  }

  root.ondragover = event => {
    if (!getDragState() || event.target.closest?.(".rot-row-skills")) return;
    event.preventDefault();
    clearTimelineDropIndicators(root);
    root.classList.add("drag-over-empty");
  };
  root.ondragleave = event => {
    if (event.target === root) root.classList.remove("drag-over-empty");
  };
  root.ondrop = event => {
    if (!getDragState() || event.target.closest?.(".rot-row-skills")) return;
    event.preventDefault();
    clearTimelineDropIndicators(root);
    applyDrop(rotation.length);
  };

  const bindEdit = (selector, callback) => {
    for (const badge of root.querySelectorAll?.(selector) || []) {
      badge.onclick = event => {
        event.stopPropagation();
        const index = Number(badge.dataset.idx);
        if (!Number.isInteger(index)) return;
        if (callback?.(index, event) !== false) changed();
      };
    }
  };
  bindEdit(".rot-offset-badge", options.onEditOffset);
  bindEdit(".rot-interrupt-badge", options.onEditInterrupt);
  bindEdit(".rot-wait-badge", options.onEditWait);

  return { applyDrop, cleanup };
}
