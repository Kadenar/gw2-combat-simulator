import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyTraitCondition, applyTraitVulnerability } from '#gw2/professions/necromancer/core/traits/index.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';

/** Applies Harbinger traits triggered by eligible resolved player or summon strikes. */
function reactToDamage(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Trait procs must not trigger from synthetic "effect" damage (e.g. Cascading Corruption Meltdown hits).
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  // Doom Approaches Vulnerability applies only on the first hit of Tainted Bolts, not each chain projectile.
  const firstHit = Number(event.hitIndex || 1) === 1;
  if (hasTrait(context, TRAIT.DOOM_APPROACHES) && firstHit && skill?.id === ID.TAINTED_BOLTS) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.doomApproaches);
    const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
    if (vulnerability)
      applyTraitVulnerability(context, event, {
        name: 'Doom Approaches',
        traitId: TRAIT.DOOM_APPROACHES,
        stacks: effectNumber(profile, vulnerability, 'stacks'),
        duration: effectNumber(profile, vulnerability, 'duration')
      });
  }

  // Septic Corruption procs on shroud slot 2 specifically (the pistol #2 skill), not all pistol hits.
  if (hasTrait(context, TRAIT.SEPTIC_CORRUPTION) && skill?.shroudSlot === 2) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.septicCorruption);
    const condition = requireEffect(profile, 'condition', 'Poisoned');
    if (condition)
      applyTraitCondition(context, event, {
        name: 'Septic Corruption',
        traitId: TRAIT.SEPTIC_CORRUPTION,
        condition: String(condition.condition),
        stacks: effectNumber(profile, condition, 'stacks'),
        duration: effectNumber(profile, condition, 'duration')
      });
  }
}

export const harbingerResolverEventReactions = Object.freeze({
  damage: reactToDamage
});
