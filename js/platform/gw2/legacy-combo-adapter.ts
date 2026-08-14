import {
  normalizeComboFieldType,
  normalizeComboFinisherType,
} from "./combo-events.js";

import type {
  CanonicalCatalog,
  SchedulerConfig,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  Skill,
} from "../engine/types.js";
import type {
  ComboFieldBinding,
  ComboFieldEvent,
  ComboFieldType,
  ComboFinisherType,
  Gw2ComboRuntimeState,
} from "./types.js";

interface LegacyComboSchedulerContext {
  readonly config: SchedulerConfig;
  readonly catalog: CanonicalCatalog;
  readonly events: SimulationEvent[];
  readonly epsilon: number;
  emitDerived(
    cause: SimulationEvent,
    event: Parameters<SchedulerContext["emitDerived"]>[1],
  ): SimulationEvent;
  replaceEvent(
    event: SimulationEvent,
    updates: SchedulerRecord,
  ): SimulationEvent;
}

export interface LegacyComboAdapterOptions {
  readonly ownerId: string;
  /** Temporary profession-local parity rule. Shared combo policy never uses it. */
  readonly ambiguousFieldSelection?: "none" | "oldest";
  /** Temporary profession-local field priorities keyed by finisher type. */
  readonly preferredFieldTypes?: Partial<
    Readonly<Record<ComboFinisherType, readonly ComboFieldType[]>>
  >;
  /** Temporary parity for profession handlers that treated expiry as inclusive. */
  readonly legacyInclusiveExpiry?: boolean;
  readonly fieldDuration?: (
    context: LegacyComboSchedulerContext,
    event: SimulationEvent,
    skill: Skill,
    duration: number,
  ) => number;
}

interface CanonicalFieldDescriptor extends SchedulerRecord {
  readonly fieldType: ComboFieldType;
  readonly startMs: number;
  readonly startAnchor: "castStart" | "castEnd" | "event";
  readonly duration: number;
}

interface CanonicalFinisherDescriptor extends SchedulerRecord {
  readonly finisherType: string;
  readonly chance: number;
  readonly attempts: number;
  readonly applications: number;
  readonly successfulCombos: number;
}

function fieldDescriptors(
  event: SimulationEvent,
  skill: Skill | undefined,
): readonly CanonicalFieldDescriptor[] {
  const exact = Array.isArray(event.comboFields)
    ? event.comboFields
    : event.type === "action" && Array.isArray(skill?.comboFields)
      ? skill.comboFields
      : null;
  if (exact) {
    return exact.map((raw) => {
      const descriptor = raw as SchedulerRecord;
      return {
        ...descriptor,
        fieldType: normalizeComboFieldType(
          descriptor.fieldType ?? descriptor.type,
        ),
        startMs: Math.max(0, Number(descriptor.startMs || 0)),
        startAnchor:
          descriptor.startAnchor === "castEnd"
            ? "castEnd"
            : descriptor.startAnchor === "castStart"
              ? "castStart"
              : event.type === "action"
                ? "castStart"
                : "event",
        duration: Number(descriptor.duration),
      };
    });
  }
  if (event.type !== "action" || !skill?.comboField) return [];
  return [
    {
      fieldType: normalizeComboFieldType(skill.comboField),
      startMs: Math.max(0, Number(skill.comboFieldStartMs || 0)),
      startAnchor: skill.comboFieldStartMs == null ? "castEnd" : "castStart",
      duration: Number(
        skill.comboFieldDuration ?? skill.fieldDuration ?? skill.duration ?? 0,
      ),
    },
  ];
}

function finisherDescriptors(
  event: SimulationEvent,
  skill: Skill | undefined,
): readonly CanonicalFinisherDescriptor[] {
  const exact = Array.isArray(event.comboFinishers)
    ? event.comboFinishers
    : Array.isArray(skill?.comboFinishers)
      ? skill.comboFinishers
      : null;
  if (exact) {
    return exact.map((raw) => {
      const descriptor = raw as SchedulerRecord;
      return {
        ...descriptor,
        finisherType: String(descriptor.finisherType ?? descriptor.type),
        chance: Number(descriptor.chance ?? 1),
        attempts: Math.max(1, Math.trunc(Number(descriptor.attempts ?? 1))),
        applications: Math.max(
          1,
          Math.trunc(Number(descriptor.applications ?? 1)),
        ),
        successfulCombos: Math.max(
          1,
          Math.trunc(Number(descriptor.successfulCombos ?? 1)),
        ),
      };
    });
  }

  const finisherType = String(event.finisherType || skill?.finisherType || "");
  if (!finisherType) return [];
  const normalizedType = normalizeComboFinisherType(finisherType);
  const value = Math.max(
    0,
    Number(event.finisherValue ?? skill?.finisherValue ?? 1),
  );
  return [
    {
      finisherType: normalizedType,
      chance: normalizedType === "Projectile" ? value : 1,
      attempts: 1,
      applications:
        normalizedType === "Whirl" ? Math.max(1, Math.floor(value)) : 1,
      successfulCombos:
        normalizedType === "Blast" ? Math.max(1, Math.floor(value)) : 1,
    },
  ];
}

function interactionAt(event: SimulationEvent): number {
  return event.type === "action" ? Number(event.endsAt ?? event.at) : event.at;
}

function activeOwnedFields(
  context: LegacyComboSchedulerContext,
  ownerId: string,
  at: number,
): ComboFieldEvent[] {
  return context.events
    .filter(
      (event): event is ComboFieldEvent =>
        event.type === "combo_field" &&
        event.ownerId === ownerId &&
        event.at <= at + context.epsilon &&
        Number(event.expiresAt) > at + context.epsilon,
    )
    .sort(
      (left, right) =>
        left.at - right.at ||
        Number(left.__order || 0) - Number(right.__order || 0),
    );
}

function bindingFor(
  fields: readonly ComboFieldEvent[],
  ambiguousFieldSelection: LegacyComboAdapterOptions["ambiguousFieldSelection"],
  preferredTypes: readonly ComboFieldType[] = [],
): ComboFieldBinding | null {
  if (!fields.length) return null;
  for (const preferred of preferredTypes) {
    const field = fields.find((candidate) => candidate.fieldType === preferred);
    if (field) return { kind: "field-id", fieldId: field.fieldId };
  }
  const types = new Set(fields.map((field) => field.fieldType));
  if (types.size > 1 && ambiguousFieldSelection !== "oldest") {
    return { kind: "none" };
  }
  return { kind: "field-id", fieldId: fields[0].fieldId };
}

function rebindPendingFinishers(
  context: LegacyComboSchedulerContext,
  options: LegacyComboAdapterOptions,
): void {
  for (const pending of [...context.events]) {
    if (
      pending.type !== "combo_finisher" ||
      pending.legacyComboOwnerId !== options.ownerId
    ) {
      continue;
    }
    const fields = activeOwnedFields(context, options.ownerId, pending.at);
    const pendingPreferred = pending.legacyComboPreferredFieldTypes as
      LegacyComboAdapterOptions["preferredFieldTypes"] | undefined;
    const binding =
      bindingFor(
        fields,
        options.ambiguousFieldSelection,
        (pendingPreferred || options.preferredFieldTypes)?.[
          normalizeComboFinisherType(pending.finisherType)
        ],
      ) || ({ kind: "none" } as const);
    context.replaceEvent(pending, {
      fieldBinding: binding,
      warnOnUnbound: fields.length > 1 && binding.kind === "none",
    });
  }
}

/** Resolver-side companion used only by explicit profession migration code. */
export function legacyComboBindingForOwner(
  state: Gw2ComboRuntimeState,
  ownerId: string,
  at: number,
  ambiguousFieldSelection: LegacyComboAdapterOptions["ambiguousFieldSelection"] = "none",
): ComboFieldBinding | null {
  const fields = [...state.fields.values()]
    .filter(
      (field) =>
        field.ownerId === ownerId && field.at <= at && field.expiresAt > at,
    )
    .sort((left, right) => left.at - right.at);
  return bindingFor(fields, ambiguousFieldSelection);
}

function emitFields(
  context: LegacyComboSchedulerContext,
  event: SimulationEvent,
  skill: Skill | undefined,
  options: LegacyComboAdapterOptions,
): void {
  if (event.cancelled === true) return;
  if (
    Array.isArray(event.comboFields) &&
    Number(event.hitIndex ?? event.applicationIndex ?? 1) !== 1
  ) {
    return;
  }
  fieldDescriptors(event, skill).forEach((descriptor, index) => {
    const baseAt =
      descriptor.startAnchor === "castEnd"
        ? Number(event.endsAt ?? event.at)
        : event.at;
    const at = baseAt + descriptor.startMs / 1000;
    const duration =
      options.fieldDuration?.(context, event, skill!, descriptor.duration) ??
      descriptor.duration;
    if (!(duration > 0) || !Number.isFinite(duration)) return;
    context.emitDerived(event, {
      type: "combo_field",
      at,
      source: event.source,
      sourceId: event.sourceId,
      actorType: "effect",
      skillId: event.skillId,
      skillName: event.skillName,
      activationId: event.activationId,
      fieldId: `${options.ownerId}:${event.activationId || event.__order}:field:${index + 1}`,
      fieldType: descriptor.fieldType,
      expiresAt:
        at +
        duration +
        (options.legacyInclusiveExpiry ? context.epsilon * 2 : 0),
      ownerId: options.ownerId,
      ownerActorType: event.actorType || "player",
    });
    rebindPendingFinishers(context, options);
  });
}

function shouldUseSkillFallback(event: SimulationEvent): boolean {
  if (event.finisherType) return true;
  if (event.type === "damage") return Number(event.coefficient || 0) > 0;
  return event.type === "action";
}

function hasEffectFinishers(skill: Skill | undefined): boolean {
  return Boolean(
    skill?.effects?.some(
      (effect) =>
        Array.isArray(effect.comboFinishers) ||
        (Array.isArray(effect.ticks) &&
          effect.ticks.some((tick) =>
            Array.isArray((tick as SchedulerRecord).comboFinishers),
          )),
    ),
  );
}

/**
 * Adapts legacy profession catalog aliases into explicit combo events. Field
 * selection remains local to the profession invoking this observer.
 */
export function observeLegacyProfessionCombos(
  context: LegacyComboSchedulerContext,
  event: SimulationEvent,
  options: LegacyComboAdapterOptions,
): void {
  if (
    event.schedulerPrediction === "combo-result" ||
    ["combo", "combo_field", "combo_finisher", "aura"].includes(event.type)
  ) {
    return;
  }
  const skill = context.catalog.skillsById.get(event.skillId ?? event.sourceId);
  emitFields(context, event, skill, options);

  const hasExactFinisher =
    event.finisherType != null || Array.isArray(event.comboFinishers);
  if (!hasExactFinisher && !shouldUseSkillFallback(event)) return;
  if (!hasExactFinisher && hasEffectFinishers(skill)) return;
  if (!hasExactFinisher && event.sourceId !== skill?.id) return;
  if (
    event.type === "action" &&
    !hasExactFinisher &&
    skill?.effects?.some((effect) => effect.type === "strike")
  ) {
    return;
  }
  if (!skill && !hasExactFinisher) return;
  const descriptors = finisherDescriptors(event, skill);
  if (!descriptors.length) return;
  const at = interactionAt(event);
  const fields = activeOwnedFields(context, options.ownerId, at);
  const parentEventOrder = Number(
    event.causalOrder ?? event.__order ?? event.at,
  );
  const attemptRoot = String(
    event.activationId || `${event.sourceId}:${event.skillName || event.name}`,
  );

  descriptors.forEach((descriptor, descriptorIndex) => {
    const finisherType = normalizeComboFinisherType(descriptor.finisherType);
    const binding = bindingFor(
      fields,
      options.ambiguousFieldSelection,
      options.preferredFieldTypes?.[finisherType],
    ) || { kind: "none" as const };
    for (let attempt = 1; attempt <= descriptor.attempts; attempt += 1) {
      const packet = finisherType === "Projectile";
      context.emitDerived(event, {
        type: "combo_finisher",
        at,
        effectAt: Number(
          descriptor.effectAt ?? at + Number(descriptor.effectDelay || 0),
        ),
        source: event.source,
        sourceId: event.sourceId,
        actorType: event.actorType,
        skillId: event.skillId,
        skillName: event.skillName,
        parentSkillName: event.parentSkillName,
        activationId: event.activationId,
        attemptId: packet
          ? `${attemptRoot}:projectile:${parentEventOrder}:${descriptorIndex + 1}:${attempt}`
          : `${attemptRoot}:${finisherType.toLowerCase()}:${String(descriptor.attemptGroup || "skill")}:${descriptorIndex + 1}:${attempt}`,
        finisherType,
        fieldBinding: binding,
        legacyComboOwnerId: options.ownerId,
        legacyComboPreferredFieldTypes: options.preferredFieldTypes,
        warnOnUnbound: fields.length > 1 && binding.kind === "none",
        chance: descriptor.chance,
        applications: descriptor.applications,
        successfulCombos: descriptor.successfulCombos,
        parentEventOrder,
      });
    }
  });
}
