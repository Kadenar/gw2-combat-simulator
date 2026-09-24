import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';

import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import type { ThiefCastContext } from '#gw2/professions/thief/types.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { spendProfessionEndurance } from '#gw2/platform/combat/resources/endurance-policy.js';

// Spend endurance at dodge start and materialize Uncatchable's delayed Lesser
// Caltrops pulses from the selected balance profile.
export function performThiefDodge(context: ThiefCastContext): void {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  spendProfessionEndurance(context, balanceProfileNumber(resourcesProfile, 'resourceCost'), context.start);
  emitThiefStateSnapshot(context, context.start, 'dodge');
  if (hasTrait(context.config, TRAIT.UNCATCHABLE)) {
    // Each surviving condition owns its pulses; deleting Bleeding cannot remove Crippled.
    const uncatchableProfile = requireBalanceProfileFromContext(context, PROFILE.uncatchable);
    const initialDelay = balanceProfileNumber(uncatchableProfile, 'initialDelay');
    const pulseInterval = balanceProfileNumber(uncatchableProfile, 'pulseInterval');
    for (const name of ['Bleeding', 'Crippled']) {
      const effect = requireEffect(uncatchableProfile, 'condition', name);
      if (!effect) continue;
      const applications = effectNumber(uncatchableProfile, effect, 'applications');
      // Read this condition once, then reuse its tuning for each pulse.
      const duration = effectNumber(uncatchableProfile, effect, 'duration');
      const stacks = effectNumber(uncatchableProfile, effect, 'stacks');
      for (let pulse = 0; pulse < applications; pulse += 1) {
        const at = context.start + initialDelay + pulse * pulseInterval;
        emitSkillCondition(context, {
          at,
          source: 'Trait',
          skillId: ID.LESSER_CALTROPS,
          skillName: 'Lesser Caltrops',
          icon: context.catalog.skillsById.get(ID.LESSER_CALTROPS)?.icon,
          triggeredBy: context.skill?.name,
          condition: String(effect.condition),
          duration,
          stacks,
          sourceId: TRAIT.UNCATCHABLE,
          name: 'Uncatchable � Lesser Caltrops'
        });
      }
    }
  }
}

// Grant Upper Hand's initiative at dodge completion only when its independent
// cooldown is ready.
export function completeThiefDodge(context: ThiefCastContext): void {
  if (!hasTrait(context.config, TRAIT.UPPER_HAND)) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;

  const upperHandProfile = requireBalanceProfileFromContext(context, PROFILE.upperHand);
  // Claim this owner's ICD before effects or resource snapshots can re-enter the trait.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      TRAIT.UPPER_HAND,
      at,
      balanceProfileNumber(upperHandProfile, 'internalCooldown')
    )
  )
    return;
  gainThiefInitiative(context, balanceProfileNumber(upperHandProfile, 'resourceGain'), at, 'upper-hand');
}
