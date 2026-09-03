/** Owns spear etching progress and one-shot empowerments that survive until a later cast consumes them. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import { emitSkillControl } from '#gw2/platform/scheduler/skill-events.js';
import { ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';
import { etchingChain, skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import type {
  ElementalistCastContext,
  ElementalistSchedulerContext,
  ElementalistSimulationEvent
} from '#gw2/professions/elementalist/types.js';

/** Seeds etching progress and snapshots armed one-shot bonuses for this activation. */
export function beginElementalistSpearCast(context: ElementalistCastContext, skill: Skill): void {
  const state = professionCoreState(context);
  const chain = etchingChain(skill.id);
  if (chain && Number(skill.id) === chain.etchingId && skillWeapon(skill) === 'Spear') {
    state.etchings[chain.etching] = { stage: 'lesser', otherCasts: 0 };
  }

  if (skillWeapon(skill) !== 'Spear' || String(skill.slot || '') === 'Weapon_1') return;
  const followup = {
    damage: state.spearNextDamageBonus,
    critical: state.spearNextGuaranteedCritical,
    control: state.spearNextControlHit
  };
  if (!followup.damage && !followup.critical && !followup.control) return;
  state.spearFollowups[context.reservationId] = followup;
  state.spearNextDamageBonus = false;
  state.spearNextGuaranteedCritical = false;
  state.spearNextControlHit = false;
}

/** Applies and consumes the one-shot spear bonuses captured for this activation. */
export function consumeElementalistSpearFollowup(
  context: ElementalistCastContext,
  skill: Skill,
  activationEvents: readonly ElementalistSimulationEvent[]
): void {
  const state = professionCoreState(context);
  const followup = state.spearFollowups[context.reservationId];
  if (!followup) return;
  for (const event of activationEvents) {
    context.replaceEvent(event, {
      ...(followup.damage
        ? {
            coefficient:
              Number(event.coefficient || 0) *
              balanceProfileValueFromContext(context, PROFILE.spearEmpowerments, 'damageMultiplier', 1.2)
          }
        : {}),
      ...(followup.critical ? { forceCrit: true } : {})
    });
  }

  if (followup.control && activationEvents[0]) {
    emitSkillControl(context, {
      at: activationEvents[0].at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      skillId: skill.id,
      controlKind: 'crowd-control'
    });
  }

  delete state.spearFollowups[context.reservationId];
}

/** Consumes a released etching or advances every armed etching after a completed cast. */
export function completeElementalistSpearProgression(context: ElementalistCastContext, skill: Skill): void {
  const state = professionCoreState(context);
  const chain = etchingChain(skill.id);
  if (chain && Number(skill.id) !== chain.etchingId && skillWeapon(skill) === 'Spear') {
    state.etchings[chain.etching] = null;
    return;
  }

  if (chain && Number(skill.id) !== chain.etchingId) return;

  for (const candidate of ETCHING_CHAINS) {
    const progress = state.etchings[candidate.etching];
    if (!progress || progress.stage !== 'lesser' || Number(skill.id) === candidate.etchingId) continue;
    const otherCasts = progress.otherCasts + 1;
    state.etchings[candidate.etching] = {
      stage:
        otherCasts >= balanceProfileValueFromContext(context, PROFILE.spearEmpowerments, 'maximumStacks', 3)
          ? 'full'
          : 'lesser',
      otherCasts
    };
  }
}

/** Mechanic-trigger handlers arm each one-shot spear bonus for a future cast. */
export const elementalistSpearMechanicHandlers = Object.freeze({
  'elementalist.core.arm-spear-damage': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextDamageBonus = true;
  },
  'elementalist.core.arm-spear-recharge': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextRechargeReduction = true;
  },
  'elementalist.core.arm-spear-critical': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextGuaranteedCritical = true;
  },
  'elementalist.core.arm-spear-control': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextControlHit = true;
  }
});
