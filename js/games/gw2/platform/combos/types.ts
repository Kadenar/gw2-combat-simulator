import {
  COMBO_FIELD,
  COMBO_FINISHER,
  type ComboFieldType,
  type ComboFinisherType,
  type SimulationActorType
} from '#gw2/platform/constants.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';

/** Keep validation, assumption choices, and type unions on the same combo vocabulary. */
export const COMBO_FIELD_TYPES = Object.freeze(Object.values(COMBO_FIELD));

export const COMBO_FINISHER_TYPES = Object.freeze(Object.values(COMBO_FINISHER));

export type ComboFieldSelectionAnchor = 'event' | 'castStart';

/** Fields and finishers require an explicit owner so runtime field selection can match them. */
export interface OwnedComboDescriptor extends Readonly<Record<string, unknown>> {
  readonly ownerId: string;
}

export interface ComboFieldEvent extends SimulationEventBase<'combo_field'> {
  readonly fieldId: string;
  readonly fieldType: ComboFieldType;
  readonly expiresAt: number;
  /** Keeps only the field's exact expiry instant eligible for a finisher. */
  readonly inclusiveExpiry?: boolean;
  readonly ownerId: string;
  readonly ownerActorType: SimulationActorType;
  readonly comboBindingPriority?: number;
}

export interface ComboFinisherEvent extends SimulationEventBase<'combo_finisher'> {
  /** Originating effect declaration; only successful resolution exposes it to combo reactions. */
  readonly comboReaction?: SimulationEventBase['effectReaction'];
  readonly attemptId: string;
  readonly finisherType: ComboFinisherType;
  /** Selected field, or null when this attempt is unbound. */
  readonly fieldId: string | null;
  /** Select an active owned field when the attempt executes instead of using an explicit field ID. */
  readonly comboAutoSelectField?: boolean;
  /** Lets an explicitly bound interaction consume its field at the field's exact expiry timestamp. */
  readonly allowFieldAtExpiry?: boolean;
  /** Earliest eligible field interaction; the window ends at the finisher event without moving its outcome. */
  readonly fieldSelectionAt?: number;
  readonly companionCandidates?: readonly string[];
  readonly effectAt: number;
  readonly chance: number;
  readonly applications: number;
  readonly successfulCombos: number;
  readonly parentEventOrder?: number;
}

export interface ComboEvent extends SimulationEventBase<'combo'> {
  readonly comboId: string;
  readonly attemptId: string;
  readonly companionCandidates?: readonly string[];
  readonly fieldId: string;
  readonly fieldType: ComboFieldType;
  readonly finisherType: ComboFinisherType;
  readonly fieldSourceId: import('#gw2/platform/skills/types.js').SkillId;
  readonly applicationCount: number;
  readonly outcome: Readonly<Record<string, unknown>>;
}

export interface Gw2ComboRuntimeState {
  readonly fields: Map<string, ComboFieldEvent>;
  readonly handledAttemptIds: Set<string>;
  readonly warningKeys: Set<string>;
}
