import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { guardianResolverState } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianRuntimeState
} from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Canonical Core guardian skill fragments grouped by their GW2 owner. */

export const GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.JURISDICTION]: {
    castTimeMs: 800,
    interruptCommitMs: 640,
    cooldown: 20,
    // Keep the projectile's strike, Burning, and stun on one committed impact.
    effects: impactEffects(
      { atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 3,
          projectile: true
        },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 5,
          duration: 6
        },
        {
          type: 'control',
          controlKind: 'stun'
        }
      ]
    )
  },
  [ID.HAIL_OF_JUSTICE]: {
    castTimeMs: 1120,
    // Cancelling the channel keeps landed hits and their conditions, while dropping later packets.
    interruptMode: 'per-packet',
    cooldown: 10,
    ammo: 2,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.3,
          projectile: true
        }))
      },
      {
        type: 'condition',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 8,
          projectile: true
        }))
      },
      {
        type: 'condition',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: 'Crippled',
          stacks: 1,
          duration: 1,
          projectile: true
        }))
      }
    ])
  },
  [ID.PEACEKEEPER]: {
    // EVTC impact offsets keep Burning aligned with each strike.
    castTimeMs: 1040,
    interruptCommitMs: 960,
    cooldown: 6,
    rechargeAnchor: 'castStart',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [280, 480, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.25
        }))
      },
      // Each strike applies the same Burning packet at its impact time.
      ...[280, 480, 640, 800, 960].map((atMs) => ({
        type: 'condition' as const,
        ticks: [{ atMs, condition: 'Burning', stacks: 1, duration: 1.5 }]
      }))
    ])
  },
  [ID.SYMBOL_OF_IGNITION]: {
    // Placement opens the shared ignition observer only after commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.place-ignition' } }],
    castTimeMs: 360,
    interruptCommitMs: 320,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: 'Light',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [280, 960, 1640, 2320, 3000].map((atMs) => ({
          atMs,
          coefficient: 0.4
        }))
      },
      ...[280, 960, 1640, 2320, 3000].map((atMs) => ({
        type: 'boon' as const,
        boon: 'might',
        stacks: 1,
        duration: 5,
        audience: { recipients: 'party' as const },
        atMs
      }))
    ])
  },
  [ID.THROUGH_THE_HEART]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 360,
    // Keep the projectile strike and Bleeding on one committed impact.
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.6,
          projectile: true
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 1,
          duration: 8,
          projectile: true
        }
      ]
    )
  }
});

/** Selected field duration is shared by placement and the public combo field. */
export function guardianIgnitionFields(runtime: Gw2Runtime<GuardianRuntimeState>): Skill['comboFields'] {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.symbolOfIgnition);
  const field = requireEffect(profile, 'buff', 'guardian-symbol-of-ignition-field');
  return field
    ? [
        {
          ownerId: 'guardian',
          fieldType: 'Light',
          duration: effectNumber(profile, field, 'duration'),
          startAnchor: 'castEnd'
        }
      ]
    : [];
}

export const guardianIgnitionActions: RuntimeProfession<GuardianRuntimeState>['sideEffectHandlers'] = {
  'guardian.place-ignition'(runtime) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.symbolOfIgnition);
    const field = requireEffect(profile, 'buff', 'guardian-symbol-of-ignition-field');
    if (!field) return;
    runtime.profession.core.symbolIgnitionStartsAt = runtime.time;
    runtime.profession.core.symbolIgnitionUntil = canonicalTime(
      runtime.time + effectNumber(profile, field, 'duration')
    );
  }
};

// Symbol hits and projectile hits have independent ignition cooldowns. Torch pulses
// and fire-whirl bolts also ignite, but ordinary conditions and ignition itself do not.
export function reactToSymbolOfIgnition(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const symbolOfIgnitionProfile = requireBalanceProfileFromContext(context, PROFILE.symbolOfIgnition);
  const burning = requireEffect(symbolOfIgnitionProfile, 'condition', 'Burning');
  if (!burning) return;
  const burningBolt =
    event.type === 'condition' &&
    event.condition === 'Burning' &&
    !!event.comboId &&
    event.fieldType === 'Fire' &&
    event.finisherType === 'Whirl';
  const torchPulse = event.type === 'condition' && event.condition === 'Burning' && event.skillId === ID.ZEALOTS_FLAME;
  if (
    !isGw2PlayerActorEvent(event) ||
    !((event.type === 'damage' && (event.coefficient || 0) > 0) || burningBolt || torchPulse) ||
    event.skillId === ID.SYMBOL_OF_IGNITION
  ) {
    return;
  }

  const state = guardianResolverState(context);
  if (
    (state.symbolIgnitionUntil || 0) <= (state.symbolIgnitionStartsAt || 0) ||
    event.at < (state.symbolIgnitionStartsAt || 0) ||
    event.at > (state.symbolIgnitionUntil || 0)
  ) {
    return;
  }

  const projectile = event.projectile === true || burningBolt;
  const cooldownKey = projectile ? 'guardian.core.symbolProjectileIgnition' : 'guardian.core.symbolIgnition';
  // Match gw2combat's end-of-tick cooldown removal: the deadline itself is still blocked.
  if (!context.procs.claim(PROFILE.symbolOfIgnition, cooldownKey, event.at)) return;
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      priority: 5,
      source: 'guardian',
      sourceId: ID.SYMBOL_OF_IGNITION,
      actorType: 'player',
      // Ignition remains attributed to the actual impact that claimed its cooldown.
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      skillId: ID.SYMBOL_OF_IGNITION,
      skillName: 'Symbol of Ignition',
      name: 'Symbol of Ignition — Ignition',
      condition: String(burning.condition),
      stacks: effectNumber(symbolOfIgnitionProfile, burning, 'stacks'),
      duration: effectNumber(symbolOfIgnitionProfile, burning, 'duration'),
      triggeredBy: event.skillName,
      projectile
    })
  );
}
