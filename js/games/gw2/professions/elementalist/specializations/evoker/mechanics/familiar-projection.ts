import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/** Stable tier identities keep removed Burning durations from shifting later consecutive-use choices. */
export const IGNITE_TIERS = Object.freeze(['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4']);

/** Select duration tuning by stable tier name so deleted profile effects cannot renumber the sequence. */
export function igniteTierEffect(context: unknown, tier: number) {
  return requireEffect(requireBalanceProfileFromContext(context, PROFILE.ignite), 'condition', IGNITE_TIERS[tier]);
}

/** Replace only native Burning durations; removed packets stay absent and other conditions retain their tuning. */
export function projectIgniteEffects(
  effects: readonly SkillEffect[],
  burning: SkillEffect | undefined
): readonly SkillEffect[] {
  return effects.flatMap<SkillEffect>((effect) => {
    if (effect.type !== 'condition') return [effect];
    if (effect.ticks) {
      const ticks = effect.ticks.flatMap((tick) =>
        tick.condition !== 'Burning' ? [tick] : burning ? [{ ...tick, duration: Number(burning.duration) }] : []
      );
      return ticks.length ? [{ ...effect, ticks }] : [];
    }

    return effect.condition !== 'Burning'
      ? [effect]
      : burning
        ? [{ ...effect, duration: Number(burning.duration) }]
        : [];
  });
}

/** Procession replays only the four empowered familiars' direct payloads, without their resource or boon settlement. */
export function elementalProcessionEffects(skillsById: ReadonlyMap<SkillId, Skill>) {
  return [ID.CONFLAGRATION, ID.BUOYANT_DELUGE, ID.LIGHTNING_BLITZ, ID.SEISMIC_IMPACT].map((id) => {
    const familiar = skillsById.get(id);
    if (!familiar) throw new Error(`Missing Elemental Procession familiar: ${id}`);
    return {
      familiar,
      effects: (familiar.effects ?? []).filter((effect) =>
        ['strike', 'condition', 'control', 'blind'].includes(effect.type)
      )
    };
  });
}
