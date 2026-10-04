import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { improvisationShadowForceMultiplier } from '#gw2/professions/thief/core/traits/steal.js';
import { amplifiedSiphoningGain, DARK_SENTRY } from '#gw2/professions/thief/specializations/specter/traits/behavior.js';

import { resourceDepletionAt } from '#gw2/platform/combat/resources/clock.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { EPSILON } from '#kernel/core/clock.js';

import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { gw2CooldownReadyAt } from '#gw2/platform/execution/cast-timing.js';
import { lockTransitionInput } from '#gw2/platform/execution/transition-lockouts.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { buildThiefBuff } from '#gw2/professions/thief/core/events.js';
import { completeThiefSteal } from '#gw2/professions/thief/core/mechanics/steal.js';
import { emitThiefStealTraits } from '#gw2/professions/thief/core/traits/steal.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';

import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const SHADOW_DEPLETED = 'thief.shadow-shroud-depleted';

/**
 * Every gain or rate change replaces the prior depletion wake; shroud exhaustion is detected on the same tick grid as
 * cooldowns so fractional drain is kept.
 */
function refreshShadowDepletion(runtime: ThiefRuntime): void {
  const state = specterState.from(runtime);
  runtime.cancelOwner({ id: SHADOW_DEPLETED, generation: state.shadowWakeGeneration });
  state.shadowWakeGeneration++;
  const at = gw2CooldownReadyAt(resourceDepletionAt(state.shadowClock));
  if (Number.isFinite(at))
    runtime.schedule(SHADOW_DEPLETED, at, null, { id: SHADOW_DEPLETED, generation: state.shadowWakeGeneration }, -10);
}

/** Specter supplies drain and capacity; the shared lifecycle advances and replaces the depletion deadline. */
const shadowForce: ResourcePolicy<ThiefRuntime> = {
  kind: 'continuous',
  state: (runtime) => specterState.from(runtime).shadowClock,
  maximum: (runtime) =>
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks'),
  initial: (runtime) => (runtime.config as ThiefConfig).initialShadowForce ?? 0,
  recovery: (runtime) => {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
    return specterState.from(runtime).shadowShroudActive
      ? -balanceProfileNumber(profile, 'maximumStacks') * balanceProfileNumber(profile, 'lifeForceDrain')
      : 0;
  },
  depletion: { refresh: refreshShadowDepletion, stop: refreshShadowDepletion }
};

/** Shroud transitions block input for their recovery and publish the bar change like a weapon swap. */
function setShadowShroud(runtime: ThiefRuntime, active: boolean, skill: { id: string | number; name: string }): void {
  lockTransitionInput(runtime, active ? 'shroudEntryMs' : 'shroudExitMs', skill);
  specterState.from(runtime).shadowShroudActive = active;
  runtime.resourceController.refresh('shadowForce');
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'weapon_set',
      at: runtime.time,
      source: 'thief',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      weaponSet: runtime.activeWeaponSet,
      shroudSwap: true
    }
  });
}

/** The surviving depletion wake forces the shroud closed with the exit transition's input lockout. */
function shadowDepleted(runtime: ThiefRuntime): void {
  const state = specterState.from(runtime);
  if (!state.shadowShroudActive) return;
  setShadowShroud(runtime, false, { id: SHADOW_DEPLETED, name: 'Exit Shadow Shroud' });
}

/** Dawn's Repose includes the caster; only allied recipients can trigger Dark Sentry. */
function grantBarrier(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  profileId: string | number,
  name: string
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const barrier = requireEffect(profile, 'buff', 'barrier');
  const affectsSelf = cast.skill.id === ID.DAWNS_REPOSE;
  const recipients = Math.min(
    balanceProfileNumber(profile, 'maximumTargets'),
    gw2AlliedPlayerAssumptions(runtime.config).count + Number(affectsSelf)
  );
  // Barrier removal also suppresses the barrier-triggered Dark Sentry reaction.
  if (!barrier || recipients <= 0) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefBuff(null, {
      at: runtime.time,
      source: 'thief',
      sourceId: cast.skill.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name,
      kind: 'barrier',
      duration: effectNumber(profile, barrier, 'duration'),
      stacks: effectNumber(profile, barrier, 'stacks'),
      audience: { recipients: 'party', affectsSelf, maximumRecipients: recipients },
      fixedDuration: true
    })
  });
  runtime.schedule(DARK_SENTRY, runtime.time, {
    allyIndices: Array.from({ length: recipients - Number(affectsSelf) }, (_, index) => index + 1)
  });
}

/** Siphon grants Shadow Force (Amplified Siphoning, then Improvisation) and completes as a choice-less steal. */
function completeSiphon(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  emitThiefStealTraits(runtime, cast);
  let gain =
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'lifeForceGain') +
    amplifiedSiphoningGain(runtime);
  gain *= improvisationShadowForceMultiplier(runtime);
  runtime.resourceController.grant('shadowForce', gain);
  completeThiefSteal(runtime, []);
}

/** Shroud entry needs force; inside the shroud only its own bar is castable, and exit waits out its lockout. */
function specterAvailability(runtime: MechanicQueriesOf<ThiefRuntime>, skill: ThiefSkill): AvailabilityResult {
  const state = specterState.from(runtime);
  if (skill.id === ID.ENTER_SHADOW_SHROUD) {
    if (state.shadowShroudActive) return denySkillCast(skill, 'thief.in-shroud', 'Shadow Shroud is already active.');
    if (runtime.resourceController.value('shadowForce') <= 0)
      return denySkillCast(skill, 'thief.shadow-force', 'requires shadow force.');
  }

  if (skill.id === ID.EXIT_SHADOW_SHROUD && !state.shadowShroudActive)
    return denySkillCast(skill, 'thief.not-in-shroud', 'Shadow Shroud is not active.');
  if (skill.id === ID.EXIT_SHADOW_SHROUD && state.shadowShroudExitReadyAt > runtime.time + EPSILON)
    return denySkillCast(
      skill,
      'thief.shroud-exit-lockout',
      'Shadow Shroud exit is not ready.',
      state.shadowShroudExitReadyAt
    );
  if (skill.shadowShroudSkill && !state.shadowShroudActive)
    return denySkillCast(skill, 'thief.not-in-shroud', 'enter Shadow Shroud first.');
  if (
    state.shadowShroudActive &&
    !skill.shadowShroudSkill &&
    (skill.type === 'Weapon' || ['Heal', 'Utility', 'Elite'].includes(skill.type || ''))
  )
    return denySkillCast(skill, 'thief.in-shroud', 'the Shadow Shroud bar replaces weapons and slot skills.');
  return { ready: true };
}

/** Specter hooks: Shadow Force and its shroud, Siphon, shroud skill traits, Dark Sentry, and Larcenous Torment. */
export const specterHooks: Partial<RuntimeProfession<ThiefRuntimeState, ThiefSkill>> = {
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    specterState.from(runtime).shadowShroudActive = Boolean(skill?.shadowShroudSkill);
  },

  sideEffectHandlers: {
    'thief.siphon'(runtime, context) {
      if (context.kind === 'cast') completeSiphon(runtime, context.cast);
    },
    'thief.enter-shadow-shroud'(runtime, context) {
      specterState.from(runtime).shadowShroudExitReadyAt = runtime.time + 0.5;
      setShadowShroud(runtime, true, context.skill);
    },
    'thief.exit-shadow-shroud'(runtime, context) {
      setShadowShroud(runtime, false, context.skill);
    },
    'thief.shroud-entry-barrier'(runtime, context) {
      if (context.kind === 'cast')
        grantBarrier(runtime, context.cast, PROFILE.enterShadowShroud, 'Enter Shadow Shroud - Barrier');
    },
    'thief.dawns-barrier'(runtime, context) {
      if (context.kind === 'cast')
        grantBarrier(runtime, context.cast, PROFILE.dawnsReposeBarrier, "Dawn's Repose - Barrier");
    }
  },
  // These shroud skills grant their own party boon; Dawn's declaration notifies Shade Step before its barrier.

  resources: { shadowForce },
  availability: specterAvailability,
  onCastStart(runtime, cast) {
    // Spent initiative converts into Shadow Force in parallel with Core's spend.
    const cost = cast.skill.initiativeCost || 0;
    if (cost > 0)
      runtime.resourceController.grant(
        'shadowForce',
        cost * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'resourceGain')
      );
  },
  onCooldownReset(runtime) {
    // The training-area reset refills Shadow Force without forcing Specter out of Shadow Shroud.
    runtime.resourceController.grant('shadowForce', specterState.from(runtime).shadowClock.maximum);
  },

  tasks: {
    [SHADOW_DEPLETED]: shadowDepleted
  }
};
