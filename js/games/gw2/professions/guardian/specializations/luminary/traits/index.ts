import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumberFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/professions/guardian/core/traits/index.js';
import {
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { recordRadiantWeaponEquipped } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import {
  observeLuminaryLightFields,
  processLuminaryLightFields
} from '#gw2/professions/guardian/specializations/luminary/mechanics/light-fields.js';
import {
  processLuminaryStances,
  replayInitialLuminaryState
} from '#gw2/professions/guardian/specializations/luminary/mechanics/stances.js';

import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';

const RADIANT_WEAPON_SKILLS = Object.freeze({
  hammer: GUARDIAN_SKILL_IDS.DAZZLING_HAMMER,
  staff: GUARDIAN_SKILL_IDS.LUMINOUS_STAFF,
  blade: GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
  shield: GUARDIAN_SKILL_IDS.RADIANT_BULWARK
});
const RADIANT_VIRTUE_IDS: ReadonlySet<SkillId> = new Set([
  GUARDIAN_SKILL_IDS.RADIANT_JUSTICE,
  GUARDIAN_SKILL_IDS.RADIANT_RESOLVE,
  GUARDIAN_SKILL_IDS.RADIANT_COURAGE
]);

/** Delegates capped virtue reductions to the cooldown owner, retaining its ready-time representation. */
function reduceVirtueCooldowns(context: GuardianSchedulerContext, at: number, reduction: number): void {
  for (const skillId of RADIANT_VIRTUE_IDS) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill) context.cooldownController.reduceSkillRecharge(skill, reduction, at);
  }
}

export function handleRadiantWeaponEquipped(context: GuardianCastContext, skill: GuardianSkill): void {
  if (!recordRadiantWeaponEquipped(context, skill)) return;
  const at = canonicalTime(context.effectiveEnd + 0.001);
  const state = luminaryState.from(context);
  const weapon = skill.radiantWeapon!;
  // Only committed weapon equips trigger these boons; flip attacks and uncommitted attempts do not.
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.RESPLENDENT_WEAPONRY)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.resplendentWeaponry);
    for (const effect of profile.effects || []) {
      if (effect.type !== 'boon' || !effect.boon) continue;
      emitSkillBuff(context, skill, {
        at,
        sourceId: GUARDIAN_TRAIT_IDS.RESPLENDENT_WEAPONRY,
        skillName: 'Resplendent Weaponry',
        kind: effect.boon,
        duration: effect.duration,
        stacks: effectNumber(profile, effect, 'stacks'),
        audience: { recipients: 'party' }
      });
    }
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS)) {
    // The active armament changes when its cast starts, so hammer boosts its own hit and other equips remove it.
    const armamentAt = context.start;
    const radiantArmamentsProfile = requireBalanceProfileFromContext(context, PROFILE.radiantArmaments);
    const armaments = requireEffect(radiantArmamentsProfile, 'buff', 'radiant-armaments');
    if (armaments) {
      emitSkillBuff(context, skill, {
        at: armamentAt,
        source: 'guardian',
        sourceId: skill.id,
        actorType: 'player',
        kind: 'guardian-radiant-armaments',
        duration: effectNumber(radiantArmamentsProfile, armaments, 'duration'),
        stacks: 1,
        metadata: { radiantWeapon: weapon }
      });
      emitGuardianProc(context, {
        name: 'Radiant Armaments',
        at: armamentAt,
        sourceSkill: skill.name,
        detail: weapon === 'hammer' ? 'Radiant hammer: +7% strike damage' : `${weapon}: hammer bonus removed`,
        icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS)
      });
    }
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS)) {
    const duration = balanceProfileNumberFromContext(context, PROFILE.empoweredArmaments, 'resourceGain');
    const maximumDuration = balanceProfileNumberFromContext(context, PROFILE.empoweredArmaments, 'maximumStacks');
    const wasActive = Number(state.empoweredArmamentsUntil || 0) > at;
    // Duration stacks additively up to a 20 s cap; the cap prevents the buff
    // from extending forever if many weapons are equipped in quick succession.
    // Extend the live remainder, then use the same tick deadline as the emitted buff.
    const remaining = wasActive ? Math.min(maximumDuration, state.empoweredArmamentsUntil - at + duration) : duration;
    state.empoweredArmamentsUntil = gw2EffectExpiresAt(at, remaining);
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-empowered-armaments',
      duration: remaining,
      stacks: 1
    });
    emitGuardianProc(context, {
      name: 'Empowered Armaments',
      at,
      sourceSkill: skill.name,
      detail: wasActive ? 'refreshed' : 'triggered',
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS)
    });
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION)) {
    const reduction = balanceProfileNumberFromContext(context, PROFILE.illuminatingInspiration, 'rechargeReduction');
    reduceVirtueCooldowns(context, at, reduction);
    emitGuardianProc(context, {
      name: 'Illuminating Inspiration',
      at,
      sourceSkill: skill.name,
      detail: `Virtue recharges reduced by ${reduction} seconds`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION)
    });
  }
}

function resetRadiantWeaponCooldowns(context: GuardianSchedulerContext, virtue: GuardianVirtue): boolean {
  const ids =
    virtue === 'justice'
      ? [RADIANT_WEAPON_SKILLS.hammer]
      : virtue === 'resolve'
        ? [RADIANT_WEAPON_SKILLS.staff]
        : [RADIANT_WEAPON_SKILLS.blade, RADIANT_WEAPON_SKILLS.shield];
  for (const id of ids) context.state.cooldowns.delete(id);
  return ids.length > 0;
}

// Route a completed Luminary virtue through its shared activation traits and
// virtue-specific illumination effects.
function handleLuminaryVirtueTraits(context: GuardianCastContext, skill: GuardianSkill): void {
  const virtue = RADIANT_VIRTUE_IDS.has(skill.id) ? guardianVirtueForSlot(skill.slot) : null;
  if (!virtue) return;
  const at = context.effectiveEnd;
  const state = luminaryState.from(context);
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS) && resetRadiantWeaponCooldowns(context, virtue)) {
    emitGuardianProc(context, {
      name: 'Master-at-Arms',
      at,
      sourceSkill: skill.name,
      detail: `${virtue} radiant weapon skills recharged`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS)
    });
  }

  if (virtue === 'justice') {
    state.radiantJusticeArmed = true;
    emitGuardianProc(context, {
      name: 'Empowered Hammer',
      at,
      sourceSkill: skill.name,
      detail: 'Next Dazzling Hammer creates a delayed secondary impact',
      icon: skill.icon,
      procType: 'skill',
      source: 'Skill'
    });
  }

  if (virtue === 'courage') {
    state.radiantCourageSwordArmed = true;
    state.radiantCourageShieldArmed = true;
    emitGuardianProc(context, {
      name: 'Empowered Sword',
      at,
      sourceSkill: skill.name,
      detail: 'Next Gleaming Blade deals 50% more damage',
      icon: skill.icon,
      procType: 'skill',
      source: 'Skill'
    });
  }

  // Resolve empowers one subsequent staff equip, even when other weapons are used first.
  if (virtue === 'resolve') state.radiantResolveArmed = true;
}

export function updateLuminaryTraitCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  replayInitialLuminaryState(context, skill);
  // Committed animation cancels still equip the weapon and trigger its traits.
  if (!context.action.cancelled) handleRadiantWeaponEquipped(context, skill);
  if (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE && luminaryState.from(context).radiantForge) {
    // Register Exit Radiant Forge as an available flip so the scheduler and
    // UI treat it as an always-ready option while the forge is active.
    // POSITIVE_INFINITY means "no cooldown / never expires".
    armSkillFlip(
      professionCoreState(context).availableFlips,
      GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE,
      context.effectiveEnd
    );
  }

  processLuminaryStances(context, skill);
  processLuminaryLightFields(context, skill);
  handleLuminaryVirtueTraits(context, skill);
}

export function observeLuminaryScheduledEvent(context: GuardianSchedulerContext, event: GuardianResolverEvent): void {
  observeLuminaryLightFields(context, event);

  if (event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.LUMINOUS_STAFF) {
    const sourceSkill =
      context.catalog.skillsById.get(event.skillId) ||
      ({ id: event.skillId, name: event.skillName || 'Luminous Staff' } as GuardianSkill);
    emitSkillBuff(context, {
      at: event.at,
      source: 'guardian',
      sourceId: event.skillId,
      actorType: 'player',
      skillId: event.skillId,
      skillName: event.skillName,
      kind: 'resolution',
      stacks: 1,
      duration: gw2SchedulerBoonDuration(context, sourceSkill, 'resolution', 1)
    });
  }
}

export function reactToLuminaryJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  // Radiant Justice uses the two-second passive packet measured in the Luminary log.
  reactToJusticeHitWithOptions(context, event, dependencies, {
    skillId: GUARDIAN_SKILL_IDS.RADIANT_JUSTICE,
    skillName: 'Radiant Justice',
    passiveBurnDuration: 2
  });
}
