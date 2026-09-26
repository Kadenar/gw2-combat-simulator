import { isElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
import { materializeSkillEffectApplications, scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import { applyTempestResolverAura } from '#gw2/professions/elementalist/specializations/tempest/mechanics/aura-effects.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Tempest hooks: the overload mechanic and its scheduler-phase traits.
 *
 * Owns the overload gate (the channeled element must be the current attunement and must have been
 * held long enough), the overload recharge adjustment, the conduit/singularity trait payloads fired
 * around a channel, the attunement lockout an overload leaves behind, and the aura/attunement event
 * reactions the specialization's remaining traits need.
 */
import { denySkillCast } from '#gw2/professions/shared/availability.js';
import { retryCast } from '#gw2/platform/engine/skills/availability.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistBuff, emitElementalistDamage } from '#gw2/professions/elementalist/core/events.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  applyElementalistAura,
  triggerEarthenBlast,
  triggerElectricDischarge,
  triggerFlameExpulsion,
  triggerSunspot
} from '#gw2/professions/elementalist/core/traits/index.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { armElementalistElementalLightningJolt } from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import { tempestState } from '#gw2/professions/elementalist/specializations/tempest/state.js';

// Overloads that count for a full spear etching; Overload Water is not one of them.
const FULL_ETCHING_CHARGE_SKILLS = new Set<number>([ID.OVERLOAD_FIRE, ID.OVERLOAD_AIR, ID.OVERLOAD_EARTH]);

/**
 * Shout after-effects hook: grants Tempestuous Aria's party might when a Tempest shout finishes.
 * This is the shout half of the trait; its damage buff is refreshed by auras in the resolver.
 */
export function applyTempestShoutTraits(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (!hasTrait(context, 'Tempestuous Aria')) return;
  const tempestuousAriaProfile = requireBalanceProfileFromContext(context, PROFILE.tempestuousAria);
  const might = requireEffect(tempestuousAriaProfile, 'boon', 'Shout Might');
  if (might) {
    emitElementalistBuff(context, {
      skill: skill,
      at: cast.effectiveEnd,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: String(might.boon).toLowerCase(),
      stacks: Number(might.stacks),
      duration: Number(might.duration),
      skillName: skill.name,
      audience: { recipients: 'party' as const, maximumRecipients: 5 }
    });
  }
}

// Fire the traits that pay out as an overload begins: the conduit boons, and the core
// attunement-entry proc matching the channeled element.
function onCastStart(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (!skill.overload) return;
  if (hasTrait(context, 'Hardy Conduit')) {
    const hardyConduitProfile = requireBalanceProfileFromContext(context, PROFILE.hardyConduit);
    const protection = requireEffect(hardyConduitProfile, 'boon', 'Protection');
    if (protection) {
      emitElementalistBuff(context, {
        skill: skill,
        at: cast.start,
        source: 'Hardy Conduit',
        sourceId: skill.id,
        actorType: 'player',
        kind: String(protection.boon).toLowerCase(),
        stacks: Number(protection.stacks),
        duration: Number(protection.duration),
        skillName: 'Hardy Conduit'
      });
    }
  }

  if (hasTrait(context, 'Harmonious Conduit')) {
    const harmoniousConduitProfile = requireBalanceProfileFromContext(context, PROFILE.harmoniousConduit);
    const swiftness = requireEffect(harmoniousConduitProfile, 'boon', 'Swiftness');
    const stability = requireEffect(harmoniousConduitProfile, 'boon', 'Stability');
    for (const effect of [swiftness, stability]) {
      if (!effect) continue;
      const boon = {
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: Number(effect.duration)
      };
      emitElementalistBuff(context, {
        skill: skill,
        at: cast.start,
        source: 'Harmonious Conduit',
        sourceId: skill.id,
        actorType: 'player',
        skillName: 'Harmonious Conduit',
        ...boon
      });
    }
  }

  // Beginning an overload replays the core attunement-entry traits, so fire the proc that belongs
  // to the channeled element (Water has no such proc).
  if (skill.attunement === 'Fire') {
    triggerSunspot(context, cast.start, skill.id);
  } else if (skill.attunement === 'Air') {
    triggerElectricDischarge(context, cast.start, skill.id);
  } else if (skill.attunement === 'Earth') {
    triggerEarthenBlast(context, cast.start, skill.id);
  }
}

// Gate overloads on the current attunement and on the singularity: the attunement must already be
// the primary one and must have been held for the dwell time. Non-overload skills pass through.
function availability(context: ElementalistRuntime, skill: Skill): AvailabilityResult {
  if (!skill.overload) return { ready: true };
  const state = professionCoreState(context);
  if (skill.attunement !== state.primaryAttunement) {
    return denySkillCast(skill, 'elementalist.tempest-attunement', `requires ${String(skill.attunement)} attunement.`);
  }

  const overloadsProfile = requireBalanceProfileFromContext(context, PROFILE.overloads);
  // Transcendent Tempest shortens the dwell, and alacrity speeds the singularity's formation.
  const dwell =
    (hasTrait(context, 'Transcendent Tempest')
      ? balanceProfileNumber(overloadsProfile, 'durationMultiplier')
      : balanceProfileNumber(overloadsProfile, 'initialDelay')) / 1.25;
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

// Derive Lucid Singularity boon pulses from the overload's actual emitted hits,
// preserving interruption behavior and the distinct final-pulse duration.
function afterCast(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (!skill.overload || !hasTrait(context, 'Lucid Singularity')) return;
  const lucidSingularityProfile = requireBalanceProfileFromContext(context, PROFILE.lucidSingularity);
  const hits = (skill.effects ?? [])
    .flatMap((effect) =>
      materializeSkillEffectApplications({
        skill,
        effect: scaleCastBoundTiming(cast, skill, effect),
        start: cast.start,
        fullEnd: cast.fullEnd,
        baseEvent: {
          source: 'elementalist',
          sourceId: skill.id,
          actorType: 'player',
          skillId: skill.id,
          skillName: skill.name,
          activationId: cast.id
        }
      })
    )
    .map((application) => application.event)
    .filter(
      (event) =>
        event.type === 'damage' &&
        Number(event.coefficient) > 0 &&
        (cast.effectiveEnd >= cast.fullEnd || event.at <= cast.effectiveEnd)
    )
    .sort((a, b) => a.at - b.at)
    .slice(0, balanceProfileNumber(lucidSingularityProfile, 'maximumStacks'));
  hits.forEach((event, index: number) => {
    const effectName = index === hits.length - 1 ? 'Final Alacrity' : 'Pulse Alacrity';
    const lucidSingularityProfile = requireBalanceProfileFromContext(context, PROFILE.lucidSingularity);
    const alacrity = requireEffect(lucidSingularityProfile, 'boon', effectName);
    if (!alacrity) return;
    emitElementalistBuff(context, {
      skill: skill,
      at: event.at,
      source: 'Lucid Singularity',
      sourceId: skill.id,
      actorType: 'player',
      kind: String(alacrity.boon).toLowerCase(),
      stacks: Number(alacrity.stacks),
      duration: Number(alacrity.duration),
      skillName: 'Lucid Singularity'
    });
  });
}

// Resolve everything that happens when a Tempest cast finishes: the Gale Song heal payload, then
// for overloads the attunement lockout and each completion trait.
function onCastComplete(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (skill.type === 'Heal' && hasTrait(context, 'Gale Song')) {
    const galeSongProfile = requireBalanceProfileFromContext(context, PROFILE.galeSong);
    const protection = requireEffect(galeSongProfile, 'boon', 'Protection');
    if (protection) {
      emitElementalistBuff(context, {
        skill: skill,
        at: cast.effectiveEnd,
        source: 'Gale Song',
        sourceId: skill.id,
        actorType: 'player',
        kind: String(protection.boon).toLowerCase(),
        stacks: Number(protection.stacks),
        duration: Number(protection.duration),
        skillName: 'Gale Song'
      });
    }
  }

  if (!skill.overload) return;
  const state = professionCoreState(context);
  const attunement = String(skill.attunement);
  // Copy the overload's base progress to align both recharges while retaining longer lockouts.
  if (isElementalistAttunement(attunement)) {
    const readyAt = context.cooldowns.get(skill.id) ?? cast.effectiveEnd;
    if (readyAt > Number(context.cooldowns.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement]) ?? 0)) {
      context.cooldownController.copy(skill.id, ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement]);
    }
  }

  if (hasTrait(context, 'Unstable Conduit')) {
    const aura =
      attunement === 'Fire'
        ? 'Fire Aura'
        : attunement === 'Water'
          ? 'Frost Aura'
          : attunement === 'Air'
            ? 'Shocking Aura'
            : 'Magnetic Aura';
    const unstableConduitProfile = requireBalanceProfileFromContext(context, PROFILE.unstableConduit);
    const unstableConduitAttunement = requireEffect(unstableConduitProfile, 'buff', attunement);
    if (unstableConduitAttunement) {
      applyElementalistAura(context, {
        at: cast.effectiveEnd,
        aura,
        duration: Number(unstableConduitAttunement.duration),
        skillName: 'Unstable Conduit',
        sourceId: skill.id,
        // The completion aura precedes the same-time Overload packet.
        priority: -20
      });
    }
  }

  if (attunement === 'Fire') {
    triggerFlameExpulsion(context, cast.effectiveEnd, skill.id);
  }

  if (hasTrait(context, 'Transcendent Tempest')) {
    const transcendentTempestProfile = requireBalanceProfileFromContext(context, PROFILE.transcendentTempest);
    emitElementalistBuff(context, {
      at: cast.effectiveEnd,
      // The completion buff applies to the final Overload packet and to
      // same-time follow-ups such as Lightning Jolt.
      priority: -10,
      source: 'Transcendent Tempest',
      sourceId: skill.id,
      actorType: 'player',
      skillName: 'Transcendent Tempest',
      kind: 'transcendent-tempest',
      stacks: 1,
      duration: balanceProfileNumber(transcendentTempestProfile, 'durationMultiplier')
    });
  }

  // Overload Air's completion strike: a non-critical unequipped-weapon hit, mirrored onto an
  // active fire/earth elemental and recorded as its own proc for attribution.
  if (skill.id === ID.OVERLOAD_AIR) {
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
      emitElementalistDamage(context, {
        at: cast.effectiveEnd,
        source: 'Lightning Jolt',
        sourceId: ID.LIGHTNING_JOLT,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: ID.LIGHTNING_JOLT,
        skillName: 'Lightning Jolt',
        coefficient,
        skillWeapon: 'Unequipped',
        noCrit: true
      });
      armElementalistElementalLightningJolt(context, cast, ID.LIGHTNING_JOLT, coefficient);
      emitElementalistProc(context, {
        at: cast.effectiveEnd,
        name: 'Lightning Jolt',
        procType: 'skill',
        sourceId: ID.LIGHTNING_JOLT,
        sourceSkill: skill.name
      });
    }
  }

  // Fire, Air, and Earth overloads supply all three casts needed to complete an active spear etching.
  if (FULL_ETCHING_CHARGE_SKILLS.has(Number(skill.id))) {
    for (const [name, progress] of Object.entries(state.etchings)) {
      if (!progress || progress.stage !== 'lesser') continue;
      const otherCasts = progress.otherCasts + 2;
      state.etchings[name] = { ...progress, stage: otherCasts >= 3 ? 'full' : 'lesser', otherCasts };
    }
  }
}

// Elemental Enchantment shortens overload recharges only.
function modifyRechargeDuration(context: ElementalistRuntime, skill: Skill, duration: number): number {
  return skill.overload && hasTrait(context, 'Elemental Enchantment')
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, CORE_PROFILE.elementalEnchantment),
          'rechargeMultiplier'
        )
    : duration;
}

// Attribute every overload-sourced event to the profession mechanic rather than a held weapon.
function prepareEvent(_context: ElementalistRuntime, event: SimulationEventBase): SimulationEventBase {
  return Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS).includes(Number(event.skillId ?? event.sourceId))
    ? { ...event, skillWeapon: 'Profession mechanic' }
    : event;
}

// React to normalized attunement and aura events so Tempest traits share the
// same timestamps as core state changes and resolver-generated auras.
function onAttunementEvent(context: ElementalistRuntime, event: SimulationEvent): void {
  // Fresh Air re-attunes to Air off cooldown; clear Overload Air's recorded recharge with it.
  if (event.type === 'elementalist.fresh-air') {
    context.cooldownController.clear(ELEMENTALIST_OVERLOAD_SKILL_IDS.Air);
    return;
  }

  // Latent Stamina: vigor on attuning to water, throttled by its own internal cooldown stamp.
  if (event.type === 'elementalist.attunement' && event.to === 'Water' && hasTrait(context, 'Latent Stamina')) {
    const state = tempestState.from(context);
    if (isInternalCooldownReady(event.at, state.latentStaminaReadyAt)) {
      const latentStaminaProfile = requireBalanceProfileFromContext(context, PROFILE.latentStamina);
      state.latentStaminaReadyAt = event.at + balanceProfileNumber(latentStaminaProfile, 'internalCooldown');
      const vigor = requireEffect(latentStaminaProfile, 'boon', 'Vigor');
      const sourceId = event.skillId ?? event.sourceId;
      if (vigor) {
        emitElementalistBuff(context, {
          skill: elementalistEventSkill(context, 'Latent Stamina', sourceId),
          at: event.at,
          source: 'Latent Stamina',
          sourceId,
          actorType: 'player',
          kind: String(vigor.boon).toLowerCase(),
          stacks: Number(vigor.stacks),
          duration: Number(vigor.duration),
          skillName: 'Latent Stamina'
        });
      }
    }

    return;
  }
}

/** Tempest owns overload channels and reacts only to actual attunement and aura events. */
export const tempestHooks: Partial<RuntimeProfession<ElementalistRuntimeState>> = {
  initialize(runtime) {
    registerElementalistEliteEvents(runtime, onAttunementEvent);
  },
  availability,
  rechargeWork: modifyRechargeDuration,
  prepareEvent,
  onCastStart(runtime, cast) {
    withElementalistCast(runtime, cast, () => {
      onCastStart(runtime, cast, cast.skill);
      afterCast(runtime, cast, cast.skill);
    });
  },
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    if (cast.skill.overload && cast.effectiveEnd < cast.fullEnd) return;
    withElementalistCast(runtime, cast, () => {
      onCastComplete(runtime, cast, cast.skill);
      if (cast.skill.skillFamily === 'Shout') applyTempestShoutTraits(runtime, cast, cast.skill);
    });
  },

  reactions: { 'aura.applied': applyTempestResolverAura }
};
