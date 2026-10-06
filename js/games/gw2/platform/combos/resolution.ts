import { timeKey } from '#kernel/core/clock.js';
import { comboCombatMetadata, comboDefinition } from '#gw2/platform/combos/definitions.js';
import { normalizeComboFieldType } from '#gw2/platform/combos/validation.js';
import type {
  ComboEvent,
  ComboFieldEvent,
  ComboFieldType,
  ComboFinisherEvent,
  Gw2ComboRuntimeState
} from '#gw2/platform/combos/types.js';

/**
 * Combo resolution rules: per-run field state, the shared field-window rule, field selection for a finisher, and
 * turning one bound attempt into combos. resolver/combo-resolution.ts registers these as resolver event handlers.
 */

interface SelectComboFieldOptions {
  readonly preferredFieldTypes?: readonly ComboFieldType[];
  readonly ambiguousFieldSelection?: 'none' | 'oldest';
}

/** Selects one owned field, honoring an authoritative field before preferences. */
export function selectComboFieldForFinisher(
  fields: readonly ComboFieldEvent[],
  options: SelectComboFieldOptions = {}
): { readonly field?: ComboFieldEvent; readonly ambiguous: boolean } {
  const ordered = [...fields].sort(
    (left, right) => left.at - right.at || (left.eventOrder || 0) - (right.eventOrder || 0)
  );
  // comboBindingPriority > 0 marks an authoritative field (e.g., the specific
  // field placed by a skill that also carries a finisher). When present, only
  // those high-priority fields are candidates — ambient fields are ignored.
  const highestBindingPriority = ordered.reduce(
    (highest, field) => Math.max(highest, field.comboBindingPriority || 0),
    0
  );
  const candidates =
    highestBindingPriority > 0
      ? ordered.filter((field) => (field.comboBindingPriority || 0) === highestBindingPriority)
      : ordered;
  const preferredTypes = (options.preferredFieldTypes || []).map(normalizeComboFieldType);
  const preferred = preferredTypes
    .map((fieldType) => candidates.find((field) => field.fieldType === fieldType))
    .find(Boolean);
  // Ambiguous means multiple different field types are present; same type repeated is not ambiguous.
  const ambiguous = new Set(candidates.map((field) => field.fieldType)).size > 1;
  // Priority: preferred type → oldest unambiguous → undefined when ambiguous with no match/override.
  return {
    field: preferred || (!ambiguous || options.ambiguousFieldSelection === 'oldest' ? candidates[0] : undefined),
    ambiguous
  };
}

/** Creates isolated mutable state for combo resolution. */
export function createGw2ComboRuntimeState(): Gw2ComboRuntimeState {
  return {
    fields: new Map(),
    handledAttemptIds: new Set(),
    warningKeys: new Set()
  };
}

/** Retains field history so delayed finishers can validate a selection made before expiration. */
export function registerComboField(state: Gw2ComboRuntimeState, event: ComboFieldEvent): void {
  state.fields.set(event.fieldId, event);
}

/** Applies one canonical field-window rule to scheduler selection and resolver validation. */
export function isComboFieldActiveAt(
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

function warnOnce(state: Gw2ComboRuntimeState, key: string, message: string, warn: (message: string) => void): void {
  if (state.warningKeys.has(key)) return;
  state.warningKeys.add(key);
  warn(message);
}

function boundField(
  state: Gw2ComboRuntimeState,
  event: ComboFinisherEvent,
  warn: (message: string) => void
): ComboFieldEvent | null {
  const at = event.fieldSelectionAt ?? event.at;
  const label = warningLabel(event);
  const time = at.toFixed(3);
  if (event.fieldBinding.kind === 'none') {
    // warnOnUnbound=false suppresses the warning for finishers that are
    // intentionally unbound (e.g. a Whirl that self-manages its field choice).
    if (event.warnOnUnbound === false) return null;
    warnOnce(
      state,
      `none|${label}`,
      `Combo field binding is unspecified for ${label} at ${time}s; no combo resolved.`,
      warn
    );
    return null;
  }

  if (event.fieldBinding.kind === 'field-id') {
    const field = state.fields.get(event.fieldBinding.fieldId);
    if (field && isComboFieldActiveAt(field, event.at, at, event.allowFieldAtExpiry === true)) return field;
    warnOnce(
      state,
      `inactive-id|${event.fieldBinding.fieldId}|${label}`,
      `Combo field ${event.fieldBinding.fieldId} is not active for ${label} at ${time}s; no combo resolved.`,
      warn
    );
    return null;
  }

  const binding = event.fieldBinding;
  // The explicit field-id branch returned above; remaining bindings select by field type.
  const candidates = [...state.fields.values()]
    .filter(
      (field) =>
        field.fieldType === binding.fieldType &&
        isComboFieldActiveAt(field, event.at, at, event.allowFieldAtExpiry === true)
    )
    .sort((left, right) => left.at - right.at);
  if (candidates[0]) return candidates[0];
  warnOnce(
    state,
    `inactive-type|${binding.fieldType}|${label}`,
    `${binding.fieldType} combo field is not active for ${label} at ${time}s; no combo resolved.`,
    warn
  );
  return null;
}

interface ResolveComboAttemptOptions {
  readonly roll: (probability: number, stream: string) => boolean;
  readonly warn: (message: string) => void;
}

/** Resolves one explicitly bound attempt into zero or more semantic combos. */
export function resolveComboAttempt(
  state: Gw2ComboRuntimeState,
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
  if (!roll(event.chance, `gw2.combo:${stream}`)) return [];

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
      bindingKind: event.fieldBinding.kind,
      applicationCount: event.applications,
      outcome: definition.outcome,
      parentEventOrder: event.parentEventOrder
    }))
  );
}
