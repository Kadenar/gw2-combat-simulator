import { scourgeState } from './state.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
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
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { normalizedNecromancerLifeForceCost, syncNecromancerResources } from '../../core/state.js';
import { removeNecromancerSelfCondition } from '../../core/conditions.js';
import {
  emitBuff,
  emitCondition,
  emitControl,
  emitDamage,
  emitState,
  hasTrait,
  necromancerPartyBoonRecipients
} from '../../core/shared.js';
import type { NecromancerCastContext, NecromancerSkill } from '../../types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import type { SkillEffect } from '../../../../platform/engine/types.js';

function emitShadeCondition(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  condition: SkillEffect | undefined,
  options?: Parameters<typeof emitCondition>[5]
): void {
  emitCondition(
    context,
    skill,
    String(condition?.condition || ''),
    Number(condition?.stacks || 1),
    Number(condition?.duration || 0),
    options
  );
}

// Default `at` is effectiveEnd because barrier traits fire on cast completion; callers that
// need a different timing (e.g. Sandstorm pulse) pass their own timestamp explicitly
function applyBarrierTraits(context: NecromancerCastContext, skill: NecromancerSkill, at = context.effectiveEnd): void {
  if (hasTrait(context, TRAIT.ABRASIVE_GRIT)) {
    const might = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.abrasiveGrit), 'boon');
    emitBuff(context, skill, String(might?.boon || 'might'), Number(might?.duration || 6), Number(might?.stacks || 2), {
      at,
      metadata: necromancerPartyBoonRecipients(context)
    });
  }

  if (hasTrait(context, TRAIT.DESERT_EMPOWERMENT)) {
    const alacrity = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.desertEmpowerment), 'boon');
    emitBuff(
      context,
      skill,
      String(alacrity?.boon || 'alacrity'),
      Number(alacrity?.duration || 1.5),
      Number(alacrity?.stacks || 1),
      { at, metadata: necromancerPartyBoonRecipients(context) }
    );
  }
}

function barrier(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  applyBarrierTraits(context, skill);
  return true;
}

function shade(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = scourgeState.from(context);
  const at = context.effectiveEnd;
  // Manifest Sand Shade's strike lands at 11/12 of the cast window (just before the cast ends),
  // matching the in-game timing; all other shade skills strike at cast completion
  const impactAt =
    skill.id === ID.MANIFEST_SAND_SHADE ? context.start + (context.fullEnd - context.start) * (11 / 12) : at;
  const shadeProfile = necromancerBalanceProfile(context, PROFILE.shade);
  if (skill.id === ID.MANIFEST_SAND_SHADE) {
    const profile = hasTrait(context, TRAIT.SAND_SAVANT)
      ? necromancerBalanceProfile(context, PROFILE.sandSavant)
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
  emitState(context, at, 'shade');

  // ArcDPS records the automatic shade strike under two Manifest Sand Shade
  // packet identities: Nefarious Favor uses one, while all other F-skills use
  // another. Keep the parent cast skill for mechanics, report the packet name
  // separately so EVTC parsing can match the correct hit to the correct source.
  const shadeStrikeName = skill.id === ID.NEFARIOUS_FAVOR ? 'Manifest Sand Shade' : 'Manifest Sand Shade (F1/F5)';
  const shadeStrike = balanceProfileEffect(shadeProfile, 'strike');
  emitDamage(context, skill, Number(shadeStrike?.coefficient || 0.666), {
    at: impactAt,
    name: 'Sand Shade - Strike',
    sourceId: ID.MANIFEST_SAND_SHADE,
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
  emitShadeCondition(context, skill, balanceProfileEffect(shadeProfile, 'condition'), {
    at: impactAt,
    sourceId: ID.MANIFEST_SAND_SHADE
  });

  if (skill.id === ID.NEFARIOUS_FAVOR && hasTrait(context, TRAIT.SADISTIC_SEARING)) {
    emitShadeCondition(
      context,
      skill,
      balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.sadisticSearing), 'condition'),
      {
        source: 'Trait',
        sourceId: TRAIT.SADISTIC_SEARING,
        actorType: 'effect'
      }
    );
  } else if (skill.id === ID.SAND_CASCADE) {
    applyBarrierTraits(context, skill, at);
  } else if (skill.id === ID.GARISH_PILLAR) {
    emitControl(
      context,
      skill,
      'fear',
      at,
      Number(balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.garishPillar), 'control')?.duration || 1)
    );
  } else if (skill.id === ID.DESERT_SHROUD) {
    if (hasTrait(context, TRAIT.SOUL_BARBS)) {
      emitBuff(context, skill, 'necromancer-soul-barbs', 15, 1, { at });
    }

    applyBarrierTraits(context, skill, at);
    const desert = necromancerBalanceProfile(context, PROFILE.desertShroud);
    const strike = balanceProfileEffect(desert, 'strike');
    const torment = balanceProfileEffect(desert, 'condition');
    const hits = Number(strike?.hits || 7);
    const interval = Number(strike?.intervalMs || 1000) / 1000;
    emitDamage(context, skill, Number(strike?.coefficient || 3.15), {
      at,
      hits,
      interval
    });
    for (let index = 0; index < hits; index += 1) {
      emitShadeCondition(context, skill, torment, {
        at: at + index * interval
      });
    }
  } else if (skill.id === ID.SANDSTORM_SHROUD) {
    const sandstorm = necromancerBalanceProfile(context, PROFILE.sandstormShroud);
    const strike = balanceProfileEffect(sandstorm, 'strike');
    const torment = balanceProfileEffect(sandstorm, 'condition');
    const pulseProtection = balanceProfileEffect(sandstorm, 'boon');
    const detonationProtection = balanceProfileEffect(sandstorm, 'boon', 1);
    const delay = Number(strike?.atMs || 3500) / 1000;
    const pulseCount = Number(pulseProtection?.applications || 3);
    const pulseInterval = Number(pulseProtection?.intervalMs || 1000) / 1000;
    if (hasTrait(context, TRAIT.SOUL_BARBS)) {
      emitBuff(context, skill, 'necromancer-soul-barbs', 15, 1, { at });
    }

    // Pulses fire at cast-end + 0s, 1s, 2s; detonation fires separately at cast-end + 3.5s
    for (let index = 0; index < pulseCount; index += 1) {
      const pulseAt = at + index * pulseInterval;
      applyBarrierTraits(context, skill, pulseAt);
      emitBuff(
        context,
        skill,
        'protection',
        Number(pulseProtection?.duration || 1.5),
        Number(pulseProtection?.stacks || 1),
        {
          at: pulseAt,
          metadata: necromancerPartyBoonRecipients(context)
        }
      );
    }

    applyBarrierTraits(context, skill, at + delay);
    emitBuff(
      context,
      skill,
      'protection',
      Number(detonationProtection?.duration || 3),
      Number(detonationProtection?.stacks || 1),
      {
        at: at + delay,
        metadata: necromancerPartyBoonRecipients(context)
      }
    );
    emitDamage(context, skill, Number(strike?.coefficient || 3), {
      at: at + delay
    });
    emitShadeCondition(context, skill, torment, {
      at: at + delay
    });
  }

  return true;
}

export const necromancerShadeSkillHandlers = Object.freeze({
  'necromancer.shade': shade,
  'necromancer.barrier': barrier
});
