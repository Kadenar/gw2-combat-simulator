import { gw2ActorTypeForSource } from "../event-ownership.js";

import type {
  SimulationActorType,
  SimulationEvent,
  SimulationEventInput,
  Skill,
} from "../../engine/types.js";
import type {
  Gw2ConditionApplication,
  Gw2DamageGroup,
  Gw2EventExtra,
  Gw2SchedulerEventDraft,
  Gw2SchedulerEventFactory,
} from "../types.js";

interface Gw2SchedulerEventFactoryOptions {
  readonly events: Array<SimulationEvent | SimulationEventInput>;
  readonly horizon: number;
  readonly epsilon: number;
  readonly conditionName: (value: unknown) => string;
  readonly conditionFormulas: Readonly<Record<string, unknown>>;
  readonly activePrimaryWeapon: () => string;
  readonly activeWeaponSet: () => number;
  readonly emit?:
    | ((event: SimulationEventInput) => SimulationEvent | null)
    | null;
  readonly defaultSource?: string;
  readonly onConditionScheduled?: (
    event: SimulationEvent | SimulationEventInput,
    details: { readonly activeWeaponSet: number },
  ) => unknown;
  readonly onDamageScheduled?: (
    event: SimulationEvent | SimulationEventInput,
    details: { readonly activeWeaponSet: number },
  ) => unknown;
  readonly decorateDamageEvent?: (
    event: SimulationEventInput,
    details: {
      readonly skill: Skill;
      readonly group: Gw2DamageGroup;
      readonly extra: Gw2EventExtra;
    },
  ) => SimulationEventInput;
}

/**
 * Creates the standard damage, condition, proc, and timeline events emitted by
 * GW2 profession schedulers. Profession reactions observe emitted damage and
 * conditions without owning their common event representation.
 *
 * @param {Gw2SchedulerEventFactoryOptions} options
 * @returns {Readonly<Gw2SchedulerEventFactory>}
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
  decorateDamageEvent = (event) => event,
}: Gw2SchedulerEventFactoryOptions): Readonly<Gw2SchedulerEventFactory> {
  const addEvent = (
    event: Gw2SchedulerEventDraft,
  ): SimulationEvent | SimulationEventInput | null => {
    const normalized: SimulationEventInput = {
      source: event.source || defaultSource,
      sourceId:
        event.sourceId ??
        event.skillId ??
        event.skillName ??
        event.name ??
        event.type,
      ...event,
    };
    if (normalized.at <= horizon + epsilon) {
      if (emit) return emit(normalized);
      events.push(normalized);
    }
    return normalized;
  };

  /**
   * @param {string} name
   * @param {number} at
   * @param {string} [sourceSkill]
   * @param {string} [detail]
   */
  const addTraitProc = (
    name: string,
    at: number,
    sourceSkill = "",
    detail = "",
  ): SimulationEvent | SimulationEventInput | null =>
    addEvent({
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
    skillName: string,
    at: number,
    condition: Gw2ConditionApplication,
    source = "Player",
    label = "",
    extra: Gw2EventExtra = {},
  ): SimulationEvent | SimulationEventInput | null => {
    const name = conditionName(condition.name);
    if (!conditionFormulas[name] || !condition.duration) return null;
    const actorType: SimulationActorType =
      extra.actorType || gw2ActorTypeForSource(source);
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

  /**
   * @param {Skill} skill
   * @param {number} at
   * @param {Gw2DamageGroup} group
   * @param {Gw2EventExtra} [extra]
   */
  const addDamage = (
    skill: Skill,
    at: number,
    group: Gw2DamageGroup,
    extra: Gw2EventExtra = {},
  ): void => {
    const hits = Math.max(1, Math.trunc(Number(group.hits || 1)));
    const hitOffsets = group.hitOffsets ?? [];

    const coefficient = Number(group.coefficient || 0) / hits;
    const source = group.source || extra.source || "Player";
    const actorType =
      group.actorType || extra.actorType || gw2ActorTypeForSource(source);
    const slotSkill =
      skill.type === "Heal" ||
      skill.type === "Utility" ||
      skill.type === "Elite";
    for (let index = 0; index < hits; index += 1) {
      const hitAt = at + Number(hitOffsets[index] ?? 0);

      const event = addEvent(
        decorateDamageEvent(
          {
            type: "damage",
            at: hitAt,
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
            weaponStrengthProfileId: group.weaponStrengthProfileId,
            skillWeapon:
              skill.weapon || (slotSkill ? "Utility" : activePrimaryWeapon()),
            ...extra,
          },
          { skill, group, extra },
        ),
      );
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
