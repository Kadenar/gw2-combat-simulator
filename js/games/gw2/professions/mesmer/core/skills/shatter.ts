import type { CustomSideEffectAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Author tiers directly on the resource transaction; runtime selects a tier without emitting its siblings. */
export function shatterSkill(
  definition: Omit<MesmerShatterDefinition, 'tierCount' | 'conditionAtMs'> & {
    readonly coefficients: readonly number[];
    readonly ticks?: readonly (readonly StrikeTick[])[];
    readonly effects?: readonly SkillEffect[];
    readonly durationPerTier?: number;
    readonly rechargeReductionPerSource?: number;
  },
  type: CustomSideEffectAction['type'] = 'mesmer.shatter'
): Partial<MesmerSkill> {
  const { coefficients, ticks, effects, durationPerTier, rechargeReductionPerSource, ...mechanic } = definition;
  return {
    shatter: {
      ...mechanic,
      tierCount: coefficients.length,
      // Condition delivery remains independent when a patch removes its sibling strike tier.
      conditionAtMs:
        mechanic.kind === 'blade-confusion' ? ticks?.map((tier) => tier.map((tick) => tick.atMs)) : undefined
    },
    ...(durationPerTier == null ? {} : { durationPerTier }),
    ...(rechargeReductionPerSource == null ? {} : { rechargeReductionPerSource }),
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          id: 'shatter',
          type,
          effects: [
            ...coefficients.map((coefficient, tier): SkillEffect =>
              ticks?.[tier]?.length
                ? {
                    type: 'strike',
                    name: `${tier} resources`,
                    ticks: ticks[tier],
                    timingAnchor: 'castEnd',
                    timingScale: 'fixed'
                  }
                : { type: 'strike', name: `${tier} resources`, coefficient, hits: 1 }
            ),
            ...(effects ?? [])
          ]
        }
      }
    ]
  };
}
