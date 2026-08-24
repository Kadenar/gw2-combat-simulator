import { isInternalCooldownReady } from '../engine/core/clock.js';
import { augmentSkillHandler, replaceSkillHandler } from '../engine/skills/handlers.js';
import type { SkillHandlerStrategy, SkillId } from '../engine/types.js';
import type {
  NativeResolvedDamageDetails,
  NativeResolvedReaction,
  NativeSchedulerMechanic
} from './native-module-types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime, Gw2ResolverStage } from './types.js';

type OrderedEscapeHandler = Readonly<{
  id: string;
  order?: number;
  handler: (...args: never[]) => object | boolean | number | string | null | void;
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
  readonly actorTypes?: readonly ('player' | 'summon' | 'effect' | 'unknown')[];
  readonly sourceIds?: readonly SkillId[];
  readonly when?: (context: TContext, event: TEvent, details: TDetails) => boolean;
  readonly expectedProgress: {
    readonly get: (context: TContext) => number;
    readonly set: (context: TContext, value: number) => void;
  };
  readonly internalCooldown?: {
    readonly duration: number | ((context: TContext, event: TEvent, details: TDetails) => number);
    readonly readyAt: (context: TContext) => number;
    readonly setReadyAt: (context: TContext, readyAt: number) => void;
  };
  readonly randomStream?: string;
  readonly attribution: {
    readonly kind: 'trait' | 'skill' | 'effect';
    readonly id: SkillId;
  };
  readonly handler: (context: TContext, event: TEvent, details: TDetails) => object | void;
}

/**
 * Runs a resolved critical-hit reaction without rerolling the canonical hit.
 * Deterministic mode accumulates expected critical probability; stochastic
 * mode consumes `didCrit` and a stable secondary random stream.
 */
export function onResolvedPlayerCriticalHit<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails
>(
  options: ResolvedCriticalHitOptions<TContext, TEvent, TDetails>
): NativeResolvedReaction<TContext, TEvent, TDetails> & {
  readonly attribution: ResolvedCriticalHitOptions<TContext, TEvent, TDetails>['attribution'];
} {
  const actorTypes = new Set(options.actorTypes || ['player']);
  const sourceIds = options.sourceIds == null ? null : new Set(options.sourceIds.map(String));
  const chanceFor = (context: TContext, event: TEvent): number => {
    const raw =
      typeof options.chanceOnCriticalHit === 'function'
        ? options.chanceOnCriticalHit(context, event)
        : (options.chanceOnCriticalHit ?? 1);
    const chance = Number(raw);
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
      throw new TypeError(`${options.id} critical proc chance must be 0..1.`);
    }

    return chance;
  };

  const reaction = onResolvedDamage<TContext, TEvent, TDetails>({
    id: options.id,
    order: options.order,
    handler(context, event, details = {} as TDetails) {
      if (!actorTypes.has(event.actorType || 'unknown')) return;
      if (sourceIds && !sourceIds.has(String(event.sourceId ?? ''))) return;
      if (options.when?.(context, event, details) === false) return;
      const chanceOnCritical = chanceFor(context, event);
      if (!(chanceOnCritical > 0)) return;
      const readyAt = options.internalCooldown?.readyAt(context) ?? -Infinity;
      // Hits while an effect is on ICD are ineligible. They must not roll in
      // stochastic mode or bank expected proc progress in deterministic mode.
      if (!isInternalCooldownReady(event.at, readyAt)) return;
      const internalCooldownDuration = options.internalCooldown
        ? Number(
            typeof options.internalCooldown.duration === 'function'
              ? options.internalCooldown.duration(context, event, details)
              : options.internalCooldown.duration
          )
        : 0;
      if (context.random.stochastic) {
        // Use the already-resolved didCrit flag instead of re-rolling the crit.
        if (details.hitContext?.critical?.didCrit !== true) return;
        if (chanceOnCritical < 1 && !context.random.roll(chanceOnCritical, options.randomStream || options.id)) return;
        options.handler(context, event, details);
        if (options.internalCooldown) {
          options.internalCooldown.setReadyAt(context, event.at + internalCooldownDuration);
        }

        return;
      }

      // Deterministic mode: accumulate critChance × procChance per hit.
      // The while loop fires multiple times if progress is very high (e.g. 2.5 → 2 procs),
      // but the break after setting the ICD caps it at one proc per event — the ICD
      // then blocks further accumulation until it expires.
      const criticalChance = Number(details.hitContext?.critical?.chance ?? details.criticalChance ?? 0);
      let progress = options.expectedProgress.get(context) + criticalChance * chanceOnCritical;
      options.expectedProgress.set(context, progress);
      while (progress >= 1 && isInternalCooldownReady(event.at, readyAt)) {
        progress -= 1;
        options.expectedProgress.set(context, progress);
        options.handler(context, event, details);
        if (options.internalCooldown) {
          options.internalCooldown.setReadyAt(context, event.at + internalCooldownDuration);
          break;
        }
      }
    }
  });
  return Object.freeze({ ...reaction, attribution: options.attribution });
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

export function skillAvailability(declaration: OrderedEscapeHandler): NativeSchedulerMechanic {
  return schedulerMechanic('availability', declaration);
}

export function afterSkillEffects(declaration: OrderedEscapeHandler): NativeSchedulerMechanic {
  return schedulerMechanic('afterCast', declaration);
}

// The underlying handler functions take beforeEffects as a separate positional
// parameter; these wrappers provide a flat object API and split it out internally.
export function augmentSkill<TContext extends object>(
  phases: Omit<Partial<SkillHandlerStrategy<TContext>>, 'mode'>
): Readonly<SkillHandlerStrategy<TContext>> {
  const { beforeEffects = null, ...options } = phases;
  return augmentSkillHandler(beforeEffects, options);
}

export function replaceSkill<TContext extends object>(
  phases: Omit<Partial<SkillHandlerStrategy<TContext>>, 'mode'>
): Readonly<SkillHandlerStrategy<TContext>> {
  const { beforeEffects = null, ...options } = phases;
  return replaceSkillHandler(beforeEffects, options);
}
