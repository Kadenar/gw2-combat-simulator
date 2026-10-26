import { WEAPON, COMBO_FINISHER, CONTROL, COMBO_FIELD, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { warriorBurstRules } from '#gw2/professions/warrior/resource-rules.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { warriorBurstSpend, warriorBurstTier } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.EVISCERATE]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // The API omits the burst's weapon; axe critical traits still apply to this strike.
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
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Eviscerate — Level 1 Damage'
      }
    ],
    // Captured adrenaline selects only the strike coefficient; Might and burst ownership stay intact.
    effectVariants: [PROFILE.eviscerateTier1, PROFILE.eviscerateTier2, PROFILE.eviscerateTier3].map<
      NonNullable<Skill['effectVariants']>[number]
    >((profileId, index) => ({
      profileId,
      when: (runtime, cast) => warriorBurstTier(runtime, warriorBurstSpend(cast)!) === index + 1,
      transform: (runtime, cast) => {
        const profile = requireBalanceProfileFromContext(runtime, profileId);
        const strike = requireEffect(profile, 'strike', 'Strike');
        return (cast.skill.effects ?? []).flatMap<SkillEffect>((effect) =>
          effect.type === 'strike'
            ? strike
              ? [{ ...effect, coefficient: effectNumber(profile, strike, 'coefficient') }]
              : []
            : [effect]
        );
      }
    }))
  },
  [ID.ARCING_SLICE]: {
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.5
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
        transform(runtime, cast, effects) {
          const tier = warriorBurstTier(runtime, warriorBurstSpend(cast)!);
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
    skillWeapon: WEAPON.RIFLE,
    // Kill Shot lands before its measured animation ends; tier scaling preserves this packet.
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 1160,
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
        name: 'Kill Shot — Level 1 Damage',
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    // Packet selection uses the accepted spend, never the later live pool.
    effectVariants: [
      {
        when: () => true,
        transform(runtime, cast, effects) {
          const tier = warriorBurstTier(runtime, warriorBurstSpend(cast)!);
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
    effects: [],
    // Fixed pulses preserve independent Strike/Burning removal and persistent field cadence.
    effectVariants: [
      {
        profileId: PROFILE.combustiveShot,
        when: () => true,
        transform(runtime, cast) {
          const spent = warriorBurstSpend(cast)!;
          const tier = warriorBurstTier(runtime, spent);
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.combustiveShot);
          const interval = balanceProfileNumber(profile, 'pulseInterval');
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
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    skillWeapon: WEAPON.DAGGER,
    cooldown: 8,

    adrenalineCost: 10,
    burst: true,
    castTimeMs: 840,
    // Keep commitment, damage, and boon removal together on the nearest 40 ms tick.
    interruptCommitMs: 760,
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
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 6
      }
    ]),
    // Packet selection uses the accepted spend, never the later live pool.
    effectVariants: [
      {
        when: () => true,
        transform(runtime, cast, effects) {
          const tier = warriorBurstTier(runtime, warriorBurstSpend(cast)!);
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.bloodthirsterTiers);
          const bleeding = requireEffect(profile, 'condition', `Tier ${tier}`);
          return effects.flatMap<SkillEffect>((effect) =>
            effect.type === 'condition' && effect.condition === CONDITION.BLEEDING
              ? bleeding
                ? [
                    {
                      ...effect,
                      stacks: effectNumber(profile, bleeding, 'stacks'),
                      duration: effectNumber(profile, bleeding, 'duration')
                    }
                  ]
                : []
              : [effect]
          );
        }
      }
    ]
  }
});

/** Intrinsic live modifiers retain critical semantics and the simulator's boonless-target assumption. */
export const warriorBurstSkillModifiers: readonly Gw2ModifierRule[] = [
  {
    id: 'warrior.kill-shot-threshold',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    order: 100,
    // Kill Shot gets the same execute bonus from either a defiant target or live sub-50% health.
    when: (context) =>
      skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.KILL_SHOT &&
      (context.config?.target?.defiant === true || targetHealthBelow(context, 0.5))
  },
  {
    id: 'warrior.breaching-strike-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.BREACHING_STRIKE
  }
];

/** Fields select their tier before the shared burst reservation spends adrenaline. */
export const combustiveShotFields: NonNullable<
  RuntimeProfession<WarriorRuntimeState, WarriorSkill>['modifyComboFields']
> = (runtime, cast, fields) => {
  if (cast.skill.id !== ID.COMBUSTIVE_SHOT) return fields;

  const tier = warriorBurstTier(runtime, warriorBurstRules(runtime).spend(runtime, cast.skill));
  const duration = tier * balanceNumberFromContext(runtime, PROFILE.combustiveShot, 'durationPerTier');
  return fields?.flatMap((field) =>
    field.ownerId !== 'warrior' ? [field] : duration > 0 ? [{ ...field, duration }] : []
  );
};
