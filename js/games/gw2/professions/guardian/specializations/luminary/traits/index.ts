import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/professions/guardian/core/traits/index.js';
import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
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
import type { SkillId } from '#gw2/platform/engine/types.js';
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

function reduceVirtueCooldowns(context: GuardianSchedulerContext, at: number, reduction: number): void {
  for (const skillId of RADIANT_VIRTUE_IDS) {
    const readyAt = Number(context.state.cooldowns.get(skillId) || 0);
    if (!(readyAt > at + context.epsilon)) continue;
    const reduced = Math.max(at, readyAt - reduction);
    if (reduced <= at + context.epsilon) {
      context.state.cooldowns.delete(skillId);
    } else {
      context.state.cooldowns.set(skillId, reduced);
    }
  }
}

export function handleRadiantWeaponEquipped(context: GuardianCastContext, skill: GuardianSkill): void {
  if (!recordRadiantWeaponEquipped(context, skill)) return;
  const at = context.effectiveEnd + 0.001;
  const state = luminaryState.from(context);
  const weapon = skill.radiantWeapon!;
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS)) {
    const armaments = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.radiantArmaments), 'buff');
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-radiant-armaments',
      duration: Number(armaments?.duration || 10),
      stacks: 1,
      metadata: { radiantWeapon: weapon }
    });
    emitGuardianProc(context, {
      name: 'Radiant Armaments',
      at,
      sourceSkill: skill.name,
      detail: weapon === 'hammer' ? 'Radiant hammer: +7% strike damage' : `${weapon}: hammer bonus removed`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS)
    });
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS)) {
    const profile = balanceProfileFromContext(context, PROFILE.empoweredArmaments);
    const duration = Number(profile?.resourceGain || 6);
    const maximumDuration = Number(profile?.maximumStacks || 20);
    const wasActive = Number(state.empoweredArmamentsUntil || 0) > at + context.epsilon;
    // Duration stacks additively up to a 20 s cap; the cap prevents the buff
    // from extending forever if many weapons are equipped in quick succession.
    state.empoweredArmamentsUntil = wasActive
      ? Math.min(at + maximumDuration, state.empoweredArmamentsUntil + duration)
      : at + duration;
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-empowered-armaments',
      duration: state.empoweredArmamentsUntil - at,
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
    const reduction = Number(
      balanceProfileFromContext(context, PROFILE.illuminatingInspiration)?.rechargeReduction || 4
    );
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

function virtueFor(skill: GuardianSkill): GuardianVirtue | null {
  if (!RADIANT_VIRTUE_IDS.has(skill.id)) return null;
  // Virtues are identified by the trailing digit in their slot name
  // ("Profession_1" → justice, "Profession_2" → resolve, "Profession_3" → courage)
  // rather than by skill ID, because each virtue has multiple IDs across game patches.
  const slot = Number(String(skill.slot || '').match(/(\d)$/)?.[1] || 0);
  return ([null, 'justice', 'resolve', 'courage'] as const)[slot] || null;
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
  const virtue = virtueFor(skill);
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
}

export function updateLuminaryTraitCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  replayInitialLuminaryState(context, skill);
  // Radiant-weapon traits react here after a completed cast so the forge mechanic stays independent of trait code.
  if (context.effectiveEnd >= context.fullEnd - context.epsilon) handleRadiantWeaponEquipped(context, skill);
  if (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE) {
    // Register Exit Radiant Forge as an available flip so the scheduler and
    // UI treat it as an always-ready option while the forge is active.
    // POSITIVE_INFINITY means "no cooldown / never expires".
    professionCoreState(context).availableFlips[GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE] = Number.POSITIVE_INFINITY;
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
  dependencies: {
    readonly hitContext?: object;
  } = {}
): void {
  // Radiant Justice uses the two-second passive packet measured in the Luminary log.
  reactToJusticeHitWithOptions(context, event, dependencies, {
    skillId: GUARDIAN_SKILL_IDS.RADIANT_JUSTICE,
    skillName: 'Radiant Justice',
    passiveBurnDuration: 2
  });
}
