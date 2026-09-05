/**
 * Owns Beguiling Haze, Hex-Eater Vortex, Gladiator's Defense, and Twin Moon Sweep cast behavior.
 * Handler registration lives in sibling `index.ts`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  conditionEffectTicks,
  strikeEffectCoefficient,
  strikeEffectTicks
} from '#gw2/platform/engine/effects/timelines.js';
import {
  balanceProfileEffect as effectByType,
  balanceProfileFromContext as balanceProfileById
} from '#gw2/platform/combat/state/balance-profiles.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { beginBeguilingHaze } from '#gw2/professions/revenant/specializations/conduit/mechanics/beguiling-haze.js';
import {
  conduitEffectAt as effectAt,
  conduitFirstConditionTick as firstConditionTick,
  conduitHasLegend as hasLegend,
  conduitSkillWeapon,
  conduitStrikeCoefficient as strikeCoefficient
} from '#gw2/professions/revenant/specializations/conduit/execution/helpers.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

function sharedWisdomEffect(context: RevenantSchedulerContext, trigger: string): SkillEffect | undefined {
  return balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.sharedWisdom)?.effects?.find(
    (effect) => effect.metadata?.trigger === trigger
  );
}

/** Emits Beguiling Haze or consumes one of its follow-up charges. */
export function castBeguilingHaze(context: RevenantCastContext, skill: RevenantSkill): void {
  const followUp = beginBeguilingHaze(context);
  const profile = followUp ? balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp) : skill;
  const strike = effectByType(profile, 'strike');
  const tick = strike?.type === 'strike' ? strikeEffectTicks(strike)[0] : undefined;
  const at = context.start + Math.max(0, Number(tick?.atMs || 0)) / 1000;
  if (followUp) {
    emitSkillDamage(context, skill, {
      at,
      coefficient: Number(tick?.coefficient || 0),
      name: 'Beguiling Haze — Follow-Up',
      skillWeapon: conduitSkillWeapon(context, skill),
      canCrit: null
    });
  } else {
    emitSkillDamage(context, skill, {
      at,
      coefficient: Number(tick?.coefficient || 0),
      name: 'Beguiling Haze',
      skillWeapon: conduitSkillWeapon(context, skill),
      canCrit: null
    });
  }

  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    const shared = sharedWisdomEffect(context, 'beguiling-haze');
    if (shared?.type === 'boon' && shared.boon) {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        name: `${skill.name} — ${shared.boon}`,
        kind: shared.boon,
        duration: Number(shared.duration || 0),
        stacks: Number(shared.stacks ?? 1)
      });
    }
  }
}

function activeSelfConditions(context: RevenantCastContext, at: number): number {
  const state = professionCoreState(context);
  // Prune expired dynamic entries before counting; the count represents conditions currently afflicting the player.
  state.selfConditions = state.selfConditions.filter((application) => Number(application.expiresAt || 0) > at);
  // selfConditionCount is a static config value representing pre-existing/simulated conditions (e.g. from Mesmer RP).
  const configured = Math.max(0, Number(state.selfConditionCount || 0));
  return configured + state.selfConditions.length;
}

/** Resolves projectile-count-scaled Hex Eater Vortex effects. */
export function castHexEaterVortex(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const strike = (skill.effects || []).find((effect) => effect.type === 'strike');
  const torment = (skill.effects || []).find((effect) => effect.type === 'condition');
  const strikeTicks = strike?.type === 'strike' ? strike.ticks || [] : [];
  const tormentTicks = torment?.type === 'condition' ? torment.ticks || [] : [];
  const maximumProjectiles = Math.min(strikeTicks.length, tormentTicks.length);
  // Demon legend fires all 6 projectiles regardless of self-condition count; others are limited by active conditions.
  const projectileCount = hasLegend(context, LEGEND.DEMON)
    ? maximumProjectiles
    : Math.min(maximumProjectiles, activeSelfConditions(context, at));
  // Conditions removed is capped at the actual active count even when Demon fires the full projectile salvo.
  const conditionsRemoved = Math.min(maximumProjectiles, activeSelfConditions(context, at));
  if (conditionsRemoved > 0) {
    // Deplete static (configured) conditions first, then peel dynamic (runtime) ones oldest-first.
    const configuredRemoved = Math.min(conditionsRemoved, Number(state.selfConditionCount || 0));
    state.selfConditionCount -= configuredRemoved;
    state.selfConditions.splice(0, conditionsRemoved - configuredRemoved);
  }

  for (let index = 0; index < projectileCount; index += 1) {
    const strikeTick = strikeTicks[index];
    const tormentTick = tormentTicks[index];
    const projectileAt = context.start + Number(strikeTick.atMs || 0) / 1000;
    emitSkillDamage(context, skill, {
      at: projectileAt,
      coefficient: Number(strikeTick.coefficient || 0),
      name: `Hex-Eater Vortex — Projectile ${index + 1}`,
      hitIndex: index + 1,
      totalHits: projectileCount,
      skillWeapon: conduitSkillWeapon(context, skill),
      canCrit: null
    });
    emitSkillCondition(context, skill, {
      at: projectileAt,
      condition: String(tormentTick.condition || 'Torment'),
      stacks: Number(tormentTick.stacks ?? 1),
      duration: Number(tormentTick.duration || 0),
      name: `Hex-Eater Vortex — Projectile ${index + 1}`
    });
  }

  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    const shared = sharedWisdomEffect(context, 'hex-eater-vortex');
    if (shared?.type === 'boon' && shared.boon) {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        name: `${skill.name} — ${shared.boon}`,
        kind: shared.boon,
        duration: Number(shared.duration || 0),
        stacks: Number(shared.stacks ?? 1)
      });
    }
  }

  emitRevenantStateSnapshot(context, at, 'hex-eater-vortex');
}

/** Resolves Gladiator's Defense and its legend/trait-dependent boons. */
export function castGladiatorsDefense(context: RevenantCastContext, skill: RevenantSkill): void {
  const strike = (skill.effects || []).find((effect) => effect.type === 'strike');
  if (strike?.type === 'strike') {
    emitSkillDamage(context, skill, {
      at: context.effectiveEnd,
      coefficient: strikeEffectCoefficient(strike),
      skillWeapon: conduitSkillWeapon(context, skill),
      canCrit: null
    });
  }

  for (const effect of skill.effects || []) {
    if (effect.type === 'condition') {
      for (const tick of conditionEffectTicks(effect)) {
        emitSkillCondition(context, skill, {
          at: context.effectiveEnd,
          condition: tick.condition,
          stacks: Number(tick.stacks ?? 1),
          duration: Number(tick.duration || 0)
        });
      }
    } else if (effect.type === 'boon' && effect.boon) {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        name: `${skill.name} — ${effect.boon}`,
        kind: effect.boon,
        duration: Number(effect.duration || 0),
        stacks: Number(effect.stacks ?? 1)
      });
    }
  }

  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    const shared = sharedWisdomEffect(context, 'gladiators-defense');
    if (shared?.type === 'boon' && shared.boon) {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        name: `${skill.name} — ${shared.boon}`,
        kind: shared.boon,
        duration: Number(shared.duration || 0),
        stacks: Number(shared.stacks ?? 1)
      });
    }
  }
}

/** Emits both Twin Moon attackers and every equipped-legend resonance. */
export function castTwinMoonSweep(context: RevenantCastContext, skill: RevenantSkill): void {
  const mainStrikes = (skill.effects || []).filter((effect) => effect.type === 'strike' && !effect.metadata?.legendId);
  const bleeding = (skill.effects || []).find(
    (effect) => effect.type === 'condition' && firstConditionTick(effect, 'Bleeding') && !effect.metadata?.legendId
  );
  const bleedingTicks = bleeding?.type === 'condition' ? conditionEffectTicks(bleeding) : [];
  const might = (skill.effects || []).find((effect) => effect.type === 'boon' && effect.boon === 'might');
  const at = effectAt(context, bleeding || might || mainStrikes[0]);
  const packets = Math.max(0, Number(bleedingTicks.length || (might?.applications ?? mainStrikes.length)));
  // Only the player hit carries affinityOnHit so the single affinity gain fires once per cast, not twice.
  emitSkillDamage(context, skill, {
    at,
    coefficient: strikeCoefficient(mainStrikes[0]),
    name: 'Twin Moon Sweep — Player',
    hitIndex: 1,
    totalHits: mainStrikes.length,
    skillWeapon: conduitSkillWeapon(context, skill),
    canCrit: null,
    metadata: { affinityOnHit: true }
  });
  emitSkillDamage(context, skill, {
    at,
    coefficient: strikeCoefficient(mainStrikes[1]),
    name: 'Twin Moon Sweep — Fragment',
    actorType: 'player',
    hitIndex: 2,
    totalHits: mainStrikes.length,
    skillWeapon: conduitSkillWeapon(context, skill),
    canCrit: null
  });
  for (let index = 0; index < packets; index += 1) {
    const bleedingTick = bleedingTicks[index] || bleedingTicks[0];
    emitSkillCondition(context, skill, {
      at,
      condition: String(bleedingTick?.condition || 'Bleeding'),
      stacks: Number(bleedingTick?.stacks ?? 1),
      duration: Number(bleedingTick?.duration || 0),
      name: `Twin Moon Sweep — Bleeding ${index + 1}`
    });
    emitSkillBuff(context, skill, {
      at,
      name: `Twin Moon Sweep — Might ${index + 1}`,
      kind: String(might?.boon || 'might'),
      duration: Number(might?.duration || 0),
      stacks: Number(might?.stacks ?? 1)
    });
  }

  const immobilized = (skill.effects || []).find(
    (effect) => effect.type === 'condition' && effect.metadata?.legendId === LEGEND.ASSASSIN
  );
  const immobilizedTick = firstConditionTick(immobilized, 'Immobilized');
  if (hasLegend(context, LEGEND.ASSASSIN)) {
    emitSkillCondition(context, skill, {
      at,
      condition: String(immobilizedTick?.condition || 'Immobilized'),
      stacks: Number(immobilizedTick?.stacks ?? 1),
      duration: Number(immobilizedTick?.duration || 0)
    });
  }

  if (hasLegend(context, LEGEND.DEMON)) {
    const shatter = (skill.effects || []).find(
      (effect) => effect.type === 'strike' && effect.metadata?.legendId === LEGEND.DEMON
    );
    const confusion = (skill.effects || []).find(
      (effect) => effect.type === 'condition' && effect.metadata?.legendId === LEGEND.DEMON
    );
    const shatterTicks = shatter?.type === 'strike' ? strikeEffectTicks(shatter) : [];
    for (const [index, tick] of shatterTicks.entries()) {
      emitSkillDamage(context, skill, {
        at: effectAt(context, shatter, tick.atMs),
        coefficient: Number(tick.coefficient || 0),
        name: `Twin Moon Sweep — Shatter ${index + 1}`,
        hitIndex: index + 1,
        totalHits: shatterTicks.length,
        skillWeapon: conduitSkillWeapon(context, skill),
        canCrit: null
      });
    }

    const confusionTicks = confusion?.type === 'condition' ? conditionEffectTicks(confusion) : [];
    for (const [index, tick] of confusionTicks.entries()) {
      emitSkillCondition(context, skill, {
        at: effectAt(context, confusion, tick.atMs),
        condition: String(tick.condition || 'Confusion'),
        stacks: Number(tick.stacks ?? 1),
        duration: Number(tick.duration || 0),
        name: `Twin Moon Sweep — Confusion ${index + 1}`
      });
    }
  }

  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    const shared = sharedWisdomEffect(context, 'twin-moon-sweep');
    const applications = Math.max(0, Number(shared?.applications || 0));
    for (let index = 0; index < applications; index += 1) {
      emitSkillBuff(context, skill, {
        at,
        name: `Shared Wisdom — Might ${index + 1}`,
        kind: String(shared?.boon || 'might'),
        duration: Number(shared?.duration || 0),
        stacks: Number(shared?.stacks ?? 1)
      });
    }
  }
}
