/** Owns the combos/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { SchedulerRecord, SimulationActorType, SimulationEventBase } from '../engine/types.js';

export type ComboFieldType =
  'Dark' | 'Ethereal' | 'Fire' | 'Ice' | 'Light' | 'Lightning' | 'Poison' | 'Smoke' | 'Water';

export type ComboFinisherType = 'Blast' | 'Leap' | 'Projectile' | 'Whirl';

export type ComboFieldBinding =
  | { readonly kind: 'field-id'; readonly fieldId: string }
  | { readonly kind: 'field-type'; readonly fieldType: ComboFieldType }
  | { readonly kind: 'none' };

export interface ComboFieldEvent extends SimulationEventBase<'combo_field'> {
  readonly fieldId: string;
  readonly fieldType: ComboFieldType;
  readonly expiresAt: number;
  readonly ownerId: string;
  readonly ownerActorType: SimulationActorType;
  readonly comboBindingPriority?: number;
}

export interface ComboFinisherEvent extends SimulationEventBase<'combo_finisher'> {
  readonly attemptId: string;
  readonly finisherType: ComboFinisherType;
  readonly fieldBinding: ComboFieldBinding;
  readonly effectAt: number;
  readonly chance: number;
  readonly applications: number;
  readonly successfulCombos: number;
  readonly parentEventOrder?: number;
}

export interface ComboEvent extends SimulationEventBase<'combo'> {
  readonly comboId: string;
  readonly attemptId: string;
  readonly fieldId: string;
  readonly fieldType: ComboFieldType;
  readonly finisherType: ComboFinisherType;
  readonly fieldSourceId: import('../engine/types.js').SkillId;
  readonly bindingKind: ComboFieldBinding['kind'];
  readonly applicationCount: number;
  readonly outcome: Readonly<Record<string, unknown>>;
}

export interface Gw2ComboRuntimeState extends SchedulerRecord {
  readonly fields: Map<string, ComboFieldEvent>;
  readonly handledAttemptIds: Set<string>;
  readonly deterministicProgress: Map<string, number>;
  readonly warningKeys: Set<string>;
}
