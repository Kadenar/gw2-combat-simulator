import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { naturesStrengthReaction } from '#gw2/professions/ranger/core/skills/weapons/mace.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { naturalFortitudeAmbushEffect } from '#gw2/professions/ranger/specializations/untamed/traits/behavior.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

/** Preserve the measured Quickness offsets, including projectiles and effects that outlive the cast. */
function impact(atMs: number, effects: readonly SkillEffect[]): SkillEffect[] {
  return impactEffects({ atMs, timingAnchor: 'castStart', timingScale: 'fixed' }, effects);
}

/** Delayed spore strikes and poison share their own breakdown row while retaining the parent ambush attribution. */
function spore(parentSkillName: string): SkillEffect[] {
  return impact(1960, [
    {
      type: 'strike',
      sourceId: ID.EXPLODING_SPORE,
      independentSourceStrike: true,
      name: 'Exploding Spore',
      damageBreakdownName: 'Exploding Spore',
      skillName: 'Exploding Spore',
      parentSkillName,
      coefficient: 0.583
    },
    {
      type: 'condition',
      sourceId: ID.EXPLODING_SPORE,
      name: 'Exploding Spore - Poisoned',
      damageBreakdownName: 'Exploding Spore',
      skillName: 'Exploding Spore',
      parentSkillName,
      condition: CONDITION.POISONED,
      stacks: 2,
      duration: 5
    }
  ]);
}

/** Each accepted ambush spends its window; only its first impact receives Natural Fortitude. */
function ambush(
  castTimeMs: number,
  firstHitMs: number,
  effects: readonly SkillEffect[],
  timing: { interruptCommitMs?: number; persistsAfterInterrupt?: boolean } = {}
): Partial<SkillDefinition<RangerSkill>> {
  return {
    castTimeMs,
    ...(timing.interruptCommitMs == null ? {} : { interruptCommitMs: timing.interruptCommitMs }),
    // Launched projectiles and their first-hit siphon outlive cancellation of the remaining animation.
    effects: [...effects, naturalFortitudeAmbushEffect(firstHitMs)].map((effect) =>
      timing.persistsAfterInterrupt ? { ...effect, persistsAfterInterrupt: true } : effect
    ),
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.ambush-consume' } }]
  };
}

// All timings use the observed timeline rounded to 40 ms; durations below exclude build expertise.
export const UNTAMED_WEAPON_AMBUSH_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.SUNDERING_VOLLEY]: {
    name: 'Sundering Volley',
    icon: 'https://render.guildwars2.com/file/76E435CE09EE9F155FA830BB05211BE0D7AE4DD2/2565746.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    unleashedAmbushSkill: true,
    ...ambush(
      760,
      680,
      [
        // Both projectiles are launched before their impacts, allowing a weapon swap during flight.
        ...impact(680, [
          { type: 'strike', coefficient: 0.65, projectile: true },
          { type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 8 },
          { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 }
        ]),
        ...impact(880, [
          { type: 'strike', coefficient: 0.65, projectile: true },
          { type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 8 },
          { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1.25 }
        ])
      ],
      { interruptCommitMs: 560, persistsAfterInterrupt: true }
    )
  },
  [ID.NEUROTOXIN_BURST]: {
    name: 'Neurotoxin Burst',
    icon: 'https://render.guildwars2.com/file/3B7CC3146E0796B901AA05E4D7AD9AD0DDCC2BC0/3098874.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_1',
    cooldown: 0,
    unleashedAmbushSkill: true,
    ...ambush(
      600,
      560,
      impact(560, [
        { type: 'strike', coefficient: 2 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 8 },
        { type: 'condition', condition: CONDITION.POISONED, stacks: 2, duration: 8 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 }
      ])
    )
  },
  [ID.RAMPANT_GROWTH]: {
    name: 'Rampant Growth',
    icon: 'https://render.guildwars2.com/file/AA6DF43F39613B3BFF36EA5E5DE8E479B54C3D13/3256376.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    unleashedAmbushSkill: true,
    ...ambush(
      600,
      480,
      impact(480, [
        { type: 'strike', coefficient: 3, reactions: [naturesStrengthReaction()] },
        { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }
      ]),
      // Interrupted casts commit their effects only after reaching the supplied commitment boundary.
      { interruptCommitMs: 520 }
    )
  },
  [ID.SOLAR_BRILLIANCE]: {
    name: 'Solar Brilliance',
    icon: 'https://render.guildwars2.com/file/47D72665624F25469A11D86943F9037591F444AF/3098875.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    unleashedAmbushSkill: true,
    ...ambush(1160, 1160, [
      // Blindness precedes damage; the six pulses continue independently after the animation ends.
      ...impact(640, [{ type: 'condition', condition: CONDITION.BLINDNESS, stacks: 1, duration: 3 }]),
      {
        type: 'strike',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        ticks: [1160, 1680, 2200, 2720, 3240, 3760].map((atMs) => ({ atMs, coefficient: 0.5 }))
      }
    ])
  },
  [ID.SAVAGE_SLASH]: {
    name: 'Savage Slash',
    icon: 'https://render.guildwars2.com/file/D30E4B593AEE93C795B40F020B3727FCCC5E39D7/2565747.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    cooldown: 0,
    unleashedAmbushSkill: true,
    ...ambush(680, 600, [
      ...impact(600, [
        { type: 'strike', coefficient: 3.3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 }
      ]),
      ...spore('Savage Slash')
    ])
  },
  [ID.MULTISHOT]: {
    name: 'Multishot',
    icon: 'https://render.guildwars2.com/file/AF7A96BB16BD9453059730A6B5EF437E7C72AB3A/2565749.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_1',
    cooldown: 0,
    unleashedAmbushSkill: true,
    ...ambush(520, 480, impact(480, [{ type: 'strike', coefficient: 2.5, projectile: true }]))
  },
  [ID.TOXIC_SHOT]: {
    name: 'Toxic Shot',
    icon: 'https://render.guildwars2.com/file/ED090826AD5C2E700D6604F9E0CC7C1AAEF0C25D/2565750.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_1',
    cooldown: 0,
    unleashedAmbushSkill: true,
    ...ambush(
      920,
      640,
      impact(640, [
        {
          type: 'strike',
          coefficient: 1.8,
          projectile: true,
          // Test poison at impact before this attack applies its own poison, so a clean target receives no torment.
          reactions: [
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'first',
              when: (runtime, { event }) => runtime.combat.targetHasCondition(CONDITION.POISONED, event.at),
              do: [
                {
                  type: 'ranger.toxic-shot',
                  id: 'poisoned-target',
                  effects: [
                    { name: CONDITION.TORMENT, type: 'condition', condition: CONDITION.TORMENT, stacks: 4, duration: 6 }
                  ]
                }
              ]
            }
          ]
        },
        // The supplied log records four poison stacks; the wiki lists three. Keep the observed count here.
        { type: 'condition', condition: CONDITION.POISONED, stacks: 4, duration: 6 },
        { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 }
      ])
    )
  },
  [ID.RAVAGERS_ABANDON]: {
    name: "Ravager's Abandon",
    icon: 'https://render.guildwars2.com/file/100EF926B3F04A73719E7CD531C8ABC81938CF19/3379182.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    cooldown: 0,
    unleashedAmbushSkill: true,
    ...ambush(680, 600, [...impact(600, [{ type: 'strike', coefficient: 3 }]), ...spore("Ravager's Abandon")])
  }
};
