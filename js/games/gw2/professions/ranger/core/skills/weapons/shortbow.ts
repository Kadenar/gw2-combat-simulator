import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RangerRuntimeState, RangerSkill, RangerResolverContext } from '#gw2/professions/ranger/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { grantSkillCharges } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Full-cast medians and successful minimums from 20261006-010612, snapped to 40 ms.
// Committed arrows retain their impacts and observed aftercast; offsets include this log's projectile travel.
export const RANGER_CORE_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.POISON_VOLLEY]: {
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects(
      { atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          projectile: true,
          coefficient: 1.5,
          hits: 5,
          atMs: 280
        },
        {
          type: 'condition',
          condition: 'Poisoned',
          // One application per arrow preserves per-application poison reactions.
          applications: 5,
          intervalMs: 0,
          stacks: 1,
          duration: 5
        }
      ]
    ),
    castTimeMs: 560
  },
  [ID.CROSSFIRE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects(
      { atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          projectile: true,
          coefficient: 0.5,
          hits: 1,
          comboFinishers: [
            {
              ownerId: 'ranger',
              finisherType: 'Projectile',
              chance: 0.2,
              ambiguousFieldSelection: 'oldest'
            }
          ]
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 1,
          duration: 3
        }
      ]
    ),
    castTimeMs: 360
  },
  [ID.CRIPPLING_SHOT]: {
    // Arm subsequent qualifying hits only on semantic commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.blood-thirst' } }],
    interruptCommitMs: 160,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          projectile: true,
          coefficient: 0.8,
          hits: 1,
          comboFinishers: [
            {
              ownerId: 'ranger',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ]
        },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 4
        },
        {
          type: 'condition',
          condition: 'Immobilized',
          // Defiance is the simulation's supported proxy for the flank/behind bonus.
          when: (runtime) => Boolean(runtime.config.target?.defiant),
          stacks: 1,
          duration: 1.5
        }
      ]
    ),
    castTimeMs: 360
  },
  [ID.CONCUSSION_SHOT]: {
    interruptCommitMs: 640,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          projectile: true,
          coefficient: 0.4,
          hits: 1,
          comboFinishers: [
            {
              ownerId: 'ranger',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ]
        },
        {
          type: 'control',
          controlKind: 'daze',
          when: (runtime) => !runtime.config.target?.defiant
        },
        {
          type: 'control',
          controlKind: 'stun',
          when: (runtime) => Boolean(runtime.config.target?.defiant)
        }
      ]
    ),
    castTimeMs: 640
  },
  [ID.QUICK_SHOT]: {
    evades: true,
    interruptCommitMs: 840,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          projectile: true,
          coefficient: 0.5,
          hits: 1,
          comboFinishers: [
            {
              ownerId: 'ranger',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ]
        },
        {
          type: 'boon',
          boon: 'swiftness',
          // Swiftness is self-applied at launch, independently of the later projectile hit.
          atMs: 280,
          duration: 9,
          stacks: 1
        }
      ]
    ),
    castTimeMs: 840
  }
});

/** The owning skill supplies charge limits, lifetime, and the triggered condition packet. */
export const bloodThirstProfile = variant(PROFILE.bloodThirst, ID.CRIPPLING_SHOT, 'Blood Thirst', {
  playerStacks: 3,
  durationMultiplier: 12,
  // The log grants a 12-second charge window; each triggered bleed lasts 15 seconds.
  effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 15 }]
});

export function handleRangerBloodThirst(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  // Crippling Shot replaces the remaining charges with a new finite grant.
  professionCoreState(context).bloodThirst = grantCharges(
    Math.max(0, Number(event.charges || 0)),
    event.at + (event.duration || 0)
  );
}

/** Pet hits, or player hits in Beastmode, spend charges using the Ranger's condition attributes. */
export function triggerBloodThirst(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  expireCharges(state.bloodThirst, event.at);
  if (event.sourceId === ID.CRIPPLING_SHOT) return;
  const specialization = context.profession.specialization;
  const merged = specialization.kind === 'Soulbeast' && specialization.state.beastmodeActive;
  if (!(Number(event.coefficient) > 0) || !(merged ? isPlayerStrike(event) : isPetStrike(event))) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.bloodThirst);
  const bleeding = requireEffect(profile, 'condition', 'Bleeding');
  // Charges exist only to deliver bleeding, so a removed packet leaves them unspent.
  if (bleeding && consumeCharge(state.bloodThirst, event.at)) {
    context.effects.emit({
      kind: 'packet',
      // Player ownership implements the June 2024 change, even when a pet delivers the strike.
      event: buildResolverCondition({
        at: event.at,
        source: 'ranger',
        sourceId: ID.CRIPPLING_SHOT,
        skillId: ID.CRIPPLING_SHOT,
        skillName: 'Blood Thirst',
        name: 'Blood Thirst — Bleeding',
        actorType: 'effect',
        ownerActorType: 'player',
        condition: 'Bleeding',
        duration: effectNumber(profile, bleeding, 'duration'),
        stacks: effectNumber(profile, bleeding, 'stacks'),
        triggeredBy: event.skillName
      })
    });
  }
}

/** Queue grants at the declared activation boundary so same-time hits retain their established order. */
export const bloodThirstLifecycle = {
  sideEffectHandlers: {
    'ranger.blood-thirst'(runtime, context) {
      if (context.kind === 'cast') grantSkillCharges(runtime, context.cast, 'ranger.blood-thirst', PROFILE.bloodThirst);
    }
  },
  eventHandlers: { 'ranger.blood-thirst': handleRangerBloodThirst }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
