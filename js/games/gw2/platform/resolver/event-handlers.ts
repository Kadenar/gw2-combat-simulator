/** Accepted grants feed optional generation accounting before their reactions can extend the new boon. */
import type { LiveEffects } from '#gw2/platform/combat/live-effects.js';
import type { Gw2ComboController } from '#gw2/platform/combos/resolution.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { createGw2ComboResolution } from '#gw2/platform/resolver/combo-resolution.js';
import type { Gw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2HitResolution } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEventHandlers, Gw2ResolverReactionRegistry } from '#gw2/platform/resolver/types.js';

interface CreateGw2ResolverEventHandlersOptions {
  readonly liveEffects: Pick<LiveEffects, 'grant' | 'extend'>;
  readonly combo: Gw2ComboController;
  readonly hitResolution: Gw2HitResolution;
  readonly conditions: Pick<
    Gw2ConditionResolution,
    | 'activeConditionStackCount'
    | 'handleConditionTick'
    | 'handleConditionBuffer'
    | 'handleEnvironmentConditionTick'
    | 'applyCondition'
  >;
  readonly reactions: Gw2ResolverReactionRegistry;
}

const noop = () => {};

function handleBuff(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  reactions: Gw2ResolverReactionRegistry,
  liveEffects: Pick<LiveEffects, 'grant'>
): void {
  liveEffects.grant(event, (resolvedAudience) => {
    Object.assign(event, { resolvedAudience });

    // Retain actual applications, including trait-generated boons, for effects charts.
    if (ctx.retainsResolved(event)) ctx.resolved.push(event);

    ctx.boonGeneration?.record(event);
  });

  // Reactions see the committed application at its accepted timestamp.
  reactions.dispatch('buff.applied', ctx, event, undefined);
}

/**
 * Connects shared hit and condition resolvers directly to standard GW2 event handlers.
 *
 * The unified runtime applies swap, control, and strike equipment reactions to actual events.
 * Critical sigils share the resolved hit outcome and claim their ICD once.
 */
export function createGw2ResolverEventHandlers({
  liveEffects,
  combo,
  hitResolution,
  conditions,
  reactions
}: CreateGw2ResolverEventHandlersOptions): Gw2ResolverEventHandlers {
  const { buildHitResolutionContext, applyResolvedHit } = hitResolution;
  const { activeConditionStackCount, handleConditionTick, handleEnvironmentConditionTick } = conditions;
  const handlers: Gw2ResolverEventHandlers = {
    ...createGw2ComboResolution({ controller: combo, reactions }),
    // These event types are canonical timeline/reporting records with no shared
    // numeric effect. Keeping explicit handlers prevents them being mistaken
    // for unsupported required events by the resolver loop.
    action: noop,
    combat_start: noop,
    marker: noop,
    proc: noop,
    resource: noop,
    // Self conditions are observable resources, never incoming damage in the fixed-full-health simulation.
    self_condition: noop,
    'gw2.transition-lockout'(ctx, event) {
      // Preserve forced recovery for timeline occupancy without applying combat effects.
      if (ctx.retainsResolved(event)) ctx.resolved.push(event);
    },
    buff(ctx, event) {
      handleBuff(ctx, event, reactions, liveEffects);
    },
    boon_extension(ctx, event) {
      ctx.boonGeneration?.record(event);
      liveEffects.extend(event);

      if (ctx.retainsResolved(event)) ctx.resolved.push(event);
    },

    damage(ctx, event) {
      // Apply impact-time adjustments to both scheduled hits and resolver-created procs before calculating damage.
      const updates = reactions.dispatch('damage.resolving', ctx, event, undefined);

      if (updates) event = { ...event, ...updates };

      const hitContext = buildHitResolutionContext(ctx, event);
      // Ordering matters: apply the base hit first, then profession reactions,
      // expected food procs, and finally relic after-hit rules.
      applyResolvedHit(ctx, event, hitContext);
      reactions.dispatch('damage.resolved', ctx, event, { hitContext });
    },

    condition(ctx, event) {
      // applyCondition schedules future tick events; it does not charge the
      // condition's full damage at application time.
      conditions.applyCondition(ctx, event);
    },

    // Buffering observes combat state without changing health or dispatching damage reactions.
    condition_buffer: conditions.handleConditionBuffer,
    condition_tick(ctx, event) {
      // Environment ticks reduce target health but cannot enter any player or
      // equipment reaction pipeline.
      if (event.actorType === ACTOR.ENVIRONMENT) {
        handleEnvironmentConditionTick(ctx, event);
        return;
      }

      const resolved = handleConditionTick(ctx, event);

      // Stale, cancelled, and precombat wakes advance no combat reaction.
      if (resolved) reactions.dispatch('condition-tick.resolved', ctx, event, { resolved });
    },

    control(ctx, event) {
      reactions.dispatch('control.resolved', ctx, event, {
        activeConditionStackCount
      });
    },

    weapon_set(ctx, event) {
      // Invalid/missing values normalize to set one so later sigil and weapon
      // queries always have a valid one-based set number.
      ctx.activeWeaponSet = Number(event.weaponSet) === 2 ? 2 : 1;
    },

    sigil_swap: noop
  };
  return Object.freeze(handlers);
}
