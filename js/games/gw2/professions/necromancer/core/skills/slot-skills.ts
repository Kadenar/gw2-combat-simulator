import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasSelectedSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { isCorruptionCompletionEffect } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import {
  masterOfCorruptionBloodIsPower,
  masterOfCorruptionConsumeConditions,
  masterOfCorruptionCorrosivePoisonCloud,
  masterOfCorruptionPlaguelands
} from '#gw2/professions/necromancer/core/traits/conditions.js';
import { signetsOfSufferingPassive } from '#gw2/professions/necromancer/core/traits/behavior.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */

export const NECROMANCER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WELL_OF_BLOOD]: {
    castTimeMs: 680,
    effects: []
  },
  [ID.SUMMON_BONE_FIEND]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.summon-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 360,
    effects: [],
    rechargeOnMinionDeath: true
  },
  [ID.PUTRID_EXPLOSION]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.command-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 360,
    minionKey: 'bone-minion',
    consumes: 1,
    effects: [
      { type: 'strike', coefficient: 1, hits: 1, actorType: 'summon' },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      }
    ]
  },
  [ID.SUMMON_BONE_MINIONS]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.summon-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 360,
    effects: [],
    rechargeOnMinionDeath: true
  },
  [ID.BLOOD_IS_POWER]: {
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) => effects.filter((effect) => !isCorruptionCompletionEffect(effect))
      }
    ],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [
      { on: 'castStart', do: { type: 'necromancer.blood-is-power-launch' } },
      { on: 'castCommit', do: { type: 'necromancer.corruption' } }
    ],
    castTimeMs: 880,
    // Blood Is Power cannot cancel its remaining aftercast, so importers and live execution retain the full cast lane.
    interruptCommitMs: 600,
    retainsCastLockoutAfterInterrupt: true,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      ...impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.5 },
        { type: 'condition', condition: 'Bleeding', stacks: 4, duration: 15 }
      ]),
      // Corruption completion owns self-conditions and boons independently of hostile impacts.
      { name: 'Self Bleeding', type: 'condition', condition: 'Bleeding', stacks: 2, duration: 10, target: 'self' },
      masterOfCorruptionBloodIsPower,
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 5,
        duration: 20,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  // Wells use their EVTC-observed Quickness packet schedule for every damage and condition pulse.
  [ID.WELL_OF_CORRUPTION]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        // Accepted strikes grant live skill tuning through the percentage resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.skill-life-force' }
          }
        ],
        ticks: [320, 1280, 2280, 3280, 4280, 5280].map((atMs) => ({ atMs, coefficient: 0.5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    lifeForceGain: 1
  },
  [ID.WELL_OF_SUFFERING]: {
    // The well commits after 320 ms, allowing its remaining pulses to continue after a later interruption.
    interruptCommitMs: 320,
    castTimeMs: 480,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [280, 1280, 2280, 3280, 4280, 5280].map((atMs) => ({ atMs, coefficient: 1 }))
      },
      {
        type: 'condition',
        ticks: [280, 1280, 2280, 3280, 4280, 5280].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 2,
          duration: 5
        }))
      }
    ])
  },
  [ID.SUMMON_BLOOD_FIEND]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.summon-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 680,
    effects: []
  },
  [ID.CONSUME_CONDITIONS]: {
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) => effects.filter((effect) => !isCorruptionCompletionEffect(effect))
      }
    ],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.corruption' } }],
    castTimeMs: 680,
    effects: [
      // Corruption completion owns self-conditions and boons independently of hostile impacts.
      {
        name: 'Self Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 4,
        target: 'self'
      },
      masterOfCorruptionConsumeConditions
    ]
  },
  [ID.PLAGUELANDS]: {
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) => effects.filter((effect) => !isCorruptionCompletionEffect(effect))
      }
    ],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.corruption' } }],
    castTimeMs: 920,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: Array.from({ length: 9 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 3.51 / 9 }))
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 9 }, (_, index) => ({
            atMs: 1000 + index * 1000,
            condition: 'Bleeding',
            stacks: 1,
            duration: 8
          }))
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 8 }, (_, index) => ({
            atMs: 2000 + index * 1000,
            condition: 'Poisoned',
            stacks: 1,
            duration: 5
          }))
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 7 }, (_, index) => ({
            atMs: 3000 + index * 1000,
            condition: 'Torment',
            stacks: 1,
            duration: 5
          }))
        },
        {
          type: 'condition',
          // Vulnerability starts on pulse four and repeats through the final pulse.
          ticks: Array.from({ length: 6 }, (_, index) => ({
            atMs: 4000 + index * 1000,
            condition: 'Vulnerability',
            stacks: 1,
            duration: 8
          }))
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 5 }, (_, index) => ({
            atMs: 5000 + index * 1000,
            condition: 'Crippled',
            stacks: 1,
            duration: 2
          }))
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 4 }, (_, index) => ({
            atMs: 6000 + index * 1000,
            condition: 'Weakness',
            stacks: 1,
            duration: 3
          }))
        },
        {
          type: 'blind',
          applications: 3,
          atMs: 7000,
          intervalMs: 1000,
          duration: 3
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 2 }, (_, index) => ({
            atMs: 8000 + index * 1000,
            condition: 'Chilled',
            stacks: 1,
            duration: 2
          }))
        },
        {
          type: 'condition',
          ticks: [{ atMs: 9000, condition: 'Burning', stacks: 1, duration: 10 }]
        }
      ]),
      // Corruption completion owns self-conditions and boons independently of hostile impacts.
      { name: 'Self Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 10, target: 'self' },
      masterOfCorruptionPlaguelands
    ]
  },
  [ID.LICH_FORM]: {
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.enter-lich' } }],
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    castTimeMs: 680,
    effects: [],
    // Life force is granted once when the transform ends, by its manual or timed exit.
    cooldown: 120
  },
  [ID.PLAGUE_SIGNET]: {
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.signet-transfer' } }],
    castTimeMs: 0,
    // The handler and tooltip share the maximum number of distinct self-condition types transferred.
    conditionsTransferred: 5,
    effects: []
  },
  [ID.RIGOR_MORTIS]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.command-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 0,
    minionKey: 'bone-fiend',
    controlWindow: 4,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 0.25,
            sourceId: 3634,
            name: 'Rigor Mortis - Bone Shard',
            controlKind: 'immobilize',

            comboFinishers: [
              {
                ownerId: 'necromancer',
                finisherType: 'Projectile',
                chance: 1,
                ambiguousFieldSelection: 'oldest'
              }
            ]
          },
          {
            atMs: 760,
            coefficient: 0.25,
            sourceId: 3634,
            name: 'Rigor Mortis - Bone Shard',
            controlKind: 'immobilize',

            comboFinishers: [
              {
                ownerId: 'necromancer',
                finisherType: 'Projectile',
                chance: 1,
                ambiguousFieldSelection: 'oldest'
              }
            ]
          }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'summon'
      }
    ]
  },
  [ID.TASTE_OF_DEATH]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.command-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 680,
    minionKey: 'blood-fiend',
    consumes: 1,
    effects: []
  },
  [ID.SUMMON_SHADOW_FIEND]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.summon-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 360,
    effects: [],
    rechargeOnMinionDeath: true
  },
  [ID.HAUNT]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.command-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 0,
    minionKey: 'shadow-fiend',
    impactDelay: 2,
    lifeForceOnHit: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        actorType: 'summon',
        // Only an accepted command strike grants Haunt life force.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'summon',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.skill-life-force' }
          }
        ]
      },
      { type: 'blind', actorType: 'summon', duration: 5 },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      }
    ]
  },
  [ID.WELL_OF_DARKNESS]: {
    castTimeMs: 480,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        ticks: [280, 1280, 2280, 3280, 4280, 5280].map((atMs) => ({ atMs, coefficient: 0.8 })),
        comboFields: [{ ownerId: 'necromancer', fieldType: 'Dark', duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'blind',
          applications: 6,
          atMs: 280,
          intervalMs: 1000,
          intervalTimingScale: 'fixed',
          duration: 3
        },
        {
          type: 'condition',
          condition: 'Chilled',
          stacks: 1,
          duration: 2,
          applications: 6,
          atMs: 280,
          intervalMs: 1000,
          intervalTimingScale: 'fixed'
        }
      ])
    ]
  },
  [ID.SIGNET_OF_UNDEATH]: {
    castTimeMs: 360,
    // Reviving allies is outside the simulation; casting still consumes time and starts recharge.
    effects: [],
    lifeForceGain: 0
  },
  [ID.SPECTRAL_GRASP]: {
    castTimeMs: 600,
    effects: [
      {
        type: 'condition',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'condition.applied',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => event.sourceId === event.skillId,
            do: { type: 'necromancer.skill-life-force' }
          }
        ],
        condition: 'Chilled',
        stacks: 1,
        duration: 4
      }
    ],
    lifeForceGain: 15
  },
  [ID.SIGNET_OF_SPITE]: {
    castTimeMs: 880,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1 },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 10 },
      { type: 'condition', condition: 'Poisoned', stacks: 2, duration: 10 },
      { type: 'condition', condition: 'Torment', stacks: 2, duration: 6 },
      { type: 'blind', duration: 5 },
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 10 },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 10 },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 10 }
    ])
  },
  [ID.SUMMON_FLESH_GOLEM]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.summon-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 680,
    effects: [],
    rechargeOnMinionDeath: true
  },
  [ID.CHARGE]: {
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.command-minion' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 680,
    minionKey: 'flesh-golem',
    effects: [
      { type: 'strike', coefficient: 1.5, hits: 1, actorType: 'summon' },
      {
        type: 'control',
        actorType: 'summon',
        controlKind: 'knockdown'
      }
    ]
  },
  [ID.CORROSIVE_POISON_CLOUD]: {
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) => effects.filter((effect) => !isCorruptionCompletionEffect(effect))
      }
    ],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.corruption' } }],
    castTimeMs: 600,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 2
      },
      // Corruption completion owns self-conditions and boons independently of hostile impacts.
      { name: 'Self Weakness', type: 'condition', condition: 'Weakness', stacks: 1, duration: 6, target: 'self' },
      masterOfCorruptionCorrosivePoisonCloud
    ]
  },
  [ID.SIGNET_OF_VAMPIRISM]: {
    castTimeMs: 880,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({
          atMs: 1000 + index * 1000,
          coefficient: 0,
          flatStrikeBase: 163,
          flatStrikePowerCoeff: 0.05
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'effect',
        name: 'Signet of Vampirism - Vampiric Mark',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  }
});

/** Checks whether Signet of Spite's selected, out-of-shroud, off-cooldown passive is active. */
function signetOfSpitePassiveActive(context: Gw2ModifierContext): boolean {
  return (
    hasSelectedSkill(context, 'Signet of Spite') &&
    !readProfessionCoreState<NecromancerCoreState>(context.runtime?.profession).activeShroud &&
    !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_SPITE, context.time)
  );
}

/** Restricts player attributes and outgoing modifiers to player-owned contexts. */
function playerModifierContext(context: Gw2ModifierContext): boolean {
  // Eventless attribute queries describe the player; event queries follow explicit outgoing ownership.
  return context.event
    ? isGw2PlayerModifierOwnedEvent(context.event)
    : context.actorType == null || context.actorType === 'player';
}

/** Keep selected Signet of Spite's build provenance and live suppression in one policy. */
export function modifySignetOfSpiteAttributes(
  context: Gw2ModifierContext,
  result: Gw2MutableStats & { power: number }
): void {
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (hasSelectedSkill(context, 'Signet of Spite')) {
    const signetOfSpiteProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfSpite);
    const signetPower = balanceProfileNumber(signetOfSpiteProfile, 'attributeBonus');
    const passiveActive = playerModifierContext(context) && signetOfSpitePassiveActive(context);
    if (staticRulesApplied) {
      if (!passiveActive) result.power -= signetPower;
    } else if (passiveActive) {
      result.power += signetPower;
    }
  }
}

/** Equipped signets activate without a cast; their scheduler retains cadence through suppression and overflow. */
export const NECROMANCER_SIGNET_PASSIVES = [
  {
    passive: 'undeath',
    name: 'Signet of Undeath',
    skillId: ID.SIGNET_OF_UNDEATH,
    profileId: PROFILE.signetOfUndeathPassive
  },
  {
    passive: 'vampirism',
    name: 'Signet of Vampirism',
    skillId: ID.SIGNET_OF_VAMPIRISM,
    profileId: PROFILE.signetOfVampirismPassive
  }
] as const;

/** Resolve the selected signet's live cooldown/shroud policy at each independently scheduled pulse. */
export function applyNecromancerSignetPassive(
  runtime: NecromancerRuntime,
  policy: (typeof NECROMANCER_SIGNET_PASSIVES)[number]
): void {
  const state = runtime.profession.core;
  const id = policy.skillId;
  const inShroud = Boolean(state.activeShroud && state.activeShroud !== 'lich');
  if ((runtime.cooldowns.get(id) ?? 0) > runtime.time && !signetsOfSufferingPassive(runtime, inShroud)) return;
  const profile = requireBalanceProfileFromContext(runtime, policy.profileId);
  if (policy.passive === 'undeath') grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
  else {
    const strike = requireEffect(profile, 'strike', 'Signet of Vampirism - Passive Life Siphon');
    if (strike)
      runtime.emit(
        buildResolverStrike({
          at: runtime.time,
          source: 'necromancer',
          sourceId: id,
          actorType: 'effect',
          skillId: id,
          skillName: strike.name,
          coefficient: 0,
          skillWeapon: 'Unequipped',
          flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
          flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
          canCrit: strike.canCrit !== false,
          damageKind: strike.damageKind || ''
        })
      );
  }
}
