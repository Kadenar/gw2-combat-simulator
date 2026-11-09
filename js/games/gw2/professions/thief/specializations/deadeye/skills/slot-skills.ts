import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, CONDITION, CONTROL, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { consumeDeadeyeMalice } from '#gw2/professions/thief/specializations/deadeye/mechanics/malice.js';
import { markedTarget } from '#gw2/professions/thief/specializations/deadeye/skills/deadeyes-mark.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Cantrips own their utility effects, flip windows, and commitment actions. */
export const DEADEYE_SLOT_SKILLS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.SHADOW_FLARE]: {
    name: 'Shadow Flare',
    icon: 'https://render.guildwars2.com/file/007CF2CAA795DC259DD538C0CB7D9C36FE3AE423/1770636.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Cantrip',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    flipDuration: 4,
    cooldown: 20,
    castTimeMs: 480,
    // This skill scales its player-owned strikes against the active mark.
    modifiers: [
      {
        order: 200,
        id: 'thief.shadow-flare-marked',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.5,
        when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && markedTarget(context)
      }
    ],
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
    ],
    // A committed Flare opens the follow-up through the shared flip lifecycle.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'flipArm',
          skillId: ID.SHADOW_SWAP
        }
      }
    ]
  },
  [ID.BINDING_SHADOW]: {
    name: 'Binding Shadow',
    icon: 'https://render.guildwars2.com/file/7A5BD448F1522426E745A539F6200918145AF1A0/1770633.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Cantrip',
    cooldown: 20,
    castTimeMs: 520,
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
    name: 'Mercy',
    icon: 'https://render.guildwars2.com/file/120BA65D429AC57ECAED3BEAAFCF7C9E3D356DDD/1770635.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Cantrip',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    initiativeRefund: 3,
    initiativePerMalice: 1,
    cooldown: 30,
    ammo: 2,

    ammoCastLockout: 1,
    castTimeMs: 0,
    effects: [],
    // The fixed reset belongs to the skill; Malice consumption and its scaled refund remain stateful.
    sideEffects: [
      { on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.DEADEYES_MARK] } },
      { on: 'castCommit', do: { type: 'thief.mercy' } }
    ]
  },
  [ID.MALICIOUS_RESTORATION]: {
    name: 'Malicious Restoration',
    icon: 'https://render.guildwars2.com/file/C1E7E96F22330A9AF3DBDAF5245430CBA17FB0A3/1770611.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Cantrip',
    cooldown: 25,
    castTimeMs: 0,
    effects: []
  },
  [ID.SHADOW_MELD]: {
    name: 'Shadow Meld',
    icon: 'https://render.guildwars2.com/file/380609B742C9C59C9EC5B4A428070039787A61C9/1770610.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Cantrip',
    cooldown: 25,
    ammo: 2,

    ammoCastLockout: 5,
    castTimeMs: 440,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      }
    ],
    // Clear Revealed before selecting the stealth grant; only commitment applies it.
    sideEffects: [
      { on: 'castStart', do: { type: 'thief.clear-revealed' } },
      { on: 'castCommit', do: { type: 'thief.stealth' } }
    ]
  },
  [ID.SHADOW_SWAP]: {
    name: 'Shadow Swap',
    icon: 'https://render.guildwars2.com/file/399C0ED664165E4E53C6F909CB150BE35A5B6C2D/1770634.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 0,
    castTimeMs: 0,
    // This skill scales its player-owned strikes against the active mark.
    modifiers: [
      {
        order: 200,
        id: 'thief.shadow-swap-marked',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.5,
        when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && markedTarget(context)
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Shadow Swap',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SHADOW_SWAP } }]
  },
  [ID.SHADOW_GUST]: {
    name: 'Shadow Gust',
    icon: 'https://render.guildwars2.com/file/972D59E7299266512B04BDD9DB04BFF6AC383F61/1770637.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Cantrip',
    cooldown: 30,
    castTimeMs: 360,
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
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }]
  }
};

/** Register actions beside the skills whose accepted casts select them. */
const deadeyeSlotActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> = {
  'thief.clear-revealed'(runtime) {
    runtime.profession.core.revealedUntil = Math.min(runtime.profession.core.revealedUntil, runtime.time);
  },
  'thief.mercy'(runtime) {
    // Consume live commitment-time malice before refunding the selected skill's amount.
    const malice = consumeDeadeyeMalice(runtime);
    const mercy = requireSkill(runtime.helpers, ID.MERCY);
    const initiativeGain = skillNumber(mercy, 'initiativeRefund') + malice * skillNumber(mercy, 'initiativePerMalice');

    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  }
};

/** Registers Deadeye slot skill actions with the Deadeye hook assembly. */
export const deadeyeSlotLifecycle = {
  sideEffectHandlers: deadeyeSlotActions
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
