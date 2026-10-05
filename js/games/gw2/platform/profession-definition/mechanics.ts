import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import {
  advanceCriticalProc,
  criticalOpportunity,
  type CriticalProcApplication
} from '#gw2/platform/combat/critical-procs.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

export interface ResolvedCriticalHitOptions<
  TContext extends Pick<MechanicCombatContext, 'random'>,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails
> {
  readonly id: string;
  readonly chanceOnCriticalHit?: number | ((context: TContext) => number);
  readonly actorTypes?: readonly ('player' | 'summon' | 'effect' | 'environment' | 'unknown')[];
  readonly when?: (context: TContext, event: TEvent, details: TDetails) => boolean;
  readonly internalCooldown?: {
    readonly duration: number | ((context: TContext) => number);
    readonly readyAt: (context: TContext) => number;
    readonly setReadyAt: (context: TContext, readyAt: number) => void;
  };
  readonly randomStream?: string;
  readonly handler: (
    context: TContext,
    event: TEvent,
    details: TDetails,
    application: CriticalProcApplication
  ) => object | void;
}

/**
 * Returns a handler for resolved critical hits without rerolling the canonical hit.
 * The phase-neutral critical-proc kernel owns seeded
 * secondary rolls, and ICD behavior; the declaration owns eligibility and the
 * profession-specific effect.
 * Callers own execution order; handlers supply attribution on the effects they emit.
 */
export function criticalProcHandler<
  TContext extends Pick<MechanicCombatContext, 'random'>,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails
>(
  options: ResolvedCriticalHitOptions<TContext, TEvent, TDetails>
): (context: TContext, event: TEvent, details?: TDetails) => void {
  if (!(options.id || '').trim() || typeof options.handler !== 'function') {
    throw new TypeError('Critical proc requires id and handler.');
  }

  const actorTypes = new Set(options.actorTypes || ['player']);

  return (context, event, details = {} as TDetails) => {
    // Reject ineligible actors and profession predicates before
    // reading cooldowns or consuming a secondary random stream.
    if (!actorTypes.has(event.actorType)) return;
    if (options.when?.(context, event, details) === false) return;

    // Resolve patched proc and ICD values at the hit timestamp so balance
    // profiles and runtime predicates remain profession-owned.
    const chanceOnCriticalHit =
      typeof options.chanceOnCriticalHit === 'function'
        ? options.chanceOnCriticalHit(context)
        : (options.chanceOnCriticalHit ?? 1);
    const internalCooldownDuration = options.internalCooldown
      ? typeof options.internalCooldown.duration === 'function'
        ? options.internalCooldown.duration(context)
        : options.internalCooldown.duration
      : 0;
    const criticalChance = details.hitContext?.critical.chance ?? details.criticalChance ?? 0;

    // Professions own deadlines; both modes consume the canonical seeded critical outcome.
    const state = options.internalCooldown ? { readyAt: options.internalCooldown.readyAt(context) } : undefined;
    const application = advanceCriticalProc(
      criticalOpportunity(criticalChance, details.hitContext?.critical.didCrit),
      {
        id: options.id,
        at: event.at,
        chanceOnCriticalHit,
        ...(options.internalCooldown ? { internalCooldown: internalCooldownDuration } : {}),
        randomStream: options.randomStream,
        roll: (chance, stream) => context.random.roll(chance, stream)
      },
      state
    );

    // Commit the claim before the trait emits effects that could cause another reaction.
    if (state) {
      options.internalCooldown?.setReadyAt(context, state.readyAt);
    }

    // The shared layer decides only whether and how much the proc applied;
    // the declaration remains responsible for the actual trait effect.
    if (application) options.handler(context, event, details, application);
  };
}
