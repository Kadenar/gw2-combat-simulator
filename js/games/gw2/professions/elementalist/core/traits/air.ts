import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/types.js';
/** Imperative Air trait behavior; dispatch and reaction registration stay with their existing owners. */
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/state.js';
import {
  combatStarted,
  elementalistEventSkill,
  emitElementalistProc,
  emitProfiledBuff,
  emitProfiledCondition
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { queueElementalistBuff } from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/** Emits Electric Discharge from a qualifying Air-attunement transition. */
export function triggerElectricDischarge(
  context: ElementalistSchedulerContext,
  at: number,
  sourceId: Skill['id']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Electric Discharge')) return;
  const electricDischargeProfile = requireBalanceProfileFromContext(context, PROFILE.electricDischarge);
  const electricDischargeStrike = requireEffect(electricDischargeProfile, 'strike', 'Electric Discharge');
  if (electricDischargeStrike) {
    emitSkillDamage(context, {
      at,
      source: 'Electric Discharge',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Electric Discharge',
      coefficient: effectNumber(electricDischargeProfile, electricDischargeStrike, 'coefficient'),
      skillWeapon: 'Unequipped'
    });
  }

  const conditionEmitted = emitProfiledCondition(
    context,
    at,
    PROFILE.electricDischarge,
    'Electric Discharge',
    'Electric Discharge',
    sourceId
  );
  if (electricDischargeStrike || conditionEmitted)
    emitElementalistProc(context, {
      at,
      name: 'Electric Discharge',
      procType: 'trait',
      sourceId,
      sourceSkill: context.catalog.skillsById.get(sourceId)?.name
    });
}

/** Opens Fresh Air's ferocity window when an attunement transition newly enters Air. */
export function applyFreshAirAttunementEntry(
  context: ElementalistSchedulerContext,
  at: number,
  skill: Skill,
  previous: string
): void {
  if (previous === 'Air' || !hasTrait(context, 'Fresh Air')) return;
  const freshAirProfile = requireBalanceProfileFromContext(context, PROFILE.freshAir);
  const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
  if (freshAir) {
    emitSkillBuff(context, skill, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: 'fresh air',
      stacks: Number(freshAir.stacks),
      duration: Number(freshAir.duration),
      skillName: skill.name,
      priority: -10
    });
  }
}

/** Reads Superspeed as a buff so profile overrides apply without boon-duration scaling. */
export function applyOneWithAir(context: ElementalistSchedulerContext, at: number, skill: Skill): void {
  if (!hasTrait(context, 'One with Air')) return;
  const oneWithAirProfile = requireBalanceProfileFromContext(context, PROFILE.oneWithAir);
  const superspeed = requireEffect(oneWithAirProfile, 'buff', 'Superspeed');
  if (superspeed) {
    emitSkillBuff(context, skill, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: String(superspeed.kind).toLowerCase(),
      stacks: Number(superspeed.stacks),
      duration: Number(superspeed.duration),
      skillName: skill.name
    });
  }
}

/** Grants Inscription's dedicated Resistance effect after entering Air. */
export function applyInscriptionAirEntry(context: ElementalistSchedulerContext, at: number, skill: Skill): void {
  if (hasTrait(context, 'Inscription')) {
    emitProfiledBuff(context, at, PROFILE.inscription, 'Air Entry', skill.name, skill.id);
  }
}

/** Grants Inscription's current-attunement boon after a completed Glyph cast. */
export function applyInscriptionPostCast(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!hasTrait(context, 'Inscription') || skill.skillFamily !== 'Glyph') return;
  const state = professionCoreState(context);
  emitProfiledBuff(context, context.effectiveEnd, PROFILE.inscription, state.primaryAttunement, skill.name, skill.id);
}

/** Retry Air at the next hit candidate; only its resolved critical result can reset the cooldown. */
export function projectedFreshAirReadyAt(context: ElementalistPrecastContext, upTo: number): number | null {
  if (!hasTrait(context, 'Fresh Air')) return null;
  const state = professionCoreState(context);
  if (state.primaryAttunement === 'Air') return null;
  const candidates = state.freshAirCandidates.filter(
    (candidate) => candidate.at > context.start && candidate.at <= upTo
  );
  return candidates.length ? Math.min(...candidates.map((candidate) => candidate.at)) : null;
}

/** Resolve each candidate after its own materializer task has stored the shared seeded critical result. */
export const freshAirReaction = scheduledReaction<
  ElementalistSchedulerContext,
  SimulationEvent,
  { eventOrder: number }
>({
  id: 'elementalist.fresh-air-critical',
  initialize(context) {
    if (hasTrait(context, 'Fresh Air')) (context.schedulerPolicy as Gw2SchedulerPolicy).requireCriticalFacts();
  },
  select(context, event) {
    if (
      event.type !== 'damage' ||
      event.actorType !== 'player' ||
      event.canCrit === false ||
      event.noCrit ||
      !(Number(event.coefficient) > 0) ||
      !hasTrait(context, 'Fresh Air')
    )
      return null;
    const eventOrder = Number(event.eventOrder);
    professionCoreState(context).freshAirCandidates.push({ at: event.at, eventOrder });
    return { at: Math.max(context.state.time, event.at), priority: -40, payload: { eventOrder } };
  },
  execute(context, _at, { eventOrder }) {
    const state = professionCoreState(context);
    state.freshAirCandidates = state.freshAirCandidates.filter((candidate) => candidate.eventOrder !== eventOrder);
    const event = context.eventByOrder(eventOrder);
    if (!event) throw new Error(`Missing Fresh Air critical event ${eventOrder}.`);
    if (
      state.primaryAttunement === 'Air' ||
      !advanceScheduledCriticalProc(context, event, { id: 'elementalist.core.fresh-air' })
    )
      return;
    if (state.attunementReadyAt.Air > event.at) {
      setElementalistAttunementReadyAt(context, 'Air', event.at);
      context.cooldownController.clear(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air);
    }

    context.emit({
      type: 'elementalist.fresh-air',
      at: event.at,
      source: 'Fresh Air',
      sourceId: 'Fresh Air',
      actorType: 'effect',
      skillName: 'Fresh Air',
      sourceSkill: String(event.skillName || event.source || ''),
      triggeringSkillId: event.skillId ?? event.sourceId
    });
  }
});

/** Materializes Lightning Rod from a classified player control event. */
export function applyLightningRod(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (!hasTrait(context, 'Lightning Rod')) return;
  const sourceId = event.skillId ?? event.sourceId;
  const lightningRodProfile = requireBalanceProfileFromContext(context, PROFILE.lightningRod);
  const lightningRodStrike = requireEffect(lightningRodProfile, 'strike', 'Lightning Rod');
  if (lightningRodStrike) {
    emitSkillDamage(context, {
      cause: event,
      at: event.at,
      source: 'Lightning Rod',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Lightning Rod',
      coefficient: effectNumber(lightningRodProfile, lightningRodStrike, 'coefficient'),
      skillWeapon: 'Unequipped'
    });
  }

  const conditionEmitted = emitProfiledCondition(
    context,
    event.at,
    PROFILE.lightningRod,
    'Lightning Rod',
    'Lightning Rod',
    sourceId
  );
  if (lightningRodStrike || conditionEmitted)
    emitElementalistProc(context, {
      at: event.at,
      name: 'Lightning Rod',
      procType: 'trait',
      sourceId,
      sourceSkill: String(event.skillName || event.source || '')
    });
}

/** Materializes Raging Storm after its registered critical-hit reaction succeeds. */
export function applyRagingStorm(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const ragingStormProfile = requireBalanceProfileFromContext(context, PROFILE.ragingStorm);
  const fury = requireEffect(ragingStormProfile, 'boon', 'Fury');
  if (fury) {
    queueElementalistBuff(
      context,
      event,
      String(fury.boon),
      Number(fury.stacks),
      Number(fury.duration),
      'Raging Storm'
    );
  }
}

/** Both aura paths select the same profile effects before applying their own duration policy. */
function zephyrsBoonEffects(context: unknown) {
  return ['Fury', 'Swiftness'].flatMap((name) => {
    const zephyrsBoonProfile = requireBalanceProfileFromContext(context, PROFILE.zephyrsBoon);
    const effect = requireEffect(zephyrsBoonProfile, 'boon', name);
    if (!effect) return [];
    return [
      {
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: Number(effect.duration)
      }
    ];
  });
}

/** Grants scheduler-side Zephyr's Boon effects for one aura application. */
export function applySchedulerZephyrsBoon(
  context: ElementalistSchedulerContext,
  at: number,
  skillName: string,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, "Zephyr's Boon")) return;
  for (const boon of zephyrsBoonEffects(context)) {
    emitSkillBuff(context, elementalistEventSkill(context, skillName, sourceId), {
      at,
      source: skillName,
      sourceId,
      actorType: 'player',
      skillName,
      priority: 0,
      ...boon
    });
  }
}

/** Grants resolver-side Zephyr's Boon effects for one classified aura event. */
export function applyResolverZephyrsBoon(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, "Zephyr's Boon")) return;
  const source = String(event.skillName || event.name || event.source || '');
  for (const boon of zephyrsBoonEffects(context)) {
    queueElementalistBuff(context, event, boon.kind, boon.stacks, boon.duration, source);
  }
}
