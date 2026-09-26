import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { castWasInterrupted, gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { denySkillCast as deny } from '#gw2/professions/shared/availability.js';
import type { RuntimeProfession, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { RangerRuntime, RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import { emitRangerBuff, rangerEvent } from '#gw2/professions/ranger/core/events.js';
import { applyRangerWeaponSwapTraits } from '#gw2/professions/ranger/core/traits/index.js';
import {
  reactToDruidCondition,
  reactToDruidControl
} from '#gw2/professions/ranger/specializations/druid/traits/blood-moon.js';

/** Avatar changes the one resource clock and bar; expiration cannot retire a later entry. */
function avatar(runtime: RangerRuntime, active: boolean, exhausted = false): void {
  const state = druidState.from(runtime);
  if (state.celestialAvatarActive === active) return;
  state.celestialAvatarActive = active;
  const duration = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.resources),
    'durationMultiplier'
  );
  state.celestialAvatarEndsAt = active ? canonicalTime(runtime.time + duration) : 0;
  runtime.resourceController.refresh('astralForce');
  if (active) {
    armSkillFlip(
      runtime.profession.core.availableFlips,
      ID.RELEASE_CELESTIAL_AVATAR,
      runtime.time,
      state.celestialAvatarEndsAt
    );
  } else {
    consumeSkillFlip(runtime.profession.core.availableFlips, ID.RELEASE_CELESTIAL_AVATAR);
    const retained = exhausted
      ? 0
      : balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, PROFILE.resources),
          'astralForceRetentionMultiplier'
        );
    runtime.resourceController.spend('astralForce', state.astralClock.value * (1 - retained));
  }

  if (hasTrait(runtime, TRAIT.NATURAL_BALANCE)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.naturalBalance);
    const effect = requireEffect(profile, 'buff', 'natural-balance');
    if (effect)
      emitRangerBuff(
        runtime,
        rangerEvent(
          {
            at: runtime.time,
            source: 'Trait',
            sourceId: TRAIT.NATURAL_BALANCE,
            skillId: TRAIT.NATURAL_BALANCE,
            skillName: 'Natural Balance',
            kind: String(effect.kind),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks')
          },
          'buff'
        )
      );
  }

  resetAutoattackChains(runtime);
  const skill = runtime.helpers.skillsById.get(active ? ID.CELESTIAL_AVATAR : ID.RELEASE_CELESTIAL_AVATAR)!;
  runtime.emit(
    rangerEvent(
      { at: runtime.time, skillId: skill.id, skillName: skill.name, weaponSet: runtime.activeWeaponSet },
      'sigil_swap'
    )
  );
  applyRangerWeaponSwapTraits(runtime, skill);
}

/** Trait packets retain their cast-relative pulse times and are filtered by the shared interruption owner. */
function avatarEffects(
  runtime: RangerRuntime,
  cast: RuntimeCast,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (!cast.skill.celestialAvatarSkill) return effects;
  const pulses = cast.skill.id === ID.NATURAL_CONVERGENCE ? [520, 1160, 1640, 2040] : [0];
  const result = [...effects];
  if (hasTrait(runtime, TRAIT.GRACE_OF_THE_LAND)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.graceOfTheLand);
    const effect = requireEffect(profile, 'boon', 'alacrity');
    if (effect)
      for (const atMs of pulses)
        result.push({
          ...effect,
          source: 'Trait',
          sourceId: TRAIT.GRACE_OF_THE_LAND,
          skillName: 'Grace of the Land',
          actorType: 'effect',
          timingAnchor: 'castStart',
          interruptCommitMs: 0,
          atMs
        });
  }

  if (!hasTrait(runtime, TRAIT.ECLIPSE)) return result;
  const names = new Map<number, string>([
    [ID.COSMIC_RAY, 'Cosmic Ray'],
    [ID.SEED_OF_LIFE, 'Seed of Life'],
    [ID.LUNAR_IMPACT, 'Lunar Impact'],
    [ID.REJUVENATING_TIDES, 'Rejuvenating Tides']
  ]);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.eclipse);
  for (const [i, atMs] of pulses.entries()) {
    const name =
      cast.skill.id === ID.NATURAL_CONVERGENCE
        ? i === pulses.length - 1
          ? 'Natural Convergence final pulse'
          : 'Natural Convergence'
        : names.get(Number(cast.skill.id));
    if (!name) continue;
    const effect = requireEffect(profile, 'condition', name);
    if (effect)
      result.push({
        ...effect,
        source: 'Trait',
        sourceId: TRAIT.ECLIPSE,
        skillName: 'Eclipse',
        actorType: 'effect',
        ownerActorType: 'player',
        interruptCommitMs: 0,
        timingAnchor: cast.skill.id === ID.LUNAR_IMPACT ? 'castEnd' : 'castStart',
        atMs
      });
  }

  return result;
}

export const druidHooks: Partial<RuntimeProfession<RangerRuntimeState>> = {
  resources: {
    astralForce: {
      kind: 'continuous',
      state: (runtime) => druidState.from(runtime).astralClock,
      maximum: (runtime) =>
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks'),
      initial: (runtime, maximum) => Number((runtime as RangerRuntime).config.initialAstralForce ?? maximum),
      recovery(runtime) {
        const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
        const duration = balanceProfileNumber(profile, 'durationMultiplier');
        return druidState.from(runtime).celestialAvatarActive && duration > 0
          ? -balanceProfileNumber(profile, 'maximumStacks') / duration
          : 0;
      },
      nextChange(runtime) {
        const state = druidState.from(runtime);
        state.pendingHitTimes = state.pendingHitTimes.filter((at) => at > runtime.time);
        return Math.min(state.naturalMenderAt, ...state.pendingHitTimes);
      },
      depletion: {
        // Any live spend or rate change replaces the pending deadline; stale wakes cannot end a newer lifetime.
        refresh(runtime) {
          const state = druidState.from(runtime);
          const next = state.celestialAvatarActive
            ? canonicalTime(
                Math.min(
                  state.celestialAvatarEndsAt,
                  state.astralClock.rate < 0
                    ? runtime.time + state.astralClock.value / -state.astralClock.rate
                    : Infinity
                )
              )
            : Infinity;
          if (next === state.avatarDepletionAt) return;
          state.avatarDepletionAt = next;
          if (Number.isFinite(next)) runtime.schedule('ranger.avatar-exit', next, next);
        },
        stop(runtime) {
          druidState.from(runtime).avatarDepletionAt = Infinity;
        }
      }
    }
  },
  initialize(runtime) {
    const interval = hasTrait(runtime, TRAIT.NATURAL_MENDER)
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.naturalMender), 'pulseInterval')
      : 0;
    if (interval > 0) {
      druidState.from(runtime).naturalMenderAt = gw2CooldownReadyAt(interval);
      runtime.schedule('ranger.natural-mender', druidState.from(runtime).naturalMenderAt, interval, undefined, -1);
    }
  },
  prepareEvent(runtime, event) {
    // Pending impacts provide retry boundaries, never predicted force; only landed hits grant the resource.
    if (
      event.type === 'damage' &&
      event.at > runtime.time &&
      !event.cancelled &&
      !event.offTarget &&
      event.actorType !== 'summon' &&
      event.ownerActorType !== 'summon' &&
      !event.independentSummonStrike
    )
      druidState.from(runtime).pendingHitTimes.push(event.at);
    return event;
  },
  availability(runtime, skill) {
    const state = druidState.from(runtime);
    if ((skill.celestialAvatarSkill || skill.id === ID.RELEASE_CELESTIAL_AVATAR) && !state.celestialAvatarActive)
      return deny(skill, 'ranger.avatar-inactive', 'enter Celestial Avatar first.');
    if (skill.id === ID.CELESTIAL_AVATAR) {
      if (state.celestialAvatarActive)
        return deny(skill, 'ranger.avatar-active', 'Celestial Avatar is already active.');
      if (state.astralClock.value < state.astralClock.maximum)
        return {
          ready: false,
          retryAt: runtime.resourceController.readyAt('astralForce', state.astralClock.maximum),
          code: 'ranger.astral-force',
          reason: 'Celestial Avatar requires full astral force.'
        };
    }

    if (state.celestialAvatarActive && skill.type === 'Weapon' && !skill.celestialAvatarSkill)
      return deny(skill, 'ranger.avatar-weapon-bar', 'Celestial Avatar replaces weapon skills.');
    return { ready: true };
  },
  modifyEffects: avatarEffects,
  onCastComplete(runtime, cast) {
    if (castWasInterrupted(cast)) return;
    if (cast.skill.id === ID.CELESTIAL_AVATAR) avatar(runtime, true);
    if (cast.skill.id === ID.RELEASE_CELESTIAL_AVATAR) avatar(runtime, false);
  },
  tasks: {
    'ranger.avatar-exit'(runtime, deadline) {
      if (druidState.from(runtime).avatarDepletionAt === deadline) avatar(runtime, false, true);
    },
    'ranger.natural-mender'(runtime, data) {
      const deadline = Number(data);
      const state = druidState.from(runtime);
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.naturalMender);
      if (!state.celestialAvatarActive)
        runtime.resourceController.grant('astralForce', balanceProfileNumber(profile, 'resourceGain'));
      const interval = balanceProfileNumber(profile, 'pulseInterval');
      state.naturalMenderAt = interval > 0 ? gw2CooldownReadyAt(deadline + interval) : Infinity;
      if (interval > 0)
        runtime.schedule('ranger.natural-mender', state.naturalMenderAt, deadline + interval, undefined, -1);
    }
  },
  reactions: {
    'control.resolved': reactToDruidControl,
    'condition.applied': reactToDruidCondition,
    'damage.resolved'(runtime, event) {
      if (
        druidState.from(runtime).celestialAvatarActive ||
        event.actorType === 'summon' ||
        event.ownerActorType === 'summon' ||
        event.source === 'ranger-pet' ||
        event.independentSummonStrike
      )
        return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
      runtime.resourceController.grant(
        'astralForce',
        balanceProfileNumber(profile, 'resourceGain') *
          (hasTrait(runtime, TRAIT.ECLIPSE) ? balanceProfileNumber(profile, 'coefficientMultiplier') : 1)
      );
    }
  }
};
