import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
import { scourgeState } from '#gw2/content/professions/necromancer/specializations/scourge/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/content/professions/necromancer/state.js';
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
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';
import {
  normalizedNecromancerLifeForceCost,
  syncNecromancerResources
} from '#gw2/content/professions/necromancer/core/state.js';
import { removeNecromancerSelfCondition } from '#gw2/content/professions/necromancer/core/mechanics/conditions.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/content/professions/necromancer/types.js';

import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/specializations/scourge/profiles.js';

// Default `at` is effectiveEnd because barrier traits fire on cast completion; callers that
// need a different timing (e.g. Sandstorm pulse) pass their own timestamp explicitly
function applyBarrierTraits(context: NecromancerCastContext, skill: NecromancerSkill, at = context.effectiveEnd): void {
  if (hasTrait(context, TRAIT.ABRASIVE_GRIT)) {
    const might = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.abrasiveGrit), 'boon');
    emitSkillBuff(context, skill, {
      at,
      kind: String(might?.boon || 'might'),
      duration: Number(might?.duration || 6),
      stacks: Number(might?.stacks || 2),
      recipients: 'party',
      maximumRecipients: 5
    });
  }

  if (hasTrait(context, TRAIT.DESERT_EMPOWERMENT)) {
    const alacrity = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.desertEmpowerment), 'boon');
    emitSkillBuff(context, skill, {
      at,
      kind: String(alacrity?.boon || 'alacrity'),
      duration: Number(alacrity?.duration || 1.5),
      stacks: Number(alacrity?.stacks || 1),
      recipients: 'party',
      maximumRecipients: 5
    });
  }
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
  const shadeProfile = balanceProfileFromContext(context, PROFILE.shade);
  if (skill.id === ID.MANIFEST_SAND_SHADE) {
    const profile = hasTrait(context, TRAIT.SAND_SAVANT)
      ? balanceProfileFromContext(context, PROFILE.sandSavant)
      : shadeProfile;
    const maximum = Number(profile?.maximumStacks || 3);
    const duration = Number(balanceProfileEffect(profile, 'buff')?.duration || 15);
    // Sort ascending then take the last `maximum` entries so that when the cap
    // is exceeded the oldest (soonest-expiring) shade is evicted, not the newest
    state.shades = [...state.shades, at + duration].sort((left, right) => left - right).slice(-maximum);
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
      const hasActiveSelfCondition = coreState.selfConditions.some(
        (application) => application.appliedAt <= at && application.expiresAt > at
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
  const shadeStrike = balanceProfileEffect(shadeProfile, 'strike');
  emitSkillDamage(context, skill, {
    at: impactAt,
    name: 'Sand Shade - Strike',
    sourceId: ID.MANIFEST_SAND_SHADE,
    coefficient: Number(shadeStrike?.coefficient || 0.666),
    skillWeapon: 'Unequipped',
    metadata: {
      skillName: shadeStrikeName,
      parentSkillName: skill.name,
      // flagged as shroud skill one so Dhuumfire and other "on shroud skill 1" traits proc correctly
      necromancerShroudSkillOne: true,
      dhuumfireDuration: 2,
      dhuumfireInterval: 1
    }
  });
  const shadeCondition = balanceProfileEffect(shadeProfile, 'condition');
  emitSkillCondition(context, skill, {
    at: impactAt,
    sourceId: ID.MANIFEST_SAND_SHADE,
    condition: String(shadeCondition?.condition || ''),
    stacks: Number(shadeCondition?.stacks || 1),
    duration: Number(shadeCondition?.duration || 0)
  });

  if (skill.id === ID.NEFARIOUS_FAVOR && hasTrait(context, TRAIT.SADISTIC_SEARING)) {
    const condition = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.sadisticSearing), 'condition');
    emitSkillCondition(context, skill, {
      at,
      source: 'Trait',
      sourceId: TRAIT.SADISTIC_SEARING,
      actorType: 'effect',
      condition: String(condition?.condition || ''),
      stacks: Number(condition?.stacks || 1),
      duration: Number(condition?.duration || 0)
    });
  } else if (skill.id === ID.SAND_CASCADE) {
    applyBarrierTraits(context, skill, at);
  } else if (skill.id === ID.GARISH_PILLAR) {
    emitSkillControl(context, skill, {
      at,
      controlKind: 'fear',
      duration: Number(
        balanceProfileEffect(balanceProfileFromContext(context, PROFILE.garishPillar), 'control')?.duration || 1
      )
    });
  } else if (skill.id === ID.DESERT_SHROUD) {
    if (hasTrait(context, TRAIT.SOUL_BARBS)) {
      emitSkillBuff(context, skill, { at, kind: 'necromancer-soul-barbs', duration: 15, stacks: 1 });
    }

    applyBarrierTraits(context, skill, at);
    const desert = balanceProfileFromContext(context, PROFILE.desertShroud);
    const strike = balanceProfileEffect(desert, 'strike');
    const torment = balanceProfileEffect(desert, 'condition');
    const ticks = strike?.type === 'strike' ? strike.ticks : null;
    if (!ticks?.length) throw new Error('Desert Shroud requires an explicit strike timeline.');
    for (const tick of ticks) {
      const pulseAt = at + Number(tick.atMs) / 1000;
      emitSkillDamage(context, skill, { at: pulseAt, coefficient: Number(tick.coefficient) });
      emitSkillCondition(context, skill, {
        at: pulseAt,
        condition: String(torment?.condition || ''),
        stacks: Number(torment?.stacks || 1),
        duration: Number(torment?.duration || 0)
      });
    }
  } else if (skill.id === ID.SANDSTORM_SHROUD) {
    const sandstorm = balanceProfileFromContext(context, PROFILE.sandstormShroud);
    const strike = balanceProfileEffect(sandstorm, 'strike');
    const torment = balanceProfileEffect(sandstorm, 'condition');
    const pulseProtection = balanceProfileEffect(sandstorm, 'boon');
    const detonationProtection = balanceProfileEffect(sandstorm, 'boon', 1);
    const delay = Number(strike?.atMs || 3500) / 1000;
    const pulseCount = Number(pulseProtection?.applications || 3);
    const pulseInterval = Number(pulseProtection?.intervalMs || 1000) / 1000;
    if (hasTrait(context, TRAIT.SOUL_BARBS)) {
      emitSkillBuff(context, skill, { at, kind: 'necromancer-soul-barbs', duration: 15, stacks: 1 });
    }

    // Pulses fire at cast-end + 0s, 1s, 2s; detonation fires separately at cast-end + 3.5s
    for (let index = 0; index < pulseCount; index += 1) {
      const pulseAt = at + index * pulseInterval;
      applyBarrierTraits(context, skill, pulseAt);
      emitSkillBuff(context, skill, {
        at: pulseAt,
        kind: 'protection',
        duration: Number(pulseProtection?.duration || 1.5),
        stacks: Number(pulseProtection?.stacks || 1),
        recipients: 'party',
        maximumRecipients: 5
      });
    }

    applyBarrierTraits(context, skill, at + delay);
    emitSkillBuff(context, skill, {
      at: at + delay,
      kind: 'protection',
      duration: Number(detonationProtection?.duration || 3),
      stacks: Number(detonationProtection?.stacks || 1),
      recipients: 'party',
      maximumRecipients: 5
    });
    emitSkillDamage(context, skill, { at: at + delay, coefficient: Number(strike?.coefficient || 3) });
    emitSkillCondition(context, skill, {
      at: at + delay,
      condition: String(torment?.condition || ''),
      stacks: Number(torment?.stacks || 1),
      duration: Number(torment?.duration || 0)
    });
  }

  return true;
}

/** Exposes shade and barrier casts through the shared skill-handler contract. */
export const necromancerShadeSkillHandlers = Object.freeze({
  'necromancer.shade': shade,
  'necromancer.barrier': barrier
});
