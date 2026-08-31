/**
 * Tempest overload mechanic and its scheduler-phase traits.
 *
 * Owns the overload gate (the channeled element must be the current attunement and must have been
 * held long enough), the overload recharge adjustment, the conduit/singularity trait payloads fired
 * around a channel, the attunement lockout an overload leaves behind, and the aura/attunement event
 * reactions the specialization's remaining traits need.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import type {
  AvailabilityResult,
  SchedulerRecord,
  SimulationEvent,
  SimulationEventInput,
  Skill
} from '#gw2/platform/engine/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type {
  ElementalistCastContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext
} from '#gw2/content/professions/elementalist/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitElementalistProc } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import {
  applyElementalistAura,
  triggerEarthenBlast,
  triggerElectricDischarge,
  triggerFlameExpulsion,
  triggerSunspot
} from '#gw2/content/professions/elementalist/core/traits/index.js';
import { elementalistEventSkill } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { setElementalistAttunementReadyAt } from '#gw2/content/professions/elementalist/core/state.js';
import { armElementalistElementalLightningJolt } from '#gw2/content/professions/elementalist/core/skills/elementals.js';
import {
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/content/professions/elementalist/data/ids.js';
import { tempestModifierRules } from '#gw2/content/professions/elementalist/specializations/tempest/traits/modifiers.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE,
  elementalistBalanceEffect,
  elementalistEffectValue
} from '#gw2/content/professions/elementalist/core/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/specializations/tempest/profiles.js';
import { tempestState } from '#gw2/content/professions/elementalist/specializations/tempest/state.js';

// Overloads that count for a full spear etching; Overload Water is not one of them.
const FULL_ETCHING_CHARGE_SKILLS = new Set<number>([ID.OVERLOAD_FIRE, ID.OVERLOAD_AIR, ID.OVERLOAD_EARTH]);

/**
 * Shout after-effects hook: grants Tempestuous Aria's party might when a Tempest shout finishes.
 * This is the shout half of the trait; its damage buff is refreshed by auras in the resolver.
 */
export function applyTempestShoutTraits(context: ElementalistCastContext, skill: Skill): void {
  if (!hasTrait(context, 'Tempestuous Aria')) return;
  const might = elementalistBalanceEffect(context, PROFILE.tempestuousAria, 'boon', 'Shout Might');
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    kind: String(might?.boon || 'Might').toLowerCase(),
    stacks: Number(might?.stacks ?? 2),
    duration: Number(might?.duration ?? 10),
    skillName: skill.name,
    recipients: 'party',
    maximumRecipients: 5
  });
}

// Fire the traits that pay out as an overload begins: the conduit boons, and the core
// attunement-entry proc matching the channeled element.
function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  if (!skill.overload) return;
  if (hasTrait(context, 'Hardy Conduit')) {
    const protection = elementalistBalanceEffect(context, PROFILE.hardyConduit, 'boon', 'Protection');
    emitSkillBuff(context, skill, {
      at: context.start,
      source: 'Hardy Conduit',
      sourceId: skill.id,
      actorType: 'player',
      kind: String(protection?.boon || 'Protection').toLowerCase(),
      stacks: Number(protection?.stacks ?? 1),
      duration: Number(protection?.duration ?? 3),
      skillName: 'Hardy Conduit'
    });
  }

  if (hasTrait(context, 'Harmonious Conduit')) {
    const swiftness = elementalistBalanceEffect(context, PROFILE.harmoniousConduit, 'boon', 'Swiftness');
    const stability = elementalistBalanceEffect(context, PROFILE.harmoniousConduit, 'boon', 'Stability');
    for (const boon of [
      {
        kind: String(swiftness?.boon || 'Swiftness').toLowerCase(),
        stacks: Number(swiftness?.stacks ?? 1),
        duration: Number(swiftness?.duration ?? 8)
      },
      {
        kind: String(stability?.boon || 'Stability').toLowerCase(),
        stacks: Number(stability?.stacks ?? 1),
        duration: Number(stability?.duration ?? 4)
      }
    ]) {
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
    return {
      ready: false,
      retryAt: null,
      code: 'elementalist.tempest-attunement',
      reason: `${skill.name} is unavailable — requires ${String(skill.attunement)} attunement.`
    };
  }

  // Transcendent Tempest shortens the dwell, and alacrity speeds the singularity's formation.
  const dwell =
    (hasTrait(context, 'Transcendent Tempest')
      ? balanceProfileValueFromContext(context, PROFILE.overloads, 'durationMultiplier', 4)
      : balanceProfileValueFromContext(context, PROFILE.overloads, 'initialDelay', 6)) /
    (context.config.boons?.alacrity ? 1.25 : 1);
  // The configured starting attunement carries a negative entry stamp and needs no dwell.
  const startingAttunementReady = state.attunementEnteredAt < 0;
  const readyAt = startingAttunementReady ? context.start : state.attunementEnteredAt + dwell;
  return readyAt > context.start + context.epsilon
    ? {
        ready: false,
        retryAt: readyAt,
        code: 'elementalist.tempest-dwell',
        reason: `${skill.name} is unavailable until the attunement singularity forms.`
      }
    : { ready: true };
}

// Derive Lucid Singularity boon pulses from the overload's actual emitted hits,
// preserving interruption behavior and the distinct final-pulse duration.
function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (!skill.overload || !hasTrait(context, 'Lucid Singularity')) return;
  const hits = context.events
    .filter(
      (event: SimulationEvent) =>
        event.activationId === context.reservationId && event.type === 'damage' && Number(event.coefficient || 0) > 0
    )
    .sort((left: SimulationEvent, right: SimulationEvent) => left.at - right.at)
    .slice(0, balanceProfileValueFromContext(context, PROFILE.lucidSingularity, 'maximumStacks', 5));
  hits.forEach((event: SimulationEvent, index: number) => {
    const effectName = index === hits.length - 1 ? 'Final Alacrity' : 'Pulse Alacrity';
    const alacrity = elementalistBalanceEffect(context, PROFILE.lucidSingularity, 'boon', effectName);
    emitSkillBuff(context, skill, {
      at: event.at,
      source: 'Lucid Singularity',
      sourceId: skill.id,
      actorType: 'player',
      kind: String(alacrity?.boon || 'Alacrity').toLowerCase(),
      stacks: Number(alacrity?.stacks ?? 1),
      duration: elementalistEffectValue(
        context,
        PROFILE.lucidSingularity,
        'boon',
        'duration',
        index === hits.length - 1 ? 4.5 : 1,
        effectName
      ),
      skillName: 'Lucid Singularity'
    });
  });
}

// Resolve everything that happens when a Tempest cast finishes: the Gale Song heal payload, then
// for overloads the attunement lockout and each completion trait.
function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  if (skill.type === 'Heal' && hasTrait(context, 'Gale Song')) {
    const protection = elementalistBalanceEffect(context, PROFILE.galeSong, 'boon', 'Protection');
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'Gale Song',
      sourceId: skill.id,
      actorType: 'player',
      kind: String(protection?.boon || 'Protection').toLowerCase(),
      stacks: Number(protection?.stacks ?? 1),
      duration: Number(protection?.duration ?? 3),
      skillName: 'Gale Song'
    });
  }

  if (!skill.overload) return;
  const state = professionCoreState(context);
  const attunement = String(skill.attunement);
  // Finishing an overload locks its attunement out until the overload's own recharge ends.
  if (attunement in state.attunementReadyAt) {
    const typedAttunement = attunement as keyof typeof state.attunementReadyAt;
    setElementalistAttunementReadyAt(
      context,
      typedAttunement,
      Math.max(state.attunementReadyAt[typedAttunement], Number(context.rechargeReadyAt || context.effectiveEnd))
    );
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
    applyElementalistAura(context as never, {
      at: context.effectiveEnd,
      aura,
      duration: elementalistEffectValue(context, PROFILE.unstableConduit, 'buff', 'duration', 4, attunement),
      skillName: 'Unstable Conduit',
      sourceId: skill.id,
      // The completion aura precedes the same-time Overload packet.
      priority: -20
    });
  }

  if (attunement === 'Fire') {
    triggerFlameExpulsion(context as never, context.effectiveEnd, skill.id);
  }

  if (hasTrait(context, 'Transcendent Tempest')) {
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
      duration: balanceProfileValueFromContext(context, PROFILE.transcendentTempest, 'durationMultiplier', 7)
    });
  }

  // Overload Air's completion strike: a non-critical unequipped-weapon hit, mirrored onto an
  // active fire/earth elemental and recorded as its own proc for attribution.
  if (skill.name === 'Overload Air') {
    const coefficient = elementalistEffectValue(context, PROFILE.lightningJolt, 'strike', 'coefficient', 1.32);
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

  // Fire, Air, and Earth overloads supply all three casts needed to complete an active spear etching.
  if (FULL_ETCHING_CHARGE_SKILLS.has(Number(skill.id))) {
    for (const [name, progress] of Object.entries(state.etchings)) {
      if (!progress || progress.stage !== 'lesser') continue;
      const otherCasts = progress.otherCasts + 2;
      state.etchings[name] = { stage: otherCasts >= 3 ? 'full' : 'lesser', otherCasts };
    }
  }
}

// Elemental Enchantment shortens overload recharges only.
function modifyRechargeDuration(context: ElementalistPrecastContext, duration: number): number {
  return context.skill.overload && hasTrait(context, 'Elemental Enchantment')
    ? duration * balanceProfileValueFromContext(context, CORE_PROFILE.elementalEnchantment, 'rechargeMultiplier', 0.85)
    : duration;
}

// Attribute every overload-sourced event to the profession mechanic rather than a held weapon.
function prepareEvent(_context: ElementalistSchedulerContext, event: SimulationEventInput): SimulationEventInput {
  return Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS).includes(Number(event.skillId ?? event.sourceId))
    ? { ...event, skillWeapon: 'Profession mechanic' }
    : event;
}

// React to normalized attunement and aura events so Tempest traits share the
// same timestamps as core state changes and resolver-generated auras.
function onEventScheduled(context: ElementalistCastContext, event: SimulationEvent): void {
  // Fresh Air re-attunes to Air off cooldown; clear Overload Air's recorded recharge with it.
  if (event.type === 'elementalist.fresh-air') {
    context.state.cooldowns.delete(ELEMENTALIST_OVERLOAD_SKILL_IDS.Air);
    return;
  }

  // Latent Stamina: vigor on attuning to water, throttled by its own internal cooldown stamp.
  if (event.type === 'elementalist.attunement' && event.to === 'Water' && hasTrait(context, 'Latent Stamina')) {
    const state = tempestState.from(context);
    if (isInternalCooldownReady(event.at, state.latentStaminaReadyAt)) {
      state.latentStaminaReadyAt =
        event.at + balanceProfileValueFromContext(context, PROFILE.latentStamina, 'internalCooldown', 10);
      const vigor = elementalistBalanceEffect(context, PROFILE.latentStamina, 'boon', 'Vigor');
      const sourceId = event.skillId ?? event.sourceId;
      emitSkillBuff(context, elementalistEventSkill(context, 'Latent Stamina', sourceId), {
        at: event.at,
        source: 'Latent Stamina',
        sourceId,
        actorType: 'player',
        kind: String(vigor?.boon || 'Vigor').toLowerCase(),
        stacks: Number(vigor?.stacks ?? 1),
        duration: Number(vigor?.duration ?? 3),
        skillName: 'Latent Stamina'
      });
    }

    return;
  }

  // Remaining traits react to scheduler-emitted aura events, attributed to the granting skill.
  if (event.type !== 'elementalist.aura') return;
  const source = String(event.skillName || event.source || 'Aura');
  const sourceId = event.skillId ?? event.sourceId;
  if (hasTrait(context, 'Invigorating Torrents')) {
    for (const name of ['Vigor', 'Regeneration'] as const) {
      const boon = elementalistBalanceEffect(context, PROFILE.invigoratingTorrents, 'boon', name);
      emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
        at: event.at,
        source,
        sourceId,
        actorType: 'player',
        kind: String(boon?.boon || name).toLowerCase(),
        stacks: Number(boon?.stacks ?? 1),
        duration: Number(boon?.duration ?? 5),
        skillName: source
      });
    }
  }

  if (hasTrait(context, 'Elemental Bastion')) {
    const alacrity = elementalistBalanceEffect(context, PROFILE.elementalBastion, 'boon', 'Alacrity');
    emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
      at: event.at,
      source,
      sourceId,
      actorType: 'player',
      kind: String(alacrity?.boon || 'Alacrity').toLowerCase(),
      stacks: Number(alacrity?.stacks ?? 1),
      duration: Number(alacrity?.duration ?? 4),
      skillName: source
    });
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
