import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';

import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import type { ScheduledTask } from '#gw2/platform/execution/types.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';

import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import { castCompleted, gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';

const FIRE_AURA_ICON = 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fire_Aura.png';

export function berserkEntryDuration(context: WarriorCastContext): number | undefined {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const effect = requireEffect(resourcesProfile, 'buff', 'berserk');
  return effect ? effectNumber(resourcesProfile, effect, 'duration') : undefined;
}

// Emit Berserk's baseline Burst of Aggression boons and the optional Bloody Roar
// Resistance from their selected balance profiles.
export function applyBerserkEntryTraits(context: WarriorCastContext, skill: WarriorSkill): void {
  const burstOfAggression = requireBalanceProfileFromContext(context, PROFILE.burstOfAggression);
  for (const effect of burstOfAggression.effects || []) {
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
      duration: gw2SchedulerBoonDuration(context, skill, boon, effectNumber(burstOfAggression, effect, 'duration')),
      stacks: effectNumber(burstOfAggression, effect, 'stacks')
    });
  }

  if (hasTrait(context, TRAIT.BLOODY_ROAR)) {
    const bloodyRoarProfile = requireBalanceProfileFromContext(context, PROFILE.bloodyRoar);
    const resistance = requireEffect(bloodyRoarProfile, 'boon', 'resistance');
    if (!resistance) return;
    const boon = String(resistance.boon);
    if (resistance)
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
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          boon,
          effectNumber(bloodyRoarProfile, resistance, 'duration')
        ),
        stacks: effectNumber(bloodyRoarProfile, resistance, 'stacks')
      });
  }
}

function isComplete(context: WarriorCastContext): boolean {
  return castCompleted(context);
}

/**
 * Base berserk-duration extension (seconds) granted by each rage skill on hit,
 * before the Last Blaze bonus. Entering berserk (Berserk itself) grants none;
 * unlisted rage skills use the shared default.
 */
function rageBerserkExtension(context: WarriorCastContext, skill: WarriorSkill): number {
  if (skill.id === ID.BERSERK) return 0;
  const rageExtensionsProfile = requireBalanceProfileFromContext(context, PROFILE.rageExtensions);
  switch (skill.id) {
    case ID.WILD_BLOW:
      return balanceProfileNumber(rageExtensionsProfile, 'maximumStacks');
    case ID.OUTRAGE:
      // The simulator always has a nearby target, so Outrage uses its
      // increased three-second extension instead of the one-second base.
      return balanceProfileNumber(rageExtensionsProfile, 'threshold');
    case ID.SUNDERING_LEAP:
    case ID.SHATTERING_BLOW:
      return balanceProfileNumber(rageExtensionsProfile, 'threshold');
    default:
      return balanceProfileNumber(rageExtensionsProfile, 'minimumStacks');
  }
}

// Extend an active Berserk window only for completed primal bursts and Rage
// skills, layering their skill-specific and trait-specific duration bonuses.
function extendBerserk(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = berserkerState.from(context);
  if (!state.berserkActive || !isComplete(context)) return;
  const previousUntil = state.berserkUntil;
  if (skill.primalBurst && hasTrait(context, TRAIT.SMASH_BRAWLER)) {
    const smashBrawlerProfile = requireBalanceProfileFromContext(context, PROFILE.smashBrawler);
    state.berserkUntil +=
      skill.id === ID.DECAPITATE
        ? balanceProfileNumber(smashBrawlerProfile, 'minimumStacks')
        : balanceProfileNumber(smashBrawlerProfile, 'resourceGain');
  }

  if (skill.categories?.includes('Rage') && skill.id !== ID.BERSERK) {
    state.berserkUntil +=
      rageBerserkExtension(context, skill) +
      (skill.id !== ID.OUTRAGE && hasTrait(context, TRAIT.LAST_BLAZE)
        ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.lastBlaze), 'durationMultiplier')
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

// Apply player-owned Rage-skill Burning and primal-burst party boons independently
// from Berserk duration extension.
function applyBerserkerTraits(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!isComplete(context)) return;
  if (skill.categories?.includes('Rage') && hasTrait(context, TRAIT.LAST_BLAZE)) {
    const lastBlazeProfile = requireBalanceProfileFromContext(context, PROFILE.lastBlaze);
    const burning = requireEffect(lastBlazeProfile, 'condition', 'Burning');
    if (burning)
      emitSkillCondition(context, {
        skill,
        at: context.effectiveEnd,
        source: 'Trait',
        sourceId: TRAIT.LAST_BLAZE,
        actorType: 'effect',
        ownerActorType: 'player',
        name: 'Last Blaze — Burning',
        condition: 'Burning',
        stacks: effectNumber(lastBlazeProfile, burning, 'stacks'),
        duration: effectNumber(lastBlazeProfile, burning, 'duration')
      });
  }

  if (skill.primalBurst && hasTrait(context, TRAIT.HEAT_THE_SOUL)) {
    // Resolve each boon independently so removing one cannot shift or suppress its siblings.
    const heatTheSoulProfile = requireBalanceProfileFromContext(context, PROFILE.heatTheSoul);
    const boons = ['quickness', 'fury', 'might'].flatMap((kind) => {
      const effect = requireEffect(heatTheSoulProfile, 'boon', kind);
      if (!effect) return [];
      return [
        {
          name: 'Heat the Soul — ' + kind,
          kind,
          duration:
            kind === 'quickness' && skill.id === ID.DECAPITATE
              ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.smashBrawler), 'resourceGain')
              : effectNumber(heatTheSoulProfile, effect, 'duration'),
          stacks: effectNumber(heatTheSoulProfile, effect, 'stacks')
        }
      ];
    });
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
): boolean {
  const fromTrait = source === 'Trait';
  const kingOfFiresProfile = requireBalanceProfileFromContext(context, PROFILE.kingOfFires);
  const effect = requireEffect(kingOfFiresProfile, 'buff', 'fire-aura');
  // Removed packets do not open their associated state or schedule follow-ups.
  if (!effect) return false;
  const duration = effectNumber(kingOfFiresProfile, effect, 'duration');
  // Trait and combo auras use the same absolute effect clock as their visible buffs.
  berserkerState.from(context).fireAuraUntil = gw2EffectExpiresAt(event.at, duration);
  const common = {
    at: event.at,
    source,
    sourceId: fromTrait ? TRAIT.KING_OF_FIRES : 'warrior.combo.fire-leap',
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName
  } as const;
  if (effect)
    emitSkillBuff(context, {
      cause: event,
      ...common,

      name: fromTrait ? 'King of Fires — Fire Aura' : 'Fire Aura — Leap Combo',
      kind: 'fire-aura',
      stacks: effectNumber(kingOfFiresProfile, effect, 'stacks'),
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
  return true;
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
      gw2EffectExpiresAt(event.at, Number(event.duration || 0))
    );
    return;
  }

  kingOfFiresReaction.onEventScheduled.handler(context, event);
}

// Resolve the delayed King of Fires hit only for the still-current aura
// generation, then schedule or emit its linked effects.
export const kingOfFiresReaction = eventReaction<WarriorSchedulerContext, WarriorSimulationEvent>({
  id: 'warrior.king-of-fires-hit',
  missingEvent: 'skip',
  initialize(context) {
    if (hasTrait(context, TRAIT.KING_OF_FIRES)) context.schedulerPolicy.requireCriticalFacts?.();
  },
  select(context, event) {
    if (event.type !== 'damage' || event.actorType !== 'player' || !(Number(event.coefficient) > 0)) {
      return null;
    }

    if (!hasTrait(context, TRAIT.KING_OF_FIRES)) return null;
    return {
      at: Math.max(context.state.time, event.at),
      priority: -30,
      payload: { eventOrder: Number(event.eventOrder) },
      required: true
    };
  },
  execute(context, event) {
    const state = berserkerState.from(context);
    if (!isInternalCooldownReady(event.at, state.kingOfFiresReadyAt) || criticalCount(context, event) === 0) {
      return;
    }

    const kingOfFiresProfile = requireBalanceProfileFromContext(context, PROFILE.kingOfFires);
    state.kingOfFiresReadyAt = event.at + balanceProfileNumber(kingOfFiresProfile, 'internalCooldown');
    if (!emitFireAura(context, event, 'Trait')) return;
    const skill = event.skillId == null ? null : context.catalog.skillsById.get(event.skillId);
    const action = context.events.find(
      (candidate) => candidate.type === 'action' && candidate.activationId === event.activationId
    );
    if (skill && isBerserkerSkill(skill) && Number(action?.endsAt) < event.at - EPSILON) {
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
});

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
  // The aura is consumed only inside its half-open lifetime, without rejecting its final microseconds.
  if (state.fireAuraUntil <= task.at) return;

  const kingOfFiresProfile = requireBalanceProfileFromContext(context, PROFILE.kingOfFires);
  const strike = requireEffect(kingOfFiresProfile, 'strike', 'Strike');
  const burning = requireEffect(kingOfFiresProfile, 'condition', 'Burning');

  state.fireAuraUntil = 0;
  const common = {
    activationId: payload?.activationId,
    at: task.at,
    source: 'Trait',
    sourceId: TRAIT.KING_OF_FIRES,
    actorType: 'effect',
    ownerActorType: 'player',
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
  if (strike)
    emitSkillDamage(context, {
      ...common,

      name: 'King of Fires — Fire Aura Detonation',
      coefficient: effectNumber(kingOfFiresProfile, strike, 'coefficient'),
      canTriggerCriticalTraits: true
    });
  // Separate Burning applications preserve the total, including any fractional final stack.
  if (!burning) return;
  const stacks = effectNumber(kingOfFiresProfile, burning, 'stacks');
  const duration = effectNumber(kingOfFiresProfile, burning, 'duration');
  for (let index = 0; index < Math.ceil(stacks); index += 1) {
    emitSkillCondition(context, {
      ...common,

      name: 'King of Fires — Burning',
      condition: 'Burning',
      stacks: Math.min(1, stacks - index),
      duration
    });
  }
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
