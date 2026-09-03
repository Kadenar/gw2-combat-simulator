import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/scheduler/critical-facts.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import type { ScheduledTask } from '#gw2/platform/engine/types.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type {
  WarriorCastContext,
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';

import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';

const FIRE_AURA_ICON = 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fire_Aura.png';

export function berserkEntryDuration(context: WarriorCastContext): number {
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.resources), 'buff');
  return Number(effect?.duration ?? 20);
}

// Emit Berserk's baseline Burst of Aggression boons and the optional Bloody Roar
// Resistance from their selected balance profiles.
export function applyBerserkEntryTraits(context: WarriorCastContext, skill: WarriorSkill): void {
  const burstOfAggression = balanceProfileFromContext(context, PROFILE.burstOfAggression);
  for (const effect of burstOfAggression?.effects || []) {
    if (effect.type !== 'boon') continue;
    const boon = String(effect.boon || effect.kind || '');
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.BURST_OF_AGGRESSION,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Burst of Aggression',
      kind: boon,
      boon,
      duration: gw2SchedulerBoonDuration(context, skill, boon, Number(effect.duration || 0)),
      stacks: Number(effect.stacks || 1)
    });
  }

  if (hasTrait(context, TRAIT.BLOODY_ROAR)) {
    const resistance = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.bloodyRoar), 'boon');
    const boon = String(resistance?.boon || resistance?.kind || 'resistance');
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.BLOODY_ROAR,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Bloody Roar',
      kind: boon,
      boon,
      duration: gw2SchedulerBoonDuration(context, skill, boon, Number(resistance?.duration ?? 3.5)),
      stacks: Number(resistance?.stacks ?? 1)
    });
  }
}

function isComplete(context: WarriorCastContext): boolean {
  return context.effectiveEnd >= context.fullEnd - context.epsilon;
}

/**
 * Base berserk-duration extension (seconds) granted by each rage skill on hit,
 * before the Last Blaze bonus. Entering berserk (Berserk itself) grants none;
 * unlisted rage skills use the shared default.
 */
function rageBerserkExtension(context: WarriorCastContext, skill: WarriorSkill): number {
  const profile = balanceProfileFromContext(context, PROFILE.rageExtensions);
  switch (skill.id) {
    case ID.BERSERK:
      return 0;
    case ID.WILD_BLOW:
      return Number(profile?.maximumStacks ?? 5);
    case ID.OUTRAGE:
      // The simulator always has a nearby target, so Outrage uses its
      // increased three-second extension instead of the one-second base.
      return Number(profile?.threshold ?? 3);
    case ID.SUNDERING_LEAP:
    case ID.SHATTERING_BLOW:
      return Number(profile?.threshold ?? 3);
    default:
      return Number(profile?.minimumStacks ?? 2);
  }
}

// Extend an active Berserk window only for completed primal bursts and Rage
// skills, layering their skill-specific and trait-specific duration bonuses.
function extendBerserk(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = berserkerState.from(context);
  if (!state.berserkActive || !isComplete(context)) return;
  const previousUntil = state.berserkUntil;
  if (skill.primalBurst && hasTrait(context, TRAIT.SMASH_BRAWLER)) {
    const profile = balanceProfileFromContext(context, PROFILE.smashBrawler);
    state.berserkUntil +=
      skill.id === ID.DECAPITATE ? Number(profile?.minimumStacks ?? 1) : Number(profile?.resourceGain ?? 2);
  }

  if (skill.categories?.includes('Rage') && skill.id !== ID.BERSERK) {
    state.berserkUntil +=
      rageBerserkExtension(context, skill) +
      (skill.id !== ID.OUTRAGE && hasTrait(context, TRAIT.LAST_BLAZE)
        ? Number(balanceProfileFromContext(context, PROFILE.lastBlaze)?.durationMultiplier ?? 1)
        : 0);
  }

  if (state.berserkUntil > previousUntil) {
    // Refresh the visible Berserk window after extending its authoritative state duration.
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Berserker',
      sourceId: ID.BERSERK,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Berserk',
      kind: 'berserk',
      stacks: 1,
      duration: Math.max(0, state.berserkUntil - context.effectiveEnd)
    });
  }
}

// Apply completed Rage-skill Burning and primal-burst party boons independently
// from Berserk duration extension.
function applyBerserkerTraits(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!isComplete(context)) return;
  if (skill.categories?.includes('Rage') && hasTrait(context, TRAIT.LAST_BLAZE)) {
    const burning = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.lastBlaze), 'condition');
    emitSkillCondition(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.LAST_BLAZE,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Last Blaze — Burning',
      condition: 'Burning',
      stacks: Number(burning?.stacks ?? 1),
      duration: Number(burning?.duration ?? 4)
    });
  }

  if (skill.primalBurst && hasTrait(context, TRAIT.HEAT_THE_SOUL)) {
    const profile = balanceProfileFromContext(context, PROFILE.heatTheSoul);
    const quickness = balanceProfileEffect(profile, 'boon', 0);
    const fury = balanceProfileEffect(profile, 'boon', 1);
    const might = balanceProfileEffect(profile, 'boon', 2);
    const boons = [
      {
        name: 'Heat the Soul — Quickness',
        kind: 'quickness',
        duration:
          skill.id === ID.DECAPITATE
            ? Number(balanceProfileFromContext(context, PROFILE.smashBrawler)?.resourceGain ?? 2)
            : Number(quickness?.duration ?? 5),
        stacks: Number(quickness?.stacks ?? 1)
      },
      {
        name: 'Heat the Soul — Fury',
        kind: 'fury',
        duration: Number(fury?.duration ?? 5),
        stacks: Number(fury?.stacks ?? 1)
      },
      {
        name: 'Heat the Soul — Might',
        kind: 'might',
        duration: Number(might?.duration ?? 5),
        stacks: Number(might?.stacks ?? 3)
      }
    ];
    for (const boon of boons) {
      emitSkillBuff(context, {
        at: context.effectiveEnd,
        source: 'Trait',
        sourceId: TRAIT.HEAT_THE_SOUL,
        actorType: 'effect',
        skillId: skill.id,
        skillName: skill.name,
        name: boon.name,
        kind: boon.kind,
        boon: boon.kind,
        duration: gw2SchedulerBoonDuration(context, skill, boon.kind, boon.duration),
        stacks: boon.stacks,
        audience: { recipients: 'party' as const }
      });
    }
  }
}

function isBerserkerSkill(skill: WarriorSkill): boolean {
  return Boolean(skill.primalBurst || skill.categories?.includes('Rage') || skill.specialization === 'Berserker');
}

// Establish the active Fire Aura window and emit both its buff and visible proc
// marker for trait- or combo-owned sources.
function emitFireAura(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
  source: 'Combo' | 'Trait'
): void {
  const fromTrait = source === 'Trait';
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.kingOfFires), 'buff');
  const duration = Number(effect?.duration ?? 5);
  berserkerState.from(context).fireAuraUntil = event.at + duration;
  const common = {
    at: event.at,
    source,
    sourceId: fromTrait ? TRAIT.KING_OF_FIRES : 'warrior.combo.fire-leap',
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName
  } as const;
  emitSkillBuff(context, {
    cause: event,
    ...common,

    name: fromTrait ? 'King of Fires — Fire Aura' : 'Fire Aura — Leap Combo',
    kind: 'fire-aura',
    stacks: Number(effect?.stacks ?? 1),
    duration
  });
  context.emitDerived(event, {
    ...common,
    type: 'proc',
    procType: fromTrait ? 'trait' : 'skill',
    name: 'Fire Aura',
    sourceSkill: String(event.skillName || event.name || ''),
    detail: fromTrait ? 'Granted by King of Fires' : 'Granted by leap combo',
    icon: FIRE_AURA_ICON
  });
}

function criticalCount(context: WarriorSchedulerContext, event: WarriorSimulationEvent): number {
  const state = berserkerState.from(context);
  const tracker = { progress: state.kingOfFiresCriticalProgress, readyAt: 0 };
  const application = advanceScheduledCriticalProc(context, event, { id: 'warrior.berserker.king-of-fires' }, tracker);
  state.kingOfFiresCriticalProgress = tracker.progress;
  return application?.quantity || 0;
}

// Route canonical critical, fire-aura, and Burning events through Berserker trait
// reactions after their outcomes and ownership are known.
export function observeBerserkerEvent(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (event.type === 'aura' && event.aura === 'Fire Aura') {
    berserkerState.from(context).fireAuraUntil = Math.max(
      berserkerState.from(context).fireAuraUntil,
      event.at + Number(event.duration || 0)
    );
    return;
  }

  if (event.type !== 'damage' || event.actorType !== 'player' || !(Number(event.coefficient) > 0)) {
    return;
  }

  if (!hasTrait(context, TRAIT.KING_OF_FIRES)) return;
  context.tasks.schedule({
    type: 'warrior.king-of-fires-hit',
    at: Math.max(context.state.time, event.at),
    priority: -30,
    payload: { eventOrder: Number(event.eventOrder) },
    required: true
  });
}

export function reactToBerserkerAura(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  if (event.aura !== 'Fire Aura') return;
  berserkerState.from(context).fireAuraUntil = Math.max(
    berserkerState.from(context).fireAuraUntil,
    event.at + Number(event.duration || 0)
  );
}

// Resolve the delayed King of Fires hit only for the still-current aura
// generation, then schedule or emit its linked effects.
export function handleKingOfFiresHitTask(context: WarriorSchedulerContext, task: ScheduledTask): void {
  const payload = task.payload as { readonly eventOrder?: number } | null;
  const event = context.eventByOrder(Number(payload?.eventOrder)) as WarriorSimulationEvent | undefined;
  if (!event) return;

  const state = berserkerState.from(context);
  if (!isInternalCooldownReady(event.at, state.kingOfFiresReadyAt) || criticalCount(context, event) === 0) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.kingOfFires);
  state.kingOfFiresReadyAt = event.at + Number(profile?.internalCooldown ?? 15);
  emitFireAura(context, event, 'Trait');
  const skill = event.skillId == null ? null : context.catalog.skillsById.get(event.skillId);
  const action = context.events.find(
    (candidate) => candidate.type === 'action' && candidate.activationId === event.activationId
  );
  if (skill && isBerserkerSkill(skill) && Number(action?.endsAt) < event.at - context.epsilon) {
    context.tasks.schedule({
      type: 'warrior.king-of-fires-detonation',
      at: event.at,
      priority: -20,
      payload: {
        activationId: event.activationId,
        skillId: skill.id
      },
      required: true
    });
  }
}

// Detonate King of Fires from its captured task payload and clear only the aura
// generation that produced the detonation.
export function handleKingOfFiresDetonationTask(context: WarriorSchedulerContext, task: ScheduledTask): void {
  const payload = task.payload as {
    readonly activationId?: string;
    readonly skillId?: number;
  } | null;
  const skill = context.catalog.skillsById.get(Number(payload?.skillId));
  if (!skill) return;
  const state = berserkerState.from(context);
  if (state.fireAuraUntil <= task.at + context.epsilon) return;
  const profile = balanceProfileFromContext(context, PROFILE.kingOfFires);
  const strike = balanceProfileEffect(profile, 'strike');
  const burning = balanceProfileEffect(profile, 'condition');

  state.fireAuraUntil = 0;
  const common = {
    activationId: payload?.activationId,
    at: task.at,
    source: 'Trait',
    sourceId: TRAIT.KING_OF_FIRES,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name
  } as const;
  context.emit({
    ...common,
    type: 'proc',
    procType: 'trait',
    name: 'King of Fires',
    sourceSkill: skill.name,
    detail: 'Fire Aura detonated'
  });
  emitSkillDamage(context, {
    ...common,

    name: 'King of Fires — Fire Aura Detonation',
    coefficient: Number(strike?.coefficient ?? 0.7),
    canTriggerCriticalTraits: true
  });
  emitSkillCondition(context, {
    ...common,

    name: 'King of Fires — Burning',
    condition: 'Burning',
    stacks: Number(burning?.stacks ?? 3),
    duration: Number(burning?.duration ?? 3)
  });
}

export function finishBerserkerCast(context: WarriorCastContext, skill: WarriorSkill): void {
  extendBerserk(context, skill);
  applyBerserkerTraits(context, skill);
  if (isComplete(context) && isBerserkerSkill(skill) && hasTrait(context, TRAIT.KING_OF_FIRES)) {
    context.tasks.schedule({
      type: 'warrior.king-of-fires-detonation',
      at: context.effectiveEnd,
      priority: -20,
      payload: {
        activationId: context.reservationId,
        skillId: skill.id
      },
      required: true
    });
  }
}
