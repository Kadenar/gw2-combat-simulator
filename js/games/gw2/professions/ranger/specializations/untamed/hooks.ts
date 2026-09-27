import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RangerRuntime, RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { untamedCastAvailability } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { reactToUntamedDamage } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';

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
  // Accepted Venomous Outburst strikes retain player ownership for the trait's Blindness.
  traitTriggers: [
    // Pure state selection shares one profile ICD across the mutually exclusive packets.
    ...(
      [
        [TRAIT.DEBILITATING_BLOWS, PROFILE.debilitatingBlows, 'Debilitating Blows', 'condition', 'Poisoned', true],
        [TRAIT.DEBILITATING_BLOWS, PROFILE.debilitatingBlows, 'Debilitating Blows', 'condition', 'Slow', false],
        [TRAIT.ENHANCING_IMPACT, PROFILE.enhancingImpact, 'Enhancing Impact', 'boon', 'quickness', true],
        [TRAIT.ENHANCING_IMPACT, PROFILE.enhancingImpact, 'Enhancing Impact', 'boon', 'stability', false]
      ] as const
    ).map<Exclude<TraitTrigger<RangerRuntimeState>, { on: 'castStart' | 'castCommit' }>>(
      ([trait, emit, name, type, effectName, unleashed]) => ({
        trait,
        emit,
        on: 'control.resolved',
        icd: 'profile',
        when: (runtime, event) =>
          (isPlayerStrike(event) || isPetStrike(event)) &&
          untamedState.from(runtime).rangerUnleashed === unleashed &&
          Boolean(requireEffect(requireBalanceProfileFromContext(runtime, emit), type, effectName)),
        effects: (effect) => effect.type === type && effect.name === effectName,
        attribution: (_runtime, event) => ({
          skillId: trait,
          skillName: name,
          name: `${name} - ${effectName}`,
          ...(type === 'condition' ? { ownerActorType: 'player' as const } : {}),
          triggeredBy: event.skillName
        })
      })
    ),
    {
      trait: TRAIT.BLINDING_OUTBURST,
      on: 'damage.resolved',
      when: (_runtime, event) =>
        event.skillId === ID.VENOMOUS_OUTBURST &&
        Number(event.coefficient) > 0 &&
        (isPlayerStrike(event) || isPetStrike(event)),
      emit: PROFILE.blindingOutburst,
      effects: (effect) => effect.type === 'condition' && effect.name === 'Blindness',
      attribution: (_runtime, event) => ({
        ownerActorType: 'player',
        skillId: TRAIT.BLINDING_OUTBURST,
        skillName: 'Blinding Outburst',
        name: 'Blinding Outburst - Blindness',
        triggeredBy: event.skillName
      })
    }
  ],
  availability: untamedCastAvailability,
  onCastStart(runtime, cast) {
    // An attempted ambush consumes its occurrence even if its animation is canceled.
    if (cast.skill.unleashedAmbushSkill) untamedState.from(runtime).ambushReadyUntil = 0;
  },
  onCastCommit(runtime, cast) {
    if (cast.cancelled) return;
    const state = untamedState.from(runtime);
    if (cast.skill.id === ID.UNLEASH_RANGER || cast.skill.id === ID.UNLEASH_PET) {
      state.rangerUnleashed = cast.skill.id === ID.UNLEASH_RANGER;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
      const readyAt = cast.start + balanceProfileNumber(profile, 'recharge');
      runtime.cooldownController.setReadyAt(ID.UNLEASH_RANGER, readyAt);
      runtime.cooldownController.setReadyAt(ID.UNLEASH_PET, readyAt);
      if (
        state.rangerUnleashed &&
        isInternalCooldownReady(runtime.time, runtime.procs.deadline('ranger.untamed.unleashedPower'))
      ) {
        runtime.procs.readyAt['ranger.untamed.unleashedPower'] =
          runtime.time + balanceProfileNumber(profile, 'internalCooldown');
        grantAmbush(runtime);
      }
    }

    if (
      cast.skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS &&
      runtime.combatActive &&
      hasTrait(runtime, TRAIT.LET_LOOSE) &&
      isInternalCooldownReady(runtime.time, runtime.procs.deadline('ranger.untamed.letLoose'))
    ) {
      runtime.procs.readyAt['ranger.untamed.letLoose'] =
        runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.letLoose), 'internalCooldown');
      runtime.procs.readyAt['ranger.untamed.unleashedPower'] = 0;
      if (state.rangerUnleashed) grantAmbush(runtime);
    }
  },
  tasks: {
    'ranger.ambush-expiry'(runtime, deadline) {
      if (untamedState.from(runtime).ambushReadyUntil === deadline) untamedState.from(runtime).ambushReadyUntil = 0;
    }
  },
  reactions: { 'damage.resolved': reactToUntamedDamage }
};
