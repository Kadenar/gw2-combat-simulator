import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { CAST_READY, denyCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/execution.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import {
  applyGuardianVirtueActivationTraits,
  powerOfTheVirtuousRechargeMultiplier,
  triggerGuardianFuriousFocus
} from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
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
import { emitAshes, reactToAshesHit } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import {
  activateSwiftScholar,
  firebrandPageTuning,
  reactToFirebrandBuff,
  reactToFirebrandControl,
  reactToFirebrandJusticeHit,
  reactToUnrelentingCriticism,
  resetSwiftScholar,
  stoicDemeanorRetainsCourage
} from '#gw2/professions/guardian/specializations/firebrand/traits/behavior.js';
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
  resetSwiftScholar(runtime, virtue);

  if (ready) {
    const multiplier = powerOfTheVirtuousRechargeMultiplier(runtime);
    state.tomeDormantReadyAt[virtue] = canonicalTime(
      runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, DORMANCY[virtue]), 'cooldown') * multiplier
    );
    runtime.profession.core.virtueReadyAt[virtue] = state.tomeDormantReadyAt[virtue];
    applyGuardianVirtueActivationTraits(runtime, cast, virtue);
    if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
    activateSwiftScholar(runtime, cast);
  }

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

/** Passive Courage keeps a single fixed cadence; dormancy suppresses individual pulses without shifting the grid. */
function courage(runtime: Runtime): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.passiveCourage);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  if (!(interval > 0) || !requireEffect(profile, 'boon', 'aegis')) return;
  if (runtime.profession.core.virtueReadyAt.courage <= runtime.time || stoicDemeanorRetainsCourage(runtime)) {
    const boonProfile = requireBalanceProfileFromContext(runtime, PROFILE.passiveCourage);
    const selectedBoon = requireEffect(boonProfile, 'boon', 'aegis');
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
    if (selectedBoon) {
      runtime.effects.emit({
        kind: 'profile',
        profile: boonProfile,
        effects: [selectedBoon],
        attribution: boonCause,
        cause: boonCause,
        transform: (event) => ({ ...boonCause, ...event, audience: { recipients: 'self' } })
      });
    }
  }

  runtime.schedule(COURAGE, canonicalTime(runtime.time + interval), undefined, undefined, -200);
}

/** Pages, tome sessions, and mantra charges mutate one live state; report events never restore a snapshot. */
export const firebrandHooks: Partial<RuntimeProfession<GuardianRuntimeState, GuardianSkill>> = {
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
      resetSwiftScholar(runtime);
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
  onCooldownReset: refreshFirebrandMantras,
  reactions: {
    'damage.resolved'(runtime, event, details) {
      if (event.actorType === 'player' && ((details as NativeResolvedDamageDetails).hitContext?.damage ?? 0) > 0) {
        reactToAshesHit(runtime, event, details);
        reactToUnrelentingCriticism(runtime, event, details);
      }

      reactToFirebrandJusticeHit(runtime, event, details);
    },
    'buff.applied'(runtime, event) {
      // Executed history is appended after dispatch; reproject once the applied Alacrity window is queryable.
      if (event.kind === 'alacrity') runtime.schedule(FIREBRAND_MANTRA_WAKE, runtime.time);
      reactToFirebrandBuff(runtime, event);
    },
    'control.resolved': reactToFirebrandControl,
    'condition.applied'(runtime, event) {
      if (event.condition === 'Immobilized' || event.condition === 'Slow') reactToFirebrandControl(runtime, event);
    }
  },
  tasks: { ...firebrandEffectTasks, [COURAGE]: courage, [FIREBRAND_MANTRA_WAKE]: firebrandMantraWake }
};
