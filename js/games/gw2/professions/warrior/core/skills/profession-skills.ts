/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { effectNumber, requireEffect, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { warriorBurstSpend, warriorBurstTier } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { warriorBurstRules } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.EVISCERATE]: {
    name: 'Eviscerate',
    icon: 'https://render.guildwars2.com/file/EA325CADCFA2EEF9E2427DD415402E056A6D6CB3/103230.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Axe',
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // Declare the burst weapon so axe critical traits apply to this strike.
    skillWeapon: WEAPON.AXE,
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 0,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 5
      },
      ...[2, 2.5, 3].map((coefficient, index) => ({
        type: 'strike' as const,
        name: `Tier ${index + 1}`,
        coefficient,
        hits: 1
      }))
    ],
    // Captured spend selects one skill-owned tier while unrelated rewards remain intact.
    effectVariants: [
      {
        when: () => true,
        transform(_runtime, cast, effects) {
          const tier = warriorBurstTier(warriorBurstSpend(cast)!);
          return effects.filter((effect) => effect.type !== 'strike' || effect.name === `Tier ${tier}`);
        }
      }
    ]
  },
  [ID.ARCING_SLICE]: {
    name: 'Arcing Slice',
    icon: 'https://render.guildwars2.com/file/6003B9BAF49D80F30D13E40453C145BF1159572B/103017.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        // Use one matching health tier; bonuses never compound when the target crosses multiple thresholds.
        modifiers: [
          {
            id: 'warrior.arcing-slice-target-health',
            target: 'strikeDamage',
            operation: 'multiply',
            factor: 1.5,
            when: (context) => targetHealthBelow(context, 0.5)
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 8,
        stacks: 1
      }
    ],
    // Packet selection uses the accepted spend, never the later live pool.
    effectVariants: [
      {
        when: () => true,
        transform(_runtime, cast, effects) {
          const tier = warriorBurstTier(warriorBurstSpend(cast)!);
          return effects.map((effect) =>
            effect.type === 'boon' && effect.boon === BOON.FURY
              ? { ...effect, duration: effect.duration * [1, 1.5, 2][tier - 1] }
              : effect
          );
        }
      }
    ]
  },
  [ID.EARTHSHAKER]: {
    name: 'Earthshaker',
    icon: 'https://render.guildwars2.com/file/B8D91A691871E4EA40645E2DE8F0452643263E9E/103181.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Hammer',
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    skillWeapon: WEAPON.HAMMER,
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 1000,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.75,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.STUN
      }
    ])
  },
  [ID.KILL_SHOT]: {
    name: 'Kill Shot',
    icon: 'https://render.guildwars2.com/file/9A4310F746AECD6348D6663D56F45447BAF0789C/103313.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Rifle',
    skillWeapon: WEAPON.RIFLE,
    // Kill Shot lands before its measured animation ends; tier scaling preserves this packet.
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 1160,
    // Only this burst gains damage against a defiant target or one strictly below half health.
    modifiers: [
      {
        id: 'warrior.kill-shot-threshold',
        label: 'Kill Shot',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.2,
        order: 100,
        when: (context) => context.config?.target?.defiant === true || targetHealthBelow(context, 0.5)
      }
    ],
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
        coefficient: 2.25,
        hits: 1,
        name: 'Kill Shot - Level 1 Damage',
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    // Packet selection uses the accepted spend, never the later live pool.
    effectVariants: [
      {
        when: () => true,
        transform(_runtime, cast, effects) {
          const tier = warriorBurstTier(warriorBurstSpend(cast)!);
          return effects.map((effect) =>
            effect.type === 'strike'
              ? { ...effect, coefficient: (Number(effect.coefficient) * [2.25, 2.75, 3.25][tier - 1]) / 2.25 }
              : effect
          );
        }
      }
    ]
  },
  [ID.SKULL_CRACK]: {
    name: 'Skull Crack',
    icon: 'https://render.guildwars2.com/file/F4F19D3AA21DD174389D01ACD9D76433750CE9DF/103280.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Mace',
    // The burst's daze and damage share the observed impact before the animation ends.
    skillWeapon: WEAPON.MACE,
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 560,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.COMBUSTIVE_SHOT]: {
    name: 'Combustive Shot',
    icon: 'https://render.guildwars2.com/file/45CE3B6BCD1FBB5B592859C37FC7D35FDA9E482B/103212.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 520,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: COMBO_FIELD.FIRE,
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    pulseInterval: 3,
    durationPerTier: 3,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 0.5, hits: 1 },
      { name: CONDITION.BURNING, type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 5 }
    ],
    // Fixed pulses preserve independent Strike/Burning removal and persistent field cadence.
    effectVariants: [
      {
        when: () => true,
        transform(_runtime, cast) {
          const spent = warriorBurstSpend(cast)!;
          const tier = warriorBurstTier(spent);
          const profile = cast.skill;
          const interval = skillNumber(profile, 'pulseInterval');
          const pulses = interval > 0 ? tier + 1 : 1;
          // Each selected component keeps its own removal semantics and fixed post-completion cadence.
          const timing = {
            timingAnchor: 'castEnd' as const,
            timingScale: 'fixed' as const,
            persistsAfterInterrupt: true,
            metadata: { warriorAdrenalineSpent: spent, warriorBurstTier: tier }
          };
          const strike = requireEffect(profile, 'strike', 'Strike');
          const burning = requireEffect(profile, 'condition', CONDITION.BURNING);
          return [
            ...(strike
              ? [
                  {
                    ...timing,
                    type: 'strike' as const,
                    weapon: WEAPON.LONGBOW,
                    ticks: Array.from({ length: pulses }, (_, index) => ({
                      atMs: index * interval * 1000,
                      coefficient: effectNumber(profile, strike, 'coefficient')
                    }))
                  }
                ]
              : []),
            ...(burning
              ? [
                  {
                    ...timing,
                    type: 'condition' as const,
                    condition: String(burning.condition),
                    stacks: effectNumber(profile, burning, 'stacks'),
                    duration: effectNumber(profile, burning, 'duration'),
                    atMs: 0,
                    applications: pulses,
                    intervalMs: interval * 1000
                  }
                ]
              : [])
          ];
        }
      }
    ]
  },
  [ID.BREACHING_STRIKE]: {
    name: 'Breaching Strike',
    icon: 'https://render.guildwars2.com/file/48B836AE01C6EC0D0A0A0680D23834960D556A7E/1770661.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Dagger',
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    skillWeapon: WEAPON.DAGGER,
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 840,
    // Keep commitment, damage, and boon removal together on the nearest 40 ms tick.
    interruptCommitMs: 760,
    // The simulated target has no boons; this multiplier belongs to the dagger burst.
    modifiers: [
      {
        id: 'warrior.breaching-strike-boonless',
        label: 'Breaching Strike',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.5,
        order: 100
      }
    ],
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 2.5
        }
      ]
    )
  },
  [ID.PATH_TO_VICTORY]: {
    name: 'Path to Victory',
    icon: 'https://render.guildwars2.com/file/337928249A067249569AA70D78120D0E03257203/3256396.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    // Numeric variants share the canonical burst's resource and trait contract.
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_71932]: {
    name: 'Path to Victory',
    icon: 'https://render.guildwars2.com/file/337928249A067249569AA70D78120D0E03257203/3256396.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_71950]: {
    name: 'Path to Victory',
    icon: 'https://render.guildwars2.com/file/337928249A067249569AA70D78120D0E03257203/3256396.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    // Numeric variants share the canonical burst's resource and trait contract.
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73006]: {
    name: "Harrier's Toss",
    icon: 'https://render.guildwars2.com/file/FE3E5C674895F8B2F59280552A460FE310BE32A0/3379205.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    // Numeric variants share the canonical burst's resource and trait contract.
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 3.5,
        hits: 1
      }
    ]
  },
  [ID.HARRIERS_TOSS]: {
    name: "Harrier's Toss",
    icon: 'https://render.guildwars2.com/file/FE3E5C674895F8B2F59280552A460FE310BE32A0/3379205.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73042]: {
    name: "Harrier's Toss",
    icon: 'https://render.guildwars2.com/file/FE3E5C674895F8B2F59280552A460FE310BE32A0/3379205.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    // Numeric variants share the canonical burst's resource and trait contract.
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      }
    ]
  },
  [ID.BLOODTHIRSTER]: {
    name: 'Bloodthirster',
    icon: 'https://render.guildwars2.com/file/9B1F4EC20A4B9A497A9A361052C608C5FFED3001/3790492.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    requiredMainHand: 'Sword',
    skillWeapon: WEAPON.SWORD,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 520,
    dualWieldCastTimeMs: 400,
    // Bloodthirster's strike and bleeding retain 80 ms of recovery with or without Dual Wielding.
    effects: impactEffects({ atMs: -80, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2
      },
      ...[3, 6, 9].map((stacks, index) => ({
        type: 'condition' as const,
        name: `Tier ${index + 1}`,
        condition: CONDITION.BLEEDING,
        stacks,
        duration: 6
      }))
    ]),
    // Packet selection uses the accepted spend, never the later live pool.
    effectVariants: [
      {
        when: () => true,
        transform(_runtime, cast, effects) {
          const tier = warriorBurstTier(warriorBurstSpend(cast)!);
          // Each authored bleeding tier remains independently patchable and removable.
          return effects.filter((effect) => effect.type !== 'condition' || effect.name === `Tier ${tier}`);
        }
      }
    ]
  }
};

/** Fields select their tier before the shared burst reservation spends adrenaline. */
export const combustiveShotFields: NonNullable<RuntimeHooks<WarriorRuntimeState, WarriorSkill>['modifyComboFields']> = (
  runtime,
  cast,
  fields
) => {
  if (cast.skill.id !== ID.COMBUSTIVE_SHOT) return fields;

  const tier = warriorBurstTier(warriorBurstRules(runtime).spend(runtime, cast.skill));
  const duration = tier * skillNumber(cast.skill, 'durationPerTier');
  return fields?.flatMap((field) =>
    field.ownerId !== 'warrior' ? [field] : duration > 0 ? [{ ...field, duration }] : []
  );
};
