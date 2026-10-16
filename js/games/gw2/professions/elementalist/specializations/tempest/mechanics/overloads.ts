import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/events/events.js';
import { type AvailabilityResult, denySkillCast, retryCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  attunementInvoked,
  attunementReleased
} from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import { isElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS
} from '#gw2/professions/elementalist/data/ids.js';
import { tempestOverloadDwell } from '#gw2/professions/elementalist/specializations/tempest/mechanics/overload-dwell.js';
import { tempestTransitionObserved } from '#gw2/professions/elementalist/specializations/tempest/mechanics/trigger-points.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

// Every attunement's overload is attributed to the profession mechanic rather than the held weapon.
const OVERLOAD_SKILL_IDS = new Set<number>(Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS));

// Gate overloads on the current attunement and on the singularity: the attunement must already be
// the primary one and must have been held for the dwell time. Non-overload skills pass through.
export function tempestOverloadAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult {
  if (!skill.overload) return { ready: true };

  const state = professionCoreState(context);

  if (skill.attunement !== state.primaryAttunement) {
    return denySkillCast(skill, 'elementalist.tempest-attunement', `requires ${String(skill.attunement)} attunement.`);
  }

  // Transcendent Tempest shortens the dwell, and alacrity speeds the singularity's formation.
  const dwell = tempestOverloadDwell(context);
  // The configured starting attunement carries a negative entry stamp and needs no dwell.
  const startingAttunementReady = state.attunementEnteredAt < 0;
  // Dwell readiness shares the queued canonical instant without allowing an early overload.
  const readyAt = startingAttunementReady ? context.time : canonicalTime(state.attunementEnteredAt + dwell);
  return readyAt > context.time
    ? retryCast(
        readyAt,
        'elementalist.tempest-dwell',
        `${skill.name} is unavailable until the attunement singularity forms.`
      )
    : { ready: true };
}

// Fire the traits that pay out as an overload begins: the conduit boons, and the core
// attunement-entry proc matching the channeled element.
export function startTempestOverload(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (!skill.overload) return;

  // Beginning an overload replays the core attunement-entry traits, so fire the proc that belongs
  // to the channeled element (Water has no such proc).
  if (isElementalistAttunement(skill.attunement))
    context.fireTrigger(attunementInvoked, {
      at: cast.start,
      skill,
      target: skill.attunement,
      claimTrait: () => true,
      emissionCast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    });
}

/** Fire overloads release their attunement between the shared completing and completed trait boundaries. */
export function completeTempestOverload(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (!skill.overload) return;

  const attunement = String(skill.attunement);

  if (attunement === 'Fire') {
    context.fireTrigger(attunementReleased, {
      at: cast.effectiveEnd,
      sourceId: skill.id,
      emissionCast: {
        activationId: cast.id,
        skillId: cast.skill.id,
        offTarget: cast.command.offTarget
      }
    });
  }
}

// Attribute every overload-sourced event to the profession mechanic rather than a held weapon.
export function prepareTempestOverloadEvent(
  _context: ElementalistRuntime,
  event: SimulationEventBase
): SimulationEventBase {
  return OVERLOAD_SKILL_IDS.has(Number(event.skillId ?? event.sourceId))
    ? { ...event, skillWeapon: 'Profession mechanic' }
    : event;
}

// React to normalized attunement and aura events so Tempest traits share the
// same timestamps as core state changes and resolver-generated auras.
export function observeTempestAttunement(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  // Fresh Air re-attunes to Air off cooldown; clear Overload Air's recorded recharge with it.
  if (event.type === 'elementalist.fresh-air') {
    context.cooldownController.clear(ELEMENTALIST_OVERLOAD_SKILL_IDS.Air);
    return;
  }

  // Attuning to Water claims Latent Stamina's interval even when its optional vigor packet is removed.
  context.fireTrigger(tempestTransitionObserved, { event, emissionCast });
}

/** Overload completion owns attunement lockouts and the additional etching credits. */
export const tempestOverloadActions = {
  'elementalist.tempest.overload-lockout'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Overload lockout requires a cast trigger.');

    const { cast, skill } = trigger;
    const attunement = String(skill.attunement);

    // Copy the overload's base progress to align both recharges while retaining longer lockouts.
    if (isElementalistAttunement(attunement)) {
      const readyAt = context.cooldownController.readyAt(skill.id) ?? cast.effectiveEnd;

      if (readyAt > (context.cooldownController.readyAt(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement]) ?? 0)) {
        context.cooldownController.copy(skill.id, ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement]);
      }
    }
  },
  'elementalist.tempest.etching-credits'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Etching credit requires a cast trigger.');

    // Let Core grant its one ordinary credit first, then settle before another same-time cast commits.
    context.scheduleForCast('elementalist.tempest.etching-credits', context.time, trigger.cast, {}, undefined, -101);
  }
} satisfies NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['sideEffectHandlers']>;

/** Extra overload credits follow Core credit settlement before another cast can observe the etching. */
export const tempestOverloadTasks = {
  'elementalist.tempest.etching-credits'(context) {
    const state = professionCoreState(context);
    for (const [name, progress] of Object.entries(state.etchings)) {
      if (!progress || progress.stage !== 'lesser') continue;

      const otherCasts = progress.otherCasts + 2;
      state.etchings[name] = { ...progress, stage: otherCasts >= 3 ? 'full' : 'lesser', otherCasts };
    }
  }
} satisfies NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['tasks']>;
