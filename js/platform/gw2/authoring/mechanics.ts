import { augmentSkillHandler, replaceSkillHandler } from '../../engine/skills/handlers.js';
import type { AvailabilityResult, SkillHandlerStrategy, SkillId } from '../../engine/types.js';
import type { NativeResolvedDamageDetails, NativeResolvedReaction, NativeSchedulerMechanic } from './module-types.js';
import {
  advanceCriticalProc,
  criticalOpportunity,
  type CriticalProcApplication,
  type CriticalProcMaterialization
} from '../combat/critical-procs.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime, Gw2ResolverStage } from '../resolver/types.js';

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

/** Creates an ordered resolver reaction for food proc creation. */
export function onFoodProcCreated<
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
  return resolvedReaction('food-proc.created', declaration);
}

export interface ResolvedCriticalHitOptions<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails
> {
  readonly id: string;
  readonly order?: number;
  readonly chanceOnCriticalHit?: number | ((context: TContext, event: TEvent) => number);
  readonly actorTypes?: readonly ('player' | 'summon' | 'effect' | 'environment' | 'unknown')[];
  readonly sourceIds?: readonly SkillId[];
  readonly when?: (context: TContext, event: TEvent, details: TDetails) => boolean;
  readonly materialization?: CriticalProcMaterialization;
  readonly expectedProgress?: {
    readonly get: (context: TContext) => number;
    readonly set: (context: TContext, value: number) => void;
  };
  readonly internalCooldown?: {
    readonly duration: number | ((context: TContext, event: TEvent, details: TDetails) => number);
    readonly readyAt: (context: TContext) => number;
    readonly setReadyAt: (context: TContext, readyAt: number) => void;
  };
  readonly progressDuringCooldown?: 'ignore' | 'accumulate';
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
 * The phase-neutral critical-proc kernel owns expected progress, stochastic
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
      // reading progress or consuming a secondary random stream.
      if (!actorTypes.has(event.actorType || 'unknown')) return;

      if (sourceIds && !sourceIds.has(String(event.sourceId ?? ''))) return;

      if (options.when?.(context, event, details) === false) return;

      // Resolve patched proc and ICD values at the hit timestamp so balance
      // profiles and runtime predicates remain profession-owned.
      const chanceOnCriticalHit = Number(
        typeof options.chanceOnCriticalHit === 'function'
          ? options.chanceOnCriticalHit(context, event)
          : (options.chanceOnCriticalHit ?? 1)
      );
      const internalCooldownDuration = options.internalCooldown
        ? Number(
            typeof options.internalCooldown.duration === 'function'
              ? options.internalCooldown.duration(context, event, details)
              : options.internalCooldown.duration
          )
        : 0;
      const criticalChance = Number(details.hitContext?.critical?.chance ?? details.criticalChance ?? 0);

      // Adapt existing profession-owned scalar fields to the kernel's neutral
      // tracker shape; weighted reactions intentionally need no progress state.
      const state =
        options.expectedProgress || options.internalCooldown
          ? {
              progress: options.expectedProgress?.get(context) ?? 0,
              readyAt: options.internalCooldown?.readyAt(context) ?? 0
            }
          : undefined;

      // Stochastic mode consumes the canonical didCrit fact instead of
      // rerolling the hit. Deterministic mode advances critChance × procChance
      // according to the declaration's threshold or weighted policy.
      const application = advanceCriticalProc(
        criticalOpportunity(criticalChance, details.hitContext?.critical?.didCrit ?? undefined),
        {
          id: options.id,
          at: event.at,
          stochastic: context.random.stochastic,
          chanceOnCriticalHit,
          materialization: options.materialization,
          ...(options.internalCooldown ? { internalCooldown: internalCooldownDuration } : {}),
          progressDuringCooldown: options.progressDuringCooldown,
          randomStream: options.randomStream,
          roll: (chance, stream) => context.random.roll(chance, stream)
        },
        state
      );

      // Write progress and ICD changes back even when no proc fired: an
      // eligible deterministic hit may have advanced fractional progress, and
      // explicit legacy declarations may accumulate it while cooling down.
      if (state) {
        options.expectedProgress?.set(context, state.progress);
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
