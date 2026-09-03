import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerCastContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { isRangerHammerVariant } from '#gw2/professions/ranger/core/mechanics/hammer-variants.js';

const WEAPON_FLIP_DURATION_BY_PARENT = Object.freeze({
  [ID.COUNTERATTACK]: 5
});

export const RANGER_SPEAR_STEALTH_FLIP_BY_PARENT: Readonly<Record<number, number>> = Object.freeze({
  [ID.MONGOOSES_FRENZY]: ID.WOLFS_ONSLAUGHT,
  [ID.FALCONS_STOOP]: ID.OWLS_FLIGHT,
  [ID.WARCLAWS_ENGAGE]: ID.PREDATORS_AMBUSH,
  [ID.PANTHERS_PROWL]: ID.SPIDERS_WEB
});

const RANGER_SPEAR_STEALTH_ATTACK_IDS = new Set(Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT));

export function updateRangerWeaponState(context: RangerCastContext, skill: RangerSkill): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;

  const state = professionCoreState(context);
  // Panther's Prowl grants one three-second spear stealth attack choice; all
  // four affected slots flip together and the chosen attack consumes the set.
  if (skill.id === ID.PANTHERS_PROWL) {
    for (const flipId of RANGER_SPEAR_STEALTH_ATTACK_IDS) {
      state.availableFlips[flipId] = context.effectiveEnd + 3;
    }
  } else if (RANGER_SPEAR_STEALTH_ATTACK_IDS.has(Number(skill.id))) {
    for (const flipId of RANGER_SPEAR_STEALTH_ATTACK_IDS) {
      delete state.availableFlips[flipId];
    }
  }

  // Sequence children occupy the opener's tile only for their live window;
  // autoattack links are excluded because their progression is tracked above.
  if (
    skill.type === 'Weapon' &&
    !isRangerHammerVariant(skill.id) &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId
  ) {
    const flip = context.catalog.skillsById.get(Number(skill.flipSkillId));
    if (flip?.flipParentId === skill.id) {
      const duration =
        WEAPON_FLIP_DURATION_BY_PARENT[skill.id as keyof typeof WEAPON_FLIP_DURATION_BY_PARENT] ||
        Number(skill.flipDuration || 5);
      state.availableFlips[flip.id] = context.effectiveEnd + duration;
    }
  }

  if (
    skill.type === 'Weapon' &&
    !isRangerHammerVariant(skill.id) &&
    !RANGER_SPEAR_STEALTH_ATTACK_IDS.has(Number(skill.id)) &&
    skill.flipParentId != null
  ) {
    delete state.availableFlips[skill.id];
  }
}
