import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { reduceMatchingCooldowns } from '#gw2/platform/execution/cooldowns.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { isEngineerToolbeltSkill } from '#gw2/professions/engineer/core/traits/index.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import type { EngineerCastContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Spends dodge endurance, applies dodge-triggered traits, and publishes the resulting Engineer state. */
export function performEngineerDodge(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const at = context.start;
  const resourcesProfile = requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources);
  const enduranceCost = balanceProfileNumber(resourcesProfile, 'resourceCost');
  Object.assign(state, spendEndurance(state, enduranceCost, at, state.maximumEndurance));

  context.emit({
    type: 'engineer.dodge',
    at,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name
  });

  // Power Wrench rewards the dodge by advancing active elite-skill recharge.
  if (hasTrait(context.config, TRAIT.POWER_WRENCH)) {
    const powerWrenchProfile = requireBalanceProfileFromContext(context, TRAIT.POWER_WRENCH);
    const reducedBy = reduceMatchingCooldowns(
      context,
      (candidate) => candidate.type === 'Elite' || candidate.slot === 'Elite',
      balanceProfileNumber(powerWrenchProfile, 'rechargeReduction'),
      at
    );
    // only emit proc when something actually changed — suppresses no-op entries in the event log
    if (reducedBy > 0) {
      context.emit({
        type: 'proc',
        at,
        source: 'Trait',
        sourceId: TRAIT.POWER_WRENCH,
        actorType: 'effect',
        name: 'Power Wrench',
        procType: 'trait',
        sourceSkill: skill.name,
        cooldownReduction: reducedBy
      });
    }
  }

  // Adrenal Implant independently advances every active toolbelt recharge.
  if (hasTrait(context.config, TRAIT.ADRENAL_IMPLANT)) {
    const adrenalImplantProfile = requireBalanceProfileFromContext(context, TRAIT.ADRENAL_IMPLANT);
    const reducedBy = reduceMatchingCooldowns(
      context,
      isEngineerToolbeltSkill,
      balanceProfileNumber(adrenalImplantProfile, 'rechargeReduction'),
      at
    );
    if (reducedBy > 0) {
      context.emit({
        type: 'proc',
        at,
        source: 'Trait',
        sourceId: TRAIT.ADRENAL_IMPLANT,
        actorType: 'effect',
        name: 'Adrenal Implant',
        procType: 'trait',
        sourceSkill: skill.name,
        cooldownReduction: reducedBy
      });
    }
  }

  // "dodge" cause lets downstream state subscribers (e.g. scrapper gyro checks) react post-dodge
  emitEngineerStateSnapshot(context, at, 'dodge');
}
