import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/** Owns spear etching progress and one-shot empowerments that survive until a later cast consumes them. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { emitElementalistControl } from '#gw2/professions/elementalist/core/events.js';
import { ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';
import { etchingChain, skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import type { ElementalistRuntime, ElementalistSimulationEvent } from '#gw2/professions/elementalist/types.js';

/** Seeds etching progress and snapshots armed one-shot bonuses for this activation. */
export function beginElementalistSpearCast(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const state = professionCoreState(context);
  if (skillWeapon(skill) !== 'Spear' || String(skill.slot || '') === 'Weapon_1') return;
  const followup = {
    damage: state.spearNextDamageBonus,
    critical: state.spearNextGuaranteedCritical,
    control: state.spearNextControlHit
  };
  if (!followup.damage && !followup.critical && !followup.control) return;
  state.spearFollowups[cast.id] = followup;
  state.spearNextDamageBonus = false;
  state.spearNextGuaranteedCritical = false;
  state.spearNextControlHit = false;
}

/** Strike packets read the accepted cast's snapshot, while the first hit owns its control rider. */
export function empowerElementalistSpearPacket(
  context: ElementalistRuntime,
  event: ElementalistSimulationEvent
): ElementalistSimulationEvent {
  const followup = context.profession.core.spearFollowups[String(event.activationId)];
  if (!followup || event.type !== 'damage' || !(Number(event.coefficient) > 0)) return event;
  if (followup.control) {
    followup.control = false;
    emitElementalistControl(context, { ...event, controlKind: 'crowd-control' });
  }

  return {
    ...event,
    ...(followup.damage
      ? {
          coefficient:
            Number(event.coefficient) *
            balanceProfileNumber(
              requireBalanceProfileFromContext(context, PROFILE.spearEmpowerments),
              'damageMultiplier'
            )
        }
      : {}),
    ...(followup.critical ? { forceCrit: true } : {})
  };
}

/** Consumes a released etching or advances every armed etching after a completed cast. */
export function completeElementalistSpearProgression(
  context: ElementalistRuntime,
  _cast: RuntimeCast,
  skill: Skill
): void {
  const state = professionCoreState(context);
  const chain = etchingChain(skill.id);
  if (chain && skill.id === chain.etchingId && skillWeapon(skill) === 'Spear') {
    const expiresAt = context.time + Number(skill.comboFields?.[0]?.duration ?? 0);
    state.etchings[chain.etching] = { stage: 'lesser', otherCasts: 0, expiresAt };
    context.schedule('elementalist.expire-state', expiresAt, null);
  }

  if (chain && Number(skill.id) !== chain.etchingId && skillWeapon(skill) === 'Spear') {
    state.etchings[chain.etching] = null;
    return;
  }

  if (chain && Number(skill.id) !== chain.etchingId) return;

  for (const candidate of ETCHING_CHAINS) {
    const progress = state.etchings[candidate.etching];
    if (!progress || progress.stage !== 'lesser' || Number(skill.id) === candidate.etchingId) continue;
    const otherCasts = progress.otherCasts + 1;
    const spearEmpowermentsProfile = requireBalanceProfileFromContext(context, PROFILE.spearEmpowerments);
    state.etchings[candidate.etching] = {
      ...progress,
      stage: otherCasts >= balanceProfileNumber(spearEmpowermentsProfile, 'maximumStacks') ? 'full' : 'lesser',
      otherCasts
    };
  }
}

/** Mechanic-trigger handlers arm each one-shot spear bonus for a future cast. */
export const elementalistSpearMechanicHandlers = Object.freeze({
  'elementalist.core.arm-spear-damage': (context: ElementalistRuntime): void => {
    professionCoreState(context).spearNextDamageBonus = true;
  },
  'elementalist.core.arm-spear-recharge': (context: ElementalistRuntime): void => {
    professionCoreState(context).spearNextRechargeReduction = true;
  },
  'elementalist.core.arm-spear-critical': (context: ElementalistRuntime): void => {
    professionCoreState(context).spearNextGuaranteedCritical = true;
  },
  'elementalist.core.arm-spear-control': (context: ElementalistRuntime): void => {
    professionCoreState(context).spearNextControlHit = true;
  }
});
