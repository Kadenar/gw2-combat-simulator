import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerConditionFromProfile } from '#gw2/professions/mesmer/core/mechanics/conditions.js';

/** Resolve blade packets once for runtime and tooltips; defensive tiers retain hit-trait identity without damage. */
export function bladesongTier(shatter: MesmerShatter, skill: MesmerSkill, spent: number) {
  const selected = shatter.strikes[spent];
  return {
    traitStrike: selected,
    strike:
      selected && shatter.kind !== 'blade-defense'
        ? {
            ...selected,
            name: undefined,
            summonKind: undefined,
            ...(shatter.kind === 'blade-control'
              ? { hits: 1 }
              : { timingAnchor: 'castStart' as const, timingScale: 'fixed' as const })
          }
        : undefined,
    effects: shatter.kind === 'blade-control' ? (skill.effects ?? []) : []
  };
}

/** Confusion follows selected blade impacts, retaining its authored cadence when the strike tier is removed. */
export function bladesongConfusion(
  shatter: MesmerShatter,
  spent: number,
  condition: ConditionEffect | undefined
): ConditionEffect | undefined {
  if (!condition) return undefined;
  return {
    type: 'condition',
    ticks: (shatter.strikes[spent]?.ticks?.map((tick) => tick.atMs) ?? shatter.conditionAtMs?.[spent] ?? []).map(
      (atMs) => ({
        atMs,
        condition: 'Confusion',
        duration: Number(condition.duration),
        stacks: Number(condition.stacks)
      })
    ),
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  };
}

/** Describe the untraited bladesong from the same selected strike and condition projections used in combat. */
export function bladesongEffects(
  context: unknown,
  shatter: MesmerShatter,
  skill: MesmerSkill,
  spent: number
): SkillEffect[] {
  const tier = bladesongTier(shatter, skill, spent);
  const confusion =
    shatter.kind === 'blade-confusion'
      ? bladesongConfusion(shatter, spent, mesmerConditionFromProfile(context, shatter.balanceProfileId, 'Confusion'))
      : undefined;
  return [...(tier.strike ? [tier.strike] : []), ...(confusion ? [confusion] : []), ...tier.effects];
}
