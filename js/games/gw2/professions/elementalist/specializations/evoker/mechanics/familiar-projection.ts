import { CONDITION } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SkillSource } from '#gw2/platform/skills/balance-profiles.js';
import { requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { ELEMENTALIST_EVOKER_SKILL_FLIPS } from '#gw2/professions/elementalist/specializations/evoker/skills/skill-flips.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Stable tier identities keep removed Burning durations from shifting later consecutive-use choices. */
export const IGNITE_TIERS = Object.freeze(['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4']);

/** Select duration tuning by stable tier name so removed templates cannot renumber the sequence. */
export function igniteTierEffect(source: SkillSource, tier: number) {
  const skill = requireSkill(source, ID.IGNITE);
  return requireEffect(skill, 'condition', IGNITE_TIERS[tier], requireSkillAction(skill, 'burning-tiers'));
}

/** Replace only native Burning durations; removed packets stay absent and other conditions retain their tuning. */
export function projectIgniteEffects(
  effects: readonly SkillEffect[],
  burning: SkillEffect | undefined
): readonly SkillEffect[] {
  // Only a condition replacement supplies a Burning duration; anything else removes the native Burning packets.
  const burningDuration = burning?.type === 'condition' ? Number(burning.duration) : undefined;
  return effects.flatMap<SkillEffect>((effect) => {
    if (effect.type !== 'condition') return [effect];

    if (effect.ticks) {
      const ticks = effect.ticks.flatMap((tick) =>
        tick.condition !== CONDITION.BURNING
          ? [tick]
          : burningDuration != null
            ? [{ ...tick, duration: burningDuration }]
            : []
      );
      return ticks.length ? [{ ...effect, ticks }] : [];
    }

    return effect.condition !== CONDITION.BURNING
      ? [effect]
      : burningDuration != null
        ? [{ ...effect, duration: burningDuration }]
        : [];
  });
}

/**
 * The declared flip pairs name each familiar; the basic skill's attunement picks the element. Both forms come from
 * the selected catalog so the editor and Procession use the same patched skills.
 */
export function evokerFamiliarPair(
  skillsById: ReadonlyMap<SkillId, ElementalistSkill>,
  element: ElementalistAttunement
): { readonly basic: ElementalistSkill; readonly empowered: ElementalistSkill } {
  const flip = ELEMENTALIST_EVOKER_SKILL_FLIPS.find(({ parentId }) => skillsById.get(parentId)?.attunement === element);
  const basic = flip && skillsById.get(flip.parentId);
  const empowered = flip && skillsById.get(flip.followUpId);

  if (!basic || !empowered) throw new Error(`Evoker requires a ${element} familiar and its empowered flip.`);

  return { basic, empowered };
}

/** Procession replays only the four empowered familiars' direct payloads, without their resource or boon settlement. */
export function elementalProcessionEffects(skillsById: ReadonlyMap<SkillId, Skill>) {
  return ELEMENTALIST_ATTUNEMENTS.map((element) => {
    const { empowered: familiar } = evokerFamiliarPair(skillsById, element);

    return {
      familiar,
      effects: (familiar.effects ?? []).filter((effect) => ['strike', 'condition', 'control'].includes(effect.type))
    };
  });
}
