/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { canonicalTime } from '#kernel/core/clock.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { hasSelectedSkill } from '#gw2/platform/combat/query/runtime-query.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import {
  warriorActiveBuffStacks,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import type { Gw2AttributeEffect } from '#gw2/platform/builds/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

type WarriorRuntime = Gw2Runtime<WarriorRuntimeState, WarriorSkill>;
const SIGNET_PULSE = 'warrior.signet-of-rage-pulse';

export const WARRIOR_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.THROW_BOLAS]: {
    // Bolas immobilizes on impact and always finishes a projectile combo in an eligible field.
    castTimeMs: 520,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
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
        condition: 'Immobilized',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.SIGNET_OF_RAGE]: {
    castTimeMs: 200,
    dualWieldCastTimeMs: 160,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 25,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 25,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'swiftness',
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
        boon: 'stability',
        duration: 6,
        stacks: 1
      },
      {
        type: 'control',
        controlKind: 'launch'
      }
    ]
  },
  [ID.HEALING_SIGNET]: {
    castTimeMs: 1080,
    dualWieldCastTimeMs: 840,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
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
      { on: 'castCommit', do: { type: 'warrior.adrenaline', amount: 30 } },
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: 100 } }
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
        boon: 'might',
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
        boon: 'might',
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
        controlKind: 'daze'
      }
    ]
  },
  [ID.BANNER_OF_DISCIPLINE]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
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
        condition: 'Bleeding',
        stacks: 3,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 10
      }
    ]
  },
  [ID.SIGNET_OF_FURY]: {
    cooldown: 16,
    castTimeMs: 400,
    dualWieldCastTimeMs: 280,
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.adrenaline', amount: 30 } }],
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
        boon: 'might',
        duration: 12,
        stacks: 2
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
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
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 2
      }
    ]
  },
  [ID.KICK]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 842,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1
      },
      {
        type: 'control',
        controlKind: 'knockback'
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
        finisherType: 'Leap',
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
        controlKind: 'knockdown'
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
  if ((runtime.cooldowns.get(ID.SIGNET_OF_RAGE) ?? 0) <= runtime.time) grantWarriorAdrenaline(runtime, 2);
  runtime.profession.core.nextSignetPulseAt = canonicalTime(runtime.time + 3);
  runtime.schedule(SIGNET_PULSE, runtime.profession.core.nextSignetPulseAt, null, undefined, -220);
}

/** Selected Signet of Rage starts its passive at accepted combat and preserves suppressed pulse cadence. */
export const signetOfRageLifecycle: Partial<RuntimeProfession<WarriorRuntimeState, WarriorSkill>> = {
  onCombatStart(runtime) {
    if (!selectedSkillNameSet(runtime.config.selectedSkills).has('Signet of Rage')) return;
    runtime.profession.core.nextSignetPulseAt = canonicalTime(runtime.time + 3);
    runtime.schedule(SIGNET_PULSE, runtime.profession.core.nextSignetPulseAt, null, undefined, -220);
  },
  tasks: { [SIGNET_PULSE]: signetPulse }
};

// One passive descriptor feeds both baked build attributes and live cooldown subtraction.
const signetPassives = [
  { name: 'Signet of Might', id: ID.SIGNET_OF_MIGHT, attribute: 'power', label: 'Power' },
  { name: 'Signet of Fury', id: ID.SIGNET_OF_FURY, attribute: 'precision', label: 'Precision' }
] as const;

/** Signet bonuses never feed build conversions, and baked passives are subtracted only while recharging. */
export function signetBuildAttributes(
  context: Parameters<typeof requireBalanceProfileFromContext>[0],
  selected: (id: number) => boolean
): readonly Gw2AttributeEffect[] {
  const bonus = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.signetPassives),
    'attributeBonus'
  );
  return signetPassives.map(({ id, label }) => ({
    kind: 'flat',
    to: label,
    amount: bonus,
    feedsConversions: false,
    enabled: selected(id)
  }));
}

/** Intrinsic active and passive attributes use live self status and selected signet recharge. */
export function modifySignetAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  if (warriorActiveBuffStacks(context, 'signet-of-fury-active', 1) > 0) {
    const signetOfFuryActiveProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfFuryActive);
    const bonus = balanceProfileNumber(signetOfFuryActiveProfile, 'attributeBonus');
    result.precision += bonus;
    result.ferocity += bonus;
  }

  const activeSignets = signetPassives.filter(({ name, id }) => {
    if (!hasSelectedSkill(context, name)) return false;
    const onCooldown = Boolean(context.timeline?.skillOnCooldownAt(id, context.time));
    return staticRulesApplied ? onCooldown : !onCooldown;
  });
  if (activeSignets.length > 0) {
    const signetPassivesProfile = requireBalanceProfileFromContext(context, PROFILE.signetPassives);
    // Both eligible signets use the same passive bonus, read once before applying it.
    const passiveBonus = balanceProfileNumber(signetPassivesProfile, 'attributeBonus');
    for (const { attribute } of activeSignets) {
      result[attribute] += (staticRulesApplied ? -1 : 1) * passiveBonus;
    }
  }
}
