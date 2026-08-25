import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { applyTraitCondition, applyTraitVulnerability } from '../../core/traits.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
} from '../../types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function reactToDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  // Trait procs must not trigger from synthetic "effect" damage (e.g. Cascading Corruption Meltdown hits).
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  // Doom Approaches Vulnerability applies only on the first hit of Tainted Bolts, not each chain projectile.
  const firstHit = Number(event.hitIndex || 1) === 1;
  if (hasTrait(context, TRAIT.DOOM_APPROACHES) && firstHit && skill?.id === ID.TAINTED_BOLTS) {
    const vulnerability = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.doomApproaches), 'condition');
    applyTraitVulnerability(context, event, {
      name: 'Doom Approaches',
      traitId: TRAIT.DOOM_APPROACHES,
      stacks: Number(vulnerability?.stacks || 2),
      duration: Number(vulnerability?.duration || 6)
    });
  }

  // Septic Corruption procs on shroud slot 2 specifically (the pistol #2 skill), not all pistol hits.
  if (hasTrait(context, TRAIT.SEPTIC_CORRUPTION) && skill?.shroudSlot === 2) {
    const condition = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.septicCorruption), 'condition');
    applyTraitCondition(details, context, event, {
      name: 'Septic Corruption',
      traitId: TRAIT.SEPTIC_CORRUPTION,
      condition: String(condition?.condition || 'Poisoned'),
      stacks: Number(condition?.stacks || 1),
      duration: Number(condition?.duration || 3)
    });
  }
}

export const harbingerResolverEventReactions = Object.freeze({
  damage: reactToDamage
});
