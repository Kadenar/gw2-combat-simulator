import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { reduceMatchingCooldowns } from '#gw2/platform/execution/cooldowns.js';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GW2_ALACRITY_RECHARGE_RATE, gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/professions/guardian/core/traits/index.js';
import type { ScheduledTask } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type {
  GuardianCastContext,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';
import {
  activeLethalTempo,
  gainLethalTempo,
  lethalTempoParameters
} from '#gw2/professions/guardian/specializations/willbender/mechanics/lethal-tempo.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';

import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { gw2TrackedRechargeReduction } from '#gw2/platform/skills/recharge.js';

function lethalTempoStacks(context: Gw2ModifierContext): number {
  return activeLethalTempo(willbenderState.from(context), context.time);
}

export const willbenderModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.willbender.lethal-tempo-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    // Lethal Tempo shares the outgoing additive bucket with equipment and other additive traits.
    operation: 'damage-additive',
    // Tyrant's Momentum raises strike bonus (5 % vs 2 %) to compensate for the shorter window.
    parameters: {
      damagePerStack: 0.02,
      tyrantsMomentumDamagePerStack: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      lethalTempoStacks(context) *
      (hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM)
        ? parameters.tyrantsMomentumDamagePerStack
        : parameters.damagePerStack),
    order: 100
  },
  {
    id: 'guardian.willbender.lethal-tempo-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    // Use the same additive grouping for conditions so Bursting does not multiply Lethal Tempo.
    operation: 'damage-additive',
    // Condition bonus is identical (2 %) without Tyrant's Momentum; the trait adds 1 % here too.
    parameters: {
      damagePerStack: 0.02,
      tyrantsMomentumDamagePerStack: 0.03
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
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

// Open and report the chosen virtue window from one timestamp so combat logic and uptime charts share its duration.
export function applyWillbenderVirtueActivationTraits(
  context: GuardianCastContext,
  virtue: GuardianVirtue,
  at: number
): number | undefined {
  const state = willbenderState.from(context);
  const tyrantsMomentum = hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM);
  // Only the selected window owns its expiry; independent activation traits still run after removal.
  const windowId = virtue === 'justice' && tyrantsMomentum ? PROFILE.tyrantsMomentum : PROFILE.virtueWindows;
  const windowProfile = requireBalanceProfileFromContext(context, windowId);
  const window = requireEffect(windowProfile, 'buff', virtue);
  const duration = window ? effectNumber(windowProfile, window, 'duration') : undefined;
  state[`${virtue}Until`] = duration === undefined ? 0 : gw2EffectExpiresAt(at, duration);
  if (duration !== undefined)
    emitSkillBuff(context, {
      at,
      source: 'guardian',
      sourceId: context.skill.id,
      actorType: 'player',
      skillId: context.skill.id,
      skillName: context.skill.name,
      kind: `willbender-${virtue}`,
      duration,
      audience: { recipients: 'self' }
    });
  const tempo = lethalTempoParameters(context);
  if (tempo) {
    gainLethalTempo(state, at, tempo);
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
      // Emit the authored duration so buff-history rounding cannot add a second effect tick.
      duration: tempo.duration
    });
  }

  if (virtue === 'resolve' && hasTrait(context, GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES)) {
    const restorativeVirtuesProfile = requireBalanceProfileFromContext(context, PROFILE.restorativeVirtues);
    const vigor = requireEffect(restorativeVirtuesProfile, 'boon', 'vigor');
    if (vigor) {
      emitSkillBuff(context, {
        at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
        actorType: 'player',
        skillId: GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
        skillName: 'Restorative Virtues',
        name: 'Restorative Virtues — Vigor',
        kind: 'vigor',
        stacks: effectNumber(restorativeVirtuesProfile, vigor, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          context.skill,
          'vigor',
          effectNumber(restorativeVirtuesProfile, vigor, 'duration')
        )
      });
    }
  }

  // Holy Reckoning grants Fury only for Rushing Justice's activation; its Might belongs to later virtue triggers.
  if (context.skill.id === ID.RUSHING_JUSTICE && hasTrait(context, GUARDIAN_TRAIT_IDS.HOLY_RECKONING)) {
    const holyReckoningProfile = requireBalanceProfileFromContext(context, PROFILE.holyReckoning);
    const fury = requireEffect(holyReckoningProfile, 'boon', 'fury');
    if (fury) {
      emitSkillBuff(context, {
        at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.HOLY_RECKONING,
        actorType: 'player',
        skillId: GUARDIAN_TRAIT_IDS.HOLY_RECKONING,
        skillName: 'Holy Reckoning',
        name: 'Holy Reckoning — Fury',
        kind: 'fury',
        stacks: effectNumber(holyReckoningProfile, fury, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          context.skill,
          'fury',
          effectNumber(holyReckoningProfile, fury, 'duration')
        ),
        audience: { recipients: 'self' as const }
      });
    }
  }

  if (virtue === 'resolve' && hasTrait(context, GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL)) {
    const phoenixProtocolProfile = requireBalanceProfileFromContext(context, PROFILE.phoenixProtocol);
    const alacrity = requireEffect(phoenixProtocolProfile, 'boon', 'alacrity');
    if (alacrity) {
      emitSkillBuff(context, {
        at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
        actorType: 'player',
        skillId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
        skillName: 'Phoenix Protocol',
        name: 'Phoenix Protocol — Activation Alacrity',
        kind: 'alacrity',
        stacks: effectNumber(phoenixProtocolProfile, alacrity, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          context.skill,
          'alacrity',
          effectNumber(phoenixProtocolProfile, alacrity, 'duration')
        ),
        // Phoenix Protocol is personal; Battle Presence shares its alacrity with nearby allies.
        audience: {
          recipients: hasTrait(context, GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE) ? ('party' as const) : ('self' as const)
        }
      });
    }
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
      Number(event.at) > at + EPSILON ||
      Number(event.endsAt) < at - EPSILON ||
      Number(event.rechargeReadyAt || 0) <= at + EPSILON
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
    const restorativeVirtuesProfile = requireBalanceProfileFromContext(context, PROFILE.restorativeVirtues);
    // In-flight skills are not in the cooldown controller yet, so project the same base-to-tracked conversion here.
    const reduction = Math.min(
      gw2TrackedRechargeReduction(
        balanceProfileNumber(restorativeVirtuesProfile, 'rechargeReduction'),
        context.hasBuff('alacrity', at) ? Number(context.config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE) : 1
      ),
      available
    );
    if (reduction <= EPSILON) continue;
    state.pendingWeaponCooldownReduction[activationId] = pending + reduction;
    reducedBy += reduction;
  }

  return reducedBy;
}

function reduceActiveWeaponCooldowns(context: GuardianSchedulerContext, at: number): number {
  const weaponNames = activeWeaponNames(context);
  const restorativeVirtuesProfile = requireBalanceProfileFromContext(context, PROFILE.restorativeVirtues);
  const rechargeReduction = balanceProfileNumber(restorativeVirtuesProfile, 'rechargeReduction');
  let reducedBy = reduceMatchingCooldowns(
    context,
    (skill) => isActiveWeaponSkill(skill, weaponNames),
    rechargeReduction,
    at
  );

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
  if (pending <= EPSILON || skill.type !== 'Weapon') return;
  // Pending values were converted while the cast was in flight, so apply them directly to its committed deadline.
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (readyAt > context.effectiveEnd + EPSILON) {
    context.state.cooldowns.set(skill.id, Math.max(context.effectiveEnd, readyAt - pending));
  }
}

// Add or refresh Lethal Tempo at its cap and emit the matching visible buff from
// a completed Willbender virtue trigger.
function emitLethalTempo(context: GuardianSchedulerContext, at: number, sourceSkill: string): void {
  const state = willbenderState.from(context);
  const tempo = lethalTempoParameters(context);
  if (!tempo) return;
  gainLethalTempo(state, at, tempo);
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
    // Buff history and state each snap the same authored duration once.
    duration: tempo.duration,
    triggeredBy: sourceSkill
  });
}

function handleWillbenderFlameActivation(
  context: GuardianSchedulerContext,
  task: ScheduledTask<{ readonly virtue: GuardianVirtue; readonly flameId: number; readonly offTarget?: boolean }>
): void {
  const payload = task.payload;
  const virtue = payload?.virtue;
  if (!payload || !virtue) return;
  const flamesProfile = requireBalanceProfileFromContext(context, PROFILE.flames);
  const strike = requireEffect(flamesProfile, 'strike', 'Strike');
  if (!strike) return;
  const state = willbenderState.from(context);
  if (state.flameVirtue !== virtue) willbenderFlames.cancelOwner(context, 'willbender-flames');
  state.flameVirtue = virtue;
  const flameId = Number(payload.flameId);

  const ticks = strike?.type === 'strike' ? strike.ticks : null;
  if (!ticks?.length) throw new Error('Willbender Flames requires an explicit strike timeline.');
  // A flame field is a separate activation from the virtue that created it, so its unequipped weapon-strength
  // roll is shared by its pulses without colliding with the virtue impact's profession-mechanic roll.
  // Preserve targeting explicitly across that new activation, including pulses after Combat Start.
  const activationId = context.createActivationId('effect');
  willbenderFlames.start(context, {
    times: ticks.map((tick) => task.at + Number(tick.atMs) / 1000),
    ownerId: 'willbender-flames',
    captured: { activationId, flameId, offTarget: payload.offTarget === true }
  });
}

// Same-virtue fields overlap; switching virtue cancels their shared lifetime group.
export const willbenderFlames = timedEffect<
  GuardianSchedulerContext,
  {
    activationId: string;
    flameId: number;
    offTarget: boolean;
  }
>({
  id: 'guardian.willbender-flame-pulse',
  effectsAt(context, at, payload, occurrence) {
    const { flameId, activationId } = payload;
    const pulse = occurrence + 1;

    const flamesProfile = requireBalanceProfileFromContext(context, PROFILE.flames);
    const strike = requireEffect(flamesProfile, 'strike', 'Strike');
    if (!strike) return;
    const ticks = strike?.type === 'strike' ? strike.ticks : null;
    const tick = ticks?.[pulse - 1];
    if (!ticks?.length || !tick) throw new Error('Willbender Flames pulse is missing its strike tick.');
    context.emit(
      buildGuardianStrike({
        at,
        activationId,
        sourceId: flameId,
        skillId: flameId,
        skillName: 'Willbender Flames',
        name: 'Willbender Flames',
        coefficient: Number(tick.coefficient),
        skillWeapon: 'Unequipped',
        hitIndex: pulse,
        totalHits: ticks.length,
        willbenderFlames: true,
        ...(payload.offTarget === true ? { offTarget: true } : {})
      })
    );
    if (hasTrait(context, GUARDIAN_TRAIT_IDS.SEARING_PACT)) {
      const searingPactProfile = requireBalanceProfileFromContext(context, PROFILE.searingPact);
      const burning = requireEffect(searingPactProfile, 'condition', 'Burning');
      if (burning) {
        emitSkillCondition(context, {
          at,
          source: 'guardian',
          sourceId: GUARDIAN_TRAIT_IDS.SEARING_PACT,
          actorType: 'player',
          skillId: GUARDIAN_TRAIT_IDS.SEARING_PACT,
          skillName: 'Searing Pact',
          name: 'Searing Pact — Burning',
          condition: String(burning.condition),
          stacks: effectNumber(searingPactProfile, burning, 'stacks'),
          duration: effectNumber(searingPactProfile, burning, 'duration'),
          triggeredBy: 'Willbender Flames',
          ...(payload.offTarget === true ? { offTarget: true } : {})
        });
      }
    }
  }
});

/** Capture observation-time data and apply local state changes only when the queue reaches the impact. */
export const willbenderVirtueHitReaction = scheduledReaction<
  GuardianSchedulerContext,
  SimulationEvent,
  {
    readonly sourceSkillName: SimulationEvent['skillName'];
  }
>({
  id: 'guardian.willbender-virtue-hit',
  order: 40,
  select(_context, event) {
    // Only landed player-owned strikes count as virtue hits. Sigil of Air is the sole
    // non-player-actor source explicitly permitted because its proc is considered
    // "player damage" in-game even though its actor classification differs.
    if (
      event.type !== 'damage' ||
      event.offTarget === true ||
      !(Number(event.coefficient || 0) > 0) ||
      (!isGw2PlayerActorEvent(event) && event.sourceId !== 'sigil.air')
    ) {
      return null;
    }

    return {
      // eventOrder (monotone emission index) is preferred over at because multiple events
      // can share the same timestamp; using at alone would collapse them into one task id.
      id: `guardian.willbender-virtue-hit:${String(event.eventOrder ?? event.at)}`,
      at: Number(event.at),
      payload: {
        sourceSkillName: event.skillName
      }
    };
    return null;
  },
  execute(context, taskAt, payload) {
    const at = Number(taskAt);
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

      // Grant one party Might packet for the completed virtue trigger, never for the activation that opened its window.
      if (hasTrait(context, GUARDIAN_TRAIT_IDS.HOLY_RECKONING)) {
        const holyReckoningProfile = requireBalanceProfileFromContext(context, PROFILE.holyReckoning);
        const might = requireEffect(holyReckoningProfile, 'boon', 'might');
        if (might) {
          emitSkillBuff(context, {
            at,
            source: 'guardian',
            sourceId: GUARDIAN_TRAIT_IDS.HOLY_RECKONING,
            actorType: 'player',
            skillId: GUARDIAN_TRAIT_IDS.HOLY_RECKONING,
            skillName: 'Holy Reckoning',
            name: 'Holy Reckoning — Might',
            kind: 'might',
            stacks: effectNumber(holyReckoningProfile, might, 'stacks'),
            duration: gw2SchedulerBoonDuration(
              context,
              boonSourceSkill,
              'might',
              effectNumber(holyReckoningProfile, might, 'duration')
            ),
            audience: { recipients: 'party' as const },
            triggeredBy: sourceSkill
          });
        }
      }

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
        const courage = requireBalanceProfileFromContext(context, PROFILE.courageTrigger);
        for (const boon of (courage?.effects || []).filter((effect) => effect.type === 'boon')) {
          const kind = String(boon.boon);
          emitSkillBuff(context, {
            at,
            source: 'guardian',
            sourceId: ID.CRASHING_COURAGE,
            actorType: 'player',
            skillId: ID.CRASHING_COURAGE,
            skillName: 'Crashing Courage',
            name: `Crashing Courage — Triggered ${kind === 'aegis' ? 'Aegis' : 'Stability'}`,
            kind,
            stacks: effectNumber(courage, boon, 'stacks'),
            duration: gw2SchedulerBoonDuration(context, boonSourceSkill, kind, effectNumber(courage, boon, 'duration')),
            triggeredBy: sourceSkill
          });
        }
      }

      if (virtue === 'resolve' && hasTrait(context, GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL)) {
        const phoenixProtocolProfile = requireBalanceProfileFromContext(context, PROFILE.phoenixProtocol);
        const alacrity = requireEffect(phoenixProtocolProfile, 'boon', 'alacrity (triggered)');
        if (alacrity) {
          emitSkillBuff(context, {
            at,
            source: 'guardian',
            sourceId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
            actorType: 'player',
            skillId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
            skillName: 'Phoenix Protocol',
            name: 'Phoenix Protocol — Alacrity',
            kind: 'alacrity',
            stacks: effectNumber(phoenixProtocolProfile, alacrity, 'stacks'),
            duration: gw2SchedulerBoonDuration(
              context,
              boonSourceSkill,
              'alacrity',
              effectNumber(phoenixProtocolProfile, alacrity, 'duration')
            ),
            audience: {
              recipients: hasTrait(context, GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE) ? ('party' as const) : ('self' as const)
            },
            triggeredBy: sourceSkill
          });
        }
      }
    };

    for (const virtue of ['justice', 'resolve', 'courage'] as const) {
      // Match strike-before-expiry semantics; zero is an unarmed window, not an expiry-tick grant.
      const until = state[`${virtue}Until`];
      if (until <= 0 || at > until) continue;
      state.virtueHitCounts[virtue] += 1;
      // Permeating Wrath halves the justice trigger threshold (3 hits vs 5) but
      // only for justice; resolve and courage always require 5 hits.
      const triggerHits =
        virtue === 'justice' && hasTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH),
              'threshold'
            )
          : balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.virtueWindows), 'threshold');
      if (state.virtueHitCounts[virtue] < triggerHits) continue;
      state.virtueHitCounts[virtue] = 0;
      triggerVirtue(virtue, virtue === 'justice' ? 2 : undefined, virtue === 'justice' ? true : undefined);
    }
  }
});

/** Runs Willbender mechanics owned by one completed skill activation. */
export const willbenderSkillMechanicHandlers = Object.freeze({
  'guardian.willbender.arm-repose': ({ context, at }: { context: GuardianSchedulerContext; at: number }): void => {
    // Repose shares Core's exact flip clock rather than a tick-rounded buff lifetime.
    armSkillFlip(context.state.profession.core.availableFlips, ID.REPOSE, at, canonicalTime(at + 6));
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
      handler: willbenderVirtueHitReaction.onEventScheduled.handler
    }
  ]),
  taskHandlers: Object.freeze({
    'guardian.willbender-flame-activate': handleWillbenderFlameActivation,
    ...willbenderFlames.taskHandlers,
    ...willbenderVirtueHitReaction.taskHandlers
  })
});
