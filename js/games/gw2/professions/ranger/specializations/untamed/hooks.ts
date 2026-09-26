import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RangerRuntime, RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { untamedCastAvailability } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import {
  reactToUntamedControl,
  reactToUntamedDamage
} from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';

/** Each ambush window expires only its own grant, preserving the independent grant cooldown. */
function grantAmbush(runtime: RangerRuntime): void {
  const state = untamedState.from(runtime);
  state.ambushReadyUntil = canonicalTime(
    runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'durationMultiplier')
  );
  runtime.schedule('ranger.ambush-expiry', state.ambushReadyUntil, state.ambushReadyUntil);
}

export const untamedHooks: Partial<RuntimeProfession<RangerRuntimeState>> = {
  availability: untamedCastAvailability,
  onCastStart(runtime, cast) {
    // An attempted ambush consumes its occurrence even if its animation is canceled.
    if (cast.skill.unleashedAmbushSkill) untamedState.from(runtime).ambushReadyUntil = 0;
  },
  modifyEffects(runtime, cast, effects) {
    if (cast.skill.id === ID.EXPLODING_SPORES) {
      const ranger = untamedState.from(runtime).rangerUnleashed;
      const effect = requireEffect(
        requireBalanceProfileFromContext(runtime, ranger ? PROFILE.explodingSporesRanger : PROFILE.explodingSporesPet),
        'boon',
        ranger ? 'might' : 'protection'
      );
      return effect ? [...effects, { ...effect, timingAnchor: 'castEnd' as const, atMs: 0 }] : effects;
    }

    if (
      cast.skill.id === ID.VENOMOUS_OUTBURST &&
      (runtime.config.target?.defiant || runtime.config.target?.disabled || runtime.config.target?.defianceBroken)
    )
      return [
        ...effects,
        {
          type: 'condition',
          source: 'ranger-pet',
          actorType: 'summon',
          condition: 'Vulnerability',
          duration: 10,
          stacks: 8,
          timingAnchor: 'castStart',
          atMs: 0
        }
      ];
    return effects;
  },
  onCastComplete(runtime, cast) {
    if (castWasInterrupted(cast)) return;
    const state = untamedState.from(runtime);
    if (cast.skill.id === ID.UNLEASH_RANGER || cast.skill.id === ID.UNLEASH_PET) {
      state.rangerUnleashed = cast.skill.id === ID.UNLEASH_RANGER;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
      const readyAt = cast.start + balanceProfileNumber(profile, 'recharge');
      runtime.cooldownController.setReadyAt(ID.UNLEASH_RANGER, readyAt);
      runtime.cooldownController.setReadyAt(ID.UNLEASH_PET, readyAt);
      if (state.rangerUnleashed && isInternalCooldownReady(runtime.time, state.unleashedPowerReadyAt)) {
        state.unleashedPowerReadyAt = runtime.time + balanceProfileNumber(profile, 'internalCooldown');
        grantAmbush(runtime);
      }
    }

    if (
      cast.skill.id === ID.SWAP_WEAPONS &&
      runtime.combatActive &&
      hasTrait(runtime, TRAIT.LET_LOOSE) &&
      isInternalCooldownReady(runtime.time, state.letLooseReadyAt)
    ) {
      state.letLooseReadyAt =
        runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.letLoose), 'internalCooldown');
      state.unleashedPowerReadyAt = 0;
      if (state.rangerUnleashed) grantAmbush(runtime);
    }
  },
  tasks: {
    'ranger.ambush-expiry'(runtime, deadline) {
      if (untamedState.from(runtime).ambushReadyUntil === deadline) untamedState.from(runtime).ambushReadyUntil = 0;
    }
  },
  reactions: { 'damage.resolved': reactToUntamedDamage, 'control.resolved': reactToUntamedControl }
};
