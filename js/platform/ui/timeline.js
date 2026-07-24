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

export function getSkillDropInsertionIndex(skillElement, clientX) {
  const index = Number(skillElement?.dataset?.idx);
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
    || !Number.isFinite(toIndex)
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
