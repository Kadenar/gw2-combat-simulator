import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isStandardBoon } from '#gw2/platform/combat/state/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/mechanics/legend-swap.js';
import { emitLegendInvocationProfile, emitLegendInvocationSkill } from '#gw2/professions/revenant/core/traits/index.js';
import { revenantActiveBoonCount, revenantTimedBuff } from '#gw2/professions/revenant/core/traits/modifiers.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import type {
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent
} from '#gw2/professions/revenant/types.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import {
  HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
  HERALD_SPIRIT_BOON_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import {
  afterHeraldFacetCast,
  handleElevatedCompassionPulse,
  handleHeraldFacetPulse,
  HERALD_ELEVATED_COMPASSION_TASK,
  syncElevatedCompassion
} from '#gw2/professions/revenant/specializations/herald/mechanics/facet-upkeep.js';
import { denySkillCast as denyRevenantSkill } from '#gw2/professions/lib/availability.js';
import type { RevenantCastContext, RevenantPrecastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

export const heraldModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
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
  modifierRules: heraldModifierRules
});

function heraldCastAvailability(context: RevenantPrecastContext, skill: RevenantSkill) {
  const state = professionCoreState(context);
  if (skill.consume && !state.availableFlips[skill.id]) {
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

function scheduleSharedEmpowerment(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const hasRecipient = Number(event.resolvedAudience?.recipientCount) > 0;
  if (
    event.type !== 'buff' ||
    event.sourceId === TRAIT.SHARED_EMPOWERMENT ||
    !isStandardBoon(event.kind) ||
    !hasRecipient ||
    !hasTrait(context.config, TRAIT.SHARED_EMPOWERMENT) ||
    !Number.isFinite(event.eventOrder)
  ) {
    return;
  }

  // Resolve at the boon timestamp so future-authored packets cannot consume the ICD before earlier applications.
  context.tasks.schedule({
    id: `${HERALD_SHARED_EMPOWERMENT_TASK}:${event.eventOrder}`,
    type: HERALD_SHARED_EMPOWERMENT_TASK,
    at: event.at,
    payload: { eventOrder: event.eventOrder }
  });
}

function handleSharedEmpowerment(context: RevenantSchedulerContext, task: RevenantScheduledTask): void {
  const cause = context.eventByOrder(Number(task.payload?.eventOrder));
  if (!cause || !isInternalCooldownReady(task.at, heraldState.from(context).sharedEmpowermentReadyAt)) return;
  const profile = context.catalog.balanceProfilesById.get(HERALD_SHARED_EMPOWERMENT_PROFILE_ID);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'boon');
  if (!profile || !effect) throw new Error('Missing Shared Empowerment balance profile.');

  const skill = { id: TRAIT.SHARED_EMPOWERMENT, name: 'Shared Empowerment' } as RevenantSkill;
  const baseDuration = Math.max(0, Number(effect.duration || 0));
  const duration = gw2SchedulerBoonDuration(context, skill, String(effect.boon || 'might'), baseDuration);
  // Reserve the ICD before emitting Might so the derived boon cannot recursively trigger the trait.
  heraldState.from(context).sharedEmpowermentReadyAt = task.at + Math.max(0, Number(profile.cooldown || 0));
  emitSkillBuff(context, {
    cause: cause,

    at: task.at,
    source: 'revenant',
    sourceId: TRAIT.SHARED_EMPOWERMENT,
    actorType: 'effect',
    skillId: TRAIT.SHARED_EMPOWERMENT,
    skillName: 'Shared Empowerment',
    name: 'Shared Empowerment — might',
    kind: String(effect.boon || 'might'),
    duration,
    stacks: Math.max(1, Number(effect.stacks ?? 1)),
    audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
  });
}

function observeHeraldEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  scheduleSharedEmpowerment(context, event);

  if (event.type === 'proc' && event.skillId === ID.TRUE_NATURE_ID_51696 && event.procType === 'boon-extension') {
    const extension = Math.max(0, Number(event.duration || 0));
    // Extend only boon applications active when Dragon True Nature resolves; future boons and generic buffs stay unchanged.
    for (const boon of [...context.eventsOfType('buff')]) {
      const hasRecipient = Number(boon.resolvedAudience?.recipientCount) > 0;
      const active =
        boon.at <= event.at + context.epsilon &&
        boon.at + Math.max(0, Number(boon.duration || 0)) > event.at + context.epsilon;
      if (extension > 0 && hasRecipient && active && isStandardBoon(boon.kind)) {
        context.replaceEvent(boon, { duration: Number(boon.duration || 0) + extension });
      }
    }

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
    'revenant.herald-facet-pulse': handleHeraldFacetPulse,
    [HERALD_ELEVATED_COMPASSION_TASK]: handleElevatedCompassionPulse,
    [HERALD_SHARED_EMPOWERMENT_TASK]: handleSharedEmpowerment
  })
});
