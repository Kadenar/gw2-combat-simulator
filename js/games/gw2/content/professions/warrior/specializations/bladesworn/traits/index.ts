import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import { grantBerserkersPower } from '#gw2/content/professions/warrior/core/traits/index.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/specializations/bladesworn/profiles.js';
import { bladeswornState } from '#gw2/content/professions/warrior/specializations/bladesworn/state.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/content/professions/warrior/types.js';

const UNSEEN_SWORD_STRIKE_ID = 62847;
const LUSH_FOREST_EXCLUDED_SKILL_IDS = new Set<number>([
  ID.UNSHEATHE_GUNSABER,
  ID.SHEATHE_GUNSABER,
  ID.DRAGON_TRIGGER,
  // Current live-game bug supplied with the benchmark specification.
  ID.ARTILLERY_SLASH
]);

/** Applies the Core weapon-swap trait state that must precede the emitted Gunsaber swap event. */
export function prepareGunsaberSwapTraits(context: WarriorCastContext): void {
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
    professionCoreState(context).soldierFocusReadyAt = context.effectiveEnd;
  }
}

/** Applies the selected Gunsaber-entry trait after the canonical weapon-swap event. */
export function applyGunsaberEntryTraits(context: WarriorCastContext, at: number): void {
  // Explicit precombat swaps must not spend the trait's internal cooldown.
  if (
    context.hasExplicitCombatStart &&
    (context.combatStartTime == null || at + context.epsilon < context.combatStartTime)
  ) {
    return;
  }

  const state = bladeswornState.from(context);
  if (!isInternalCooldownReady(at, state.gunsaberSwapTraitReadyAt)) return;
  let traitId = 0;
  let profile;
  if (hasTrait(context, TRAIT.UNSEEN_SWORD)) {
    traitId = TRAIT.UNSEEN_SWORD;
    profile = balanceProfileFromContext(context, PROFILE.unseenSword);
    const strike = balanceProfileEffect(profile, 'strike');
    emitSkillDamage(context, {
      at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'player',
      skillId: UNSEEN_SWORD_STRIKE_ID,
      skillName: 'Unseen Sword',
      parentSkillName: context.skill.name,
      name: 'Unseen Sword',
      coefficient: Number(strike?.coefficient ?? 1.2)
    });
  } else if (hasTrait(context, TRAIT.SHARP_AS_THE_WIND)) {
    traitId = TRAIT.SHARP_AS_THE_WIND;
    profile = balanceProfileFromContext(context, PROFILE.sharpAsTheWind);
    const burning = balanceProfileEffect(profile, 'condition');
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillId: ID.UNSHEATHE_GUNSABER,
      skillName: 'Unsheathe Gunsaber',
      name: 'Sharp as the Wind — Burning',
      condition: 'Burning',
      stacks: Number(burning?.stacks ?? 1),
      duration: Number(burning?.duration ?? 3)
    });
  } else if (hasTrait(context, TRAIT.RIVERS_FLOW)) {
    traitId = TRAIT.RIVERS_FLOW;
    profile = balanceProfileFromContext(context, PROFILE.riversFlow);
    const might = balanceProfileEffect(profile, 'boon');
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillId: ID.UNSHEATHE_GUNSABER,
      skillName: 'Unsheathe Gunsaber',
      name: "River's Flow — Might",
      kind: 'might',
      boon: 'might',
      stacks: Number(might?.stacks ?? 2),
      duration: gw2SchedulerBoonDuration(context, context.skill, 'might', Number(might?.duration ?? 8)),
      recipients: 'party'
    });
  }

  if (!traitId) return;
  state.gunsaberSwapTraitReadyAt = at + Number(profile?.internalCooldown ?? 4);
  const positiveFlow = balanceProfileEffect(profile, 'buff');
  const positiveFlowDuration = Number(positiveFlow?.duration ?? 5);
  if (state.traitPositiveFlowUntil <= at + context.epsilon) {
    state.traitPositiveFlowStartedAt = at;
  }

  state.traitPositiveFlowUntil = at + positiveFlowDuration;
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    skillId: ID.UNSHEATHE_GUNSABER,
    skillName: 'Unsheathe Gunsaber',
    name: 'Positive Flow',
    kind: 'positive-flow',
    stacks: Number(positiveFlow?.stacks ?? 1),
    duration: positiveFlowDuration
  });
}

/** Applies traits that react to entering Dragon Trigger. */
export function applyDragonTriggerEntryTraits(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!hasTrait(context, TRAIT.DRAGONSCALE_DEFENSE)) return;
  const stability = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.dragonscaleDefense), 'boon');
  emitSkillBuff(context, {
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.DRAGONSCALE_DEFENSE,
    actorType: 'effect',
    skillId: ID.DRAGON_TRIGGER,
    skillName: 'Dragon Trigger',
    name: 'Dragonscale Defense',
    kind: 'stability',
    boon: 'stability',
    stacks: Number(stability?.stacks ?? 1),
    duration: gw2SchedulerBoonDuration(context, skill, 'stability', Number(stability?.duration ?? 3))
  });
}

/** Applies traits that react to a released Dragon Slash at its resolved impact timestamp. */
export function applyDragonSlashTraits(context: WarriorCastContext, skill: WarriorSkill, impactAt: number): void {
  if (hasTrait(context, TRAIT.UNYIELDING_DRAGON)) {
    emitSkillControl(context, {
      at: impactAt,
      skillId: skill.id,
      sourceId: TRAIT.UNYIELDING_DRAGON,
      skillName: skill.name,
      source: 'Trait',
      actorType: 'player',
      controlKind: 'stun',
      duration: 1
    });
  }

  if (hasTrait(context, TRAIT.DARING_DRAGON)) {
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.DARING_DRAGON,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Daring Dragon — Alacrity',
      kind: 'alacrity',
      boon: 'alacrity',
      stacks: 1,
      duration: gw2SchedulerBoonDuration(context, skill, 'alacrity', 10),
      recipients: 'party'
    });
  }
}

function skillIsOnActiveBar(context: WarriorCastContext, skill: WarriorSkill): boolean {
  const state = bladeswornState.from(context);
  if (skill.gunsaberSkill) return state.gunsaberActive || state.dragonTriggerActive;
  if (skill.type === 'Weapon' || skill.weapon) {
    if (state.gunsaberActive || state.dragonTriggerActive) return false;
    const weapons = new Set(
      gw2ConfiguredWeaponSet(context.config, context.state.activeWeaponSet === 2 ? 2 : 1)
        .map((weapon) => String(weapon || ''))
        .filter(Boolean)
    );
    return weapons.size === 0 || weapons.has(String(skill.weapon || ''));
  }

  if (['Heal', 'Utility', 'Elite'].includes(String(skill.type || ''))) {
    const selected = selectedSkillNameSet(context.config.selectedSkills);
    return selected.size === 0 || selected.has(skill.name);
  }

  return true;
}

function activateLushForest(context: WarriorCastContext, sourceSkill: WarriorSkill, at: number): void {
  let cooldownReduction = 0;
  const rechargeReduction = Number(balanceProfileFromContext(context, PROFILE.lushForest)?.rechargeReduction ?? 0.75);
  const skillIds = new Set([...context.state.cooldowns.keys(), ...context.state.ammo.keys()]);
  for (const skillId of skillIds) {
    const skill = context.catalog.skillsById.get(skillId);
    if (!skill || LUSH_FOREST_EXCLUDED_SKILL_IDS.has(Number(skill.id)) || !skillIsOnActiveBar(context, skill)) continue;
    cooldownReduction += context.cooldownController.reduceSkillRecharge(skill, rechargeReduction, at);
  }

  context.emit({
    type: 'proc',
    at,
    source: 'Trait',
    sourceId: TRAIT.LUSH_FOREST,
    actorType: 'effect',
    skillId: sourceSkill.id,
    skillName: sourceSkill.name,
    name: 'Lush Forest',
    procType: 'trait',
    cooldownReduction
  });
}

/** Applies ammo- and Dragon-Slash-dependent traits after a completed skill. */
export function applyBladeswornCompletionTraits(
  context: WarriorCastContext,
  skill: WarriorSkill,
  roundsSpent: number,
  startedFull: boolean,
  dragonAdrenalineSpent: number,
  at: number
): void {
  const state = bladeswornState.from(context);
  if (roundsSpent > 0 && hasTrait(context, TRAIT.FIERCE_AS_FIRE)) {
    const profile = balanceProfileFromContext(context, PROFILE.fierceAsFire);
    const effect = balanceProfileEffect(profile, 'buff');
    const duration = Number(effect?.duration ?? 15);
    state.fierceAsFireExpiries = state.fierceAsFireExpiries.filter((expiresAt) => expiresAt > at);
    state.fierceAsFireExpiries.push(...Array(roundsSpent).fill(at + duration));
    state.fierceAsFireExpiries = state.fierceAsFireExpiries.slice(-Number(profile?.maximumStacks ?? 10));
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.FIERCE_AS_FIRE,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Fierce as Fire',
      kind: 'fierce-as-fire',
      stacks: roundsSpent,
      duration
    });
  }

  if (roundsSpent > 0 && startedFull && skill.id !== ID.ARTILLERY_SLASH && hasTrait(context, TRAIT.LUSH_FOREST)) {
    activateLushForest(context, skill, at);
  }

  if (dragonAdrenalineSpent > 0) {
    const stacks = dragonAdrenalineSpent >= 30 ? 4 : dragonAdrenalineSpent >= 20 ? 3 : 2;
    grantBerserkersPower(context, stacks, at + context.epsilon, skill);
  }
}

/** Applies Guns and Glory when a qualifying Bladesworn explosion resolves. */
export function observeBladeswornExplosionTraits(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent
): void {
  if (!hasTrait(context, TRAIT.GUNS_AND_GLORY)) return;
  const state = bladeswornState.from(context);
  const profile = balanceProfileFromContext(context, PROFILE.gunsAndGlory);
  const remaining = Math.max(0, state.gunsAndGloryUntil - event.at);
  const duration = Math.min(Number(profile?.maximumStacks ?? 12), remaining + Number(profile?.resourceGain ?? 3));
  state.gunsAndGloryUntil = event.at + duration;
  emitSkillBuff(context, {
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.GUNS_AND_GLORY,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Guns and Glory',
    kind: 'guns-and-glory',
    stacks: 1,
    duration
  });
}
