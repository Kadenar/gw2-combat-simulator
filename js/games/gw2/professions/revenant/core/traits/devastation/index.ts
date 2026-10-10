import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  targetHealthBelow,
  targetHealthFraction,
  vulnerabilityStacks
} from '#gw2/platform/combat/query/runtime-query.js';
import { addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';

import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  battleScarConsumed,
  revenantCastCompleted,
  revenantConditionApplied,
  revenantLifecycleAnchored,
  revenantStruck,
  revenantWeaponSwapped,
  type RevenantCastCompletion,
  type RevenantStrike
} from '#gw2/professions/revenant/core/mechanics/boundaries.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalInterval, canonicalTime, timeKey } from '#kernel/core/clock.js';
const REVENANT_ASSASSINS_PRESENCE = 'revenant.assassins-presence';

/** Owns Assassin's Presence tuning and behavior at its established execution boundaries. */
export const assassinsPresence = defineTrait({
  triggers: [onTriggerPoint(revenantLifecycleAnchored, { run: startRevenantAssassinsPresence })],
  lifetime: { tasks: { [REVENANT_ASSASSINS_PRESENCE]: revenantAssassinsPresencePulse } },
  id: TRAIT.ASSASSINS_PRESENCE,
  name: "Assassin's Presence",
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 10,
    effects: [
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Battle Scarred tuning and behavior at its established execution boundaries. */
export const battleScarred = defineTrait({
  triggers: [onTriggerPoint(revenantCastCompleted, { run: completeBattleScarred })],
  id: TRAIT.BATTLE_SCARRED,
  name: 'Battle Scarred',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'battle-scars',
        type: 'buff',
        kind: 'battle-scars',
        duration: 10,
        stacks: 5,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Brutality tuning and behavior at its established execution boundaries. */
export const brutality = defineTrait({
  triggers: [onTriggerPoint(revenantWeaponSwapped, { run: completeRevenantBrutality })],
  id: TRAIT.BRUTALITY,
  name: 'Brutality',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 9,
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Dance of Death tuning and behavior at its established execution boundaries. */
export const danceOfDeath = defineTrait({
  triggers: [onTriggerPoint(revenantConditionApplied, { run: reactDanceOfDeath })],
  id: TRAIT.DANCE_OF_DEATH,
  name: 'Dance of Death'
});

/** Owns Destructive Impulses tuning and behavior at its established execution boundaries. */
export const destructiveImpulses = defineTrait({
  id: TRAIT.DESTRUCTIVE_IMPULSES,
  name: 'Destructive Impulses',
  balance: {
    damageIncrease: 0.05,
    offhandDamageIncrease: 0.075,
    conditionDamageIncrease: 0.05,
    offhandConditionDamageIncrease: 0.075
  },
  modifierRules: [
    {
      id: 'revenant.destructive-impulses',
      order: 5,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context, target) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.DESTRUCTIVE_IMPULSES);
        const condition = target === MODIFIER_TARGET.CONDITION_DAMAGE;
        return balanceProfileNumber(
          profile,
          activeOffhand(context)
            ? condition
              ? 'offhandConditionDamageIncrease'
              : 'offhandDamageIncrease'
            : condition
              ? 'conditionDamageIncrease'
              : 'damageIncrease'
        );
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Expose Defenses tuning and behavior at its established execution boundaries. */
export const exposeDefensesTrait = defineTrait({
  triggers: [onTriggerPoint(battleScarConsumed, { run: exposeDefenses })],
  id: TRAIT.EXPOSE_DEFENSES,
  name: 'Expose Defenses',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Notoriety tuning and behavior at its established execution boundaries. */
export const notoriety = defineTrait({
  triggers: [onTriggerPoint(revenantCastCompleted, { run: completeNotoriety })],
  id: TRAIT.NOTORIETY,
  name: 'Notoriety',
  balance: {
    attributePerStack: 10,
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 2,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Swift Termination tuning and behavior at its established execution boundaries. */
export const swiftTermination = defineTrait({
  id: TRAIT.SWIFT_TERMINATION,
  name: 'Swift Termination',
  // Trait balance owns both the bonus and its supported target-health threshold.
  balance: { damageMultiplier: 1.2, threshold: 0.5 },
  modifierRules: [
    {
      id: 'revenant.swift-termination',
      order: 8,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SWIFT_TERMINATION), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        targetHealthBelow(
          context,
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SWIFT_TERMINATION), 'threshold')
        )
    }
  ]
});

/** Owns Targeted Destruction tuning and behavior at its established execution boundaries. */
export const targetedDestruction = defineTrait({
  id: TRAIT.TARGETED_DESTRUCTION,
  name: 'Targeted Destruction',
  balance: { damageIncreasePerStack: 0.005 },
  modifierRules: [
    {
      id: 'revenant.targeted-destruction',
      order: 7,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 +
        vulnerabilityStacks(context) *
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, TRAIT.TARGETED_DESTRUCTION),
            'damageIncreasePerStack'
          ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Thrill of Combat tuning and behavior at its established execution boundaries. */
export const thrillOfCombatTrait = defineTrait({
  triggers: [onTriggerPoint(revenantStruck, { run: thrillOfCombat })],
  id: TRAIT.THRILL_OF_COMBAT,
  name: 'Thrill of Combat',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 1,
    effects: [
      {
        name: 'battle-scars',
        type: 'buff',
        kind: 'battle-scars',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Unsuspecting Strikes tuning and behavior at its established execution boundaries. */
export const unsuspectingStrikes = defineTrait({
  id: TRAIT.UNSUSPECTING_STRIKES,
  name: 'Unsuspecting Strikes',
  // Trait balance owns both the bonus and its supported target-health threshold.
  balance: { damageMultiplier: 1.2, threshold: 0.8 },
  modifierRules: [
    {
      id: 'revenant.unsuspecting-strikes',
      order: 6,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.UNSUSPECTING_STRIKES), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        targetHealthFraction(context) >
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.UNSUSPECTING_STRIKES), 'threshold')
    }
  ]
});

function revenantAssassinsPresencePulse(runtime: RevenantRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ASSASSINS_PRESENCE);
  const core = runtime.profession.core;
  runtime.schedule(
    REVENANT_ASSASSINS_PRESENCE,
    canonicalTime(runtime.time + canonicalInterval(balanceProfileNumber(profile, 'cooldown'))),
    null,
    { id: REVENANT_ASSASSINS_PRESENCE, generation: core.assassinsPresenceGeneration }
  );
  if (!runtime.combatStartedAt()) return;
  const boon = requireEffect(profile, 'boon', 'fury');
  // The pulse cadence is trait-owned and continues; only the removed Fury packet is skipped.
  if (!boon) return;
  emitTraitProfile(runtime, TRAIT.ASSASSINS_PRESENCE, profile.id, undefined, {
    preserveName: true,
    effects: (effect) => effect === boon,
    attribution: {
      source: 'Trait',
      actorType: 'player',
      sourceId: TRAIT.ASSASSINS_PRESENCE,
      skillId: TRAIT.ASSASSINS_PRESENCE,
      skillName: profile.name
    },
    transform: (event) => ({
      ...event,
      sourceId: TRAIT.ASSASSINS_PRESENCE,
      skillId: TRAIT.ASSASSINS_PRESENCE,
      skillName: profile.name,
      audience: { recipients: 'party', maximumRecipients: 5 }
    })
  });
}

/** Assassin's Presence pulses on its own combat-anchored cadence; attacks neither trigger nor delay it. */
function startRevenantAssassinsPresence(runtime: RevenantRuntime, { at: anchor }: { readonly at: number }): void {
  const core = runtime.profession.core;
  runtime.cancelOwner({ id: REVENANT_ASSASSINS_PRESENCE, generation: core.assassinsPresenceGeneration });
  core.assassinsPresenceGeneration++;
  runtime.schedule(REVENANT_ASSASSINS_PRESENCE, anchor, null, {
    id: REVENANT_ASSASSINS_PRESENCE,
    generation: core.assassinsPresenceGeneration
  });
}

export function activeOffhand(context: Gw2ModifierContext): boolean {
  const set = context.runtime?.activeWeaponSet || 1;
  return Boolean(gw2ConfiguredWeaponSet(context.config, set)[1]);
}

/** React at the ordered strike boundary without changing the shared scar transaction. */
function exposeDefenses(runtime: RevenantRuntime, { cause: event }: RevenantStrike): void {
  const core = runtime.profession.core;
  if (core.exposeDefensesUsed || !runtime.combatStartedAt()) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EXPOSE_DEFENSES);
  const condition = requireEffect(profile, 'condition', 'Vulnerability');
  // The one-use opener belongs to its packet, so a removed packet leaves it unspent.
  if (!condition) return;
  core.exposeDefensesUsed = true;
  const name = String(condition.condition);
  emitTraitProfile(runtime, TRAIT.EXPOSE_DEFENSES, TRAIT.EXPOSE_DEFENSES, event, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'condition', name: 'Vulnerability' },
    attribution: {
      source: 'revenant',
      sourceId: TRAIT.EXPOSE_DEFENSES,
      actorType: 'player',
      skillId: TRAIT.EXPOSE_DEFENSES,
      skillName: 'Expose Defenses',
      name: `Expose Defenses — ${name}`
    }
  });
}

/** React at the ordered strike boundary without changing the shared scar transaction. */
function thrillOfCombat(runtime: RevenantRuntime, { cause: event }: RevenantStrike): void {
  const core = runtime.profession.core;
  const battleScars = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.THRILL_OF_COMBAT);
  const buff = requireEffect(profile, 'buff', 'battle-scars');
  // The cadence exists only to grant this buff, so a removed buff neither grants nor advances it.
  if (!buff) return;
  const interval = canonicalInterval(balanceProfileNumber(profile, 'cooldown'));
  const duration = Math.max(0, effectNumber(profile, buff, 'duration'));
  const maximum = balanceProfileNumber(battleScars, 'maximumStacks');
  if (core.nextThrillOfCombatAt == null)
    core.nextThrillOfCombatAt = canonicalTime((core.combatBeganAt ?? runtime.time) + interval);
  const next = core.nextThrillOfCombatAt;
  if (!Number.isFinite(next) || next > runtime.time) return;
  // Count only elapsed canonical intervals, so a later grant never enters the live stack pool.
  const elapsed = Math.floor((timeKey(runtime.time) - timeKey(next)) / timeKey(interval)) + 1;
  let granted = 0;
  for (let index = Math.max(0, elapsed - Math.ceil(duration / interval)); index < elapsed; index += 1) {
    // Each elapsed interval grants its authored count at the historical time, preserving expiry and cap ordering.
    const result = addTimedStacks(
      core.battleScars,
      effectNumber(profile, buff, 'stacks'),
      canonicalTime(next + index * interval),
      duration,
      maximum
    );
    core.battleScars = result.expiries;
    granted += result.added;
  }

  core.nextThrillOfCombatAt = canonicalTime(next + elapsed * interval);
  if (!granted) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      actorType: 'player',
      sourceId: TRAIT.THRILL_OF_COMBAT,
      skillId: TRAIT.THRILL_OF_COMBAT,
      skillName: 'Thrill of Combat',
      name: 'Thrill of Combat — Battle Scars',
      kind: 'battle-scars',
      duration,
      stacks: granted
    },
    cause: event
  });
}

/** Runs the trait at its original ordered mechanic boundary. */
function completeBattleScarred(runtime: RevenantRuntime, { cast }: RevenantCastCompletion): void {
  const skill = cast.skill;
  if (skill.slot === 'Heal') {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BATTLE_SCARRED);
    const buff = requireEffect(profile, 'buff', 'battle-scars');
    if (buff)
      grantBattleScars(runtime, {
        stacks: effectNumber(profile, buff, 'stacks'),
        sourceId: TRAIT.BATTLE_SCARRED,
        sourceName: 'Battle Scarred',
        duration: effectNumber(profile, buff, 'duration')
      });
  }
}

/** Runs the trait at its original ordered mechanic boundary. */
function reactDanceOfDeath(runtime: RevenantRuntime, { cause: event }: RevenantStrike): void {
  if (event.condition === 'Vulnerability')
    grantBattleScars(runtime, {
      stacks: event.stacks || 0,
      sourceId: TRAIT.DANCE_OF_DEATH,
      sourceName: 'Dance of Death',
      cause: event
    });
}

/** Adds expiring Battle Scars up to the shared cap and publishes only the stacks actually granted. */
function grantBattleScars(
  runtime: RevenantRuntime,
  {
    stacks,
    sourceId,
    sourceName,
    duration: authored,
    cause = null
  }: {
    readonly stacks: number;
    readonly sourceId: SkillId;
    readonly sourceName: string;
    readonly duration?: number;
    readonly cause?: Gw2ResolverEvent | null;
  }
): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  let duration = authored;
  // Grants without their own duration inherit the core buff's; removing that buff leaves them nothing to grant.
  if (duration === undefined) {
    const buff = requireEffect(profile, 'buff', 'battle-scars');
    if (!buff) return;
    duration = effectNumber(profile, buff, 'duration');
  }

  duration = Math.max(0, duration);
  const core = runtime.profession.core;
  const { expiries, added } = addTimedStacks(
    core.battleScars,
    stacks,
    runtime.time,
    duration,
    balanceProfileNumber(profile, 'maximumStacks')
  );
  core.battleScars = expiries;
  if (!added) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId,
      actorType: 'player',
      skillId: sourceId,
      skillName: sourceName,
      name: `${sourceName} — Battle Scars`,
      kind: 'battle-scars',
      duration,
      stacks: added
    },
    cause
  });
}

/** A committed weapon swap grants Brutality's Quickness once per its internal cooldown. */
function completeRevenantBrutality(runtime: RevenantRuntime, { cast }: RevenantCastCompletion): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.BRUTALITY);
  const boon = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!boon) return;
  if (!runtime.procs.claimCooldown('brutality', runtime.time, balanceProfileNumber(profile, 'cooldown'))) return;
  emitTraitProfile(runtime, TRAIT.BRUTALITY, profile.id, undefined, {
    preserveName: true,
    effects: (effect) => effect === boon,
    attribution: {
      source: 'Trait',
      actorType: 'player',
      sourceId: TRAIT.BRUTALITY,
      skillId: TRAIT.BRUTALITY,
      skillName: 'Brutality',
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      sourceId: TRAIT.BRUTALITY,
      skillId: TRAIT.BRUTALITY,
      skillName: 'Brutality',
      name: 'Brutality — quickness',
      activationId: cast.id
    })
  });
}

/** Runs the trait at its original ordered mechanic boundary. */
function completeNotoriety(runtime: RevenantRuntime, { cast }: RevenantCastCompletion): void {
  const skill = cast.skill;
  if (runtime.combatStartedAt() && isLegendaryStanceSkill(skill)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.NOTORIETY);
    const boon = requireEffect(profile, 'boon', 'might');
    if (boon)
      emitTraitProfile(runtime, TRAIT.NOTORIETY, profile.id, undefined, {
        preserveName: true,
        effects: (effect) => effect === boon,
        attribution: {
          source: 'Trait',
          actorType: 'player',
          sourceId: TRAIT.NOTORIETY,
          skillId: skill.id,
          skillName: skill.name,
          activationId: cast.id
        },
        transform: (event) => ({
          ...event,
          sourceId: TRAIT.NOTORIETY,
          skillId: skill.id,
          skillName: skill.name,
          name: 'Notoriety — might',
          activationId: cast.id
        })
      });
  }
}

function isLegendaryStanceSkill(skill: RevenantSkill): boolean {
  if (['Heal', 'Utility', 'Elite'].includes(String(skill.slot || '')) && skill.legendId) return true;
  return skill.type === 'Profession';
}
