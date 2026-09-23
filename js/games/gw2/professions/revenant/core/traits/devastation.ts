import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { addTimedStacks, consumeNewestStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
/** Owns Core Devastation boon, weapon-swap, and Battle Scar trait behavior. */
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { EPSILON } from '#kernel/core/clock.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/mechanics/legend-swap.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

interface BattleScarGrant {
  readonly at: number;
  readonly stacks: number;
  readonly sourceId: SkillId;
  readonly sourceName: string;
  readonly duration?: number;
  readonly cause?: SimulationEvent | null;
}

// Add expiring Battle Scars up to the shared cap and emit one causally attributed
// buff application for the stacks actually granted.
function grantBattleScars(
  context: RevenantSchedulerContext,
  { at, stacks, sourceId, sourceName, duration: durationOverride, cause = null }: BattleScarGrant
): void {
  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);
  // Grants without their own duration inherit the core buff's; removing that buff leaves them nothing to grant.
  let authoredDuration = durationOverride;
  if (authoredDuration === undefined) {
    const buff = requireEffect(profile, 'buff', 'battle-scars');
    if (!buff) return;
    authoredDuration = effectNumber(profile, buff, 'duration');
  }

  const duration = Math.max(0, authoredDuration);
  const state = professionCoreState(context);
  // Expiry timestamps retain grant order, so newest-first spending needs no per-stack metadata.
  const { expiries, added: count } = addTimedStacks(
    state.battleScars,
    stacks,
    at,
    duration,
    balanceProfileNumber(profile, 'maximumStacks')
  );
  state.battleScars = expiries;
  if (!count) return;

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
  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.battleScarred);
  const buff = requireEffect(profile, 'buff', 'battle-scars');
  if (!buff) return;
  grantBattleScars(context, {
    at: context.effectiveEnd,
    stacks: effectNumber(profile, buff, 'stacks'),
    sourceId: TRAIT.BATTLE_SCARRED,
    sourceName: 'Battle Scarred',
    duration: effectNumber(profile, buff, 'duration')
  });
}

/** Grants Notoriety Might after an in-combat legendary stance skill. */
export function applyNotoriety(context: RevenantCastContext, skill: RevenantSkill): void {
  if (!isLegendaryStanceSkill(skill) || !hasTrait(context.config, TRAIT.NOTORIETY)) return;
  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.notoriety);
  const boon = requireEffect(profile, 'boon', 'might');
  if (!boon) return;
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    sourceId: TRAIT.NOTORIETY,
    name: 'Notoriety — might',
    kind: String(boon.boon),
    duration: effectNumber(profile, boon, 'duration'),
    stacks: effectNumber(profile, boon, 'stacks')
  });
}

/** Grants Brutality Quickness once per ICD when a weapon swap completes. */
export function applyBrutality(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const at = Number(event.endsAt ?? event.at);
  const state = professionCoreState(context);
  if (
    !['action', 'sigil_swap'].includes(event.type) ||
    event.skillId !== ID.SWAP_WEAPONS ||
    !hasTrait(context.config, TRAIT.BRUTALITY)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.brutality);
  const boon = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!boon) return;
  const sourceSkill =
    context.catalog.skillsById.get(event.skillId ?? '') ||
    ({ id: TRAIT.BRUTALITY, name: 'Brutality' } as RevenantSkill);
  // Arm the scheduler-owned claim before its boon can trigger another reaction.
  if (!tryConsumeProcCooldown(state.traitProcReadyAt, 'brutality', at, balanceProfileNumber(profile, 'cooldown')))
    return;
  emitSkillBuff(context, {
    cause: event,
    at,
    source: 'revenant',
    sourceId: TRAIT.BRUTALITY,
    actorType: 'player',
    skillId: TRAIT.BRUTALITY,
    skillName: 'Brutality',
    name: 'Brutality — quickness',
    kind: String(boon.boon),
    duration: gw2SchedulerBoonDuration(
      context,
      sourceSkill,
      String(boon.boon),
      effectNumber(profile, boon, 'duration')
    ),
    stacks: effectNumber(profile, boon, 'stacks')
  });
}

/** Grants Dance of Death Battle Scars for newly observed Vulnerability stacks. */
export function applyDanceOfDeath(context: RevenantSchedulerContext, event: SimulationEvent): void {
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
export function applyThrillOfCombat(context: RevenantSchedulerContext, event: SimulationEvent): void {
  if (!hasTrait(context.config, TRAIT.THRILL_OF_COMBAT)) return;
  const state = professionCoreState(context);
  const battleScars = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);
  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.thrillOfCombat);
  const buff = requireEffect(profile, 'buff', 'battle-scars');
  // The cadence exists only to grant this buff, so a removed buff neither grants nor advances it.
  if (!buff) return;
  const interval = Math.max(EPSILON, balanceProfileNumber(profile, 'cooldown'));
  const duration = Math.max(0, effectNumber(profile, buff, 'duration'));
  const maximumStacks = balanceProfileNumber(battleScars, 'maximumStacks');
  if (state.nextThrillOfCombatAt == null) {
    state.nextThrillOfCombatAt = Number(state.combatBeganAt ?? event.at) + interval;
  }

  const next = Number(state.nextThrillOfCombatAt);
  if (!Number.isFinite(next) || next > event.at + EPSILON) return;
  const elapsedGrants = Math.floor((event.at - next + EPSILON) / interval) + 1;
  const maximumActiveGrants = Math.ceil(duration / interval);
  const firstActiveIndex = Math.max(0, elapsedGrants - maximumActiveGrants);
  let activeGrants = 0;
  for (let index = firstActiveIndex; index < elapsedGrants; index += 1) {
    const grantedAt = next + index * interval;
    const { expiries, added } = addTimedStacks(state.battleScars, 1, grantedAt, duration, maximumStacks);
    state.battleScars = expiries;
    activeGrants += added;
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
export function consumeBattleScar(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars);
  const strike = requireEffect(profile, 'strike', 'Battle Scars — Life Siphon');
  // Scars are spent only to deliver the siphon, so a removed strike leaves them in place.
  if (!strike) return;
  const state = professionCoreState(context);
  const { expiries, consumed } = consumeNewestStacks(state.battleScars, 1, event.at);
  state.battleScars = expiries;
  if (!consumed) return;
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
    flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
    flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
    noCrit: true,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: 'Unequipped'
  });
}

/** Anchor the combat cadence once; attacks neither trigger nor delay its pulses. */
export function scheduleAssassinsPresence(context: RevenantSchedulerContext, at = 0): void {
  if (!hasTrait(context, TRAIT.ASSASSINS_PRESENCE)) return;
  assassinsPresence.start(context, { key: 'assassins-presence', at, captured: {} });
}

/** Emit combat-only party Fury, then schedule the next interval independently of player actions. */
export const assassinsPresence = timedEffect<RevenantSchedulerContext, object>({
  id: 'revenant.assassins-presence',
  interval: (context) =>
    Math.max(
      EPSILON,
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.assassinsPresence),
        'cooldown'
      )
    ),
  effectsAt(context, at) {
    if (!hasTrait(context, TRAIT.ASSASSINS_PRESENCE) || !revenantCombatActive(context, at)) return false;
    const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.assassinsPresence);
    const boon = requireEffect(profile, 'boon', 'fury');
    // The pulse cadence is trait-owned and continues; only the removed Fury packet is skipped.
    if (!boon) return;
    emitSkillBuff(context, { id: TRAIT.ASSASSINS_PRESENCE, name: profile.name } as RevenantSkill, {
      at: at,
      kind: String(boon.boon),
      duration: effectNumber(profile, boon, 'duration'),
      stacks: effectNumber(profile, boon, 'stacks'),
      audience: { recipients: 'party', maximumRecipients: 5 }
    });
  }
});

/** Applies Expose Defenses Vulnerability once after combat becomes active. */
export function applyExposeDefenses(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const state = professionCoreState(context);
  if (state.exposeDefensesUsed || !hasTrait(context.config, TRAIT.EXPOSE_DEFENSES)) return;
  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.exposeDefenses);
  const condition = requireEffect(profile, 'condition', 'Vulnerability');
  // The one-use opener belongs to its packet, so a removed packet leaves it unspent.
  if (!condition) return;
  state.exposeDefensesUsed = true;
  const conditionName = String(condition.condition);
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    skillId: TRAIT.EXPOSE_DEFENSES,
    skillName: 'Expose Defenses',
    name: `Expose Defenses — ${conditionName}`,
    condition: conditionName,
    stacks: effectNumber(profile, condition, 'stacks'),
    duration: effectNumber(profile, condition, 'duration')
  });
}
