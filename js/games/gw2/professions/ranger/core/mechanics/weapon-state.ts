import { skillFlipReady, consumeSkillFlip, armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import type { RangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { isRangerHammerVariant } from '#gw2/professions/ranger/data/hammer-variants.js';

import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import {
  advanceProfessionEndurance,
  grantProfessionEndurance
} from '#gw2/platform/combat/resources/endurance-policy.js';

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

/** Hunter's Prowess survives Revealed; ordinary stealth enables the same spear choices until broken. */
export function rangerSpearStealthAvailable(state: Partial<RangerCoreState>, at: number): boolean {
  return (
    skillFlipReady(state.availableFlips?.[ID.WOLFS_ONSLAUGHT], at) ||
    (Number(state.stealthUntil || 0) > at && Number(state.revealedUntil || 0) <= at)
  );
}

/** Stealth attacks consume their choice on activation, including attempts cancelled during the animation. */
export function beginRangerStealthAttack(context: RangerCastContext, skill: RangerSkill): void {
  if (!RANGER_SPEAR_STEALTH_ATTACK_IDS.has(Number(skill.id))) return;
  const state = professionCoreState(context);
  for (const flipId of RANGER_SPEAR_STEALTH_ATTACK_IDS) consumeSkillFlip(state.availableFlips, flipId);
  state.stealthUntil = context.start;
  state.revealedUntil = context.start + 3;
}

/** Apply stealth and Revealed at impact, reading replacements before changing weapon state. */
export const rangerStealthReaction = eventReaction<RangerSchedulerContext>({
  id: 'ranger.stealth-event',
  order: 10,
  missingEvent: 'skip',
  select(_context, event) {
    const stealth = event.type === 'buff' && event.kind === 'stealth' && event.resolvedAudience?.includesSelf;
    const strike = event.type === 'damage' && (event.actorType === 'player' || event.ownerActorType === 'player');
    if ((!stealth && !strike) || event.cancelled === true || event.offTarget === true) return null;
    return {
      at: event.at,
      // The granting strike resolves before its own stealth application.
      priority: stealth ? 10 : 0,
      ownerId: event.activationId,
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute(context, event) {
    if (event.cancelled === true || event.offTarget === true) return;
    const state = professionCoreState(context);
    if (event.type === 'buff') {
      if (state.revealedUntil <= event.at) {
        state.stealthUntil = Math.min(
          event.at + 15,
          Math.max(event.at, state.stealthUntil) + Number(event.duration || 0)
        );
      }
    } else if (state.stealthUntil > event.at) {
      state.stealthUntil = event.at;
      state.revealedUntil = event.at + 3;
    }
  }
});

/** Share spear slot recharge on every attempt; grant completion effects only for completed casts. */
export function completeRangerWeaponSkill(context: RangerCastContext, skill: RangerSkill): void {
  // Skills 2–4 share their slot recharge in both directions; Prowl and Spider's Web recharge independently.
  for (const [parentId, flipId] of Object.entries(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT)) {
    const parent = Number(parentId);
    if (parent === ID.PANTHERS_PROWL || (skill.id !== parent && skill.id !== flipId)) continue;
    context.cooldownController.copy(skill.id, parent);
    context.cooldownController.copy(skill.id, flipId);
  }

  if (castWasInterrupted(context)) return;
  if (skill.id === ID.PANTHERS_PROWL) {
    for (const flipId of RANGER_SPEAR_STEALTH_ATTACK_IDS) {
      armSkillFlip(professionCoreState(context).availableFlips, flipId, context.effectiveEnd, context.effectiveEnd + 3);
    }
  }

  if (skill.id === ID.HILT_BASH) {
    context.cooldownController.clear(ID.MAUL_SOULBEAST);
    context.cooldownController.clear(ID.MAUL_BASE);
  } else if (skill.id === ID.ENDURING_SWING) {
    advanceProfessionEndurance(context, context.effectiveEnd);

    grantProfessionEndurance(context, Number(skill.resourceGain ?? 15), context.effectiveEnd);
  }
}

export function updateRangerWeaponState(context: RangerCastContext, skill: RangerSkill): void {
  if (castWasInterrupted(context)) return;

  const state = professionCoreState(context);
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
      armSkillFlip(state.availableFlips, flip.id, context.effectiveEnd, context.effectiveEnd + duration);
    }
  }

  if (
    skill.type === 'Weapon' &&
    !isRangerHammerVariant(skill.id) &&
    !RANGER_SPEAR_STEALTH_ATTACK_IDS.has(Number(skill.id)) &&
    skill.flipParentId != null
  ) {
    consumeSkillFlip(state.availableFlips, skill.id);
  }
}
