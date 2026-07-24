/**
 * Creates the standard damage, condition, proc, and timeline events emitted by
 * GW2 profession schedulers. Profession reactions observe emitted damage and
 * conditions without owning their common event representation.
 */
export function createGw2SchedulerEventFactory({
  events,
  horizon,
  epsilon,
  conditionName,
  conditionFormulas,
  activePrimaryWeapon,
  activeWeaponSet,
  onConditionScheduled = () => {},
  onDamageScheduled = () => {},
  decorateDamageEvent = event => event,
}) {
  const addEvent = event => {
    if (event.at <= horizon + epsilon) events.push(event);
    return event;
  };

  const addTraitProc = (
    name,
    at,
    sourceSkill = "",
    detail = "",
  ) => addEvent({
    type: "proc",
    procType: "trait",
    at,
    name,
    sourceSkill,
    source: "Trait",
    sourceId: name,
    detail,
  });

  const addCondition = (
    skillName,
    at,
    condition,
    source = "Player",
    label = "",
    extra = {},
  ) => {
    const name = conditionName(condition.name);
    if (!conditionFormulas[name] || !condition.duration) return null;
    const event = addEvent({
      type: "condition",
      at,
      skillName,
      name: label || `${skillName} — ${name}`,
      condition: name,
      duration: Number(condition.duration),
      stacks: Number(condition.stacks || 1),
      source,
      sourceId: extra.sourceId ?? skillName,
      ...extra,
    });
    onConditionScheduled(event, {
      activeWeaponSet: activeWeaponSet(),
    });
    return event;
  };

  const addDamage = (skill, at, group, extra = {}) => {
    const hits = Math.max(1, Math.trunc(Number(group.hits || 1)));
    const coefficient = Number(group.coefficient || 0) / hits;
    for (let index = 0; index < hits; index += 1) {
      const event = addEvent(decorateDamageEvent({
        type: "damage",
        at,
        name: extra.name || skill.name,
        skillName: skill.name,
        coefficient,
        hits: 1,
        hitIndex: index + 1,
        totalHits: hits,
        source: group.source || extra.source || "Player",
        sourceId: extra.sourceId ?? skill.id ?? skill.name,
        weapon: group.weapon || "",
        weaponStrength: group.weaponStrength,
        skillWeapon: skill.weapon || activePrimaryWeapon(),
        ...extra,
      }, { skill, group, extra }));
      onDamageScheduled(event, {
        activeWeaponSet: activeWeaponSet(),
      });
    }
  };

  return Object.freeze({
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
  });
}
