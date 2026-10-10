import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  spellbreakerControlAccepted,
  spellbreakerStrike
} from '#gw2/professions/warrior/specializations/spellbreaker/hooks.js';
import type { SpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { spellbreakerStateAt } from '#gw2/professions/warrior/specializations/spellbreaker/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Owns this trait's tuning and selected contributions. */
export const attackersInsight = defineTrait({
  triggers: [
    onTriggerPoint(spellbreakerControlAccepted, {
      run: (runtime, input: TriggerPointInput<typeof spellbreakerControlAccepted>) =>
        reactToSpellbreakerControl(runtime, input.event)
    })
  ],
  id: TRAIT.ATTACKERS_INSIGHT,
  name: "Attacker's Insight",
  balance: {
    maximumStacks: 5,
    attributePerStack: 50,
    effects: [{ name: 'attackers-insight', type: 'buff', kind: 'attackers-insight', stacks: 1, duration: 15 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const magebaneTether = defineTrait({
  triggers: [
    onTriggerPoint(spellbreakerStrike, {
      run: (runtime, input: TriggerPointInput<typeof spellbreakerStrike>) =>
        reactToSpellbreakerDamage(runtime, input.event)
    })
  ],
  id: TRAIT.MAGEBANE_TETHER,
  name: 'Magebane Tether',
  balance: {
    damageMultiplier: 1.15,
    cooldownPolicy: 'playerRecharge',
    cooldown: 12,
    effects: [{ name: 'magebane-tether', type: 'buff', kind: 'magebane-tether', stacks: 1, duration: 8 }]
  },
  modifierRules: [
    {
      id: 'warrior.magebane-tether',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.MAGEBANE_TETHER), 'damageMultiplier'),
      order: 110,
      when: (context) => (spellbreakerStateAt(context).magebaneTetherUntil || 0) > context.time
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const noEscape = defineTrait({
  id: TRAIT.NO_ESCAPE,
  name: 'No Escape',
  balance: {
    effects: [{ name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1 }]
  },
  triggers: [
    {
      order: 0,
      on: 'control.resolved',

      emit: TRAIT.NO_ESCAPE,
      when: (_runtime, event) =>
        event.actorType === 'player' && ['daze', 'stun'].includes(String(event.controlKind).toLowerCase()),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Immobilized',
      attribution: { source: 'Trait', sourceId: TRAIT.NO_ESCAPE, actorType: 'effect', name: 'No Escape - Immobilized' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const pureStrike = defineTrait({
  id: TRAIT.PURE_STRIKE,
  name: 'Pure Strike',
  balance: {
    // Targets have no boons, so the supported bonus is a single critical-damage multiplier.
    criticalDamage: 1.1
  },
  modifierRules: [
    {
      order: 9,
      id: 'warrior.pure-strike',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      // The target never has boons, so the full bonus always applies.
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PURE_STRIKE), 'criticalDamage')
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const sunAndMoonStyle = defineTrait({
  id: TRAIT.SUN_AND_MOON_STYLE,
  name: 'Sun and Moon Style',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      id: 'warrior.sun-and-moon-style',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SUN_AND_MOON_STYLE), 'damageMultiplier'),
      order: 100,
      when: (context) =>
        gw2PrimaryWeapon(context.config, Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1) === 'Dagger'
    }
  ]
});

/** Native specialization prerequisite; intrinsic resource state remains shared with the mode owner. */
export const spellbreakersConviction = defineTrait({
  id: TRAIT.SPELLBREAKERS_CONVICTION,
  name: "Spellbreaker's Conviction"
});

/** Register native owners once in declaration order. */
export const warriorSpellbreakerTraits = [
  spellbreakersConviction,
  attackersInsight,
  magebaneTether,
  noEscape,
  pureStrike,
  sunAndMoonStyle
] as const;

function reactToSpellbreakerControl(context: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType === 'player') {
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
function reactToSpellbreakerDamage(context: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) {
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
        detail: 'Strike damage increased while tethered'
      }
    });
  }
}

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

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
