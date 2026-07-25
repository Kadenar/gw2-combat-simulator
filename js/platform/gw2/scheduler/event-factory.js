import {
  gw2ActorTypeForSource,
} from "../event-ownership.js";

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
  emit = null,
  defaultSource = "System",
  onConditionScheduled = () => {},
  onDamageScheduled = () => {},
  decorateDamageEvent = event => event,
}) {
  const addEvent = event => {
    const normalized = {
      source: event.source || defaultSource,
      sourceId:
        event.sourceId
        ?? event.skillId
        ?? event.skillName
        ?? event.name
        ?? event.type,
      ...event,
    };
    if (normalized.at <= horizon + epsilon) {
      if (emit) return emit(normalized);
      events.push(normalized);
    }
    return normalized;
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
    const actorType =
      extra.actorType
      || gw2ActorTypeForSource(source);
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
      actorType,
      skillId: extra.skillId ?? null,
      ...extra,
    });
    if (!event) return null;
    onConditionScheduled(event, {
      activeWeaponSet: activeWeaponSet(),
    });
    return event;
  };

  const addDamage = (skill, at, group, extra = {}) => {
    const hits = Math.max(1, Math.trunc(Number(group.hits || 1)));
    const coefficient = Number(group.coefficient || 0) / hits;
    const source = group.source || extra.source || "Player";
    const actorType =
      group.actorType
      || extra.actorType
      || gw2ActorTypeForSource(source);
    const slotSkill = (
      skill.type === "Heal"
      || skill.type === "Utility"
      || skill.type === "Elite"
    );
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
        source,
        sourceId: extra.sourceId ?? skill.id ?? skill.name,
        actorType,
        skillId: extra.skillId ?? skill.id ?? null,
        weapon: group.weapon || "",
        weaponStrength: group.weaponStrength,
        skillWeapon:
          skill.weapon
          || (slotSkill ? "Utility" : activePrimaryWeapon()),
        ...extra,
      }, { skill, group, extra }));
      if (!event) continue;
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
