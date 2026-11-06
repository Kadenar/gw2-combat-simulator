/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { ownerAttributeEffects, passiveSkillAttributes } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeContext, Gw2AttributeEffect } from '#gw2/platform/attributes/types.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';
import { requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { warriorActiveBuffStacks } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

const SIGNET_PULSE = 'warrior.signet-of-rage-pulse';

export const WARRIOR_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.SIGNET_OF_STAMINA]: {
    name: 'Signet of Stamina',
    icon: 'https://render.guildwars2.com/file/3763DF075356FE2A22A56915EB0B982B32F3FBA3/104128.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    // Readiness gates the passive amount owned by this signet.
    enduranceRegenerationBonus: 0.5,
    cooldown: 20,
    // The instant signet restores endurance and activates signet traits; incoming conditions are outside scope.
    castTimeMs: 0,
    effects: [],
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
    ]
  },
  [ID.THROW_BOLAS]: {
    name: 'Throw Bolas',
    icon: 'https://render.guildwars2.com/file/0DC030D5DBE6B5C9ED157DBB1CF86ED6F6D6753E/103015.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 16,
    ammoCastLockout: 1,
    ammo: 2,

    // Bolas immobilizes on impact and always finishes a projectile combo in an eligible field.
    castTimeMs: 520,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 1
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
    name: 'Signet of Rage',
    icon: 'https://render.guildwars2.com/file/7A530D5434F9E9E80ED14DBE48EEE90427E33A2B/104113.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Signet',
    cooldown: 40,
    // The selected active reward enables adrenaline and weapon-burst recovery on successful activation.
    resourceGain: 0,
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
    ],
    sideEffects: [
      {
        on: 'castCommit',
        when: (_runtime, cast) => Number(cast.skill.resourceGain) > 0,
        do: { type: 'warrior.signet-of-rage-active' }
      }
    ]
  },
  [ID.STOMP]: {
    name: 'Stomp',
    icon: 'https://render.guildwars2.com/file/D7040004B112A4075A1038917CEF5FFA0BC100A2/102788.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 20,
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
    name: 'Healing Signet',
    icon: 'https://render.guildwars2.com/file/BFED9DC9065E01B726E6CF629A5642164B382BA6/102866.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Signet',
    cooldown: 20,
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
    name: 'Mending',
    icon: 'https://render.guildwars2.com/file/04EB1106C95B7579EA29FA2F08BAFDA649C60715/103295.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 12,
    skillFamily: 'Physical',
    castTimeMs: 920,
    effects: []
  },
  [ID.TO_THE_LIMIT]: {
    name: '"To the Limit!"',
    icon: 'https://render.guildwars2.com/file/999EEC803BE421BD0835D8DC1EFE70C3A0EA0903/104117.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Shout',
    cooldown: 24,
    castTimeMs: 680,
    effects: [],
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
    ]
  },
  [ID.SIGNET_OF_MIGHT]: {
    name: 'Signet of Might',
    icon: 'https://render.guildwars2.com/file/450973A6DE4D0BEE580256F5759F632B7EBC7ADD/103798.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    attributeBonuses: { power: 180 },
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
    name: 'Banner of Strength',
    icon: 'https://render.guildwars2.com/file/311047BE40F8F80E72CFDB2843DF09E55E06A4AA/104118.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 30,
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
    name: 'Banner of Discipline',
    icon: 'https://render.guildwars2.com/file/B0BA02176B4E10539B0202CA64286DA97C4FE44E/103087.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 30,
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
    name: 'Signet of Fury',
    icon: 'https://render.guildwars2.com/file/2F34F119A12F4608685DF0B76106F7B6EABCCBF8/104119.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    attributeBonuses: { precision: 180 },
    activeAttributeBonuses: { precision: 360, ferocity: 360 },
    cooldown: 16,
    castTimeMs: 400,
    dualWieldCastTimeMs: 280,
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
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 30 } }]
  },
  [ID.BATTLE_STANDARD]: {
    name: 'Battle Standard',
    icon: 'https://render.guildwars2.com/file/EFA30928146834B9F1F4C2C3E8DE9A446553DF5C/103707.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 90,
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
    name: 'Rampage',
    icon: 'https://render.guildwars2.com/file/D59294B049BF3412990AA9BAAF50809A0AA3EF0F/103571.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Physical',
    cooldown: 90,
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
    name: 'Kick',
    icon: 'https://render.guildwars2.com/file/E578C9070BCA270818F56304CBE2800CD4691350/103001.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 20,
    ammoCastLockout: 3,
    ammo: 3,

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
    name: "Bull's Charge",
    icon: 'https://render.guildwars2.com/file/EE6EF3D05F08D37DF97BA5C657CE191D4C904904/104140.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 24,
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // Bull's Charge keeps its fixed 640 ms cast and has no measured Dual Wielding variant.
    castTimeMs: 640,
    interruptMode: 'commit',
    // Once the charge commits, its effects survive interruption.
    interruptCommitMs: 600,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.LEAP
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
    name: 'Defiant Stance',
    icon: 'https://render.guildwars2.com/file/29C39009CD5230764480DC2404E740A49898AFA0/699533.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Stance',
    cooldown: 30,
    castTimeMs: 640,
    effects: []
  }
};

/** Suppressed rewards keep the combat-anchored cadence; only ready pulses grant resources. */
const signetOfRagePassive = definePeriodicTask<WarriorRuntime>({
  name: SIGNET_PULSE,
  background: true,
  priority: -220,
  state: (runtime) => runtime.profession.core.signetOfRagePassive,
  nextAt: (runtime) => runtime.time + 3,
  run(runtime) {
    if ((runtime.cooldownController.readyAt(ID.SIGNET_OF_RAGE) ?? 0) <= runtime.time) grantWarriorResource(runtime, 2);
  }
});

/** Selected Signet of Rage starts its passive at accepted combat and preserves suppressed pulse cadence. */
export const signetOfRageLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  ...signetOfRagePassive.hooks,
  sideEffectHandlers: {
    'warrior.signet-of-rage-active'(runtime, context) {
      // Reset catalog weapon bursts only: Full Counter and Dragon Trigger retain their recharges.
      grantWarriorResource(runtime, Number(context.skill.resourceGain));
      for (const skill of runtime.helpers.skills) {
        if (skill.burst && !skill.dragonSlash && skill.id !== ID.FULL_COUNTER && skill.skillFamily !== 'Chant')
          runtime.cooldownController.clear(skill.id);
      }
    }
  },
  onCombatStart(runtime) {
    if (!selectedSkillIdSet(runtime.config.selectedSkillIds).has(ID.SIGNET_OF_RAGE)) return;

    signetOfRagePassive.restart(runtime, runtime.time + 3);
  }
};

// One passive descriptor feeds build and live queries.
const signetPassives = [
  {
    name: 'Signet of Might',
    icon: 'https://render.guildwars2.com/file/450973A6DE4D0BEE580256F5759F632B7EBC7ADD/103798.png',
    id: ID.SIGNET_OF_MIGHT,
    attribute: 'power',
    label: 'Power'
  },
  {
    name: 'Signet of Fury',
    icon: 'https://render.guildwars2.com/file/2F34F119A12F4608685DF0B76106F7B6EABCCBF8/104119.png',
    id: ID.SIGNET_OF_FURY,
    attribute: 'precision',
    label: 'Precision'
  }
] as const;

/** Signet bonuses never feed conversions and apply only while ready. */
export function signetAttributeEffects(context: Gw2AttributeContext): readonly Gw2AttributeEffect[] {
  // Selected signets retain native readiness while their own attributes feed both preview and combat.
  return signetPassives.flatMap(({ id }) => passiveSkillAttributes(context, id));
}

/** Intrinsic active and passive attributes use live self status and selected signet recharge. */
export function signetActiveAttributeEffects(context: Gw2ModifierContext): readonly Gw2AttributeEffect[] {
  if (warriorActiveBuffStacks(context, 'signet-of-fury-active', 1) > 0) {
    const skill = requireSkill(context.catalog, ID.SIGNET_OF_FURY);
    return ownerAttributeEffects({ attributeBonuses: skill.activeAttributeBonuses });
  }

  return [];
}
