import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount, grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { SpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

function gainAttackersInsight(
  context: Runtime,
  state: { attackerInsightExpiries: number[] },
  at: number,
  applications = 1
): void {
  const attackersInsightProfile = requireBalanceProfileFromContext(context, TRAIT.ATTACKERS_INSIGHT);
  const effect = requireEffect(attackersInsightProfile, 'buff', 'attackers-insight');
  // Removed packets do not open their associated state or schedule follow-ups.
  if (!effect) return;
  // Keep the newest grants; a disabled cap or expired grant cannot add live stacks.
  state.attackerInsightExpiries = grantTimedStacks(state.attackerInsightExpiries, {
    at,
    expiresAt: canonicalTime(at + effectNumber(attackersInsightProfile, effect, 'duration')),
    count: Math.max(1, Math.trunc(applications)),
    maximumStacks: balanceProfileNumber(attackersInsightProfile, 'maximumStacks'),
    retain: 'newest-grant'
  });
}

function attackerInsightApplications(context: Runtime, event: Gw2ResolverEvent): number {
  // Kick grants 2 Attacker's Insight stacks instead of 1 against defiant targets.
  return ID.KICK == Number(event.skillId) && context.config.target?.defiant === true ? 2 : 1;
}

function triggerMagebaneTether(context: Runtime, state: SpellbreakerState, at: number): boolean {
  const key = 'warrior.spellbreaker.magebaneTether';
  // Shared player recharge owns readiness; the tether still waits for its GW2 action tick.
  if (at < gw2CooldownReadyAt(context.procs.deadline(key))) return false;

  const magebaneTetherProfile = requireBalanceProfileFromContext(context, TRAIT.MAGEBANE_TETHER);
  const effect = requireEffect(magebaneTetherProfile, 'buff', 'magebane-tether');
  // A removed tether must not activate its damage window.
  if (!effect || !context.procs.claim(TRAIT.MAGEBANE_TETHER, key, at)) return false;
  state.magebaneTetherUntil = canonicalTime(at + effectNumber(magebaneTetherProfile, effect, 'duration'));
  return true;
}

export function reactToSpellbreakerControl(context: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType === 'player' && hasTrait(context, TRAIT.ATTACKERS_INSIGHT)) {
    gainAttackersInsight(
      context,
      spellbreakerState.from(context),
      event.at,
      attackerInsightApplications(context, event)
    );
  }
}

// Trigger resolver-side Magebane Tether only from a qualifying player burst hit
// and record the proc when its cooldown admits a new window.
export function reactToSpellbreakerDamage(context: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !hasTrait(context, TRAIT.MAGEBANE_TETHER)) {
    return;
  }

  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  if (skill?.burst && triggerMagebaneTether(context, spellbreakerState.from(context), event.at)) {
    context.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Magebane Tether',
        at: event.at,
        sourceSkill: event.skillName,
        detail: '15% strike damage for 8 seconds'
      }
    });
  }
}

export function insightStacks(context: Gw2ModifierContext): number {
  const state = readProfessionSpecializationState<{ attackerInsightExpiries?: number[] }>(
    context.runtime?.profession,
    'Spellbreaker'
  );
  return activeStackCount(state?.attackerInsightExpiries || [], context.time);
}

export function spellbreakerStateAt(context: Gw2ModifierContext): {
  magebaneTetherUntil?: number;
} {
  return (
    readProfessionSpecializationState<{ magebaneTetherUntil?: number }>(context.runtime?.profession, 'Spellbreaker') ||
    {}
  );
}

export function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as Gw2MutableStats & {
    power: number;
    precision: number;
    ferocity: number;
  };
  const attackersInsightProfile = requireBalanceProfileFromContext(context, TRAIT.ATTACKERS_INSIGHT);
  const bonus = insightStacks(context) * balanceProfileNumber(attackersInsightProfile, 'attributePerStack');
  result.power += bonus;
  result.precision += bonus;
  result.ferocity += bonus;
  return result;
}
