import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as deny } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceNumberFromContext,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { buildRangerPacket, buildRangerStrikes } from '#gw2/professions/ranger/core/events.js';
import { weaponSwapped } from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { perilousSkiesAvailability } from '#gw2/professions/ranger/specializations/galeshot/traits/behavior.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Player attacks and player-owned effect projectiles trigger Mistral and Shrike; pet projectiles stay excluded. */
export function reactToGaleshotMissile(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (
    event.type !== 'damage' ||
    (event.actorType !== 'player' && !(event.actorType === 'effect' && event.ownerActorType === 'player')) ||
    !(Number(event.coefficient) > 0) ||
    event.projectile !== true
  )
    return;

  applyMistral(context, event);
  context.fireTrigger(missileResolved, { event });
}

/** Path of Scars keeps the outgoing contact's enhancement on its return, without extending other projectiles' window. */
function applyMistral(context: RangerRuntime, event: Gw2ResolverEvent): void {
  const at = event.at;
  const state = galeshotState.from(context);
  // An armed Mistral includes missiles landing at expiry; zero never arms it.
  let enhanced = state.mistralUntil > 0 && at <= state.mistralUntil;

  if ((event.skillId === ID.PATH_OF_SCARS || event.skillId === ID.PATH_OF_SCARS_MAX_RANGE) && event.activationId) {
    if (event.hitIndex === 1 && enhanced) state.mistralPathOfScars[event.activationId] = true;

    if (event.hitIndex === event.totalHits) {
      enhanced ||= state.mistralPathOfScars[event.activationId];
      delete state.mistralPathOfScars[event.activationId];
    }
  }

  if (!enhanced) return;

  const profile = requireBalanceProfileFromContext(context, PROFILE.mistral);
  const strike = requireEffect(profile, 'strike', 'Strike');
  const chilled = requireEffect(profile, 'condition', 'Chilled');
  // Each missile-triggered Mistral is its own effect activation while its
  // strike and condition packets remain grouped under one identity.
  const activationId = strike || chilled ? 'mistral:' + event.eventOrder : undefined;

  if (strike)
    buildRangerStrikes(
      buildRangerPacket(
        {
          at: at,
          source: 'ranger',
          sourceId: ID.MISTRAL,
          actorType: 'player',
          skillId: ID.MISTRAL,
          skillName: 'Mistral',
          name: 'Mistral',
          coefficient: effectNumber(profile, strike, 'coefficient'),
          hits: effectNumber(profile, strike, 'hits'),
          canCrit: true,
          damageKind: 'galeshot-mistral',
          triggeredBy: event.skillName,
          activationId
        },
        'damage'
      )
    ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));

  if (chilled)
    context.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at: at,
          skillId: ID.MISTRAL,
          skillName: 'Mistral',
          name: 'Mistral - Chilled',
          condition: String(chilled.condition),
          duration: effectNumber(profile, chilled, 'duration'),
          stacks: effectNumber(profile, chilled, 'stacks'),
          triggeredBy: event.skillName,
          activationId
        },
        'condition'
      )
    });
}
// Gate Galeshot casts by Cyclone Bow ownership, arrows, Wind Force, and the
// Perilous Skies replacement before the shared Ranger checks run.

export function galeshotCastAvailability(
  context: MechanicQueriesOf<RangerRuntime>,
  skill: RangerSkill
): AvailabilityResult {
  const state = galeshotState.from(context);

  if (skill.cycloneBowSkill && !state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-inactive', 'summon the Cyclone Bow first.');
  }

  if (skill.id === ID.SUMMON_CYCLONE_BOW && state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-active', 'the Cyclone Bow is already active.');
  }

  if (skill.id === ID.DISMISS_CYCLONE_BOW && !state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-inactive', 'the Cyclone Bow is not active.');
  }

  if ((skill.arrowCost || 0) > state.arrows.value) {
    return deny(skill, 'ranger.arrows', `requires ${skill.arrowCost} arrows.`);
  }

  // Availability and the palette share the selected pool's cap, including isolated catalog overrides.
  const maximumWindForce = state.windForce.maximum;
  const windForce = context.resourceController.value('windForce');

  if (skill.id === ID.HAWKEYE && windForce < maximumWindForce) {
    return deny(skill, 'ranger.wind-force', `requires ${maximumWindForce} Wind Force.`);
  }

  if (skill.id === ID.KEEN_SHOT && windForce >= maximumWindForce) {
    return deny(skill, 'ranger.hawkeye-ready', `Hawkeye replaces Keen Shot at ${maximumWindForce} Wind Force.`);
  }

  const replacement = perilousSkiesAvailability(context, skill);

  if (replacement) return replacement;

  if (state.cycloneBowActive && skill.type === 'Weapon' && !skill.cycloneBowSkill) {
    return deny(skill, 'ranger.cyclone-bow-weapon-bar', 'the Cyclone Bow replaces weapon skills.');
  }

  return { ready: true };
}

/** The selected trait observes this accepted transition before subsequent mechanic work. */
export const missileResolved = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>('ranger.missile-resolved', [
  TRAIT.SHRIKE
]);

/** Wind Force starts empty; owned cast-relative tasks grant it without passive recovery. */
const galeshotWindForce: ResourcePolicy<RangerRuntime> = {
  kind: 'continuous',
  state: (context) => galeshotState.from(context).windForce,
  maximum: (context) => balanceNumberFromContext(context, PROFILE.resources, 'minimumStacks'),
  initial: () => 0,
  recovery: () => 0
};

/** Fixed-cadence arrows use the selected profile without profession-owned clock advancement. */
const galeshotArrows: ResourcePolicy<RangerRuntime> = {
  kind: 'discrete',
  state: (context) => galeshotState.from(context).arrows,
  maximum: (context) => balanceNumberFromContext(context, PROFILE.resources, 'maximumStacks'),
  initial: (context, maximum) => context.config.initialArrows ?? maximum,
  recovery: (context) => ({
    interval: balanceNumberFromContext(context, PROFILE.resources, 'pulseInterval'),
    amount: 1,
    start: 'immediate'
  })
};

/** Schedule at acceptance because authored tasks are registered too late for precommit Wind Force. */
export function scheduleWindForce(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const skill = cast.skill;

  if (!(Number(skill.windForceGain) > 0)) return;

  const at = canonicalTime(cast.start + Number(skill.windForceApplyMs ?? skill.castTimeMs) / 1000);

  if (!castWasInterrupted(cast) || at <= cast.effectiveEnd)
    runtime.schedule('ranger.wind-force', at, Number(skill.windForceGain));
}

/** Later projectiles consume this live window through the shared Mistral observer. */
function activateMistral(runtime: RangerRuntime): void {
  galeshotState.from(runtime).mistralUntil = canonicalTime(
    runtime.time + balanceNumberFromContext(runtime, PROFILE.mistral, 'duration')
  );
}

/** Keep bar state, dismiss-only resource clearing, chain reset, and swap notification ordered together. */
function setCycloneBow(runtime: RangerRuntime, skill: Skill, active: boolean): void {
  const state = galeshotState.from(runtime);
  state.cycloneBowActive = active;

  if (!active) runtime.resourceController.replace('windForce', 0);

  resetAutoattackChains(runtime);
  runtime.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      { at: runtime.time, skillId: skill.id, skillName: skill.name, weaponSet: runtime.activeWeaponSet },
      'weapon_set'
    )
  });
  runtime.fireTrigger(weaponSwapped, { skill: skill, at: runtime.time });
}

/** The selected trait observes this accepted transition before subsequent mechanic work. */
export const galeshotPetStrike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'ranger.galeshot-pet-strike',
  [TRAIT.WUTHERING_WIND]
);

/** The selected trait observes this accepted transition before subsequent mechanic work. */
export const galeshotControlAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'ranger.galeshot-control-accepted',
  [TRAIT.THRILL_OF_THE_CATCH]
);

/** The selected trait observes this accepted transition before subsequent mechanic work. */
export const galeshotCastCompleted = defineTriggerPoint<{ readonly skill: RangerSkill; readonly at: number }>(
  'ranger.galeshot-cast-completed',
  [TRAIT.FLOCK_TOGETHER]
);

/** Hawkeye grants its damage window and Bluster primes its pet strike before Cloudburst party boons. */
export const cycloneBowCompleted = defineTriggerPoint<{ readonly skill: RangerSkill; readonly at: number }>(
  'ranger.cyclone-bow-completed',
  [TRAIT.GALE_FORCE, TRAIT.WUTHERING_WIND, TRAIT.CLOUDBURST]
);

/** Keep bar transitions, arrow spending, delayed Wind Force, and ordered trait observations with Cyclone Bow. */
export const cycloneBowLifecycle: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    galeshotState.from(runtime).cycloneBowActive = Boolean(skill?.cycloneBowSkill);
  },
  resources: { arrows: galeshotArrows, windForce: galeshotWindForce },
  availability: galeshotCastAvailability,
  sideEffectHandlers: {
    'ranger.arrow-spend'(runtime, context) {
      runtime.resourceController.spend('arrows', Number(context.skill.arrowCost));
    },
    'ranger.hawkeye'(runtime) {
      runtime.resourceController.replace('windForce', 0);
    },
    'ranger.wind-force-start'(runtime, context) {
      if (context.kind === 'cast') scheduleWindForce(runtime, context.cast);
    },
    'ranger.mistral': activateMistral,
    'ranger.cyclone-bow-enter'(runtime, context) {
      setCycloneBow(runtime, context.skill, true);
    },
    'ranger.cyclone-bow-dismiss'(runtime, context) {
      setCycloneBow(runtime, context.skill, false);
    }
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;

    if (skill.cycloneBowSkill) runtime.fireTrigger(cycloneBowCompleted, { skill, at: runtime.time });

    runtime.fireTrigger(galeshotCastCompleted, { skill, at: runtime.time });
  },
  tasks: {
    // Scheduled rewards survive bar dismissal; only their original cast gate decides whether to enqueue them.
    'ranger.wind-force'(runtime, gain) {
      runtime.resourceController.grant('windForce', Number(gain));
    }
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      reactToGaleshotMissile(runtime, event);
      runtime.fireTrigger(galeshotPetStrike, { event });
    },
    'control.resolved'(runtime, event) {
      runtime.fireTrigger(galeshotControlAccepted, { event });
    }
  }
};
