/**
 * Tempest overload mechanic and its scheduler-phase traits.
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
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type {
  ElementalistCastContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';
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
import { tempestModifierRules } from '#gw2/professions/elementalist/specializations/tempest/traits/modifiers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import { tempestState } from '#gw2/professions/elementalist/specializations/tempest/state.js';
import { tempestAuraBoons } from '#gw2/professions/elementalist/specializations/tempest/mechanics/aura-boons.js';

// Overloads that count for a full spear etching; Overload Water is not one of them.
const FULL_ETCHING_CHARGE_SKILLS = new Set<number>([ID.OVERLOAD_FIRE, ID.OVERLOAD_AIR, ID.OVERLOAD_EARTH]);

/**
 * Shout after-effects hook: grants Tempestuous Aria's party might when a Tempest shout finishes.
 * This is the shout half of the trait; its damage buff is refreshed by auras in the resolver.
 */
export function applyTempestShoutTraits(context: ElementalistCastContext, skill: Skill): void {
  if (!hasTrait(context, 'Tempestuous Aria')) return;
  const tempestuousAriaProfile = requireBalanceProfileFromContext(context, PROFILE.tempestuousAria);
  const might = requireEffect(tempestuousAriaProfile, 'boon', 'Shout Might');
  if (might) {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
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
function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  if (!skill.overload) return;
  if (hasTrait(context, 'Hardy Conduit')) {
    const hardyConduitProfile = requireBalanceProfileFromContext(context, PROFILE.hardyConduit);
    const protection = requireEffect(hardyConduitProfile, 'boon', 'Protection');
    if (protection) {
      emitSkillBuff(context, skill, {
        at: context.start,
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
      emitSkillBuff(context, skill, {
        at: context.start,
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
    triggerSunspot(context as never, context.start, skill.id);
  } else if (skill.attunement === 'Air') {
    triggerElectricDischarge(context as never, context.start, skill.id);
  } else if (skill.attunement === 'Earth') {
    triggerEarthenBlast(context as never, context.start, skill.id);
  }
}

// Gate overloads on the current attunement and on the singularity: the attunement must already be
// the primary one and must have been held for the dwell time. Non-overload skills pass through.
function availability(context: ElementalistPrecastContext, skill: Skill): AvailabilityResult {
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
      : balanceProfileNumber(overloadsProfile, 'initialDelay')) / (context.config.boons?.alacrity ? 1.25 : 1);
  // The configured starting attunement carries a negative entry stamp and needs no dwell.
  const startingAttunementReady = state.attunementEnteredAt < 0;
  const readyAt = startingAttunementReady ? context.start : state.attunementEnteredAt + dwell;
  return readyAt > context.start + EPSILON
    ? retryCast(
        readyAt,
        'elementalist.tempest-dwell',
        `${skill.name} is unavailable until the attunement singularity forms.`
      )
    : { ready: true };
}

// Derive Lucid Singularity boon pulses from the overload's actual emitted hits,
// preserving interruption behavior and the distinct final-pulse duration.
function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (!skill.overload || !hasTrait(context, 'Lucid Singularity')) return;
  const lucidSingularityProfile = requireBalanceProfileFromContext(context, PROFILE.lucidSingularity);
  const hits = context.events
    .filter(
      (event: SimulationEvent) =>
        event.activationId === context.reservationId && event.type === 'damage' && Number(event.coefficient || 0) > 0
    )
    .sort((left: SimulationEvent, right: SimulationEvent) => left.at - right.at)
    .slice(0, balanceProfileNumber(lucidSingularityProfile, 'maximumStacks'));
  hits.forEach((event: SimulationEvent, index: number) => {
    const effectName = index === hits.length - 1 ? 'Final Alacrity' : 'Pulse Alacrity';
    const lucidSingularityProfile = requireBalanceProfileFromContext(context, PROFILE.lucidSingularity);
    const alacrity = requireEffect(lucidSingularityProfile, 'boon', effectName);
    if (!alacrity) return;
    emitSkillBuff(context, skill, {
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
function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  if (skill.type === 'Heal' && hasTrait(context, 'Gale Song')) {
    const galeSongProfile = requireBalanceProfileFromContext(context, PROFILE.galeSong);
    const protection = requireEffect(galeSongProfile, 'boon', 'Protection');
    if (protection) {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
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
  // Copy the overload's base progress so later Alacrity changes keep both recharges aligned; retain longer lockouts.
  if (attunement in state.attunementReadyAt) {
    const typedAttunement = attunement as keyof typeof state.attunementReadyAt;
    const readyAt = context.state.cooldowns.get(skill.id) ?? context.effectiveEnd;
    if (readyAt > state.attunementReadyAt[typedAttunement]) {
      context.cooldownController.copy(skill.id, ELEMENTALIST_ATTUNEMENT_SKILL_IDS[typedAttunement]);
      state.attunementReadyAt[typedAttunement] = readyAt;
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
      applyElementalistAura(context as never, {
        at: context.effectiveEnd,
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
    triggerFlameExpulsion(context as never, context.effectiveEnd, skill.id);
  }

  if (hasTrait(context, 'Transcendent Tempest')) {
    const transcendentTempestProfile = requireBalanceProfileFromContext(context, PROFILE.transcendentTempest);
    emitSkillBuff(context, {
      at: context.effectiveEnd,
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
      emitSkillDamage(context, {
        at: context.effectiveEnd,
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
      armElementalistElementalLightningJolt(context, ID.LIGHTNING_JOLT, coefficient);
      emitElementalistProc(context as never, {
        at: context.effectiveEnd,
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
function modifyRechargeDuration(context: ElementalistPrecastContext, duration: number): number {
  return context.skill.overload && hasTrait(context, 'Elemental Enchantment')
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, CORE_PROFILE.elementalEnchantment),
          'rechargeMultiplier'
        )
    : duration;
}

// Attribute every overload-sourced event to the profession mechanic rather than a held weapon.
function prepareEvent(_context: ElementalistSchedulerContext, event: SimulationEventBase): SimulationEventBase {
  return Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS).includes(Number(event.skillId ?? event.sourceId))
    ? { ...event, skillWeapon: 'Profession mechanic' }
    : event;
}

// React to normalized attunement and aura events so Tempest traits share the
// same timestamps as core state changes and resolver-generated auras.
function onEventScheduled(context: ElementalistCastContext, event: SimulationEvent): void {
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
        emitSkillBuff(context, elementalistEventSkill(context, 'Latent Stamina', sourceId), {
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

  // Remaining traits react to scheduler-emitted aura events, attributed to the granting skill.
  if (event.type !== 'elementalist.aura') return;
  const source = String(event.skillName || event.source || 'Aura');
  const sourceId = event.skillId ?? event.sourceId;
  for (const trait of ['Invigorating Torrents', 'Elemental Bastion'] as const) {
    if (!hasTrait(context, trait)) continue;
    for (const boon of tempestAuraBoons(context, trait)) {
      emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
        at: event.at,
        source,
        sourceId,
        actorType: 'player',
        ...boon,
        skillName: source
      });
    }
  }
}

/** Cast-time rules the module installs: the overload gate and the overload recharge adjustment. */
export const tempestCastRules = Object.freeze({
  availability: {
    id: 'elementalist.tempest-overload',
    order: 30,
    handler: availability
  },
  modifyRechargeDuration
});

/** Damage-modifier contribution of the specialization, forwarded from traits/modifiers.ts. */
export const tempestAttributeRules = Object.freeze({
  modifierRules: tempestModifierRules
});

/** Ordered scheduler lifecycle hooks that drive the overload channel and Tempest's traits. */
export const tempestSchedulerHooks = Object.freeze({
  prepareEvent: {
    id: 'elementalist.tempest-overload-events',
    order: 30,
    handler: prepareEvent
  },
  onCastStart: {
    id: 'elementalist.tempest-start',
    order: 30,
    handler: onCastStart
  },
  afterCast: {
    id: 'elementalist.tempest-after-cast',
    order: 30,
    handler: afterCast
  },
  onCastComplete: {
    id: 'elementalist.tempest-complete',
    order: 30,
    handler: onCastComplete
  },
  onEventScheduled: {
    id: 'elementalist.tempest-traits',
    order: 30,
    handler: onEventScheduled
  }
});
