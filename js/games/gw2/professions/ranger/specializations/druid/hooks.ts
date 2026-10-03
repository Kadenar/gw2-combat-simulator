import { denySkillCast as deny } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { applyRangerWeaponSwapTraits } from '#gw2/professions/ranger/core/traits/behavior.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import {
  applyNaturalBalance,
  avatarEffects,
  eclipseAstralForceMultiplier
} from '#gw2/professions/ranger/specializations/druid/traits/behavior.js';
import type { RangerSkill, RangerRuntime, RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

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

  applyNaturalBalance(runtime);

  resetAutoattackChains(runtime);
  const skill = runtime.helpers.skillsById.get(active ? ID.CELESTIAL_AVATAR : ID.RELEASE_CELESTIAL_AVATAR)!;
  runtime.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      { at: runtime.time, skillId: skill.id, skillName: skill.name, weaponSet: runtime.activeWeaponSet },
      'sigil_swap'
    )
  });
  applyRangerWeaponSwapTraits(runtime, skill);
}

export const druidHooks: Partial<RuntimeProfession<RangerRuntimeState, RangerSkill>> = {
  resources: {
    astralForce: {
      kind: 'continuous',
      state: (runtime) => druidState.from(runtime).astralClock,
      maximum: (runtime) =>
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks'),
      initial: (runtime, maximum) => (runtime as RangerRuntime).config.initialAstralForce ?? maximum,
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
  sideEffectHandlers: {
    'ranger.avatar-enter'(runtime) {
      avatar(runtime, true);
    },
    'ranger.avatar-release'(runtime) {
      avatar(runtime, false);
    }
  },
  tasks: {
    'ranger.avatar-exit'(runtime, deadline) {
      if (druidState.from(runtime).avatarDepletionAt === deadline) avatar(runtime, false, true);
    }
  },
  reactions: {
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
        balanceProfileNumber(profile, 'resourceGain') * eclipseAstralForceMultiplier(runtime)
      );
    }
  }
};
