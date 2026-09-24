import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { reduceMatchingCooldowns } from '#gw2/platform/execution/cooldowns.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { grantBerserkersPower } from '#gw2/professions/warrior/core/traits/index.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';

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
  if (context.hasExplicitCombatStart && (context.combatStartTime == null || at + EPSILON < context.combatStartTime)) {
    return;
  }

  const state = bladeswornState.from(context);
  if (!isInternalCooldownReady(at, state.gunsaberSwapTraitReadyAt)) return;
  // Select the entry trait once so its packet, cooldown, and flow window share the same profile.
  const traitId = [TRAIT.UNSEEN_SWORD, TRAIT.SHARP_AS_THE_WIND, TRAIT.RIVERS_FLOW].find((id) => hasTrait(context, id));
  if (traitId == null) return;
  // Unseen Sword only strikes in combat: without an explicit marker, combat begins at the first observed hit,
  // so earlier swaps neither strike nor spend the internal cooldown.
  if (traitId === TRAIT.UNSEEN_SWORD && !context.hasExplicitCombatStart) {
    const combatBeganAt = context.schedulerPolicy.combatBeganAt?.();
    if (combatBeganAt == null || at + EPSILON < combatBeganAt) return;
  }

  const traitProfile = requireBalanceProfileFromContext(context, traitId);
  if (traitId === TRAIT.UNSEEN_SWORD) {
    const strike = requireEffect(traitProfile, 'strike', 'Strike');
    if (strike)
      emitSkillDamage(context, {
        at,
        source: 'Trait',
        sourceId: traitId,
        actorType: 'player',
        skillId: UNSEEN_SWORD_STRIKE_ID,
        // The trait strike uses nonweapon strength independently of the weapon being swapped.
        weaponStrengthProfileId: 'nonweapon.unequipped',
        skillName: 'Unseen Sword',
        parentSkillName: context.skill.name,
        name: 'Unseen Sword',
        coefficient: effectNumber(traitProfile, strike, 'coefficient')
      });
    // Record the trait activation through the shared proc pipeline so it appears in the procs panel.
    context.emit({
      type: 'proc',
      at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillId: context.skill.id,
      skillName: context.skill.name,
      name: 'Unseen Sword',
      procType: 'trait',
      sourceSkill: context.skill.name
    });
  } else if (traitId === TRAIT.SHARP_AS_THE_WIND) {
    const burning = requireEffect(traitProfile, 'condition', 'Burning');
    if (burning)
      emitSkillCondition(context, {
        at,
        source: 'Trait',
        sourceId: traitId,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: ID.UNSHEATHE_GUNSABER,
        skillName: 'Unsheathe Gunsaber',
        name: 'Sharp as the Wind — Burning',
        condition: 'Burning',
        stacks: effectNumber(traitProfile, burning, 'stacks'),
        duration: effectNumber(traitProfile, burning, 'duration')
      });
  } else if (traitId === TRAIT.RIVERS_FLOW) {
    const might = requireEffect(traitProfile, 'boon', 'might');
    if (might)
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
        stacks: effectNumber(traitProfile, might, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          context.skill,
          'might',
          effectNumber(traitProfile, might, 'duration')
        ),
        audience: { recipients: 'party' as const }
      });
  }

  state.gunsaberSwapTraitReadyAt = at + balanceProfileNumber(traitProfile, 'internalCooldown');
  const positiveFlow = requireEffect(traitProfile, 'buff', 'positive-flow');
  // Removed packets do not open their associated state or schedule follow-ups.
  if (!positiveFlow) return;
  const positiveFlowDuration = effectNumber(traitProfile, positiveFlow, 'duration');
  // Keep a continuous regeneration window across live refreshes; reopen only after its exact endpoint.
  if (state.traitPositiveFlowUntil <= at) {
    state.traitPositiveFlowStartedAt = at;
  }

  state.traitPositiveFlowUntil = gw2EffectExpiresAt(at, positiveFlowDuration);
  state.traitPositiveFlowStacks = effectNumber(traitProfile, positiveFlow, 'stacks');
  if (positiveFlow)
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillId: ID.UNSHEATHE_GUNSABER,
      skillName: 'Unsheathe Gunsaber',
      name: 'Positive Flow',
      kind: 'positive-flow',
      stacks: state.traitPositiveFlowStacks,
      duration: positiveFlowDuration
    });
}

/** Applies traits that react to entering Dragon Trigger. */
export function applyDragonTriggerEntryTraits(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!hasTrait(context, TRAIT.DRAGONSCALE_DEFENSE)) return;
  const dragonscaleDefenseProfile = requireBalanceProfileFromContext(context, PROFILE.dragonscaleDefense);
  const stability = requireEffect(dragonscaleDefenseProfile, 'boon', 'stability');
  if (stability)
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
      stacks: effectNumber(dragonscaleDefenseProfile, stability, 'stacks'),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        'stability',
        effectNumber(dragonscaleDefenseProfile, stability, 'duration')
      )
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
      controlKind: 'stun'
    });
  }

  if (hasTrait(context, TRAIT.DARING_DRAGON)) {
    const daringDragonProfile = requireBalanceProfileFromContext(context, TRAIT.DARING_DRAGON);
    const alacrity = requireEffect(daringDragonProfile, 'boon', 'alacrity');
    if (alacrity)
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
        stacks: effectNumber(daringDragonProfile, alacrity, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          'alacrity',
          effectNumber(daringDragonProfile, alacrity, 'duration')
        ),
        audience: { recipients: 'party' as const }
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
  const lushForestProfile = requireBalanceProfileFromContext(context, PROFILE.lushForest);
  const rechargeReduction = balanceProfileNumber(lushForestProfile, 'rechargeReduction');
  const cooldownReduction = reduceMatchingCooldowns(
    context,
    (skill) => !LUSH_FOREST_EXCLUDED_SKILL_IDS.has(Number(skill.id)) && skillIsOnActiveBar(context, skill),
    rechargeReduction,
    at
  );

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
  if (roundsSpent > 0 && hasTrait(context, TRAIT.FIERCE_AS_FIRE)) {
    const fierceAsFireProfile = requireBalanceProfileFromContext(context, PROFILE.fierceAsFire);
    const effect = requireEffect(fierceAsFireProfile, 'buff', 'fierce-as-fire');
    if (effect) {
      const duration = effectNumber(fierceAsFireProfile, effect, 'duration');
      // Buff applications are the shared source for live stacks and their presentation.
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
  }

  if (roundsSpent > 0 && startedFull && skill.id !== ID.ARTILLERY_SLASH && hasTrait(context, TRAIT.LUSH_FOREST)) {
    activateLushForest(context, skill, at);
  }

  if (dragonAdrenalineSpent > 0) {
    const stacks = dragonAdrenalineSpent >= 30 ? 4 : dragonAdrenalineSpent >= 20 ? 3 : 2;
    grantBerserkersPower(context, stacks, at, skill);
  }
}

/** Applies Guns and Glory when a qualifying Bladesworn explosion resolves. */
export function observeBladeswornExplosionTraits(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent
): void {
  if (!hasTrait(context, TRAIT.GUNS_AND_GLORY)) return;
  const state = bladeswornState.from(context);

  const remaining = Math.max(0, state.gunsAndGloryUntil - event.at);
  const gunsAndGloryProfile = requireBalanceProfileFromContext(context, PROFILE.gunsAndGlory);
  const duration = Math.min(
    balanceProfileNumber(gunsAndGloryProfile, 'maximumStacks'),
    remaining + balanceProfileNumber(gunsAndGloryProfile, 'resourceGain')
  );
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
