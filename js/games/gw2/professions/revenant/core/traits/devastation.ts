/** Owns Core Devastation boon, weapon-swap, and Battle Scar trait behavior. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import {
  requireRevenantBalanceProfile as balanceProfile,
  requireRevenantEffect as profileEffect
} from '#gw2/professions/revenant/core/traits/profile-access.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  RevenantCastContext,
  RevenantCoreState,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

interface BattleScarGrant {
  readonly at: number;
  readonly stacks: number;
  readonly sourceId: SkillId;
  readonly sourceName: string;
  readonly duration?: number;
  readonly cause?: SimulationEvent | null;
}

function pruneBattleScars(state: RevenantCoreState, at: number): void {
  state.battleScars = (state.battleScars || []).filter((stack) => stack.expiresAt > at);
}

// Add expiring Battle Scars up to the shared cap and emit one causally attributed
// buff application for the stacks actually granted.
function grantBattleScars(
  context: RevenantSchedulerContext,
  { at, stacks, sourceId, sourceName, duration: durationOverride, cause = null }: BattleScarGrant
): void {
  const profile = balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);
  const buff = profileEffect(profile, 'buff');
  const duration = Math.max(0, Number(durationOverride ?? buff.duration ?? 0));
  const state = professionCoreState(context);
  pruneBattleScars(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    Math.max(0, Number(profile.maximumStacks || 0) - state.battleScars.length)
  );
  if (!count) return;
  for (let index = 0; index < count; index += 1) {
    state.battleScars.push({ at, expiresAt: at + duration });
  }

  const event = {
    type: 'buff',
    at,
    source: 'revenant',
    sourceId,
    actorType: 'player' as const,
    skillId: sourceId,
    skillName: sourceName,
    name: `${sourceName} — Battle Scars`,
    kind: 'battle-scars',
    duration,
    stacks: count
  };
  if (cause) context.emitDerived(cause, event);
  else context.emit(event);
}

function isLegendaryStanceSkill(skill: RevenantSkill): boolean {
  if (['Heal', 'Utility', 'Elite'].includes(String(skill.slot || '')) && skill.legendId) return true;
  return skill.type === 'Profession';
}

/** Grants Battle Scars after a selected heal skill completes. */
export function applyBattleScarred(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill?.slot !== 'Heal' || !hasTrait(context.config, TRAIT.BATTLE_SCARRED)) return;
  const buff = profileEffect(balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.battleScarred), 'buff');
  grantBattleScars(context, {
    at: context.effectiveEnd,
    stacks: Number(buff.stacks || 0),
    sourceId: TRAIT.BATTLE_SCARRED,
    sourceName: 'Battle Scarred',
    duration: Number(buff.duration || 0)
  });
}

/** Grants Notoriety Might after an in-combat legendary stance skill. */
export function applyNotoriety(context: RevenantCastContext, skill: RevenantSkill): void {
  if (!isLegendaryStanceSkill(skill) || !hasTrait(context.config, TRAIT.NOTORIETY)) return;
  const boon = profileEffect(balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.notoriety), 'boon');
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    sourceId: TRAIT.NOTORIETY,
    name: 'Notoriety — might',
    kind: String(boon.boon || 'might'),
    duration: Number(boon.duration || 0),
    stacks: Number(boon.stacks || 0)
  });
}

/** Grants Brutality Quickness once per ICD when a weapon swap completes. */
export function applyBrutality(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const at = Number(event.endsAt ?? event.at);
  const state = professionCoreState(context);
  if (
    !['action', 'sigil_swap'].includes(event.type) ||
    event.skillId !== ID.SWAP_WEAPONS ||
    !hasTrait(context.config, TRAIT.BRUTALITY) ||
    !isInternalCooldownReady(at, Number(state.traitProcReadyAt.brutality || 0))
  ) {
    return;
  }

  const profile = balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.brutality);
  const boon = profileEffect(profile, 'boon');
  const sourceSkill =
    context.catalog.skillsById.get(event.skillId ?? '') ||
    ({ id: TRAIT.BRUTALITY, name: 'Brutality' } as RevenantSkill);
  state.traitProcReadyAt.brutality = at + Number(profile.cooldown || 0);
  emitSkillBuff(context, {
    cause: event,
    at,
    source: 'revenant',
    sourceId: TRAIT.BRUTALITY,
    actorType: 'player',
    skillId: TRAIT.BRUTALITY,
    skillName: 'Brutality',
    name: 'Brutality — quickness',
    kind: String(boon.boon || 'quickness'),
    duration: gw2SchedulerBoonDuration(
      context,
      sourceSkill,
      String(boon.boon || 'quickness'),
      Number(boon.duration || 0)
    ),
    stacks: Number(boon.stacks || 0)
  });
}

/** Grants Dance of Death Battle Scars for newly observed Vulnerability stacks. */
export function applyDanceOfDeath(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.condition !== 'Vulnerability' || !hasTrait(context.config, TRAIT.DANCE_OF_DEATH)) return;
  grantBattleScars(context, {
    at: event.at,
    stacks: Number(event.stacks || 0),
    sourceId: TRAIT.DANCE_OF_DEATH,
    sourceName: 'Dance of Death',
    cause: event
  });
}

// Catch Thrill of Combat up to the current event time, retaining only grants that
// can still be active and respecting the shared Battle Scars stack cap.
export function applyThrillOfCombat(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (!hasTrait(context.config, TRAIT.THRILL_OF_COMBAT)) return;
  const state = professionCoreState(context);
  const battleScars = balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);
  const profile = balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.thrillOfCombat);
  const buff = profileEffect(profile, 'buff');
  const interval = Math.max(context.epsilon, Number(profile.cooldown || 0));
  const duration = Math.max(0, Number(buff.duration || 0));
  if (state.nextThrillOfCombatAt == null) {
    state.nextThrillOfCombatAt = Number(state.combatBeganAt ?? event.at) + interval;
  }

  const next = Number(state.nextThrillOfCombatAt);
  if (!Number.isFinite(next) || next > event.at + context.epsilon) return;
  const elapsedGrants = Math.floor((event.at - next + context.epsilon) / interval) + 1;
  const maximumActiveGrants = Math.ceil(duration / interval);
  const firstActiveIndex = Math.max(0, elapsedGrants - maximumActiveGrants);
  let activeGrants = 0;
  for (let index = firstActiveIndex; index < elapsedGrants; index += 1) {
    const grantedAt = next + index * interval;
    pruneBattleScars(state, grantedAt);
    if (state.battleScars.length >= Number(battleScars.maximumStacks || 0)) continue;
    state.battleScars.push({ at: grantedAt, expiresAt: grantedAt + duration });
    activeGrants += 1;
  }

  state.nextThrillOfCombatAt = next + elapsedGrants * interval;
  if (!activeGrants) return;
  emitSkillBuff(context, {
    cause: event,
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.THRILL_OF_COMBAT,
    actorType: 'player',
    skillId: TRAIT.THRILL_OF_COMBAT,
    skillName: 'Thrill of Combat',
    name: 'Thrill of Combat — Battle Scars',
    kind: 'battle-scars',
    duration,
    stacks: activeGrants
  });
}

/** Consumes one active Battle Scar on a qualifying player strike. */
export function consumeBattleScar(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const profile = balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);
  const strike = profileEffect(profile, 'strike');
  const state = professionCoreState(context);
  pruneBattleScars(state, event.at);
  if (!state.battleScars.length) return;
  state.battleScars.pop();
  emitSkillDamage(context, {
    cause: event,
    at: event.at,
    source: 'revenant',
    sourceId: 'revenant.battle-scars',
    actorType: 'effect',
    skillId: 'revenant.battle-scars',
    skillName: 'Battle Scars',
    name: 'Battle Scars — Life Siphon',
    coefficient: 0,
    flatStrikeBase: Number(strike.flatStrikeBase || 0),
    flatStrikePowerCoeff: Number(strike.flatStrikePowerCoeff || 0),
    noCrit: true,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: 'Unequipped'
  });
}

/** Grants Assassin's Presence Fury on its first qualifying strike per ICD. */
export function applyAssassinsPresence(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context.config, TRAIT.ASSASSINS_PRESENCE) ||
    !isInternalCooldownReady(event.at, Number(state.traitProcReadyAt.assassinsPresence || 0))
  ) {
    return;
  }

  const profile = balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.assassinsPresence);
  const boon = profileEffect(profile, 'boon');
  const sourceSkill =
    context.catalog.skillsById.get(event.skillId ?? '') ||
    ({ id: TRAIT.ASSASSINS_PRESENCE, name: "Assassin's Presence" } as RevenantSkill);
  state.traitProcReadyAt.assassinsPresence = event.at + Number(profile.cooldown || 0);
  emitSkillBuff(context, {
    cause: event,
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.ASSASSINS_PRESENCE,
    actorType: 'player',
    skillId: TRAIT.ASSASSINS_PRESENCE,
    skillName: "Assassin's Presence",
    name: "Assassin's Presence — fury",
    kind: String(boon.boon || 'fury'),
    duration: gw2SchedulerBoonDuration(context, sourceSkill, String(boon.boon || 'fury'), Number(boon.duration || 0)),
    stacks: Number(boon.stacks || 0)
  });
}

/** Applies Expose Defenses Vulnerability once after combat becomes active. */
export function applyExposeDefenses(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const state = professionCoreState(context);
  if (state.exposeDefensesUsed || !hasTrait(context.config, TRAIT.EXPOSE_DEFENSES)) return;
  const condition = profileEffect(
    balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.exposeDefenses),
    'condition'
  );
  state.exposeDefensesUsed = true;
  const conditionName = String(condition.condition || 'Vulnerability');
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.EXPOSE_DEFENSES,
    actorType: 'player',
    skillId: TRAIT.EXPOSE_DEFENSES,
    skillName: 'Expose Defenses',
    name: `Expose Defenses — ${conditionName}`,
    condition: conditionName,
    stacks: Number(condition.stacks || 0),
    duration: Number(condition.duration || 0)
  });
}
