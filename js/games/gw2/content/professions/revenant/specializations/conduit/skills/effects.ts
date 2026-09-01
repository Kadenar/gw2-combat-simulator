import { conduitState } from '#gw2/content/professions/revenant/specializations/conduit/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/content/professions/revenant/state.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
/**
 * Conduit and Legendary Entity skill effects.
 *
 * Owns Entity skill packets, legend resonances, Shared Wisdom additions,
 * Release Potential variants, and Cosmic Wisdom activation.
 */
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from '#gw2/content/professions/revenant/data/legends.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient,
  strikeEffectTicks
} from '#gw2/platform/engine/effects/timelines.js';
import {
  balanceProfileEffect as effectByType,
  balanceProfileFromContext as balanceProfileById
} from '#gw2/platform/combat/state/balance-profiles.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/content/professions/revenant/specializations/conduit/skills/index.js';
import {
  emitNuminousGift,
  syncConduitEnergyCostOverrides
} from '#gw2/content/professions/revenant/specializations/conduit/mechanics/affinity.js';
import type { SchedulerRecord, SkillEffect } from '#gw2/platform/engine/types.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/content/professions/revenant/types.js';

function hasLegend(context: RevenantSchedulerContext, legendId: string): boolean {
  return professionCoreState(context).selectedLegendIds.includes(legendId);
}

function effectAt(context: RevenantCastContext, effect: SkillEffect | undefined, atMs?: number): number {
  const origin = effect?.timingAnchor === 'castEnd' ? context.fullEnd : context.start;
  const packetAtMs =
    atMs ?? (effect?.type === 'strike' || effect?.type === 'condition' ? effectFirstAtMs(effect) : effect?.atMs);
  return origin + Math.max(0, Number(packetAtMs || 0)) / 1000;
}

function strikeCoefficient(effect: SkillEffect | undefined): number {
  return effect?.type === 'strike' ? strikeEffectCoefficient(effect) : 0;
}

function firstConditionTick(effect: SkillEffect | undefined, condition?: string) {
  if (effect?.type !== 'condition') return undefined;
  return conditionEffectTicks(effect).find((tick) => condition == null || tick.condition === condition);
}

function sharedWisdomEffect(context: RevenantSchedulerContext, trigger: string): SkillEffect | undefined {
  return balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.sharedWisdom)?.effects?.find(
    (effect) => effect.metadata?.trigger === trigger
  );
}

function effectiveAffinity(context: RevenantSchedulerContext): number {
  // Kinetic Insight contributes a virtual +2 to affinity for scaling calculations without mutating actual state.
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT) ? 2 : 0;
  const affinityProfile = balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.affinity);
  return Math.min(
    Math.max(1, Number(affinityProfile?.maximumStacks || 1)),
    Number(conduitState.from(context).affinity || 0) + bonus
  );
}

function targetsHit(context: RevenantCastContext, maximum = 5): number {
  // Command-level override takes priority so per-skill target counts can differ from the global config value.
  return Math.max(
    1,
    Math.min(
      maximum,
      Math.trunc(
        Number(
          (context.command as unknown as SchedulerRecord).targetsHit ??
            context.config.targetsHit ??
            context.config.targetCount ??
            1
        )
      )
    )
  );
}

function activeWeapon(context: RevenantSchedulerContext): string | undefined {
  // activeWeaponSet is 1-indexed; value 2 means the swap weapon set is currently active.
  const weaponSet = Number(context.state.activeWeaponSet) === 2 ? 2 : 1;
  return gw2PrimaryWeapon(context.config, weaponSet);
}

// Profession attacks inherit the active weapon; slot and triggered attacks use
// standard level-based strength unless their skill declares a weapon directly.
function conduitSkillWeapon(context: RevenantSchedulerContext, skill: RevenantSkill): string | undefined {
  return skill.weapon || (skill.type === 'Profession' ? activeWeapon(context) : 'Unequipped');
}

/** Emits Beguiling Haze or consumes one of its follow-up charges. */
export function castBeguilingHaze(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = conduitState.from(context);
  // Charges > 0 means this is a follow-up cast; the main cast and follow-ups share the same handler id.
  const followUp = Number(state.beguilingHazeCharges || 0) > 0;
  const profile = followUp ? balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp) : skill;
  const strike = effectByType(profile, 'strike');
  const tick = strike?.type === 'strike' ? strikeEffectTicks(strike)[0] : undefined;
  const at = context.start + Math.max(0, Number(tick?.atMs || 0)) / 1000;
  if (followUp) {
    state.beguilingHazeCharges -= 1;
    emitSkillDamage(context, skill, {
      at,
      coefficient: Number(tick?.coefficient || 0),
      name: 'Beguiling Haze — Follow-Up',
      skillWeapon: conduitSkillWeapon(context, skill),
      canCrit: null
    });
  } else {
    // Register this cast's reservationId so completeBeguilingHaze can arm follow-up charges for exactly this cast.
    state.beguilingHazeMainReservations.push(context.reservationId);
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
        stacks: Number(shared.stacks || 1)
      });
    }
  }

  emitRevenantStateSnapshot(context, context.effectiveEnd, 'beguiling-haze');
}

/** Arms Beguiling Haze follow-up charges after the primary cast completes. */
export function completeBeguilingHaze(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.handlerId !== 'revenant.beguiling-haze') return;
  const state = conduitState.from(context);
  // Only the cast whose reservationId was registered in castBeguilingHaze qualifies as the main cast.
  const index = state.beguilingHazeMainReservations.indexOf(context.reservationId);
  const mainCast = index >= 0;
  if (mainCast) {
    state.beguilingHazeMainReservations.splice(index, 1);
    const followUpProfile = balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp);
    state.beguilingHazeCharges = Math.max(0, Number(followUpProfile?.maximumStacks || 0));
    // Recharge has already been calculated by the platform, including Alacrity and patch edits.
    state.beguilingHazeReadyAt = Number(
      context.state.cooldowns.get(skill.id) ?? context.state.ammo.get(skill.id)?.nextRechargeAt ?? context.effectiveEnd
    );
  }

  // Mirror ConduitState into the platform ammo/cooldown system so the UI and scheduler agree.
  const ammo = context.state.ammo.get(skill.id);
  if (ammo) {
    if (state.beguilingHazeCharges > 0) {
      // While follow-up charges are available, present them as an ammo-style skill with no cooldown timer.
      ammo.maximum = state.beguilingHazeCharges;
      ammo.charges = state.beguilingHazeCharges;
      ammo.nextRechargeAt = null;
      context.state.cooldowns.delete(skill.id);
    } else {
      // Follow-up charges are temporary. Only the main cast rearms when its
      // original cooldown finishes.
      ammo.maximum = 1;
      ammo.charges = 0;
      ammo.rechargeDuration = Math.max(0, state.beguilingHazeReadyAt - context.effectiveEnd);
      ammo.nextRechargeAt = state.beguilingHazeReadyAt;
      context.state.cooldowns.set(skill.id, state.beguilingHazeReadyAt);
    }
  }

  emitRevenantStateSnapshot(context, context.effectiveEnd, 'beguiling-haze-follow-up');
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
      stacks: Number(tormentTick.stacks || 1),
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
        stacks: Number(shared.stacks || 1)
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
          stacks: Number(tick.stacks || 1),
          duration: Number(tick.duration || 0)
        });
      }
    } else if (effect.type === 'boon' && effect.boon) {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        name: `${skill.name} — ${effect.boon}`,
        kind: effect.boon,
        duration: Number(effect.duration || 0),
        stacks: Number(effect.stacks || 1)
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
        stacks: Number(shared.stacks || 1)
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
  const packets = Math.max(0, Number(bleedingTicks.length || might?.applications || mainStrikes.length));
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
      stacks: Number(bleedingTick?.stacks || 1),
      duration: Number(bleedingTick?.duration || 0),
      name: `Twin Moon Sweep — Bleeding ${index + 1}`
    });
    emitSkillBuff(context, skill, {
      at,
      name: `Twin Moon Sweep — Might ${index + 1}`,
      kind: String(might?.boon || 'might'),
      duration: Number(might?.duration || 0),
      stacks: Number(might?.stacks || 1)
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
      stacks: Number(immobilizedTick?.stacks || 1),
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
        stacks: Number(tick.stacks || 1),
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
        stacks: Number(shared?.stacks || 1)
      });
    }
  }
}

/** Resolves the active Release Potential variant from affinity and legends. */
export function castReleasePotential(context: RevenantCastContext, skill: RevenantSkill): void {
  const affinity = effectiveAffinity(context);
  // At affinity ≥ 3 the skill gains effects from all equipped legends even if they are not currently active.
  const affinityProfile = balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.affinity);
  const allLegendEffects = affinity >= Math.max(0, Number(affinityProfile?.minimumStacks || 0));
  const strike = (skill.effects || []).find((effect) => effect.type === 'strike');
  const conditions = (skill.effects || []).filter((effect) => effect.type === 'condition');
  const boons = (skill.effects || []).filter((effect) => effect.type === 'boon');
  switch (skill.id) {
    case ID.RELEASE_POTENTIAL_MONK:
      for (const effect of boons) {
        if (effect.type !== 'boon' || !effect.boon) continue;
        emitSkillBuff(context, skill, {
          at: context.effectiveEnd,
          name: `${skill.name} — ${effect.boon}`,
          kind: effect.boon,
          duration: Number(effect.duration || 0),
          stacks: Number(effect.stacks || 1)
        });
      }

      break;
    case ID.RELEASE_POTENTIAL_DERVISH: {
      const impactAt = effectAt(context, strike);
      emitSkillDamage(context, skill, {
        at: impactAt,
        coefficient: strikeCoefficient(strike),
        skillWeapon: conduitSkillWeapon(context, skill),
        canCrit: null
      });
      const bleeding = conditions.find((effect) => effect.metadata?.legendId === LEGEND.DEMON);
      const bleedingTick = firstConditionTick(bleeding, 'Bleeding');
      if (hasLegend(context, LEGEND.DEMON) || allLegendEffects) {
        emitSkillCondition(context, skill, {
          at: impactAt,
          condition: String(bleedingTick?.condition || 'Bleeding'),
          stacks: Number(bleedingTick?.stacks || 1),
          duration: Number(bleedingTick?.duration || 0)
        });
      }

      if (hasLegend(context, LEGEND.CENTAUR) || allLegendEffects) {
        for (const effect of boons.filter((candidate) => candidate.metadata?.legendId === LEGEND.CENTAUR)) {
          if (effect.type !== 'boon' || !effect.boon) continue;
          emitSkillBuff(context, skill, {
            at: impactAt,
            name: `${skill.name} — ${effect.boon}`,
            kind: effect.boon,
            duration: Number(effect.duration || 0),
            stacks: Number(effect.stacks || 1)
          });
        }
      }

      break;
    }

    case ID.RELEASE_POTENTIAL_MESMER: {
      const impactAt = effectAt(context, strike);
      emitSkillDamage(context, skill, {
        at: impactAt,
        coefficient: strikeCoefficient(strike),
        skillWeapon: conduitSkillWeapon(context, skill),
        canCrit: null
      });
      const torment = conditions.find((effect) => effect.metadata?.target !== 'self');
      const selfTorment = conditions.find((effect) => effect.metadata?.target === 'self');
      const tormentTick = firstConditionTick(torment, 'Torment');
      const selfTormentTick = firstConditionTick(selfTorment, 'Torment');
      emitSkillCondition(context, skill, {
        at: impactAt,
        condition: String(tormentTick?.condition || 'Torment'),
        stacks: Number(tormentTick?.stacks || 1),
        duration: Number(tormentTick?.duration || 0) * (1 + affinity * Number(torment?.durationPerAffinity || 0))
      });
      // Self-torment duration decreases with higher affinity (more skill = less self-harm); clamped to 0 at max.
      const selfDuration =
        Number(selfTormentTick?.duration || 0) *
        Math.max(0, 1 - affinity * Number(selfTorment?.durationReductionPerAffinity || 0));
      // One self-condition entry per target hit; Hex Eater Vortex then consumes entries to scale its projectiles.
      const count = targetsHit(context);
      for (let index = 0; index < count; index += 1) {
        professionCoreState(context).selfConditions.push({
          condition: String(selfTormentTick?.condition || 'Torment'),
          stacks: Number(selfTormentTick?.stacks || 1),
          at: impactAt,
          expiresAt: impactAt + selfDuration,
          sourceId: skill.id,
          skillName: skill.name
        });
      }

      const control = (skill.effects || []).find((effect) => effect.type === 'control');
      emitSkillControl(context, skill, {
        at: effectAt(context, control),
        controlKind: String(control?.metadata?.controlKind || 'daze'),
        duration: Number(control?.duration || 0)
      });
      break;
    }

    case ID.RELEASE_POTENTIAL_ASSASSIN: {
      const ticks = strike?.type === 'strike' ? strikeEffectTicks(strike) : [];
      for (const [index, tick] of ticks.entries()) {
        emitSkillDamage(context, skill, {
          at: context.start + Number(tick.atMs || 0) / 1000,
          coefficient: Number(tick.coefficient || 0),
          hitIndex: index + 1,
          totalHits: ticks.length,
          skillWeapon: conduitSkillWeapon(context, skill),
          canCrit: null
        });
      }

      // Conditions land with the final hit; both share the same affinity-scaled duration formula.
      for (const effect of conditions) {
        if (effect.type !== 'condition') continue;
        for (const tick of conditionEffectTicks(effect)) {
          emitSkillCondition(context, skill, {
            at: effectAt(context, effect, tick.atMs),
            condition: tick.condition,
            stacks: Number(tick.stacks || 1),
            duration: Number(tick.duration || 0) * (1 + affinity * Number(effect.durationPerAffinity || 0))
          });
        }
      }

      break;
    }

    case ID.RELEASE_POTENTIAL_WARRIOR:
      emitSkillDamage(context, skill, {
        at: context.effectiveEnd,
        coefficient: strikeCoefficient(strike),
        skillWeapon: conduitSkillWeapon(context, skill),
        canCrit: null
      });
      break;
    default:
      break;
  }
}

/** Starts Cosmic Wisdom and selects the current legend-derived form. */
export function activateCosmicWisdom(context: RevenantCastContext): void {
  const state = conduitState.from(context);
  const at = context.effectiveEnd;
  // Mistfire resolves as part of the activation, before Cosmic Wisdom's
  // doubled Bolstered Bonds attributes become active.
  // It is emitted directly here rather than via observeConduitTraits because Cosmic Wisdom has no control event.
  if (hasTrait(context, TRAIT.MISTFIRE)) {
    const profile = balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.mistfire);
    const strike = effectByType(profile, 'strike');
    const burning = effectByType(profile, 'condition');
    const burningTick = firstConditionTick(burning, 'Burning');
    const mistfireSkill = { id: TRAIT.MISTFIRE, name: 'Mistfire' } as RevenantSkill;
    emitSkillDamage(context, mistfireSkill, {
      at,
      source: 'revenant',
      actorType: 'effect',
      ownerActorType: 'player',
      name: 'Mistfire',
      coefficient: strikeCoefficient(strike),
      skillWeapon: 'Unequipped',
      canCrit: null
    });
    emitSkillCondition(context, mistfireSkill, {
      at,
      source: 'revenant',
      actorType: 'effect',
      ownerActorType: 'player',
      name: 'Mistfire — Burning',
      condition: String(burningTick?.condition || 'Burning'),
      stacks: Number(burningTick?.stacks || 1),
      duration: Number(burningTick?.duration || 0)
    });
  }

  const cosmicWisdom = (context.skill.effects || []).find(
    (effect) => effect.type === 'buff' && effect.kind === 'cosmic-wisdom'
  );
  state.cosmicWisdomUntil = at + Number(cosmicWisdom?.duration || 0);
  // Derive form name from active legend; strip "Release Potential: " prefix to get "Mesmer", "Assassin", etc.
  state.conduitForm =
    REVENANT_RELEASE_POTENTIAL_BY_LEGEND[professionCoreState(context).activeLegendId]?.replace(
      'Release Potential: ',
      ''
    ) || '';
  // Energy overrides must be applied immediately so the very next skill cast sees the correct cost.
  syncConduitEnergyCostOverrides(context);
  emitRevenantStateSnapshot(context, at, 'cosmic-wisdom');
  // Numinous Gift fires on activation for the activating player (not allies); Found Purpose broadcasts to allies on swap.
  emitNuminousGift(context, context.skill);
}

/** Raw Conduit callbacks consumed by the Conduit handler registry. */
export const revenantConduitSkillHandlers = Object.freeze({
  'revenant.beguiling-haze': castBeguilingHaze,
  'revenant.gladiators-defense': castGladiatorsDefense,
  'revenant.hex-eater-vortex': castHexEaterVortex,
  'revenant.twin-moon-sweep': castTwinMoonSweep,
  'revenant.release-potential': castReleasePotential,
  'revenant.cosmic-wisdom': activateCosmicWisdom
});
