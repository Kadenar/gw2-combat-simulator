import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { effectFirstAtMs, strikeEffectCoefficient } from '#gw2/platform/effects/authoring.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';

/** Owns Legendary Assassin Stance skill fragments and their alternate identities. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const REVENANT_ASSASSIN_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ENCHANTED_DAGGERS]: {
    cooldown: 30,
    energyCost: 5,
    legendId: 'LegendaryAssassin',
    // Charges feed the strike-triggered siphon defined below.
    castTimeMs: 360,
    effects: [
      {
        name: 'enchanted-daggers',
        type: 'buff',
        kind: 'enchanted-daggers',
        duration: 15,
        stacks: 6,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        damageKind: 'life-steal',
        flatStrikeBase: 1028,
        flatStrikePowerCoeff: 0.06,
        name: 'Enchanted Daggers — Siphon Damage',
        actorType: ACTOR.EFFECT
      }
    ],
    // The commit lifecycle reads these effects as its payload, so the cast itself emits none.
    effectVariants: [{ when: () => true, transform: () => [] }],
    // The skill-owned lifecycle arms charges on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.enchanted-daggers' } }]
  },
  [ID.RELINQUISH_POWER]: {
    cooldown: 0,
    energyCost: 0,
    legendId: 'LegendaryAssassin',
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    castTimeMs: 0,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-upkeep' } }]
  },
  [ID.IMPOSSIBLE_ODDS]: {
    cooldown: 0,
    energyCost: 5,
    upkeepCost: 6,
    manualReleaseCooldown: 1,
    // Exhausting Energy locks the upkeep for four seconds from starvation.
    starvationCooldown: 4,
    pulseInterval: 1,
    // Space eligible by 280 ms independently of upkeep pulses and the strike delay.
    triggerIntervalMs: 280,
    legendId: 'LegendaryAssassin',
    // Shared upkeep owns the drain and release; qualifying strikes trigger the follow-up defined below.
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.65 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Impossible Odds',
        actorType: ACTOR.EFFECT
      }
    ],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } }
    ]
  },
  [ID.PHASE_TRAVERSAL]: {
    cooldown: 5,
    energyCost: 30,
    legendId: 'LegendaryAssassin',
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Phase Traversal',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.JADE_WINDS]: {
    cooldown: 10,
    energyCost: 35,
    legendId: 'LegendaryAssassin',
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Jade Winds',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 6,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.RIPOSTING_SHADOWS]: {
    cooldown: 0,
    energyCost: 30,
    legendId: 'LegendaryAssassin',
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 6,
        stacks: 1
      }
    ]
  }
});

/** A ready, unexpired Enchanted Daggers charge becomes a delayed siphon after a landed player strike. */
export function enchantedDaggers(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const daggers = runtime.profession.core.enchantedDaggers;

  if (
    event.skillId === ID.ENCHANTED_DAGGERS ||
    !((daggers.charges || 0) > 0) ||
    !isInternalCooldownReady(runtime.time, daggers.readyAt || 0)
  )
    return;

  const skill = runtime.helpers.skillsById.get(ID.ENCHANTED_DAGGERS);

  if (!skill) throw new Error('Missing Enchanted Daggers skill declaration.');

  const strike = requireEffect(skill, 'strike', 'Enchanted Daggers — Siphon Damage');
  const buff = requireEffect(skill, 'buff', 'enchanted-daggers');

  // Charges exist only to deliver the siphon, so a removed strike leaves them unspent.
  if (!strike || !buff) return;

  const totalHits = effectNumber(skill, buff, 'stacks');
  const delay = (strike.atMs || 0) / 1000;

  if (!consumeCharge(daggers, runtime.time, delay)) return;

  // Preserve strict same-timestamp gating even when a patched strike has no delay.
  if (delay === 0) daggers.readyAt = runtime.time;

  emitEnchantedDagger(runtime, event, totalHits - daggers.charges, totalHits);
}

/** A single delayed siphon is independent of how the healing skill armed its charges. */
function emitEnchantedDagger(runtime: RevenantRuntime, event: Gw2ResolverEvent, hitIndex = 1, totalHits = 1): void {
  const skill = runtime.helpers.skillsById.get(ID.ENCHANTED_DAGGERS)!;
  const strike = requireEffect(skill, 'strike', 'Enchanted Daggers — Siphon Damage');

  if (!strike) return;

  const delay = (strike.atMs || 0) / 1000;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverStrike({
      at: canonicalTime(runtime.time + delay),
      source: 'revenant',
      sourceId: ID.ENCHANTED_DAGGERS,
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER,
      skillId: ID.ENCHANTED_DAGGERS,
      skillName: 'Enchanted Daggers',
      // The armed heal owns this siphon; its causal hit must not absorb the damage in isolated previews.
      procType: 'profession',
      icon: skill.icon,
      name: 'Enchanted Daggers — Siphon Damage',
      coefficient: 0,
      damageKind: strike.damageKind,
      flatStrikeBase: effectNumber(skill, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(skill, strike, 'flatStrikePowerCoeff'),
      canCrit: false,
      hitIndex,
      totalHits
    })
  });
}

/** A committed Enchanted Daggers arms its finite charge window at completion. */
function completeRevenantEnchantedDaggers(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const buff = requireEffect(cast.skill, 'buff', 'enchanted-daggers');

  // Charges are the buff's stacks, so a removed buff arms nothing.
  if (!buff) return;

  const charges = Math.max(0, effectNumber(cast.skill, buff, 'stacks'));
  const duration = Math.max(0, effectNumber(cast.skill, buff, 'duration'));
  runtime.profession.core.enchantedDaggers = {
    ...grantCharges(charges, runtime.time + duration),
    readyAt: runtime.time
  };
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...{
        type: 'buff',
        at: runtime.time,
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: ACTOR.PLAYER,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        name: 'Enchanted Daggers',
        kind: 'enchanted-daggers',
        duration,
        stacks: charges
      },
      fixedDuration: true
    }
  });
}

/** Enchanted Daggers owns its charge activation, custom payloads, and isolated damage preview. */
export const enchantedDaggersLifecycle = {
  damageEffects: [
    {
      id: 'enchanted-daggers',
      name: 'Enchanted Daggers',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [ID.ENCHANTED_DAGGERS],
      emit: (runtime) => emitEnchantedDagger(runtime, damageInputEvent(runtime))
    }
  ],
  sideEffectHandlers: {
    'revenant.enchanted-daggers'(runtime, context) {
      if (context.kind === 'cast') completeRevenantEnchantedDaggers(runtime, context.cast);
    }
  }
} satisfies RuntimeHooks<RevenantRuntimeState, RevenantSkill>;

/** Only eligible owned strikes may trigger the Assassin upkeep without recursive procs. */
function triggersImpossibleOdds(event: Gw2ResolverEvent): boolean {
  return (
    (event.coefficient || 0) > 0 &&
    event.skillId !== ID.IMPOSSIBLE_ODDS &&
    // Form attacks inherit player modifiers but must not recursively trigger on-hit attacks.
    event.skillId !== ID.LESSER_ENCHANTED_DAGGERS &&
    event.skillId !== ID.FORM_OF_THE_DERVISH_ATTACK &&
    event.skillId !== ID.FORM_OF_THE_DERVISH_ATTACK_ELITE &&
    // Only Assassin's final shockwave triggers a follow-up.
    (event.skillId !== ID.RELEASE_POTENTIAL_ASSASSIN || event.hitIndex === event.totalHits) &&
    // Player-owned strikes include equipment effects; display source labels do not gate the proc.
    (event.actorType === ACTOR.PLAYER || (event.actorType === ACTOR.EFFECT && isGw2PlayerModifierOwnedEvent(event)))
  );
}

/** An accepted qualifying strike launches Impossible Odds' follow-up while the upkeep is active and ready. */
export function reactRevenantImpossibleOdds(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (!triggersImpossibleOdds(event) || !activeRevenantUpkeep(runtime, ID.IMPOSSIBLE_ODDS)) return;

  // Integer clock keys allow the expiry instant without admitting hits just before it.
  if (timeKey(runtime.time) < timeKey(runtime.procs.deadline('impossibleOdds') || 0)) return;

  const impossible = runtime.helpers.skillsById.get(ID.IMPOSSIBLE_ODDS);
  const strike = impossible && requireEffect(impossible, 'strike', 'Impossible Odds');

  // The trigger interval gates only this strike, so a removed strike leaves it ready.
  if (!impossible || !strike) return;

  runtime.procs.setDeadline('impossibleOdds', canonicalTime(runtime.time + (impossible.triggerIntervalMs || 0) / 1000));
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverStrike({
      at: canonicalTime(runtime.time + (effectFirstAtMs(strike) || 0) / 1000),
      source: 'revenant',
      sourceId: impossible.id,
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER,
      skillId: impossible.id,
      skillName: 'Impossible Odds',
      name: 'Impossible Odds',
      triggeredBy: event.skillName || event.name || undefined,
      coefficient: strikeEffectCoefficient(strike),
      skillWeapon: 'Unequipped',
      canTriggerCriticalSigils: true
    })
  });
}
