import { hasTrait } from '../../../../platform/combat/state/traits.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '../../../../platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { snapshotNecromancerState } from '../state/index.js';
import {
  gw2AlliedEffectRecipients,
  prepareGw2BuffCompanionCandidates
} from '../../../../platform/combat/state/allied-players.js';
/**
 * @fileoverview Composes Necromancer cast validation, shroud and weapon state, * trait reactions, cooldown feedback, and typed tasks into the shared
 * scheduler contract.
 */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { advanceNecromancerState, finalizeNecromancerCast } from './life-force.js';
import { transferNecromancerSelfConditions } from './conditions.js';
import {
  addCarapace,
  gainNecromancerLifeForce,
  necromancerActiveBoonCompanionIds,
  necromancerActiveMinionCompanionIds
} from './shared.js';
import { isInternalCooldownReady } from '../../../../../../kernel/core/clock.js';
import { necromancerWeaponTaskHandlers } from './weapons.js';
import { necromancerMinionTaskHandlers } from './minions.js';
import { necromancerBuildAvailability, necromancerCastAvailability } from './availability.js';
import {
  resetAutoattackChains,
  type AutoattackChainTransitionContext
} from '../../../../platform/skills/autoattack-chains.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  balanceProfileEffect,
  necromancerBalanceProfile
} from './profiles.js';
import type { ScheduledTask, SchedulerRecord, SimulationEventInput } from '../../../../platform/engine/types.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '../types.js';

const SWORD_AUTOATTACK_EXPIRY_OWNER = 'necromancer.sword-autoattack-chain';
const SWORD_AUTOATTACK_EXPIRY_TASK = 'necromancer.sword-autoattack-chain-expire';
const SWORD_AUTOATTACK_RETENTION_SECONDS = 3;

/** Clears the pending sword step only if it still matches the chain state that armed this expiry. */
function expireSwordAutoattackChain(context: NecromancerSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const root = Number(task.payload?.root);
  const next = Number(task.payload?.next);
  const state = professionCoreState(context);
  if (Number(state.autoattackChains[root]) === next) resetAutoattackChains(context, [root]);
}

/** Keeps the Necromancer sword's three-second continuation window aligned with shared transitions. */
export function observeNecromancerAutoattackTransition(transition: AutoattackChainTransitionContext): void {
  const sword = transition.result.transitions.find((change) => Number(change.chainRootId) === ID.ENERVATION_BLADE);
  if (!transition.result.committed || !sword || sword.decision === 'preserve') return;
  const context = transition.cast as unknown as NecromancerCastContext;
  context.tasks.cancelOwner(SWORD_AUTOATTACK_EXPIRY_OWNER);
  if (sword.decision !== 'advance' || sword.nextSkillId == null) return;
  context.tasks.schedule({
    type: SWORD_AUTOATTACK_EXPIRY_TASK,
    at: context.effectiveEnd + SWORD_AUTOATTACK_RETENTION_SECONDS,
    ownerId: SWORD_AUTOATTACK_EXPIRY_OWNER,
    payload: { root: sword.chainRootId, next: sword.nextSkillId }
  });
}

/**
 * Updates flip availability and completion-gated Core life-force traits after
 * the shared controller has committed autoattack-chain state.
 *
 * @param {object} context Scheduler after-cast context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
function updateNecromancerCastState(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = professionCoreState(context);
  const completed = context.effectiveEnd >= context.fullEnd - context.epsilon;
  if (!completed) return;

  const chainNext = context.catalog.autoattackChainPositions.get(Number(skill.id))?.next;

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

  if (skill.flipParentId != null && !skill.shroudExit && skill.handlerId !== 'necromancer.minion-command') {
    delete state.availableFlips[skill.id];
  }

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

/**
 * Grants Taste for Blood at activation so the granting dagger skill's own
 * direct hits can immediately spend the independently shared party stacks.
 */
function onCastStart(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  const stacks = TASTE_FOR_BLOOD_STACKS_BY_SKILL.get(Number(skill.id));
  if (!stacks) return;

  const buff = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.overflowingThirst), 'buff');
  const duration = Number(buff?.duration || 10);
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
    // EVTC effect targets confirm Taste for Blood can reach ordinary minions
    // but not Ritualist spirits, even while those spirits remain active.
    companionIds: selected.companionIds,
    recipientCount: selected.recipientCount
  };
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

/**
 * Applies all Necromancer after-cast state transitions and trait effects, then
 * lets the profession handler finalize the skill.
 *
 * @param {object} context Scheduler after-cast context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
function afterCast(context: NecromancerCastContext, skill: NecromancerSkill): void {
  updateNecromancerCastState(context, skill);
  const state = professionCoreState(context);
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

  if (skill.shroudSlot === 4 && hasTrait(context, TRAIT.TRANSFUSION)) {
    // Give the derived packets Lesser Chilblains' real skill identity and artwork while retaining the shroud trigger.
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

  finalizeNecromancerCast(context, skill);
}

/**
 * Reacts to newly scheduled player-damage events for Plague Sending.
 *
 * @param {object} context Scheduler event-observer context.
 * @param {object} event Newly scheduled event.
 * @returns {void}
 */
function onEventScheduled(context: NecromancerSchedulerContext, event: NecromancerSimulationEvent): void {
  const state = professionCoreState(context);
  if (
    !state.plagueSendingArmed ||
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0)
  )
    return;
  const skill = event.skillId == null ? undefined : context.catalog.skillsById.get(event.skillId);
  if (!skill) return;
  if (Number(state.plagueSendingEntrySkillId) === Number(event.skillId)) return;
  const transferred = transferNecromancerSelfConditions(context, skill, 2, event.at, { latestApplications: true });
  if (!transferred) return;
  state.plagueSendingArmed = false;
  state.plagueSendingEntrySkillId = null;
}

/** Runs Core Necromancer mechanics owned by one completed skill activation. */
export const necromancerCoreSkillMechanicHandlers = Object.freeze({
  'necromancer.core.reset-gravedigger-below-half': ({
    context,
    at
  }: {
    context: NecromancerSchedulerContext;
    at: number;
  }): void => {
    // Weaponmaster Training exposes this Core greatsword contract to every specialization.
    const schedulerFeedback = context.config._schedulerFeedback as { readonly targetBelowHalfAt?: number } | undefined;
    const targetBelowHalfAt = Number(schedulerFeedback?.targetBelowHalfAt);
    if (Number.isFinite(targetBelowHalfAt) && at > targetBelowHalfAt + context.epsilon) {
      context.state.cooldowns.delete(ID.GRAVEDIGGER);
    }
  }
});

/**
 * Necromancer resource/form availability and build-validation rules.
 */
export const necromancerCastRules = Object.freeze({
  availability: Object.freeze([
    {
      id: 'necromancer.cast-state',
      order: 10,
      handler: necromancerCastAvailability
    },
    {
      id: 'necromancer.build',
      order: 100,
      handler: necromancerBuildAvailability
    }
  ])
});

/**
 * Necromancer scheduler lifecycle hooks and weapon task dispatch table.
 */
export const necromancerSchedulerHooks = Object.freeze({
  prepareEvent: {
    id: 'necromancer.boon-companion-candidates',
    order: 5,
    handler: (context: NecromancerSchedulerContext, event: SimulationEventInput) =>
      prepareGw2BuffCompanionCandidates(event, necromancerActiveBoonCompanionIds(context))
  },
  advance: advanceNecromancerState,
  onCastStart,
  afterCast,
  /** Refills shared life force and clears simulated self-conditions after a global cooldown reset. */
  onCooldownReset: (context: NecromancerSchedulerContext): void => {
    const state = professionCoreState(context);
    // Every Necromancer specialization uses this shared pool, including shrouds and Scourge shade skills.
    state.lifeForce = state.maximumLifeForce;
    state.resource = state.lifeForce;
    state.selfConditions = [];
    emitStateSnapshot(
      context,
      'necromancer',
      context.state.time,
      'cooldown-reset',
      snapshotNecromancerState(context.state.profession),
      { dedupeAcrossSourceIds: true }
    );
  },
  onEventScheduled,
  taskHandlers: Object.freeze({
    [SWORD_AUTOATTACK_EXPIRY_TASK]: expireSwordAutoattackChain,
    ...necromancerWeaponTaskHandlers,
    ...necromancerMinionTaskHandlers
  })
});
