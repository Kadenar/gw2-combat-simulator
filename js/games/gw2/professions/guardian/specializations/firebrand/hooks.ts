import { CAST_READY, denyCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { createPassiveCourageTask } from '#gw2/professions/guardian/core/mechanics/passive-courage.js';
import { powerOfTheVirtuousRechargeMultiplier } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { justiceActivated, virtueActivated } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import {
  firebrandBuffApplied,
  firebrandControlAccepted,
  firebrandStruck,
  tomeOpened,
  tomeStowed
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/activations.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import {
  firebrandBuffPolicies,
  firebrandEffectStates
} from '#gw2/professions/guardian/specializations/firebrand/effect-state.js';
import {
  firebrandEffectTasks,
  startFirebrandAshes
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/effects.js';
import {
  FIREBRAND_MANTRA_WAKE,
  firebrandMantraActions,
  firebrandMantraAvailability,
  firebrandMantraWake,
  initializeFirebrandMantras,
  refreshFirebrandMantras
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/mantras.js';
import {
  emitAshes,
  reactToAshesHit,
  reactToTomeJusticeHit
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { stoicDemeanorRetainsCourage } from '#gw2/professions/guardian/specializations/firebrand/traits/behavior.js';
import { firebrandPageTuning } from '#gw2/professions/guardian/specializations/firebrand/traits/page-tuning.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
const COURAGE = 'guardian.firebrand.courage';
const DORMANCY = { justice: PROFILE.tomeJustice, resolve: PROFILE.tomeResolve, courage: PROFILE.tomeCourage };

/** Tome reopening changes only the current bar; it cannot restart a dormant passive or duplicate its activation traits. */
function openTome(runtime: Runtime, cast: RuntimeCast<GuardianSkill>, virtue: GuardianVirtue): void {
  const state = firebrandState.from(runtime);
  const ready = state.tomeDormantReadyAt[virtue] <= runtime.time;
  state.activeTome = virtue;

  if (ready) {
    const multiplier = powerOfTheVirtuousRechargeMultiplier(runtime);
    state.tomeDormantReadyAt[virtue] = canonicalTime(
      runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, DORMANCY[virtue]), 'cooldown') * multiplier
    );
    runtime.profession.core.virtueReadyAt[virtue] = state.tomeDormantReadyAt[virtue];
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
      actorType: 'player',
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
      transform: (event) => ({ ...boonCause, ...event, audience: { recipients: 'self' } })
    });
  }
});

/** Pages, tome sessions, and mantra charges mutate one live state; report events never restore a snapshot. */
export const firebrandHooks: RuntimeHooks<GuardianRuntimeState, GuardianSkill> = {
  buffPolicies: firebrandBuffPolicies,
  observeEffects: firebrandEffectStates,
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: [
    {
      id: 'ashes',
      name: 'Ashes of the Just',
      source: 'Profession',
      unit: 'charge',
      sourceIds: ['guardian.ashes-of-the-just'],
      emit: (runtime) => emitAshes(runtime, damageInputEvent(runtime))
    }
  ],

  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    if (skill?.tome) firebrandState.from(runtime).activeTome = skill.tome;
  },

  sideEffectHandlers: {
    ...firebrandMantraActions,
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
      runtime.fireTrigger(tomeStowed, { cast });
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...guardianCastCause(runtime, cast),
          type: 'weapon_set',
          weaponSet: runtime.activeWeaponSet,
          weaponLine: null
        }
      });
    },
    'guardian.start-ashes'(runtime, context) {
      if (context.kind === 'cast') startFirebrandAshes(runtime, context.cast);
    }
  },
  resources: {
    tomePages: {
      kind: 'discrete',
      state: (runtime) => firebrandState.from(runtime).tomePages,
      maximum: (runtime) => firebrandPageTuning(runtime).maximum,
      initial: (runtime) => firebrandPageTuning(runtime).initial,
      recovery: (runtime) => ({ interval: firebrandPageTuning(runtime).interval, amount: 1, start: 'first-spend' })
    }
  },
  initialize(runtime) {
    initializeFirebrandMantras(runtime);
    runtime.schedule(COURAGE, runtime.time, undefined, undefined, -200);
  },
  availability(runtime, skill) {
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

    return firebrandMantraAvailability(runtime, skill);
  },
  /** Full Renewed Focus completion follows Core's recharge reset and preserves the page recovery phase. */
  onCastCommit(runtime, cast) {
    if (cast.skill.id !== ID.RENEWED_FOCUS || castWasInterrupted(cast)) return;
    const state = firebrandState.from(runtime);
    runtime.resourceController.grant('tomePages', state.tomePages.maximum);
    state.tomeDormantReadyAt = { justice: runtime.time, resolve: runtime.time, courage: runtime.time };
  },
  onCooldownReset: refreshFirebrandMantras,
  reactions: {
    'damage.resolved'(runtime, event, details) {
      if (event.actorType === 'player' && ((details as NativeResolvedDamageDetails).hitContext?.damage ?? 0) > 0) {
        reactToAshesHit(runtime, event, details);
        runtime.fireTrigger(firebrandStruck, { cause: event, details });
      }

      reactToTomeJusticeHit(runtime, event, details);
    },
    'buff.applied'(runtime, event) {
      // Executed history is appended after dispatch; reproject once the applied Alacrity window is queryable.
      if (event.kind === 'alacrity') runtime.schedule(FIREBRAND_MANTRA_WAKE, runtime.time);
      runtime.fireTrigger(firebrandBuffApplied, { cause: event });
    },
    'control.resolved'(runtime, event) {
      runtime.fireTrigger(firebrandControlAccepted, { cause: event });
    },
    'condition.applied'(runtime, event) {
      if (event.condition === 'Immobilized' || event.condition === 'Slow')
        runtime.fireTrigger(firebrandControlAccepted, { cause: event });
    }
  },
  tasks: { ...firebrandEffectTasks, [COURAGE]: courage, [FIREBRAND_MANTRA_WAKE]: firebrandMantraWake }
};
