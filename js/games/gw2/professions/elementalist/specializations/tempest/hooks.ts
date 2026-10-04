import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { isElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { tempestOverloadDwell } from '#gw2/professions/elementalist/specializations/tempest/mechanics/overload-dwell.js';
import {
  applyGaleSong,
  applyLatentStamina,
  applyTempestResolverAura,
  applyTempestShoutTraits
} from '#gw2/professions/elementalist/specializations/tempest/traits/auras.js';
import {
  applyLucidSingularity,
  applyUnstableConduit
} from '#gw2/professions/elementalist/specializations/tempest/traits/conduits.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
/**
 * Tempest hooks: the overload mechanic and its scheduler-phase traits.
 *
 * Owns the overload gate (the channeled element must be the current attunement and must have been
 * held long enough), the overload recharge adjustment, the conduit/singularity trait payloads fired
 * around a channel, the attunement lockout an overload leaves behind, and the aura/attunement event
 * reactions the specialization's remaining traits need.
 */
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/events/events.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { denySkillCast, retryCast } from '#gw2/platform/execution/availability.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { elementalistAnnouncement } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { armElementalistElementalLightningJolt } from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import {
  triggerEarthenBlast,
  triggerElectricDischarge,
  triggerFlameExpulsion
} from '#gw2/professions/elementalist/core/traits/attunements.js';
import { triggerSunspot } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { EPSILON } from '#kernel/core/clock.js';
// Every attunement's overload is attributed to the profession mechanic rather than the held weapon.
const OVERLOAD_SKILL_IDS = new Set<number>(Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS));
// Fire the traits that pay out as an overload begins: the conduit boons, and the core
// attunement-entry proc matching the channeled element.
function onCastStart(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  if (!skill.overload) return;
  // Beginning an overload replays the core attunement-entry traits, so fire the proc that belongs
  // to the channeled element (Water has no such proc).
  if (skill.attunement === 'Fire') {
    triggerSunspot(context, cast.start, skill.id, {
      activationId: cast.id,
      skillId: cast.skill.id,
      offTarget: cast.command.offTarget
    });
  } else if (skill.attunement === 'Air') {
    triggerElectricDischarge(context, cast.start, skill.id, {
      activationId: cast.id,
      skillId: cast.skill.id,
      offTarget: cast.command.offTarget
    });
  } else if (skill.attunement === 'Earth') {
    triggerEarthenBlast(context, cast.start, skill.id, {
      activationId: cast.id,
      skillId: cast.skill.id,
      offTarget: cast.command.offTarget
    });
  }
}

// Gate overloads on the current attunement and on the singularity: the attunement must already be
// the primary one and must have been held for the dwell time. Non-overload skills pass through.
function availability(context: MechanicQueriesOf<ElementalistRuntime>, skill: Skill): AvailabilityResult {
  if (!skill.overload) return { ready: true };
  const state = professionCoreState(context);
  if (skill.attunement !== state.primaryAttunement) {
    return denySkillCast(skill, 'elementalist.tempest-attunement', `requires ${String(skill.attunement)} attunement.`);
  }

  // Transcendent Tempest shortens the dwell, and alacrity speeds the singularity's formation.
  const dwell = tempestOverloadDwell(context);
  // The configured starting attunement carries a negative entry stamp and needs no dwell.
  const startingAttunementReady = state.attunementEnteredAt < 0;
  const readyAt = startingAttunementReady ? context.time : state.attunementEnteredAt + dwell;
  return readyAt > context.time + EPSILON
    ? retryCast(
        readyAt,
        'elementalist.tempest-dwell',
        `${skill.name} is unavailable until the attunement singularity forms.`
      )
    : { ready: true };
}

// Resolve everything that happens when a Tempest cast finishes: the Gale Song heal payload, then
// for overloads the attunement lockout and each completion trait.
function onCastCommit(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  // Committed shortened heals retain the same reward before overload-specific completion work.
  applyGaleSong(context, cast, skill);
  if (!skill.overload) return;
  const attunement = String(skill.attunement);
  applyUnstableConduit(context, cast, skill);
  if (attunement === 'Fire') {
    triggerFlameExpulsion(context, cast.effectiveEnd, skill.id, {
      activationId: cast.id,
      skillId: cast.skill.id,
      offTarget: cast.command.offTarget
    });
  }
}

// Attribute every overload-sourced event to the profession mechanic rather than a held weapon.
function prepareEvent(_context: ElementalistRuntime, event: SimulationEventBase): SimulationEventBase {
  return OVERLOAD_SKILL_IDS.has(Number(event.skillId ?? event.sourceId))
    ? { ...event, skillWeapon: 'Profession mechanic' }
    : event;
}

// React to normalized attunement and aura events so Tempest traits share the
// same timestamps as core state changes and resolver-generated auras.
function onAttunementEvent(
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
  applyLatentStamina(context, event, emissionCast);
}

/** Tempest owns overload channels and reacts only to actual attunement and aura events. */
export const tempestHooks: RuntimeHooks<ElementalistRuntimeState, ElementalistSkill> = {
  sideEffectHandlers: {
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
    'elementalist.tempest.lightning-jolt'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Lightning Jolt requires a cast trigger.');
      const { cast, skill } = trigger;
      {
        const lightningJoltProfile = requireBalanceProfileFromContext(context, PROFILE.lightningJolt);
        const lightningJoltOverloadAirLightningJoltStrike = requireEffect(
          lightningJoltProfile,
          'strike',
          'Overload Air - Lightning Jolt'
        );
        if (lightningJoltOverloadAirLightningJoltStrike) {
          const coefficient = effectNumber(
            lightningJoltProfile,
            lightningJoltOverloadAirLightningJoltStrike,
            'coefficient'
          );
          context.effects.emit(
            elementalistStrikeRequest(
              context,
              {
                at: cast.effectiveEnd,
                source: 'Lightning Jolt',
                sourceId: ID.LIGHTNING_JOLT,
                actorType: 'effect',
                ownerActorType: 'player',
                skillId: ID.LIGHTNING_JOLT,
                skillName: 'Lightning Jolt',
                coefficient,
                skillWeapon: 'Unequipped',
                canCrit: false
              },
              { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
            )
          );
          armElementalistElementalLightningJolt(context, cast, ID.LIGHTNING_JOLT, coefficient);
          context.effects.emit(
            elementalistAnnouncement({
              at: cast.effectiveEnd,
              name: 'Lightning Jolt',
              procType: 'skill',
              sourceId: ID.LIGHTNING_JOLT,
              sourceSkill: skill.name
            })
          );
        }
      }
    },
    'elementalist.tempest.etching-credits'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Etching credit requires a cast trigger.');
      // Let Core grant its one ordinary credit first, then settle before another same-time cast commits.
      context.scheduleForCast('elementalist.tempest.etching-credits', context.time, trigger.cast, {}, undefined, -101);
    }
  },
  tasks: {
    'elementalist.tempest.etching-credits'(context) {
      const state = professionCoreState(context);
      for (const [name, progress] of Object.entries(state.etchings)) {
        if (!progress || progress.stage !== 'lesser') continue;
        const otherCasts = progress.otherCasts + 2;
        state.etchings[name] = { ...progress, stage: otherCasts >= 3 ? 'full' : 'lesser', otherCasts };
      }
    }
  },
  // Overload-start boons retain the triggering overload as source, including on interrupted channels.
  initialize(runtime) {
    registerElementalistEliteEvents(runtime, onAttunementEvent);
  },
  availability,
  prepareEvent,
  onCastStart(runtime, cast) {
    {
      onCastStart(runtime, cast, cast.skill);
      applyLucidSingularity(runtime, cast, cast.skill);
    }
  },
  onCastCommit(runtime, cast) {
    if (cast.skill.overload && cast.effectiveEnd < cast.fullEnd) return;
    {
      onCastCommit(runtime, cast, cast.skill);
      if (cast.skill.skillFamily === 'Shout') applyTempestShoutTraits(runtime, cast, cast.skill);
    }
  },
  reactions: { 'aura.applied': applyTempestResolverAura }
};
