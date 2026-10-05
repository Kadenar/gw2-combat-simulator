import type { SkillEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import type { MesmerConditionApplication, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerConditionFromProfile } from '#gw2/professions/mesmer/core/mechanics/conditions.js';

/** Share player-plus-clone packet expansion between execution and presentation without scheduling effects. */
export function cloneShatterTier(shatter: MesmerShatter, skill: MesmerSkill, spent: number) {
  const sources = spent + 1;
  const selected = shatter.strikes[spent];
  const strike = selected ? { ...selected, name: undefined, summonKind: undefined, hits: sources } : undefined;
  let strikes: readonly (StrikeEffect & { readonly summonKind?: undefined })[];
  switch (shatter.kind) {
    case 'power':
      strikes = strike
        ? (strike.ticks ?? [{ atMs: strike.atMs ?? 0, coefficient: strike.coefficient }]).map((tick) => ({
            ...strike,
            ticks: undefined,
            atMs: tick.atMs,
            coefficient: tick.coefficient
          }))
        : [];
      break;
    case 'confusion':
    case 'defense':
      strikes = strike ? [{ ...strike, atMs: 0 }] : [];
      break;
    case 'control':
      strikes = [];
      break;
    default:
      throw new Error(`Unsupported clone shatter kind: ${shatter.kind}.`);
  }

  return {
    sources,
    strikes,
    effects:
      shatter.kind === 'control' ? (skill.effects ?? []).map((effect) => ({ ...effect, applications: sources })) : []
  };
}

/** Each clone and the player apply the selected Confusion budget, including runtime trait overrides. */
export function cloneShatterConfusion(condition: MesmerConditionApplication | undefined, sources: number) {
  return condition ? { ...condition, stacks: sources * (condition.stacks ?? 1) } : undefined;
}

/** Project base shatter effects using the same packet and condition rules as the runtime. */
export function cloneShatterEffects(
  context: unknown,
  shatter: MesmerShatter,
  skill: MesmerSkill,
  spent: number
): SkillEffect[] {
  const tier = cloneShatterTier(shatter, skill, spent);
  const confusion =
    shatter.kind === 'confusion'
      ? cloneShatterConfusion(mesmerConditionFromProfile(context, shatter.balanceProfileId, 'Confusion'), tier.sources)
      : undefined;
  return [
    ...(shatter.kind === 'defense' ? [] : tier.strikes),
    ...(confusion ? [{ ...confusion, type: 'condition' as const, condition: confusion.name }] : []),
    ...tier.effects
  ];
}
