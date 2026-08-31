import { enqueueOrdered } from '#kernel/events/queue.js';
import { materializeComboOutcome } from '#gw2/platform/combos/definitions.js';
import {
  normalizeComboFinisherType,
  registerComboField,
  resolveComboAttempt,
  selectComboFieldForFinisher
} from '#gw2/platform/combos/events.js';
import { gw2BoonDurationMultiplier, gw2SigilSet } from '#gw2/platform/combat/query/runtime-rules.js';

import type {
  ComboFieldEvent,
  ComboFieldType,
  ComboFinisherEvent,
  ComboFinisherType
} from '#gw2/platform/combos/types.js';
import type {
  Gw2ResolverEvent,
  Gw2ResolverEventHandlers,
  Gw2ResolverReactionRegistry,
  Gw2ResolverRuntime
} from '#gw2/platform/resolver/types.js';

export interface EnqueueGw2OwnedComboFinisherOptions {
  readonly ownerId: string;
  readonly attemptId: string;
  readonly finisherType: ComboFinisherType;
  readonly at?: number;
  readonly effectAt?: number;
  readonly chance?: number;
  readonly applications?: number;
  readonly successfulCombos?: number;
  readonly preferredFieldTypes?: readonly ComboFieldType[];
  readonly ambiguousFieldSelection?: 'none' | 'oldest';
}

/** Queues a resolver-authored finisher through the shared owned-field policy. */
export function enqueueGw2OwnedComboFinisher(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  options: EnqueueGw2OwnedComboFinisherOptions
): void {
  const at = Number(options.at ?? event.at);
  const fields = [...context.combo.fields.values()]
    .filter((field) => field.ownerId === options.ownerId && field.at <= at && field.expiresAt > at)
    .sort((left, right) => left.at - right.at);
  const { field, ambiguous } = selectComboFieldForFinisher(fields, options);
  enqueueOrdered(context.queue, {
    type: 'combo_finisher',
    at,
    effectAt: Number(options.effectAt ?? at),
    source: event.source,
    sourceId: event.sourceId,
    actorType: event.actorType,
    skillId: event.skillId,
    skillName: event.skillName,
    parentSkillName: event.parentSkillName,
    activationId: event.activationId,
    attemptId: options.attemptId,
    finisherType: normalizeComboFinisherType(options.finisherType),
    fieldBinding: field ? { kind: 'field-id', fieldId: field.fieldId } : { kind: 'none' },
    warnOnUnbound: ambiguous && !field,
    chance: Math.max(0, Math.min(1, Number(options.chance ?? 1))),
    applications: Math.max(1, Math.trunc(Number(options.applications ?? 1))),
    successfulCombos: Math.max(1, Math.trunc(Number(options.successfulCombos ?? 1)))
  });
}

/** Resolver-authoritative registration, binding, chance, and materialization. */
export function createGw2ComboResolution({
  reactions
}: {
  readonly reactions: Gw2ResolverReactionRegistry;
}): Gw2ResolverEventHandlers {
  return Object.freeze({
    combo_field(context, event) {
      registerComboField(context.combo, event as ComboFieldEvent);
    },

    combo_finisher(context, event) {
      const combos = resolveComboAttempt(context.combo, event as ComboFinisherEvent, {
        stochastic: context.random.stochastic,
        roll: context.random.roll,
        warn(message) {
          context.warnings.push(message);
        }
      });
      for (const combo of combos) {
        enqueueOrdered(context.queue, combo as Gw2ResolverEvent);
        for (const outcome of materializeComboOutcome(combo)) {
          if (outcome.type === 'buff' && outcome.fixedDuration !== true) {
            const stats = context.query.statsAt(combo.at, combo as Gw2ResolverEvent, context);
            enqueueOrdered(context.queue, {
              ...outcome,
              duration:
                Number(outcome.duration || 0) *
                gw2BoonDurationMultiplier(
                  String(outcome.kind || outcome.name || ''),
                  stats,
                  gw2SigilSet(context.config, context.activeWeaponSet)
                )
            } as Gw2ResolverEvent);
          } else {
            enqueueOrdered(context.queue, outcome as Gw2ResolverEvent);
          }
        }
      }
    },

    combo(context, event) {
      context.resolved.push(event);
      reactions.dispatch('combo.resolved', context, event);
    },

    aura(context: Gw2ResolverRuntime, event: Gw2ResolverEvent) {
      context.resolved.push(event);
      reactions.dispatch('aura.applied', context, event);
    }
  });
}
