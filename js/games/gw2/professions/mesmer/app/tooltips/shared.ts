import { simulationEffectFacts, skillFact, tooltipSeconds } from '#gw2/app/shared/simulation-tooltip.js';
import type { DescribeSimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import type { TooltipFact } from '#gw2/platform/skills/types.js';
import { mesmerSelectedShatter } from '#gw2/professions/mesmer/core/mechanics/selected-shatter.js';
import { cloneShatterEffects } from '#gw2/professions/mesmer/core/mechanics/shatter-projection.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { bladesongEffects } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesong-projection.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';

/** Storm poison packets are independent chances, so their facts must not promise a fixed application count. */
export function chaosStormPoisonFacts(facts: readonly TooltipFact[]): readonly TooltipFact[] {
  return facts.map((fact) =>
    fact.name === 'Poisoned'
      ? { ...fact, applications: undefined, detail: `${fact.detail} · 1/3 chance per pulse` }
      : fact
  );
}

// Describe each bladesong's own effects without attaching defensive notes to damaging skills.
const bladesongDescriptions: Readonly<Record<number, string>> = {
  [ID.BLADESONG_HARMONY]: 'Spend all stocked blades to strike your target. More blades deal more strike damage.',
  [ID.BLADESONG_SORROW]:
    'Spend all stocked blades to strike your target and inflict confusion. More blades deal more damage and apply more confusion.',
  [ID.BLADESONG_DISSONANCE]:
    'Spend all stocked blades to strike and daze your target. Base strike damage is the same at every blade count.',
  [ID.BLADETURN_REQUIEM]: 'Spend all stocked blades to strike nearby enemies repeatedly. More blades add more strikes.',
  [ID.BLADESONG_DISTORTION]:
    'Spend all stocked blades to gain distortion. This skill deals no direct damage. Shatter traits can add effects.'
};

// Mechanic owners project selected resource tiers; this layer only aggregates and labels their effects.
export const shatterTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const id = Number(entity.id);
  const bladesong = MESMER_VIRTUOSO_SHATTERS[id] != null;
  const shatter = mesmerSelectedShatter(balanceContext.catalog, id);
  const native = balanceContext.catalog.skillsById.get(entity.id)! as MesmerSkill;

  // Resource tiers are alternatives, so tabs keep each blade count's effects together.
  if (bladesong) {
    const factTabs = shatter.strikes.flatMap((_, tier) =>
      tier < (shatter.minimumResource ?? 0)
        ? []
        : [
            {
              label: `${tier} ${tier === 1 ? 'blade' : 'blades'}`,
              facts: simulationEffectFacts(bladesongEffects(balanceContext.catalog, shatter, native, tier)).facts
            }
          ]
    );
    const sharedFacts = factTabs[0]?.facts ?? [];
    const identicalTiers = factTabs.every(({ facts }) => JSON.stringify(facts) === JSON.stringify(sharedFacts));
    return {
      description: bladesongDescriptions[id]!,
      facts: identicalTiers ? sharedFacts : [],
      ...(!identicalTiers ? { factTabs } : {})
    };
  }

  // Resolve by resource tier so removing a strike cannot relabel its surviving neighbors.
  const facts = shatter.strikes.flatMap((_, tier) => {
    if (tier < (shatter.minimumResource ?? 0)) return [];

    const qualifier = `${tier} ${tier === 1 ? 'clone' : 'clones'} spent`;
    return simulationEffectFacts(cloneShatterEffects(balanceContext.catalog, shatter, native, tier), qualifier).facts;
  });

  if (native.rechargeReductionPerSource != null)
    facts.push(
      skillFact(
        balanceContext,
        native.id,
        'rechargeReductionPerSource',
        'Recharge reduction per shatter source',
        tooltipSeconds
      )
    );

  return {
    description:
      'Shatter your active clones, with an additional effect from yourself. The listed tiers are alternatives based on clones spent. Shatter traits can add conditions, boons, or further effects.',
    facts
  };
};
