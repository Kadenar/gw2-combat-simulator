import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { CAST_READY, denyCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { balanceNumberFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { createPassiveCourageTask } from '#gw2/professions/guardian/core/mechanics/passive-courage.js';
import {
  justiceActivated,
  reactToJusticeHitWithOptions,
  virtueActivated
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { powerOfTheVirtuousRechargeMultiplier } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import {
  tomeOpened,
  tomeStowed
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import {
  quickfireRetainsTomePassive,
  stoicDemeanorRetainsCourage
} from '#gw2/professions/guardian/specializations/firebrand/traits/behavior.js';
import { firebrandPageTuning } from '#gw2/professions/guardian/specializations/firebrand/traits/page-tuning.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianRuntime,
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** The tome passive tracks the shared Justice hit counter; Quickfire keeps it through dormancy. */
export function reactToTomeJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: quickfireRetainsTomePassive(context),
    skillId: ID.TOME_OF_JUSTICE,
    skillName: 'Tome of Justice',
    // Tome passive Burning starts at one second; Amplified Wrath applies separately.
    passiveBurnDuration: 1
  });
}

const COURAGE = 'guardian.firebrand.courage';

const DORMANCY = { justice: PROFILE.tomeJustice, resolve: PROFILE.tomeResolve, courage: PROFILE.tomeCourage };

/** Tome reopening changes only the current bar; it cannot restart a dormant passive or duplicate its activation traits. */
function openTome(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>, virtue: GuardianVirtue): void {
  const state = firebrandState.from(runtime);
  // Tome activation and passive eligibility share Core's deadline, independently of skill cooldowns.
  const readyAt = runtime.profession.core.virtueReadyAt;
  const ready = readyAt[virtue] <= runtime.time;
  state.activeTome = virtue;

  if (ready) {
    const multiplier = powerOfTheVirtuousRechargeMultiplier(runtime);
    readyAt[virtue] = canonicalTime(
      runtime.time + balanceNumberFromContext(runtime, DORMANCY[virtue], 'cooldown') * multiplier
    );
    runtime.fireTrigger(virtueActivated, { cast, virtue });

    if (virtue === 'justice') runtime.fireTrigger(justiceActivated, { cast });
  }

  runtime.fireTrigger(tomeOpened, { cast, virtue, ready });
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...guardianCastCause(runtime, cast),
      type: 'weapon_set',
      weaponSet: runtime.activeWeaponSet,
      weaponLine: cast.skill.name
    }
  });
}

/** Firebrand retains its passive during Stoic Demeanor and delivers the authored profile only to self. */
const courage = createPassiveCourageTask({
  taskId: COURAGE,
  profileId: PROFILE.passiveCourage,
  interval: (_runtime, profile) => balanceProfileNumber(profile, 'pulseInterval'),
  ready: (runtime) =>
    runtime.profession.core.virtueReadyAt.courage <= runtime.time || stoicDemeanorRetainsCourage(runtime),
  deliver(runtime, profile, effect) {
    const boonCause: Gw2ResolverEvent = {
      type: 'buff',
      at: runtime.time,
      source: 'guardian',
      sourceId: ID.TOME_OF_COURAGE,
      actorType: ACTOR.PLAYER,
      skillId: ID.TOME_OF_COURAGE,
      skillName: 'Tome of Courage',
      name: 'Tome of Courage — Passive Aegis'
    };
    runtime.effects.emit({
      kind: 'profile',
      profile,
      effects: [effect],
      attribution: boonCause,
      cause: boonCause,
      transform: (event) => ({ ...boonCause, ...event, audience: { recipients: RECIPIENT.SELF } })
    });
  }
});

/** Declarations select these actions; their state transitions stay with the mechanic owner. */
const firebrandTomeActions: NonNullable<RuntimeHooks<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers']> = {
  // Declarations select the virtue; the controller retains dormancy and session invariants.
  'guardian.open-justice'(runtime, context) {
    if (context.kind === 'cast') openTome(runtime, context.cast, 'justice');
  },
  'guardian.open-resolve'(runtime, context) {
    if (context.kind === 'cast') openTome(runtime, context.cast, 'resolve');
  },
  'guardian.open-courage'(runtime, context) {
    if (context.kind === 'cast') openTome(runtime, context.cast, 'courage');
  },
  'guardian.stow-tome'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    const state = firebrandState.from(runtime);
    state.activeTome = '';
    runtime.fireTrigger(tomeStowed, {});
    runtime.effects.emit({
      kind: 'packet',
      event: {
        ...guardianCastCause(runtime, cast),
        type: 'weapon_set',
        weaponSet: runtime.activeWeaponSet,
        weaponLine: null
      }
    });
  }
};

/** Tome gates return readiness for active pages and leave unrelated skills to their own availability rules. */
export function firebrandTomeAvailability(
  runtime: MechanicQueriesOf<GuardianRuntime>,
  skill: GuardianSkill
): AvailabilityResult | null {
  const state = firebrandState.from(runtime);

  if (skill.type === 'Weapon' && state.activeTome)
    return denyCast('guardian.tome-weapon-lockout', `${skill.name} requires stowing the active tome.`);

  if (skill.id === ID.STOW_TOME && !state.activeTome)
    return denyCast('guardian.tome-inactive', 'Stow Tome requires an active tome.');

  if (skill.tome) {
    if (skill.tome !== state.activeTome)
      return denyCast('guardian.tome-inactive', `${skill.name} requires its tome to be active.`);

    return CAST_READY;
  }

  return null;
}

/** Pages recover from their first spend; opening or stowing a tome does not restart their clock. */
const firebrandTomePages: ResourcePolicy<GuardianRuntime> = {
  kind: 'discrete',
  state: (runtime) => firebrandState.from(runtime).tomePages,
  maximum: (runtime) => firebrandPageTuning(runtime).maximum,
  initial: (runtime) => firebrandPageTuning(runtime).initial,
  recovery: (runtime) => ({ interval: firebrandPageTuning(runtime).interval, amount: 1, start: 'first-spend' })
};

/** Completed Renewed Focus restores pages without moving their recovery phase. */
function refillFirebrandTomePages(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
  if (cast.skill.id !== ID.RENEWED_FOCUS || castWasInterrupted(cast)) return;

  const state = firebrandState.from(runtime);
  runtime.resourceController.grant('tomePages', state.tomePages.maximum);
}

/** Begin the tome's passive courage schedule after module initialization has prepared its other resources. */
export function initializeFirebrandTomes(runtime: GuardianRuntime): void {
  runtime.schedule(COURAGE, runtime.time, undefined, undefined, -200);
}

/** Keep passive tome work registered with the same session and dormancy owner. */
const firebrandTomeTasks: NonNullable<RuntimeHooks<GuardianRuntimeState, GuardianSkill>['tasks']> = {
  [COURAGE]: courage
};

/** Tome actions, page resources, scheduled page work, and Renewed Focus refills share one owner. */
export const firebrandTomeLifecycle = {
  sideEffectHandlers: firebrandTomeActions,
  tasks: firebrandTomeTasks,
  resources: { tomePages: firebrandTomePages },
  /** Core resets virtue dormancy; full Renewed Focus completion refills pages without moving their recovery phase. */
  onCastCommit: refillFirebrandTomePages
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
