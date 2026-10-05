import { warriorBurstRules } from '#gw2/professions/warrior/resource-rules.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { eventSkill, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { warriorBurstSpends, warriorBurstTier } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.EVISCERATE]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // Captured adrenaline selects only the strike coefficient; Might and burst ownership stay intact.
    effectVariants: [PROFILE.eviscerateTier1, PROFILE.eviscerateTier2, PROFILE.eviscerateTier3].map<
      NonNullable<Skill['effectVariants']>[number]
    >((profileId, index) => ({
      profileId,
      when: (runtime, cast) => warriorBurstTier(runtime, warriorBurstSpends.get(cast)!) === index + 1,
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
    })),
    // The API omits the burst's weapon; axe critical traits still apply to this strike.
    skillWeapon: 'Axe',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    cooldown: 8,
    castTimeMs: 0,
    adrenalineCost: 10,
    burst: true,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 5
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Eviscerate — Level 1 Damage'
      }
    ]
  },
  [ID.ARCING_SLICE]: {
    // Packet selection uses the accepted spend, never the later live pool.
    effectVariants: [
      {
        when: () => true,
        transform(runtime, cast, effects) {
          const tier = warriorBurstTier(runtime, warriorBurstSpends.get(cast)!);
          return effects.map((effect) =>
            effect.type === 'boon' && effect.boon === 'fury'
              ? { ...effect, duration: effect.duration * [1, 1.5, 2][tier - 1] }
              : effect
          );
        }
      }
    ],
    cooldown: 8,
    castTimeMs: 480,
    adrenalineCost: 10,
    burst: true,
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
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.EARTHSHAKER]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    skillWeapon: 'Hammer',
    cooldown: 8,
    castTimeMs: 1000,
    adrenalineCost: 10,
    burst: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.75,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'control',
        controlKind: 'stun'
      }
    ])
  },
  [ID.KILL_SHOT]: {
    // Packet selection uses the accepted spend, never the later live pool.
    effectVariants: [
      {
        when: () => true,
        transform(runtime, cast, effects) {
          const tier = warriorBurstTier(runtime, warriorBurstSpends.get(cast)!);
          return effects.map((effect) =>
            effect.type === 'strike'
              ? { ...effect, coefficient: (Number(effect.coefficient) * [2.25, 2.75, 3.25][tier - 1]) / 2.25 }
              : effect
          );
        }
      }
    ],
    skillWeapon: 'Rifle',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 1,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Kill Shot lands before its measured animation ends; tier scaling preserves this packet.
    cooldown: 8,
    castTimeMs: 1160,
    adrenalineCost: 10,
    burst: true,
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
    ]
  },
  [ID.SKULL_CRACK]: {
    // The burst's daze and damage share the observed impact before the animation ends.
    skillWeapon: 'Mace',
    cooldown: 8,
    castTimeMs: 560,
    adrenalineCost: 10,
    burst: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  [ID.COMBUSTIVE_SHOT]: {
    // Fixed pulses preserve independent Strike/Burning removal and persistent field cadence.
    effectVariants: [
      {
        profileId: PROFILE.combustiveShot,
        when: () => true,
        transform(runtime, cast) {
          const spent = warriorBurstSpends.get(cast)!;
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
          const burning = requireEffect(profile, 'condition', 'Burning');
          return [
            ...(strike
              ? [
                  {
                    ...timing,
                    type: 'strike' as const,
                    weapon: 'Longbow',
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
    ],
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    castTimeMs: 520,
    adrenalineCost: 10,
    burst: true,
    effects: []
  },
  [ID.BREACHING_STRIKE]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // Keep commitment, damage, and boon removal together on the nearest 40 ms tick.
    interruptCommitMs: 760,
    skillWeapon: 'Dagger',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    cooldown: 8,
    castTimeMs: 840,

    adrenalineCost: 10,
    burst: true,
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
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    // Numeric variants share the canonical burst's resource and trait contract.
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_71932]: {
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_71950]: {
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    // Numeric variants share the canonical burst's resource and trait contract.
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73006]: {
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    // Numeric variants share the canonical burst's resource and trait contract.
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
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
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73042]: {
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    // Numeric variants share the canonical burst's resource and trait contract.
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
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
    // Packet selection uses the accepted spend, never the later live pool.
    effectVariants: [
      {
        when: () => true,
        transform(runtime, cast, effects) {
          const tier = warriorBurstTier(runtime, warriorBurstSpends.get(cast)!);
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.bloodthirsterTiers);
          const bleeding = requireEffect(profile, 'condition', `Tier ${tier}`);
          return effects.flatMap<SkillEffect>((effect) =>
            effect.type === 'condition' && effect.condition === 'Bleeding'
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
    ],
    skillWeapon: 'Sword',
    castTimeMs: 500,
    dualWieldCastTimeMs: 400,
    adrenalineCost: 10,
    burst: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6
      }
    ])
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
      eventSkill(context)?.id === ID.KILL_SHOT &&
      (context.config?.target?.defiant === true || targetHealthBelow(context, 0.5))
  },
  {
    id: 'warrior.breaching-strike-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) => eventSkill(context)?.id === ID.BREACHING_STRIKE
  }
];

/** Fields select their tier before the shared burst reservation spends adrenaline. */
export const combustiveShotFields: NonNullable<
  RuntimeProfession<WarriorRuntimeState, WarriorSkill>['modifyComboFields']
> = (runtime, cast, fields) => {
  if (cast.skill.id !== ID.COMBUSTIVE_SHOT) return fields;
  const tier = warriorBurstTier(runtime, warriorBurstRules(runtime).spend(runtime, cast.skill));
  const duration =
    tier * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.combustiveShot), 'durationPerTier');
  return fields?.flatMap((field) =>
    field.ownerId !== 'warrior' ? [field] : duration > 0 ? [{ ...field, duration }] : []
  );
};
