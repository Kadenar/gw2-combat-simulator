/** Owns the combos/types.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';

/** Keep validation, assumption choices, and type unions on the same combo vocabulary. */
export const COMBO_FIELD_TYPES = Object.freeze([
  'Dark',
  'Ethereal',
  'Fire',
  'Ice',
  'Light',
  'Lightning',
  'Poison',
  'Smoke',
  'Water'
] as const);
export const COMBO_FINISHER_TYPES = Object.freeze(['Blast', 'Leap', 'Projectile', 'Whirl'] as const);

export type ComboFieldType = (typeof COMBO_FIELD_TYPES)[number];
export type ComboFinisherType = (typeof COMBO_FINISHER_TYPES)[number];

export type ComboFieldSelectionAnchor = 'event' | 'castStart';

export type ComboFieldBinding =
  | { readonly kind: 'field-id'; readonly fieldId: string }
  | { readonly kind: 'field-type'; readonly fieldType: ComboFieldType }
  | { readonly kind: 'none' };

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
  readonly fieldBinding: ComboFieldBinding;
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
  readonly fieldSourceId: import('#gw2/platform/engine/skills/types.js').SkillId;
  readonly bindingKind: ComboFieldBinding['kind'];
  readonly applicationCount: number;
  readonly outcome: Readonly<Record<string, unknown>>;
}

export interface Gw2ComboRuntimeState {
  readonly fields: Map<string, ComboFieldEvent>;
  readonly handledAttemptIds: Set<string>;
  readonly warningKeys: Set<string>;
}
