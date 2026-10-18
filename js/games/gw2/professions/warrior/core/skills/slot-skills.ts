import { COMBO_FINISHER, CONTROL, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { passiveAttribute } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeContext, Gw2AttributeEffect } from '#gw2/platform/attributes/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { warriorActiveBuffStacks } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntimeState, WarriorSkill, WarriorRuntime } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const SIGNET_PULSE = 'warrior.signet-of-rage-pulse';

export const WARRIOR_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SIGNET_OF_STAMINA]: {
    // The instant signet restores endurance and activates signet traits; incoming conditions are outside scope.
    castTimeMs: 0,
    cooldown: 20,
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          id: 'endurance-restored',
          label: 'Endurance restored',
          resource: 'endurance',
          amount: 50
        }
      }
    ],
    effects: []
  },
  [ID.THROW_BOLAS]: {
    // Bolas immobilizes on impact and always finishes a projectile combo in an eligible field.
    castTimeMs: 520,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 1,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.SIGNET_OF_RAGE]: {
    // The selected active reward enables adrenaline and weapon-burst recovery on successful activation.
    resourceGain: 0,
    sideEffects: [
      {
        on: 'castCommit',
        when: (_runtime, cast) => Number(cast.skill.resourceGain) > 0,
        do: { type: 'warrior.signet-of-rage-active' }
      }
    ],
    castTimeMs: 200,
    dualWieldCastTimeMs: 160,
    effects: [
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 25,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 25,
        stacks: 5
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 25,
        stacks: 1
      }
    ]
  },
  [ID.STOMP]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 6,
        stacks: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.LAUNCH
      }
    ]
  },
  [ID.HEALING_SIGNET]: {
    castTimeMs: 1080,
    dualWieldCastTimeMs: 840,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.MENDING]: {
    cooldown: 12,
    castTimeMs: 920,
    categories: ['Physical'],
    effects: []
  },
  [ID.TO_THE_LIMIT]: {
    cooldown: 24,
    castTimeMs: 680,
    // The heal restores two dodge bars when its cast completes.
    sideEffects: [
      { on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 30 } },
      // A stable grant identity exposes this committed reward to patch authoring.
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          id: 'endurance-restored',
          label: 'Endurance restored',
          resource: 'endurance',
          amount: 100
        }
      }
    ],
    effects: []
  },
  [ID.SIGNET_OF_MIGHT]: {
    cooldown: 20,
    // The instant activation grants might without occupying the cast timeline.
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 10
      }
    ]
  },
  [ID.BANNER_OF_STRENGTH]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 2
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.BANNER_OF_DISCIPLINE]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 4,
        stacks: 1
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 8
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 10
      }
    ]
  },
  [ID.SIGNET_OF_FURY]: {
    cooldown: 16,
    castTimeMs: 400,
    dualWieldCastTimeMs: 280,
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 30 } }],
    effects: [
      {
        type: 'buff',
        kind: 'signet-of-fury-active',
        duration: 4,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        stacks: 1
      }
    ]
  },
  [ID.BATTLE_STANDARD]: {
    castTimeMs: 1333,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 12,
        stacks: 2
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 12,
        stacks: 1
      }
    ]
  },
  [ID.RAMPAGE]: {
    castTimeMs: 667,
    effects: [
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 3,
        stacks: 2
      }
    ]
  },
  [ID.KICK]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // Once Kick commits, an interruption preserves its effects and full cast lockout.
    castTimeMs: 840,
    interruptCommitMs: 560,
    retainsCastLockoutAfterInterrupt: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ])
  },
  [ID.BULLS_CHARGE]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // Bull's Charge keeps its fixed 640 ms cast and has no measured Dual Wielding variant.
    castTimeMs: 640,
    // Once the charge commits, its effects survive interruption.
    interruptCommitMs: 600,
    interruptMode: 'commit',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.LEAP,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN
      }
    ])
  },
  [ID.DEFIANT_STANCE]: {
    castTimeMs: 640,
    effects: []
  }
});

/** Each pulse checks current recharge and then schedules only its next occurrence, preserving cadence while suppressed. */
function signetPulse(runtime: WarriorRuntime): void {
  if ((runtime.cooldownController.readyAt(ID.SIGNET_OF_RAGE) ?? 0) <= runtime.time) grantWarriorResource(runtime, 2);

  runtime.profession.core.nextSignetPulseAt = canonicalTime(runtime.time + 3);
  runtime.schedule(SIGNET_PULSE, runtime.profession.core.nextSignetPulseAt, null, undefined, -220);
}

/** Selected Signet of Rage starts its passive at accepted combat and preserves suppressed pulse cadence. */
export const signetOfRageLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  // Passive resource pulses are ambient work, not delayed damage from the signet's active cast.
  backgroundTasks: [SIGNET_PULSE],
  sideEffectHandlers: {
    'warrior.signet-of-rage-active'(runtime, context) {
      // Reset catalog weapon bursts only: Full Counter and Dragon Trigger retain their recharges.
      grantWarriorResource(runtime, Number(context.skill.resourceGain));
      for (const skill of runtime.helpers.skills) {
        if (skill.burst && !skill.dragonSlash && skill.id !== ID.FULL_COUNTER && !skill.categories?.includes('Chant'))
          runtime.cooldownController.clear(skill.id);
      }
    }
  },
  onCombatStart(runtime) {
    if (!selectedSkillIdSet(runtime.config.selectedSkillIds).has(ID.SIGNET_OF_RAGE)) return;

    runtime.profession.core.nextSignetPulseAt = canonicalTime(runtime.time + 3);
    runtime.schedule(SIGNET_PULSE, runtime.profession.core.nextSignetPulseAt, null, undefined, -220);
  },
  tasks: { [SIGNET_PULSE]: signetPulse }
};

// One passive descriptor feeds build and live queries.
const signetPassives = [
  { name: 'Signet of Might', id: ID.SIGNET_OF_MIGHT, attribute: 'power', label: 'Power' },
  { name: 'Signet of Fury', id: ID.SIGNET_OF_FURY, attribute: 'precision', label: 'Precision' }
] as const;

/** Signet bonuses never feed conversions and apply only while ready. */
export function signetAttributeEffects(context: Gw2AttributeContext): readonly Gw2AttributeEffect[] {
  // Shared passive grants expose their owning skills for contribution analysis and retain native readiness rules.
  return signetPassives.map(({ id, label }) =>
    passiveAttribute(context, id, PROFILE.signetPassives, label, 'attributeBonus')
  );
}

/** Intrinsic active and passive attributes use live self status and selected signet recharge. */
export function signetActiveAttributeEffects(context: Gw2ModifierContext): readonly Gw2AttributeEffect[] {
  if (warriorActiveBuffStacks(context, 'signet-of-fury-active', 1) > 0) {
    const bonus = balanceNumberFromContext(context, PROFILE.signetOfFuryActive, 'attributeBonus');
    return ['Precision', 'Ferocity'].map((to) => ({ kind: 'flat', to, amount: bonus, feedsConversions: 'none' }));
  }

  return [];
}
