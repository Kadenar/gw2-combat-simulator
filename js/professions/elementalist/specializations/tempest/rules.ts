import type { AvailabilityResult, SchedulerRecord, SimulationEvent, Skill } from '../../../../platform/engine/types.js';
import type { ElementalistCastContext, ElementalistPrecastContext } from '../../types.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import {
  applyElementalistAura,
  emitElementalistBuff,
  emitElementalistProc,
  triggerElementalistEarthenBlast,
  triggerElementalistElectricDischarge,
  triggerElementalistFlameExpulsion,
  triggerElementalistSunspot
} from '../../core/rules.js';
import { elementalistCoreState, setElementalistAttunementReadyAt } from '../../core/state.js';
import { armElementalistElementalLightningJolt } from '../../core/elementals.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../data/ids.js';
import { tempestModifierRules } from './modifiers.js';
import { elementalistBalanceEffect, elementalistBalanceValue, elementalistEffectValue } from '../../core/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export function applyTempestShoutTraits(context: ElementalistCastContext, skill: Skill): void {
  if (!hasTrait(context, 'Tempestuous Aria')) return;
  const might = elementalistBalanceEffect(context, PROFILE.tempestuousAria, 'boon', 'Shout Might');
  emitElementalistBuff(
    context as never,
    context.effectiveEnd,
    String(might?.boon || 'Might'),
    Number(might?.stacks ?? 2),
    Number(might?.duration ?? 10),
    skill.name,
    skill.id,
    0,
    'party'
  );
}

function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  if (!skill.overload) return;
  if (hasTrait(context, 'Hardy Conduit')) {
    const protection = elementalistBalanceEffect(context, PROFILE.hardyConduit, 'boon', 'Protection');
    emitElementalistBuff(
      context as never,
      context.start,
      String(protection?.boon || 'Protection'),
      Number(protection?.stacks ?? 1),
      Number(protection?.duration ?? 3),
      'Hardy Conduit',
      skill.id
    );
  }

  if (hasTrait(context, 'Harmonious Conduit')) {
    const swiftness = elementalistBalanceEffect(context, PROFILE.harmoniousConduit, 'boon', 'Swiftness');
    const stability = elementalistBalanceEffect(context, PROFILE.harmoniousConduit, 'boon', 'Stability');
    emitElementalistBuff(
      context as never,
      context.start,
      String(swiftness?.boon || 'Swiftness'),
      Number(swiftness?.stacks ?? 1),
      Number(swiftness?.duration ?? 8),
      'Harmonious Conduit',
      skill.id
    );
    emitElementalistBuff(
      context as never,
      context.start,
      String(stability?.boon || 'Stability'),
      Number(stability?.stacks ?? 1),
      Number(stability?.duration ?? 4),
      'Harmonious Conduit',
      skill.id
    );
  }

  if (skill.attunement === 'Fire') {
    triggerElementalistSunspot(context as never, context.start, skill.id);
  } else if (skill.attunement === 'Air') {
    triggerElementalistElectricDischarge(context as never, context.start, skill.id);
  } else if (skill.attunement === 'Earth') {
    triggerElementalistEarthenBlast(context as never, context.start, skill.id);
  }
}

function availability(context: ElementalistPrecastContext, skill: Skill): AvailabilityResult {
  if (!skill.overload) return { ready: true };
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (skill.attunement !== state.primaryAttunement) {
    return {
      ready: false,
      retryAt: null,
      code: 'elementalist.tempest-attunement',
      reason: `${skill.name} is unavailable — requires ${String(skill.attunement)} attunement.`
    };
  }

  const dwell =
    (hasTrait(context, 'Transcendent Tempest')
      ? elementalistBalanceValue(context, PROFILE.overloads, 'durationMultiplier', 4)
      : elementalistBalanceValue(context, PROFILE.overloads, 'initialDelay', 6)) /
    (context.config.boons?.alacrity ? 1.25 : 1);
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

function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (!skill.overload || !hasTrait(context, 'Lucid Singularity')) return;
  const hits = context.events
    .filter(
      (event: SimulationEvent) =>
        event.activationId === context.reservationId && event.type === 'damage' && Number(event.coefficient || 0) > 0
    )
    .sort((left: SimulationEvent, right: SimulationEvent) => left.at - right.at)
    .slice(0, elementalistBalanceValue(context, PROFILE.lucidSingularity, 'maximumStacks', 5));
  hits.forEach((event: SimulationEvent, index: number) => {
    emitElementalistBuff(
      context as never,
      event.at,
      String(
        elementalistBalanceEffect(
          context,
          PROFILE.lucidSingularity,
          'boon',
          index === hits.length - 1 ? 'Final Alacrity' : 'Pulse Alacrity'
        )?.boon || 'Alacrity'
      ),
      Number(
        elementalistBalanceEffect(
          context,
          PROFILE.lucidSingularity,
          'boon',
          index === hits.length - 1 ? 'Final Alacrity' : 'Pulse Alacrity'
        )?.stacks ?? 1
      ),
      elementalistEffectValue(
        context,
        PROFILE.lucidSingularity,
        'boon',
        'duration',
        index === hits.length - 1 ? 4.5 : 1,
        index === hits.length - 1 ? 'Final Alacrity' : 'Pulse Alacrity'
      ),
      'Lucid Singularity',
      skill.id
    );
  });
}

function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  if (!skill.overload) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const attunement = String(skill.attunement);
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
    triggerElementalistFlameExpulsion(context as never, context.effectiveEnd, skill.id);
  }

  if (hasTrait(context, 'Transcendent Tempest')) {
    context.emit({
      type: 'buff',
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
      duration: elementalistBalanceValue(context, PROFILE.transcendentTempest, 'durationMultiplier', 7)
    });
  }

  if (skill.name === 'Overload Air') {
    const coefficient = elementalistEffectValue(context, PROFILE.lightningJolt, 'strike', 'coefficient', 1.32);
    context.emit({
      type: 'damage',
      at: context.effectiveEnd,
      source: 'Lightning Jolt',
      sourceId: ID.LIGHTNING_JOLT,
      actorType: 'effect',
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

export const tempestCastRules = Object.freeze({
  availability: {
    id: 'elementalist.tempest-overload',
    order: 30,
    handler: availability
  }
});

export const tempestAttributeRules = Object.freeze({
  modifierRules: tempestModifierRules
});

export const tempestSchedulerHooks = Object.freeze({
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
  }
});
