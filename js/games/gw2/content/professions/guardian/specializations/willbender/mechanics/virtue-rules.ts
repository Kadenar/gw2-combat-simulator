import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { buildGuardianStrike } from '#gw2/content/professions/guardian/core/mechanics/event-handlers.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/content/professions/guardian/core/traits/index.js';
import type { SchedulerRecord, SkillId } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  GuardianCastContext,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/content/professions/guardian/types.js';
import {
  activeLethalTempo,
  gainLethalTempo
} from '#gw2/content/professions/guardian/specializations/willbender/mechanics/virtues.js';
import { willbenderState } from '#gw2/content/professions/guardian/specializations/willbender/state.js';

import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/guardian/specializations/willbender/profiles.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';

function lethalTempoStacks(context: Gw2ModifierContext): number {
  return activeLethalTempo(willbenderState.from(context), context.time);
}

export const willbenderModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.willbender.lethal-tempo-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    // Tyrant's Momentum raises strike bonus (5 % vs 2 %) to compensate for the shorter window.
    parameters: {
      damagePerStack: 0.02,
      tyrantsMomentumDamagePerStack: 0.05
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      1 +
      lethalTempoStacks(context) *
        (hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM)
          ? parameters.tyrantsMomentumDamagePerStack
          : parameters.damagePerStack),
    order: 100
  },
  {
    id: 'guardian.willbender.lethal-tempo-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    // Condition bonus is identical (2 %) without Tyrant's Momentum; the trait adds 1 % here too.
    parameters: {
      damagePerStack: 0.02,
      tyrantsMomentumDamagePerStack: 0.03
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      1 +
      lethalTempoStacks(context) *
        (hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM)
          ? parameters.tyrantsMomentumDamagePerStack
          : parameters.damagePerStack),
    order: 100
  },
  {
    id: 'guardian.willbender.power-for-power',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 3,
    order: 100,
    // willbenderFlames flag is set only on Willbender Flames pulse strikes (rules.ts handleWillbenderFlamePulse),
    // so this 3× multiplier never applies to normal weapon hits.
    when: (context) => Boolean(context.event?.willbenderFlames) && hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_FOR_POWER)
  }
]);

export const willbenderAttributeRules = Object.freeze({
  modifierRules: willbenderModifierRules
});

// Open the chosen virtue window and grant its activation traits from one
// timestamp; the returned duration lets the caller schedule matching expiry.
export function applyWillbenderVirtueActivationTraits(
  context: GuardianCastContext,
  virtue: GuardianVirtue,
  at: number
): number {
  const state = willbenderState.from(context);
  const tyrantsMomentum = hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM);
  const virtueWindows = balanceProfileFromContext(context, PROFILE.virtueWindows);
  const window = balanceProfileEffect(virtueWindows, 'buff', virtue === 'justice' ? 0 : virtue === 'resolve' ? 1 : 2);
  const tyrants = balanceProfileFromContext(context, PROFILE.tyrantsMomentum);
  const duration =
    virtue === 'justice' && tyrantsMomentum
      ? Number(balanceProfileEffect(tyrants, 'buff', 1)?.duration || 10)
      : Number(window?.duration || (virtue === 'justice' ? 8 : 6));
  const lethalTempo = balanceProfileFromContext(context, PROFILE.lethalTempo);
  const tempoDuration = Number(
    balanceProfileEffect(tyrantsMomentum ? tyrants : lethalTempo, 'buff')?.duration || (tyrantsMomentum ? 4 : 6)
  );
  state[`${virtue}Until`] = at + duration;
  gainLethalTempo(state, at, tyrantsMomentum, Number(lethalTempo?.maximumStacks || 5), tempoDuration);
  emitSkillBuff(context, {
    at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
    actorType: 'player',
    skillId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
    skillName: 'Lethal Tempo',
    name: 'Lethal Tempo',
    kind: 'lethal-tempo',
    stacks: state.lethalTempoStacks,
    duration: state.lethalTempoUntil - at
  });
  if (virtue === 'resolve' && hasTrait(context, GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES)) {
    const vigor = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.restorativeVirtues), 'boon');
    emitSkillBuff(context, {
      at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
      actorType: 'player',
      skillId: GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
      skillName: 'Restorative Virtues',
      name: 'Restorative Virtues — Vigor',
      kind: 'vigor',
      stacks: Number(vigor?.stacks || 1),
      duration: gw2SchedulerBoonDuration(context, context.skill, 'vigor', Number(vigor?.duration || 3))
    });
  }

  if (virtue === 'resolve' && hasTrait(context, GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL)) {
    const alacrity = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.phoenixProtocol), 'boon');
    emitSkillBuff(context, {
      at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
      actorType: 'player',
      skillId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
      skillName: 'Phoenix Protocol',
      name: 'Phoenix Protocol — Activation Alacrity',
      kind: 'alacrity',
      stacks: Number(alacrity?.stacks || 1),
      duration: gw2SchedulerBoonDuration(context, context.skill, 'alacrity', Number(alacrity?.duration || 5)),
      audience: { recipients: 'self' as const }
    });
  }

  return duration;
}

function activeWeaponNames(context: GuardianSchedulerContext): Set<string> {
  const configured = gw2ConfiguredWeaponSet(context.config, context.state.activeWeaponSet === 2 ? 2 : 1);
  return new Set(configured.map((weapon) => String(weapon || '')).filter(Boolean));
}

function isActiveWeaponSkill(
  skill: GuardianSkill | undefined,
  weaponNames: ReadonlySet<string>
): skill is GuardianSkill {
  return Boolean(skill?.type === 'Weapon' && (!weaponNames.size || weaponNames.has(String(skill.weapon || ''))));
}

function queueInFlightWeaponCooldownReduction(
  context: GuardianSchedulerContext,
  weaponNames: ReadonlySet<string>,
  at: number
): number {
  const state = willbenderState.from(context);
  let reducedBy = 0;
  for (const event of context.events) {
    if (
      event.type !== 'action' ||
      event.cancelled === true ||
      Number(event.at) > at + context.epsilon ||
      Number(event.endsAt) < at - context.epsilon ||
      Number(event.rechargeReadyAt || 0) <= at + context.epsilon
    ) {
      continue;
    }

    if (event.skillId == null) continue;
    const skill = context.catalog.skillsById.get(event.skillId) as GuardianSkill | undefined;
    if (!isActiveWeaponSkill(skill, weaponNames)) continue;
    const activationId = String(event.activationId || '');
    if (!activationId) continue;
    const pending = Number(state.pendingWeaponCooldownReduction[activationId] || 0);
    // Already-accumulated pending reductions are subtracted from the remaining
    // recharge so that multiple virtue triggers during the same cast don't over-reduce.
    const available = Math.max(0, Number(event.rechargeReadyAt) - at - pending);
    const reduction = Math.min(
      Number(balanceProfileFromContext(context, PROFILE.restorativeVirtues)?.rechargeReduction || 0.25),
      available
    );
    if (reduction <= context.epsilon) continue;
    state.pendingWeaponCooldownReduction[activationId] = pending + reduction;
    reducedBy += reduction;
  }

  return reducedBy;
}

function reduceActiveWeaponCooldowns(context: GuardianSchedulerContext, at: number): number {
  const weaponNames = activeWeaponNames(context);
  const activeIds = new Set<SkillId>([...context.state.cooldowns.keys(), ...context.state.ammo.keys()]);
  const rechargeReduction = Number(
    balanceProfileFromContext(context, PROFILE.restorativeVirtues)?.rechargeReduction || 0.25
  );
  let reducedBy = 0;
  for (const skillId of activeIds) {
    const skill = context.catalog.skillsById.get(skillId) as GuardianSkill | undefined;
    if (isActiveWeaponSkill(skill, weaponNames)) {
      reducedBy += context.cooldownController.reduceSkillRecharge(skill, rechargeReduction, at);
    }
  }

  reducedBy += queueInFlightWeaponCooldownReduction(context, weaponNames, at);
  return reducedBy;
}

function applyPendingWeaponCooldownReduction(context: GuardianCastContext, skill: GuardianSkill): void {
  const activationId = String(context.reservationId || '');
  if (!activationId) return;
  const state = willbenderState.from(context);
  const pending = Number(state.pendingWeaponCooldownReduction[activationId] || 0);
  // Always delete regardless of whether we apply it; stale entries would corrupt
  // future casts if the skill's own recharge changed between the queue and cast-complete.
  delete state.pendingWeaponCooldownReduction[activationId];
  if (pending <= context.epsilon || skill.type !== 'Weapon') return;
  context.cooldownController.reduceSkillRecharge(skill, pending, context.effectiveEnd);
}

// Add or refresh Lethal Tempo at its cap and emit the matching visible buff from
// a completed Willbender virtue trigger.
function emitLethalTempo(context: GuardianSchedulerContext, at: number, sourceSkill: string): void {
  const state = willbenderState.from(context);
  const tyrantsMomentum = hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM);
  const lethalTempo = balanceProfileFromContext(context, PROFILE.lethalTempo);
  const tyrants = balanceProfileFromContext(context, PROFILE.tyrantsMomentum);
  gainLethalTempo(
    state,
    at,
    tyrantsMomentum,
    Number(lethalTempo?.maximumStacks || 5),
    Number(balanceProfileEffect(tyrantsMomentum ? tyrants : lethalTempo, 'buff')?.duration || (tyrantsMomentum ? 4 : 6))
  );
  emitSkillBuff(context, {
    at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
    actorType: 'player',
    skillId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
    skillName: 'Lethal Tempo',
    name: 'Lethal Tempo',
    kind: 'lethal-tempo',
    stacks: state.lethalTempoStacks,
    duration: state.lethalTempoUntil - at,
    triggeredBy: sourceSkill
  });
}

function handleWillbenderFlameActivation(context: GuardianSchedulerContext, task: SchedulerRecord): void {
  const payload = task.payload as SchedulerRecord | undefined;
  const virtue = payload?.virtue as GuardianVirtue | undefined;
  if (!payload || !virtue) return;
  const state = willbenderState.from(context);
  if (state.flameVirtue !== virtue) state.flameGeneration += 1;
  state.flameVirtue = virtue;
  const flameGeneration = state.flameGeneration;
  const flameId = Number(payload.flameId);
  const flames = balanceProfileFromContext(context, PROFILE.flames);
  const strike = balanceProfileEffect(flames, 'strike');
  const ticks = strike?.type === 'strike' ? strike.ticks : null;
  if (!ticks?.length) throw new Error('Willbender Flames requires an explicit strike timeline.');
  // A flame field is a separate activation from the virtue that created it, so its unequipped weapon-strength
  // roll is shared by its pulses without colliding with the virtue impact's profession-mechanic roll.
  const activationId = context.createActivationId('effect');
  for (const [index, tick] of ticks.entries()) {
    const pulse = index + 1;
    context.tasks.schedule({
      id: `guardian.willbender-flame:${flameGeneration}:${task.at}:${pulse}`,
      type: 'guardian.willbender-flame-pulse',
      at: Number(task.at) + Number(tick.atMs) / 1000,
      payload: { activationId, flameGeneration, flameId, pulse }
    });
  }
}

function handleWillbenderFlamePulse(context: GuardianSchedulerContext, task: SchedulerRecord): void {
  const payload = task.payload as SchedulerRecord | undefined;
  const state = willbenderState.from(context);
  // Stale pulses from a previous virtue activation (different flameGeneration) are
  // silently discarded; only the most recent virtue's pulses should fire.
  if (!payload || Number(payload.flameGeneration) !== state.flameGeneration) {
    return;
  }

  const at = Number(task.at);
  const flameId = Number(payload.flameId);
  const pulse = Number(payload.pulse);
  const flames = balanceProfileFromContext(context, PROFILE.flames);
  const strike = balanceProfileEffect(flames, 'strike');
  const ticks = strike?.type === 'strike' ? strike.ticks : null;
  const tick = ticks?.[pulse - 1];
  if (!ticks?.length || !tick) throw new Error('Willbender Flames pulse is missing its strike tick.');
  context.emit(
    buildGuardianStrike({
      at,
      sourceId: flameId,
      skillId: flameId,
      skillName: 'Willbender Flames',
      name: 'Willbender Flames',
      coefficient: Number(tick.coefficient),
      skillWeapon: 'Unequipped',
      hitIndex: pulse,
      totalHits: ticks.length,
      willbenderFlames: true
    })
  );
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.SEARING_PACT)) {
    const burning = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.searingPact), 'condition');
    emitSkillCondition(context, {
      at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.SEARING_PACT,
      actorType: 'player',
      skillId: GUARDIAN_TRAIT_IDS.SEARING_PACT,
      skillName: 'Searing Pact',
      name: 'Searing Pact — Burning',
      condition: String(burning?.condition || 'Burning'),
      stacks: Number(burning?.stacks || 1),
      duration: Number(burning?.duration || 1),
      triggeredBy: 'Willbender Flames'
    });
  }
}

function handleWillbenderVirtueHit(context: GuardianSchedulerContext, task: SchedulerRecord): void {
  const payload = task.payload as SchedulerRecord | undefined;
  if (!payload) return;
  const at = Number(task.at);
  const state = willbenderState.from(context);
  const sourceSkill = String(payload.sourceSkillName || '');
  const boonSourceSkill =
    context.catalog.skillsByName.get(sourceSkill) ||
    ({ id: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO, name: sourceSkill || 'Willbender Virtue' } as GuardianSkill);

  // Materialize one completed virtue hit cycle, resetting its counter before
  // emitting Lethal Tempo, cooldown reductions, and virtue-specific boons.
  const triggerVirtue = (virtue: GuardianVirtue, burningDuration?: number, justiceActive?: boolean): void => {
    state.triggeredVirtueEffects += 1;
    emitLethalTempo(context, at, sourceSkill);

    let cooldownReduction = 0;
    if (hasTrait(context, GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES)) {
      cooldownReduction = reduceActiveWeaponCooldowns(context, at);
      if (cooldownReduction > 0) {
        emitGuardianProc(context, {
          name: 'Restorative Virtues',
          at,
          sourceSkill,
          detail: `${Number(cooldownReduction.toFixed(3))}s weapon recharge`,
          icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES)
        });
      }
    }

    context.emit({
      type: 'guardian.willbender-virtue-triggered',
      at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
      actorType: 'player',
      virtue,
      sourceSkill,
      cooldownReduction,
      ...(burningDuration == null ? {} : { burningDuration }),
      ...(justiceActive == null ? {} : { justiceActive })
    });
    if (virtue === 'courage') {
      const courage = balanceProfileFromContext(context, PROFILE.courageTrigger);
      for (const boon of (courage?.effects || []).filter((effect) => effect.type === 'boon')) {
        const kind = String(boon.boon || '');
        emitSkillBuff(context, {
          at,
          source: 'guardian',
          sourceId: ID.CRASHING_COURAGE,
          actorType: 'player',
          skillId: ID.CRASHING_COURAGE,
          skillName: 'Crashing Courage',
          name: `Crashing Courage — Triggered ${kind === 'aegis' ? 'Aegis' : 'Stability'}`,
          kind,
          stacks: Number(boon.stacks || 1),
          duration: gw2SchedulerBoonDuration(context, boonSourceSkill, kind, Number(boon.duration || 4)),
          triggeredBy: sourceSkill
        });
      }
    }

    if (virtue === 'resolve' && hasTrait(context, GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL)) {
      const alacrity = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.phoenixProtocol), 'boon', 1);
      emitSkillBuff(context, {
        at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
        actorType: 'player',
        skillId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
        skillName: 'Phoenix Protocol',
        name: 'Phoenix Protocol — Alacrity',
        kind: 'alacrity',
        stacks: Number(alacrity?.stacks || 1),
        duration: gw2SchedulerBoonDuration(context, boonSourceSkill, 'alacrity', Number(alacrity?.duration || 1)),
        triggeredBy: sourceSkill
      });
    }
  };

  for (const virtue of ['justice', 'resolve', 'courage'] as const) {
    if (state[`${virtue}Until`] <= at + context.epsilon) continue;
    state.virtueHitCounts[virtue] += 1;
    // Permeating Wrath halves the justice trigger threshold (3 hits vs 5) but
    // only for justice; resolve and courage always require 5 hits.
    const triggerHits =
      virtue === 'justice' && hasTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)
        ? Number(balanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)?.threshold || 3)
        : Number(balanceProfileFromContext(context, PROFILE.virtueWindows)?.threshold || 5);
    if (state.virtueHitCounts[virtue] < triggerHits) continue;
    state.virtueHitCounts[virtue] = 0;
    triggerVirtue(virtue, virtue === 'justice' ? 2 : undefined, virtue === 'justice' ? true : undefined);
  }
}

function observeWillbenderEvent(context: GuardianSchedulerContext, event: SchedulerRecord): void {
  // Only player-owned strikes count as virtue hits. Sigil of Air is the sole
  // non-player-actor source explicitly permitted because its proc is considered
  // "player damage" in-game even though its actor classification differs.
  if (
    event.type !== 'damage' ||
    !(Number(event.coefficient || 0) > 0) ||
    (!isGw2PlayerActorEvent(event) && event.sourceId !== 'sigil.air')
  ) {
    return;
  }

  context.tasks.schedule({
    // eventOrder (monotone emission index) is preferred over at because multiple events
    // can share the same timestamp; using at alone would collapse them into one task id.
    id: `guardian.willbender-virtue-hit:${String(event.eventOrder ?? event.at)}`,
    type: 'guardian.willbender-virtue-hit',
    at: Number(event.at),
    payload: {
      sourceSkillId: event.skillId,
      sourceSkillName: event.skillName
    }
  });
}

/** Runs Willbender mechanics owned by one completed skill activation. */
export const willbenderSkillMechanicHandlers = Object.freeze({
  'guardian.willbender.arm-repose': ({ context, at }: { context: GuardianSchedulerContext; at: number }): void => {
    context.state.profession.core.availableFlips[ID.REPOSE] = at + 6;
  }
});

export const willbenderSchedulerHooks = Object.freeze({
  onCastComplete: Object.freeze([
    {
      id: 'guardian.willbender-restorative-virtues',
      order: 40,
      handler: applyPendingWeaponCooldownReduction
    }
  ]),
  onEventScheduled: Object.freeze([
    {
      id: 'guardian.willbender-virtue-hits',
      order: 40,
      handler: observeWillbenderEvent
    }
  ]),
  taskHandlers: Object.freeze({
    'guardian.willbender-flame-activate': handleWillbenderFlameActivation,
    'guardian.willbender-flame-pulse': handleWillbenderFlamePulse,
    'guardian.willbender-virtue-hit': handleWillbenderVirtueHit
  })
});
