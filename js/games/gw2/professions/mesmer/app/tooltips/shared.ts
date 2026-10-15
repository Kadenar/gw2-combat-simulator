import {
  tooltipSeconds,
  profileFact,
  tooltipProfile,
  simulationEffectFacts
} from '#gw2/app/shared/simulation-tooltip.js';
import { mesmerProfiledShatter } from '#gw2/professions/mesmer/core/profiles.js';
import { cloneShatterEffects } from '#gw2/professions/mesmer/core/mechanics/shatter-projection.js';
import { bladesongEffects } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesong-projection.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { DescribeSimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

// Mechanic owners project selected resource tiers; this layer only aggregates and labels their effects.
export const shatterTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const id = Number(entity.id);
  const bladesong = MESMER_VIRTUOSO_SHATTERS[id] != null;
  const definition = { ...MESMER_CORE_SHATTERS, ...MESMER_CHRONOMANCER_SHATTERS, ...MESMER_VIRTUOSO_SHATTERS }[id];
  const shatter = mesmerProfiledShatter(balanceContext, definition);
  const profile = tooltipProfile(balanceContext, definition.balanceProfileId);
  const native = balanceContext.catalog.skillsById.get(entity.id)! as MesmerSkill;
  const projectEffects = bladesong ? bladesongEffects : cloneShatterEffects;
  // Resolve by resource tier so removing a strike cannot relabel its surviving neighbors.
  const facts = shatter.strikes.flatMap((_, tier) => {
    if (tier < (shatter.minimumResource ?? 0)) return [];
    const qualifier = `${tier} ${bladesong ? 'blades' : 'clones'} spent`;
    return simulationEffectFacts(projectEffects(balanceContext, shatter, native, tier), qualifier).facts;
  });
  if (profile.rechargeReduction != null)
    facts.push(
      profileFact(
        balanceContext,
        profile.id,
        'rechargeReduction',
        'Recharge reduction per shatter source',
        tooltipSeconds
      )
    );
  return {
    description: bladesong
      ? 'Spend your stocked blades to perform this bladesong. Its attack depends on the number spent. Eligible bladesong and shatter traits apply; Distortion has no direct damage in the simulation.'
      : 'Shatter your active clones, with an additional effect from yourself. The listed tiers are alternatives based on clones spent. Shatter traits can add conditions, boons, or further effects.',
    facts
  };
};
