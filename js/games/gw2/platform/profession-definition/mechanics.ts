import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import type { AvailabilityResult, SkillHandlerStrategy } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  NativeResolvedDamageDetails,
  NativeResolvedReaction,
  NativeSchedulerMechanic
} from '#gw2/platform/profession-definition/module-types.js';
import {
  advanceCriticalProc,
  criticalOpportunity,
  type CriticalProcApplication
} from '#gw2/platform/combat/critical-procs.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';

export { timedEffect } from '#gw2/platform/engine/effects/timed-effects.js';
export { resolverTimedEffect } from '#gw2/platform/resolver/timed-effect-adapter.js';
export { resourceDepletion } from '#gw2/platform/execution/resource-clock.js';
export { actorLoop } from '#gw2/platform/execution/actor-loop.js';
export { eventReaction, scheduledReaction } from '#gw2/platform/execution/scheduler-reactions.js';

type OrderedEscapeHandler = Readonly<{
  id: string;
  order?: number;
  handler: (...args: never[]) => object | boolean | number | string | null | void;
}>;

type AvailabilityEscapeHandler = Readonly<{
  id: string;
  order?: number;
  handler: (...args: never[]) => AvailabilityResult;
}>;

function resolvedReaction<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object
>(
  stage: Gw2ResolverStage,
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  if (!String(declaration.id || '').trim() || typeof declaration.handler !== 'function') {
    throw new TypeError(`${stage} resolver reaction requires id and handler.`);
  }

  return Object.freeze({
    phase: 'resolver',
    stage,
    id: declaration.id,
    order: Number(declaration.order || 0),
    handler: declaration.handler
  });
}

/** Adjusts a damage packet using live resolver state before its damage is calculated. */
export function onResolvingDamage<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object
>(
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction('damage.resolving', declaration);
}

/** Creates an ordered resolver reaction for resolved damage. */
export function onResolvedDamage<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = NativeResolvedDamageDetails
>(
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction('damage.resolved', declaration);
}

/** Creates an ordered resolver reaction for resolved control effects. */
export function onResolvedControl<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object
>(
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction('control.resolved', declaration);
}

/** Creates an ordered resolver reaction for resolved blind effects. */
export function onResolvedBlind<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object
>(
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction('blind.resolved', declaration);
}

/** Creates an ordered resolver reaction for applied conditions. */
export function onConditionApplied<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object
>(
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction('condition.applied', declaration);
}

/** Creates an ordered resolver reaction for applied buffs. */
export function onBuffApplied<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object
>(
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction('buff.applied', declaration);
}

/** Creates an ordered resolver reaction for resolved combos. */
export function onComboResolved<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object
>(
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction('combo.resolved', declaration);
}

/** Creates an ordered resolver reaction for applied auras. */
export function onAuraApplied<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object
>(
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
  }>
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction('aura.applied', declaration);
}

export interface ResolvedCriticalHitOptions<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails
> {
  readonly id: string;
  readonly order?: number;
  readonly chanceOnCriticalHit?: number | ((context: TContext) => number);
  readonly actorTypes?: readonly ('player' | 'summon' | 'effect' | 'environment' | 'unknown')[];
  readonly sourceIds?: readonly SkillId[];
  readonly when?: (context: TContext, event: TEvent, details: TDetails) => boolean;
  readonly internalCooldown?: {
    readonly duration: number | ((context: TContext) => number);
    readonly readyAt: (context: TContext) => number;
    readonly setReadyAt: (context: TContext, readyAt: number) => void;
  };
  readonly randomStream?: string;
  readonly attribution: {
    readonly kind: 'trait' | 'skill' | 'effect';
    readonly id: SkillId;
  };
  readonly handler: (
    context: TContext,
    event: TEvent,
    details: TDetails,
    application: CriticalProcApplication
  ) => object | void;
}

/**
 * Runs a resolved critical-hit reaction without rerolling the canonical hit.
 * The phase-neutral critical-proc kernel owns seeded
 * secondary rolls, and ICD behavior; the declaration owns eligibility and the
 * profession-specific effect.
 */
export function onResolvedCriticalHit<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails
>(
  options: ResolvedCriticalHitOptions<TContext, TEvent, TDetails>
): NativeResolvedReaction<TContext, TEvent, TDetails> & {
  readonly attribution: ResolvedCriticalHitOptions<TContext, TEvent, TDetails>['attribution'];
  readonly requiresCriticalFacts: true;
} {
  const actorTypes = new Set(options.actorTypes || ['player']);
  const sourceIds = options.sourceIds == null ? null : new Set(options.sourceIds.map(String));

  const reaction = onResolvedDamage<TContext, TEvent, TDetails>({
    id: options.id,
    order: options.order,
    handler(context, event, details = {} as TDetails) {
      // Reject ineligible actors, sources, and profession predicates before
      // reading cooldowns or consuming a secondary random stream.
      if (!actorTypes.has(event.actorType || 'unknown')) return;
      if (sourceIds && !sourceIds.has(String(event.sourceId ?? ''))) return;
      if (options.when?.(context, event, details) === false) return;

      // Resolve patched proc and ICD values at the hit timestamp so balance
      // profiles and runtime predicates remain profession-owned.
      const chanceOnCriticalHit = Number(
        typeof options.chanceOnCriticalHit === 'function'
          ? options.chanceOnCriticalHit(context)
          : (options.chanceOnCriticalHit ?? 1)
      );
      const internalCooldownDuration = options.internalCooldown
        ? Number(
            typeof options.internalCooldown.duration === 'function'
              ? options.internalCooldown.duration(context)
              : options.internalCooldown.duration
          )
        : 0;
      const criticalChance = Number(details.hitContext?.critical?.chance ?? details.criticalChance ?? 0);

      // Professions own deadlines; both modes consume the canonical seeded critical outcome.
      const state = options.internalCooldown ? { readyAt: options.internalCooldown.readyAt(context) } : undefined;
      const application = advanceCriticalProc(
        criticalOpportunity(criticalChance, details.hitContext?.critical?.didCrit ?? undefined),
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
    }
  });
  return Object.freeze({ ...reaction, attribution: options.attribution, requiresCriticalFacts: true as const });
}

function schedulerMechanic(
  hook: NativeSchedulerMechanic['hook'],
  declaration: OrderedEscapeHandler
): NativeSchedulerMechanic {
  if (!String(declaration.id || '').trim() || typeof declaration.handler !== 'function') {
    throw new TypeError(`${hook} scheduler mechanic requires id and handler.`);
  }

  return Object.freeze({
    phase: 'scheduler',
    hook,
    id: declaration.id,
    order: Number(declaration.order || 0),
    handler: declaration.handler
  });
}

/** Creates an ordered scheduler mechanic that controls skill availability. */
export function skillAvailability(declaration: AvailabilityEscapeHandler): NativeSchedulerMechanic {
  return schedulerMechanic('availability', declaration);
}

/** Creates an ordered scheduler mechanic that runs after a skill's declarative effects. */
export function afterSkillEffects(declaration: OrderedEscapeHandler): NativeSchedulerMechanic {
  return schedulerMechanic('afterCast', declaration);
}

// The underlying handler functions take beforeEffects as a separate positional
// parameter; these wrappers provide a flat object API and split it out internally.
/** Builds an augmenting skill-handler strategy from flat phase callbacks. */
export function augmentSkill<TContext extends object>(
  phases: Omit<Partial<SkillHandlerStrategy<TContext>>, 'mode'>
): Readonly<SkillHandlerStrategy<TContext>> {
  const { beforeEffects = null, ...options } = phases;
  return augmentSkillHandler(beforeEffects, options);
}

/** Builds a replacing skill-handler strategy from flat phase callbacks. */
export function replaceSkill<TContext extends object>(
  phases: Omit<Partial<SkillHandlerStrategy<TContext>>, 'mode'>
): Readonly<SkillHandlerStrategy<TContext>> {
  const { beforeEffects = null, ...options } = phases;
  return replaceSkillHandler(beforeEffects, options);
}
