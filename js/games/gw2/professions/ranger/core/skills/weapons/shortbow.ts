import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RangerRuntimeState, RangerSkill, RangerResolverContext } from '#gw2/professions/ranger/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { grantSkillCharges } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { buildRangerBleeding } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.POISON_VOLLEY]: {
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 1.5,
        hits: 5,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 5,
        duration: 5
      }
    ],
    castTimeMs: 167
  },
  [ID.CROSSFIRE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    effects: [
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
    ],
    castTimeMs: 333
  },
  [ID.CRIPPLING_SHOT]: {
    // Arm subsequent qualifying hits only on semantic commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.blood-thirst' } }],
    effects: [
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
        condition: 'Bleeding',
        stacks: 1,
        duration: 15
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
        stacks: 1,
        duration: 1.5
      }
    ],
    castTimeMs: 333
  },
  [ID.CONCUSSION_SHOT]: {
    effects: [
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
        controlKind: 'daze'
      }
    ],
    castTimeMs: 167
  },
  [ID.QUICK_SHOT]: {
    evades: true,
    effects: [
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
        duration: 9,
        stacks: 1
      }
    ],
    castTimeMs: 167
  }
});

/** The owning skill supplies charge limits, lifetime, and the triggered condition packet. */
export const bloodThirstProfile = variant(PROFILE.bloodThirst, ID.CRIPPLING_SHOT, 'Blood Thirst', {
  playerStacks: 3,
  durationMultiplier: 12,
  effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 12 }]
});

export function handleRangerBloodThirst(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  // Crippling Shot replaces the remaining charges with a new finite grant.
  professionCoreState(context).bloodThirst = grantCharges(
    Math.max(0, Number(event.charges || 0)),
    event.at + (event.duration || 0)
  );
}

/** Consume one live Blood Thirst charge per qualifying hit, excluding its arming skill and exact expiry. */
export function triggerBloodThirst(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  expireCharges(state.bloodThirst, event.at);
  if (event.sourceId === ID.CRIPPLING_SHOT) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.bloodThirst);
  const bleeding = requireEffect(profile, 'condition', 'Bleeding');
  // Charges exist only to deliver bleeding, so a removed packet leaves them unspent.
  if (bleeding && consumeCharge(state.bloodThirst, event.at)) {
    context.effects.emit({
      kind: 'packet',
      event: buildRangerBleeding(
        context,
        event,
        effectNumber(profile, bleeding, 'duration'),
        ID.CRIPPLING_SHOT,
        'Blood Thirst',
        effectNumber(profile, bleeding, 'stacks')
      )
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
