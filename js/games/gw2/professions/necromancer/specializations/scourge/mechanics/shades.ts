import { isTimeInWindow } from '#kernel/core/clock.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { conditionEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { scourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
/**
 * Scourge sand shade handlers.
 *
 * A single `shade` handler covers Manifest Sand Shade (which spawns a timed
 * shade, capped by Sand Savant) and every shade-triggered F-skill (Nefarious
 * Favor, Sand Cascade, Garish Pillar, Desert Shroud, Sandstorm Shroud). Each
 * emits the base sand-shade strike/condition plus its skill-specific payload;
 * non-Manifest casts pay the shade's life-force cost. Exports
 * `necromancerShadeSkillHandlers`.
 */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  normalizedNecromancerLifeForceCost,
  syncNecromancerResources
} from '#gw2/professions/necromancer/core/state.js';
import { removeNecromancerSelfCondition } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';

// Default `at` is effectiveEnd because barrier traits fire on cast completion; callers that
// need a different timing (e.g. Sandstorm pulse) pass their own timestamp explicitly
function applyBarrierTraits(context: NecromancerCastContext, skill: NecromancerSkill, at = context.effectiveEnd): void {
  // Each barrier trait emits its own named boon independently of the other.
  for (const [trait, profileId, name] of [
    [TRAIT.ABRASIVE_GRIT, PROFILE.abrasiveGrit, 'might'],
    [TRAIT.DESERT_EMPOWERMENT, PROFILE.desertEmpowerment, 'alacrity']
  ] as const) {
    if (!hasTrait(context, trait)) continue;
    const profile = requireBalanceProfileFromContext(context, profileId);
    const boon = requireEffect(profile, 'boon', name);
    if (!boon) continue;
    emitSkillBuff(context, skill, {
      at,
      kind: String(boon.boon),
      duration: effectNumber(profile, boon, 'duration'),
      stacks: effectNumber(profile, boon, 'stacks'),
      audience: { recipients: 'party' as const, maximumRecipients: 5 }
    });
  }
}

/** Soul Barbs uses its authored window for shade shrouds as well as ordinary shroud entry. */
function emitShadeSoulBarbs(context: NecromancerCastContext, skill: NecromancerSkill, at: number): void {
  if (!hasTrait(context, TRAIT.SOUL_BARBS)) return;
  emitSkillBuff(context, skill, {
    at,
    kind: 'necromancer-soul-barbs',
    duration: balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SOUL_BARBS), 'duration'),
    stacks: 1
  });
}

// Append Scourge's barrier-triggered trait boons after the shared barrier effects resolve.
function barrier(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  applyBarrierTraits(context, skill);
  return true;
}

// Resolve shared shade costs and packets before dispatching the selected F-skill's distinct payload.
function shade(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = scourgeState.from(context);
  const at = context.effectiveEnd;
  // Manifest Sand Shade's strike lands at 11/12 of the cast window (just before the cast ends),
  // matching the in-game timing; all other shade skills strike at cast completion
  const impactAt =
    skill.id === ID.MANIFEST_SAND_SHADE ? context.start + (context.fullEnd - context.start) * (11 / 12) : at;
  const shadeProfile = requireBalanceProfileFromContext(context, PROFILE.shade);
  if (skill.id === ID.MANIFEST_SAND_SHADE) {
    const profile = hasTrait(context, TRAIT.SAND_SAVANT)
      ? requireBalanceProfileFromContext(context, PROFILE.sandSavant)
      : shadeProfile;
    const maximum = balanceProfileNumber(profile, 'maximumStacks');
    // The shade's lifetime is its buff, so a removed buff manifests no shade.
    const lifetime = requireEffect(profile, 'buff', 'active-shade');
    // Retain the longest-lived shades, preserving ascending order for snapshots.
    // Disabled caps and expired grants cannot leave inactive shades in the pool.
    if (lifetime)
      state.shades = grantTimedStacks(state.shades, {
        at,
        expiresAt: at + effectNumber(profile, lifetime, 'duration'),
        count: 1,
        maximumStacks: maximum,
        retain: 'latest-expiry'
      }).reverse();
    if (hasTrait(context, TRAIT.DESERT_EMPOWERMENT)) {
      applyBarrierTraits(context, skill, at);
    }
  } else {
    const coreState = professionCoreState(context);
    coreState.lifeForce = Math.max(
      0,
      coreState.lifeForce - normalizedNecromancerLifeForceCost(coreState, Number(skill.lifeForceCost || 0))
    );
    if (
      // Plague Sending only triggers on F4/F5 shade skills, not on Manifest or the three minor F-skills
      new Set<string | number>([ID.DESERT_SHROUD, ID.SANDSTORM_SHROUD]).has(skill.id) &&
      hasTrait(context, TRAIT.PLAGUE_SENDING)
    ) {
      const hasActiveSelfCondition = coreState.selfConditions.some((application) =>
        isTimeInWindow(at, application.appliedAt, application.expiresAt)
      );
      coreState.plagueSendingArmed = true;
      // Track which skill armed the proc so the resolver can attribute the transfer correctly;
      // null means a self-condition was already present before this cast
      coreState.plagueSendingEntrySkillId = hasActiveSelfCondition ? null : skill.id;
    }

    if (skill.id === ID.NEFARIOUS_FAVOR) {
      removeNecromancerSelfCondition(coreState, at, 1);
    }
  }

  syncNecromancerResources(professionCoreState(context));
  emitNecromancerStateSnapshot(context, at, 'shade', {
    dedupeAcrossSourceIds: true
  });

  // ArcDPS records the automatic shade strike under two Manifest Sand Shade
  // packet identities: Nefarious Favor uses one, while all other F-skills use
  // another. Keep the parent cast skill for mechanics, report the packet name
  // separately so EVTC parsing can match the correct hit to the correct source.
  const shadeStrikeName = skill.id === ID.NEFARIOUS_FAVOR ? 'Manifest Sand Shade' : 'Manifest Sand Shade (F1/F5)';
  // The shade strike and condition are independent packets; either survives the other's removal.
  const shadeStrike = requireEffect(shadeProfile, 'strike', 'Strike');
  if (shadeStrike)
    emitSkillDamage(context, skill, {
      at: impactAt,
      name: 'Sand Shade - Strike',
      sourceId: ID.MANIFEST_SAND_SHADE,
      coefficient: effectNumber(shadeProfile, shadeStrike, 'coefficient'),
      skillWeapon: 'Unequipped',
      skillName: shadeStrikeName,
      parentSkillName: skill.name,
      // Read the selected shade profile so patches also update Dhuumfire's duration and ICD.
      metadata: {
        necromancerShroudSkillOne: true,
        dhuumfireDuration: balanceProfileNumber(shadeProfile, 'dhuumfireDuration'),
        dhuumfireInterval: balanceProfileNumber(shadeProfile, 'dhuumfireInterval')
      }
    });
  const shadeCondition = requireEffect(shadeProfile, 'condition', 'Torment');
  if (shadeCondition)
    emitSkillCondition(context, {
      skill,
      at: impactAt,
      sourceId: ID.MANIFEST_SAND_SHADE,
      condition: String(shadeCondition.condition),
      stacks: effectNumber(shadeProfile, shadeCondition, 'stacks'),
      duration: effectNumber(shadeProfile, shadeCondition, 'duration')
    });

  // Sadistic Searing remains effect-sourced while player ownership lets equipment react to its Burning.
  if (skill.id === ID.NEFARIOUS_FAVOR && hasTrait(context, TRAIT.SADISTIC_SEARING)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.sadisticSearing);
    const condition = requireEffect(profile, 'condition', 'Burning');
    if (condition)
      emitSkillCondition(context, {
        skill,
        at,
        source: 'Trait',
        sourceId: TRAIT.SADISTIC_SEARING,
        actorType: 'effect',
        ownerActorType: 'player',
        condition: String(condition.condition),
        stacks: effectNumber(profile, condition, 'stacks'),
        duration: effectNumber(profile, condition, 'duration')
      });
  } else if (skill.id === ID.SAND_CASCADE) {
    applyBarrierTraits(context, skill, at);
  } else if (skill.id === ID.GARISH_PILLAR) {
    emitSkillControl(context, skill, {
      at,
      controlKind: 'fear'
    });
  } else if (skill.id === ID.DESERT_SHROUD) {
    emitShadeSoulBarbs(context, skill, at);
    applyBarrierTraits(context, skill, at);
    const desert = requireBalanceProfileFromContext(context, PROFILE.desertShroud);
    // Strike and Torment pulses follow their own authored schedules, so removing one keeps the other.
    const strike = requireEffect(desert, 'strike', 'Strike');
    const torment = requireEffect(desert, 'condition', 'Torment');
    if (strike && !strike.ticks?.length) throw new Error('Desert Shroud requires an explicit strike timeline.');
    for (const tick of strike?.ticks || []) {
      emitSkillDamage(context, skill, {
        at: at + Number(tick.atMs) / 1000,
        coefficient: Number(tick.coefficient)
      });
    }

    for (const tick of torment ? conditionEffectTicks(torment) : []) {
      emitSkillCondition(context, {
        skill,
        at: at + Number(tick.atMs) / 1000,
        condition: tick.condition,
        stacks: tick.stacks,
        duration: tick.duration
      });
    }
  } else if (skill.id === ID.SANDSTORM_SHROUD) {
    const sandstorm = requireBalanceProfileFromContext(context, PROFILE.sandstormShroud);
    const strike = requireEffect(sandstorm, 'strike', 'Strike');
    const torment = requireEffect(sandstorm, 'condition', 'Torment');
    const pulseProtection = requireEffect(sandstorm, 'boon', 'protection pulses');
    const detonationProtection = requireEffect(sandstorm, 'boon', 'protection');
    emitShadeSoulBarbs(context, skill, at);

    // Pulses fire at cast-end + 0s, 1s, 2s; each barrier pulse is owned by its protection cadence, so removing the
    // pulse protection removes those pulses while the detonation keeps its own packets.
    const pulseCount = pulseProtection ? effectNumber(sandstorm, pulseProtection, 'applications') : 0;
    const pulseInterval = pulseProtection ? effectNumber(sandstorm, pulseProtection, 'intervalMs') / 1000 : 0;
    for (let index = 0; pulseProtection && index < pulseCount; index += 1) {
      const pulseAt = at + index * pulseInterval;
      applyBarrierTraits(context, skill, pulseAt);
      emitSkillBuff(context, skill, {
        at: pulseAt,
        kind: String(pulseProtection.boon),
        duration: effectNumber(sandstorm, pulseProtection, 'duration'),
        stacks: effectNumber(sandstorm, pulseProtection, 'stacks'),
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      });
    }

    // Detonation packets keep their own authored impact offsets.
    if (detonationProtection) {
      const detonationAt = at + effectNumber(sandstorm, detonationProtection, 'atMs') / 1000;
      applyBarrierTraits(context, skill, detonationAt);
      emitSkillBuff(context, skill, {
        at: detonationAt,
        kind: String(detonationProtection.boon),
        duration: effectNumber(sandstorm, detonationProtection, 'duration'),
        stacks: effectNumber(sandstorm, detonationProtection, 'stacks'),
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      });
    }

    if (strike)
      emitSkillDamage(context, skill, {
        at: at + effectNumber(sandstorm, strike, 'atMs') / 1000,
        coefficient: effectNumber(sandstorm, strike, 'coefficient')
      });
    if (torment)
      emitSkillCondition(context, {
        skill,
        at: at + effectNumber(sandstorm, torment, 'atMs') / 1000,
        condition: String(torment.condition),
        stacks: effectNumber(sandstorm, torment, 'stacks'),
        duration: effectNumber(sandstorm, torment, 'duration')
      });
  }

  return true;
}

/** Exposes shade and barrier casts through the shared skill-handler contract. */
export const necromancerShadeSkillHandlers = Object.freeze({
  'necromancer.shade': shade,
  'necromancer.barrier': barrier
});
