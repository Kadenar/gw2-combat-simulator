/** Applies Core Necromancer trait effects and flip transitions around completed casts. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2AlliedEffectRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/content/professions/necromancer/types.js';
import { finalizeNecromancerCast } from '#gw2/content/professions/necromancer/core/mechanics/life-force.js';
import {
  addCarapace,
  gainNecromancerLifeForce,
  necromancerActiveMinionCompanionIds
} from '#gw2/content/professions/necromancer/core/mechanics/state-helpers.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  balanceProfileEffect,
  necromancerBalanceProfile
} from '#gw2/content/professions/necromancer/core/profiles.js';

/** Reconciles completed-cast flips and Fear of Death before trait effects are emitted. */
function updateNecromancerCastState(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = professionCoreState(context);
  const completed = context.effectiveEnd >= context.fullEnd - context.epsilon;
  if (!completed) return;

  const chainNext = context.catalog.autoattackChainPositions.get(Number(skill.id))?.next;
  // Arm explicit timed flips while leaving autoattack chains and minion commands to their dedicated controllers.
  if (
    skill.flipSkillId != null &&
    skill.flipSkillId !== chainNext &&
    skill.flipSkillId !== skill.nextChainId &&
    skill.handlerId !== 'necromancer.minion'
  ) {
    const flip = context.catalog.skillsById.get(skill.flipSkillId);
    if (flip && flip.name !== skill.name && flip.flipParentId === skill.id) {
      state.availableFlips[flip.id] =
        context.rechargeStart + Math.max(1, Number(skill.flipDuration ?? skill.cooldown ?? skill.recharge ?? 5));
    }
  }

  // A completed child cast consumes its own armed flip unless it is a persistent shroud exit.
  if (skill.flipParentId != null && !skill.shroudExit && skill.handlerId !== 'necromancer.minion-command') {
    delete state.availableFlips[skill.id];
  }

  // Fear of Death grants life force only for completed fear-producing skills and respects its internal cooldown.
  const control = (skill.effects || []).find((effect) => effect.type === 'control');
  if (
    control?.metadata?.controlKind === 'fear' &&
    hasTrait(context, TRAIT.FEAR_OF_DEATH) &&
    isInternalCooldownReady(context.effectiveEnd, Number(state.fearOfDeathReadyAt || 0))
  ) {
    gainNecromancerLifeForce(context, 15, context.effectiveEnd, 'fear-of-death');
    state.fearOfDeathReadyAt = context.effectiveEnd + 4;
  }
}

const TASTE_FOR_BLOOD_STACKS_BY_SKILL = new Map<number, number>([
  [ID.NECROTIC_BITE, 1],
  [ID.LIFE_SIPHON, 3],
  [ID.DARK_PACT, 3],
  [ID.DEATHLY_SWARM, 3],
  [ID.ENFEEBLING_BLOOD, 3]
]);

/** Grants Taste for Blood before the activating dagger skill can spend those party stacks. */
export function applyNecromancerCastStartTraits(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  const stacks = TASTE_FOR_BLOOD_STACKS_BY_SKILL.get(Number(skill.id));
  if (!stacks) return;

  const buff = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.overflowingThirst), 'buff');
  const duration = Number(buff?.duration || 10);
  // Resolve the exact self, allied-player, and active-minion recipients for this grant.
  const selected = gw2AlliedEffectRecipients(context.config, {
    maximumRecipients: 5,
    companionIds: necromancerActiveMinionCompanionIds(context)
  });
  const recipients = {
    recipients: 'party' as const,
    maximumRecipients: 5,
    affectsSelf: selected.includesSelf,
    affectsSummons: selected.companionIds.length > 0,
    alliedPlayerCount: selected.alliedPlayerCount,
    companionIds: selected.companionIds,
    recipientCount: selected.recipientCount
  };
  // Emit both the visible buff and the profession event that seeds per-recipient charge pools.
  emitSkillBuff(context, skill, {
    at: context.start,
    kind: String(buff?.kind || 'taste-for-blood'),
    duration,
    stacks,
    metadata: recipients
  });
  context.emit({
    type: 'necromancer.taste-for-blood-grant',
    at: context.start,
    source: 'Trait',
    sourceId: TRAIT.OVERFLOWING_THIRST,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    duration,
    stacks,
    ...recipients
  });
}

/** Applies completion-gated Core trait effects before finalizing shared life-force state. */
export function applyNecromancerAfterCastTraits(context: NecromancerCastContext, skill: NecromancerSkill): void {
  updateNecromancerCastState(context, skill);
  const state = professionCoreState(context);
  // Healing-skill traits apply their independent cooldown-bound defenses and strikes.
  if (
    skill.type === 'Heal' &&
    hasTrait(context, TRAIT.DARK_DEFENSE) &&
    isInternalCooldownReady(context.effectiveEnd, Number(state.traitProcReadyAt.darkDefense || 0))
  ) {
    state.traitProcReadyAt.darkDefense = context.effectiveEnd + 5;
    addCarapace(state, 10, context.effectiveEnd);
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      kind: 'protection',
      duration: 3,
      stacks: 1
    });
  }

  // Signet casts produce their trait-owned life-steal packet after completion.
  if (skill.categories?.includes('Signet') && hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING)) {
    emitSkillDamage(context, skill, {
      at: context.effectiveEnd,
      name: 'Signets of Suffering',
      source: 'Trait',
      sourceId: TRAIT.SIGNETS_OF_SUFFERING,
      actorType: 'effect',
      coefficient: 0,
      skillWeapon: 'Unequipped',
      metadata: {
        flatStrikeBase: 1413,
        noCrit: true,
        damageKind: 'life-steal'
      }
    });
  }

  if (
    skill.type === 'Heal' &&
    hasTrait(context, TRAIT.MALICIOUS_SWARM) &&
    isInternalCooldownReady(context.effectiveEnd, Number(state.traitProcReadyAt.maliciousSwarm || 0))
  ) {
    state.traitProcReadyAt.maliciousSwarm = context.effectiveEnd + 15;
    emitSkillDamage(context, skill, {
      at: context.effectiveEnd,
      name: 'Lesser Signet of the Locust',
      source: 'Trait',
      sourceId: TRAIT.MALICIOUS_SWARM,
      actorType: 'effect',
      coefficient: 1,
      skillWeapon: 'Unequipped'
    });
  }

  // Shroud slot four triggers Lesser Chilblains as linked strike, poison, and chill packets.
  if (skill.shroudSlot === 4 && hasTrait(context, TRAIT.TRANSFUSION)) {
    const lesserChilblainsIcon = String(context.catalog.skillsById.get(ID.CHILLBLAINS)?.icon || '');
    emitSkillDamage(context, skill, {
      at: context.effectiveEnd,
      name: 'Lesser Chilblains',
      source: 'Trait',
      sourceId: TRAIT.TRANSFUSION,
      actorType: 'effect',
      skillId: ID.LESSER_CHILBLAINS,
      skillName: 'Lesser Chilblains',
      parentSkillName: skill.name,
      triggeredBy: skill.name,
      coefficient: 1.8,
      skillWeapon: 'Unequipped',
      metadata: { icon: lesserChilblainsIcon }
    });
    emitSkillCondition(context, skill, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.TRANSFUSION,
      actorType: 'effect',
      skillId: ID.LESSER_CHILBLAINS,
      skillName: 'Lesser Chilblains',
      parentSkillName: skill.name,
      triggeredBy: skill.name,
      name: 'Lesser Chilblains - Poisoned',
      condition: 'Poisoned',
      stacks: 2,
      duration: 4,
      metadata: { icon: lesserChilblainsIcon }
    });
    context.emit({
      type: 'necromancer.chill',
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.TRANSFUSION,
      actorType: 'effect',
      skillId: skill.id,
      skillName: 'Lesser Chilblains',
      duration: 2
    });
  }

  // Shared life-force and skill-specific resource changes run after every completion-gated trait.
  finalizeNecromancerCast(context, skill);
}
