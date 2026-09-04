/** Imperative Air trait behavior; dispatch and reaction registration stay with their existing owners. */
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { balanceProfileEffectFromContext, balanceProfileValue } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/scheduler/critical-facts.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/state.js';
import {
  combatStarted,
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
  emitSkillDamage(context, {
    at,
    source: 'Electric Discharge',
    sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Electric Discharge',
    coefficient: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.electricDischarge, 'strike', 0, 'Electric Discharge'),
      'coefficient',
      0.35
    ),
    skillWeapon: 'Unequipped'
  });
  emitProfiledCondition(
    context,
    at,
    PROFILE.electricDischarge,
    'Electric Discharge',
    'Vulnerability',
    1,
    8,
    'Electric Discharge',
    sourceId
  );
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
  professionCoreState(context).freshAirLastResetAt = at;
  const freshAir = balanceProfileEffectFromContext(context, PROFILE.freshAir, 'buff');
  emitSkillBuff(context, skill, {
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    kind: 'fresh air',
    stacks: Number(freshAir?.stacks ?? 1),
    duration: Number(freshAir?.duration ?? 5),
    skillName: skill.name,
    priority: -10
  });
}

/** Grants One with Air's superspeed after entering Air. */
export function applyOneWithAir(context: ElementalistSchedulerContext, at: number, skill: Skill): void {
  if (hasTrait(context, 'One with Air')) {
    emitProfiledBuff(context, at, PROFILE.oneWithAir, 'Superspeed', 'Superspeed', 1, 3, skill.name, skill.id);
  }
}

/** Grants Inscription's dedicated Resistance effect after entering Air. */
export function applyInscriptionAirEntry(context: ElementalistSchedulerContext, at: number, skill: Skill): void {
  if (hasTrait(context, 'Inscription')) {
    emitProfiledBuff(context, at, PROFILE.inscription, 'Air Entry', 'Resistance', 1, 3, skill.name, skill.id);
  }
}

/** Grants Inscription's current-attunement boon after a completed Glyph cast. */
export function applyInscriptionPostCast(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!hasTrait(context, 'Inscription') || skill.skillFamily !== 'Glyph') return;
  const state = professionCoreState(context);
  const boon =
    state.primaryAttunement === 'Fire'
      ? (['Fire', 'Might', 1, 10] as const)
      : state.primaryAttunement === 'Water'
        ? (['Water', 'Regeneration', 1, 10] as const)
        : state.primaryAttunement === 'Air'
          ? (['Air', 'Swiftness', 1, 10] as const)
          : (['Earth', 'Protection', 1, 3] as const);
  emitProfiledBuff(
    context,
    context.effectiveEnd,
    PROFILE.inscription,
    boon[0],
    boon[1],
    boon[2],
    boon[3],
    skill.name,
    skill.id
  );
}

/** Projects when queued critical candidates will complete Fresh Air's expected proc. */
export function projectedFreshAirReadyAt(context: ElementalistPrecastContext, upTo: number): number | null {
  if (!hasTrait(context, 'Fresh Air')) return null;
  const state = professionCoreState(context);
  if (state.primaryAttunement === 'Air') return null;
  let progress = state.freshAirProgress;
  const candidates = [...state.freshAirCandidates].sort((left, right) => left.at - right.at);
  for (const candidate of candidates) {
    if (candidate.at > upTo + context.epsilon) break;
    progress += candidate.criticalChance;
    if (progress + context.epsilon >= 1) return candidate.at;
  }

  return null;
}

/** Collects eligible damage packets for ordered Fresh Air critical processing. */
export function observeFreshAir(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    event.canCrit === false ||
    event.noCrit ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, 'Fresh Air')
  )
    return;

  const state = professionCoreState(context);
  const criticalPolicy = context.schedulerPolicy as unknown as {
    critical?: (
      schedulerContext: ElementalistSchedulerContext,
      simulationEvent: SimulationEvent
    ) => { chance?: number };
  };
  state.freshAirCandidates.push({
    at: event.at,
    // Lookahead uses expected chance; materialization still uses the canonical event and adapter.
    criticalChance: Number(criticalPolicy.critical?.(context, event)?.chance || 0),
    eventOrder: Number(event.eventOrder),
    sourceId: event.skillId ?? event.sourceId,
    sourceSkill: String(event.skillName || event.source || '')
  });
}

/** Resolves Fresh Air candidates in event order and resets Air on the first successful proc. */
export function processFreshAirCandidates(context: ElementalistSchedulerContext, through: number): void {
  const state = professionCoreState(context);
  if (!state.freshAirCandidates.length) return;
  const pending = [];
  const candidates = [...state.freshAirCandidates].sort((left, right) => left.at - right.at);
  for (const candidate of candidates) {
    if (candidate.at > through + context.epsilon) {
      pending.push(candidate);
      continue;
    }

    if (state.primaryAttunement === 'Air') continue;

    const event = context.eventByOrder(candidate.eventOrder);
    if (!event) throw new Error(`Missing Fresh Air critical event ${String(candidate.eventOrder)}.`);
    const tracker = { progress: state.freshAirProgress, readyAt: 0 };
    const application = advanceScheduledCriticalProc(context, event, { id: 'elementalist.core.fresh-air' }, tracker);
    state.freshAirProgress = tracker.progress;
    if (!application) continue;
    if (state.attunementReadyAt.Air > candidate.at + context.epsilon) {
      setElementalistAttunementReadyAt(context, 'Air', candidate.at);
      context.state.cooldowns.delete(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air);
    }

    context.emit({
      type: 'elementalist.fresh-air',
      at: candidate.at,
      source: 'Fresh Air',
      sourceId: 'Fresh Air',
      actorType: 'effect',
      skillName: 'Fresh Air',
      sourceSkill: candidate.sourceSkill,
      triggeringSkillId: candidate.sourceId
    });
  }

  state.freshAirCandidates = pending;
}

/** Materializes Lightning Rod from a classified player control event. */
export function applyLightningRod(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (!hasTrait(context, 'Lightning Rod')) return;
  const sourceId = event.skillId ?? event.sourceId;
  emitSkillDamage(context, {
    cause: event,
    at: event.at,
    source: 'Lightning Rod',
    sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Lightning Rod',
    coefficient: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.lightningRod, 'strike'),
      'coefficient',
      1.5
    ),
    skillWeapon: 'Unequipped'
  });
  emitProfiledCondition(
    context,
    event.at,
    PROFILE.lightningRod,
    'Lightning Rod',
    'Weakness',
    1,
    4,
    'Lightning Rod',
    sourceId
  );
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
  const fury = balanceProfileEffectFromContext(context, PROFILE.ragingStorm, 'boon', 0, 'Fury');
  queueElementalistBuff(
    context,
    event,
    String(fury?.boon || 'Fury'),
    Number(fury?.stacks ?? 1),
    Number(fury?.duration ?? 4),
    'Raging Storm'
  );
}

/** Grants scheduler-side Zephyr's Boon effects for one aura application. */
export function applySchedulerZephyrsBoon(
  context: ElementalistSchedulerContext,
  at: number,
  skillName: string,
  sourceId: Skill['id']
): void {
  if (!hasTrait(context, "Zephyr's Boon")) return;
  emitProfiledBuff(context, at, PROFILE.zephyrsBoon, 'Fury', 'Fury', 1, 5, skillName, sourceId);
  emitProfiledBuff(context, at, PROFILE.zephyrsBoon, 'Swiftness', 'Swiftness', 1, 5, skillName, sourceId);
}

/** Grants resolver-side Zephyr's Boon effects for one classified aura event. */
export function applyResolverZephyrsBoon(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, "Zephyr's Boon")) return;
  const fury = balanceProfileEffectFromContext(context, PROFILE.zephyrsBoon, 'boon', 0, 'Fury');
  const swiftness = balanceProfileEffectFromContext(context, PROFILE.zephyrsBoon, 'boon', 0, 'Swiftness');
  const source = String(event.skillName || event.name || event.source || '');
  queueElementalistBuff(
    context,
    event,
    String(fury?.boon || 'Fury'),
    Number(fury?.stacks ?? 1),
    Number(fury?.duration ?? 5),
    source
  );
  queueElementalistBuff(
    context,
    event,
    String(swiftness?.boon || 'Swiftness'),
    Number(swiftness?.stacks ?? 1),
    Number(swiftness?.duration ?? 5),
    source
  );
}
