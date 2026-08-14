import type {
  Gw2ConditionResolution,
  Gw2HitResolution,
  Gw2ResolverEvent,
  Gw2ResolverEventHandlers,
  Gw2ResolverReaction,
  Gw2ResolverReactionRegistry,
  Gw2ResolverRuntime,
} from "../types.js";
import { gw2BoonApplicationRecipients } from "../allied-players.js";
import { createGw2ComboResolution } from "./combo-resolution.js";

interface CreateGw2ResolverEventHandlersOptions {
  readonly hitResolution: {
    readonly buildContext: Gw2HitResolution["buildHitResolutionContext"];
    readonly apply: Gw2HitResolution["applyResolvedHit"];
  };
  readonly conditions: {
    readonly activeStackCount: Gw2ConditionResolution["activeConditionStackCount"];
    readonly apply: Gw2ConditionResolution["applyCondition"];
    readonly tick: Gw2ConditionResolution["handleConditionTick"];
  };
  readonly reactions: Gw2ResolverReactionRegistry;
}

const noop: Gw2ResolverReaction = () => {};

function handleBuff(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  reactions: Gw2ResolverReactionRegistry,
): void {
  const recipients = gw2BoonApplicationRecipients(ctx.config, event);
  Object.assign(event, {
    affectsSelf: recipients.affectsSelf,
    affectsSummons: recipients.affectsSummons,
    alliedPlayerCount: recipients.alliedPlayerCount,
    companionIds: recipients.companionIds,
    recipientCount: recipients.recipientCount,
  });
  const kind = String(event.kind || "").toLowerCase();
  const applications = ctx.boons.get(kind) || [];
  applications.push({
    at: event.at,
    expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
    stacks: Math.max(1, Number(event.stacks || 1)),
    source: event.source,
    affectsSelf: recipients.affectsSelf,
    affectsSummons: recipients.affectsSummons,
    alliedPlayerCount: recipients.alliedPlayerCount,
    companionIds: recipients.companionIds,
    recipientCount: recipients.recipientCount,
  });
  ctx.boons.set(kind, applications);
  // Keep expired applications for historical timestamp queries, but report
  // only stacks active immediately after this application.
  const activeStacks = applications
    .filter(
      (application) =>
        application.affectsSelf !== false && application.expiresAt > event.at,
    )
    .reduce((sum, application) => sum + application.stacks, 0);
  reactions.dispatch("buff.applied", ctx, event, {
    activeStacks,
    applications,
  });
}

/**
 * Builds the complete standard GW2 numeric resolver handler set.
 *
 * Swap, control, and strike sigils are materialized by the shared GW2
 * scheduler policy. Resolver reactions own critical Air/Earth/Torment effects
 * so only surviving damage packets can trigger them.
 */
export function createGw2ResolverEventHandlers({
  hitResolution,
  conditions,
  reactions,
}: CreateGw2ResolverEventHandlersOptions): Gw2ResolverEventHandlers {
  const { buildContext: buildHitResolutionContext, apply: applyResolvedHit } =
    hitResolution;
  const {
    activeStackCount: activeConditionStackCount,
    apply: applyCondition,
    tick: handleConditionTick,
  } = conditions;
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
    blast_combo(ctx, event) {
      reactions.dispatch("blast-combo.resolved", ctx, event);
    },
    buff(ctx, event) {
      handleBuff(ctx, event, reactions);
    },
    weakness_vulnerability(ctx, event) {
      reactions.dispatch("weakness-vulnerability.resolved", ctx, event);
    },

    damage(ctx, event) {
      const hitContext = buildHitResolutionContext(ctx, event);
      // Ordering matters: apply the base hit first, then profession reactions,
      // expected food procs, and finally relic after-hit rules.
      applyResolvedHit(ctx, event, hitContext);
      reactions.dispatch("damage.resolved", ctx, event, {
        hitContext,
        applyCondition,
      });
    },

    condition(ctx, event) {
      // applyCondition schedules future tick events; it does not charge the
      // condition's full damage at application time.
      applyCondition(ctx, event);
    },

    condition_tick(ctx, event) {
      const resolved = handleConditionTick(ctx, event);
      reactions.dispatch("condition-tick.resolved", ctx, event, { resolved });
    },

    control(ctx, event) {
      reactions.dispatch("control.resolved", ctx, event, {
        activeConditionStackCount,
        applyCondition,
      });
    },

    blind(ctx, event) {
      reactions.dispatch("blind.resolved", ctx, event, { applyCondition });
    },

    peitha(ctx, event) {
      reactions.dispatch("peitha.resolved", ctx, event, {
        activeConditionStackCount,
        applyCondition,
      });
    },

    weapon_set(ctx, event) {
      // Invalid/missing values normalize to set one so later sigil and weapon
      // queries always have a valid one-based set number.
      ctx.activeWeaponSet = Number(event.weaponSet) === 2 ? 2 : 1;
      reactions.dispatch("weapon-set.changed", ctx, event, { applyCondition });
    },

    sigil_swap: noop,
  };
  return Object.freeze(handlers);
}
