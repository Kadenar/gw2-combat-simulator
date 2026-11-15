/** Owns combo field history and attempt claims so callers cannot change selection or expiry through shared storage. */
import { comboCombatMetadata, comboDefinition } from '#gw2/platform/combos/definitions.js';
import type { ComboEvent, ComboFieldEvent, ComboFinisherEvent } from '#gw2/platform/combos/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2SimulationDiagnostic } from '#gw2/platform/results/diagnostics.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { timeKey } from '#kernel/core/clock.js';
import { cloneData } from '#kernel/core/clone.js';

/**
 * Combo resolution rules: per-run field state, the shared field-window rule, field selection for a finisher, and
 * turning one bound attempt into combos. resolver/combo-resolution.ts registers these as resolver event handlers.
 */

/** Combo chance rolls use their own random streams, so isolated previews can recognize them without owning them. */
export const COMBO_RANDOM_STREAM_PREFIX = 'gw2.combo:';

/** Selects the oldest eligible owned field within the highest binding priority, regardless of field type. */
function selectComboFieldForFinisher(fields: readonly ComboFieldEvent[]): ComboFieldEvent | undefined {
  const ordered = [...fields].sort(
    (left, right) => left.at - right.at || (left.eventOrder || 0) - (right.eventOrder || 0)
  );
  // comboBindingPriority > 0 marks an authoritative field (e.g., the specific
  // field placed by a skill that also carries a finisher). When present, only
  // those high-priority fields are candidates. Ignore ambient fields.
  const highestBindingPriority = ordered.reduce(
    (highest, field) => Math.max(highest, field.comboBindingPriority || 0),
    0
  );
  const candidates =
    highestBindingPriority > 0
      ? ordered.filter((field) => (field.comboBindingPriority || 0) === highestBindingPriority)
      : ordered;
  return candidates[0];
}

interface ComboState {
  readonly fields: Map<string, ComboFieldEvent>;
  readonly handledAttemptIds: Set<string>;
  readonly warningKeys: Set<string>;
}

/** One run retains historical fields; registration and observations never share mutable packets with callers. */
export function createGw2ComboController() {
  const state: ComboState = {
    fields: new Map(),
    handledAttemptIds: new Set(),
    warningKeys: new Set()
  };
  return Object.freeze({
    register(event: ComboFieldEvent): void {
      state.fields.set(event.fieldId, cloneData(event));
    },
    // Binding stays at delivery's existing phase so executed history retains the selected field ID.
    bind(event: Gw2ResolverEvent): Gw2ResolverEvent {
      if (event.type !== 'combo_finisher' || !event.comboAutoSelectField) return event;

      const candidates = [...state.fields.values()].filter(
        (field) =>
          field.ownerId === event.comboOwnerId &&
          isComboFieldActiveAt(field, event.at, Number(event.fieldSelectionAt ?? event.at)) &&
          (event.comboExcludeOwnField !== true || field.activationId !== event.activationId)
      );
      const field = selectComboFieldForFinisher(candidates);
      return { ...event, fieldId: field?.fieldId ?? null };
    },
    resolve(event: ComboFinisherEvent, options: ResolveComboAttemptOptions): readonly ComboEvent[] {
      return resolveComboAttempt(state, event, options);
    },
    activeFields(ownerId: string, at: number): readonly Readonly<ComboFieldEvent>[] {
      return [...state.fields.values()]
        .filter((field) => field.ownerId === ownerId && isComboFieldActiveAt(field, at))
        .map((field) => cloneData(field));
    },
    fieldFor(skillId: SkillId, at: number | undefined): Readonly<ComboFieldEvent> | undefined {
      const field = [...state.fields.values()].find((field) => field.skillId === skillId && field.at === at);
      return field && cloneData(field);
    },
    expireField(fieldId: string, at: number): void {
      const field = state.fields.get(fieldId);

      if (field) state.fields.set(fieldId, { ...field, expiresAt: at });
    }
  });
}

export type Gw2ComboController = ReturnType<typeof createGw2ComboController>;

/** Applies one canonical field-window rule to scheduler selection and resolver validation. */
function isComboFieldActiveAt(
  field: ComboFieldEvent,
  at: number,
  fieldSelectionAt = at,
  allowFieldAtExpiry = false
): boolean {
  // Anchored finishers accept a field present at any point from cast start through impact.
  const startsAt = timeKey(field.at);
  const impactAt = timeKey(at);
  const selectionAt = Math.max(startsAt, timeKey(fieldSelectionAt));
  const expiresAt = timeKey(field.expiresAt);
  return (
    startsAt <= impactAt &&
    (selectionAt < expiresAt || ((field.inclusiveExpiry === true || allowFieldAtExpiry) && selectionAt === expiresAt))
  );
}

function warningLabel(event: ComboFinisherEvent): string {
  return String(event.skillName || event.name || event.source || event.sourceId);
}

type ComboWarn = (diagnostic: Gw2SimulationDiagnostic) => void;

/** Reports a failed binding once per key, located at the finisher's field selection and originating activation. */
function warnOnce(state: ComboState, key: string, message: string, event: ComboFinisherEvent, warn: ComboWarn): void {
  if (state.warningKeys.has(key)) return;

  state.warningKeys.add(key);
  warn({
    message,
    at: event.fieldSelectionAt ?? event.at,
    ...(event.activationId ? { activationId: event.activationId } : {})
  });
}

function boundField(state: ComboState, event: ComboFinisherEvent, warn: ComboWarn): ComboFieldEvent | null {
  // An unbound finisher is a normal missed combo opportunity; only failed explicit bindings warrant warnings.
  if (event.fieldId === null) return null;

  const at = event.fieldSelectionAt ?? event.at;
  const label = warningLabel(event);

  const field = state.fields.get(event.fieldId);

  if (field && isComboFieldActiveAt(field, event.at, at, event.allowFieldAtExpiry === true)) return field;

  warnOnce(
    state,
    `inactive-id|${event.fieldId}|${label}`,
    `Combo field ${event.fieldId} is not active for ${label}; no combo resolved.`,
    event,
    warn
  );
  return null;
}

interface ResolveComboAttemptOptions {
  readonly roll: (probability: number, stream: string) => boolean;
  readonly warn: ComboWarn;
}

/** Resolves one explicitly bound attempt into zero or more semantic combos. */
function resolveComboAttempt(
  state: ComboState,
  event: ComboFinisherEvent,
  { roll, warn }: ResolveComboAttemptOptions
): readonly ComboEvent[] {
  // Guard against the same attempt being processed twice if the finisher event
  // appears more than once in the event queue.
  if (state.handledAttemptIds.has(event.attemptId)) return [];

  state.handledAttemptIds.add(event.attemptId);
  const field = boundField(state, event, warn);

  if (!field) return [];

  // Attempts retain queue IDs for deduplication; RNG follows the caster and activation so bookkeeping cannot reroll them.
  // Multiple projectiles from the same activation consume successive draws, including simultaneous packets.
  const stream = JSON.stringify([
    event.actorType,
    event.summonOwner,
    event.sourceId,
    event.skillId,
    event.activationId,
    event.finisherType
  ]);

  if (!roll(event.chance, `${COMBO_RANDOM_STREAM_PREFIX}${stream}`)) return [];

  const definition = comboDefinition(field.fieldType, event.finisherType);
  return Object.freeze(
    Array.from({ length: event.successfulCombos }, (_, index) => ({
      ...comboCombatMetadata(event),
      type: 'combo' as const,
      // Outcomes retain lineage, but only the accepted combo dispatches this declaration.
      effectReaction: event.comboReaction,
      at: event.effectAt,
      // Preserve pre-damage placement so relic reactions and combo outcomes can affect the originating hit.
      ...(event.priority == null ? {} : { priority: event.priority }),
      source: event.source,
      sourceId: event.sourceId,
      actorType: event.actorType,
      name: definition.outcome.name,
      skillName: event.skillName,
      parentSkillName: event.parentSkillName,
      skillId: event.skillId,
      activationId: event.activationId,
      comboId: `${event.attemptId}:combo:${index + 1}`,
      attemptId: event.attemptId,
      companionCandidates: event.companionCandidates,
      fieldId: field.fieldId,
      fieldType: field.fieldType,
      finisherType: event.finisherType,
      fieldSourceId: field.sourceId,
      fieldSource: field.source,
      fieldOwnerId: field.ownerId,
      applicationCount: event.applications,
      outcome: definition.outcome,
      parentEventOrder: event.parentEventOrder
    }))
  );
}
