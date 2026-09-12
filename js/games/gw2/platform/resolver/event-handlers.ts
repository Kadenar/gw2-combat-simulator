import type {
  Gw2ConditionResolution,
  Gw2HitResolution,
  Gw2ResolverEvent,
  Gw2ResolverEventHandlers,
  Gw2ResolverReaction,
  Gw2ResolverReactionRegistry,
  Gw2ResolverRuntime
} from '#gw2/platform/resolver/types.js';
import {
  gw2BoonApplicationRecipients,
  gw2BuffApplicationRecipients
} from '#gw2/platform/combat/state/allied-players.js';
import { isStandardBoon, recordBuffApplication } from '#gw2/platform/combat/state/boons.js';
import { createGw2ComboResolution } from '#gw2/platform/resolver/combo-resolution.js';
import { GW2_EVENT_ACTOR_TYPES } from '#gw2/platform/combat/state/event-ownership.js';

interface CreateGw2ResolverEventHandlersOptions {
  readonly hitResolution: Gw2HitResolution;
  readonly conditions: Pick<
    Gw2ConditionResolution,
    'activeConditionStackCount' | 'handleConditionTick' | 'handleEnvironmentConditionTick'
  >;
  readonly reactions: Gw2ResolverReactionRegistry;
}

import { applyBoonExtension } from '#gw2/platform/combat/state/boon-extensions.js';

const noop: Gw2ResolverReaction = () => {};

function handleBuff(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent, reactions: Gw2ResolverReactionRegistry): void {
  const kind = String(event.kind || '').toLowerCase();
  // Standard boons honor the summon-sharing setting; generic positive statuses do not.
  const resolvedAudience = isStandardBoon(kind)
    ? gw2BoonApplicationRecipients(ctx.config, event)
    : gw2BuffApplicationRecipients(ctx.config, event);
  Object.assign(event, { resolvedAudience });
  // Retain actual applications, including trait-generated boons, for effects charts.
  if (ctx.reporting) ctx.resolved.push(event);
  // Record before reactions so their boon queries include this application at its timestamp.
  recordBuffApplication(ctx.boons, event);
  reactions.dispatch('buff.applied', ctx, event);
}

/**
 * Connects shared hit and condition resolvers directly to standard GW2 event handlers.
 *
 * Swap, control, and strike sigils are materialized by the shared GW2
 * scheduler policy. Resolver reactions own critical Air/Earth/Torment effects
 * so only surviving damage packets can trigger them.
 */
export function createGw2ResolverEventHandlers({
  hitResolution,
  conditions,
  reactions
}: CreateGw2ResolverEventHandlersOptions): Gw2ResolverEventHandlers {
  const { buildHitResolutionContext, applyResolvedHit } = hitResolution;
  const { activeConditionStackCount, handleConditionTick, handleEnvironmentConditionTick } = conditions;
  const handlers: Gw2ResolverEventHandlers = {
    ...createGw2ComboResolution({ reactions }),
    // These event types are canonical timeline/reporting records with no shared
    // numeric effect. Keeping explicit handlers prevents them being mistaken
    // for unsupported required events by the resolver loop.
    action: noop,
    combat_start: noop,
    marker: noop,
    proc: noop,
    resource: noop,
    buff(ctx, event) {
      handleBuff(ctx, event, reactions);
    },
    boon_extension(ctx, event) {
      applyBoonExtension(ctx.boons, event);
      if (ctx.reporting) ctx.resolved.push(event);
    },
    weakness_vulnerability(ctx, event) {
      reactions.dispatch('weakness-vulnerability.resolved', ctx, event);
    },

    damage(ctx, event) {
      // Apply impact-time adjustments to both scheduled hits and resolver-created procs before calculating damage.
      const updates = reactions.dispatch('damage.resolving', ctx, event);
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
      ctx.applyCondition(event);
    },

    condition_tick(ctx, event) {
      // Environment ticks reduce target health but cannot enter any player or
      // equipment reaction pipeline.
      if (event.actorType === GW2_EVENT_ACTOR_TYPES.ENVIRONMENT) {
        handleEnvironmentConditionTick(ctx, event);
        return;
      }

      const resolved = handleConditionTick(ctx, event);
      reactions.dispatch('condition-tick.resolved', ctx, event, { resolved });
    },

    control(ctx, event) {
      reactions.dispatch('control.resolved', ctx, event, {
        activeConditionStackCount
      });
    },

    blind(ctx, event) {
      reactions.dispatch('blind.resolved', ctx, event);
    },

    peitha(ctx, event) {
      reactions.dispatch('peitha.resolved', ctx, event, {
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
