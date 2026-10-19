import { ACTOR, STATUS, CONTROL, CONDITION } from '#gw2/platform/constants.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { markedTarget } from '#gw2/professions/thief/specializations/deadeye/skills/deadeyes-mark.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Cantrips own their utility effects, flip windows, and commitment actions. */
export const DEADEYE_SLOT_SKILLS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SHADOW_FLARE]: {
    // A committed Flare opens the follow-up through the shared flip lifecycle.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'flipArm',
          skillId: ID.SHADOW_SWAP,
          durationSec: { profile: PROFILE.shadowFlare, field: 'flipDuration' }
        }
      }
    ],
    castTimeMs: 480,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        // Scale the observed cast-end hit from cast start so Quickness preserves packet alignment.
        ticks: [{ atMs: 480, coefficient: 1 }],
        name: 'Shadow Flare',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BINDING_SHADOW]: {
    castTimeMs: 520,
    cooldown: 20,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Binding Shadow',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 2,
        duration: 10,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 15,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.MERCY]: {
    // The fixed reset belongs to the skill; Malice consumption and its scaled refund remain stateful.
    sideEffects: [
      { on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.DEADEYES_MARK] } },
      { on: 'castCommit', do: { type: 'thief.mercy' } }
    ],
    castTimeMs: 0,
    cooldown: 1,
    ammo: 2,
    ammoRecharge: 30,
    ammoCastLockout: 1,
    initiativeCost: 0,
    effects: []
  },
  [ID.MALICIOUS_RESTORATION]: {
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.SHADOW_MELD]: {
    // Clear Revealed before selecting the stealth grant; only commitment applies it.
    sideEffects: [
      { on: 'castStart', do: { type: 'thief.clear-revealed' } },
      { on: 'castCommit', do: { type: 'thief.stealth' } }
    ],

    castTimeMs: 440,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 25,
    ammoCastLockout: 5,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SHADOW_SWAP]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SHADOW_SWAP } }],
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Shadow Swap',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SHADOW_GUST]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }],
    castTimeMs: 360,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.4 }],
        name: 'Shadow Gust',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  }
});

const SHADOW_FLARE_SKILL_IDS: ReadonlySet<number> = new Set([ID.SHADOW_FLARE, ID.SHADOW_SWAP]);

/** Apply this skill family's intrinsic damage rules using live mark eligibility. */
export const deadeyeSlotModifiers: readonly Gw2ModifierRule[] = [
  {
    order: 200,
    id: 'thief.shadow-flare-marked',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      markedTarget(context) &&
      SHADOW_FLARE_SKILL_IDS.has(Number(skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id))
  }
];

/** Register actions beside the skills whose accepted casts select them. */
const deadeyeSlotActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> = {
  'thief.clear-revealed'(runtime) {
    runtime.profession.core.revealedUntil = Math.min(runtime.profession.core.revealedUntil, runtime.time);
  },
  'thief.mercy'(runtime) {
    // Consume live commitment-time malice before refunding the selected profile's amount.
    const state = deadeyeState.from(runtime);
    const malice = runtime.resourceController.value('malice');
    runtime.resourceController.replace('malice', 0);
    state.maleficentSevenTriggered = false;
    const mercy = requireBalanceProfileFromContext(runtime, PROFILE.mercy);
    const initiativeGain =
      balanceProfileNumber(mercy, 'resourceGain') + malice * balanceProfileNumber(mercy, 'attributePerStack');

    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  }
};

/** Registers Deadeye slot skill actions with the Deadeye hook assembly. */
export const deadeyeSlotLifecycle = {
  sideEffectHandlers: deadeyeSlotActions
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
