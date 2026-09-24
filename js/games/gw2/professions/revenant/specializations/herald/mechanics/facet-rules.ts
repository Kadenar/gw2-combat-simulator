import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/mechanics/legend-swap.js';
import { emitLegendInvocationProfile, emitLegendInvocationSkill } from '#gw2/professions/revenant/core/traits/index.js';
import {
  revenantActiveBoonCount,
  revenantRuntimeCoreState,
  revenantTimedBuff
} from '#gw2/professions/revenant/core/traits/modifiers.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSchedulerContext } from '#gw2/professions/revenant/types.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import {
  HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
  HERALD_SPIRIT_BOON_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import {
  afterHeraldFacetCast,
  elevatedCompassion,
  facetPulses,
  facetExpiry,
  syncElevatedCompassion
} from '#gw2/professions/revenant/specializations/herald/mechanics/facet-upkeep.js';
import { denySkillCast as denyRevenantSkill } from '#gw2/professions/shared/availability.js';
import type { RevenantCastContext, RevenantPrecastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';
import {
  heraldPassiveModifierRules,
  modifyHeraldPassiveAttributes
} from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';

const heraldModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.forceful-persistence',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // Each active facet contributes 10%, other upkeeps 25%; share Ferocious Aggression's additive bucket.
    amount: (context) =>
      (revenantRuntimeCoreState(context).activeUpkeeps || []).reduce(
        (bonus, upkeep) => bonus + (HERALD_BASE_SKILL_MECHANICS[Number(upkeep.skillId)]?.facet ? 0.1 : 0.25),
        0
      ),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.FORCEFUL_PERSISTENCE)
  },
  {
    id: 'revenant.burst-of-strength-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // "burst-of-strength" is a timed buff key written by the skill handler, not a boon; it uses revenantTimedBuff rather than boon tracking.
    amount: 0.1,
    when: (context) => revenantTimedBuff(context, 'burst-of-strength')
  },
  {
    id: 'revenant.burst-of-strength-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => revenantTimedBuff(context, 'burst-of-strength')
  },
  {
    id: 'revenant.reinforced-potency',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // +1% per unique active boon; capped at 12 boon types so the theoretical maximum is +12%.
    amount: (context) => revenantActiveBoonCount(context) * 0.01,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.REINFORCED_POTENCY)
  }
]);

export const heraldAttributeRules = Object.freeze({
  modifierRules: [...heraldModifierRules, ...heraldPassiveModifierRules],
  modifyAttributes: modifyHeraldPassiveAttributes
});

function heraldCastAvailability(context: RevenantPrecastContext, skill: RevenantSkill) {
  const state = professionCoreState(context);
  if (skill.consume && !skillFlipReady(state.availableFlips[skill.id], context.start)) {
    return denyRevenantSkill(skill, 'revenant.facet-inactive', 'activate the matching facet first.');
  }

  if (skill.facet && state.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id)) {
    return denyRevenantSkill(skill, 'revenant.facet-active', 'the facet is already active; consume it instead.');
  }

  return { ready: true as const };
}

export const heraldCastRules = Object.freeze({
  availability: {
    id: 'revenant.herald-facet-availability',
    order: 20,
    handler: heraldCastAvailability
  }
});

const HERALD_SHARED_EMPOWERMENT_TASK = 'revenant.herald-shared-empowerment';

/** Selects observed candidates and applies the local reaction using canonical impact facts. */
const sharedEmpowermentReaction = eventReaction<RevenantSchedulerContext, SimulationEvent>({
  id: 'revenant.herald-shared-empowerment',
  order: 20,
  missingEvent: 'skip',
  select(context, event) {
    const hasRecipient = Number(event.resolvedAudience?.recipientCount) > 0;
    if (
      event.type !== 'buff' ||
      event.sourceId === TRAIT.SHARED_EMPOWERMENT ||
      !isStandardBoon(event.kind) ||
      !hasRecipient ||
      !hasTrait(context.config, TRAIT.SHARED_EMPOWERMENT) ||
      !Number.isFinite(event.eventOrder)
    ) {
      return null;
    }

    // Resolve at the boon timestamp so future-authored packets cannot consume the ICD before earlier applications.
    return {
      id: `${HERALD_SHARED_EMPOWERMENT_TASK}:${event.eventOrder}`,
      at: event.at,
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute(context, cause, at) {
    if (!isInternalCooldownReady(at, heraldState.from(context).sharedEmpowermentReadyAt)) return;
    const profile = requireBalanceProfileFromContext(context, HERALD_SHARED_EMPOWERMENT_PROFILE_ID);
    const effect = requireEffect(profile, 'boon', 'might');
    // The cooldown gates only might, so a removed boon leaves it ready.
    if (!effect) return;

    const skill = { id: TRAIT.SHARED_EMPOWERMENT, name: 'Shared Empowerment' } as RevenantSkill;
    const baseDuration = Math.max(0, effectNumber(profile, effect, 'duration'));
    const duration = gw2SchedulerBoonDuration(context, skill, String(effect.boon), baseDuration);
    // Reserve the ICD before emitting Might so the derived boon cannot recursively trigger the trait.
    heraldState.from(context).sharedEmpowermentReadyAt = at + Math.max(0, balanceProfileNumber(profile, 'cooldown'));
    emitSkillBuff(context, {
      cause: cause,

      at: at,
      source: 'revenant',
      sourceId: TRAIT.SHARED_EMPOWERMENT,
      actorType: 'effect',
      skillId: TRAIT.SHARED_EMPOWERMENT,
      skillName: 'Shared Empowerment',
      name: 'Shared Empowerment — might',
      kind: String(effect.boon),
      duration,
      stacks: Math.max(1, effectNumber(profile, effect, 'stacks')),
      audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
    });
  }
});

function observeHeraldEvent(context: RevenantSchedulerContext, event: SimulationEvent): void {
  sharedEmpowermentReaction.onEventScheduled.handler(context, event);

  if (event.type === 'proc' && event.skillId === ID.TRUE_NATURE_DRAGON && event.procType === 'boon-extension') {
    // Core Value improves the flat extension, which never scales with boon duration.
    const extension = Math.max(0, Number(event.duration || 0)) + (hasTrait(context.config, TRAIT.CORE_VALUE) ? 1 : 0);
    // Both phases consume the extension at resolution time; prior applications remain immutable.
    if (extension > 0)
      context.emitDerived(event, {
        ...event,
        type: 'boon_extension',
        duration: extension,
        extensionAudience: 'all'
      });

    return;
  }

  // activeLegendId is already updated to the destination legend by the time sigil_swap is emitted, so this tests the legend just swapped into.
  if (
    event.type !== 'sigil_swap' ||
    professionCoreState(context).activeLegendId !== LEGEND.DRAGON ||
    !revenantCombatActive(context, event.at)
  ) {
    return;
  }

  if (hasTrait(context.config, TRAIT.SPIRIT_BOON)) {
    emitLegendInvocationProfile(context, HERALD_SPIRIT_BOON_PROFILE_ID, event.at, TRAIT.SPIRIT_BOON);
  }

  if (!hasTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) return;
  emitLegendInvocationSkill(context, ID.CALL_OF_THE_DRAGON, event.at, TRAIT.SONG_OF_THE_MISTS);
}

function afterHeraldCast(context: RevenantCastContext, skill: RevenantSkill): void {
  // Facet lifecycle changes aggregate upkeep before Elevated Compassion evaluates its threshold.
  afterHeraldFacetCast(context, skill);
  syncElevatedCompassion(context);
}

export const heraldSchedulerHooks = Object.freeze({
  afterCast: {
    id: 'revenant.herald-facet-start',
    order: 20,
    handler: afterHeraldCast
  },
  onEventScheduled: {
    id: 'revenant.herald-legend-invocation',
    // order: 20 places this after the core weapon/spear observers (order 10) so legend state is stable before invocation fires.
    order: 20,
    handler: observeHeraldEvent
  },
  taskHandlers: Object.freeze({
    ...facetPulses.taskHandlers,
    ...facetExpiry.taskHandlers,
    ...elevatedCompassion.taskHandlers,
    ...sharedEmpowermentReaction.taskHandlers
  })
});
