import {
  advanceCriticalProc,
  criticalOpportunity,
  type CriticalProcApplication
} from '#gw2/platform/combat/procs/critical.js';
import { ACTOR, type SimulationActorType } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

export interface ResolvedCriticalHitOptions<
  TContext extends Pick<MechanicCombatContext, 'random' | 'procs'>,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails
> {
  readonly id: string;
  readonly chanceOnCriticalHit?: number | ((context: TContext) => number);
  readonly actorTypes?: readonly SimulationActorType[];
  readonly when?: (context: TContext, event: TEvent, details: TDetails) => boolean;
  readonly internalCooldown?: {
    readonly key: SkillId;
    readonly duration: number | ((context: TContext) => number);
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
  TContext extends Pick<MechanicCombatContext, 'random' | 'procs'>,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails
>(
  options: ResolvedCriticalHitOptions<TContext, TEvent, TDetails>
): (context: TContext, event: TEvent, details: TDetails) => void {
  if (!(options.id || '').trim() || typeof options.handler !== 'function') {
    throw new TypeError('Critical proc requires id and handler.');
  }

  // Cooldown ownership is declared once; untyped callers must not share an accidental undefined registry key.
  const cooldown = options.internalCooldown;

  if (cooldown && (cooldown.key as unknown) == null)
    throw new TypeError('Critical proc internal cooldown requires a key.');

  const actorTypes = new Set(options.actorTypes || [ACTOR.PLAYER]);

  return (context, event, details) => {
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
    const internalCooldownDuration = cooldown
      ? typeof cooldown.duration === 'function'
        ? cooldown.duration(context)
        : cooldown.duration
      : 0;
    const criticalChance = details.hitContext.critical.chance;

    // Each declaration selects its registry key; both modes consume the canonical seeded critical outcome.
    const state = cooldown ? { readyAt: context.procs.deadline(cooldown.key) } : undefined;
    const application = advanceCriticalProc(
      criticalOpportunity(criticalChance, details.hitContext.critical.didCrit),
      {
        id: options.id,
        at: event.at,
        chanceOnCriticalHit,
        ...(cooldown ? { internalCooldown: internalCooldownDuration } : {}),
        randomStream: options.randomStream,
        roll: (chance, stream) => context.random.roll(chance, stream)
      },
      state
    );

    if (!application) return;

    // Reserve successful claims before rewards can reenter; rejected attempts leave registry storage untouched.
    if (cooldown) context.procs.setDeadline(cooldown.key, state!.readyAt);

    // The shared layer decides only whether and how much the proc applied;
    // the declaration remains responsible for the actual trait effect.
    options.handler(context, event, details, application);
  };
}
