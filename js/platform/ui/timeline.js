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
