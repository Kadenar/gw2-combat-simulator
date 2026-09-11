import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerCastContext,
  RangerCoreState,
  RangerSchedulerContext,
  RangerSkill
} from '#gw2/professions/ranger/types.js';
import type { ScheduledTask, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import { isRangerHammerVariant } from '#gw2/professions/ranger/core/mechanics/hammer-variants.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { advanceRangerResources } from '#gw2/professions/ranger/core/mechanics/resources.js';

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
    Number(state.availableFlips?.[ID.WOLFS_ONSLAUGHT] || 0) > at ||
    (Number(state.stealthUntil || 0) > at && Number(state.revealedUntil || 0) <= at)
  );
}

/** Stealth attacks consume their choice on activation, including attempts cancelled during the animation. */
export function beginRangerStealthAttack(context: RangerCastContext, skill: RangerSkill): void {
  if (!RANGER_SPEAR_STEALTH_ATTACK_IDS.has(Number(skill.id))) return;
  const state = professionCoreState(context);
  for (const flipId of RANGER_SPEAR_STEALTH_ATTACK_IDS) delete state.availableFlips[flipId];
  state.stealthUntil = context.start;
  state.revealedUntil = context.start + 3;
}

/** Apply stealth and strike-driven Revealed at their event times, including delayed traps and smoke combos. */
export function observeRangerStealthEvent(context: RangerSchedulerContext, event: SimulationEvent): void {
  const stealth = event.type === 'buff' && event.kind === 'stealth' && event.resolvedAudience?.includesSelf;
  const strike = event.type === 'damage' && (event.actorType === 'player' || event.ownerActorType === 'player');
  if ((!stealth && !strike) || event.cancelled === true || event.offTarget === true) return;
  context.tasks.schedule({
    type: 'ranger.stealth-event',
    at: event.at,
    // A hit that grants stealth (Hunter's Shot or a smoke leap) resolves before its own stealth application.
    priority: stealth ? 10 : 0,
    ownerId: event.activationId,
    payload: { eventOrder: event.eventOrder }
  });
}

export const rangerWeaponTaskHandlers = Object.freeze({
  'ranger.stealth-event': (context: RangerSchedulerContext, task: ScheduledTask<SchedulerRecord>): void => {
    const event = context.eventByOrder(Number(task.payload?.eventOrder));
    if (!event || event.cancelled === true || event.offTarget === true) return;
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
    const readyAt = Number(context.state.cooldowns.get(skill.id) || context.effectiveEnd);
    context.state.cooldowns.set(parent, readyAt);
    context.state.cooldowns.set(flipId, readyAt);
  }

  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  if (skill.id === ID.PANTHERS_PROWL) {
    for (const flipId of RANGER_SPEAR_STEALTH_ATTACK_IDS) {
      professionCoreState(context).availableFlips[flipId] = context.effectiveEnd + 3;
    }
  }

  if (skill.id === ID.HILT_BASH) {
    context.state.cooldowns.delete(ID.MAUL);
    context.state.cooldowns.delete(ID.MAUL_ID_46629);
  } else if (skill.id === ID.ENDURING_SWING) {
    advanceRangerResources(context, context.effectiveEnd);
    const state = professionCoreState(context);
    Object.assign(
      state,
      grantEndurance(state, Number(skill.resourceGain ?? 15), context.effectiveEnd, state.maximumEndurance)
    );
  }
}

export function updateRangerWeaponState(context: RangerCastContext, skill: RangerSkill): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;

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
